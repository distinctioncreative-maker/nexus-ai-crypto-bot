import React, { useState } from 'react';
import { Brain, Zap, Shield, BarChart2, Terminal, CheckCircle } from 'lucide-react';

/* ── static data ─────────────────────────────────────────────────────────── */
const STRATEGIES = [
  {
    id: 'aggressive',
    name: 'Aggressive',
    icon: Zap,
    color: 'var(--accent-red)',
    dimColor: 'rgba(255,69,58,0.09)',
    borderColor: 'rgba(255,69,58,0.28)',
    desc: 'High-frequency execution with oversized positions. Optimised for maximum alpha in trending regimes.',
    stats: { 'Trades/day': '45–80', Leverage: '3–5×', Risk: 'High' },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    icon: BarChart2,
    color: 'var(--accent-blue)',
    dimColor: 'rgba(10,132,255,0.09)',
    borderColor: 'rgba(10,132,255,0.28)',
    desc: 'Optimal risk-reward with diversified entries. Consistent performance across all market conditions.',
    stats: { 'Trades/day': '15–30', Leverage: '1–2×', Risk: 'Medium' },
  },
  {
    id: 'conservative',
    name: 'Conservative',
    icon: Shield,
    color: 'var(--accent-green)',
    dimColor: 'rgba(48,209,88,0.09)',
    borderColor: 'rgba(48,209,88,0.28)',
    desc: 'Capital preservation first. Low drawdown, high-quality setups only. Ideal for bear markets.',
    stats: { 'Trades/day': '3–8', Leverage: '1×', Risk: 'Low' },
  },
];

const DECISION_LOG = [
  { time: '14:32:18', type: 'SIGNAL',   text: 'BTC/USD RSI(14) crossed below 70 — exiting partial long position',         result: 'EXECUTED' },
  { time: '13:58:44', type: 'ANALYSIS', text: 'Cross-asset correlation matrix updated — BTC/ETH: 0.87',                   result: null },
  { time: '13:22:09', type: 'ORDER',    text: 'Limit buy placed: ETH @ $3,380.00 (0.500 ETH)',                            result: 'FILLED' },
  { time: '12:45:33', type: 'SIGNAL',   text: 'SOL/USD momentum divergence detected — initiating long entry',             result: 'EXECUTED' },
  { time: '12:10:02', type: 'ANALYSIS', text: 'News sentiment scan complete: neutral (0.12) — no macro catalysts',        result: null },
  { time: '11:38:55', type: 'ORDER',    text: 'Trailing stop updated: BTC long → $66,200 (1.5% trail)',                   result: 'SET' },
  { time: '11:05:17', type: 'SIGNAL',   text: 'MACD histogram positive divergence on BTC 4H — adding to position',        result: 'EXECUTED' },
  { time: '10:30:00', type: 'SYSTEM',   text: 'Daily rebalance: BTC 60% / ETH 25% / SOL 10% / USDC 5%',                  result: 'DONE' },
  { time: '09:45:11', type: 'ANALYSIS', text: 'Volatility regime: low (ATR normalised 0.34) — tightening entries',        result: null },
  { time: '09:15:00', type: 'SYSTEM',   text: 'Neural engine initialized. Monitoring 4 assets on 5 timeframes.',          result: 'OK' },
];

const TYPE_COLOR = {
  SIGNAL:   'var(--accent-blue)',
  ANALYSIS: 'var(--accent-purple)',
  ORDER:    'var(--accent-orange)',
  SYSTEM:   'var(--text-secondary)',
};

const RESULT_COLOR = {
  EXECUTED: 'var(--accent-green)',
  FILLED:   'var(--accent-green)',
  SET:      'var(--accent-blue)',
  DONE:     'var(--text-secondary)',
  OK:       'var(--accent-green)',
};

/* ── sub-components ──────────────────────────────────────────────────────── */
function Toggle({ value, onChange, color = 'var(--accent-green)' }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 42, height: 22,
        borderRadius: 11,
        background: value ? color : 'rgba(255,255,255,0.08)',
        border: `1px solid ${value ? color : 'rgba(255,255,255,0.1)'}`,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.18s ease, border-color 0.18s ease',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2, left: value ? 21 : 2,
        width: 16, height: 16,
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        transition: 'left 0.18s ease',
      }} />
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 1, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(+e.target.value)}
        style={{
          width: 74,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          color: 'var(--text-primary)',
          padding: '0.35rem 0.6rem',
          fontSize: '0.82rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          textAlign: 'center',
          outline: 'none',
        }}
      />
      {suffix && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{suffix}</span>
      )}
    </div>
  );
}

