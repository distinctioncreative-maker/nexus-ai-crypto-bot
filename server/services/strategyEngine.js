/**
 * Strategy Engine — Individualized algorithmic cores for each agent.
 *
 * Each agent has its own signal logic (pure math, no AI calls).
 * Results feed into the AI synthesis layer as votes.
 * Agents maintain shadow portfolios and self-train via autopsy.
 */

const userStore = require('../userStore');

// ─── Technical Helpers ──────────────────────────────────────────────────────

function sma(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(prices, period) {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let emaVal = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
        emaVal = prices[i] * k + emaVal * (1 - k);
    }
    return emaVal;
}

function rsi(prices, period = 14) {
    if (prices.length < period + 1) return null;
    const closes = prices.slice(-(period + 1));
    let gains = 0, losses = 0;
    for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function bollingerBands(prices, period = 20, stdDevMult = 2) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return { upper: mean + stdDevMult * stdDev, middle: mean, lower: mean - stdDevMult * stdDev };
}

function adx(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return null;
    const trueRanges = [];
    const plusDM = [];
    const minusDM = [];
    for (let i = 1; i < closes.length; i++) {
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        trueRanges.push(tr);
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    if (atr === 0) return 0;
    const pdi = (plusDM.slice(-period).reduce((a, b) => a + b, 0) / period / atr) * 100;
    const mdi = (minusDM.slice(-period).reduce((a, b) => a + b, 0) / period / atr) * 100;
    const dx = Math.abs(pdi - mdi) / (pdi + mdi) * 100 || 0;
    return dx;
}

// ─── Per-Agent Signal Computation ────────────────────────────────────────────

/**
 * Atlas — Momentum via fast/slow MA crossover + volume confirmation
 */
function computeMomentumSignal(candles, agentParams = {}) {
    const fastPeriod = agentParams.fastPeriod || 5;
    const slowPeriod = agentParams.slowPeriod || 20;
    const closes = candles.map(c => c.value);

    const fastMA = sma(closes, fastPeriod);
    const slowMA = sma(closes, slowPeriod);
    if (fastMA === null || slowMA === null) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };

    const gap = (fastMA - slowMA) / slowMA;
    const prevFastMA = sma(closes.slice(0, -1), fastPeriod);
    const prevSlowMA = sma(closes.slice(0, -1), slowPeriod);

    if (fastMA > slowMA && prevFastMA !== null && prevFastMA <= prevSlowMA && gap > 0.001) {
        return { signal: 'BUY', strength: Math.min(gap * 1000, 100), reason: `MA crossover bullish: fast(${fastPeriod})=$${fastMA.toFixed(2)} > slow(${slowPeriod})=$${slowMA.toFixed(2)}` };
    }
    if (fastMA < slowMA && prevFastMA !== null && prevFastMA >= prevSlowMA && gap < -0.001) {
        return { signal: 'SELL', strength: Math.min(Math.abs(gap) * 1000, 100), reason: `MA crossover bearish: fast(${fastPeriod})=$${fastMA.toFixed(2)} < slow(${slowPeriod})=$${slowMA.toFixed(2)}` };
    }
    return { signal: 'HOLD', strength: Math.abs(gap) * 500, reason: `MA trend ${gap > 0 ? 'bullish' : 'bearish'} but no fresh crossover` };
}

/**
 * Vera — Mean Reversion via RSI + Bollinger Bands
 */
function computeMeanReversionSignal(candles, agentParams = {}) {
    const rsiPeriod = agentParams.rsiPeriod || 14;
    const oversold = agentParams.oversold || 32;
    const overbought = agentParams.overbought || 68;
    const closes = candles.map(c => c.value);

    const rsiVal = rsi(closes, rsiPeriod);
    const bb = bollingerBands(closes, 20, 2);
    const currentPrice = closes[closes.length - 1];

    if (rsiVal === null || !bb) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };

    const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower); // 0=lower, 1=upper

    if (rsiVal < oversold && bbPosition < 0.25) {
        const strength = ((oversold - rsiVal) / oversold) * 100;
        return { signal: 'BUY', strength, reason: `RSI=${rsiVal.toFixed(1)} oversold + price near BB lower ($${bb.lower.toFixed(2)})` };
    }
    if (rsiVal > overbought && bbPosition > 0.75) {
        const strength = ((rsiVal - overbought) / (100 - overbought)) * 100;
        return { signal: 'SELL', strength, reason: `RSI=${rsiVal.toFixed(1)} overbought + price near BB upper ($${bb.upper.toFixed(2)})` };
    }
    return { signal: 'HOLD', strength: 0, reason: `RSI=${rsiVal.toFixed(1)}, BB position=${(bbPosition * 100).toFixed(0)}% — no extreme` };
}

