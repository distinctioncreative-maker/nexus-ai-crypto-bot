import React, { useState, useEffect, useRef } from 'react';
import { Radio, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SOURCE_COLORS = {
  Reuters: '#CC2936',
  Twitter: '#1DA1F2',
  CoinTelegraph: '#1E88E5',
  Reddit: '#FF4500',
  Bloomberg: '#F5F5F5',
  SEC: '#003087',
  'On-Chain': '#9945FF',
};

const SOURCE_TEXT_COLORS = {
  Bloomberg: '#000',
};

const SEED_NEWS = [
  { id: 1, source: 'Reuters', headline: 'Federal Reserve signals potential rate cuts in Q3 2026', sentiment: 'bullish', impact: 8, assets: ['BTC', 'ETH'], time: '2m ago' },
  { id: 2, source: 'Twitter', headline: 'Whale Alert: 8,200 BTC ($550M) moved from unknown wallet to Coinbase', sentiment: 'bearish', impact: 7, assets: ['BTC'], time: '5m ago' },
  { id: 3, source: 'CoinTelegraph', headline: 'BlackRock Bitcoin ETF hits record $2.1B single-day inflow', sentiment: 'bullish', impact: 9, assets: ['BTC'], time: '11m ago' },
  { id: 4, source: 'Reddit', headline: 'r/CryptoCurrency: Sentiment shift — community turning bullish on SOL after Firedancer update', sentiment: 'bullish', impact: 4, assets: ['SOL'], time: '18m ago' },
  { id: 5, source: 'On-Chain', headline: 'ETH staking withdrawals spike 340% — potential selling pressure ahead', sentiment: 'bearish', impact: 6, assets: ['ETH'], time: '24m ago' },
  { id: 6, source: 'Bloomberg', headline: 'MicroStrategy announces $500M Bitcoin purchase, bringing holdings to 245,000 BTC', sentiment: 'bullish', impact: 8, assets: ['BTC'], time: '31m ago' },
  { id: 7, source: 'SEC', headline: 'SEC delays ruling on spot Ethereum ETF options by 90 days', sentiment: 'bearish', impact: 7, assets: ['ETH'], time: '45m ago' },
  { id: 8, source: 'On-Chain', headline: 'DOGE large transaction volume up 180% in last 4 hours', sentiment: 'bullish', impact: 5, assets: ['DOGE'], time: '52m ago' },
];

const NEWS_POOL = [
  { source: 'Reuters', headline: 'IMF revises global growth forecast upward, crypto markets respond positively', sentiment: 'bullish', impact: 6, assets: ['BTC', 'ETH'] },
  { source: 'Twitter', headline: 'Breaking: Major exchange reports $1.2B in 24h BTC options expiry', sentiment: 'bearish', impact: 7, assets: ['BTC'] },
  { source: 'CoinTelegraph', headline: 'Ethereum developers confirm next upgrade scheduled for June 2026', sentiment: 'bullish', impact: 5, assets: ['ETH'] },
  { source: 'Reddit', headline: 'u/CryptoWhale signals massive SOL accumulation on-chain', sentiment: 'bullish', impact: 3, assets: ['SOL'] },
  { source: 'On-Chain', headline: 'BTC miner outflows hit 3-month high — potential sell pressure incoming', sentiment: 'bearish', impact: 6, assets: ['BTC'] },
  { source: 'Bloomberg', headline: 'Fidelity launches crypto custody service for institutional clients', sentiment: 'bullish', impact: 7, assets: ['BTC', 'ETH'] },
  { source: 'SEC', headline: 'SEC opens investigation into three DeFi protocols for unregistered securities', sentiment: 'bearish', impact: 8, assets: ['ETH'] },
  { source: 'Twitter', headline: 'Elon Musk tweets "DOGE" followed by rocket emoji — community speculates', sentiment: 'bullish', impact: 5, assets: ['DOGE'] },
  { source: 'CoinTelegraph', headline: 'Solana network hits 65,000 TPS — new throughput record', sentiment: 'bullish', impact: 4, assets: ['SOL'] },
  { source: 'On-Chain', headline: 'Stablecoin supply on exchanges rises 8% — historically precedes buying', sentiment: 'bullish', impact: 5, assets: ['BTC', 'ETH'] },
];

const KEYWORDS = [
  { word: 'BTC ETF', freq: 94 },
  { word: 'rate cut', freq: 81 },
  { word: 'whale movement', freq: 73 },
  { word: 'regulatory', freq: 68 },
  { word: 'institutional', freq: 62 },
  { word: 'SEC', freq: 57 },
  { word: 'DeFi', freq: 44 },
  { word: 'halving', freq: 38 },
];

const SOURCE_ACTIVITY = [
  { name: 'Twitter', value: 88, color: '#1DA1F2' },
  { name: 'Reddit', value: 72, color: '#FF4500' },
  { name: 'CoinTelegraph', value: 65, color: '#1E88E5' },
  { name: 'On-Chain', value: 54, color: '#9945FF' },
  { name: 'Reuters', value: 41, color: '#CC2936' },
  { name: 'Bloomberg', value: 35, color: '#888' },
];

const ASSET_SENTIMENTS = [
  { asset: 'BTC', score: 68, color: '#F7931A' },
  { asset: 'ETH', score: -22, color: '#627EEA' },
  { asset: 'SOL', score: 44, color: '#9945FF' },
  { asset: 'DOGE', score: 15, color: '#C2A633' },
];

function SentimentBadge({ sentiment }) {
  const map = {
    bullish: { color: 'var(--accent-green)', bg: 'rgba(48,209,88,0.1)', icon: '▲' },
    bearish: { color: 'var(--accent-red)',   bg: 'rgba(255,69,58,0.1)', icon: '▼' },
    neutral: { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', icon: '—' },
  };
  const s = map[sentiment] || map.neutral;
  return (
    <span style={{
      padding: '0.12rem 0.45rem', borderRadius: '4px',
      background: s.bg, color: s.color,
      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
      fontFamily: 'var(--font-mono)',
    }}>
      {s.icon} {sentiment.toUpperCase()}
    </span>
  );
}

function SentimentGauge({ asset, score, color }) {
  const [liveScore, setLiveScore] = useState(score);

  useEffect(() => {
    const iv = setInterval(() => {
      setLiveScore(prev => {
        const delta = (Math.random() - 0.5) * 4;
        return Math.max(-100, Math.min(100, prev + delta));
      });
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const label = liveScore > 20 ? 'BULLISH' : liveScore < -20 ? 'BEARISH' : 'NEUTRAL';
  const labelColor = liveScore > 20 ? 'var(--accent-green)' : liveScore < -20 ? 'var(--accent-red)' : 'var(--text-secondary)';
  const pct = ((liveScore + 100) / 200) * 100;

  return (
    <div className="glass-panel" style={{ padding: '1rem', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color }}>
          {asset}
        </span>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: labelColor, letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <div style={{
        height: '4px', background: 'rgba(255,255,255,0.08)',
        borderRadius: '2px', overflow: 'hidden', marginBottom: '0.4rem',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px',
          background: 'rgba(255,255,255,0.15)',
        }} />
        <div style={{
          position: 'absolute',
          left: liveScore >= 0 ? '50%' : `${pct}%`,
          width: `${Math.abs(liveScore) / 2}%`,
          top: 0, bottom: 0,
          background: labelColor,
          borderRadius: '2px',
          transition: 'all 0.8s ease',
        }} />
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 600,
        color: labelColor, textAlign: 'center',
      }}>
        {liveScore > 0 ? '+' : ''}{liveScore.toFixed(0)}
      </div>
    </div>
  );
}

function NewsItem({ item, isNew }) {
  const srcColor = SOURCE_COLORS[item.source] || '#888';
  const srcTextColor = SOURCE_TEXT_COLORS[item.source] || '#fff';
  const impactColor = item.impact >= 7 ? 'var(--accent-red)' : item.impact >= 5 ? 'var(--accent-orange)' : 'var(--text-secondary)';

  return (
    <div style={{
      padding: '0.75rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      animation: isNew ? 'slideInDown 0.4s ease' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.4rem' }}>
        <span style={{
          padding: '0.1rem 0.45rem', borderRadius: '4px',
          background: srcColor, color: srcTextColor,
          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.04em',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {item.source}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.45, fontWeight: 500 }}>
          {item.headline}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{item.time}</span>
        <SentimentBadge sentiment={item.sentiment} />
        <span style={{
          padding: '0.1rem 0.4rem', borderRadius: '4px',
          background: item.impact >= 7 ? 'rgba(255,69,58,0.1)' : 'rgba(255,255,255,0.05)',
          color: impactColor,
          fontSize: '0.6rem', fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>
          Impact {item.impact}/10
        </span>
        {item.assets.map(a => (
          <span key={a} style={{
            padding: '0.08rem 0.35rem', borderRadius: '3px',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary)',
            fontSize: '0.58rem', fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}>{a}</span>
        ))}
      </div>
    </div>
  );
}

const FILTERS = ['All', 'Reuters', 'Twitter', 'Reddit', 'On-Chain', 'SEC'];

export default function IntelligencePage() {
  const [news, setNews] = useState(SEED_NEWS);
  const [filter, setFilter] = useState('All');
  const [newestId, setNewestId] = useState(null);
  const [keywords, setKeywords] = useState(KEYWORDS);
  const nextId = useRef(100);

  // Add new news items every 10-14 seconds
  useEffect(() => {
    const addItem = () => {
      const template = NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)];
      const item = {
        ...template,
        id: nextId.current++,
        time: 'Just now',
      };
      setNews(prev => [item, ...prev].slice(0, 20));
      setNewestId(item.id);
      setTimeout(() => setNewestId(null), 1000);
    };

    const delay = 10000 + Math.random() * 4000;
    const t = setTimeout(function schedule() {
      addItem();
      const next = 10000 + Math.random() * 4000;
      setTimeout(schedule, next);
    }, delay);

    return () => clearTimeout(t);
  }, []);

  // Drift keywords slightly
  useEffect(() => {
    const iv = setInterval(() => {
      setKeywords(prev => prev.map(k => ({
        ...k,
        freq: Math.max(10, Math.min(100, k.freq + Math.floor((Math.random() - 0.5) * 5))),
      })));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === 'All' ? news : news.filter(n => n.source === filter);

  const alertHistory = news.filter(n => n.impact >= 7).slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Market Intelligence</h1>
        <p className="page-subtitle">
          NEXUS monitors 200+ sources around the clock. High-impact events automatically alert your trading agents.
        </p>
      </div>

      {/* Sentiment gauges */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem' }}>
        {ASSET_SENTIMENTS.map(s => (
          <SentimentGauge key={s.asset} {...s} />
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '0.85rem' }}>
        {/* Feed */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="widget-title"><Radio size={13} /> Live Intelligence Feed</span>
              <span className="live-indicator" />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '0.22rem 0.65rem', borderRadius: '20px',
                  border: filter === f
                    ? '1px solid rgba(212,175,55,0.4)'
                    : '1px solid rgba(255,255,255,0.07)',
                  background: filter === f ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)',
                  color: filter === f ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  fontSize: '0.68rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '2rem' }}>
                No items for this source
              </div>
            ) : (
              filtered.map(item => (
                <NewsItem key={item.id} item={item} isNew={item.id === newestId} />
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Hot Keywords */}
          <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
            <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
              🔥 Hot Keywords
            </div>
            {keywords.map(k => (
              <div key={k.word} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 500 }}>{k.word}</span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {k.freq}
                  </span>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: `${k.freq}%`,
                    background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))',
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Source Activity */}
          <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
            <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
              📡 Source Activity
            </div>
            {SOURCE_ACTIVITY.map(s => (
              <div key={s.name} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {s.value}%
                  </span>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: `${s.value}%`, background: s.color,
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Alert History */}
          <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
            <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
              🚨 Alert History <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.6rem', marginLeft: '0.3rem' }}>(Impact 7+)</span>
            </div>
            {alertHistory.length === 0 ? (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>No high-impact alerts yet</p>
            ) : (
              alertHistory.map(item => (
                <div key={item.id} style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700,
                      color: 'var(--accent-red)',
                      background: 'rgba(255,69,58,0.1)',
                      padding: '0.08rem 0.35rem', borderRadius: '3px',
                      flexShrink: 0,
                    }}>
                      {item.impact}/10
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                      {item.headline}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{item.time} · {item.source}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
