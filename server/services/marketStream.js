const WebSocket = require('ws');
const { evaluateMarketSignal } = require('./aiEngine');
const memoryStore = require('../memoryStore');

function startMarketStream(broadcastFn) {
    // using public binance stream for live functional unauthenticated data
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade');
    
    let priceHistory = [];
    let lastAiEvalTime = 0;

    ws.on('message', async (data) => {
        const trade = JSON.parse(data);
        const price = parseFloat(trade.p);
        
        priceHistory.push(price);
        if (priceHistory.length > 50) priceHistory.shift();

        // Broadcast live price to frontend
        broadcastFn('TICK', {
            price,
            time: new Date().toLocaleTimeString()
        });

        const now = Date.now();
        // Run AI every 30 seconds if backend is configured
        if (memoryStore.hasKeys() && priceHistory.length >= 20 && (now - lastAiEvalTime > 30000)) {
            lastAiEvalTime = now;
            broadcastFn('AI_STATUS', 'Analyzing market structure...');
            
            const decision = await evaluateMarketSignal(priceHistory);
            
            if (decision && decision.action !== 'HOLD' && decision.confidence > 70) {
                // Execute paper trade
                const amountToTrade = 0.05; // fixed size for V1
                const executed = memoryStore.executePaperTrade(decision.action, amountToTrade, price, decision.reasoning);
                
                if (executed) {
                    broadcastFn('TRADE_EXEC', executed);
                }
            }
            
            broadcastFn('AI_STATUS', 'Monitoring positions...');
        }
    });

    ws.on('error', (err) => console.error("WS Error:", err));
}

module.exports = { startMarketStream };
