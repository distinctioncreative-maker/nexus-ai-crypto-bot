/**
 * Live Trading Service — Coinbase Advanced Trade API
 * Executes real orders using Ed25519 JWT signing via jsonwebtoken.
 * Only called when user.isLiveMode === true.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const COINBASE_API_BASE = 'https://api.coinbase.com';

/**
 * Build a signed JWT for Coinbase Advanced Trade API.
 * The key is expected in PEM format (EC private key).
 */
function buildJWT(apiKey, apiSecret, method, path) {
    const requestPath = path.replace(COINBASE_API_BASE, '');
    const uri = `${method} ${COINBASE_API_BASE}${requestPath}`;
    const nonce = crypto.randomBytes(16).toString('hex');

    const payload = {
        sub: apiKey,
        iss: 'coinbase-cloud',
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 120,
        uri
    };

    // Coinbase uses ES256 (P-256 / prime256v1) keys
    return jwt.sign(payload, apiSecret, {
        algorithm: 'ES256',
        header: { kid: apiKey, nonce }
    });
}

async function coinbaseFetch(apiKey, apiSecret, method, path, body = null) {
    const token = buildJWT(apiKey, apiSecret, method, path);

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${COINBASE_API_BASE}${path}`, options);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(`Coinbase API error ${res.status}: ${JSON.stringify(data)}`);
    }

    return data;
}

/**
 * Place a market order on Coinbase.
 * side: 'BUY' | 'SELL'
 * amount: number of base units (e.g. BTC)
 * productId: e.g. 'BTC-USD'
 */
async function placeMarketOrder(apiKey, apiSecret, side, amount, productId) {
    const clientOrderId = `quant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const orderConfig = side === 'BUY'
        ? { market_market_ioc: { quote_size: undefined, base_size: amount.toFixed(8) } }
        : { market_market_ioc: { base_size: amount.toFixed(8) } };

    const body = {
        client_order_id: clientOrderId,
        product_id: productId,
        side: side === 'BUY' ? 'BUY' : 'SELL',
        order_configuration: orderConfig
    };

    const data = await coinbaseFetch(apiKey, apiSecret, 'POST', '/api/v3/brokerage/orders', body);

    const order = data.success_response || data.order_configuration;
    return {
        orderId: data.order_id || data.success_response?.order_id,
        status: data.success ? 'FILLED' : 'FAILED',
        filledSize: parseFloat(order?.base_size || amount),
        filledValue: parseFloat(order?.quote_size || 0),
        avgFillPrice: parseFloat(order?.average_filled_price || 0),
        raw: data
    };
}

/**
 * Cancel all open orders for a product.
 */
async function cancelAllOrders(apiKey, apiSecret, productId) {
    try {
        // Fetch open orders first
        const openOrders = await coinbaseFetch(
            apiKey, apiSecret, 'GET',
            `/api/v3/brokerage/orders/historical/batch?order_status=OPEN&product_id=${productId}`
        );

        const orderIds = (openOrders.orders || []).map(o => o.order_id).filter(Boolean);
        if (orderIds.length === 0) return { cancelled: 0 };

        await coinbaseFetch(apiKey, apiSecret, 'POST', '/api/v3/brokerage/orders/batch_cancel', {
            order_ids: orderIds
        });

        return { cancelled: orderIds.length };
    } catch (err) {
        console.error('cancelAllOrders error:', err.message);
        return { cancelled: 0, error: err.message };
    }
}

module.exports = { placeMarketOrder, cancelAllOrders };
