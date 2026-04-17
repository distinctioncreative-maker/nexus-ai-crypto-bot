/**
 * Position Manager — Multi-Take-Profit + Trailing Stop
 *
 * When a BUY executes, register the position here with configured TP levels
 * and a trailing stop. On every price tick, call checkPositions() to
 * auto-execute partial sells as targets are hit.
 *
 * This is SmartTrade-style execution — superior to 3Commas' single TP/SL
 * because the AI can suggest optimal TP levels based on volatility and
 * support/resistance, which are previewed in the PendingTradeCard.
 */

// In-memory position registry: Map<`${userId}:${productId}`, PositionState>
const positions = new Map();

/**
 * Open a SmartTrade position after a BUY executes.
 *
 * @param {string} userId
 * @param {string} productId
 * @param {number} amount         - total quantity held
 * @param {number} entryPrice     - execution price
 * @param {object} tpConfig       - { levels: [{pct, qtyPct}], trailingStopPct }
 *                                  e.g. { levels: [{pct:5,qtyPct:33},{pct:10,qtyPct:33},{pct:20,qtyPct:34}], trailingStopPct: 3 }
 */
function openPosition(userId, productId, amount, entryPrice, tpConfig = {}) {
    const key = `${userId}:${productId}`;

    const levels = Array.isArray(tpConfig.levels) && tpConfig.levels.length > 0
        ? tpConfig.levels
        : null;

    const trailPct = typeof tpConfig.trailingStopPct === 'number' && tpConfig.trailingStopPct > 0
        ? tpConfig.trailingStopPct
        : null;

    const position = {
        productId,
        amount,
        remaining: amount,
        entryPrice,
        takeProfits: levels
            ? levels.map(l => ({
                pct: l.pct,
                qtyPct: l.qtyPct,
                targetPrice: entryPrice * (1 + l.pct / 100),
                executed: false
            }))
            : null,
        trailing: trailPct
            ? {
                pct: trailPct,
                highWaterMark: entryPrice,
                stopPrice: entryPrice * (1 - trailPct / 100)
            }
            : null,
        openedAt: new Date().toISOString()
    };

    positions.set(key, position);
    console.log(`📌 SmartTrade position opened: ${userId} ${productId} @ $${entryPrice.toFixed(2)} — ` +
        `${levels ? `${levels.length} TP levels` : 'no TP'}, ${trailPct ? `${trailPct}% trailing stop` : 'no trailing'}`);
}

/**
 * Check all open positions for the given user/product on each price tick.
 * Fires partial sells when TP levels or trailing stop are hit.
 *
 * @param {string} userId
 * @param {string} productId
 * @param {number} currentPrice
 * @param {Function} executeSellFn  - (amount, price, reason) → executed trade or false
 * @param {Function} broadcastFn    - (type, payload) → void
 * @returns {{ triggered: boolean, closedFully: boolean }}
 */
function checkPositions(userId, productId, currentPrice, executeSellFn, broadcastFn) {
    const key = `${userId}:${productId}`;
    const pos = positions.get(key);
    if (!pos || pos.remaining <= 0) return { triggered: false, closedFully: false };

    let triggered = false;

    // --- Update trailing stop high water mark ---
    if (pos.trailing) {
        if (currentPrice > pos.trailing.highWaterMark) {
            pos.trailing.highWaterMark = currentPrice;
            pos.trailing.stopPrice = currentPrice * (1 - pos.trailing.pct / 100);
        }

        // Trailing stop hit
        if (currentPrice <= pos.trailing.stopPrice && pos.remaining > 0) {
            const reason = `[TRAILING-STOP] Price $${currentPrice.toFixed(2)} fell to stop at $${pos.trailing.stopPrice.toFixed(2)} (trail ${pos.trailing.pct}% from $${pos.trailing.highWaterMark.toFixed(2)})`;
            const executed = executeSellFn(pos.remaining, currentPrice, reason);
            if (executed) {
                triggered = true;
                broadcastFn('AI_STATUS', `Trailing stop fired on ${productId}: sold ${pos.remaining.toFixed(6)} @ $${currentPrice.toFixed(2)}`);
                pos.remaining = 0;
                positions.delete(key);
                return { triggered, closedFully: true };
            }
        }
    }

    // --- Check take-profit levels ---
    if (pos.takeProfits) {
        for (const tp of pos.takeProfits) {
            if (tp.executed) continue;
            if (currentPrice >= tp.targetPrice) {
                const sellAmount = pos.amount * (tp.qtyPct / 100);
                const actualSell = Math.min(sellAmount, pos.remaining);
                if (actualSell <= 0) continue;

                const reason = `[TAKE-PROFIT ${tp.pct}%] Price $${currentPrice.toFixed(2)} hit target $${tp.targetPrice.toFixed(2)} — selling ${tp.qtyPct}% of position`;
                const executed = executeSellFn(actualSell, currentPrice, reason);
                if (executed) {
                    tp.executed = true;
                    triggered = true;
                    pos.remaining -= actualSell;
                    broadcastFn('AI_STATUS', `TP${tp.pct}% hit on ${productId}: sold ${actualSell.toFixed(6)} @ $${currentPrice.toFixed(2)}`);
                }
            }
        }
    }

    // Clean up if fully closed
    if (pos.remaining <= 0.000001) {
        positions.delete(key);
        return { triggered, closedFully: true };
    }

    return { triggered, closedFully: false };
}

/**
 * Close and remove a position (called when user manually sells all).
 */
function closePosition(userId, productId) {
    positions.delete(`${userId}:${productId}`);
}

/**
 * Get the current SmartTrade position for a user/product (for UI display).
 */
function getPosition(userId, productId) {
    return positions.get(`${userId}:${productId}`) || null;
}

/**
 * Get all open SmartTrade positions for a user.
 */
function getUserPositions(userId) {
    const result = [];
    for (const [key, pos] of positions.entries()) {
        if (key.startsWith(`${userId}:`)) result.push(pos);
    }
    return result;
}

/**
 * Build default TP config from user's risk settings.
 * Used when no custom TP levels are specified.
 *
 * @param {object} riskSettings
 * @returns {object} tpConfig
 */
function defaultTpConfig(riskSettings) {
    const tpPct = riskSettings?.takeProfitPercent || 6;
    const multiTp = riskSettings?.multiTpLevels;

    return {
        levels: multiTp && Array.isArray(multiTp) && multiTp.length > 0
            ? multiTp
            : [{ pct: tpPct, qtyPct: 100 }], // single TP: sell everything at configured %
        trailingStopPct: riskSettings?.trailingStopPct || null
    };
}

module.exports = {
    openPosition,
    checkPositions,
    closePosition,
    getPosition,
    getUserPositions,
    defaultTpConfig
};
