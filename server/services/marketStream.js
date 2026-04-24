const WebSocket = require('ws');
const axios = require('axios');
const { evaluateMarketSignal } = require('./aiEngine');
const userStore = require('../userStore');
const { checkTradeAllowed, getSuggestedTradeSize } = require('./riskEngine');
const { FALLBACK_PRODUCTS, isSupportedProduct } = require('./productCatalog');
const { openPosition, checkPositions, closePosition, defaultTpConfig } = require('./positionManager');

// Public Coinbase Exchange WebSocket — no auth required for ticker data
const MARKET_WS_URL = process.env.MARKET_WS_URL || 'wss://ws-feed.exchange.coinbase.com';

const SUPPORTED_PRODUCTS = FALLBACK_PRODUCTS.map(product => product.id);
module.exports.SUPPORTED_PRODUCTS = SUPPORTED_PRODUCTS;

const productData = new Map();

let marketWs = null;
let isSubscribed = false;
let reconnectDelay = 5000; // exponential backoff, resets on successful subscription

function getProductData(productId) {
    if (!productData.has(productId)) {
        productData.set(productId, { price: 0, history: [], candles: [] });
    }
    return productData.get(productId);
}

/**
 * Handle ticker messages from the public Coinbase Exchange WS.
 * Public feed format: { type: 'ticker', product_id, price, ... }
 */
function handleTickerMessage(message) {
    // Process ticker value
    let price = 0;
    let productId = null;

    if (message.type === 'ticker' && message.product_id) {
        price = Number.parseFloat(message.price);
        productId = message.product_id;
    } else {
        const events = Array.isArray(message.events) ? message.events : [];
        for (const event of events) {
            const tickers = Array.isArray(event.tickers) ? event.tickers : [];
            for (const ticker of tickers) {
                if (ticker && ticker.product_id && ticker.price) {
                    price = Number.parseFloat(ticker.price);
                    productId = ticker.product_id;
                    break;
                }
            }
            if (productId) break;
        }
    }

    if (!productId || !Number.isFinite(price) || price <= 0) return;

    const data = getProductData(productId);
    data.price = price;
    data.history.push(price);
    if (data.history.length > 200) data.history.shift();

    // Update ongoing 1M candle for the LLM
    const nowSecs = Math.floor(Date.now() / 1000);
    const minuteTime = nowSecs - (nowSecs % 60);

    if (data.candles.length === 0 || data.candles[data.candles.length - 1].time < minuteTime) {
        // New minute: open = current price, track OHLCV
        data.candles.push({ time: minuteTime, open: price, high: price, low: price, value: price, volume: 0 });
    } else {
        // Update OHLCV for the current minute
        const c = data.candles[data.candles.length - 1];
        c.high = Math.max(c.high, price);
        c.low = Math.min(c.low, price);
        c.value = price; // close
    }

    if (data.candles.length > 300) data.candles.shift();
}

function subscribeToAllProducts() {
    if (!marketWs || marketWs.readyState !== WebSocket.OPEN) return;
    // Public Exchange WS uses 'subscribe' with 'channels' array
    marketWs.send(JSON.stringify({
        type: 'subscribe',
        product_ids: SUPPORTED_PRODUCTS,
        channels: ['ticker', 'heartbeat']
    }));
    isSubscribed = true;
    reconnectDelay = 5000; // reset backoff on successful subscribe
    console.log(`📡 Subscribed to ${SUPPORTED_PRODUCTS.length} products via public Coinbase feed`);
}

function broadcastEngineState(userId, broadcastFn) {
    broadcastFn('ENGINE_STATE', userStore.getEngineState(userId));
}

