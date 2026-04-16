// Secure In-Memory Store
// Keys stored here are destroyed when the node process stops.

class MemoryStore {
    constructor() {
        this.keys = {
            coinbaseApiKey: null,
            coinbaseApiSecret: null,
            geminiApiKey: null
        };
        this.paperTradingState = {
            initalBalance: 100000.00,
            balance: 100000.00, // Virtual cash
            btcHoldings: 0,
            trades: [],
            learningHistory: []
        };
        this.circuitBreaker = {
            tripped: false,
            maxDrawdownPercent: 5.0, // Hard stop if portfolio drops 5% below initial
            reason: ""
        };
    }

    setKeys(coinbaseKey, coinbaseSecret, geminiKey) {
        this.keys.coinbaseApiKey = coinbaseKey;
        this.keys.coinbaseApiSecret = coinbaseSecret;
        this.keys.geminiApiKey = geminiKey;
    }

    hasKeys() {
        return !!(this.keys.coinbaseApiKey && this.keys.coinbaseApiSecret && this.keys.geminiApiKey);
    }

    getKeys() {
        return this.keys;
    }

    getPaperState() {
        return {
            ...this.paperTradingState,
            circuitBreaker: this.circuitBreaker
        };
    }

    checkCircuitBreaker(currentPrice) {
        if (this.circuitBreaker.tripped) return true;
        
        const totalValue = this.paperTradingState.balance + (this.paperTradingState.btcHoldings * currentPrice);
        const drawdown = ((this.paperTradingState.initalBalance - totalValue) / this.paperTradingState.initalBalance) * 100;
        
        if (drawdown >= this.circuitBreaker.maxDrawdownPercent) {
            this.circuitBreaker.tripped = true;
            this.circuitBreaker.reason = `HARD STOP: ${drawdown.toFixed(2)}% Drawdown detected. Exceeds ${this.circuitBreaker.maxDrawdownPercent}% limit. AI Execution Halted.`;
            this.recordLearning(this.circuitBreaker.reason);
            console.error("🛑 CIRCUIT BREAKER TRIPPED! TRADING HALTED.");
            return true;
        }
        return false;
    }

    executePaperTrade(type, amount, price, reason) {
        if (this.checkCircuitBreaker(price)) {
            return false; // Blocked by circuit breaker
        }

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
        if (this.paperTradingState.trades.length > 50) this.paperTradingState.trades.pop();
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
