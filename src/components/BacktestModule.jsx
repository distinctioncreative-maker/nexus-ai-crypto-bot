import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { History, PlayCircle, SlidersHorizontal, TrendingUp, Award } from 'lucide-react';

/* ── data helpers ────────────────────────────────────────────────────────── */
function genPortfolioData(strategy, rsi, ma) {
  const mult = strategy === 'Momentum' ? 1.35 : strategy === 'Trend Following' ? 1.2 : 1.08;
  let strat = 10000, bench = 10000;
  return Array.from({ length: 120 }, (_, i) => {
    strat += (Math.sin(i / (ma || 14)) * 180 * mult) + (40 * mult) + (Math.random() - 0.42) * 260;
    bench += (Math.sin(i / 12) * 100) + 28 + (Math.random() - 0.47) * 180;
    return {
      day: `D${i + 1}`,
      strategy: Math.max(strat, 5000),
      benchmark: Math.max(bench, 5000),
    };
  });
}

function genDistribution() {
  const buckets = [
    { range: '<−20%', positive: false },
    { range: '−20%',  positive: false },
    { range: '−10%',  positive: false },
    { range: '−5%',   positive: false },
    { range: '−2%',   positive: false },
    { range: '0%',    positive: true  },
    { range: '+2%',   positive: true  },
    { range: '+5%',   positive: true  },
    { range: '+10%',  positive: true  },
    { range: '+20%',  positive: true  },
    { range: '>+20%', positive: true  },
  ];
  return buckets.map(b => ({
    ...b,
    count: b.positive
      ? Math.floor(Math.random() * 18 + 4)
      : Math.floor(Math.random() * 10 + 1),
  }));
}

