const WebSocket = require('ws');
const { evaluateMarketSignal } = require('./aiEngine');
const userStore = require('../userStore');
const { checkTradeAllowed, getSuggestedTradeSize } = require('./riskEngine');

const MARKET_WS_URL = process.env.MARKET_WS_URL || 'wss://advanced-trade-ws.coinbase.com';

const SUPPORTED_PRODUCTS = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD',
    'ADA-USD', 'AVAX-USD', 'MATIC-USD', 'LINK-USD', 'DOT-USD',
    'LTC-USD', 'UNI-USD', 'ATOM-USD', 'NEAR-USD', 'FIL-USD'
];
module.exports.SUPPORTED_PRODUCTS = SUPPORTED_PRODUCTS;

const productData = new Map();

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

/**
 * Execute a real Coinbase order and mirror the result into the paper state
 * so the portfolio page stays in sync.
 */
async function executeLiveOrder(userId, action, amount, price, productId, reasoning, broadcastFn) {
    const keys = userStore.getKeys(userId);
    if (!keys?.coinbaseApiKey || !keys?.coinbaseApiSecret) {
        broadcastFn('AI_STATUS', '⚠️ Live mode: Coinbase API keys missing');
        userStore.addNotification(userId, {
            type: 'CIRCUIT_BREAKER',
            title: 'Live Order Blocked',
            body: 'Coinbase API keys not found. Check Setup.'
        });
        broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
        return;
    }

    try {
        const { placeMarketOrder } = require('./liveTrading');
        broadcastFn('AI_STATUS', `Placing live ${action} order on Coinbase…`);
        const result = await placeMarketOrder(keys.coinbaseApiKey, keys.coinbaseApiSecret, action, amount, productId);

        if (result.status === 'FILLED') {
            const fillPrice = result.avgFillPrice || price;
            const fillSize = result.filledSize || amount;
            // Mirror into paper state for portfolio tracking
            userStore.executePaperTrade(userId, action, fillSize, fillPrice, `[LIVE] ${reasoning}`);
            broadcastFn('TRADE_EXEC', {
                type: action,
                amount: fillSize,
                price: fillPrice,
                product: productId,
                orderId: result.orderId,
                isLive: true,
                newBalance: userStore.getPaperState(userId).balance,
                newAssetHoldings: userStore.getPaperState(userId).assetHoldings
            });
            userStore.addNotification(userId, {
                type: 'TRADE_EXECUTED',
                title: `[LIVE] ${action} Filled`,
                body: `Order ${result.orderId} — ${fillSize.toFixed(6)} ${productId} @ $${fillPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            });
            broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
        } else {
            broadcastFn('AI_STATUS', `Live order status: ${result.status}`);
        }
    } catch (err) {
        console.error('Live order error:', err.message);
        broadcastFn('AI_STATUS', `Live order failed: ${err.message}`);
        userStore.addNotification(userId, {
            type: 'CIRCUIT_BREAKER',
            title: 'Live Order Failed',
            body: err.message
        });
        broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
    }
}

module.exports.executeLiveOrder = executeLiveOrder;

function startUserStream(userId, broadcastFn, initialProduct) {
    ensureMarketConnection();

    let activeProduct = initialProduct || userStore.getSelectedProduct(userId) || 'BTC-USD';

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

        broadcastFn('TICK', {
            price: data.price,
            product: activeProduct,
            time: new Date().toLocaleTimeString()
        });

        const user = userStore._ensureUser(userId);

        if (user.killSwitch || user.circuitBreaker.tripped) {
            const reason = user.killSwitchReason || user.circuitBreaker.reason;
            broadcastFn('KILL_SWITCH_ALERT', { reason });
            broadcastFn('AI_STATUS', `🛑 Halted: ${reason}`);
            return;
        }

        const now = Date.now();
        if (userStore.hasKeys(userId) && data.history.length >= 20 && (now - lastAiEvalTime > 30000)) {
            lastAiEvalTime = now;
            broadcastFn('AI_STATUS', `Analyzing ${activeProduct} market structure…`);

            const decision = await evaluateMarketSignal(userId, [...data.history], activeProduct);

            if (decision && decision.action !== 'HOLD' && decision.confidence > 70) {
                const suggestedAmount = getSuggestedTradeSize(userId, data.price);
                const amountToTrade = decision.position_size_override || suggestedAmount;

                const riskCheck = checkTradeAllowed(userId, decision.action, amountToTrade, data.price, data.history);

                if (!riskCheck.allowed) {
                    broadcastFn('AI_STATUS', `Risk block: ${riskCheck.reason}`);
                    userStore.addNotification(userId, {
                        type: 'AI_SIGNAL',
                        title: `${decision.action} Blocked`,
                        body: riskCheck.reason
                    });
                    broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
                } else {
                    const finalAmount = riskCheck.adjustedAmount || amountToTrade;
                    const currentUser = userStore._ensureUser(userId);

                    if (currentUser.tradingMode === 'AI_ASSISTED') {
                        const pendingTrade = {
                            tradeId: Date.now(),
                            side: decision.action,
                            amount: finalAmount,
                            price: data.price,
                            product: activeProduct,
                            reasoning: decision.reasoning,
                            confidence: decision.confidence,
                            signals: decision.signals,
                            isLive: currentUser.isLiveMode,
                            expiresAt: Date.now() + 60000
                        };
                        userStore.setPendingTrade(userId, pendingTrade);
                        broadcastFn('PENDING_TRADE', pendingTrade);
                        broadcastFn('AI_STATUS', `Awaiting your confirmation: ${decision.action} ${activeProduct}`);
                    } else if (currentUser.isLiveMode) {
                        // Live Full Auto execution
                        await executeLiveOrder(userId, decision.action, finalAmount, data.price, activeProduct, decision.reasoning, broadcastFn);
                    } else {
                        // Paper Full Auto execution
                        const executed = userStore.executePaperTrade(
                            userId, decision.action, finalAmount, data.price, decision.reasoning
                        );

                        if (executed) {
                            broadcastFn('TRADE_EXEC', executed);
                            const notif = userStore.getNotifications(userId)[0];
                            broadcastFn('NOTIFICATION', notif);
                        }
                    }
                }
            }

            broadcastFn('STRATEGY_UPDATE', userStore.getStrategies(userId));
            broadcastFn('AI_STATUS', `Monitoring ${activeProduct} positions…`);
        }
    }, 2000);

    return {
        cleanup: () => clearInterval(interval),
        setProduct
    };
}

module.exports = { startUserStream, ensureMarketConnection, SUPPORTED_PRODUCTS };
