import React, { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Bot, Pause, Play, Settings, Plus, Trophy, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';

const MOCK_AGENTS = [
  {
    id: 'alpha-1', name: 'Alpha-1', asset: 'BTC', color: '#F7931A',
    strategy: 'Trend Following', status: 'active', position: 'long',
    positionSize: 0.018, entryPrice: 66820,
    dailyPnl: 128.40, allTimePnl: 2847.20, winRate: 71, tradesToday: 8,
    lastAction: 'Bought 0.018 BTC @ $66,820', lastActionAge: '6m ago',
  },
  {
    id: 'sigma-2', name: 'Sigma-2', asset: 'ETH', color: '#627EEA',
    strategy: 'Mean Reversion', status: 'active', position: 'flat',
    positionSize: 0, entryPrice: null,
    dailyPnl: -24.80, allTimePnl: 1204.50, winRate: 64, tradesToday: 12,
    lastAction: 'Closed ETH position @ $3,410', lastActionAge: '12m ago',
  },
  {
    id: 'delta-3', name: 'Delta-3', asset: 'SOL', color: '#9945FF',
    strategy: 'Momentum', status: 'learning', position: 'long',
    positionSize: 12, entryPrice: 149.80,
    dailyPnl: 43.20, allTimePnl: 387.60, winRate: 58, tradesToday: 5,
    lastAction: 'Bought 12 SOL @ $149.80', lastActionAge: '22m ago',
  },
  {
    id: 'omega-4', name: 'Omega-4', asset: 'DOGE', color: '#C2A633',
    strategy: 'Scalping', status: 'paused', position: 'flat',
    positionSize: 0, entryPrice: null,
    dailyPnl: 0, allTimePnl: 94.30, winRate: 55, tradesToday: 0,
    lastAction: 'Paused by user', lastActionAge: '1h ago',
  },
];

function generateSparkline(points = 30) {
  let val = 100;
  return Array.from({ length: points }, () => {
    val = val + (Math.random() - 0.48) * 4;
    return { v: Math.max(val, 80) };
  });
}

function StatusPill({ status }) {
  const map = {
    active:   { color: 'var(--accent-green)',   bg: 'rgba(48,209,88,0.1)',   label: 'Active' },
    learning: { color: 'var(--accent-orange)',  bg: 'rgba(255,159,10,0.1)',  label: 'Learning' },
    paused:   { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', label: 'Paused' },
  };
  const s = map[status] || map.paused;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.18rem 0.55rem', borderRadius: '20px',
      background: s.bg, color: s.color,
      fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em',
    }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: s.color,
        animation: status === 'active' ? 'pulseDot 2s infinite' : 'none',
      }} />
      {s.label.toUpperCase()}
    </span>
  );
}

