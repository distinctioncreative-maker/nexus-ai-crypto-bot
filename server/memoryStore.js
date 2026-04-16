// Secure In-Memory Store
// Keys stored here are destroyed when the node process stops.
// This prevents keys from sitting idle on a hard drive.

class MemoryStore {
    constructor() {
        this.keys = {
            coinbaseApiKey: null,
            coinbaseApiSecret: null,
            openAiApiKey: null
        };
        this.paperTradingState = {
            balance: 100000.00, // Start with $100k virtual cash
            btcHoldings: 0,
            trades: [],
            learningHistory: [] // AI Auto-Enhancing memory map
        };
    }

    setKeys(coinbaseKey, coinbaseSecret, openAiKey) {
        this.keys.coinbaseApiKey = coinbaseKey;
        this.keys.coinbaseApiSecret = coinbaseSecret;
        this.keys.openAiApiKey = openAiKey;
    }

    hasKeys() {
        return !!(this.keys.coinbaseApiKey && this.keys.coinbaseApiSecret && this.keys.openAiApiKey);
    }

    getKeys() {
        return this.keys;
    }

    getPaperState() {
        return this.paperTradingState;
    }

    executePaperTrade(type, amount, price, reason) {
        const cost = amount * price;
        if (type === 'BUY' && this.paperTradingState.balance >= cost) {
            this.paperTradingState.balance -= cost;
            this.paperTradingState.btcHoldings += amount;
        } else if (type === 'SELL' && this.paperTradingState.btcHoldings >= amount) {
            this.paperTradingState.balance += cost;
            this.paperTradingState.btcHoldings -= amount;
        } else {
            return false; // Insufficient funds/holdings
        }

        const trade = { 
            id: Date.now(), 
            type, 
            amount, 
            price, 
            time: new Date().toISOString(),
            reason 
        };
        
        this.paperTradingState.trades.unshift(trade);
        
        // Keep last 50 trades in memory
        if (this.paperTradingState.trades.length > 50) {
            this.paperTradingState.trades.pop();
        }

        return trade;
    }

    recordLearning(lesson) {
        this.paperTradingState.learningHistory.unshift({
            time: new Date().toISOString(),
            knowledge: lesson
        });
        if (this.paperTradingState.learningHistory.length > 20) {
             this.paperTradingState.learningHistory.pop();
        }
    }
}

const store = new MemoryStore();
module.exports = store;
