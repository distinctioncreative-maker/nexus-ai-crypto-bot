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
        const latest = history[history.length - 1]?.tvl;
        const weekAgo = history[history.length - 8]?.tvl;
        if (!latest || !weekAgo || weekAgo === 0) return null;
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
        // outcomePrices may be a JSON string or already an array
        let prices;
        try {
            prices = Array.isArray(btcMarket.outcomePrices)
                ? btcMarket.outcomePrices
                : JSON.parse(btcMarket.outcomePrices || '["0.5","0.5"]');
        } catch {
            prices = ['0.5', '0.5'];
        }
        return { question: btcMarket.question, bullProb: parseFloat(prices[0]) || 0.5 };
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

const { XMLParser } = require('fast-xml-parser');

const CRYPTO_KEYWORDS = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'solana', 'sol', 'xrp', 'ripple', 'coinbase', 'binance', 'nft', 'altcoin', 'web3', 'token', 'stablecoin', 'layer', 'protocol'];
const ASSET_MAP = { bitcoin: 'BTC', btc: 'BTC', ethereum: 'ETH', eth: 'ETH', solana: 'SOL', sol: 'SOL', xrp: 'XRP', ripple: 'XRP', doge: 'DOGE', dogecoin: 'DOGE', ada: 'ADA', cardano: 'ADA' };
const BULLISH_WORDS = ['surge', 'soar', 'rally', 'gain', 'rise', 'bull', 'high', 'record', 'ath', 'breakout', 'adoption', 'launch', 'approve', 'etf', 'institutional'];
const BEARISH_WORDS = ['crash', 'drop', 'fall', 'plunge', 'bear', 'dump', 'hack', 'ban', 'sue', 'sec', 'lawsuit', 'fine', 'low', 'sell-off', 'liquidat'];

function deriveSentiment(text) {
    const lower = text.toLowerCase();
    const bullScore = BULLISH_WORDS.filter(w => lower.includes(w)).length;
    const bearScore = BEARISH_WORDS.filter(w => lower.includes(w)).length;
    if (bullScore > bearScore) return 'bullish';
    if (bearScore > bullScore) return 'bearish';
    return 'neutral';
}

function extractAssets(text) {
    const lower = text.toLowerCase();
    const found = new Set();
    for (const [keyword, asset] of Object.entries(ASSET_MAP)) {
        if (lower.includes(keyword)) found.add(asset);
    }
    const assets = [...found].slice(0, 4);
    return assets.length > 0 ? assets : ['BTC'];
}

function relativeTime(dateStr) {
    try {
        const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        return `${Math.floor(diffMin / 60)}h ago`;
    } catch { return 'Recently'; }
}

const RSS_FEEDS = [
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
    { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
    { url: 'https://decrypt.co/feed', source: 'Decrypt' },
    { url: 'https://blockworks.co/feed', source: 'Blockworks' },
    { url: 'https://thedefiant.io/feed', source: 'The Defiant' },
];

const REDDIT_SUBS = ['CryptoCurrency', 'Bitcoin', 'ethereum', 'SatoshiStreetBets'];
const TWITTER_ACCOUNTS = [
    'CoinDesk', 'Cointelegraph', 'BitcoinMagazine', 'WuBlockchain', 'DocumentingBTC', 'saylor'
];

async function fetchRSS() {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_' });
    const items = [];

    await Promise.allSettled(RSS_FEEDS.map(async ({ url, source }) => {
        try {
            const res = await axios.get(url, {
                timeout: 6000,
                headers: { 'User-Agent': 'QuantBot/1.0 (+https://distinctioncreative.us)' }
            });
            const parsed = parser.parse(res.data);
            const entries = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
            const list = Array.isArray(entries) ? entries : [entries];

            list.slice(0, 8).forEach((item, idx) => {
                const headline = item.title?.['#text'] || item.title || '';
                const link = item.link?.href || item.link || item.guid || '';
                const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
                if (!headline) return;
                items.push({
                    id: `rss-${source}-${idx}-${Date.now()}`,
                    source,
                    headline: String(headline).trim(),
                    sentiment: deriveSentiment(headline),
                    impact: 5,
                    assets: extractAssets(headline),
                    time: relativeTime(pubDate),
                    url: String(link).trim(),
                    _ts: new Date(pubDate).getTime() || Date.now()
                });
            });
        } catch (_error) {
            return null;
        }
    }));

    return items;
}

async function fetchReddit() {
    const items = [];

    await Promise.allSettled(REDDIT_SUBS.map(async (sub) => {
        try {
            const res = await axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=6`, {
                timeout: 6000,
                headers: { 'User-Agent': 'QuantBot/1.0 (+https://distinctioncreative.us)' }
            });
            const posts = res.data?.data?.children || [];
            posts.forEach((p) => {
                const post = p.data;
                if (!post.title || post.is_self === false && !post.url) return;
                const lower = post.title.toLowerCase();
                const isCrypto = CRYPTO_KEYWORDS.some(kw => lower.includes(kw));
                if (!isCrypto && sub === 'SatoshiStreetBets' ? false : !isCrypto) return;
                items.push({
                    id: `reddit-${sub}-${post.id}`,
                    source: `r/${sub}`,
                    headline: String(post.title).trim(),
                    sentiment: deriveSentiment(post.title),
                    impact: Math.min(8, 4 + Math.floor((post.score || 0) / 200)),
                    assets: extractAssets(post.title),
                    time: relativeTime(new Date(post.created_utc * 1000).toISOString()),
                    url: `https://reddit.com${post.permalink}`,
                    _ts: (post.created_utc || 0) * 1000
                });
            });
        } catch (_error) {
            return null;
        }
    }));

    return items;
}

