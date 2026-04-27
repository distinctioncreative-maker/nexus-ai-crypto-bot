const userStore = require('../userStore');
const { atr: computeAtr } = require('./strategyEngine');

function getTotalPortfolioValue(user, price, productId) {
    const state = user.paperTradingState;
    // Sum all held product positions using known prices
    let positionsValue = state.assetHoldings * price; // current product
    const holdings = user.productHoldings || {};
    for (const [prod, held] of Object.entries(holdings)) {
        if (prod === productId) continue; // already counted via assetHoldings
        if (held?.assetHoldings > 0 && held._lastPrice > 0) {
            positionsValue += held.assetHoldings * held._lastPrice;
        }
    }
    return state.balance + positionsValue;
}

function checkTradeAllowed(userId, side, amount, price, priceHistory, productId) {
    const user = userStore._ensureUser(userId);

    if (user.killSwitch) {
        return { allowed: false, reason: `Kill switch active: ${user.killSwitchReason}` };
    }

    if (user.circuitBreaker.tripped) {
        return { allowed: false, reason: user.circuitBreaker.reason };
    }

    const rs = user.riskSettings;
    const state = user.paperTradingState;
    const totalPortfolioValue = getTotalPortfolioValue(user, price, productId || user.selectedProduct);

    // Daily loss limit check
    const today = new Date().toISOString().slice(0, 10);
    if (user.dailyStats.date !== today) {
        user.dailyStats.date = today;
        user.dailyStats.startBalance = totalPortfolioValue;
        user.dailyStats.pnlToday = 0;
        user.dailyStats.tradesExecuted = 0;
    }
    const dailyLossPct = ((user.dailyStats.startBalance - totalPortfolioValue) / user.dailyStats.startBalance) * 100;
    if (dailyLossPct >= rs.dailyLossLimitPercent) {
        return { allowed: false, reason: `Daily loss limit hit: ${dailyLossPct.toFixed(2)}% loss today` };
    }

    // Max single order USD
    const orderValueUSD = amount * price;
    if (orderValueUSD > rs.maxSingleOrderUSD) {
        return { allowed: false, reason: `Order $${orderValueUSD.toFixed(2)} exceeds max $${rs.maxSingleOrderUSD}` };
    }

    // Per-trade max % of portfolio
    const tradePct = (orderValueUSD / totalPortfolioValue) * 100;
    if (tradePct > rs.maxTradePercent) {
        return { allowed: false, reason: `Trade is ${tradePct.toFixed(1)}% of portfolio (max ${rs.maxTradePercent}%)` };
    }

    // Max position % per product (for BUY orders)
    if (side === 'BUY') {
        const newHoldingsValue = (state.assetHoldings * price) + orderValueUSD;
        const positionPct = (newHoldingsValue / totalPortfolioValue) * 100;
        const perProductMax = rs.maxPerProductPercent || rs.maxPositionPercent;
        if (positionPct > perProductMax) {
            return { allowed: false, reason: `Position would be ${positionPct.toFixed(1)}% of portfolio (max ${perProductMax}% per product)` };
        }
        // Total exposure cap: sum all positions + new order must not exceed maxPositionPercent
        const allPositionsValue = totalPortfolioValue - state.balance + orderValueUSD;
        const totalExposurePct = (allPositionsValue / totalPortfolioValue) * 100;
        if (totalExposurePct > (rs.maxPositionPercent || 40)) {
            return { allowed: false, reason: `Total portfolio exposure would be ${totalExposurePct.toFixed(1)}% (max ${rs.maxPositionPercent || 40}%)` };
        }
    }

    // Volatility check — if 1h price move > threshold, halve size
    let adjustedAmount = amount;
    if (priceHistory && priceHistory.length >= 30) {
        const recent = priceHistory.slice(-30);
        const oneHourAgoPrice = recent[0];
        const currentPrice = recent[recent.length - 1];
        const movePct = Math.abs((currentPrice - oneHourAgoPrice) / oneHourAgoPrice) * 100;
        if (movePct > rs.volatilityReduceThreshold) {
            adjustedAmount = amount * 0.5;
        }
    }

    return { allowed: true, reason: 'Risk checks passed', adjustedAmount };
}

function getSuggestedTradeSize(userId, price, productId, candles = null) {
    const user = userStore._ensureUser(userId);
    const rs = user.riskSettings;
    const state = user.paperTradingState;
    const totalPortfolioValue = getTotalPortfolioValue(user, price, productId || user.selectedProduct);

    // Fear & Greed position sizing multiplier (don't chase extreme greed, buy the fear)
    const fgValue = user._lastFearGreed;
    let fgMultiplier = 1.0;
    if (fgValue != null) {
        if (fgValue > 80)      fgMultiplier = 0.5;   // extreme greed: half size
        else if (fgValue > 65) fgMultiplier = 0.75;  // greed: reduce size
        else if (fgValue < 20) fgMultiplier = 1.25;  // extreme fear: slight boost (capped below)
    }

    // ATR-based position sizing: risk 2% of portfolio per trade / (ATR × 2 stop distance)
    if (candles && candles.length >= 20) {
        const closes = candles.map(c => c.value || c.close || 0);
        const highs  = candles.map(c => c.high  || c.value || 0);
        const lows   = candles.map(c => c.low   || c.value || 0);
        const atrVal = computeAtr(highs, lows, closes, 14);
        if (atrVal && atrVal > 0) {
            const riskUSD   = totalPortfolioValue * 0.02 * fgMultiplier;
            const stopDist  = atrVal * 2;
            const atrUnits  = riskUSD / stopDist;
            const maxUnits  = (totalPortfolioValue * 0.25 * fgMultiplier) / price; // cap 25% of portfolio
            return Math.min(atrUnits, maxUnits);
        }
    }

    if (rs.enableKellySize) {
        const trades = state.trades.slice(0, 20);
        if (trades.length >= 5) {
            const wins = trades.filter(t => t.pnl > 0);
            const losses = trades.filter(t => t.pnl <= 0);
            const winRate = wins.length / trades.length;
            const avgWin = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
            const avgLoss = losses.length ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 1;
            const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
            const kellyCapped = Math.min(Math.max(kelly, 0.005), rs.maxTradePercent / 100);
            return (totalPortfolioValue * kellyCapped * fgMultiplier) / price;
        }
    }

    // Default: fixed % of portfolio with F&G multiplier
    const orderUSD = totalPortfolioValue * (rs.maxTradePercent / 100) * fgMultiplier;
    const cappedUSD = Math.min(orderUSD, rs.maxSingleOrderUSD);
    return cappedUSD / price;
}

module.exports = { checkTradeAllowed, getSuggestedTradeSize };
