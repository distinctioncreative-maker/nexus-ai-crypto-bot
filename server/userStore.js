// Per-User Isolated State Store
// Each authenticated user gets their own sandboxed trading environment.
// Keys are encrypted before being saved to Supabase Postgres.

const CryptoJS = require('crypto-js');
// Lazy-loaded to avoid circular dependency at module init time
let _persistence = null;
let _supabase = null;
function getPersistence() {
    if (!_persistence) _persistence = require('./db/persistence');
    return _persistence;
}
function getSupabase() {
    if (!_supabase) _supabase = require('./middleware/auth').supabase;
    return _supabase;
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET || (
    process.env.NODE_ENV === 'production'
        ? (() => { console.error('❌ ENCRYPTION_SECRET env var is required in production. Set it in Railway secrets.'); process.exit(1); })()
        : 'quant-distinction-creative-local-dev-key'
);
const ENGINE_STATUSES = ['STOPPED', 'PAPER_RUNNING', 'LIVE_RUNNING'];

// Realistic paper trading friction (matches Coinbase Advanced Trade fees)
const PAPER_TAKER_FEE = 0.006;  // 0.6% taker fee
const PAPER_SLIPPAGE  = 0.001;  // 0.1% market impact
const PAPER_FRICTION  = PAPER_TAKER_FEE + PAPER_SLIPPAGE; // 0.7% total per side

class UserStore {
    constructor() {
        // Map<userId, UserState>
        this.users = new Map();
    }

    _ensureUser(userId) {
        if (!this.users.has(userId)) {
            this.users.set(userId, {
                keys: {
                    coinbaseApiKey: null,
                    coinbaseApiSecret: null,
                },
                selectedProduct: 'BTC-USD',
                watchlist: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD'],
                tradingMode: 'FULL_AUTO',
                isLiveMode: false,
                engineStatus: 'PAPER_RUNNING',
                riskSettings: {
                    maxTradePercent: 2,
                    dailyLossLimitPercent: 5,
                    maxSingleOrderUSD: 1000,
                    maxPositionPercent: 40,
                    volatilityReduceThreshold: 8,
                    stopLossPercent: 3,
                    takeProfitPercent: 6,
                    enableKellySize: false,
                    stopLossPrice: null,
                    takeProfitPrice: null,
                    // SmartTrade: multi-TP levels array [{pct, qtyPct}] and trailing stop
                    multiTpLevels: null,
                    trailingStopPct: null
                },
                activeStrategyId: 'COMBINED',
                killSwitch: false,
                killSwitchReason: '',
                dailyStats: {
                    date: '',
                    startBalance: 0,
                    pnlToday: 0,
                    tradesExecuted: 0
                },
                strategies: [
                    { id: 'MOMENTUM',        name: 'Atlas', role: 'Momentum Analyst',             color: '#F7931A', status: 'active', wins: 0, losses: 0, sharpe: 0, generation: 1, parameters: {}, lessons: [], lastSignal: null, shadowPortfolio: { equity: 100000, holdings: 0, closedTrades: [] } },
                    { id: 'MEAN_REVERSION',  name: 'Vera',  role: 'Mean Reversion Quant',         color: '#627EEA', status: 'active', wins: 0, losses: 0, sharpe: 0, generation: 1, parameters: {}, lessons: [], lastSignal: null, shadowPortfolio: { equity: 100000, holdings: 0, closedTrades: [] } },
                    { id: 'TREND_FOLLOWING', name: 'Rex',   role: 'Trend Following Strategist',   color: '#9945FF', status: 'active', wins: 0, losses: 0, sharpe: 0, generation: 1, parameters: {}, lessons: [], lastSignal: null, shadowPortfolio: { equity: 100000, holdings: 0, closedTrades: [] } },
                    { id: 'SENTIMENT_DRIVEN',name: 'Luna',  role: 'Sentiment & Macro Intelligence',color: '#34C759', status: 'active', wins: 0, losses: 0, sharpe: 0, generation: 1, parameters: {}, lessons: [], lastSignal: null, shadowPortfolio: { equity: 100000, holdings: 0, closedTrades: [] } },
                    { id: 'VOLUME_MACD',     name: 'Nova',  role: 'Volume & MACD Divergence',     color: '#FF9F0A', status: 'active', wins: 0, losses: 0, sharpe: 0, generation: 1, parameters: {}, lessons: [], lastSignal: null, shadowPortfolio: { equity: 100000, holdings: 0, closedTrades: [] } },
                    { id: 'COMBINED',        name: 'Orion', role: 'Chief Strategist',             color: '#0A84FF', status: 'active', wins: 0, losses: 0, sharpe: 0, generation: 1, parameters: {}, lessons: [], lastSignal: null, shadowPortfolio: { equity: 100000, holdings: 0, closedTrades: [] } },
                ],
                strategyTournament: {
                    lastCycleClosedTrades: 0
                },
                notifications: [],
                pendingTrade: null,
                paperTradingState: {
                    initialBalance: 100000.00,
                    balance: 100000.00,
                    assetHoldings: 0,
                    trades: [],
                    learningHistory: []
                },
                // Per-product holdings: { 'BTC-USD': { assetHoldings: 0, trades: [] }, ... }
                productHoldings: {},
                // Per-product last-execution timestamp — used to enforce trade cooldown.
                // Map<productId, timestamp_ms>. Prevents repeated BUY spam into a product.
                lastTradeByProduct: {},
                circuitBreaker: {
                    tripped: false,
                    maxDrawdownPercent: 20.0,
                    reason: ''
                }
            });
        }
        return this.users.get(userId);
    }

    setKeys(userId, coinbaseKey, coinbaseSecret) {
        const user = this._ensureUser(userId);
        user.keys.coinbaseApiKey = coinbaseKey;
        user.keys.coinbaseApiSecret = coinbaseSecret;
    }

    hasKeys(userId) {
        // Ollama is always available locally — just check the user has completed setup
        const user = this.users.get(userId);
        return !!user;
    }

    hasCoinbaseKeys(userId) {
        const user = this.users.get(userId);
        if (!user) return false;
        return !!(user.keys.coinbaseApiKey && user.keys.coinbaseApiSecret);
    }

    getKeys(userId) {
        const user = this.users.get(userId);
        return user ? user.keys : null;
    }

    getPaperState(userId) {
        const user = this._ensureUser(userId);
        // Merge trades from all products for the full trade feed
        const allTrades = [...user.paperTradingState.trades];
        for (const [prod, held] of Object.entries(user.productHoldings)) {
            if (prod === user.selectedProduct) continue;
            if (Array.isArray(held?.trades)) {
                for (const t of held.trades) {
                    if (!allTrades.find(x => x.id === t.id)) allTrades.push(t);
                }
            }
        }
        allTrades.sort((a, b) => new Date(b.time) - new Date(a.time));
        return {
            ...user.paperTradingState,
            trades: allTrades.slice(0, 500),
            selectedProduct: user.selectedProduct,
            watchlist: user.watchlist,
            circuitBreaker: user.circuitBreaker,
            tradingMode: user.tradingMode,
            isLiveMode: user.isLiveMode,
            engineStatus: user.engineStatus,
            riskSettings: user.riskSettings,
            killSwitch: user.killSwitch,
            killSwitchReason: user.killSwitchReason,
            dailyStats: user.dailyStats,
            productHoldings: user.productHoldings
        };
    }

    getWatchlist(userId) {
        const user = this._ensureUser(userId);
        return user.watchlist || ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD'];
    }

    setWatchlist(userId, products) {
        const user = this._ensureUser(userId);
        const valid = Array.isArray(products) ? products.slice(0, 10) : user.watchlist;
        user.watchlist = valid;
        // Always ensure selectedProduct is in watchlist
        if (!valid.includes(user.selectedProduct)) {
            user.watchlist.unshift(user.selectedProduct);
            if (user.watchlist.length > 10) user.watchlist.pop();
        }
    }

    getSelectedProduct(userId) {
        const user = this._ensureUser(userId);
        return user.selectedProduct;
    }

    setSelectedProduct(userId, productId) {
        const user = this._ensureUser(userId);

        // Save current product's state before switching.
        // Filter trades to this product only — user.paperTradingState.trades can contain
        // a merged array from getPaperState() that includes trades for ALL products.
        // Storing mixed trades here contaminates avgBuy calculations in the portfolio UI
        // and produces impossibly large P&L percentages (e.g. +3,000,000% for BTC).
        // CRITICAL: preserve _lastPrice — without it the auto-heal in persistence.js uses
        // a $0.01/unit floor and fails to detect impossible holdings (e.g. 11 BTC at $0.01
        // = $0.11, well below the $500k corrupted-state threshold).
        if (user.selectedProduct) {
            const curProd = user.selectedProduct;
            user.productHoldings[curProd] = {
                assetHoldings: user.paperTradingState.assetHoldings,
                trades: user.paperTradingState.trades.filter(t => t.product === curProd),
                _lastPrice: user.productHoldings[curProd]?._lastPrice || 0
            };
        }

        user.selectedProduct = productId;

        // Restore the new product's state (or start fresh)
        const saved = user.productHoldings[productId];
        user.paperTradingState.assetHoldings = saved?.assetHoldings ?? 0;
        user.paperTradingState.trades = saved?.trades ? [...saved.trades] : [];

        // Clear absolute price targets — they were set for the previous product's price scale
        // (e.g. a $2.657 DOGE TP must not fire when switching to $77k BTC)
        user.riskSettings.takeProfitPrice = null;
        user.riskSettings.stopLossPrice = null;
    }

    setTradingMode(userId, mode) {
        const user = this._ensureUser(userId);
        if (['FULL_AUTO', 'AI_ASSISTED'].includes(mode)) {
            if (user.engineStatus === 'LIVE_RUNNING' && mode === 'FULL_AUTO') {
                user.tradingMode = 'AI_ASSISTED';
                return;
            }
            user.tradingMode = mode;
        }
    }

    setLiveMode(userId, isLive) {
        this.setEngineStatus(userId, isLive ? 'LIVE_RUNNING' : 'PAPER_RUNNING');
    }

    setEngineStatus(userId, engineStatus) {
        const user = this._ensureUser(userId);
        if (!ENGINE_STATUSES.includes(engineStatus)) return false;
        user.engineStatus = engineStatus;
        user.isLiveMode = engineStatus === 'LIVE_RUNNING';
        if (engineStatus === 'LIVE_RUNNING') {
            user.tradingMode = 'AI_ASSISTED';
        }
        return true;
    }

    getEngineState(userId) {
        const user = this._ensureUser(userId);
        return {
            engineStatus: user.engineStatus,
            isLiveMode: user.isLiveMode,
            tradingMode: user.tradingMode,
            killSwitch: user.killSwitch,
            killSwitchReason: user.killSwitchReason
        };
    }

    updateRiskSettings(userId, settings) {
        const user = this._ensureUser(userId);
        Object.assign(user.riskSettings, settings);
    }

    tripKillSwitch(userId, reason) {
        const user = this._ensureUser(userId);
        user.killSwitch = true;
        user.killSwitchReason = reason || 'Manual kill switch activated';
        this.addNotification(userId, {
            type: 'KILL_SWITCH',
            title: 'Kill Switch Activated',
            body: user.killSwitchReason
        });
    }

    resetKillSwitch(userId) {
        const user = this._ensureUser(userId);
        user.killSwitch = false;
        user.killSwitchReason = '';
        user.circuitBreaker.tripped = false;
        user.circuitBreaker.reason = '';
        // Clear stale TP/SL prices — if not cleared, a price set for a cheap coin
        // (e.g. DOGE $2.657) will immediately fire against a different coin (e.g. BTC $77k)
        // on the next tick, re-tripping the circuit breaker right after reset.
        user.riskSettings.takeProfitPrice = null;
        user.riskSettings.stopLossPrice = null;
    }

    addNotification(userId, { type, title, body }) {
        const user = this._ensureUser(userId);
        user.notifications.unshift({
            id: Date.now(),
            type,
            title,
            body,
            timestamp: new Date().toISOString(),
            read: false
        });
        if (user.notifications.length > 50) user.notifications.pop();
    }

    getNotifications(userId) {
        const user = this._ensureUser(userId);
        return user.notifications;
    }

    setPendingTrade(userId, trade) {
        const user = this._ensureUser(userId);
        user.pendingTrade = trade;
    }

    clearPendingTrade(userId) {
        const user = this._ensureUser(userId);
        user.pendingTrade = null;
    }

    getPendingTrade(userId) {
        const user = this._ensureUser(userId);
        return user.pendingTrade;
    }

    updateDailyStats(userId, pnlDelta) {
        const user = this._ensureUser(userId);
        user.dailyStats.pnlToday += pnlDelta;
        user.dailyStats.tradesExecuted += 1;
    }

    upsertStrategy(userId, strategy) {
        const user = this._ensureUser(userId);
        const idx = user.strategies.findIndex(s => s.id === strategy.id);
        if (idx >= 0) user.strategies[idx] = { ...user.strategies[idx], ...strategy };
        else user.strategies.push(strategy);
    }

    getStrategies(userId) {
        const user = this._ensureUser(userId);
        return user.strategies;
    }

    checkCircuitBreaker(userId, currentPrice) {
        const user = this._ensureUser(userId);
        if (user.killSwitch) return true;
        if (user.circuitBreaker.tripped) return true;

        const totalValue = user.paperTradingState.balance + (user.paperTradingState.assetHoldings * currentPrice);
        const drawdown = ((user.paperTradingState.initialBalance - totalValue) / user.paperTradingState.initialBalance) * 100;

        if (drawdown >= user.circuitBreaker.maxDrawdownPercent) {
            user.circuitBreaker.tripped = true;
            user.circuitBreaker.reason = `HARD STOP: ${drawdown.toFixed(2)}% Drawdown. AI Halted.`;
            this.recordLearning(userId, user.circuitBreaker.reason);
            this.addNotification(userId, {
                type: 'CIRCUIT_BREAKER',
                title: 'Circuit Breaker Tripped',
                body: user.circuitBreaker.reason
            });
            console.error(`🛑 CIRCUIT BREAKER for user ${userId}`);
            return true;
        }
        return false;
    }

    /**
     * Execute a paper (simulated) trade.
     *
     * UNITS:
     *   `amount`  — base asset quantity (e.g. 0.013 BTC, 21.22 AAVE).
     *               Never USD notional. Caller (riskEngine.getSuggestedTradeSize) is
     *               responsible for converting USD → base units by dividing by price.
     *   `price`   — market price in USD per base unit (e.g. 77000 USD/BTC).
     *   `cost`    — amount × price → USD notional of the trade (before fees/slippage).
     *   `fillPrice` — actual simulated fill price: price × (1 ± PAPER_SLIPPAGE).
     *   `fillCost`  — amount × fillPrice (includes slippage, excludes fee).
     *   `feePaid`   — fillCost × PAPER_TAKER_FEE (0.6% Coinbase Advanced taker fee).
     *   BUY totalCost  = fillCost + feePaid (cash deducted from balance).
     *   SELL netProceeds = fillCost − feePaid (cash added to balance).
     *   `balance` — USD cash remaining. Cannot go negative.
     *   `assetHoldings` — base-unit quantity of the product held. Cannot go negative.
     *
     * PORTFOLIO VALUE = balance + Σ(product.assetHoldings × product._lastPrice)
     */
    executePaperTrade(userId, type, amount, price, reason, productOverride) {
        const user = this._ensureUser(userId);

        // ── Hard input validation — reject non-finite or degenerate inputs ──────
        if (!Number.isFinite(price) || price <= 0) {
            console.warn(`[paper-trade] REJECTED invalid price=${price} for ${userId} ${type}`);
            return false;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            console.warn(`[paper-trade] REJECTED invalid amount=${amount} for ${userId} ${type}`);
            return false;
        }
        if (!['BUY', 'SELL'].includes(type)) {
            console.warn(`[paper-trade] REJECTED unknown type=${type} for ${userId}`);
            return false;
        }
        // Reject implausibly large amounts — from a $100k account, even at $0.01/unit
        // you could only buy 10,000,000 units. More than that is certainly a bug.
        const costEstimate = amount * price;
        if (costEstimate > 200_000) {
            console.warn(`[paper-trade] REJECTED implausible trade: ${type} ${amount} @ $${price} = $${costEstimate.toFixed(2)} for ${userId}`);
            return false;
        }
        // ── End input validation ─────────────────────────────────────────────────

        const balanceBefore = user.paperTradingState.balance;
        const holdingsBefore = (productOverride || user.selectedProduct) === user.selectedProduct
            ? user.paperTradingState.assetHoldings
            : (user.productHoldings[productOverride || user.selectedProduct]?.assetHoldings ?? 0);

        if (this.checkCircuitBreaker(userId, price)) return false;

        const product = productOverride || user.selectedProduct;
        const cost = amount * price;

        // Get per-product holdings (or fall back to main state for selected product)
        let productState;
        if (product === user.selectedProduct) {
            productState = user.paperTradingState;
        } else {
            if (!user.productHoldings[product]) {
                user.productHoldings[product] = { assetHoldings: 0, trades: [], _lastPrice: price };
            }
            productState = user.productHoldings[product];
            // Share the cash balance across products
            productState.balance = user.paperTradingState.balance;
        }

        // Apply realistic fee + slippage simulation
        // BUY: entry price is slightly worse (slippage), total cost includes taker fee
        // SELL: exit price is slightly worse (slippage), net proceeds minus taker fee
        const fillPrice = type === 'BUY'
            ? price * (1 + PAPER_SLIPPAGE)   // filled a bit above mid
            : price * (1 - PAPER_SLIPPAGE);  // filled a bit below mid
        const fillCost = amount * fillPrice;
        const feePaid = fillCost * PAPER_TAKER_FEE;

        if (type === 'BUY') {
            const totalCost = fillCost + feePaid;
            if (user.paperTradingState.balance < totalCost) return false;
            user.paperTradingState.balance -= totalCost;
            productState.assetHoldings += amount;
        } else if (type === 'SELL' && productState.assetHoldings >= amount) {
            const netProceeds = fillCost - feePaid;
            user.paperTradingState.balance += netProceeds;
            productState.assetHoldings -= amount;
        } else {
            return false;
        }

        // Keep last known price for portfolio valuation
        if (product !== user.selectedProduct) {
            user.productHoldings[product]._lastPrice = price;
        }

        const trade = {
            id: Date.now(),
            type,
            amount,
            price: fillPrice,   // realistic fill price includes slippage
            fee: feePaid,
            time: new Date().toISOString(),
            reason,
            product
        };

        if (!productState.trades) productState.trades = [];
        productState.trades.unshift(trade);
        if (productState.trades.length > 500) productState.trades.pop();

        // For selected product, also keep main state in sync
        if (product === user.selectedProduct) {
            // already updated above
        } else {
            // Sync balance back to productState reference
            user.productHoldings[product] = {
                ...user.productHoldings[product],
                assetHoldings: productState.assetHoldings,
                trades: productState.trades,
                _lastPrice: price
            };
        }

        // Sync per-product holdings map for selected product.
        // Filter to product-specific trades only — prevents mixed-product trade arrays
        // from being persisted to productHoldings and corrupting avgBuy in the frontend.
        if (product === user.selectedProduct) {
            user.productHoldings[user.selectedProduct] = {
                assetHoldings: user.paperTradingState.assetHoldings,
                trades: user.paperTradingState.trades.filter(t => t.product === product),
                _lastPrice: price
            };
        }

        // ── Post-trade diagnostic log ────────────────────────────────────────────
        const balanceAfter = user.paperTradingState.balance;
        const holdingsAfter = product === user.selectedProduct
            ? user.paperTradingState.assetHoldings
            : (user.productHoldings[product]?.assetHoldings ?? 0);
        const balanceDelta = balanceAfter - balanceBefore;
        const holdingsDelta = holdingsAfter - holdingsBefore;
        const expectedBalanceDelta = type === 'BUY' ? -(fillCost + feePaid) : (fillCost - feePaid);
        const expectedHoldingsDelta = type === 'BUY' ? amount : -amount;
        const balanceOk = Math.abs(balanceDelta - expectedBalanceDelta) < 0.01;
        const holdingsOk = Math.abs(holdingsDelta - expectedHoldingsDelta) < 0.000001;
        if (!balanceOk || !holdingsOk) {
            console.error(`[paper-trade] ⚠️ INVARIANT VIOLATION for ${userId} ${type} ${amount} ${product} @ $${price}`);
            console.error(`  balance: ${balanceBefore.toFixed(2)} → ${balanceAfter.toFixed(2)} (Δ${balanceDelta.toFixed(2)}, expected ${expectedBalanceDelta.toFixed(2)})`);
            console.error(`  holdings: ${holdingsBefore} → ${holdingsAfter} (Δ${holdingsDelta}, expected ${expectedHoldingsDelta})`);
        } else {
            console.log(`[paper-trade] ${type} ${amount.toFixed(6)} ${product} @ $${price.toFixed(2)} | cash ${balanceBefore.toFixed(2)}→${balanceAfter.toFixed(2)} | qty ${holdingsBefore.toFixed(6)}→${holdingsAfter.toFixed(6)}`);
        }
        // ── End post-trade diagnostic ────────────────────────────────────────────

        // Persist trade to Supabase (fire-and-forget)
        getPersistence().saveTrade(getSupabase(), userId, trade).catch(error => console.warn('saveTrade failed:', error.message));

        // Persist balance + holdings atomically so server restarts don't cause ghost positions
        getPersistence().saveTradeState(
            getSupabase(), userId,
            user.paperTradingState.balance,
            user.paperTradingState.assetHoldings,
            user.productHoldings
        ).catch(error => console.warn('saveTradeState failed:', error.message));

        this.addNotification(userId, {
            type: 'TRADE_EXECUTED',
            title: `${type} Executed`,
            body: `${amount.toFixed(6)} ${product} @ $${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        });

        // Track realized P&L: positive when selling (gain), negative when buying (cost)
        const pnlDelta = type === 'SELL' ? cost : -cost;
        this.updateDailyStats(userId, pnlDelta);

        // Phase 3 LLM Self-Learning: Trigger Autopsy on Sell
        if (type === 'SELL') {
            // Find the most recent buy for this product
            const tradesArr = productState.trades || user.paperTradingState.trades;
            const lastBuy = tradesArr.find(t => t.type === 'BUY' && t.product === product);
            if (lastBuy) {
                const entryPrice = lastBuy.price;
                const pnlPct = ((price - entryPrice) / entryPrice) * 100;

                // Fire and forget the LLM autopsy
                setTimeout(() => {
                    const { performAutopsy } = require('./services/aiEngine');
                    performAutopsy(userId, product, entryPrice, price, pnlPct)
                        .then(lesson => {
                            if (lesson) this.recordLearning(userId, lesson);
                        }).catch(err => console.error('Autopsy background error:', err.message));
                }, 500);
            }
        }

        const newAssetHoldings = product === user.selectedProduct
            ? user.paperTradingState.assetHoldings
            : (user.productHoldings[product]?.assetHoldings ?? 0);

        return {
            ...trade,
            newBalance: user.paperTradingState.balance,
            newAssetHoldings
        };
    }

    recordLearning(userId, lesson) {
        const user = this._ensureUser(userId);
        user.paperTradingState.learningHistory.unshift({
            time: new Date().toISOString(),
            knowledge: lesson
        });
        if (user.paperTradingState.learningHistory.length > 20) {
            user.paperTradingState.learningHistory.pop();
        }
        // Persist learning record (fire-and-forget)
        getPersistence().saveLearning(getSupabase(), userId, lesson).catch(error => console.warn('saveLearning failed:', error.message));
    }

    getProductAssetHoldings(userId, productId) {
        const user = this._ensureUser(userId);
        if (productId === user.selectedProduct) {
            return user.paperTradingState.assetHoldings;
        }
        return user.productHoldings[productId]?.assetHoldings ?? 0;
    }

    // Encryption helpers for persisting keys to Supabase
    static encrypt(text) {
        return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    }

    static decrypt(ciphertext) {
        const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    /**
     * Restore user state from a DB-loaded object (called on WebSocket connect).
     * Only overwrites fields that were actually persisted.
     */
    restoreState(userId, loaded) {
        if (!loaded) return;
        const user = this._ensureUser(userId);

        // API keys
        if (loaded.keys) {
            if (loaded.keys.coinbaseApiKey) user.keys.coinbaseApiKey = loaded.keys.coinbaseApiKey;
            if (loaded.keys.coinbaseApiSecret) user.keys.coinbaseApiSecret = loaded.keys.coinbaseApiSecret;
        }

        // Trading state
        user.paperTradingState.balance = loaded.balance ?? user.paperTradingState.balance;
        user.paperTradingState.assetHoldings = loaded.assetHoldings ?? user.paperTradingState.assetHoldings;
        if (Array.isArray(loaded.trades)) user.paperTradingState.trades = loaded.trades;
        if (Array.isArray(loaded.learningHistory)) user.paperTradingState.learningHistory = loaded.learningHistory;

        // Config
        if (loaded.selectedProduct) user.selectedProduct = loaded.selectedProduct;
        if (loaded.tradingMode) user.tradingMode = loaded.tradingMode;
        if (typeof loaded.isLiveMode === 'boolean') user.isLiveMode = loaded.isLiveMode;
        if (loaded.engineStatus && ENGINE_STATUSES.includes(loaded.engineStatus)) {
            user.engineStatus = loaded.engineStatus;
            user.isLiveMode = loaded.engineStatus === 'LIVE_RUNNING';
            if (user.isLiveMode) user.tradingMode = 'AI_ASSISTED';
        } else if (user.isLiveMode) {
            user.engineStatus = 'LIVE_RUNNING';
            user.tradingMode = 'AI_ASSISTED';
        }
        if (loaded.riskSettings && Object.keys(loaded.riskSettings).length > 0) {
            Object.assign(user.riskSettings, loaded.riskSettings);
            // Always clear absolute price targets on restore — these are per-session values
            // tied to a specific product price. A $2.657 DOGE target must not trigger on BTC.
            user.riskSettings.takeProfitPrice = null;
            user.riskSettings.stopLossPrice = null;
        }
        if (loaded.circuitBreaker && Object.keys(loaded.circuitBreaker).length > 0) {
            Object.assign(user.circuitBreaker, loaded.circuitBreaker);
            // Always clear tripped state on restore — stale circuit breaker should not
            // halt the engine immediately on reconnect. Will re-trip if conditions warrant.
            user.circuitBreaker.tripped = false;
            user.circuitBreaker.reason = '';
            // Enforce minimum 20% threshold — old DB rows may have 5% which is too tight
            if ((user.circuitBreaker.maxDrawdownPercent || 0) < 20) {
                user.circuitBreaker.maxDrawdownPercent = 20.0;
            }
        }
        if (Array.isArray(loaded.strategies) && loaded.strategies.length > 0) {
            user.strategies = loaded.strategies;
        }
        if (loaded.productHoldings && typeof loaded.productHoldings === 'object') {
            user.productHoldings = loaded.productHoldings;
        }

        // ── In-memory corruption guard ───────────────────────────────────────────
        // Run the same sanity check as persistence.js but using in-memory lastPrices
        // (which are more accurate than what was stored in DB). This catches corrupted
        // states that survived the DB auto-heal due to missing _lastPrice values.
        const PRODUCT_FLOOR = {
            'BTC-USD': 20000, 'ETH-USD': 1000, 'BNB-USD': 200,
            'SOL-USD': 20, 'XRP-USD': 0.30, 'ADA-USD': 0.20,
            'DOGE-USD': 0.05, 'SHIB-USD': 0.000005,
        };
        const memHoldingsEstimate = Object.entries(user.productHoldings).reduce((sum, [prod, h]) => {
            if (!h?.assetHoldings) return sum;
            const p = (h._lastPrice > 0) ? h._lastPrice : (PRODUCT_FLOOR[prod] || 0.10);
            return sum + (h.assetHoldings * p);
        }, 0);
        const memPortfolioEstimate = user.paperTradingState.balance + memHoldingsEstimate;
        const memInitialBalance = user.paperTradingState.initialBalance || 100000;
        const memIsCorrupted = memPortfolioEstimate > Math.max(500_000, memInitialBalance * 5) ||
            memHoldingsEstimate > memInitialBalance * 4;
        if (memIsCorrupted) {
            console.warn(`⚠️ In-memory corruption detected for user ${userId} — est. $${memPortfolioEstimate.toFixed(0)} — auto-healing`);
            user.paperTradingState.balance = memInitialBalance;
            user.paperTradingState.assetHoldings = 0;
            user.paperTradingState.trades = [];
            user.productHoldings = {};
        }
        // ── End corruption guard ─────────────────────────────────────────────────

        console.log(`✅ State restored for user ${userId} — balance: $${user.paperTradingState.balance.toFixed(2)}, trades: ${user.paperTradingState.trades.length}`);
    }

    removeUser(userId) {
        this.users.delete(userId);
    }
}

const store = new UserStore();
module.exports = store;
