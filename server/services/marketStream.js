const WebSocket = require('ws');
const { evaluateMarketSignal } = require('./aiEngine');
const userStore = require('../userStore');

const MARKET_WS_URL = process.env.MARKET_WS_URL || 'wss://advanced-trade-ws.coinbase.com';
const MARKET_PRODUCT_ID = process.env.MARKET_PRODUCT_ID || 'BTC-USD';

// Shared public market WebSocket — one connection for all users.
let marketWs = null;
let priceHistory = [];
let currentPrice = 0;

function handleTickerMessage(message) {
    const events = Array.isArray(message.events) ? message.events : [];
    for (const event of events) {
        const tickers = Array.isArray(event.tickers) ? event.tickers : [];
        const ticker = tickers.find((item) => item.product_id === MARKET_PRODUCT_ID) || tickers[0];
        const price = Number.parseFloat(ticker?.price);

        if (Number.isFinite(price) && price > 0) {
            currentPrice = price;
            priceHistory.push(currentPrice);
            if (priceHistory.length > 50) priceHistory.shift();
        }
    }
}

function subscribeToMarketData() {
    marketWs.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [MARKET_PRODUCT_ID],
        channel: 'ticker'
    }));

    marketWs.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [MARKET_PRODUCT_ID],
        channel: 'heartbeats'
    }));
}

function ensureMarketConnection() {
    if (marketWs && marketWs.readyState === WebSocket.OPEN) return;

    console.log(`📡 Connecting to Coinbase ${MARKET_PRODUCT_ID} stream...`);
    marketWs = new WebSocket(MARKET_WS_URL);

    marketWs.on('open', subscribeToMarketData);

    marketWs.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            if (message.channel === 'ticker') {
                handleTickerMessage(message);
            }
        } catch (error) {
            console.error("Market WS parse error:", error.message);
        }
    });

    marketWs.on('error', (err) => console.error("Market WS Error:", err.message));
    marketWs.on('close', () => {
        marketWs = null;
        console.log("Market WS closed. Reconnecting in 5s...");
        setTimeout(ensureMarketConnection, 5000);
    });
}

// Per-user streaming: ticks + AI evaluation
function startUserStream(userId, broadcastFn) {
    ensureMarketConnection();

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

module.exports = { startUserStream, ensureMarketConnection };