async function fetchTwitter() {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) return [];

    const items = [];
    // Search recent tweets from high-signal crypto accounts
    const query = `(from:${TWITTER_ACCOUNTS.join(' OR from:')}) lang:en -is:retweet`;

    try {
        const res = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            params: {
                query,
                max_results: 20,
                'tweet.fields': 'created_at,author_id,public_metrics',
                expansions: 'author_id',
                'user.fields': 'username'
            },
            headers: { Authorization: `Bearer ${bearerToken}` },
            timeout: 8000
        });

        const tweets = res.data?.data || [];
        const users = (res.data?.includes?.users || []).reduce((m, u) => { m[u.id] = u.username; return m; }, {});

        tweets.forEach((t) => {
            const lower = t.text.toLowerCase();
            const isCrypto = CRYPTO_KEYWORDS.some(kw => lower.includes(kw));
            if (!isCrypto) return;
            const username = users[t.author_id] || 'crypto';
            const likes = t.public_metrics?.like_count || 0;
            items.push({
                id: `tw-${t.id}`,
                source: `@${username}`,
                headline: t.text.replace(/https?:\/\/\S+/g, '').trim().slice(0, 200),
                sentiment: deriveSentiment(t.text),
                impact: Math.min(9, 5 + Math.floor(likes / 100)),
                assets: extractAssets(t.text),
                time: relativeTime(t.created_at),
                url: `https://twitter.com/${username}/status/${t.id}`,
                _ts: new Date(t.created_at).getTime() || Date.now()
            });
        });
    } catch (_error) {
        return [];
    }

    return items;
}

/**
 * Fetch real crypto news from RSS feeds, Reddit, and X/Twitter.
 * Falls back to cached results if all sources fail.
 */
async function getNews() {
    const now = Date.now();
    if (newsCache && (now - newsCacheTime) < NEWS_TTL) return newsCache;

    try {
        const [rssItems, redditItems, twitterItems] = await Promise.all([
            fetchRSS(),
            fetchReddit(),
            fetchTwitter()
        ]);

        const all = [...rssItems, ...redditItems, ...twitterItems];

        // Deduplicate by headline similarity (simple: first 40 chars)
        const seen = new Set();
        const deduped = all.filter(item => {
            const key = item.headline.toLowerCase().slice(0, 40);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort newest first
        deduped.sort((a, b) => (b._ts || 0) - (a._ts || 0));

        const items = deduped.slice(0, 40).map(({ _ts, ...item }) => item);

        if (items.length > 0) {
            newsCache = items;
            newsCacheTime = now;
        }

        return items.length > 0 ? items : (newsCache || []);
    } catch (err) {
        console.error('News fetch error:', err.message);
        return newsCache || [];
    }
}

module.exports = { getSignals, getNews };
