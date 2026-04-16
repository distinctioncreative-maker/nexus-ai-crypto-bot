const WebSocket = require('ws');
const { evaluateMarketSignal } = require('./aiEngine');
const userStore = require('../userStore');

// Shared Binance WebSocket — one connection for all users
let binanceWs = null;
let priceHistory = [];
let currentPrice = 0;

function ensureBinanceConnection() {
    if (binanceWs && binanceWs.readyState === WebSocket.OPEN) return;

    console.log("📡 Connecting to Binance BTC/USDT stream...");
    binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade');

    binanceWs.on('message', (data) => {
        const trade = JSON.parse(data);
        currentPrice = parseFloat(trade.p);

        priceHistory.push(currentPrice);
        if (priceHistory.length > 50) priceHistory.shift();
    });

    binanceWs.on('error', (err) => console.error("Binance WS Error:", err.message));
    binanceWs.on('close', () => {
        console.log("Binance WS closed. Reconnecting in 5s...");
        setTimeout(ensureBinanceConnection, 5000);
    });
}

// Per-user streaming: ticks + AI evaluation
function startUserStream(userId, broadcastFn) {
    ensureBinanceConnection();

    let lastAiEvalTime = 0;

    const interval = setInterval(async () => {
        if (currentPrice <= 0) return;

        // Always send price ticks to this user's frontend
        broadcastFn('TICK', {
            price: currentPrice,
            time: new Date().toLocaleTimeString()
        });

        const now = Date.now();
        // Run this user's AI every 30s if they have keys configured
        if (userStore.hasKeys(userId) && priceHistory.length >= 20 && (now - lastAiEvalTime > 30000)) {
            lastAiEvalTime = now;
            broadcastFn('AI_STATUS', 'Analyzing market structure...');

            const decision = await evaluateMarketSignal(userId, [...priceHistory]);

            if (decision && decision.action !== 'HOLD' && decision.confidence > 70) {
                const amountToTrade = 0.05;
                const executed = userStore.executePaperTrade(userId, decision.action, amountToTrade, currentPrice, decision.reasoning);

                if (executed) {
                    broadcastFn('TRADE_EXEC', executed);
                }
            }

            broadcastFn('AI_STATUS', 'Monitoring positions...');
        }
    }, 2000); // Tick every 2 seconds

    // Return cleanup function
    return () => clearInterval(interval);
}

module.exports = { startUserStream, ensureBinanceConnection };
