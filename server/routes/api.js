const express = require('express');
const router = express.Router();
const userStore = require('../userStore');
const { authenticate, supabase } = require('../middleware/auth');
const { getSignals } = require('../services/signalEngine');
const { saveUserSettings } = require('../db/persistence');

// Public: health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected: check if this user has configured their keys
router.get('/status', authenticate, (req, res) => {
    res.json({
        isConfigured: userStore.hasKeys(req.userId),
        paperMode: true,
        userId: req.userId
    });
});

// Protected: securely ingest keys into per-user memory
router.post('/setup', authenticate, (req, res) => {
    const { coinbaseKey, coinbaseSecret, geminiKey } = req.body;

    if (!coinbaseKey || !coinbaseSecret || !geminiKey) {
        return res.status(400).json({ error: 'Missing required keys.' });
    }

    userStore.setKeys(req.userId, coinbaseKey, coinbaseSecret, geminiKey);
    console.log(`🔒 Keys loaded for user ${req.userId}`);
    // Persist encrypted keys immediately so they survive server restart
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(() => {});
    res.json({ success: true, message: 'Keys securely loaded for your session.' });
});

// Protected: fetch this user's portfolio
router.get('/portfolio', authenticate, (req, res) => {
    res.json(userStore.getPaperState(req.userId));
});

// Protected: update risk settings
router.post('/risk-settings', authenticate, (req, res) => {
    const allowed = [
        'maxTradePercent', 'dailyLossLimitPercent', 'maxSingleOrderUSD',
        'maxPositionPercent', 'volatilityReduceThreshold',
        'stopLossPercent', 'takeProfitPercent', 'enableKellySize'
    ];
    const settings = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) settings[key] = req.body[key];
    }
    userStore.updateRiskSettings(req.userId, settings);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(() => {});
    res.json({ success: true, riskSettings: userStore.getPaperState(req.userId).riskSettings });
});

// Protected: kill switch
router.post('/kill-switch', authenticate, (req, res) => {
    const { activate, reason } = req.body;
    if (activate) {
        userStore.tripKillSwitch(req.userId, reason || 'Manual kill switch activated');
    } else {
        userStore.resetKillSwitch(req.userId);
    }
    res.json({ success: true, killSwitch: userStore._ensureUser(req.userId).killSwitch });
});

// Protected: set trading mode
router.post('/trading-mode', authenticate, (req, res) => {
    const { mode } = req.body;
    if (!['FULL_AUTO', 'AI_ASSISTED'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be FULL_AUTO or AI_ASSISTED' });
    }
    userStore.setTradingMode(req.userId, mode);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(() => {});
    res.json({ success: true, tradingMode: mode });
});

// Protected: set live/paper mode
router.post('/live-mode', authenticate, (req, res) => {
    const { isLive } = req.body;
    userStore.setLiveMode(req.userId, !!isLive);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(() => {});
    res.json({ success: true, isLiveMode: !!isLive });
});

// Protected: get notifications
router.get('/notifications', authenticate, (req, res) => {
    res.json(userStore.getNotifications(req.userId));
});

// Protected: mark notifications read
router.post('/notifications/read', authenticate, (req, res) => {
    const user = userStore._ensureUser(req.userId);
    user.notifications.forEach(n => { n.read = true; });
    res.json({ success: true });
});

// Protected: get strategy leaderboard
router.get('/strategies', authenticate, (req, res) => {
    res.json(userStore.getStrategies(req.userId));
});

// Protected: confirm or reject a pending AI_ASSISTED trade
router.post('/confirm-trade', authenticate, (req, res) => {
    const { tradeId, accepted, amount } = req.body;
    const pending = userStore.getPendingTrade(req.userId);

    if (!pending || pending.tradeId !== tradeId) {
        return res.status(404).json({ error: 'No matching pending trade found' });
    }

    if (Date.now() > pending.expiresAt) {
        userStore.clearPendingTrade(req.userId);
        return res.status(410).json({ error: 'Trade expired' });
    }

    userStore.clearPendingTrade(req.userId);

    if (!accepted) {
        return res.json({ success: true, executed: false });
    }

    const finalAmount = amount || pending.amount;
    const executed = userStore.executePaperTrade(
        req.userId, pending.side, finalAmount, pending.price, pending.reasoning
    );

    res.json({ success: true, executed: !!executed, trade: executed || null });
});

// Protected: run a backtest (proxies to backtestEngine)
router.get('/backtest', authenticate, async (req, res) => {
    try {
        const { runBacktest } = require('../services/backtestEngine');
        const { productId = 'BTC-USD', days = '30', strategy = 'COMBINED' } = req.query;
        const result = await runBacktest(productId, parseInt(days), strategy);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Protected: get live signal data
router.get('/signals', authenticate, async (req, res) => {
    try {
        const signals = await getSignals();
        res.json(signals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