function ensureMarketConnection() {
    if (marketWs && marketWs.readyState === WebSocket.OPEN) {
        if (!isSubscribed) subscribeToAllProducts();
        return;
    }

    console.log('📡 Connecting to public Coinbase Exchange stream...');
    isSubscribed = false;
    marketWs = new WebSocket(MARKET_WS_URL);

    marketWs.on('open', subscribeToAllProducts);

    marketWs.on('message', (raw) => {
        try {
            const message = JSON.parse(raw);
            if (message.type === 'ticker' || message.channel === 'ticker') {
                handleTickerMessage(message);
            }
        } catch (error) {
            console.error('Market WS parse error:', error.message);
        }
    });

    marketWs.on('error', (err) => console.error('Market WS Error:', err.message));
    marketWs.on('close', (code, reason) => {
        marketWs = null;
        isSubscribed = false;
        const reasonStr = reason?.toString() || 'no reason';
        console.log(`Market WS closed (code=${code}, reason=${reasonStr}). Reconnecting in ${reconnectDelay / 1000}s...`);
        setTimeout(ensureMarketConnection, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 60000); // cap at 60s
    });
}

/**
 * Fetch 300 historical 1-minute candles from the public Coinbase Exchange REST API.
 * Returns array of { time, value } suitable for lightweight-charts.
 */
async function fetchHistoricalCandles(productId) {
    try {
        // Public endpoint — no auth required
        const end = new Date();
        const start = new Date(end.getTime() - 300 * 60 * 1000); // 300 minutes ago
        const url = `https://api.exchange.coinbase.com/products/${productId}/candles?granularity=60&start=${start.toISOString()}&end=${end.toISOString()}`;
        const res = await axios.get(url, { timeout: 8000 });
        if (!Array.isArray(res.data) || res.data.length === 0) return [];

        // Coinbase returns [timestamp, low, high, open, close, volume] newest-first
        const candles = res.data
            .map(c => ({ time: c[0], low: c[1], high: c[2], open: c[3], value: c[4], volume: c[5] || 0 }))
            .filter(c => Number.isFinite(c.time) && Number.isFinite(c.value) && c.value > 0)
            .sort((a, b) => a.time - b.time);

        return candles;
    } catch (err) {
        console.warn(`Historical candles fetch failed for ${productId}:`, err.message);
        return [];
    }
}

/**
 * Execute a real Coinbase order and mirror the result into the paper state
 * so the portfolio page stays in sync.
 */
