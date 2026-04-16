const axios = require('axios');

// Cache signals for 5 minutes
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Cache news for 10 minutes
let newsCache = null;
let newsCacheTime = 0;
const NEWS_TTL = 10 * 60 * 1000;

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

/**
 * Fetch real crypto news from CryptoPanic's free public API.
 * No auth token required for public posts.
 */
async function getNews() {
    const now = Date.now();
    if (newsCache && (now - newsCacheTime) < NEWS_TTL) return newsCache;

    try {
        const res = await axios.get(
            'https://cryptopanic.com/api/v1/posts/?public=true&kind=news&currencies=BTC,ETH,SOL,XRP,ADA,DOGE',
            { timeout: 8000 }
        );

        const posts = res.data?.results || [];

        const items = posts.slice(0, 25).map(post => {
            // Derive sentiment from vote counts
            const pos = post.votes?.positive || 0;
            const neg = post.votes?.negative || 0;
            const total = pos + neg;
            let sentiment = 'neutral';
            if (total > 0) {
                const ratio = pos / total;
                if (ratio > 0.55) sentiment = 'bullish';
                else if (ratio < 0.45) sentiment = 'bearish';
            }

            // Impact score: base 4, boosted by vote volume
            const votes = post.votes?.liked || 0;
            const impact = Math.min(10, Math.max(3, 4 + Math.floor(votes / 5)));

            // Affected assets
            const assets = (post.currencies || []).map(c => c.code).filter(Boolean).slice(0, 4);
            if (assets.length === 0) assets.push('BTC');

            // Relative time
            const published = new Date(post.published_at);
            const diffMin = Math.floor((Date.now() - published.getTime()) / 60000);
            const time = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : `${Math.floor(diffMin / 60)}h ago`;

            return {
                id: post.id,
                source: post.source?.title || 'CryptoPanic',
                headline: post.title,
                sentiment,
                impact,
                assets,
                time,
                url: post.url
            };
        });

        newsCache = items;
        newsCacheTime = now;
        return items;
    } catch (err) {
        console.error('News fetch error:', err.message);
        // Return cached if available, else empty
        return newsCache || [];
    }
}

module.exports = { getSignals, getNews };
