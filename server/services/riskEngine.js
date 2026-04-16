const userStore = require('../userStore');

function checkTradeAllowed(userId, side, amount, price, priceHistory) {
    const user = userStore._ensureUser(userId);

    if (user.killSwitch) {
        return { allowed: false, reason: `Kill switch active: ${user.killSwitchReason}` };
    }

    if (user.circuitBreaker.tripped) {
        return { allowed: false, reason: user.circuitBreaker.reason };
    }

    const rs = user.riskSettings;
    const state = user.paperTradingState;
    const totalPortfolioValue = state.balance + (state.assetHoldings * price);

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

    // Max position % (for BUY orders)
    if (side === 'BUY') {
        const newHoldingsValue = (state.assetHoldings * price) + orderValueUSD;
        const positionPct = (newHoldingsValue / totalPortfolioValue) * 100;
        if (positionPct > rs.maxPositionPercent) {
            return { allowed: false, reason: `Position would be ${positionPct.toFixed(1)}% of portfolio (max ${rs.maxPositionPercent}%)` };
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

function getSuggestedTradeSize(userId, price) {
    const user = userStore._ensureUser(userId);
    const rs = user.riskSettings;
    const state = user.paperTradingState;
    const totalPortfolioValue = state.balance + (state.assetHoldings * price);

    if (rs.enableKellySize) {
        // Simplified Kelly: f = (win_rate * avg_win - loss_rate * avg_loss) / avg_win
        const trades = state.trades.slice(0, 20);
        if (trades.length >= 5) {
            const wins = trades.filter(t => t.pnl > 0);
            const losses = trades.filter(t => t.pnl <= 0);
            const winRate = wins.length / trades.length;
            const avgWin = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
            const avgLoss = losses.length ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 1;
            const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
            const kellyCapped = Math.min(Math.max(kelly, 0.005), rs.maxTradePercent / 100);
            return (totalPortfolioValue * kellyCapped) / price;
        }
    }

    // Default: fixed % of portfolio
    const orderUSD = totalPortfolioValue * (rs.maxTradePercent / 100);
    const cappedUSD = Math.min(orderUSD, rs.maxSingleOrderUSD);
    return cappedUSD / price;
}

module.exports = { checkTradeAllowed, getSuggestedTradeSize };