function SettingRow({ label, sub, right }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.8rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ── main ────────────────────────────────────────────────────────────────── */
export default function AIConfigPage({ isConnected }) {
  const [strategy,       setStrategy]       = useState('balanced');
  const [autoTrading,    setAutoTrading]    = useState(false);
  const [stopLoss,       setStopLoss]       = useState(true);
  const [takeProfit,     setTakeProfit]     = useState(true);
  const [maxSize,        setMaxSize]        = useState(500);
  const [slPct,          setSlPct]          = useState(2.5);
  const [tpPct,          setTpPct]          = useState(5.0);

  const selected = STRATEGIES.find(s => s.id === strategy);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

      {/* ── Strategy cards ── */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div className="widget-title" style={{ marginBottom: '1rem' }}>
          <Brain size={13} /> Trading Strategy
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {STRATEGIES.map(s => {
            const Icon     = s.icon;
            const selected = strategy === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setStrategy(s.id)}
                style={{
                  padding: '1.2rem',
                  borderRadius: '14px',
                  border: `1px solid ${selected ? s.borderColor : 'rgba(255,255,255,0.065)'}`,
                  background: selected ? s.dimColor : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {selected && (
                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <CheckCircle size={15} color={s.color} />
                  </div>
                )}
                <Icon size={20} color={s.color} style={{ marginBottom: '0.7rem', display: 'block' }} />
                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                  {s.name}
                </div>
                <div style={{
                  fontSize: '0.72rem', color: 'var(--text-secondary)',
                  lineHeight: 1.5, marginBottom: '0.8rem',
                }}>
                  {s.desc}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {Object.entries(s.stats).map(([k, v]) => (
                    <div key={k} style={{
                      fontSize: '0.62rem',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{k}: </span>
                      <span style={{ color: selected ? s.color : 'var(--text-primary)', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Settings + Log ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: '0.85rem' }}>

        {/* Settings panel */}
        <div className="glass-panel widget">
          <div className="widget-header">
            <span className="widget-title">Risk Controls</span>
          </div>

          <div style={{ flexGrow: 1 }}>
            <SettingRow
              label="Auto-Trading"
              sub="Allow AI to place and close orders automatically"
              right={<Toggle value={autoTrading} onChange={setAutoTrading} color="var(--accent-green)" />}
            />
            <SettingRow
              label="Stop Loss"
              sub="Automatically exit losing positions"
              right={<Toggle value={stopLoss} onChange={setStopLoss} />}
            />
            <SettingRow
              label="Take Profit"
              sub="Automatically close winning positions"
              right={<Toggle value={takeProfit} onChange={setTakeProfit} />}
            />
            <SettingRow
              label="Max Position Size"
              sub="Upper limit per individual trade"
              right={<NumInput value={maxSize} onChange={setMaxSize} min={50} max={5000} step={50} suffix="USD" />}
            />
            {stopLoss && (
              <SettingRow
                label="Stop Loss Threshold"
                sub="Exit position at this % loss"
                right={<NumInput value={slPct} onChange={setSlPct} min={0.5} max={20} step={0.5} suffix="%" />}
              />
            )}
            {takeProfit && (
              <SettingRow
                label="Take Profit Target"
                sub="Close position at this % gain"
                right={<NumInput value={tpPct} onChange={setTpPct} min={1} max={50} step={0.5} suffix="%" />}
              />
            )}
          </div>

          {/* Stats footer */}
          <div style={{
            marginTop: 'auto', paddingTop: '0.9rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
          }}>
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Active Since
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, marginTop: '0.2rem' }}>
                Apr 1, 2026
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Total Decisions
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, marginTop: '0.2rem' }}>
                1,284
              </div>
            </div>
          </div>
        </div>

        {/* Terminal log */}
        <div className="glass-panel widget" style={{
          background: 'rgba(6,6,10,0.92)',
          borderColor: 'rgba(191,90,242,0.12)',
        }}>
          <div className="widget-header">
            <span className="widget-title" style={{ color: 'var(--accent-purple)' }}>
              <Terminal size={13} /> Decision Log
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
              color: 'rgba(191,90,242,0.55)',
            }}>
              NEXUS v2.3.1 · {selected?.name} mode
            </span>
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            flexGrow: 1,
            overflowY: 'auto',
          }}>
            {/* Boot line */}
            <div style={{
              color: 'rgba(191,90,242,0.45)',
              fontSize: '0.65rem',
              marginBottom: '0.75rem',
              lineHeight: 1.5,
            }}>
              {'>'} Neural engine online. Strategy: <span style={{ color: selected?.color }}>{selected?.name}</span>.
              Monitoring BTC, ETH, SOL, DOGE.{isConnected ? ' Exchange: CONNECTED.' : ' Exchange: DISCONNECTED.'}
            </div>

            {DECISION_LOG.map((entry, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '68px 84px 1fr 72px',
                gap: '0.6rem',
                alignItems: 'flex-start',
                padding: '0.42rem 0',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                <span style={{ color: 'rgba(142,142,147,0.45)', fontSize: '0.62rem' }}>
                  {entry.time}
                </span>
                <span style={{
                  color: TYPE_COLOR[entry.type],
                  fontSize: '0.62rem', fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  [{entry.type}]
                </span>
                <span style={{
                  color: 'rgba(255,255,255,0.58)',
                  lineHeight: 1.45, fontSize: '0.7rem',
                }}>
                  {entry.text}
                </span>
                <span style={{
                  color: entry.result ? RESULT_COLOR[entry.result] : 'transparent',
                  fontSize: '0.62rem', fontWeight: 700,
                  letterSpacing: '0.04em', textAlign: 'right',
                }}>
                  {entry.result ?? ''}
                </span>
              </div>
            ))}

            {/* Blinking cursor */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              marginTop: '0.6rem',
              color: 'rgba(191,90,242,0.55)',
              fontSize: '0.7rem',
            }}>
              <span>{'>'}</span>
              <span style={{
                display: 'inline-block',
                width: 2, height: '1em',
                background: 'var(--accent-purple)',
                borderRadius: 1,
                animation: 'blink 1s step-end infinite',
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
