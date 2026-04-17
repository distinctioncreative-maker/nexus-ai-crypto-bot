/**
 * Backtest Engine — Real historical OHLCV from CoinGecko.
 * Walk-forward: 80% train / 20% test split.
 * Realistic fees (0.6% taker) + slippage (0.1% market orders).
 * Uses self-contained indicator functions below — no cross-imports from strategyEngine.
 */

const COIN_ID_MAP = {
    'BTC-USD': 'bitcoin',
    'ETH-USD': 'ethereum',
    'SOL-USD': 'solana',
    'DOGE-USD': 'dogecoin',
    'XRP-USD': 'ripple',
    'ADA-USD': 'cardano',
    'AVAX-USD': 'avalanche-2',
    'MATIC-USD': 'matic-network',
    'LINK-USD': 'chainlink',
    'LTC-USD': 'litecoin',
    'DOT-USD': 'polkadot',
    'UNI-USD': 'uniswap',
    'ATOM-USD': 'cosmos',
    'NEAR-USD': 'near',
    'FIL-USD': 'filecoin'
};

const TAKER_FEE = 0.006;    // 0.6%
const SLIPPAGE  = 0.001;    // 0.1%

async function fetchOHLCV(coinId, days) {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`CoinGecko error ${res.status}`);
    const data = await res.json();
    // Each entry: [timestamp, open, high, low, close]
    return data.map(([ts, o, h, l, c]) => ({ ts, open: o, high: h, low: l, close: c }));
}

/**
 * Simple strategy signal from OHLCV closes using the same logic as strategyEngine.
 * Returns 'BUY' | 'SELL' | 'HOLD'
 */
function getSignalFromHistory(strategy, closePrices, idx) {
    if (idx < 35) return 'HOLD'; // not enough history
    const window = closePrices.slice(0, idx + 1);

    switch (strategy) {
        case 'MOMENTUM': {
            const fast = window.slice(-10).reduce((a, b) => a + b, 0) / 10;
            const slow = window.slice(-30).reduce((a, b) => a + b, 0) / 30;
            const isRising = window[window.length - 1] > window[window.length - 5];
            if (fast > slow && isRising) return 'BUY';
            if (fast < slow && !isRising) return 'SELL';
            return 'HOLD';
        }
        case 'MEAN_REVERSION': {
            const rsi = _rsi(window, 14);
            if (rsi === null) return 'HOLD';
            if (rsi < 30) return 'BUY';
            if (rsi > 70) return 'SELL';
            return 'HOLD';
        }
        case 'TREND_FOLLOWING': {
            const ema = _ema(window, 20);
            if (!ema) return 'HOLD';
            const price = window[window.length - 1];
            if (price > ema * 1.002) return 'BUY';
            if (price < ema * 0.998) return 'SELL';
            return 'HOLD';
        }
        case 'COMBINED':
        default: {
            const fast = window.slice(-10).reduce((a, b) => a + b, 0) / 10;
            const slow30 = window.length >= 30 ? window.slice(-30).reduce((a, b) => a + b, 0) / 30 : fast;
            const rsi = _rsi(window, 14);
            if (!rsi) return 'HOLD';
            const maTrend = fast > slow30 ? 1 : -1;
            const rsiSignal = rsi < 40 ? 1 : rsi > 60 ? -1 : 0;
            const score = maTrend + rsiSignal;
            if (score >= 1.5) return 'BUY';
            if (score <= -1.5) return 'SELL';
            return 'HOLD';
        }
    }
}

function _ema(prices, period) {
    if (prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}

function _rsi(prices, period) {
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
    return 100 - (100 / (1 + avgGain / avgLoss));
}

function simulateBacktest(candles, strategy, startCapital) {
    const closes = candles.map(c => c.close);
    let balance = startCapital;
    let holdings = 0;
    let entryPrice = 0;
    const equityCurve = [];
    const tradeLog = [];
    let peak = startCapital;
    let maxDrawdown = 0;
    let wins = 0;
    let grossProfit = 0, grossLoss = 0;

    for (let i = 1; i < candles.length; i++) {
        // Signal is based on close of candle i-1, executes at open of candle i (no look-ahead)
        const signal = getSignalFromHistory(strategy, closes, i - 1);
        const execPrice = candles[i].open * (1 + SLIPPAGE); // pessimistic fill

        if (signal === 'BUY' && holdings === 0 && balance > 0) {
            const cost = balance * (1 - TAKER_FEE);
            holdings = cost / execPrice;
            entryPrice = execPrice;
            balance = 0;
            tradeLog.push({ type: 'BUY', candle: i, price: execPrice, time: candles[i].ts });
        } else if (signal === 'SELL' && holdings > 0) {
            const proceeds = holdings * execPrice * (1 - TAKER_FEE);
            const pnl = proceeds - (holdings * entryPrice);
            if (pnl > 0) { wins++; grossProfit += pnl; }
            else { grossLoss += Math.abs(pnl); }
            balance = proceeds;
            tradeLog.push({ type: 'SELL', candle: i, price: execPrice, pnl, time: candles[i].ts });
            holdings = 0;
        }

        const equity = balance + holdings * closes[i];
        equityCurve.push({ time: Math.floor(candles[i].ts / 1000), value: equity });

        if (equity > peak) peak = equity;
        const dd = ((peak - equity) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Close open position at last price
    if (holdings > 0) {
        balance = holdings * closes[closes.length - 1] * (1 - TAKER_FEE);
    }

    const totalReturn = ((balance - startCapital) / startCapital) * 100;
    const totalTrades = tradeLog.filter(t => t.type === 'SELL').length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Annualized Sharpe (simplified)
    const returns = equityCurve.map((e, i) => i === 0 ? 0 : (e.value - equityCurve[i - 1].value) / equityCurve[i - 1].value);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / Math.max(returns.length, 1);
    const stdReturn = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / Math.max(returns.length, 1));
    const annualizedSharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(365) : 0;

    return {
        startCapital,
        endCapital: parseFloat(balance.toFixed(2)),
        totalReturnPct: parseFloat(totalReturn.toFixed(2)),
        annualizedSharpe: parseFloat(annualizedSharpe.toFixed(3)),
        maxDrawdownPct: parseFloat(maxDrawdown.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        profitFactor: isFinite(profitFactor) ? parseFloat(profitFactor.toFixed(3)) : 999,
        totalTrades,
        equityCurve,
        tradeLog
    };
}

async function runBacktest(productId, days, strategy) {
    const coinId = COIN_ID_MAP[productId];
    if (!coinId) throw new Error(`Historical data unavailable for ${productId}. Backtests currently support mapped CoinGecko assets only.`);

    const candles = await fetchOHLCV(coinId, days);
    if (candles.length < 40) throw new Error('Not enough historical data');

    const splitIdx = Math.floor(candles.length * 0.8);
    const trainCandles = candles.slice(0, splitIdx);
    const testCandles = candles.slice(splitIdx);

    const startCapital = 10000;
    const trainResult = simulateBacktest(trainCandles, strategy, startCapital);
    const testResult = simulateBacktest(testCandles, strategy, startCapital);

    return {
        productId,
        strategy,
        days,
        totalCandles: candles.length,
        splitIdx,
        fees: `${(TAKER_FEE * 100).toFixed(1)}% taker, ${(SLIPPAGE * 100).toFixed(1)}% slippage`,
        train: trainResult,
        test: testResult
    };
}

module.exports = { runBacktest };
