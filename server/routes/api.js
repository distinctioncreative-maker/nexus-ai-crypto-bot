const express = require('express');
const router = express.Router();
const userStore = require('../userStore');
const { authenticate, supabase } = require('../middleware/auth');
const { getSignals, getNews } = require('../services/signalEngine');
const { loadUserState, saveUserSettings } = require('../db/persistence');
const { getCoinbaseProducts, isSupportedProduct } = require('../services/productCatalog');

/**
 * Validate Ollama is reachable and has at least one model installed.
 * Returns { valid: bool, error: string|null }
 */
async function validateOllamaConnection() {
    try {
        const axios = require('axios');
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const res = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
        const models = res.data?.models || [];
        if (models.length === 0) {
            return { valid: false, error: 'Ollama is running but has no models installed. Run: ollama pull qwen2.5:14b' };
        }
        return { valid: true, error: null, models: models.map(m => m.name) };
    } catch (err) {
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        return { valid: false, error: `Cannot reach Ollama at ${ollamaUrl}. Make sure Ollama is running: ollama serve` };
    }
}

/**
 * Validate Coinbase Advanced Trade API keys by calling the accounts endpoint.
 * Returns { valid: bool, error: string|null }
 */
async function validateCoinbaseKeys(apiKey, apiSecret) {
    try {
        const { coinbaseFetch } = require('../services/liveTrading');
        await coinbaseFetch(apiKey, apiSecret, 'GET', '/api/v3/brokerage/accounts?limit=1');
        return { valid: true, error: null };
    } catch (err) {
        const msg = err.message || '';
        if (msg.includes('401') || msg.includes('403') || msg.includes('INVALID')) {
            return { valid: false, error: 'Coinbase API keys are invalid. Verify your key ID and secret in the Coinbase portal.' };
        }
        if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
            return { valid: false, error: 'Cannot reach Coinbase API. Check your network connection.' };
        }
        return { valid: false, error: `Coinbase API error: ${msg}` };
    }
}

async function hydrateUser(userId) {
    const loaded = await loadUserState(supabase, userId);
    if (loaded) userStore.restoreState(userId, loaded);
}

function getStatusPayload(userId) {
    const state = userStore.getPaperState(userId);
    return {
        isConfigured: userStore.hasKeys(userId),
        hasCoinbaseKeys: userStore.hasCoinbaseKeys(userId),
        paperMode: state.engineStatus !== 'LIVE_RUNNING',
        userId,
        engineStatus: state.engineStatus,
        tradingMode: state.tradingMode,
        isLiveMode: state.isLiveMode,
        selectedProduct: state.selectedProduct,
        riskSettings: state.riskSettings,
        persistedStateReady: true
    };
}

// Public: health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected: debug info — lists loaded env vars (keys masked) and route count
router.get('/debug', authenticate, (req, res) => {
    let routes = [];
    try {
        routes = (router.stack || [])
            .filter(r => r.route && r.route.path && r.route.methods)
            .map(r => `${Object.keys(r.route.methods).join(',').toUpperCase()} /api${r.route.path}`);
    } catch (_) { routes = ['(route introspection unavailable)']; }

    res.json({
        status: 'router_loaded',
        timestamp: new Date().toISOString(),
        env: {
            SUPABASE_URL: process.env.SUPABASE_URL ? '✓ set' : '✗ missing',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ set' : '✗ missing',
            FRONTEND_URL: process.env.FRONTEND_URL || '(not set)',
            PORT: process.env.PORT || '3001',
            NODE_ENV: process.env.NODE_ENV || 'development',
            GROQ_API_KEY: process.env.GROQ_API_KEY ? '✓ set' : '✗ missing (using Ollama fallback)',
            GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile (default)',
        },
        routes
    });
});

// Protected: check if this user has configured their keys
router.get('/status', authenticate, async (req, res) => {
    await hydrateUser(req.userId);
    res.json(getStatusPayload(req.userId));
});

