const axios = require('axios');

const FALLBACK_PRODUCTS = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD',
    'ADA-USD', 'AVAX-USD', 'MATIC-USD', 'LINK-USD', 'DOT-USD',
    'LTC-USD', 'UNI-USD', 'ATOM-USD', 'NEAR-USD', 'FIL-USD',
    'AMP-USD', 'LRC-USD', 'ALGO-USD', 'ANKR-USD', 'FLOKI-USD',
    'XYO-USD', 'SHIB-USD', 'PEPE-USD', 'ARB-USD', 'OP-USD',
].map(id => ({ id, base: id.split('-')[0], quote: 'USD', name: id.split('-')[0] }));

let productsCache = null;
let productsCacheTime = 0;
const PRODUCT_CACHE_TTL_MS = 60 * 60 * 1000;

function normalizeProduct(row) {
    return {
        id: row.product_id,
        base: row.base_currency_id,
        quote: 'USD',
        name: row.base_name || row.base_currency_id
    };
}

function normalizeExchangeProduct(row) {
    return {
        id: row.id,
        base: row.base_currency,
        quote: 'USD',
        name: row.display_name || row.base_currency
    };
}

async function getCoinbaseProducts() {
    if (productsCache && Date.now() - productsCacheTime < PRODUCT_CACHE_TTL_MS) {
        return productsCache;
    }

    try {
        const response = await axios.get(
            'https://api.coinbase.com/api/v3/brokerage/products?limit=500&product_type=SPOT',
            { timeout: 8000 }
        );
        const products = (response.data?.products || [])
            .filter(product => (
                product.quote_currency_id === 'USD' &&
                product.status === 'online' &&
                !product.is_disabled &&
                product.product_id
            ))
            .map(normalizeProduct)
            .sort((a, b) => a.base.localeCompare(b.base));

        if (products.length > 0) {
            productsCache = products;
            productsCacheTime = Date.now();
            return products;
        }
    } catch (error) {
        console.warn('Coinbase brokerage products fetch failed; trying public exchange catalog:', error.message);
    }

    try {
        const response = await axios.get('https://api.exchange.coinbase.com/products', { timeout: 8000 });
        const products = (response.data || [])
            .filter(product => (
                product.quote_currency === 'USD' &&
                product.status === 'online' &&
                !product.trading_disabled &&
                product.id
            ))
            .map(normalizeExchangeProduct)
            .sort((a, b) => a.base.localeCompare(b.base));

        if (products.length > 0) {
            productsCache = products;
            productsCacheTime = Date.now();
            return products;
        }
    } catch (error) {
        console.warn('Coinbase public products fetch failed; using fallback list:', error.message);
    }

    productsCache = FALLBACK_PRODUCTS;
    productsCacheTime = Date.now();
    return productsCache;
}

async function isSupportedProduct(productId) {
    if (!/^[A-Z0-9-]+-USD$/.test(productId || '')) return false;
    const products = await getCoinbaseProducts();
    return products.some(product => product.id === productId);
}

module.exports = {
    FALLBACK_PRODUCTS,
    getCoinbaseProducts,
    isSupportedProduct
};
