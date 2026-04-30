/**
 * Strategy Engine — Individualized algorithmic cores for each agent.
 *
 * Each agent has its own signal logic (pure math, no AI calls).
 * Results feed into the AI synthesis layer as votes.
 * Agents maintain shadow portfolios and self-train via autopsy.
 */

const userStore = require('../userStore');

// Lazy-loaded persistence helpers (same pattern as userStore.js to avoid circular deps)
let _supabase = null;
let _persistence = null;
function getSupabase() {
    if (!_supabase) _supabase = require('../middleware/auth').supabase;
    return _supabase;
}
function getPersistence() {
    if (!_persistence) _persistence = require('../db/persistence');
    return _persistence;
}

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

// ─── Additional Technical Helpers ────────────────────────────────────────────

// ATR — standalone (also needed for position sizing)
function atr(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return null;
    const trs = [];
    for (let i = 1; i < closes.length; i++) {
        trs.push(Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        ));
    }
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// MACD — crypto-optimized default (5/35/5) beats standard 12/26/9 per Kang 2021
function macd(prices, fastPeriod = 5, slowPeriod = 35, signalPeriod = 5) {
    if (prices.length < slowPeriod + signalPeriod) return null;
    const macdLine = [];
    for (let i = slowPeriod; i <= prices.length; i++) {
        const slice = prices.slice(0, i);
        const fast = ema(slice, fastPeriod);
        const slow = ema(slice, slowPeriod);
        if (fast !== null && slow !== null) macdLine.push(fast - slow);
    }
    if (macdLine.length < signalPeriod) return null;
    const signalLine = ema(macdLine, signalPeriod);
    if (signalLine === null) return null;
    const histogram = macdLine[macdLine.length - 1] - signalLine;
    return { macdLine: macdLine[macdLine.length - 1], signalLine, histogram };
}

// OBV — On-Balance Volume: confirms or denies price moves with volume flow
function obv(closes, volumes) {
    if (!volumes || closes.length !== volumes.length || closes.length < 2) return null;
    let obvVal = 0;
    const series = [0];
    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) obvVal += (volumes[i] || 0);
        else if (closes[i] < closes[i - 1]) obvVal -= (volumes[i] || 0);
        series.push(obvVal);
    }
    const recent = series.slice(-14);
    const slope = (recent[recent.length - 1] - recent[0]) / Math.max(recent.length, 1);
    return { value: obvVal, trend: slope > 0 ? 'UP' : slope < 0 ? 'DOWN' : 'FLAT', slope };
}

// BB Width — normalized band width; squeeze = bands compressing = volatility coiling
function bbWidth(prices, period = 20) {
    const bb = bollingerBands(prices, period, 2);
    if (!bb || bb.middle === 0) return null;
    return (bb.upper - bb.lower) / bb.middle;
}

// ─── Per-Agent Signal Computation ────────────────────────────────────────────

/**
 * Atlas — Momentum via EMA 9/21 crossover + MACD(5/35/5) confirmation + volume spike
 * Upgraded from SMA 5/20: EMA reacts faster to 24/7 crypto markets
 */
function computeMomentumSignal(candles, agentParams = {}) {
    const fastPeriod = agentParams.fastPeriod || 9;
    const slowPeriod = agentParams.slowPeriod || 21;
    const closes  = candles.map(c => c.value);
    const volumes = candles.map(c => c.volume || 0);

    const fastEMA     = ema(closes, fastPeriod);
    const slowEMA     = ema(closes, slowPeriod);
    const prevFastEMA = ema(closes.slice(0, -1), fastPeriod);
    const prevSlowEMA = ema(closes.slice(0, -1), slowPeriod);
    const macdResult  = macd(closes, 5, 35, 5);

    // Volume confirmation: current vs 10-bar average
    const avgVol  = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const volSpike = avgVol > 0 && volumes[volumes.length - 1] > avgVol * 1.5;

    if (!fastEMA || !slowEMA) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };

    const crossedBullish = fastEMA > slowEMA && prevFastEMA !== null && prevFastEMA <= prevSlowEMA;
    const crossedBearish = fastEMA < slowEMA && prevFastEMA !== null && prevFastEMA >= prevSlowEMA;
    const macdBull = macdResult?.histogram > 0;
    const macdBear = macdResult?.histogram < 0;
    const gap = (fastEMA - slowEMA) / slowEMA;

    if ((crossedBullish || (fastEMA > slowEMA && macdBull)) && macdBull) {
        const strength = Math.min(Math.abs(gap) * 2000 + (volSpike ? 20 : 0), 100);
        return { signal: 'BUY', strength, reason: `EMA${fastPeriod}/EMA${slowPeriod} bullish${crossedBullish ? ' crossover' : ''}, MACD hist=+${macdResult.histogram.toFixed(4)}${volSpike ? ', vol spike' : ''}` };
    }
    if ((crossedBearish || (fastEMA < slowEMA && macdBear)) && macdBear) {
        const strength = Math.min(Math.abs(gap) * 2000 + (volSpike ? 20 : 0), 100);
        return { signal: 'SELL', strength, reason: `EMA${fastPeriod}/EMA${slowPeriod} bearish${crossedBearish ? ' crossover' : ''}, MACD hist=${macdResult.histogram.toFixed(4)}${volSpike ? ', vol spike' : ''}` };
    }
    return { signal: 'HOLD', strength: Math.abs(gap) * 500, reason: `EMA gap ${gap > 0 ? '+' : ''}${(gap * 100).toFixed(2)}%, MACD=${macdResult?.histogram?.toFixed(4) ?? 'n/a'} — no confirmation` };
}