// Protected: securely ingest keys into per-user memory
router.post('/setup', authenticate, async (req, res) => {
    const { coinbaseKey, coinbaseSecret } = req.body;

    // Validate AI provider is reachable (Groq takes priority over Ollama)
    if (!process.env.GROQ_API_KEY) {
        const ollamaResult = await validateOllamaConnection();
        if (!ollamaResult.valid) {
            return res.status(400).json({ error: ollamaResult.error });
        }
    }

    // Validate Coinbase keys only if provided
    if (coinbaseKey && coinbaseSecret) {
        const cbResult = await validateCoinbaseKeys(coinbaseKey, coinbaseSecret);
        if (!cbResult.valid) {
            return res.status(400).json({ error: cbResult.error });
        }
    }

    userStore.setKeys(req.userId, coinbaseKey || null, coinbaseSecret || null);
    const provider = process.env.GROQ_API_KEY ? 'Groq' : 'Ollama';
    console.log(`🔒 Setup complete for user ${req.userId} — AI provider: ${provider}`);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(error => console.warn('setup persistence failed:', error.message));
    res.json({ success: true, message: `${provider} AI connected. Start paper trading when ready.` });
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
        'stopLossPercent', 'takeProfitPercent', 'enableKellySize',
        'stopLossPrice', 'takeProfitPrice',
        'multiTpLevels', 'trailingStopPct'
    ];
    const settings = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) settings[key] = req.body[key];
    }
    userStore.updateRiskSettings(req.userId, settings);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(error => console.warn('risk persistence failed:', error.message));
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
    const engine = userStore.getEngineState(req.userId);
    if (engine.engineStatus === 'LIVE_RUNNING' && mode === 'FULL_AUTO') {
        return res.status(400).json({ error: 'Live trading is AI Assisted only in this release.' });
    }
    userStore.setTradingMode(req.userId, mode);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(error => console.warn('trading-mode persistence failed:', error.message));
    res.json({ success: true, tradingMode: mode });
});

// Protected: explicit paper/live execution engine state
router.post('/engine', authenticate, async (req, res) => {
    const { engineStatus } = req.body;
    if (!['STOPPED', 'PAPER_RUNNING', 'LIVE_RUNNING'].includes(engineStatus)) {
        return res.status(400).json({ error: 'engineStatus must be STOPPED, PAPER_RUNNING, or LIVE_RUNNING' });
    }
    if (engineStatus === 'LIVE_RUNNING' && !userStore.getKeys(req.userId)?.coinbaseApiKey) {
        return res.status(400).json({ error: 'Coinbase API keys are required before live trading.' });
    }
    userStore.setEngineStatus(req.userId, engineStatus);
    await saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId));
    res.json({ success: true, ...userStore.getEngineState(req.userId) });
});