/**
 * Rex — Trend Following via EMA cloud + ADX
 */
function computeTrendSignal(candles, agentParams = {}) {
    const fastEma = agentParams.fastEma || 8;
    const slowEma = agentParams.slowEma || 21;
    const adxThreshold = agentParams.adxThreshold || 20;
    const closes = candles.map(c => c.value);
    const highs  = candles.map(c => c.high || c.value);
    const lows   = candles.map(c => c.low || c.value);

    const emaFast = ema(closes, fastEma);
    const emaSlow = ema(closes, slowEma);
    const adxVal  = adx(highs, lows, closes, 14);
    const currentPrice = closes[closes.length - 1];

    if (emaFast === null || emaSlow === null) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };

    const trendStrength = adxVal || 0;
    const priceBullish = currentPrice > emaFast && emaFast > emaSlow;
    const priceBearish = currentPrice < emaFast && emaFast < emaSlow;

    if (priceBullish && trendStrength >= adxThreshold) {
        return { signal: 'BUY', strength: trendStrength, reason: `Price above EMA cloud (${fastEma}/${slowEma}), ADX=${adxVal?.toFixed(1)} — strong uptrend` };
    }
    if (priceBearish && trendStrength >= adxThreshold) {
        return { signal: 'SELL', strength: trendStrength, reason: `Price below EMA cloud (${fastEma}/${slowEma}), ADX=${adxVal?.toFixed(1)} — strong downtrend` };
    }
    return { signal: 'HOLD', strength: 0, reason: `ADX=${adxVal?.toFixed(1)} (need >${adxThreshold}) — trend too weak to enter` };
}

/**
 * Luna — Sentiment via Fear & Greed + DeFi TVL
 */
function computeSentimentSignal(candles, signals, agentParams = {}) {
    const fearBuyThreshold = agentParams.fearBuyThreshold || 30;
    const greedSellThreshold = agentParams.greedSellThreshold || 70;
    const fearGreed = signals?.fearGreed?.value;
    const tvlChange = signals?.tvl?.changePct;
    const composite = signals?.compositeScore || 0;

    if (fearGreed == null) return { signal: 'HOLD', strength: 0, reason: 'Macro data unavailable' };

    const closes = candles.map(c => c.value);
    const rsiVal = rsi(closes, 14);

    if (fearGreed < fearBuyThreshold && composite >= 20 && (tvlChange == null || tvlChange > -10)) {
        const strength = ((fearBuyThreshold - fearGreed) / fearBuyThreshold) * 100;
        return { signal: 'BUY', strength, reason: `Fear & Greed=${fearGreed} (extreme fear), composite=+${composite} — buy the fear` };
    }
    if (fearGreed > greedSellThreshold && composite <= -20) {
        const strength = ((fearGreed - greedSellThreshold) / (100 - greedSellThreshold)) * 100;
        return { signal: 'SELL', strength, reason: `Fear & Greed=${fearGreed} (extreme greed), composite=${composite} — sell the euphoria` };
    }
    return { signal: 'HOLD', strength: Math.abs(composite), reason: `F&G=${fearGreed}, composite=${composite > 0 ? '+' : ''}${composite} — no extreme` };
}

/**
 * Orion — Weighted synthesis of all 4 sub-agents
 * Weights are dynamically adjusted based on each agent's recent Sharpe ratio.
 */
