const userStore = require('../userStore');
let _persistence = null;
let _supabase = null;
function getPersistence() { if (!_persistence) _persistence = require('../db/persistence'); return _persistence; }
function getSupabase() { if (!_supabase) _supabase = require('../middleware/auth').supabase; return _supabase; }

const BASE_STRATEGIES = [
    {
        id: 'MOMENTUM',
        name: 'Momentum MA Cross',
        parameters: { maPeriod: 10, slowMaPeriod: 30, momentumLookback: 5 }
    },
    {
        id: 'MEAN_REVERSION',
        name: 'Mean Reversion RSI',
        parameters: { rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70 }
    },
    {
        id: 'TREND_FOLLOWING',
        name: 'Trend Following EMA',
        parameters: { emaPeriod: 20, adxPeriod: 14, adxThreshold: 25 }
    },
    {
        id: 'SENTIMENT_DRIVEN',
        name: 'Sentiment Driven',
        parameters: { sentimentWeight: 0.7, technicalWeight: 0.3, rsiPeriod: 14 }
    },
    {
        id: 'COMBINED',
        name: 'Combined Signal',
        parameters: { maPeriod: 10, rsiPeriod: 14, sentimentWeight: 0.4, momentumLookback: 5 }
    }
];

function ensureStrategies(userId) {
    const user = userStore._ensureUser(userId);
    if (!user.strategies || user.strategies.length === 0) {
        user.strategies = BASE_STRATEGIES.map(s => ({
            ...s,
            status: 'active',
            generation: 1,
            trades: [],
            wins: 0,
            losses: 0,
            totalPnlPct: 0,
            sharpe: 0,
            maxDrawdown: 0,
            peakEquity: 0,
            lastSignal: null
        }));
    }
    return user.strategies;
}

function computeSMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function computeEMA(prices, period) {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}

