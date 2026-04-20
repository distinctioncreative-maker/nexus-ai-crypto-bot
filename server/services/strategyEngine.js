const userStore = require('../userStore');

let _persistence = null;
let _supabase = null;
function getPersistence() {
    if (!_persistence) _persistence = require('../db/persistence');
    return _persistence;
}
function getSupabase() {
    if (!_supabase) _supabase = require('../middleware/auth').supabase;
    return _supabase;
}

const INITIAL_AGENT_CAPITAL = 100000;
const SHADOW_TRADE_FRACTION = 0.1;

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

function emptyShadowPortfolio() {
    return {
        cash: INITIAL_AGENT_CAPITAL,
        holdings: 0,
        entryPrice: null,
        equity: INITIAL_AGENT_CAPITAL,
        peakEquity: INITIAL_AGENT_CAPITAL,
        maxDrawdown: 0,
        realizedPnl: 0,
        trades: [],
        closedTrades: []
    };
}

function normalizeStrategy(base, existing = {}) {
    return {
        ...base,
        ...existing,
        id: base.id,
        name: existing.name || base.name,
        parameters: { ...base.parameters, ...(existing.parameters || {}) },
        status: existing.status || 'active',
        generation: existing.generation || 1,
        wins: existing.wins || 0,
        losses: existing.losses || 0,
        totalPnlPct: existing.totalPnlPct || 0,
        realizedPnl: existing.realizedPnl || 0,
        sharpe: existing.sharpe || 0,
        maxDrawdown: existing.maxDrawdown || 0,
        peakEquity: existing.peakEquity || INITIAL_AGENT_CAPITAL,
        lastSignal: existing.lastSignal || null,
        lastVote: existing.lastVote || null,
        lessons: Array.isArray(existing.lessons) ? existing.lessons.slice(0, 10) : [],
        productStates: existing.productStates || {},
        shadowPortfolio: existing.shadowPortfolio || emptyShadowPortfolio()
    };
}

function ensureStrategies(userId) {
    const user = userStore._ensureUser(userId);
    const existingById = new Map((user.strategies || []).map(strategy => [baseId(strategy.id), strategy]));
    user.strategies = BASE_STRATEGIES.map(base => normalizeStrategy(base, existingById.get(base.id)));
    return user.strategies;
}

function baseId(id = '') {
    return id.split('_GEN')[0];
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
    let gains = 0;
    let losses = 0;
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
            const techScore = rsi < 45 ? 1 : rsi > 55 ? -1 : 0;
            const sentScore = composite > 10 ? 1 : composite < -10 ? -1 : 0;
            const blended = (sentScore * parameters.sentimentWeight) + (techScore * parameters.technicalWeight);
            if (blended > 0.3) return 'BUY';
            if (blended < -0.3) return 'SELL';
            return 'HOLD';
        }
        case 'COMBINED':
        default: {
            const fastMA = computeSMA(prices, parameters.maPeriod);
            const rsi = computeRSI(prices, parameters.rsiPeriod);
            const composite = signals?.compositeScore || 0;
            if (!fastMA || rsi === null) return 'HOLD';
            const sma = computeSMA(prices, 30);
            const maTrend = sma ? (fastMA > sma ? 1 : -1) : 0;
            const rsiSignal = rsi < 45 ? 1 : rsi > 55 ? -1 : 0;
            const sentSignal = composite > 10 ? 1 : composite < -10 ? -1 : 0;
            const score = maTrend + rsiSignal + (sentSignal * parameters.sentimentWeight);
            if (score >= 1.0) return 'BUY';
            if (score <= -1.0) return 'SELL';
            return 'HOLD';
        }
    }
}

function getProductShadow(strategy, productId) {
    if (!strategy.productStates[productId]) {
        strategy.productStates[productId] = emptyShadowPortfolio();
    }
    return strategy.productStates[productId];
}

function updateDrawdown(strategy, shadow) {
    if (shadow.equity > shadow.peakEquity) shadow.peakEquity = shadow.equity;
    const drawdown = shadow.peakEquity > 0 ? ((shadow.peakEquity - shadow.equity) / shadow.peakEquity) * 100 : 0;
    if (drawdown > shadow.maxDrawdown) shadow.maxDrawdown = drawdown;
    strategy.maxDrawdown = Math.max(...Object.values(strategy.productStates).map(p => p.maxDrawdown || 0), 0);
    strategy.peakEquity = Math.max(...Object.values(strategy.productStates).map(p => p.peakEquity || 0), INITIAL_AGENT_CAPITAL);
}

