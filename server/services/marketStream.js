const WebSocket = require('ws');
const { evaluateMarketSignal } = require('./aiEngine');
const userStore = require('../userStore');

const MARKET_WS_URL = process.env.MARKET_WS_URL || 'wss://advanced-trade-ws.coinbase.com';

// Supported Coinbase products
const SUPPORTED_PRODUCTS = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD',
    'ADA-USD', 'AVAX-USD', 'MATIC-USD', 'LINK-USD', 'DOT-USD',
    'LTC-USD', 'UNI-USD', 'ATOM-USD', 'NEAR-USD', 'FIL-USD'
];
module.exports.SUPPORTED_PRODUCTS = SUPPORTED_PRODUCTS;

// Per-product price data: Map<productId, { price: number, history: number[] }>
const productData = new Map();

// Shared Coinbase WebSocket — one connection, subscribed to all products
let marketWs = null;
let isSubscribed = false;

function getProductData(productId) {
    if (!productData.has(productId)) {
        productData.set(productId, { price: 0, history: [] });
    }
    return productData.get(productId);
}

function handleTickerMessage(message) {
    const events = Array.isArray(message.events) ? message.events : [];
    for (const event of events) {
        const tickers = Array.isArray(event.tickers) ? event.tickers : [];
        for (const ticker of tickers) {
            const price = Number.parseFloat(ticker?.price);
            const productId = ticker?.product_id;
            if (!productId || !Number.isFinite(price) || price <= 0) continue;

            const data = getProductData(productId);
            data.price = price;
            data.history.push(price);
            if (data.history.length > 100) data.history.shift();
        }
    }
}

function subscribeToAllProducts() {
    if (!marketWs || marketWs.readyState !== WebSocket.OPEN) return;
    marketWs.send(JSON.stringify({
        type: 'subscribe',
        product_ids: SUPPORTED_PRODUCTS,
        channel: 'ticker'
    }));
    marketWs.send(JSON.stringify({
        type: 'subscribe',
        product_ids: SUPPORTED_PRODUCTS,
        channel: 'heartbeats'
    }));
    isSubscribed = true;
    console.log(`📡 Subscribed to ${SUPPORTED_PRODUCTS.length} Coinbase products`);
}

function ensureMarketConnection() {
    if (marketWs && marketWs.readyState === WebSocket.OPEN) {
        if (!isSubscribed) subscribeToAllProducts();
        return;
    }

    console.log('📡 Connecting to Coinbase Advanced Trade stream...');
    isSubscribed = false;
    marketWs = new WebSocket(MARKET_WS_URL);

    marketWs.on('open', subscribeToAllProducts);

    marketWs.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            if (message.channel === 'ticker') {
                handleTickerMessage(message);
            }
        } catch (error) {
            console.error('Market WS parse error:', error.message);
        }
    });

    marketWs.on('error', (err) => console.error('Market WS Error:', err.message));
    marketWs.on('close', () => {
        marketWs = null;
        isSubscribed = false;
        console.log('Market WS closed. Reconnecting in 5s...');
        setTimeout(ensureMarketConnection, 5000);
    });
}

// Per-user streaming: ticks + AI evaluation for the user's selected product
function startUserStream(userId, broadcastFn, initialProduct) {
    ensureMarketConnection();

    // Allow dynamic product switching per user
    let activeProduct = initialProduct || userStore.getSelectedProduct(userId) || 'BTC-USD';

    // Expose a way for the server to change the product for this user
    const setProduct = (productId) => {
        if (SUPPORTED_PRODUCTS.includes(productId)) {
            activeProduct = productId;
            userStore.setSelectedProduct(userId, productId);
        }
    };

    let lastAiEvalTime = 0;

    const interval = setInterval(async () => {
        const data = getProductData(activeProduct);
        if (data.price <= 0) return;

        // Send price tick for the user's active product
        broadcastFn('TICK', {
            price: data.price,
            product: activeProduct,
            time: new Date().toLocaleTimeString()
        });

        const now = Date.now();
        // Run AI every 30s if this user has keys and enough price history
        if (userStore.hasKeys(userId) && data.history.length >= 20 && (now - lastAiEvalTime > 30000)) {
            lastAiEvalTime = now;
            broadcastFn('AI_STATUS', `Analyzing ${activeProduct} market structure…`);

            const decision = await evaluateMarketSignal(userId, [...data.history], activeProduct);

            if (decision && decision.action !== 'HOLD' && decision.confidence > 70) {
                const amountToTrade = 0.05;
                const executed = userStore.executePaperTrade(
                    userId, decision.action, amountToTrade, data.price, decision.reasoning
                );

                if (executed) {
                    broadcastFn('TRADE_EXEC', executed);
                }
            }

            broadcastFn('AI_STATUS', `Monitoring ${activeProduct} positions…`);
        }
    }, 2000);

    // Return cleanup + product setter
    return {
        cleanup: () => clearInterval(interval),
        setProduct
    };
}

module.exports = { startUserStream, ensureMarketConnection, SUPPORTED_PRODUCTS };
