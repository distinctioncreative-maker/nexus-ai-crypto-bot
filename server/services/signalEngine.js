const axios = require('axios');

// Cache signals for 5 minutes
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchFearGreed() {
    try {
        const res = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 5000 });
        const data = res.data?.data?.[0];
        if (!data) return null;
        return {
            value: parseInt(data.value),
            classification: data.value_classification
        };
    } catch {
        return null;
    }
}

async function fetchTVLChange() {
    try {
        const res = await axios.get('https://api.llama.fi/v2/historicalChainTvl', { timeout: 8000 });
        const history = res.data;
        if (!Array.isArray(history) || history.length < 8) return null;
        const latest = history[history.length - 1].tvl;
        const weekAgo = history[history.length - 8].tvl;
        const changePct = ((latest - weekAgo) / weekAgo) * 100;
        return { latest, changePct: parseFloat(changePct.toFixed(2)) };
    } catch {
        return null;
    }
}

async function fetchPolymarketBTC() {
    try {
        const res = await axios.get('https://gamma-api.polymarket.com/markets?tag=crypto&limit=20', { timeout: 8000 });
        const markets = res.data;
        if (!Array.isArray(markets)) return null;
        const btcMarket = markets.find(m =>
            m.question && m.question.toLowerCase().includes('bitcoin') &&
            (m.question.toLowerCase().includes('bull') || m.question.toLowerCase().includes('above') || m.question.toLowerCase().includes('price'))
        );
        if (!btcMarket) return null;
        // outcomePrices is a JSON string like "[\"0.65\",\"0.35\"]" — first entry is YES probability
        const prices = JSON.parse(btcMarket.outcomePrices || '["0.5","0.5"]');
        return { question: btcMarket.question, bullProb: parseFloat(prices[0]) };
    } catch {
        return null;
    }
}

function buildCompositeScore(fearGreed, tvl, polymarket) {
    let score = 0;
    const factors = [];

    if (fearGreed) {
        if (fearGreed.value < 25) { score += 40; factors.push(`Fear&Greed ${fearGreed.value} (Extreme Fear → Buy)`); }
        else if (fearGreed.value > 75) { score -= 40; factors.push(`Fear&Greed ${fearGreed.value} (Extreme Greed → Sell)`); }
        else if (fearGreed.value < 40) { score += 20; factors.push(`Fear&Greed ${fearGreed.value} (Fear → Lean Buy)`); }
        else if (fearGreed.value > 60) { score -= 20; factors.push(`Fear&Greed ${fearGreed.value} (Greed → Lean Sell)`); }
    }

    if (tvl) {
        if (tvl.changePct > 5) { score += 20; factors.push(`TVL +${tvl.changePct}% 7d (DeFi Inflows)`); }
        else if (tvl.changePct < -5) { score -= 20; factors.push(`TVL ${tvl.changePct}% 7d (DeFi Outflows)`); }
    }

    if (polymarket) {
        if (polymarket.bullProb > 0.65) { score += 20; factors.push(`Polymarket ${(polymarket.bullProb * 100).toFixed(0)}% BTC bull`); }
        else if (polymarket.bullProb < 0.35) { score -= 20; factors.push(`Polymarket ${(polymarket.bullProb * 100).toFixed(0)}% BTC bull (Bearish)`); }
    }

    return { score, factors };
}

async function getSignals() {
    const now = Date.now();
    if (cache && (now - cacheTime) < CACHE_TTL) return cache;

    const [fearGreed, tvl, polymarket] = await Promise.all([
        fetchFearGreed(),
        fetchTVLChange(),
        fetchPolymarketBTC()
    ]);

    const { score, factors } = buildCompositeScore(fearGreed, tvl, polymarket);

    cache = { fearGreed, tvl, polymarket, compositeScore: score, factors };
    cacheTime = now;
    return cache;
}

module.exports = { getSignals };