function updateShadowPortfolio(strategy, signal, price, productId) {
    const shadow = getProductShadow(strategy, productId);
    let closedTrade = null;

    if (signal === 'BUY' && shadow.holdings === 0 && shadow.cash > 0) {
        const spend = shadow.cash * SHADOW_TRADE_FRACTION;
        const amount = spend / price;
        shadow.cash -= spend;
        shadow.holdings += amount;
        shadow.entryPrice = price;
        shadow.trades.unshift({
            type: 'BUY',
            amount,
            price,
            product: productId,
            time: new Date().toISOString()
        });
    } else if (signal === 'SELL' && shadow.holdings > 0) {
        const amount = shadow.holdings;
        const proceeds = amount * price;
        const costBasis = amount * shadow.entryPrice;
        const pnl = proceeds - costBasis;
        const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        shadow.cash += proceeds;
        shadow.holdings = 0;
        shadow.entryPrice = null;
        shadow.realizedPnl += pnl;
        closedTrade = {
            type: 'SELL',
            amount,
            price,
            product: productId,
            pnl,
            pnlPct,
            time: new Date().toISOString()
        };
        shadow.trades.unshift(closedTrade);
        shadow.closedTrades.unshift(closedTrade);
        if (shadow.closedTrades.length > 200) shadow.closedTrades.pop();

        if (pnl > 0) strategy.wins += 1;
        else strategy.losses += 1;
        strategy.totalPnlPct += pnlPct;
        strategy.realizedPnl += pnl;
        strategy.lessons.unshift(pnl > 0
            ? `Win on ${productId}: ${signal} closed +${pnlPct.toFixed(2)}%.`
            : `Loss on ${productId}: ${signal} closed ${pnlPct.toFixed(2)}%. Tighten entries.`);
        strategy.lessons = strategy.lessons.slice(0, 10);
    }

    shadow.equity = shadow.cash + (shadow.holdings * price);
    updateDrawdown(strategy, shadow);

    const closedTrades = strategy.wins + strategy.losses;
    const avgPnlPct = closedTrades > 0 ? strategy.totalPnlPct / closedTrades : 0;
    const winRate = closedTrades > 0 ? strategy.wins / closedTrades : 0.5;
    strategy.sharpe = parseFloat(((avgPnlPct * winRate) / Math.max(strategy.maxDrawdown, 1)).toFixed(3));
    strategy.shadowPortfolio = { ...shadow };

    return closedTrade;
}

function evaluateAndTrainStrategies(userId, prices, signals, productId) {
    const strategies = ensureStrategies(userId);
    const price = prices[prices.length - 1];
    let closedCount = 0;

    const votes = strategies.map(strategy => {
        const signal = evaluateStrategy(strategy, prices, signals);
        strategy.lastSignal = signal;
        strategy.lastVote = {
            signal,
            product: productId,
            price,
            time: new Date().toISOString()
        };
        const closedTrade = updateShadowPortfolio(strategy, signal, price, productId);
        if (closedTrade) closedCount += 1;
        return {
            strategyId: strategy.id,
            name: strategy.name,
            signal,
            shadowPortfolio: strategy.shadowPortfolio,
            sharpe: strategy.sharpe,
            wins: strategy.wins,
            losses: strategy.losses
        };
    });

    maybeRunTournament(userId, closedCount);
    getPersistence().saveStrategies(getSupabase(), userId, userStore.getStrategies(userId)).catch(error => {
        console.warn('saveStrategies failed:', error.message);
    });
    return votes;
}

function maybeRunTournament(userId, closedCount) {
    if (closedCount === 0) return;
    const user = userStore._ensureUser(userId);
    const totalClosedTrades = user.strategies.reduce((sum, strategy) => sum + strategy.wins + strategy.losses, 0);
    const tournamentState = user.strategyTournament || { lastCycleClosedTrades: 0 };

    if (totalClosedTrades - tournamentState.lastCycleClosedTrades < 20) {
        user.strategyTournament = tournamentState;
        return;
    }

    tournamentState.lastCycleClosedTrades = totalClosedTrades;
    user.strategyTournament = tournamentState;
    runTournament(userId);
}

function mutateParameters(parameters) {
    const mutated = {};
    for (const [key, value] of Object.entries(parameters)) {
        if (typeof value !== 'number') {
            mutated[key] = value;
            continue;
        }
        const next = value * (1 + (Math.random() - 0.5) * 0.2);
        mutated[key] = Number.isInteger(value) ? Math.max(1, Math.round(next)) : Math.round(next * 100) / 100;
    }
    return mutated;
}

