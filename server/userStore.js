// Per-User Isolated State Store
// Each authenticated user gets their own sandboxed trading environment.
// Keys are encrypted before being saved to Supabase Postgres.

const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET || 'quant-distinction-creative-local-dev-key';

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
                paperTradingState: {
                    initialBalance: 100000.00,
                    balance: 100000.00,
                    assetHoldings: 0,
                    trades: [],
                    learningHistory: []
                },
                circuitBreaker: {
                    tripped: false,
                    maxDrawdownPercent: 5.0,
                    reason: ""
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
            circuitBreaker: user.circuitBreaker
        };
    }

    getSelectedProduct(userId) {
        const user = this._ensureUser(userId);
        return user.selectedProduct;
    }

    setSelectedProduct(userId, productId) {
        const user = this._ensureUser(userId);
        user.selectedProduct = productId;
        // Reset holdings when switching instruments (clean paper trading slate)
        user.paperTradingState.assetHoldings = 0;
        user.paperTradingState.trades = [];
        user.circuitBreaker.tripped = false;
        user.circuitBreaker.reason = '';
    }

    checkCircuitBreaker(userId, currentPrice) {
        const user = this._ensureUser(userId);
        if (user.circuitBreaker.tripped) return true;

        const totalValue = user.paperTradingState.balance + (user.paperTradingState.assetHoldings * currentPrice);
        const drawdown = ((user.paperTradingState.initialBalance - totalValue) / user.paperTradingState.initialBalance) * 100;

        if (drawdown >= user.circuitBreaker.maxDrawdownPercent) {
            user.circuitBreaker.tripped = true;
            user.circuitBreaker.reason = `HARD STOP: ${drawdown.toFixed(2)}% Drawdown. AI Halted.`;
            this.recordLearning(userId, user.circuitBreaker.reason);
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
        if (user.paperTradingState.trades.length > 50) user.paperTradingState.trades.pop();

        // Return trade with updated portfolio state for frontend sync
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
    }

    // Encryption helpers for persisting keys to Supabase
    static encrypt(text) {
        return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    }

    static decrypt(ciphertext) {
        const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    removeUser(userId) {
        this.users.delete(userId);
    }
}

const store = new UserStore();
module.exports = store;
