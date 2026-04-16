import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Radio, TrendingUp, TrendingDown, Brain, BarChart2, Percent, RefreshCw, ExternalLink } from 'lucide-react';
import { authFetch } from '../lib/supabase';
import { apiUrl } from '../lib/api';

const SOURCE_COLORS = {
  Reuters: '#CC2936',
  Bloomberg: '#F5F5F5',
  CoinDesk: '#1E88E5',
  CoinTelegraph: '#1565C0',
  Decrypt: '#7C3AED',
  'The Block': '#F59E0B',
  Cointelegraph: '#1565C0',
  Messari: '#6366F1',
};
const SOURCE_TEXT_COLORS = { Bloomberg: '#000' };

const ASSET_COLORS = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF',
  DOGE: '#C2A633', XRP: '#00AAE4', ADA: '#0033AD',
};

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','was','are','were','be','been','has','have','had',
  'will','would','could','should','may','might','this','that','these',
  'those','it','its','not','no','new','said','says','after','over',
  'more','than','up','down','out','into','about','$','billion','million',
]);

function SentimentBadge({ sentiment }) {
  const map = {
    bullish: { color: 'var(--accent-green)', bg: 'rgba(48,209,88,0.1)', icon: '▲' },
    bearish: { color: 'var(--accent-red)',   bg: 'rgba(255,69,58,0.1)',  icon: '▼' },
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

function NewsItem({ item, isNew }) {
  const srcColor = SOURCE_COLORS[item.source] || '#555';
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
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.45, fontWeight: 500,
            textDecoration: 'none', display: 'flex', alignItems: 'flex-start', gap: '0.3rem',
          }}>
            {item.headline}
            <ExternalLink size={10} style={{ flexShrink: 0, marginTop: '3px', opacity: 0.4 }} />
          </a>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.45, fontWeight: 500 }}>
            {item.headline}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{item.time}</span>
        <SentimentBadge sentiment={item.sentiment} />
        <span style={{
          padding: '0.1rem 0.4rem', borderRadius: '4px',
          background: item.impact >= 7 ? 'rgba(255,69,58,0.1)' : 'rgba(255,255,255,0.05)',
          color: impactColor, fontSize: '0.6rem', fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>
          Impact {item.impact}/10
        </span>
        {item.assets.map(a => (
          <span key={a} style={{
            padding: '0.08rem 0.35rem', borderRadius: '3px',
            background: `${ASSET_COLORS[a] || '#888'}18`,
            color: ASSET_COLORS[a] || 'var(--text-secondary)',
            fontSize: '0.58rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>{a}</span>
        ))}
      </div>
    </div>
  );
}

function SentimentGauge({ asset, score, color }) {
  const label = score > 20 ? 'BULLISH' : score < -20 ? 'BEARISH' : 'NEUTRAL';
  const labelColor = score > 20 ? 'var(--accent-green)' : score < -20 ? 'var(--accent-red)' : 'var(--text-secondary)';
  const pct = ((score + 100) / 200) * 100;

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
          left: score >= 0 ? '50%' : `${pct}%`,
          width: `${Math.abs(score) / 2}%`,
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
        {score > 0 ? '+' : ''}{score}
      </div>
    </div>
  );
}

// Derive asset sentiment scores from real news vote ratios
function deriveAssetSentiments(news) {
  const assets = ['BTC', 'ETH', 'SOL', 'DOGE'];
  return assets.map(asset => {
    const relevant = news.filter(n => n.assets.includes(asset));
    if (relevant.length === 0) return { asset, score: 0, color: ASSET_COLORS[asset] || '#888' };
    const bullish = relevant.filter(n => n.sentiment === 'bullish').length;
    const bearish = relevant.filter(n => n.sentiment === 'bearish').length;
    const total = relevant.length;
    const score = Math.round(((bullish - bearish) / total) * 100);
    return { asset, score: Math.max(-100, Math.min(100, score)), color: ASSET_COLORS[asset] || '#888' };
  });
}

// Extract top keywords from real headlines
function extractKeywords(news) {
  const freq = {};
  news.forEach(item => {
    const words = item.headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    words.forEach(w => {
      if (w.length >= 4 && !STOP_WORDS.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({
      word,
      freq: Math.min(100, Math.round((count / Math.max(...Object.values(freq))) * 100))
    }));
}

// Compute source activity percentages from real news
function computeSourceActivity(news) {
  const counts = {};
  news.forEach(n => { counts[n.source] = (counts[n.source] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      name,
      value: Math.round((count / max) * 100),
      color: SOURCE_COLORS[name] || '#888'
    }));
}

export default function IntelligencePage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filter, setFilter] = useState('All');
  const [newestId, setNewestId] = useState(null);
  const [realSignals, setRealSignals] = useState(null);

  const fetchNews = () => {
    authFetch(apiUrl('/api/news'))
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setNews(prev => {
            // Highlight genuinely new items
            const prevIds = new Set(prev.map(n => n.id));
            const newItems = data.filter(n => !prevIds.has(n.id));
            if (newItems.length > 0) setNewestId(newItems[0].id);
            setTimeout(() => setNewestId(null), 1500);
            return data;
          });
          setLastUpdated(new Date());
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchNews();
    authFetch(apiUrl('/api/signals')).then(r => r.json()).then(setRealSignals).catch(() => {});

    const newsInterval = setInterval(fetchNews, 10 * 60 * 1000);
    const signalInterval = setInterval(() => {
      authFetch(apiUrl('/api/signals')).then(r => r.json()).then(setRealSignals).catch(() => {});
    }, 5 * 60 * 1000);

    return () => { clearInterval(newsInterval); clearInterval(signalInterval); };
  }, []);

  const assetSentiments = useMemo(() => deriveAssetSentiments(news), [news]);
  const keywords = useMemo(() => extractKeywords(news), [news]);
  const sourceActivity = useMemo(() => computeSourceActivity(news), [news]);

  const sources = useMemo(() => ['All', ...new Set(news.map(n => n.source))].slice(0, 7), [news]);
  const filtered = filter === 'All' ? news : news.filter(n => n.source === filter);
  const alertHistory = news.filter(n => n.impact >= 7).slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Market Intelligence</h1>
        <p className="page-subtitle">
          Live crypto news, on-chain signals, and multi-source sentiment — all feeding the AI in real time.
        </p>
      </div>

      {/* Real Market Signals */}
      {realSignals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {realSignals.fearGreed && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Brain size={12} /> Fear & Greed Index
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: realSignals.fearGreed.value < 30 ? 'var(--accent-green)' : realSignals.fearGreed.value > 70 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
                {realSignals.fearGreed.value}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {realSignals.fearGreed.classification}
              </div>
            </div>
          )}
          {realSignals.tvl && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <BarChart2 size={12} /> DeFi TVL 7d Change
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: realSignals.tvl.changePct > 0 ? 'var(--accent-green)' : 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {realSignals.tvl.changePct > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                {realSignals.tvl.changePct > 0 ? '+' : ''}{realSignals.tvl.changePct}%
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>DeFi Capital Flow</div>
            </div>
          )}
          {realSignals.polymarket && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Percent size={12} /> Polymarket BTC Bull
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: realSignals.polymarket.bullProb > 0.5 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {(realSignals.polymarket.bullProb * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Prediction Market
              </div>
            </div>
          )}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              AI Composite Signal
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: realSignals.compositeScore > 0 ? 'var(--accent-green)' : realSignals.compositeScore < 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
              {realSignals.compositeScore > 0 ? '+' : ''}{realSignals.compositeScore}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {realSignals.compositeScore > 20 ? 'Bullish' : realSignals.compositeScore < -20 ? 'Bearish' : 'Neutral'} bias
            </div>
          </div>
        </div>
      )}

      {/* Asset sentiment gauges derived from real news */}
      {assetSentiments.length > 0 && (
        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {assetSentiments.map(s => (
            <SentimentGauge key={s.asset} {...s} />
          ))}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '0.85rem' }}>
        {/* Live Feed */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="widget-title"><Radio size={13} /> Live Intelligence Feed</span>
              {!loading && <span className="live-indicator" />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {lastUpdated && (
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                  Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 60000)}m ago
                </span>
              )}
              <button
                onClick={fetchNews}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', padding: '0.1rem',
                  display: 'flex', alignItems: 'center',
                }}
                title="Refresh news"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {/* Source Filters (derived from real data) */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            {sources.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '0.22rem 0.65rem', borderRadius: '20px',
                  border: filter === f ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.07)',
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
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '3rem' }}>
                <RefreshCw size={20} style={{ marginBottom: '0.5rem', opacity: 0.4, animation: 'spin 1s linear infinite' }} />
                <div>Fetching live news…</div>
              </div>
            ) : filtered.length === 0 ? (
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
          {/* Hot Keywords from real headlines */}
          {keywords.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
                🔥 Trending Terms
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
          )}

          {/* Source Activity from real counts */}
          {sourceActivity.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
                📡 Source Activity
              </div>
              {sourceActivity.map(s => (
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
          )}

          {/* High Impact Alerts */}
          <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
            <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
              🚨 High Impact <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.6rem', marginLeft: '0.3rem' }}>(Impact 7+)</span>
            </div>
            {alertHistory.length === 0 ? (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {loading ? 'Loading…' : 'No high-impact stories right now'}
              </p>
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
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                    {item.time} · {item.source}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