/**
 * Vera — Mean Reversion via RSI 14 (30/70) + BB + OBV divergence + squeeze detection
 * Upgraded: standard thresholds, added OBV divergence and band compression signals
 */
function computeMeanReversionSignal(candles, agentParams = {}) {
    const rsiPeriod  = agentParams.rsiPeriod  || 14;
    const oversold   = agentParams.oversold   || 30;
    const overbought = agentParams.overbought || 70;
    const closes  = candles.map(c => c.value);
    const volumes = candles.map(c => c.volume || 0);

    const rsiVal    = rsi(closes, rsiPeriod);
    const bb        = bollingerBands(closes, 20, 2);
    const width     = bbWidth(closes, 20);
    const prevWidth = bbWidth(closes.slice(0, -3), 20);
    const obvResult = obv(closes, volumes);
    const currentPrice = closes[closes.length - 1];

    if (rsiVal === null || !bb) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };

    const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    const squeeze = width !== null && prevWidth !== null && width < prevWidth * 0.85;
    const bullishDiv = bbPosition < 0.3 && obvResult?.trend === 'UP';
    const bearishDiv = bbPosition > 0.7 && obvResult?.trend === 'DOWN';

    if (rsiVal < oversold && bbPosition < 0.25) {
        const strength = ((oversold - rsiVal) / oversold) * 100 + (bullishDiv ? 15 : 0);
        return { signal: 'BUY', strength, reason: `RSI=${rsiVal.toFixed(1)} oversold + BB lower${bullishDiv ? ' + OBV bullish div' : ''}${squeeze ? ' + BB squeeze' : ''}` };
    }
    if (rsiVal > overbought && bbPosition > 0.75) {
        const strength = ((rsiVal - overbought) / (100 - overbought)) * 100 + (bearishDiv ? 15 : 0);
        return { signal: 'SELL', strength, reason: `RSI=${rsiVal.toFixed(1)} overbought + BB upper${bearishDiv ? ' + OBV bearish div' : ''}` };
    }
    return { signal: 'HOLD', strength: 0, reason: `RSI=${rsiVal.toFixed(1)}, BB pos=${(bbPosition * 100).toFixed(0)}%${squeeze ? ' [SQUEEZE]' : ''}, OBV=${obvResult?.trend ?? 'n/a'}` };
}

/**
 * Rex — Trend Following via EMA cloud + ADX + MACD confirmation
 * Upgraded: MACD filter reduces false signals in choppy/ranging markets
 */
function computeTrendSignal(candles, agentParams = {}) {
    const fastEma     = agentParams.fastEma     || 9;
    const slowEma     = agentParams.slowEma     || 21;
    const adxThreshold = agentParams.adxThreshold || 20;
    const closes = candles.map(c => c.value);
    const highs  = candles.map(c => c.high || c.value);
    const lows   = candles.map(c => c.low  || c.value);

    const emaFast  = ema(closes, fastEma);
    const emaSlow  = ema(closes, slowEma);
    const adxVal   = adx(highs, lows, closes, 14);
    const macdResult = macd(closes, 5, 35, 5);
    const currentPrice = closes[closes.length - 1];

    if (emaFast === null || emaSlow === null) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };

    const trendStrength = adxVal || 0;
    const priceBullish  = currentPrice > emaFast && emaFast > emaSlow;
    const priceBearish  = currentPrice < emaFast && emaFast < emaSlow;
    const macdConfirmsBull = macdResult?.histogram > 0;
    const macdConfirmsBear = macdResult?.histogram < 0;

    if (priceBullish && trendStrength >= adxThreshold && macdConfirmsBull) {
        return { signal: 'BUY', strength: trendStrength, reason: `Price above EMA${fastEma}/${slowEma} cloud, ADX=${adxVal?.toFixed(1)}, MACD confirms — strong uptrend` };
    }
    if (priceBearish && trendStrength >= adxThreshold && macdConfirmsBear) {
        return { signal: 'SELL', strength: trendStrength, reason: `Price below EMA${fastEma}/${slowEma} cloud, ADX=${adxVal?.toFixed(1)}, MACD confirms — strong downtrend` };
    }
    return { signal: 'HOLD', strength: 0, reason: `ADX=${adxVal?.toFixed(1)} (need >${adxThreshold})${!macdConfirmsBull && priceBullish ? ', MACD not confirming' : ''} — no entry` };
}