async function executeLiveOrder(userId, action, amount, price, productId, reasoning, broadcastFn) {
    if (!(await isSupportedProduct(productId))) {
        broadcastFn('AI_STATUS', `Live order blocked: unsupported Coinbase product ${productId}`);
        return { executed: false, error: 'Unsupported Coinbase product' };
    }

    const keys = userStore.getKeys(userId);
    if (!keys?.coinbaseApiKey || !keys?.coinbaseApiSecret) {
        broadcastFn('AI_STATUS', '⚠️ Live mode: Coinbase API keys missing');
        userStore.addNotification(userId, {
            type: 'CIRCUIT_BREAKER',
            title: 'Live Order Blocked',
            body: 'Coinbase API keys not found. Check Setup.'
        });
        broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
        return { executed: false, error: 'Coinbase API keys missing' };
    }

    try {
        const { placeMarketOrder } = require('./liveTrading');
        broadcastFn('AI_STATUS', `Placing live ${action} order on Coinbase…`);
        const result = await placeMarketOrder(keys.coinbaseApiKey, keys.coinbaseApiSecret, action, amount, productId, price);

        if (result.status === 'FILLED' || result.status === 'OPEN' || result.status === 'PENDING') {
            const fillPrice = result.avgFillPrice || price;
            const fillSize = result.filledSize || amount;
            // Mirror into paper state for portfolio tracking
            const mirroredTrade = result.status === 'FILLED'
                ? userStore.executePaperTrade(userId, action, fillSize, fillPrice, `[LIVE:${result.orderId}] ${reasoning}`)
                : null;
            const tradePayload = {
                type: action,
                amount: fillSize,
                price: fillPrice,
                product: productId,
                orderId: result.orderId,
                status: result.status,
                isLive: true,
                newBalance: userStore.getPaperState(userId).balance,
                newAssetHoldings: userStore.getPaperState(userId).assetHoldings,
                time: new Date().toISOString(),
                reason: `[LIVE:${result.orderId || 'pending'}] ${reasoning}`
            };
            broadcastFn('TRADE_EXEC', mirroredTrade || tradePayload);
            userStore.addNotification(userId, {
                type: 'TRADE_EXECUTED',
                title: `[LIVE] ${action} ${result.status}`,
                body: `Order ${result.orderId || 'pending'} — ${fillSize.toFixed(6)} ${productId} @ ${fillPrice ? `$${fillPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'pending fill'}`
            });
            broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
            return { executed: result.status === 'FILLED', trade: mirroredTrade || tradePayload, order: result };
        } else {
            broadcastFn('AI_STATUS', `Live order status: ${result.status}`);
            return { executed: false, order: result };
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
        return { executed: false, error: err.message };
    }
}

module.exports.executeLiveOrder = executeLiveOrder;

function startUserStream(userId, broadcastFn, initialProduct) {
    ensureMarketConnection();

    let activeProduct = initialProduct || userStore.getSelectedProduct(userId) || 'BTC-USD';

    const setProduct = async (productId) => {
        if (!(await isSupportedProduct(productId))) {
            broadcastFn('AI_STATUS', `Unsupported Coinbase USD spot product: ${productId}`);
            return false;
        }
        activeProduct = productId;
        userStore.setSelectedProduct(userId, productId);
        // If this product isn't in our subscription list, subscribe to it now
        if (!SUPPORTED_PRODUCTS.includes(productId) && marketWs && marketWs.readyState === WebSocket.OPEN) {
            marketWs.send(JSON.stringify({
                type: 'subscribe',
                product_ids: [productId],
                channels: ['ticker']
            }));
            // Register it for future reconnects
            SUPPORTED_PRODUCTS.push(productId);
        }
        // Send historical candles for the new product
        fetchHistoricalCandles(productId).then(candles => {
            if (candles.length > 0) {
                broadcastFn('CANDLE_HISTORY', candles);
                // Seed the candles for AI evaluation
                const data = getProductData(productId);
                data.candles = [...candles];
                const closes = candles.slice(-100).map(c => c.value);
                data.history = closes;
                data.price = closes[closes.length - 1];
            }
        }).catch(() => {});
        return true;
    };

    let lastAiEvalTime = 0;
    setProduct(activeProduct).then(() => broadcastEngineState(userId, broadcastFn));

    const interval = setInterval(async () => {
        const data = getProductData(activeProduct);
        if (data.price <= 0) return;

        broadcastFn('TICK', {
            price: data.price,
            product: activeProduct,
            time: new Date().toLocaleTimeString()
        });

        // Send live prices for all held products so Portfolio page shows multi-asset P&L
        const userHoldings = userStore._ensureUser(userId).productHoldings;
        const heldProducts = Object.keys(userHoldings).filter(p =>
            p !== activeProduct && (userHoldings[p]?.assetHoldings || 0) > 0
        );
        if (heldProducts.length > 0) {
            const holdingPrices = {};
            for (const p of heldProducts) {
                const pData = getProductData(p);
                if (pData.price > 0) holdingPrices[p] = pData.price;
            }
            if (Object.keys(holdingPrices).length > 0) {
                broadcastFn('HOLDINGS_PRICES', holdingPrices);
            }
        }

        const user = userStore._ensureUser(userId);
        const engine = userStore.getEngineState(userId);

        // SmartTrade: check multi-TP and trailing stop on every tick
        if (engine.engineStatus !== 'STOPPED') {
            checkPositions(userId, activeProduct, data.price,
                (amount, price, reason) => {
                    // Re-read engine state fresh — user may have toggled since interval started
                    const currentEngine = userStore.getEngineState(userId);
                    if (currentEngine.engineStatus === 'LIVE_RUNNING') {
                        // Queue as pending trade for live confirmation
                        const pendingTrade = buildPendingTrade('SELL', amount, price, activeProduct, reason, 100, null, true);
                        userStore.setPendingTrade(userId, pendingTrade);
                        broadcastFn('PENDING_TRADE', pendingTrade);
                        return { amount, price, product: activeProduct, reason };
                    } else {
                        const executed = userStore.executePaperTrade(userId, 'SELL', amount, price, reason);
                        if (executed) {
                            broadcastFn('TRADE_EXEC', executed);
                            broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
                        }
                        return executed;
                    }
                },
                broadcastFn
            );
        }

        if (user.killSwitch || user.circuitBreaker.tripped) {
            const reason = user.killSwitchReason || user.circuitBreaker.reason;
            broadcastFn('KILL_SWITCH_ALERT', { reason });
            broadcastFn('AI_STATUS', `🛑 Halted: ${reason}`);
            return;
        }

        // Check absolute price targets (stop-loss / take-profit) every tick
        const rsCheck = user.riskSettings;
        const stateCheck = user.paperTradingState;
        if (engine.engineStatus !== 'STOPPED' && stateCheck.assetHoldings > 0) {
            if (rsCheck.stopLossPrice && data.price <= rsCheck.stopLossPrice) {
                broadcastFn('AI_STATUS', `🔴 STOP-LOSS triggered at $${data.price.toLocaleString()} (target: $${rsCheck.stopLossPrice.toLocaleString()})`);
                const reason = `[STOP-LOSS] Price $${data.price.toLocaleString()} hit target $${rsCheck.stopLossPrice.toLocaleString()}`;
                if (engine.engineStatus === 'LIVE_RUNNING') {
                    const pendingTrade = buildPendingTrade('SELL', stateCheck.assetHoldings, data.price, activeProduct, reason, 100, null, true);
                    userStore.setPendingTrade(userId, pendingTrade);
                    broadcastFn('PENDING_TRADE', pendingTrade);
                } else {
                    const executed = userStore.executePaperTrade(userId, 'SELL', stateCheck.assetHoldings, data.price, reason);
                    if (executed) {
                        broadcastFn('TRADE_EXEC', executed);
                        broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
                    }
                }
            } else if (rsCheck.takeProfitPrice && data.price >= rsCheck.takeProfitPrice) {
                broadcastFn('AI_STATUS', `🟢 TAKE-PROFIT triggered at $${data.price.toLocaleString()} (target: $${rsCheck.takeProfitPrice.toLocaleString()})`);
                const reason = `[TAKE-PROFIT] Price $${data.price.toLocaleString()} hit target $${rsCheck.takeProfitPrice.toLocaleString()}`;
                if (engine.engineStatus === 'LIVE_RUNNING') {
                    const pendingTrade = buildPendingTrade('SELL', stateCheck.assetHoldings, data.price, activeProduct, reason, 100, null, true);
                    userStore.setPendingTrade(userId, pendingTrade);
                    broadcastFn('PENDING_TRADE', pendingTrade);
                } else {
                    const executed = userStore.executePaperTrade(userId, 'SELL', stateCheck.assetHoldings, data.price, reason);
                    if (executed) {
                        broadcastFn('TRADE_EXEC', executed);
                        broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
                    }
                }
            }
        }

        const now = Date.now();

        if (engine.engineStatus === 'STOPPED') {
            // Don't run AI evaluations when engine is stopped
            // Only broadcast status occasionally (every 10s) to avoid flooding client
            if (now % 10000 < 2200) {
                broadcastFn('AI_STATUS', `Engine paused — click PAPER to start trading ${activeProduct}`);
            }
        } else if (data.candles.length < 5) {
            broadcastFn('AI_STATUS', `Warming up — collecting candles (${data.candles.length}/5)…`);
        } else if (now - lastAiEvalTime > 30000) {
            lastAiEvalTime = now;
            broadcastFn('AI_STATUS', `Analyzing ${activeProduct} market structure…`);

            const decision = await evaluateMarketSignal(userId, [...data.candles], activeProduct);

            if (!decision) {
                broadcastFn('AI_STATUS', `⚠️ AI eval failed for ${activeProduct} — check server logs`);
                return;
            }

            broadcastFn('AI_STATUS', `${activeProduct}: ${decision.action} | Confidence ${decision.confidence}%${decision.action === 'HOLD' ? ' — holding position' : ''}`);
            broadcastFn('AI_THESIS', decision.reasoning);

            const minConfidence = engine.engineStatus === 'LIVE_RUNNING' ? 80 : 65;
            if (decision && decision.action !== 'HOLD' && decision.confidence >= minConfidence) {
                if (engine.engineStatus === 'STOPPED') {
                    broadcastFn('AI_STATUS', `${activeProduct}: ${decision.action} signal observed; execution engine is stopped.`);
                    return;
                }

                // LLM Agentic Risk Management: Apply AI's dynamic TP/SL
                if (decision.take_profit_pct || decision.stop_loss_pct) {
                    const rs = userStore._ensureUser(userId).riskSettings;
                    if (decision.action === 'BUY') {
                        if (decision.take_profit_pct) rs.takeProfitPrice = data.price * (1 + (decision.take_profit_pct / 100));
                        if (decision.stop_loss_pct) rs.stopLossPrice = data.price * (1 - (decision.stop_loss_pct / 100));
                    } else if (decision.action === 'SELL') {
                        rs.takeProfitPrice = null; // Clear on sell
                        rs.stopLossPrice = null;
                    }
                }

                const suggestedAmount = getSuggestedTradeSize(userId, data.price);
                // Clamp AI position size override to 2x suggested to prevent runaway orders
                const amountToTrade = decision.position_size_override
                    ? Math.min(decision.position_size_override, suggestedAmount * 2)
                    : suggestedAmount;

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

                    // Don't overwrite a pending trade the user hasn't responded to yet
                    const existingPending = userStore.getPendingTrade(userId);
                    if (existingPending && Date.now() < existingPending.expiresAt) {
                        broadcastFn('AI_STATUS', `${activeProduct}: ${decision.action} signal — awaiting your response to previous trade first`);
                        broadcastFn('STRATEGY_UPDATE', userStore.getStrategies(userId));
                        return;
                    }

                    if (currentUser.engineStatus === 'LIVE_RUNNING') {
                        const pendingTrade = buildPendingTrade(
                            decision.action,
                            finalAmount,
                            data.price,
                            activeProduct,
                            decision.reasoning,
                            decision.confidence,
                            decision.signals,
                            true,
                            decision.agentConsensus
                        );
                        userStore.setPendingTrade(userId, pendingTrade);
                        broadcastFn('PENDING_TRADE', pendingTrade);
                        broadcastFn('AI_STATUS', `Live Assisted: awaiting your confirmation for ${decision.action} ${activeProduct}`);
                    } else if (currentUser.tradingMode === 'AI_ASSISTED') {
                        const pendingTrade = buildPendingTrade(
                            decision.action,
                            finalAmount,
                            data.price,
                            activeProduct,
                            decision.reasoning,
                            decision.confidence,
                            decision.signals,
                            false,
                            decision.agentConsensus
                        );
                        userStore.setPendingTrade(userId, pendingTrade);
                        broadcastFn('PENDING_TRADE', pendingTrade);
                        broadcastFn('AI_STATUS', `Awaiting your confirmation: ${decision.action} ${activeProduct}`);
                    } else {
                        // Paper Full Auto execution
                        const executed = userStore.executePaperTrade(
                            userId, decision.action, finalAmount, data.price, decision.reasoning
                        );

                        if (executed) {
                            broadcastFn('TRADE_EXEC', executed);
                            const notif = userStore.getNotifications(userId)[0];
                            broadcastFn('NOTIFICATION', notif);
                            // Register SmartTrade position tracking for BUY orders
                            if (decision.action === 'BUY') {
                                const tpConfig = defaultTpConfig(user.riskSettings);
                                openPosition(userId, activeProduct, finalAmount, data.price, tpConfig);
                            } else if (decision.action === 'SELL') {
                                closePosition(userId, activeProduct);
                            }
                        }
                    }
                }
            }

            broadcastFn('STRATEGY_UPDATE', userStore.getStrategies(userId));
            // Keep the last AI decision visible — don't overwrite with a generic "Monitoring" message
        }
    }, 2000);

    return {
        cleanup: () => clearInterval(interval),
        setProduct
    };
}

function buildPendingTrade(side, amount, price, product, reasoning, confidence, signals, isLive, agentConsensus = null) {
    return {
        tradeId: Date.now(),
        side,
        amount,
        price,
        product,
        reasoning,
        confidence,
        signals,
        isLive,
        agentConsensus,
        expiresAt: Date.now() + 60000
    };
}

module.exports = { startUserStream, ensureMarketConnection, executeLiveOrder, SUPPORTED_PRODUCTS };