function computeRSI(prices, period) {
    if (prices.length < period + 1) return null;
    const slice = prices.slice(-(period + 1));
    let gains = 0, losses = 0;
    for (let i = 1; i < slice.length; i++) {
        const diff = slice[i] - slice[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function evaluateStrategy(strategy, prices, signals) {
    const { parameters } = strategy;
    const current = prices[prices.length - 1];

    switch (strategy.id) {
        case 'MOMENTUM': {
            const fastMA = computeSMA(prices, parameters.maPeriod);
            const slowMA = computeSMA(prices, parameters.slowMaPeriod);
            if (!fastMA || !slowMA) return 'HOLD';
            const momentum = prices.slice(-parameters.momentumLookback);
            const isRising = momentum[momentum.length - 1] > momentum[0];
            if (fastMA > slowMA && isRising) return 'BUY';
            if (fastMA < slowMA && !isRising) return 'SELL';
            return 'HOLD';
        }
        case 'MEAN_REVERSION': {
            const rsi = computeRSI(prices, parameters.rsiPeriod);
            if (rsi === null) return 'HOLD';
            if (rsi < parameters.rsiOversold) return 'BUY';
            if (rsi > parameters.rsiOverbought) return 'SELL';
            return 'HOLD';
        }
        case 'TREND_FOLLOWING': {
            const ema = computeEMA(prices, parameters.emaPeriod);
            if (!ema) return 'HOLD';
            if (current > ema * 1.002) return 'BUY';
            if (current < ema * 0.998) return 'SELL';
            return 'HOLD';
        }
        case 'SENTIMENT_DRIVEN': {
            const rsi = computeRSI(prices, parameters.rsiPeriod);
            if (!signals || rsi === null) return 'HOLD';
            const composite = signals.compositeScore || 0;
            const techScore = rsi < 40 ? 1 : rsi > 60 ? -1 : 0;
            const sentScore = composite > 20 ? 1 : composite < -20 ? -1 : 0;
            const blended = (sentScore * parameters.sentimentWeight) + (techScore * parameters.technicalWeight);
            if (blended > 0.5) return 'BUY';
            if (blended < -0.5) return 'SELL';
            return 'HOLD';
        }
        case 'COMBINED': {
            const fastMA = computeSMA(prices, parameters.maPeriod);
            const rsi = computeRSI(prices, parameters.rsiPeriod);
            const composite = (signals?.compositeScore || 0);
            if (!fastMA || rsi === null) return 'HOLD';
            const sma = computeSMA(prices, 30);
            const maTrend = sma ? (fastMA > sma ? 1 : -1) : 0;
            const rsiSignal = rsi < 40 ? 1 : rsi > 60 ? -1 : 0;
            const sentSignal = composite > 20 ? 1 : composite < -20 ? -1 : 0;
            const score = maTrend + rsiSignal + (sentSignal * parameters.sentimentWeight);
            if (score >= 1.5) return 'BUY';
            if (score <= -1.5) return 'SELL';
            return 'HOLD';
        }
        default:
            return 'HOLD';
    }
}

function recordStrategyTrade(userId, strategyId, action, entryPrice, exitPrice) {
    const strategies = ensureStrategies(userId);
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    const pnlPct = action === 'SELL' ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
    if (action === 'SELL') {
        if (pnlPct > 0) strategy.wins++;
        else strategy.losses++;
        strategy.totalPnlPct += pnlPct;

        const currentEquity = 100 + strategy.totalPnlPct;
        if (currentEquity > strategy.peakEquity) strategy.peakEquity = currentEquity;
        const drawdown = ((strategy.peakEquity - currentEquity) / strategy.peakEquity) * 100;
        if (drawdown > strategy.maxDrawdown) strategy.maxDrawdown = drawdown;

        const totalTrades = strategy.wins + strategy.losses;
        const winRate = totalTrades > 0 ? strategy.wins / totalTrades : 0;
        const avgPnl = strategy.totalPnlPct / Math.max(totalTrades, 1);
        strategy.sharpe = winRate > 0 ? (avgPnl / (strategy.maxDrawdown || 1)) : 0;
    }

    runTournament(userId);
    // Persist strategies after recording a trade (fire-and-forget)
    getPersistence().saveStrategies(getSupabase(), userId, userStore.getStrategies(userId)).catch(() => {});
}

function runTournament(userId) {
    const user = userStore._ensureUser(userId);
    const strategies = user.strategies;
    const totalTrades = strategies.reduce((a, s) => a + s.wins + s.losses, 0);

    if (totalTrades % 20 !== 0 || totalTrades === 0) return;

    const active = strategies.filter(s => s.status !== 'retired');
    active.sort((a, b) => b.sharpe - a.sharpe);

    // Top 2 → active
    active.slice(0, 2).forEach(s => { s.status = 'active'; });
    // Remaining → learning
    active.slice(2).forEach(s => { s.status = 'learning'; });
    // Worst performer → retire
    if (active.length > 0) active[active.length - 1].status = 'retired';

    // Spawn mutated variant from top performer
    const winner = active[0];
    if (winner) {
        const mutate = (v) => v * (1 + (Math.random() - 0.5) * 0.3);
        const newParams = Object.fromEntries(
            Object.entries(winner.parameters).map(([k, v]) => [k, typeof v === 'number' ? Math.round(mutate(v) * 100) / 100 : v])
        );
        strategies.push({
            ...winner,
            id: `${winner.id}_GEN${winner.generation + 1}`,
            name: `${winner.name} v${winner.generation + 1}`,
            status: 'learning',
            generation: winner.generation + 1,
            parameters: newParams,
            trades: [],
            wins: 0,
            losses: 0,
            totalPnlPct: 0,
            sharpe: 0,
            maxDrawdown: 0,
            peakEquity: 0
        });
    }
}

function getWinningStrategy(userId) {
    const strategies = ensureStrategies(userId);
    const active = strategies.filter(s => s.status === 'active');
    if (active.length === 0) return strategies[0];
    return active.sort((a, b) => b.sharpe - a.sharpe)[0];
}

function evaluateAllStrategies(userId, prices, signals) {
    const strategies = ensureStrategies(userId);
    return strategies
        .filter(s => s.status !== 'retired')
        .map(s => ({
            strategyId: s.id,
            name: s.name,
            signal: evaluateStrategy(s, prices, signals)
        }));
}

module.exports = { ensureStrategies, evaluateAllStrategies, getWinningStrategy, recordStrategyTrade };