/* ── animated number ─────────────────────────────────────────────────────── */
function AnimStat({ label, value, color, delay = 0 }) {
  const [disp, setDisp] = useState('—');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const num  = parseFloat(value.replace(/[^0-9.\-]/g, ''));
    const pre  = value.match(/^[^\d\-]*/)[0];
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
  const [isRunning,    setIsRunning]    = useState(false);
  const [results,      setResults]      = useState(null);
  const [strategy,     setStrategy]     = useState('Momentum');
  const [rsiPeriod,    setRsiPeriod]    = useState(14);
  const [maPeriod,     setMaPeriod]     = useState(20);
  const [riskPct,      setRiskPct]      = useState(2);
  const [testPeriod,   setTestPeriod]   = useState('1Y');
  const [baseAsset,    setBaseAsset]    = useState('BTC-USD');
  const [chartData,    setChartData]    = useState(() => genPortfolioData('Momentum', 14, 20));
  const [distribution, setDistribution] = useState([]);

  const runBacktest = () => {
    setIsRunning(true);
    setResults(null);
    setDistribution([]);

    setTimeout(() => {
      const mult       = strategy === 'Momentum' ? 1.4 : strategy === 'Trend Following' ? 1.2 : 1.0;
      const totalRet   = +(30 + Math.random() * 45 * mult).toFixed(1);
      const winRt      = +(55 + Math.random() * 25).toFixed(1);
      const drawdown   = -(7 + Math.random() * 14).toFixed(1);
      const sharpe     = +(1.1 + Math.random() * 1.6).toFixed(2);
      const calmar     = +(totalRet / Math.abs(drawdown)).toFixed(2);
      const numTrades  = Math.floor(80 + Math.random() * 180);

      setResults({ totalRet: `+${totalRet}%`, winRt: `${winRt}%`, drawdown: `${drawdown}%`, sharpe, calmar, numTrades });
      setChartData(genPortfolioData(strategy, rsiPeriod, maPeriod));
      setDistribution(genDistribution());
      setIsRunning(false);
    }, 2600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '0.85rem' }}>

        {/* ── Config Panel ── */}
        <div className="glass-panel widget" style={{ gap: '0' }}>
          <div className="widget-header">
            <span className="widget-title"><SlidersHorizontal size={13} /> Strategy Config</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', flexGrow: 1 }}>
            <ConfigRow label="Strategy Engine">
              <select value={strategy} onChange={e => setStrategy(e.target.value)} style={sel}>
                <option>Momentum</option>
                <option>Mean Reversion</option>
                <option>Trend Following</option>
              </select>
            </ConfigRow>

            <ConfigRow label={`RSI Period — ${rsiPeriod}`}>
              <input type="range" min="7" max="28" value={rsiPeriod}
                onChange={e => setRsiPeriod(+e.target.value)} style={sldr} />
            </ConfigRow>

            <ConfigRow label={`MA Period — ${maPeriod}`}>
              <input type="range" min="5" max="50" value={maPeriod}
                onChange={e => setMaPeriod(+e.target.value)} style={sldr} />
            </ConfigRow>

            <ConfigRow label={`Risk / Trade — ${riskPct}%`}>
              <input type="range" min="0.5" max="5" step="0.5" value={riskPct}
                onChange={e => setRiskPct(+e.target.value)} style={sldr} />
            </ConfigRow>

            <ConfigRow label="Test Period">
              <select value={testPeriod} onChange={e => setTestPeriod(e.target.value)} style={sel}>
                {['3M','6M','1Y','3Y'].map(p => <option key={p}>{p}</option>)}
              </select>
            </ConfigRow>

            <ConfigRow label="Base Asset">
              <select value={baseAsset} onChange={e => setBaseAsset(e.target.value)} style={sel}>
                {['BTC-USD','ETH-USD','SOL-USD'].map(a => <option key={a}>{a}</option>)}
              </select>
            </ConfigRow>

            <button onClick={runBacktest} disabled={isRunning} style={{
              marginTop: 'auto',
              background: isRunning ? 'rgba(255,255,255,0.04)' : 'var(--accent-blue)',
              color: isRunning ? 'var(--text-secondary)' : 'white',
              border: isRunning ? '1px solid rgba(255,255,255,0.06)' : 'none',
              padding: '0.7rem 1rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.82rem',
              letterSpacing: '0.01em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'all 0.2s',
            }}>
              {isRunning
                ? <><span className="live-indicator" /> Simulating {testPeriod} of data...</>
                : <><PlayCircle size={15} /> Run Backtest</>
              }
            </button>
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Portfolio chart */}
          <div className="glass-panel widget" style={{ height: '270px' }}>
            <div className="widget-header">
              <span className="widget-title"><TrendingUp size={13} /> Portfolio Performance vs Buy &amp; Hold</span>
              {results && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                  color: 'var(--accent-green)', fontWeight: 600,
                }}>
                  Strategy: {results.totalRet}
                </span>
              )}
            </div>
            <div style={{ flexGrow: 1, filter: isRunning ? 'blur(3px)' : 'none', transition: 'filter 0.35s' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--accent-blue)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6E6E73" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6E6E73" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="day" hide />
                  <YAxis
                    tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    tickLine={false} axisLine={false} stroke="transparent" width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10,10,14,0.96)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
                    }}
                    itemStyle={{ color: 'white' }}
                    formatter={v => [`$${v.toFixed(0)}`, '']}
                  />
                  <Area type="monotone" dataKey="benchmark"
                    stroke="rgba(110,110,115,0.5)" strokeWidth={1} strokeDasharray="4 4"
                    fill="url(#bgGrad)" dot={false} isAnimationActive={false} name="Buy & Hold"
                  />
                  <Area type="monotone" dataKey="strategy"
                    stroke="var(--accent-blue)" strokeWidth={2}
                    fill="url(#sgGrad)" dot={false} isAnimationActive={false} name={strategy}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Results stats */}
          {results && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 1.4fr', gap: '0.75rem' }}>
              <AnimStat label="Total Return"  value={results.totalRet}  color="var(--accent-green)" delay={0} />
              <AnimStat label="Win Rate"      value={results.winRt}     color="var(--text-primary)"  delay={80} />
              <AnimStat label="Max Drawdown"  value={results.drawdown}  color="var(--accent-red)"    delay={160} />
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '1rem',
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem',
                animation: 'fadeInUp 0.4s ease 240ms both',
              }}>
                <MiniStat label="Sharpe"  value={results.sharpe} />
                <MiniStat label="Calmar"  value={results.calmar} />
                <MiniStat label="Trades"  value={results.numTrades} />
              </div>
            </div>
          )}

          {/* Trade distribution */}
          {distribution.length > 0 && (
            <div className="glass-panel widget" style={{ height: '190px', animation: 'fadeInUp 0.4s ease 320ms both' }}>
              <div className="widget-header">
                <span className="widget-title"><Award size={13} /> Trade Return Distribution</span>
              </div>
              <div style={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} margin={{ top: 0, right: 5, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="range"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 8, fontFamily: 'JetBrains Mono' }}
                      tickLine={false} axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                      tickLine={false} axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(10,10,14,0.96)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', fontSize: '0.72rem',
                      }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {distribution.map((d, i) => (
                        <Cell key={i}
                          fill={d.positive ? 'var(--accent-green)' : 'var(--accent-red)'}
                          fillOpacity={0.72}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!results && !isRunning && (
            <div className="glass-panel" style={{
              padding: '2rem', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem',
              borderStyle: 'dashed', opacity: 0.6,
            }}>
              Configure your strategy and click Run Backtest to generate a report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
