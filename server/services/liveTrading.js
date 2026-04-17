/**
 * Live Trading Service - Coinbase Advanced Trade API.
 *
 * Preferred auth path follows current Coinbase docs via @coinbase/cdp-sdk/auth.
 * A legacy ES256 fallback is retained for older PEM keys, but Ed25519/CDP keys
 * should install @coinbase/cdp-sdk in server dependencies before real trading.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const COINBASE_API_BASE = 'https://api.coinbase.com';
const COINBASE_API_HOST = 'api.coinbase.com';

function getCdpJwtGenerator() {
    try {
        return require('@coinbase/cdp-sdk/auth').generateJwt;
    } catch (_error) {
        return null;
    }
}

async function buildJWT(apiKey, apiSecret, method, path) {
    const requestPath = path.replace(COINBASE_API_BASE, '');
    const generateJwt = getCdpJwtGenerator();

    if (generateJwt) {
        return generateJwt({
            apiKeyId: apiKey,
            apiKeySecret: apiSecret,
            requestMethod: method,
            requestHost: COINBASE_API_HOST,
            requestPath,
            expiresIn: 120
        });
    }

    if (!apiSecret.includes('BEGIN')) {
        throw new Error('@coinbase/cdp-sdk is required for Ed25519 Coinbase API keys.');
    }

    const uri = `${method.toUpperCase()} ${COINBASE_API_HOST}${requestPath}`;
    const now = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = {
        sub: apiKey,
        iss: 'cdp',
        aud: ['cdp_service'],
        nbf: now,
        exp: now + 120,
        uri
    };

    return jwt.sign(payload, apiSecret, {
        algorithm: 'ES256',
        header: { kid: apiKey, nonce, typ: 'JWT' }
    });
}

async function coinbaseFetch(apiKey, apiSecret, method, path, body = null) {
    const token = await buildJWT(apiKey, apiSecret, method, path);
    const options = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        }
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${COINBASE_API_BASE}${path}`, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(`Coinbase API error ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
}

function parseOrderStatus(order) {
    const status = order?.status || order?.order_status || '';
    if (status === 'FILLED' || order?.completion_percentage === '100') return 'FILLED';
    if (['OPEN', 'PENDING', 'QUEUED'].includes(status)) return status;
    if (status) return status;
    return 'CREATED';
}

function parseFill(order, fallbackAmount, fallbackPrice) {
    const filledSize = Number.parseFloat(order?.filled_size || order?.base_size || fallbackAmount);
    const filledValue = Number.parseFloat(order?.filled_value || order?.quote_size || 0);
    const avgFillPrice = Number.parseFloat(order?.average_filled_price || order?.avg_filled_price || 0);
    return {
        filledSize: Number.isFinite(filledSize) ? filledSize : fallbackAmount,
        filledValue: Number.isFinite(filledValue) ? filledValue : 0,
        avgFillPrice: Number.isFinite(avgFillPrice) && avgFillPrice > 0 ? avgFillPrice : fallbackPrice
    };
}

async function getOrder(apiKey, apiSecret, orderId) {
    const data = await coinbaseFetch(
        apiKey,
        apiSecret,
        'GET',
        `/api/v3/brokerage/orders/historical/${orderId}`
    );
    return data.order || data;
}

/**
 * Place a market order on Coinbase.
 * BUY uses quote_size derived from the requested base amount and reference price.
 * SELL uses base_size, as recommended by Coinbase market order guidance.
 */
async function placeMarketOrder(apiKey, apiSecret, side, amount, productId, referencePrice) {
    const clientOrderId = `quant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedSide = side === 'SELL' ? 'SELL' : 'BUY';
    const quoteSize = amount * referencePrice;
    const marketIoc = normalizedSide === 'BUY'
        ? { quote_size: quoteSize.toFixed(2) }
        : { base_size: amount.toFixed(8) };

    const body = {
        client_order_id: clientOrderId,
        product_id: productId,
        side: normalizedSide,
        order_configuration: {
            market_market_ioc: marketIoc
        }
    };

    const created = await coinbaseFetch(apiKey, apiSecret, 'POST', '/api/v3/brokerage/orders', body);
    const orderId = created.order_id || created.success_response?.order_id;

    if (!created.success || !orderId) {
        return {
            orderId,
            status: created.error_response ? 'FAILED' : 'CREATED',
            filledSize: 0,
            filledValue: 0,
            avgFillPrice: 0,
            raw: created
        };
    }

    const order = await getOrder(apiKey, apiSecret, orderId).catch(() => null);
    const status = parseOrderStatus(order);
    const fill = parseFill(order, amount, referencePrice);

    return {
        orderId,
        status,
        ...fill,
        raw: { created, order }
    };
}

async function cancelAllOrders(apiKey, apiSecret, productId) {
    try {
        const openOrders = await coinbaseFetch(
            apiKey,
            apiSecret,
            'GET',
            `/api/v3/brokerage/orders/historical/batch?order_status=OPEN&product_id=${productId}`
        );

        const orderIds = (openOrders.orders || []).map(order => order.order_id).filter(Boolean);
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

module.exports = { placeMarketOrder, cancelAllOrders, coinbaseFetch };