/**
 * Nova — Volume + MACD divergence (5th agent, PDF §18.2 multi-timeframe inspired)
 * OBV accumulation/distribution + MACD momentum convergence
 */
function computeVolumeSignal(candles, agentParams = {}) {
    const closes  = candles.map(c => c.value);
    const volumes = candles.map(c => c.volume || 0);
    const highs   = candles.map(c => c.high  || c.value);
    const lows    = candles.map(c => c.low   || c.value);

    const obvResult  = obv(closes, volumes);
    const macdResult = macd(closes, 5, 35, 5);
    const atrVal     = atr(highs, lows, closes, 14);

    const ret7 = closes.length >= 8
        ? (closes[closes.length - 1] / closes[closes.length - 8] - 1) * 100
        : null;

    if (!obvResult || !macdResult) return { signal: 'HOLD', strength: 0, reason: 'Insufficient data' };

    const macdBull = macdResult.histogram > 0 && macdResult.macdLine > macdResult.signalLine;
    const macdBear = macdResult.histogram < 0 && macdResult.macdLine < macdResult.signalLine;
    const obvBull  = obvResult.trend === 'UP';
    const obvBear  = obvResult.trend === 'DOWN';

    if (macdBull && obvBull && (ret7 === null || ret7 > 0)) {
        const strength = Math.min(Math.abs(macdResult.histogram / (atrVal || 1)) * 500, 100);
        return { signal: 'BUY', strength, reason: `MACD hist=+${macdResult.histogram.toFixed(4)}, OBV accumulating${ret7 !== null ? `, 7p ret=+${ret7.toFixed(1)}%` : ''}` };
    }
    if (macdBear && obvBear && (ret7 === null || ret7 < 0)) {
        const strength = Math.min(Math.abs(macdResult.histogram / (atrVal || 1)) * 500, 100);
        return { signal: 'SELL', strength, reason: `MACD hist=${macdResult.histogram.toFixed(4)}, OBV distributing${ret7 !== null ? `, 7p ret=${ret7.toFixed(1)}%` : ''}` };
    }
    return { signal: 'HOLD', strength: 0, reason: `MACD=${macdResult.histogram.toFixed(4)}, OBV=${obvResult.trend} — no convergence` };
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
    const novaResult    = computeVolumeSignal(candles, getParams('VOLUME_MACD'));

    const votes = [
        { agentId: 'MOMENTUM',        name: 'Atlas', ...atlasResult },
        { agentId: 'MEAN_REVERSION',  name: 'Vera',  ...veraResult },
        { agentId: 'TREND_FOLLOWING', name: 'Rex',   ...rexResult },
        { agentId: 'SENTIMENT_DRIVEN',name: 'Luna',  ...lunaResult },
        { agentId: 'VOLUME_MACD',     name: 'Nova',  ...novaResult },
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
        { id: 'VOLUME_MACD',     fn: () => computeVolumeSignal(candles, strategies.find(s => s.id === 'VOLUME_MACD')?.parameters || {}) },
    ];

    const MIN_STRENGTH = 20; // lowered: 40 was unreachable; 20 allows real learning

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
            if (pnl > 0) strategy.wins++; else strategy.losses++;
            updateAgentSharpe(strategy);
            sp.holdings = 0;
            sp.entryPrice = null;
            // Persist immediately so wins/losses/sharpe survive server restarts
            getPersistence().saveStrategies(getSupabase(), userId, user.strategies)
                .catch(err => console.warn('saveStrategies (shadow trade):', err.message));
        }
    }

    // Run tournament if enough closed trades accumulated
    const totalClosed = strategies.reduce((sum, s) => sum + (s.shadowPortfolio?.closedTrades?.length || 0), 0);
    const lastCycle = user.strategyTournament?.lastCycleClosedTrades || 0;
    if (totalClosed - lastCycle >= 8) {
        runTournamentCycle(userId);
    }
}

function updateAgentSharpe(strategy) {
    const trades = strategy.shadowPortfolio?.closedTrades || [];
    if (trades.length < 20) return;
    const returns = trades.map(t => t.pnlPct);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / (returns.length - 1); // sample variance
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
        const mutated = mutateParameters(loser.parameters || {});
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

    // Persist strategy state after tournament mutation (fire-and-forget)
    getPersistence().saveStrategies(getSupabase(), userId, strategies)
        .catch(err => console.warn('saveStrategies (tournament) failed:', err.message));
}

function mutateParameters(params) {
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
    // Persist updated strategy data (fire-and-forget)
    getPersistence().saveStrategies(getSupabase(), userId, user.strategies || [])
        .catch(err => console.warn('saveStrategies (lesson) failed:', err.message));
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
    computeVolumeSignal,
    atr,
};
