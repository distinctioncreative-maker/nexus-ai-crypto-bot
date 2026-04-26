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

    let heartbeatInterval = null;

    marketWs.on('open', () => {
        subscribeToAllProducts();
        // Send a ping every 30s to keep the connection alive on Railway
        heartbeatInterval = setInterval(() => {
            if (marketWs && marketWs.readyState === WebSocket.OPEN) {
                try { marketWs.ping(); } catch {}
            } else {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
        }, 30000);
    });

    marketWs.on('pong', () => {
        // Successful pong means connection is healthy — reset backoff
        reconnectDelay = 5000;
    });

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
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
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
                ? userStore.executePaperTrade(userId, action, fillSize, fillPrice, `[LIVE:${result.orderId}] ${reasoning}`, productId)
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

// Execute a trade decision for a specific product
async function executeTradeDecision(userId, productId, decision, price, history, broadcastFn) {
    const user = userStore._ensureUser(userId);
    const engine = userStore.getEngineState(userId);

    // Apply AI's dynamic TP/SL (only for the selected product to keep settings simple)
    if (productId === user.selectedProduct && (decision.take_profit_pct || decision.stop_loss_pct)) {
        const rs = user.riskSettings;
        if (decision.action === 'BUY') {
            if (decision.take_profit_pct) rs.takeProfitPrice = price * (1 + (decision.take_profit_pct / 100));
            if (decision.stop_loss_pct) rs.stopLossPrice = price * (1 - (decision.stop_loss_pct / 100));
        } else if (decision.action === 'SELL') {
            rs.takeProfitPrice = null;
            rs.stopLossPrice = null;
        }
    }

    const suggestedAmount = getSuggestedTradeSize(userId, price, productId);
    const amountToTrade = decision.position_size_override
        ? Math.min(decision.position_size_override, suggestedAmount * 2)
        : suggestedAmount;

    const riskCheck = checkTradeAllowed(userId, decision.action, amountToTrade, price, history, productId);

    if (!riskCheck.allowed) {
        broadcastFn('AI_STATUS', `[${productId}] Risk block: ${riskCheck.reason}`);
        return;
    }

    const finalAmount = riskCheck.adjustedAmount || amountToTrade;

    // Don't overwrite a pending trade the user hasn't responded to yet
    const existingPending = userStore.getPendingTrade(userId);
    if (existingPending && Date.now() < existingPending.expiresAt) {
        broadcastFn('AI_STATUS', `${productId}: ${decision.action} signal — awaiting your response to previous trade first`);
        return;
    }

    if (engine.engineStatus === 'LIVE_RUNNING') {
        const pendingTrade = buildPendingTrade(decision.action, finalAmount, price, productId, decision.reasoning, decision.confidence, decision.signals, true, decision.agentConsensus);
        userStore.setPendingTrade(userId, pendingTrade);
        broadcastFn('PENDING_TRADE', pendingTrade);
        broadcastFn('AI_STATUS', `Live Assisted: awaiting confirmation for ${decision.action} ${productId}`);
    } else if (user.tradingMode === 'AI_ASSISTED') {
        const pendingTrade = buildPendingTrade(decision.action, finalAmount, price, productId, decision.reasoning, decision.confidence, decision.signals, false, decision.agentConsensus);
        userStore.setPendingTrade(userId, pendingTrade);
        broadcastFn('PENDING_TRADE', pendingTrade);
        broadcastFn('AI_STATUS', `Awaiting confirmation: ${decision.action} ${productId}`);
    } else {
        // Full Auto paper execution
        const executed = userStore.executePaperTrade(userId, decision.action, finalAmount, price, decision.reasoning, productId);
        if (executed) {
            broadcastFn('TRADE_EXEC', executed);
            broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
            if (decision.action === 'BUY') {
                openPosition(userId, productId, finalAmount, price, defaultTpConfig(user.riskSettings));
            } else if (decision.action === 'SELL') {
                closePosition(userId, productId);
            }
        }
    }
}

function startUserStream(userId, broadcastFn, initialProduct, initialWatchlist) {
    ensureMarketConnection();

    let selectedProduct = initialProduct || userStore.getSelectedProduct(userId) || 'BTC-USD';
    let watchlist = initialWatchlist || userStore.getWatchlist(userId);

    // Per-product eval timers: Map<productId, lastEvalTimestamp>
    const evalTimers = new Map();
    // Throttle kill switch alerts — only re-broadcast every 60s, not every 2s tick
    let lastKillAlertTime = 0;

    const subscribeProduct = (productId) => {
        if (!SUPPORTED_PRODUCTS.includes(productId) && marketWs && marketWs.readyState === WebSocket.OPEN) {
            marketWs.send(JSON.stringify({ type: 'subscribe', product_ids: [productId], channels: ['ticker'] }));
            SUPPORTED_PRODUCTS.push(productId);
        }
    };

    const seedProduct = (productId) => {
        return fetchHistoricalCandles(productId).then(candles => {
            if (candles.length > 0) {
                const data = getProductData(productId);
                data.candles = [...candles];
                const closes = candles.slice(-100).map(c => c.value);
                data.history = closes;
                data.price = closes[closes.length - 1];
                if (productId === selectedProduct) {
                    broadcastFn('CANDLE_HISTORY', candles);
                }
            }
        }).catch(() => {});
    };

    const setProduct = async (productId) => {
        if (!(await isSupportedProduct(productId))) {
            broadcastFn('AI_STATUS', `Unsupported Coinbase USD spot product: ${productId}`);
            return false;
        }
        selectedProduct = productId;
        userStore.setSelectedProduct(userId, productId);
        subscribeProduct(productId);
        // Add to watchlist if not already there
        const wl = userStore.getWatchlist(userId);
        if (!wl.includes(productId)) {
            userStore.setWatchlist(userId, [productId, ...wl].slice(0, 10));
            watchlist = userStore.getWatchlist(userId);
        }
        await seedProduct(productId);
        return true;
    };

    const setWatchlist = (products) => {
        userStore.setWatchlist(userId, products);
        watchlist = userStore.getWatchlist(userId);
        // Seed any new products
        for (const p of watchlist) {
            subscribeProduct(p);
            const data = getProductData(p);
            if (data.price <= 0 && data.candles.length === 0) {
                seedProduct(p);
            }
        }
    };

    // Seed all watchlist products on startup
    for (const p of watchlist) {
        subscribeProduct(p);
        seedProduct(p);
    }
    setProduct(selectedProduct).then(() => broadcastEngineState(userId, broadcastFn));

    const interval = setInterval(async () => {
        const data = getProductData(selectedProduct);
        if (data.price <= 0) return;

        // Broadcast TICK for the chart display product
        broadcastFn('TICK', {
            price: data.price,
            product: selectedProduct,
            time: new Date().toLocaleTimeString()
        });

        // Broadcast live prices for ALL watchlist products (sidebar + portfolio P&L)
        const allPrices = {};
        for (const p of watchlist) {
            const pData = getProductData(p);
            if (pData.price > 0) allPrices[p] = pData.price;
        }
        // Also include any held products not in watchlist
        const userHoldings = userStore._ensureUser(userId).productHoldings;
        for (const p of Object.keys(userHoldings)) {
            if ((userHoldings[p]?.assetHoldings || 0) > 0) {
                const pData = getProductData(p);
                if (pData.price > 0) allPrices[p] = pData.price;
                // Update last known price for portfolio valuation
                if (userHoldings[p]) userHoldings[p]._lastPrice = pData.price;
            }
        }
        if (Object.keys(allPrices).length > 0) {
            broadcastFn('HOLDINGS_PRICES', allPrices);
        }

        const user = userStore._ensureUser(userId);
        const engine = userStore.getEngineState(userId);

        // SmartTrade: check multi-TP / trailing stop for selected product on every tick
        if (engine.engineStatus !== 'STOPPED') {
            checkPositions(userId, selectedProduct, data.price, (amount, price, reason) => {
                const currentEngine = userStore.getEngineState(userId);
                if (currentEngine.engineStatus === 'LIVE_RUNNING') {
                    const pt = buildPendingTrade('SELL', amount, price, selectedProduct, reason, 100, null, true);
                    userStore.setPendingTrade(userId, pt);
                    broadcastFn('PENDING_TRADE', pt);
                    return { amount, price, product: selectedProduct, reason };
                } else {
                    const executed = userStore.executePaperTrade(userId, 'SELL', amount, price, reason, selectedProduct);
                    if (executed) {
                        broadcastFn('TRADE_EXEC', executed);
                        broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]);
                    }
                    return executed;
                }
            }, broadcastFn);
        }

        if (user.killSwitch || user.circuitBreaker.tripped) {
            const reason = user.killSwitchReason || user.circuitBreaker.reason;
            // Only re-broadcast the alert every 60s — not every 2s tick
            if (now - lastKillAlertTime > 60000) {
                broadcastFn('KILL_SWITCH_ALERT', { reason });
                broadcastFn('SERVER_LOG', {
                    level: 'warn',
                    source: 'circuitBreaker',
                    message: `Kill switch / circuit breaker active: ${reason}`,
                    detail: `killSwitch=${user.killSwitch} tripped=${user.circuitBreaker.tripped} maxDrawdown=${user.circuitBreaker.maxDrawdownPercent}%`,
                    ts: Date.now(),
                });
                lastKillAlertTime = now;
            }
            broadcastFn('AI_STATUS', `🛑 Halted: ${reason}`);
            return;
        }

        // Check absolute SL/TP for selected product
        const rsCheck = user.riskSettings;
        const stateCheck = user.paperTradingState;
        if (engine.engineStatus !== 'STOPPED' && stateCheck.assetHoldings > 0) {
            if (rsCheck.stopLossPrice && data.price <= rsCheck.stopLossPrice) {
                broadcastFn('AI_STATUS', `🔴 STOP-LOSS triggered at $${data.price.toLocaleString()} (target: $${rsCheck.stopLossPrice.toLocaleString()})`);
                const reason = `[STOP-LOSS] Price $${data.price.toLocaleString()} hit target $${rsCheck.stopLossPrice.toLocaleString()}`;
                if (engine.engineStatus === 'LIVE_RUNNING') {
                    const pt = buildPendingTrade('SELL', stateCheck.assetHoldings, data.price, selectedProduct, reason, 100, null, true);
                    userStore.setPendingTrade(userId, pt);
                    broadcastFn('PENDING_TRADE', pt);
                } else {
                    const executed = userStore.executePaperTrade(userId, 'SELL', stateCheck.assetHoldings, data.price, reason, selectedProduct);
                    if (executed) { broadcastFn('TRADE_EXEC', executed); broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]); }
                }
            } else if (rsCheck.takeProfitPrice && data.price >= rsCheck.takeProfitPrice) {
                broadcastFn('AI_STATUS', `🟢 TAKE-PROFIT triggered at $${data.price.toLocaleString()} (target: $${rsCheck.takeProfitPrice.toLocaleString()})`);
                const reason = `[TAKE-PROFIT] Price $${data.price.toLocaleString()} hit target $${rsCheck.takeProfitPrice.toLocaleString()}`;
                if (engine.engineStatus === 'LIVE_RUNNING') {
                    const pt = buildPendingTrade('SELL', stateCheck.assetHoldings, data.price, selectedProduct, reason, 100, null, true);
                    userStore.setPendingTrade(userId, pt);
                    broadcastFn('PENDING_TRADE', pt);
                } else {
                    const executed = userStore.executePaperTrade(userId, 'SELL', stateCheck.assetHoldings, data.price, reason, selectedProduct);
                    if (executed) { broadcastFn('TRADE_EXEC', executed); broadcastFn('NOTIFICATION', userStore.getNotifications(userId)[0]); }
                }
            }
        }

        const now = Date.now();

        if (engine.engineStatus === 'STOPPED') {
            if (now % 10000 < 2200) {
                broadcastFn('AI_STATUS', `Engine paused — click PAPER to start trading`);
            }
            return;
        }

        // ── Multi-product AI evaluation loop ────────────────────────────────
        // Evaluate all watchlist products whose timer has expired (15s per product)
        const EVAL_INTERVAL_MS = 15000;
        const productsToEval = watchlist.filter(p => {
            const pData = getProductData(p);
            if (pData.candles.length < 5) return false;
            const lastEval = evalTimers.get(p) || 0;
            return now - lastEval > EVAL_INTERVAL_MS;
        });

        if (productsToEval.length === 0) {
            // Show warmup if the chart product is still loading
            const selData = getProductData(selectedProduct);
            if (selData.candles.length < 5) {
                broadcastFn('AI_STATUS', `Warming up — collecting candles (${selData.candles.length}/5)…`);
            }
            return;
        }

        // Mark eval times immediately to prevent re-entry during async eval
        for (const p of productsToEval) evalTimers.set(p, now);

        broadcastFn('AI_STATUS', `Analyzing ${productsToEval.join(', ')}…`);

        // Run all product evals in parallel
        const evalResults = await Promise.allSettled(
            productsToEval.map(async (productId) => {
                const pData = getProductData(productId);
                const decision = await evaluateMarketSignal(userId, [...pData.candles], productId);
                return { productId, decision, price: pData.price, history: pData.history };
            })
        );

        let statusParts = [];
        for (const result of evalResults) {
            if (result.status === 'rejected' || !result.value?.decision) {
                const pid = result.value?.productId || (result.reason?.productId) || '?';
                const errMsg = result.reason?.message || result.reason?.toString() || 'unknown error';
                const errStack = result.reason?.stack ? result.reason.stack.split('\n').slice(0, 3).join(' | ') : '';
                console.warn(`AI eval failed for ${pid}:`, errMsg);
                broadcastFn('SERVER_LOG', {
                    level: 'error',
                    source: 'strategyEngine',
                    message: `AI eval failed for ${pid}: ${errMsg}`,
                    detail: errStack,
                    ts: Date.now(),
                });
                continue;
            }
            const { productId, decision, price: evalPrice, history: evalHistory } = result.value;
            const voteStr = decision.agentVotes
                ? `[${decision.agentVotes.filter(v => v.agentId !== 'COMBINED').map(v => `${v.name}:${v.signal[0]}`).join('')}]`
                : '';
            statusParts.push(`${productId}: ${decision.action}(${decision.confidence}%) ${voteStr}`);

            // Emit per-product signal for watchlist sidebar dot indicator
            broadcastFn('PRODUCT_SIGNAL', { product: productId, action: decision.action, confidence: decision.confidence });

            if (productId === selectedProduct) {
                broadcastFn('AI_THESIS', decision.reasoning);
            }

            const minConfidence = engine.engineStatus === 'LIVE_RUNNING' ? 80 : 65;
            if (decision.action !== 'HOLD' && decision.confidence >= minConfidence && engine.engineStatus !== 'STOPPED') {
                await executeTradeDecision(userId, productId, decision, evalPrice, evalHistory, broadcastFn);
            }
        }

        if (statusParts.length > 0) {
            broadcastFn('AI_STATUS', statusParts.join(' | '));
        }
        broadcastFn('STRATEGY_UPDATE', userStore.getStrategies(userId));
    }, 2000);

    return {
        cleanup: () => clearInterval(interval),
        setProduct,
        setWatchlist
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

module.exports = { startUserStream, ensureMarketConnection, executeLiveOrder, SUPPORTED_PRODUCTS, getProductData };
