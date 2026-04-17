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

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET || 'quant-distinction-creative-local-dev-key';
const ENGINE_STATUSES = ['STOPPED', 'PAPER_RUNNING', 'LIVE_RUNNING'];

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
                    geminiApiKey: null
                },
                selectedProduct: 'BTC-USD',
                tradingMode: 'FULL_AUTO',
                isLiveMode: false,
                engineStatus: 'STOPPED',
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
                strategies: [],
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
                circuitBreaker: {
                    tripped: false,
                    maxDrawdownPercent: 5.0,
                    reason: ''
                }
            });
        }
        return this.users.get(userId);
    }

    setKeys(userId, coinbaseKey, coinbaseSecret, geminiKey) {
        const user = this._ensureUser(userId);
        user.keys.coinbaseApiKey = coinbaseKey;
        user.keys.coinbaseApiSecret = coinbaseSecret;
        user.keys.geminiApiKey = geminiKey;
    }

    hasKeys(userId) {
        const user = this.users.get(userId);
        if (!user) return false;
        return !!(user.keys.coinbaseApiKey && user.keys.coinbaseApiSecret && user.keys.geminiApiKey);
    }

    getKeys(userId) {
        const user = this.users.get(userId);
        return user ? user.keys : null;
    }

    getPaperState(userId) {
        const user = this._ensureUser(userId);
        return {
            ...user.paperTradingState,
            selectedProduct: user.selectedProduct,
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

    getSelectedProduct(userId) {
        const user = this._ensureUser(userId);
        return user.selectedProduct;
    }

    setSelectedProduct(userId, productId) {
        const user = this._ensureUser(userId);

        // Save current product's state before switching
        if (user.selectedProduct) {
            user.productHoldings[user.selectedProduct] = {
                assetHoldings: user.paperTradingState.assetHoldings,
                trades: [...user.paperTradingState.trades]
            };
        }

        user.selectedProduct = productId;

        // Restore the new product's state (or start fresh)
        const saved = user.productHoldings[productId];
        user.paperTradingState.assetHoldings = saved?.assetHoldings ?? 0;
        user.paperTradingState.trades = saved?.trades ? [...saved.trades] : [];

        // Reset circuit breaker per-product
        user.circuitBreaker.tripped = false;
        user.circuitBreaker.reason = '';
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

    executePaperTrade(userId, type, amount, price, reason) {
        const user = this._ensureUser(userId);
        if (this.checkCircuitBreaker(userId, price)) return false;

        const cost = amount * price;
        if (type === 'BUY' && user.paperTradingState.balance >= cost) {
            user.paperTradingState.balance -= cost;
            user.paperTradingState.assetHoldings += amount;
        } else if (type === 'SELL' && user.paperTradingState.assetHoldings >= amount) {
            user.paperTradingState.balance += cost;
            user.paperTradingState.assetHoldings -= amount;
        } else {
            return false;
        }

        const trade = {
            id: Date.now(),
            type,
            amount,
            price,
            time: new Date().toISOString(),
            reason,
            product: user.selectedProduct
        };

        user.paperTradingState.trades.unshift(trade);
        if (user.paperTradingState.trades.length > 500) user.paperTradingState.trades.pop();

        // Sync per-product holdings map
        user.productHoldings[user.selectedProduct] = {
            assetHoldings: user.paperTradingState.assetHoldings,
            trades: [...user.paperTradingState.trades]
        };

        // Persist trade to Supabase (fire-and-forget)
        getPersistence().saveTrade(getSupabase(), userId, trade).catch(error => console.warn('saveTrade failed:', error.message));

        this.addNotification(userId, {
            type: 'TRADE_EXECUTED',
            title: `${type} Executed`,
            body: `${amount.toFixed(6)} ${user.selectedProduct} @ $${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        });

        this.updateDailyStats(userId, 0);

        return {
            ...trade,
            newBalance: user.paperTradingState.balance,
            newAssetHoldings: user.paperTradingState.assetHoldings
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
            if (loaded.keys.geminiApiKey) user.keys.geminiApiKey = loaded.keys.geminiApiKey;
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
        }
        if (loaded.circuitBreaker && Object.keys(loaded.circuitBreaker).length > 0) {
            Object.assign(user.circuitBreaker, loaded.circuitBreaker);
        }
        if (Array.isArray(loaded.strategies) && loaded.strategies.length > 0) {
            user.strategies = loaded.strategies;
        }
        if (loaded.productHoldings && typeof loaded.productHoldings === 'object') {
            user.productHoldings = loaded.productHoldings;
        }

        console.log(`✅ State restored for user ${userId} — balance: $${user.paperTradingState.balance.toFixed(2)}, trades: ${user.paperTradingState.trades.length}`);
    }

    removeUser(userId) {
        this.users.delete(userId);
    }
}

const store = new UserStore();
module.exports = store;
