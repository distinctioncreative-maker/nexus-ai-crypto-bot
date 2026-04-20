import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Bot, Trophy, TrendingUp, TrendingDown, Minus, BookOpen } from 'lucide-react';
import { useStore } from '../store/useStore';

const STRATEGY_COLORS = {
  MOMENTUM:        '#F7931A',
  MEAN_REVERSION:  '#627EEA',
  TREND_FOLLOWING: '#9945FF',
  SENTIMENT_DRIVEN:'#34C759',
  COMBINED:        '#0A84FF',
};

const STRATEGY_APPROACHES = {
  MOMENTUM:        'Detects trending momentum using fast/slow MA crossover. Buys when short-term average rises above long-term.',
  MEAN_REVERSION:  'Fades extremes using RSI. Buys oversold conditions, sells overbought — bets on price returning to mean.',
  TREND_FOLLOWING: 'Rides sustained trends with EMA cloud. Enters when price breaks meaningfully above/below the moving average.',
  SENTIMENT_DRIVEN:'Blends Fear & Greed index with RSI. Adjusts bias based on macro sentiment alongside technical signals.',
  COMBINED:        'Weighted blend of MA trend, RSI, and composite sentiment. The meta-strategy that synthesises all signals.',
};

const SIGNAL_COLORS = {
  BUY:  { color: 'var(--accent-green)', bg: 'rgba(48,209,88,0.12)',   label: 'BUY' },
  SELL: { color: 'var(--accent-red)',   bg: 'rgba(255,69,58,0.12)',   label: 'SELL' },
  HOLD: { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', label: 'HOLD' },
};

const INITIAL_CAPITAL = 100000;

function baseStrategyId(id = '') {
  return id.split('_GEN')[0];
}

function SignalBadge({ signal }) {
  const s = SIGNAL_COLORS[signal] || SIGNAL_COLORS.HOLD;
  const Icon = signal === 'BUY' ? TrendingUp : signal === 'SELL' ? TrendingDown : Minus;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.15rem 0.5rem', borderRadius: '4px',
      background: s.bg, color: s.color,
      fontSize: '0.62rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
    }}>
      <Icon size={10} />
      {s.label}
    </span>
  );
}