function PositionBadge({ position }) {
  const map = {
    long:  { color: 'var(--accent-green)', bg: 'rgba(48,209,88,0.12)',   label: 'BUYING' },
    short: { color: 'var(--accent-red)',   bg: 'rgba(255,69,58,0.12)',   label: 'SELLING' },
    flat:  { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', label: 'FLAT' },
  };
  const p = map[position] || map.flat;
  return (
    <span style={{
      padding: '0.15rem 0.5rem', borderRadius: '4px',
      background: p.bg, color: p.color,
      fontSize: '0.62rem', fontWeight: 700,
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
    }}>
      {p.label}
    </span>
  );
}

function AgentCard({ agent, onTogglePause }) {
  const [sparkData] = useState(() => generateSparkline());
  const [liveDaily, setLiveDaily] = useState(agent.dailyPnl);

  useEffect(() => {
    if (agent.status !== 'active') return;
    const iv = setInterval(() => {
      setLiveDaily(prev => prev + (Math.random() - 0.46) * 2.5);
    }, 2000);
    return () => clearInterval(iv);
  }, [agent.status]);

  const pnlColor = liveDaily >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: `${agent.color}18`,
            border: `1px solid ${agent.color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={16} color={agent.color} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '0.02em',
            }}>
              {agent.name}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              {agent.strategy}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
          <StatusPill status={agent.status} />
          <span style={{
            padding: '0.12rem 0.45rem', borderRadius: '4px',
            background: `${agent.color}15`, color: agent.color,
            fontSize: '0.62rem', fontWeight: 700,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
          }}>
            {agent.asset}
          </span>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ height: '48px', margin: '0 -0.25rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <defs>
              <linearGradient id={`spark-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={agent.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={agent.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="v"
              stroke={agent.color} strokeWidth={1.5}
              fill={`url(#spark-${agent.id})`}
              dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Position */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Current Position:
        </span>
        <PositionBadge position={agent.position} />
        {agent.positionSize > 0 && agent.entryPrice && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            {agent.positionSize} {agent.asset} @ ${agent.entryPrice.toLocaleString()}
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.5rem',
        padding: '0.75rem',
        background: 'rgba(255,255,255,0.025)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        {[
          { label: 'Daily P&L', value: `${liveDaily >= 0 ? '+' : '-'}$${Math.abs(liveDaily).toFixed(2)}`, color: pnlColor },
          { label: 'All-time P&L', value: `+$${agent.allTimePnl.toFixed(2)}`, color: 'var(--accent-green)' },
          { label: 'Win Rate', value: `${agent.winRate}%`, color: agent.winRate >= 60 ? 'var(--accent-green)' : 'var(--text-secondary)' },
          { label: 'Trades Today', value: agent.tradesToday, color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Last action */}
      <div style={{
        fontSize: '0.7rem', color: 'var(--text-secondary)',
        padding: '0.5rem 0.65rem',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        borderLeft: `2px solid ${agent.color}40`,
      }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700 }}>
          Last action
        </span>
        <div style={{ marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{agent.lastAction}</span>
          <span style={{ fontSize: '0.62rem', opacity: 0.6, flexShrink: 0, marginLeft: '0.5rem' }}>{agent.lastActionAge}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => onTogglePause(agent.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.5rem',
            borderRadius: '8px',
            border: agent.status === 'paused'
              ? '1px solid rgba(48,209,88,0.25)'
              : '1px solid rgba(255,255,255,0.09)',
            background: agent.status === 'paused'
              ? 'rgba(48,209,88,0.07)'
              : 'rgba(255,255,255,0.04)',
            color: agent.status === 'paused' ? 'var(--accent-green)' : 'var(--text-secondary)',
            fontSize: '0.72rem', fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {agent.status === 'paused'
            ? <><Play size={13} /> Resume</>
            : <><Pause size={13} /> Pause</>
          }
        </button>
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--text-secondary)',
          fontSize: '0.72rem', fontWeight: 600,
          cursor: 'pointer',
        }}>
          <Settings size={13} /> Configure
        </button>
      </div>
    </div>
  );
}

const STRATEGY_COLORS = {
  MOMENTUM: '#F7931A',
  MEAN_REVERSION: '#627EEA',
  TREND_FOLLOWING: '#9945FF',
  SENTIMENT_DRIVEN: '#34C759',
  COMBINED: '#0A84FF',
};

function StrategyCard({ strategy }) {
    const totalTrades = strategy.wins + strategy.losses;
    const winRate = totalTrades > 0 ? Math.round((strategy.wins / totalTrades) * 100) : 0;
    const color = STRATEGY_COLORS[strategy.id?.split('_')[0]] || '#0A84FF';
    const statusMap = {
        active:   { color: 'var(--accent-green)',   bg: 'rgba(48,209,88,0.1)',   label: 'ACTIVE' },
        learning: { color: 'rgba(255,159,10,0.9)',  bg: 'rgba(255,159,10,0.1)',  label: 'LEARNING' },
        retired:  { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', label: 'RETIRED' },
    };
    const s = statusMap[strategy.status] || statusMap.learning;

    return (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', opacity: strategy.status === 'retired' ? 0.5 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={16} color={color} />
                    </div>
                    <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {strategy.name}
                            {strategy.generation > 1 && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: color, background: `${color}18`, padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                                    Gen {strategy.generation}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {Object.entries(strategy.parameters || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </div>
                    </div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0.55rem', borderRadius: '20px', background: s.bg, color: s.color, fontSize: '0.62rem', fontWeight: 700 }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.color }} />
                    {s.label}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.025)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                {[
                    { label: 'Win Rate',    value: `${winRate}%`,                    color: winRate >= 55 ? 'var(--accent-green)' : 'var(--text-secondary)' },
                    { label: 'Sharpe',      value: strategy.sharpe?.toFixed(2) ?? '0.00', color: strategy.sharpe > 0.5 ? 'var(--accent-green)' : 'var(--text-secondary)' },
                    { label: 'Total P&L',   value: `${strategy.totalPnlPct >= 0 ? '+' : ''}${strategy.totalPnlPct?.toFixed(1) ?? '0.0'}%`, color: strategy.totalPnlPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
                    { label: 'Trades',      value: totalTrades,                       color: 'var(--text-primary)' },
                ].map(stat => (
                    <div key={stat.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                            {stat.label}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: stat.color }}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {strategy.maxDrawdown > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Max drawdown: <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{strategy.maxDrawdown?.toFixed(1)}%</span>
                </div>
            )}
        </div>
    );
}

export default function AgentsPage() {
  const { strategies } = useStore();

  const activeStrategies = strategies.filter(s => s.status !== 'retired');
  const winner = strategies.filter(s => s.status === 'active').sort((a, b) => b.sharpe - a.sharpe)[0];

  const active = strategies.filter(s => s.status === 'active').length;
  const totalTrades = strategies.reduce((s, a) => s + a.wins + a.losses, 0);
  const avgWinRate = strategies.length
    ? Math.round(strategies.reduce((sum, s) => {
        const t = s.wins + s.losses;
        return sum + (t > 0 ? (s.wins / t) * 100 : 0);
      }, 0) / strategies.length)
    : 0;
  const bestSharpe = strategies.reduce((best, s) => Math.max(best, s.sharpe || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Strategy Tournament</h1>
        <p className="page-subtitle">
          {strategies.length > 0
            ? `${strategies.length} strategies running in parallel. The top performers get promoted. Losers get retired and replaced by evolved variants.`
            : 'Strategies initialize after first AI evaluation. Configure your API keys and start the engine.'}
        </p>
      </div>

      {strategies.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Active Strategies', value: `${active} / ${strategies.length}`, color: 'var(--accent-green)' },
              { label: 'Total Trades', value: totalTrades, color: 'var(--text-primary)' },
              { label: 'Avg Win Rate', value: `${avgWinRate}%`, color: avgWinRate >= 55 ? 'var(--accent-green)' : 'var(--accent-orange)' },
              { label: 'Best Sharpe', value: bestSharpe.toFixed(2), color: bestSharpe > 0.5 ? 'var(--accent-green)' : 'var(--text-secondary)' },
            ].map(s => (
              <div key={s.label} className="glass-panel" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 600, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {winner && (
            <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(48, 209, 88, 0.06)', border: '1px solid rgba(48, 209, 88, 0.2)', borderRadius: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Trophy size={14} color="var(--accent-green)" />
              <span>Leading Strategy:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{winner.name}</strong>
              <span>— Sharpe {winner.sharpe?.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
            {strategies.map(strategy => (
              <StrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>
        </>
      )}

      {strategies.length === 0 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <TrendingUp size={40} color="var(--text-secondary)" style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Strategy tournament initializes after the AI engine runs its first analysis.
          </div>
        </div>
      )}
    </div>
  );
}