function runTournament(userId) {
    const strategies = ensureStrategies(userId);
    const ranked = [...strategies].sort((a, b) => {
        const aEquity = a.shadowPortfolio?.equity || INITIAL_AGENT_CAPITAL;
        const bEquity = b.shadowPortfolio?.equity || INITIAL_AGENT_CAPITAL;
        return (b.realizedPnl + (bEquity - INITIAL_AGENT_CAPITAL)) - (a.realizedPnl + (aEquity - INITIAL_AGENT_CAPITAL));
    });

    ranked.forEach((strategy, index) => {
        strategy.status = index < 2 ? 'active' : 'learning';
    });

    ranked.slice(-2).forEach(strategy => {
        strategy.parameters = mutateParameters(strategy.parameters);
        strategy.generation += 1;
        strategy.lessons.unshift(`Tournament mutation after underperformance. New generation ${strategy.generation}.`);
        strategy.lessons = strategy.lessons.slice(0, 10);
    });

    snapshotStrategies(userId, strategies).catch(error => {
        console.warn('snapshotStrategies failed:', error.message);
    });
}

function getWinningStrategy(userId) {
    const strategies = ensureStrategies(userId);
    return [...strategies].sort((a, b) => {
        const aScore = (a.shadowPortfolio?.equity || INITIAL_AGENT_CAPITAL) + (a.sharpe * 100);
        const bScore = (b.shadowPortfolio?.equity || INITIAL_AGENT_CAPITAL) + (b.sharpe * 100);
        return bScore - aScore;
    })[0];
}

function evaluateAllStrategies(userId, prices, signals, productId = userStore.getSelectedProduct(userId)) {
    return evaluateAndTrainStrategies(userId, prices, signals, productId);
}

function getStrategyConsensus(userId, prices, signals, productId = userStore.getSelectedProduct(userId)) {
    const votes = evaluateAndTrainStrategies(userId, prices, signals, productId);
    const strategies = ensureStrategies(userId);
    const buckets = { BUY: [], HOLD: [], SELL: [] };

    for (const vote of votes) {
        const strategy = strategies.find(item => item.id === vote.strategyId);
        const totalTrades = (strategy?.wins || 0) + (strategy?.losses || 0);
        const winRate = totalTrades > 0 ? strategy.wins / totalTrades : 0.5;
        const equityBonus = Math.max(0, ((strategy?.shadowPortfolio?.equity || INITIAL_AGENT_CAPITAL) - INITIAL_AGENT_CAPITAL) / 10000);
        const weight = 1 + Math.max(0, strategy?.sharpe || 0) + winRate + equityBonus;
        buckets[vote.signal].push({ name: vote.name, id: vote.strategyId, weight });
    }

    const buyWeight = buckets.BUY.reduce((sum, vote) => sum + vote.weight, 0);
    const sellWeight = buckets.SELL.reduce((sum, vote) => sum + vote.weight, 0);
    const holdWeight = buckets.HOLD.reduce((sum, vote) => sum + vote.weight, 0);
    const total = buyWeight + sellWeight + holdWeight || 1;

    let consensus = 'HOLD';
    if (buyWeight > sellWeight && buyWeight > holdWeight) consensus = 'BUY';
    else if (sellWeight > buyWeight && sellWeight > holdWeight) consensus = 'SELL';

    const directionalWeights = [buyWeight, sellWeight].filter(weight => weight > 0);
    const dissent = directionalWeights.length === 2 ? Math.min(buyWeight, sellWeight) / total : 0;
    const consensusVoters = buckets[consensus].sort((a, b) => b.weight - a.weight);

    return {
        consensus,
        dissent: parseFloat(dissent.toFixed(2)),
        buyPct: Math.round((buyWeight / total) * 100),
        sellPct: Math.round((sellWeight / total) * 100),
        holdPct: Math.round((holdWeight / total) * 100),
        topStrategy: consensusVoters[0]?.name || 'None',
        topStrategyId: consensusVoters[0]?.id || 'COMBINED',
        totalAgents: strategies.length,
        debate: votes.map(vote => `${vote.name}: ${vote.signal}`).join(' | '),
        votes
    };
}

async function snapshotStrategies(userId, strategies) {
    const supabase = getSupabase();
    if (!supabase) return;
    const winner = getWinningStrategy(userId);
    await supabase.from('agent_snapshots').insert({
        user_id: userId,
        tournament_generation: winner?.generation || 1,
        strategies,
        top_strategy: winner?.name || 'None',
        notes: `Tournament cycle - ${strategies.length} shadow agents, leader: ${winner?.name || 'None'}`
    });
}

module.exports = {
    ensureStrategies,
    evaluateAllStrategies,
    getWinningStrategy,
    getStrategyConsensus
};