// Protected: set live/paper mode
router.post('/live-mode', authenticate, (req, res) => {
    const { isLive } = req.body;
    userStore.setLiveMode(req.userId, !!isLive);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(error => console.warn('live-mode persistence failed:', error.message));
    res.json({ success: true, ...userStore.getEngineState(req.userId) });
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
router.post('/confirm-trade', authenticate, async (req, res) => {
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
    const engine = userStore.getEngineState(req.userId);
    if (engine.engineStatus === 'STOPPED') {
        return res.status(409).json({ error: 'Execution engine is stopped.' });
    }

    if (pending.isLive || engine.engineStatus === 'LIVE_RUNNING') {
        if (engine.engineStatus !== 'LIVE_RUNNING') {
            return res.status(409).json({ error: 'Pending trade is live but live engine is not running.' });
        }
        const { executeLiveOrder } = require('../services/marketStream');
        const events = [];
        const liveResult = await executeLiveOrder(
            req.userId,
            pending.side,
            finalAmount,
            pending.price,
            pending.product,
            pending.reasoning,
            (type, payload) => events.push({ type, payload })
        );
        return res.json({ success: true, executed: !!liveResult?.executed, trade: liveResult?.trade || null, events });
    }

    const executed = userStore.executePaperTrade(req.userId, pending.side, finalAmount, pending.price, pending.reasoning);

    if (executed) {
        // Wire SmartTrade position tracking — same as the WS CONFIRM_TRADE path
        const { openPosition, closePosition, defaultTpConfig } = require('../services/positionManager');
        const u = userStore._ensureUser(req.userId);
        if (pending.side === 'BUY') {
            openPosition(req.userId, pending.product, finalAmount, pending.price, defaultTpConfig(u.riskSettings));
        } else if (pending.side === 'SELL') {
            closePosition(req.userId, pending.product);
        }
    }

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

// Protected: get real crypto news
router.get('/news', authenticate, async (req, res) => {
    try {
        const news = await getNews();
        res.json(news);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Protected: get full Coinbase product catalog (cached 1 hour)
router.get('/products', authenticate, async (req, res) => {
    res.json(await getCoinbaseProducts());
});

// Protected: validate a Coinbase product id before client-side switching
router.get('/products/:productId/validate', authenticate, async (req, res) => {
    const productId = req.params.productId;
    res.json({ productId, supported: await isSupportedProduct(productId) });
});

// Protected: reconfigure keys (same as setup but clears existing first)
router.post('/reconfigure', authenticate, async (req, res) => {
    const { coinbaseKey, coinbaseSecret } = req.body;

    if (!process.env.GROQ_API_KEY) {
        const ollamaResult = await validateOllamaConnection();
        if (!ollamaResult.valid) {
            return res.status(400).json({ error: ollamaResult.error });
        }
    }

    if (coinbaseKey && coinbaseSecret) {
        const cbResult = await validateCoinbaseKeys(coinbaseKey, coinbaseSecret);
        if (!cbResult.valid) {
            return res.status(400).json({ error: cbResult.error });
        }
    }

    userStore.setKeys(req.userId, coinbaseKey || null, coinbaseSecret || null);
    saveUserSettings(supabase, req.userId, userStore._ensureUser(req.userId)).catch(error => console.warn('reconfigure persistence failed:', error.message));
    res.json({ success: true, message: 'Keys updated.' });
});

// Protected: return AI provider status
router.get('/ai-status', authenticate, async (req, res) => {
    if (process.env.GROQ_API_KEY) {
        return res.json({ provider: 'groq', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', valid: true });
    }
    const result = await validateOllamaConnection();
    res.json({ provider: 'ollama', ...result });
});

// Protected: reset paper portfolio — clears all trades, resets balance to $100k
router.post('/reset-paper-portfolio', authenticate, async (req, res) => {
    const userId = req.userId;
    try {
        // Reset in-memory state
        const user = userStore._ensureUser(userId);
        user.paperTradingState.balance = 100000;
        user.paperTradingState.assetHoldings = 0;
        user.paperTradingState.trades = [];
        user.paperTradingState.learningHistory = [];
        user.productHoldings = {};

        // Reset in DB
        if (supabase) {
            await supabase.from('user_settings').upsert({
                user_id: userId, balance: 100000, asset_holdings: 0,
                product_holdings: {}, updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            await supabase.from('paper_trades').delete().eq('user_id', userId);
        }

        console.log(`🔄 Paper portfolio reset for user ${userId}`);
        res.json({ success: true, message: 'Paper portfolio reset to $100,000', balance: 100000 });
    } catch (err) {
        console.error('reset-paper-portfolio error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Protected: Situation Room — AI agents answer free-form user questions with live context
router.post('/situation-room', authenticate, async (req, res) => {
    const { message, productId, history } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required.' });
    }
    const { answerUserQueryMultiAgent } = require('../services/aiEngine');
    const responses = [];
    try {
        await answerUserQueryMultiAgent(
            req.userId,
            message.trim(),
            productId,
            (agentId, name, role, color, text) => {
                responses.push({ agentId, name, role, color, text });
            },
            Array.isArray(history) ? history : []
        );
        res.json({ agents: responses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