function computeCombinedSignal(votes, agentStats = {}) {
    const signalToNum = { BUY: 1, HOLD: 0, SELL: -1 };
    const numToSignal = (n) => n > 0.25 ? 'BUY' : n < -0.25 ? 'SELL' : 'HOLD';

    let totalWeight = 0;
    let weightedSum = 0;
    const voteBreakdown = [];

    for (const vote of votes) {
        // Sharpe-weighted: better performers get more say, min weight 0.5
        const sharpe = agentStats[vote.agentId]?.sharpe || 0;
        const weight = Math.max(0.5, 1 + sharpe * 0.5);
        const numSignal = signalToNum[vote.signal] || 0;
        weightedSum += numSignal * vote.strength * weight;
        totalWeight += vote.strength * weight;
        voteBreakdown.push(`${vote.name}: ${vote.signal} (${vote.strength.toFixed(0)}% str)`);
    }

    const normalised = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const signal = numToSignal(normalised);
    const buyCount  = votes.filter(v => v.signal === 'BUY').length;
    const sellCount = votes.filter(v => v.signal === 'SELL').length;
    const holdCount = votes.filter(v => v.signal === 'HOLD').length;
    const dissent = 1 - Math.max(buyCount, sellCount, holdCount) / votes.length;

    return {
        signal,
        strength: Math.abs(normalised * 100),
        reason: voteBreakdown.join(' | '),
        buyCount, sellCount, holdCount,
        dissent: dissent.toFixed(2),
        consensus: dissent < 0.3 ? 'STRONG' : dissent < 0.5 ? 'MODERATE' : 'SPLIT',
    };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run all 5 agents against current candle data and return their votes.
 * This is the primary entry point for the trading loop.
 */
function getAgentConsensus(userId, candles, signals) {
    const user = userStore._ensureUser(userId);
    const strategies = user.strategies || [];

    const getParams = (id) => strategies.find(s => s.id === id)?.parameters || {};
    const agentStats = Object.fromEntries(strategies.map(s => [s.id, { sharpe: s.sharpe, wins: s.wins, losses: s.losses }]));

    const atlasResult   = computeMomentumSignal(candles, getParams('MOMENTUM'));
    const veraResult    = computeMeanReversionSignal(candles, getParams('MEAN_REVERSION'));
    const rexResult     = computeTrendSignal(candles, getParams('TREND_FOLLOWING'));
    const lunaResult    = computeSentimentSignal(candles, signals, getParams('SENTIMENT_DRIVEN'));

    const votes = [
        { agentId: 'MOMENTUM',        name: 'Atlas', ...atlasResult },
        { agentId: 'MEAN_REVERSION',  name: 'Vera',  ...veraResult },
        { agentId: 'TREND_FOLLOWING', name: 'Rex',   ...rexResult },
        { agentId: 'SENTIMENT_DRIVEN',name: 'Luna',  ...lunaResult },
    ];

    const orionResult = computeCombinedSignal(votes, agentStats);
    votes.push({ agentId: 'COMBINED', name: 'Orion', ...orionResult });

    // Update lastSignal on each strategy in the user store
    for (const vote of votes) {
        const s = strategies.find(st => st.id === vote.agentId);
        if (s) s.lastSignal = vote.signal;
    }

    return { votes, orion: orionResult };
}

/**
 * Update a single agent's shadow portfolio based on price action.
 * Called on every tick when engine is running.
 */
function tickShadowPortfolios(userId, candles, signals) {
    const user = userStore._ensureUser(userId);
    const strategies = user.strategies || [];
    if (candles.length < 5) return;

    const currentPrice = candles[candles.length - 1].value;
    const signalers = [
        { id: 'MOMENTUM',        fn: () => computeMomentumSignal(candles, strategies.find(s => s.id === 'MOMENTUM')?.parameters || {}) },
        { id: 'MEAN_REVERSION',  fn: () => computeMeanReversionSignal(candles, strategies.find(s => s.id === 'MEAN_REVERSION')?.parameters || {}) },
        { id: 'TREND_FOLLOWING', fn: () => computeTrendSignal(candles, strategies.find(s => s.id === 'TREND_FOLLOWING')?.parameters || {}) },
        { id: 'SENTIMENT_DRIVEN',fn: () => computeSentimentSignal(candles, signals, strategies.find(s => s.id === 'SENTIMENT_DRIVEN')?.parameters || {}) },
    ];

    const MIN_STRENGTH = 40; // only shadow-trade when signal is confident

    for (const { id, fn } of signalers) {
        const strategy = strategies.find(s => s.id === id);
        if (!strategy) continue;
        const sp = strategy.shadowPortfolio;
        if (!sp) continue;

        const { signal, strength } = fn();

        if (signal === 'BUY' && strength >= MIN_STRENGTH && sp.holdings === 0 && sp.equity > 100) {
            // Shadow-buy: allocate 10% of equity
            const investAmount = sp.equity * 0.1;
            const units = investAmount / currentPrice;
            sp.holdings = units;
            sp.entryPrice = currentPrice;
            sp.equity -= investAmount;
            sp.entryTime = Date.now();
        } else if (signal === 'SELL' && strength >= MIN_STRENGTH && sp.holdings > 0) {
            // Shadow-sell: close position
            const saleValue = sp.holdings * currentPrice;
            const pnl = saleValue - (sp.holdings * sp.entryPrice);
            const pnlPct = (pnl / (sp.holdings * sp.entryPrice)) * 100;
            sp.equity += saleValue;
            sp.closedTrades = sp.closedTrades || [];
            sp.closedTrades.push({ entryPrice: sp.entryPrice, exitPrice: currentPrice, pnl, pnlPct, time: new Date().toISOString() });
            if (sp.closedTrades.length > 50) sp.closedTrades.shift();
            // Update win/loss
            if (pnl > 0) strategy.wins++; else strategy.losses++;
            // Update Sharpe (simplified: avg pnlPct / std of pnlPcts)
            updateAgentSharpe(strategy);
            sp.holdings = 0;
            sp.entryPrice = null;
        }
    }

    // Run tournament if enough closed trades accumulated
    const totalClosed = strategies.reduce((sum, s) => sum + (s.shadowPortfolio?.closedTrades?.length || 0), 0);
    const lastCycle = user.strategyTournament?.lastCycleClosedTrades || 0;
    if (totalClosed - lastCycle >= 20) {
        runTournamentCycle(userId);
    }
}

function updateAgentSharpe(strategy) {
    const trades = strategy.shadowPortfolio?.closedTrades || [];
    if (trades.length < 3) return;
    const returns = trades.map(t => t.pnlPct);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    strategy.sharpe = stdDev > 0 ? avg / stdDev : 0;
}

/**
 * Tournament: rank agents, promote winners, mutate loser's parameters.
 */
function runTournamentCycle(userId) {
    const user = userStore._ensureUser(userId);
    const strategies = user.strategies || [];
    if (strategies.length < 2) return;

    // Rank by Sharpe (desc), then win rate as tiebreaker
    const ranked = [...strategies].sort((a, b) => {
        const sharpeA = a.sharpe || 0;
        const sharpeB = b.sharpe || 0;
        if (Math.abs(sharpeA - sharpeB) > 0.01) return sharpeB - sharpeA;
        const wrA = a.wins / Math.max(a.wins + a.losses, 1);
        const wrB = b.wins / Math.max(b.wins + b.losses, 1);
        return wrB - wrA;
    });

    // Mutate bottom performer's parameters
    const loser = ranked[ranked.length - 1];
    if (loser && loser.id !== 'COMBINED') {
        const mutated = mutatePameters(loser.parameters || {});
        loser.parameters = mutated;
        loser.generation = (loser.generation || 1) + 1;
        loser.wins = 0;
        loser.losses = 0;
        loser.sharpe = 0;
        if (loser.shadowPortfolio) {
            loser.shadowPortfolio.equity = 100000;
            loser.shadowPortfolio.holdings = 0;
            loser.shadowPortfolio.closedTrades = [];
        }
        console.log(`🧬 Tournament: ${loser.name} mutated to gen ${loser.generation}`);
    }

    if (!user.strategyTournament) user.strategyTournament = {};
    user.strategyTournament.lastCycleClosedTrades = strategies.reduce((sum, s) =>
        sum + (s.shadowPortfolio?.closedTrades?.length || 0), 0);

    console.log(`🏆 Tournament cycle: ${ranked.map(s => `${s.name}(${(s.sharpe || 0).toFixed(2)})`).join(' > ')}`);
}

function mutatePameters(params) {
    const mutate = (val, min, max) => {
        if (val == null) return null;
        const delta = val * (Math.random() * 0.3 - 0.15); // ±15%
        return Math.max(min, Math.min(max, Math.round(val + delta)));
    };
    return {
        ...params,
        fastPeriod:      mutate(params.fastPeriod || 5, 3, 10),
        slowPeriod:      mutate(params.slowPeriod || 20, 10, 40),
        rsiPeriod:       mutate(params.rsiPeriod || 14, 8, 21),
        oversold:        mutate(params.oversold || 32, 20, 40),
        overbought:      mutate(params.overbought || 68, 60, 80),
        fastEma:         mutate(params.fastEma || 8, 5, 15),
        slowEma:         mutate(params.slowEma || 21, 15, 40),
        adxThreshold:    mutate(params.adxThreshold || 20, 15, 30),
        fearBuyThreshold:mutate(params.fearBuyThreshold || 30, 20, 40),
        greedSellThreshold: mutate(params.greedSellThreshold || 70, 60, 80),
    };
}

/**
 * Record a lesson for a specific agent after a trade autopsy.
 */
function recordAgentLesson(userId, agentId, lesson) {
    const user = userStore._ensureUser(userId);
    const strategy = (user.strategies || []).find(s => s.id === agentId);
    if (!strategy) return;
    if (!strategy.lessons) strategy.lessons = [];
    strategy.lessons.unshift({ lesson, time: new Date().toISOString() });
    if (strategy.lessons.length > 10) strategy.lessons.pop();
}

module.exports = {
    getAgentConsensus,
    tickShadowPortfolios,
    runTournamentCycle,
    recordAgentLesson,
    computeMomentumSignal,
    computeMeanReversionSignal,
    computeTrendSignal,
    computeSentimentSignal,
};