function EquitySparkline({ closedTrades, color }) {
  const data = useMemo(() => {
    let equity = INITIAL_CAPITAL;
    const points = [{ v: equity }];
    const sorted = [...closedTrades].reverse().slice(0, 40);
    for (const trade of sorted) {
      equity += trade.pnl || 0;
      points.push({ v: Math.max(equity, 0) });
    }
    return points;
  }, [closedTrades]);

  if (data.length < 2) {
    return (
      <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.5 }}>Awaiting first trades…</span>
      </div>
    );
  }

  return (
    <div style={{ height: '48px', margin: '0 -0.25rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone" dataKey="v"
            stroke={color} strokeWidth={1.5}
            fill={`url(#spark-${color.replace('#', '')})`}
            dot={false} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StrategyCard({ strategy, isLeader }) {
  const color = STRATEGY_COLORS[baseStrategyId(strategy.id)] || '#0A84FF';
  const approach = STRATEGY_APPROACHES[baseStrategyId(strategy.id)] || '';

  const totalTrades = strategy.wins + strategy.losses;
  const winRate = totalTrades > 0 ? Math.round((strategy.wins / totalTrades) * 100) : 0;

  const shadow = strategy.shadowPortfolio || {};
  const equity = shadow.equity ?? INITIAL_CAPITAL;
  const equityGain = equity - INITIAL_CAPITAL;
  const equityGainPct = ((equityGain / INITIAL_CAPITAL) * 100).toFixed(2);
  const isLong = (shadow.holdings ?? 0) > 0;

  const statusMap = {
    active:   { color: 'var(--accent-green)',   bg: 'rgba(48,209,88,0.1)',   label: 'ACTIVE' },
    learning: { color: 'rgba(255,159,10,0.9)',  bg: 'rgba(255,159,10,0.1)',  label: 'LEARNING' },
    retired:  { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', label: 'RETIRED' },
  };
  const statusStyle = statusMap[strategy.status] || statusMap.learning;

  const lessons = Array.isArray(strategy.lessons) ? strategy.lessons.slice(0, 3) : [];
  const closedTrades = shadow.closedTrades || [];

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        opacity: strategy.status === 'retired' ? 0.55 : 1,
        border: isLeader ? '1px solid rgba(48,209,88,0.35)' : undefined,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: `${color}18`, border: `1px solid ${color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <Bot size={16} color={color} />
            {isLeader && (
              <Trophy size={10} color="var(--accent-green)"
                style={{ position: 'absolute', top: '-4px', right: '-4px' }} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {strategy.name}
              </span>
              {strategy.generation > 1 && (
                <span style={{ fontSize: '0.6rem', color, background: `${color}18`, padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 700 }}>
                  Gen {strategy.generation}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              {Object.entries(strategy.parameters || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.18rem 0.55rem', borderRadius: '20px',
            background: statusStyle.bg, color: statusStyle.color,
            fontSize: '0.62rem', fontWeight: 700,
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusStyle.color,
              animation: strategy.status === 'active' ? 'pulseDot 2s infinite' : 'none' }} />
            {statusStyle.label}
          </span>
          {strategy.lastSignal && <SignalBadge signal={strategy.lastSignal} />}
        </div>
      </div>

      {/* Approach */}
      <div style={{
        fontSize: '0.68rem', color: 'var(--text-secondary)',
        lineHeight: '1.4', borderLeft: `2px solid ${color}40`,
        paddingLeft: '0.6rem',
      }}>
        {approach}
      </div>

      {/* Equity sparkline */}
      <EquitySparkline closedTrades={closedTrades} color={color} />

      {/* Shadow portfolio row */}
      <div style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        padding: '0.55rem 0.7rem',
        background: 'rgba(255,255,255,0.025)',
        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Shadow Portfolio
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equity</div>
            <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: equityGain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              ${equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              <span style={{ fontSize: '0.62rem', marginLeft: '0.25rem', opacity: 0.8 }}>
                ({equityGain >= 0 ? '+' : ''}{equityGainPct}%)
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Position</div>
            <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: isLong ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
              {isLong ? `LONG` : 'FLAT'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.5rem', padding: '0.65rem',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)',
      }}>
        {[
          { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 55 ? 'var(--accent-green)' : winRate >= 45 ? 'var(--accent-orange)' : 'var(--accent-red)' },
          { label: 'Sharpe',   value: (strategy.sharpe ?? 0).toFixed(2), color: (strategy.sharpe ?? 0) > 0.5 ? 'var(--accent-green)' : 'var(--text-secondary)' },
          { label: 'Trades',   value: totalTrades, color: 'var(--text-primary)' },
          { label: 'Drawdown', value: `${(strategy.maxDrawdown ?? 0).toFixed(1)}%`, color: (strategy.maxDrawdown ?? 0) > 10 ? 'var(--accent-red)' : 'var(--text-secondary)' },
        ].map(stat => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.56rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              {stat.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Lessons */}
      {lessons.length > 0 && (
        <div style={{
          padding: '0.6rem 0.75rem',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '8px',
          borderLeft: `2px solid ${color}35`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
            <BookOpen size={11} color={color} />
            <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color }}>
              Agent Lessons
            </span>
          </div>
          {lessons.map((lesson, i) => (
            <div key={i} style={{
              fontSize: '0.65rem', color: 'var(--text-secondary)',
              lineHeight: '1.35', marginTop: i > 0 ? '0.3rem' : 0,
              paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.06)',
            }}>
              {lesson}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConsensusBar({ strategies }) {
  const votes = useMemo(() => {
    const counts = { BUY: 0, HOLD: 0, SELL: 0 };
    for (const s of strategies) {
      if (s.lastSignal && counts[s.lastSignal] !== undefined) counts[s.lastSignal]++;
    }
    return counts;
  }, [strategies]);

  const total = strategies.length || 1;
  const dominant = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'HOLD';
  const dominantColor = dominant === 'BUY' ? 'var(--accent-green)' : dominant === 'SELL' ? 'var(--accent-red)' : 'var(--text-secondary)';

  return (
    <div style={{
      padding: '0.7rem 1rem',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Agent Consensus
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: dominantColor, fontFamily: 'var(--font-mono)' }}>
            {dominant}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--accent-green)' }}>{votes.BUY} BUY</span>
          <span style={{ color: 'var(--text-secondary)' }}>{votes.HOLD} HOLD</span>
          <span style={{ color: 'var(--accent-red)' }}>{votes.SELL} SELL</span>
        </div>
      </div>
      {/* Vote bar */}
      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', gap: '1px' }}>
        {votes.BUY > 0 && (
          <div style={{ flex: votes.BUY / total, background: 'var(--accent-green)', borderRadius: '3px 0 0 3px', opacity: 0.8 }} />
        )}
        {votes.HOLD > 0 && (
          <div style={{ flex: votes.HOLD / total, background: 'rgba(255,255,255,0.2)' }} />
        )}
        {votes.SELL > 0 && (
          <div style={{ flex: votes.SELL / total, background: 'var(--accent-red)', borderRadius: '0 3px 3px 0', opacity: 0.8 }} />
        )}
      </div>
      {/* Debate */}
      <div style={{ marginTop: '0.5rem', fontSize: '0.63rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
        {strategies.map(s => s.name?.split(' ')[0]).filter(Boolean).join(' · ')}
        {' — '}
        {strategies.map(s => `${s.lastSignal || '?'}`).join(' | ')}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { strategies } = useStore();

  const leader = useMemo(() => {
    const active = strategies.filter(s => s.status === 'active');
    return active.sort((a, b) => {
      const aEq = a.shadowPortfolio?.equity ?? INITIAL_CAPITAL;
      const bEq = b.shadowPortfolio?.equity ?? INITIAL_CAPITAL;
      return (b.sharpe + bEq / 100000) - (a.sharpe + aEq / 100000);
    })[0];
  }, [strategies]);

  const totalTrades = strategies.reduce((s, a) => s + a.wins + a.losses, 0);
  const avgWinRate = strategies.length
    ? Math.round(strategies.reduce((sum, s) => {
        const t = s.wins + s.losses;
        return sum + (t > 0 ? (s.wins / t) * 100 : 0);
      }, 0) / strategies.length)
    : 0;
  const bestSharpe = strategies.reduce((best, s) => Math.max(best, s.sharpe || 0), 0);
  const totalEquity = strategies.reduce((sum, s) => sum + (s.shadowPortfolio?.equity ?? INITIAL_CAPITAL), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Strategy Tournament</h1>
        <p className="page-subtitle">
          {strategies.length > 0
            ? `${strategies.length} agents competing in parallel shadow portfolios. Leaders get promoted every 20 closed trades. Losers mutate and evolve.`
            : 'Agents initialize after the first AI evaluation. Set the engine to PAPER or LIVE to start.'}
        </p>
      </div>

      {strategies.length > 0 ? (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', marginBottom: '1rem' }}>
            {[
              { label: 'Total Shadow Equity', value: `$${(totalEquity / 1000).toFixed(0)}k`, color: totalEquity > INITIAL_CAPITAL * strategies.length ? 'var(--accent-green)' : 'var(--accent-red)' },
              { label: 'Total Trades', value: totalTrades, color: 'var(--text-primary)' },
              { label: 'Avg Win Rate', value: `${avgWinRate}%`, color: avgWinRate >= 55 ? 'var(--accent-green)' : avgWinRate >= 45 ? 'var(--accent-orange)' : 'var(--accent-red)' },
              { label: 'Best Sharpe', value: bestSharpe.toFixed(2), color: bestSharpe > 0.5 ? 'var(--accent-green)' : 'var(--text-secondary)' },
            ].map(s => (
              <div key={s.label} className="glass-panel" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 600, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Consensus bar */}
          <ConsensusBar strategies={strategies} />

          {/* Agent cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
            {strategies.map(strategy => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                isLeader={leader?.id === strategy.id}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <TrendingUp size={40} color="var(--text-secondary)" style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Strategy agents initialize after the AI engine runs its first analysis.
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', opacity: 0.6 }}>
            Make sure the engine is set to PAPER or LIVE to begin strategy evaluation.
          </div>
        </div>
      )}
    </div>
  );
}
