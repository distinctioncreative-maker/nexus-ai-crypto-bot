import React, { useState, useRef } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { PlayCircle, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { authFetch } from '../lib/supabase';
import { apiUrl } from '../lib/api';

/* ── animated number ─────────────────────────────────────────────────────── */
function AnimStat({ label, value, color, delay = 0 }) {
  const [disp, setDisp] = useState('—');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const num  = parseFloat(value.replace(/[^0-9.-]/g, ''));
    const pre  = value.match(/^[^\d-]*/)[0];
    const suf  = value.match(/[^\d.]*$/)[0];
    if (isNaN(num)) { setDisp(value); return; }

    let cur = 0;
    const steps   = 60;
    const inc     = num / steps;
    const iv = setInterval(() => {
      cur += inc;
      if (Math.abs(cur) >= Math.abs(num)) { setDisp(value); clearInterval(iv); }
      else setDisp(`${pre}${cur.toFixed(1)}${suf}`);
    }, 1200 / steps);
    return () => clearInterval(iv);
  }, [value]);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px', padding: '1rem',
      animation: `fadeInUp 0.4s ease ${delay}ms both`,
    }}>
      <div style={{
        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem',
      }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>
        {disp}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 700, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
  );
}

function ConfigRow({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const sel = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  padding: '0.45rem 0.65rem',
  fontSize: '0.8rem',
  fontFamily: 'var(--font-ui)',
  outline: 'none', cursor: 'pointer',
};

const sldr = {
  width: '100%',
  accentColor: 'var(--accent-blue)',
  cursor: 'pointer',
  height: '4px',
};

/* ── main component ───────────────────────────────────────────────────────── */
export default function BacktestModule() {
  const [isRunning,  setIsRunning]  = useState(false);
  const [results,    setResults]    = useState(null);
  const [error,      setError]      = useState(null);
  const [strategy,   setStrategy]   = useState('COMBINED');
  const [days,       setDays]       = useState('30');
  const [baseAsset,  setBaseAsset]  = useState('BTC-USD');

  const runBacktest = async () => {
    setIsRunning(true);
    setResults(null);
    setError(null);

    try {
      const res = await authFetch(
        apiUrl(`/api/backtest?productId=${baseAsset}&days=${days}&strategy=${strategy}`)
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (err) {
      setError(err.message || 'Backtest failed');
    } finally {
      setIsRunning(false);
    }
  };

  const sel = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    padding: '0.45rem 0.65rem',
    fontSize: '0.8rem',
    outline: 'none', cursor: 'pointer',
  };

  const trainEquity = results?.train?.equityCurve?.map((p, i) => ({ i, value: p.value })) || [];
  const testEquity  = results?.test?.equityCurve?.map((p, i) => ({ i, value: p.value })) || [];

  function ResultBlock({ label, data }) {
    if (!data) return null;
    const color = data.totalReturnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    return (
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {[
            { l: 'Return',    v: `${data.totalReturnPct >= 0 ? '+' : ''}${data.totalReturnPct}%`, c: color },
            { l: 'Win Rate',  v: `${data.winRate}%`,                c: data.winRate >= 50 ? 'var(--accent-green)' : 'var(--accent-red)' },
            { l: 'Drawdown',  v: `-${data.maxDrawdownPct}%`,        c: 'var(--accent-red)' },
            { l: 'Sharpe',    v: data.annualizedSharpe,             c: data.annualizedSharpe > 0.5 ? 'var(--accent-green)' : 'var(--text-secondary)' },
            { l: 'P Factor',  v: data.profitFactor >= 999 ? '∞' : data.profitFactor, c: 'var(--text-primary)' },
            { l: 'Trades',    v: data.totalTrades,                  c: 'var(--text-primary)' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{s.l}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '0.85rem' }}>

        {/* Config Panel */}
        <div className="glass-panel widget" style={{ gap: '0' }}>
          <div className="widget-header">
            <span className="widget-title"><SlidersHorizontal size={13} /> Backtest Config</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', flexGrow: 1 }}>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Strategy</div>
              <select value={strategy} onChange={e => setStrategy(e.target.value)} style={sel}>
                <option value="MOMENTUM">Momentum MA Cross</option>
                <option value="MEAN_REVERSION">Mean Reversion RSI</option>
                <option value="TREND_FOLLOWING">Trend Following EMA</option>
                <option value="COMBINED">Combined Signal</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Period</div>
              <select value={days} onChange={e => setDays(e.target.value)} style={sel}>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Asset</div>
              <select value={baseAsset} onChange={e => setBaseAsset(e.target.value)} style={sel}>
                {['BTC-USD','ETH-USD','SOL-USD','DOGE-USD','XRP-USD','ADA-USD','LINK-USD','LTC-USD'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ padding: '0.6rem', background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)', borderRadius: '8px', fontSize: '0.7rem', color: 'rgba(255,159,10,0.8)', lineHeight: 1.5 }}>
              Walk-forward: 80% train / 20% unseen test data. Fees: 0.6% taker. Slippage: 0.1%. No look-ahead bias.
            </div>

            <button onClick={runBacktest} disabled={isRunning} style={{
              marginTop: 'auto',
              background: isRunning ? 'rgba(255,255,255,0.04)' : 'var(--accent-blue)',
              color: isRunning ? 'var(--text-secondary)' : 'white',
              border: isRunning ? '1px solid rgba(255,255,255,0.06)' : 'none',
              padding: '0.7rem 1rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              cursor: isRunning ? 'not-allowed' : 'pointer'
            }}>
              {isRunning ? <><span className="live-indicator" /> Fetching real OHLCV…</> : <><PlayCircle size={15} /> Run Backtest</>}
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {error && (
            <div style={{ padding: '1rem', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: '10px', color: 'var(--accent-red)', fontSize: '0.8rem' }}>
              {error}
            </div>
          )}

          {results && (
            <>
              {/* Equity curves */}
              {trainEquity.length > 0 && (
                <div className="glass-panel widget" style={{ height: '240px' }}>
                  <div className="widget-header">
                    <span className="widget-title"><TrendingUp size={13} /> Training Period Equity Curve ({results.strategy})</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: results.train.totalReturnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                      {results.train.totalReturnPct >= 0 ? '+' : ''}{results.train.totalReturnPct}%
                    </span>
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trainEquity} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="trainGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="i" hide />
                        <YAxis tickFormatter={v => `$${(v/1000).toFixed(1)}k`} tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(10,10,14,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.72rem' }} formatter={v => [`$${v.toFixed(0)}`, 'Portfolio']} />
                        <Area type="monotone" dataKey="value" stroke="var(--accent-blue)" strokeWidth={2} fill="url(#trainGrad)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Stats side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <ResultBlock label={`Training (${Math.floor(results.totalCandles * 0.8)} candles)`} data={results.train} />
                <ResultBlock label={`Walk-Forward Test (${results.totalCandles - Math.floor(results.totalCandles * 0.8)} candles — unseen)`} data={results.test} />
              </div>

              {testEquity.length > 0 && (
                <div className="glass-panel widget" style={{ height: '200px' }}>
                  <div className="widget-header">
                    <span className="widget-title"><TrendingUp size={13} /> Out-of-Sample Test Period</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: results.test.totalReturnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                      {results.test.totalReturnPct >= 0 ? '+' : ''}{results.test.totalReturnPct}% (unseen data)
                    </span>
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={testEquity} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="testGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={results.test.totalReturnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} stopOpacity={0.25} />
                            <stop offset="95%" stopColor="transparent" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="i" hide />
                        <YAxis tickFormatter={v => `$${(v/1000).toFixed(1)}k`} tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(10,10,14,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.72rem' }} formatter={v => [`$${v.toFixed(0)}`, 'Portfolio']} />
                        <Area type="monotone" dataKey="value" stroke={results.test.totalReturnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth={2} fill="url(#testGrad)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {!results && !isRunning && !error && (
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', borderStyle: 'dashed', opacity: 0.6 }}>
              Select strategy and asset, then click Run Backtest. Fetches real OHLCV from CoinGecko.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
