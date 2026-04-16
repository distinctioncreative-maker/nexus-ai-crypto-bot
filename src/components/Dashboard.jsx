import React, { useState } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Activity, Brain, BookOpen, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useMarketData, ASSETS } from '../hooks/useMarketData';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ASSET_COLORS = { BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', DOGE: '#C2A633' };

function fmtPrice(price, asset) {
  if (!price) return '—';
  if (asset === 'DOGE') return `$${price.toFixed(5)}`;
  if (price > 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(2)}`;
}

/* ── sub-components ──────────────────────────────────────────────────────── */
function MetricCard({ label, value, sub, subColor, valueColor }) {
  return (
    <div className="glass-panel metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: valueColor ?? 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="metric-sub" style={{ color: subColor }}>{sub}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,10,14,0.96)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      padding: '0.45rem 0.75rem',
    }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginBottom: '0.15rem' }}>
        {payload[0].payload.formattedTime}
      </p>
      <p style={{ color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>
        {fmtPrice(payload[0].value, payload[0].payload.asset)}
      </p>
    </div>
  );
}

function AIReasoningPanel({ aiStatus, aiThoughts, isConnected }) {
  return (
    <div className="glass-panel widget" style={{
      borderColor: 'rgba(191,90,242,0.14)',
      background: 'rgba(14,10,22,0.88)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* ambient glow */}
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 140, height: 140, borderRadius: '50%',
        background: 'rgba(191,90,242,0.07)',
        filter: 'blur(35px)', pointerEvents: 'none',
      }} />

      <div className="widget-header">
        <div>
          <span className="widget-title" style={{ color: 'var(--accent-purple)' }}>
            <Brain size={13} /> Neural Engine
          </span>
          <div style={{
            fontSize: '0.6rem', color: 'var(--text-secondary)',
            marginTop: '0.2rem', paddingLeft: '1px',
          }}>
            AI is currently thinking:
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isConnected && <span className="live-indicator-purple" />}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            color: isConnected ? 'var(--accent-purple)' : 'var(--text-secondary)',
            opacity: 0.85,
          }}>
            {isConnected ? aiStatus : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div style={{ flexGrow: 1, overflowY: 'auto' }}>
        {!isConnected ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: '0.75rem', opacity: 0.4,
            padding: '1.5rem',
          }}>
            <Brain size={28} color="var(--accent-purple)" />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
              Click "Connect Exchange" in the top right to activate the neural engine
              <ArrowUpRight size={12} style={{ display: 'inline', marginLeft: '0.25rem', verticalAlign: 'middle' }} />
            </p>
          </div>
        ) : (
          aiThoughts.map((t, i) => (
            <div key={t.id} style={{
              padding: '0.5rem 0',
              borderBottom: '1px solid rgba(191,90,242,0.07)',
              animation: i === 0 ? 'fadeInUp 0.3s ease' : 'none',
              opacity: Math.max(1 - i * 0.065, 0.25),
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.58rem',
                  color: 'rgba(191,90,242,0.45)',
                  flexShrink: 0,
                  paddingTop: '0.1rem',
                }}>
                  {t.time}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  lineHeight: 1.45,
                  color: t.type === 'action' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.6)',
                  fontWeight: t.type === 'action' ? 600 : 400,
                }}>
                  {t.type === 'action' ? '→ ' : ''}{t.text}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OrderBook({ orderBook, currentPrice, activeAsset }) {
  const fmt = p =>
    activeAsset === 'DOGE'
      ? p.toFixed(5)
      : p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="glass-panel widget" style={{ fontSize: '0.72rem' }}>
      <div className="widget-header">
        <span className="widget-title"><BookOpen size={13} /> Order Book</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', flexGrow: 1 }}>
        {/* Asks */}
        <div>
          <div style={{
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--accent-red)',
            marginBottom: '0.35rem', paddingBottom: '0.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            Sell Orders (Asks)
          </div>
          {orderBook.asks?.slice(0, 7).reverse().map((ask, i) => (
            <div key={i} style={{ position: 'relative', marginBottom: '2px' }}>
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: `${ask.depth * 100}%`,
                background: 'rgba(255,69,58,0.07)', borderRadius: '2px',
              }} />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '0.12rem 0.2rem', position: 'relative',
                fontFamily: 'var(--font-mono)', fontSize: '0.67rem',
              }}>
                <span style={{ color: 'var(--accent-red)' }}>{fmt(ask.price)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{ask.size}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bids */}
        <div>
          <div style={{
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--accent-green)',
            marginBottom: '0.35rem', paddingBottom: '0.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            Buy Orders (Bids)
          </div>
          {orderBook.bids?.slice(0, 7).map((bid, i) => (
            <div key={i} style={{ position: 'relative', marginBottom: '2px' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${bid.depth * 100}%`,
                background: 'rgba(48,209,88,0.07)', borderRadius: '2px',
              }} />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '0.12rem 0.2rem', position: 'relative',
                fontFamily: 'var(--font-mono)', fontSize: '0.67rem',
              }}>
                <span style={{ color: 'var(--accent-green)' }}>{fmt(bid.price)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{bid.size}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        textAlign: 'center',
        fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700,
        color: 'var(--text-primary)',
        padding: '0.5rem 0 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        marginTop: '0.5rem',
      }}>
        {fmtPrice(currentPrice, activeAsset)}
      </div>
    </div>
  );
}

function RecentTrades({ trades, isConnected }) {
  return (
    <div className="glass-panel widget" style={{ maxHeight: '300px' }}>
      <div className="widget-header">
        <div>
          <span className="widget-title"><Activity size={13} /> AI Execution Log</span>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Trades placed automatically by your AI agents based on detected signals.
          </div>
        </div>
        {isConnected && <span className="live-indicator" />}
      </div>

      {!isConnected ? (
        <div style={{
          flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem',
          gap: '0.5rem', padding: '1rem', textAlign: 'center',
        }}>
          <Activity size={22} color="var(--text-tertiary)" />
          <span>
            Click "Connect Exchange" in the top right to start the simulation
            <ArrowUpRight size={13} style={{ display: 'inline', marginLeft: '0.25rem', verticalAlign: 'middle' }} />
          </span>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '52px 54px 1fr 1fr 1fr 1fr',
            gap: '0.5rem',
            padding: '0 0 0.45rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.6rem', fontWeight: 800,
            letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}>
            <span>Side</span>
            <span>Asset</span>
            <span>Qty</span>
            <span>Entry</span>
            <span>Exit</span>
            <span style={{ textAlign: 'right' }}>Profit/Loss</span>
          </div>

          <div style={{ overflowY: 'auto', flexGrow: 1 }}>
            {trades.map(trade => (
              <div key={trade.id} style={{
                display: 'grid',
                gridTemplateColumns: '52px 54px 1fr 1fr 1fr 1fr',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.45rem 0',
                borderBottom: '1px solid rgba(255,255,255,0.025)',
                animation: 'fadeInUp 0.25s ease',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
              }}>
                <span className={`trade-badge ${trade.type}`}>
                  {trade.type === 'buy' ? 'BUY' : 'SELL'}
                </span>
                <span style={{ fontWeight: 700 }}>{trade.asset}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{trade.amount}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {fmtPrice(trade.entryPrice, trade.asset)}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {trade.exitPrice
                    ? fmtPrice(trade.exitPrice, trade.asset)
                    : <span style={{ color: 'var(--accent-blue)' }}>Open</span>}
                </span>
                <span style={{
                  textAlign: 'right', fontWeight: 600,
                  color: trade.pnl == null
                    ? 'var(--accent-blue)'
                    : trade.pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {trade.pnl == null
                    ? '—'
                    : `${trade.pnl >= 0 ? '+' : '-'}$${Math.abs(trade.pnl).toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */
export default function Dashboard({ isConnected }) {
  const [activeAsset, setActiveAsset] = useState('BTC');

  const {
    data, prices, currentPrice, priceChange, priceChangePct,
    aiStatus, aiThoughts, trades, balance, orderBook,
    winRate, dailyPnl, totalTrades,
  } = useMarketData(isConnected, activeAsset);

  const isUp         = priceChange >= 0;
  const priceColor   = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
  const assetColor   = ASSET_COLORS[activeAsset];

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Terminal</h1>
        <p className="page-subtitle">Live market data, AI decision stream, and real-time trade execution.</p>
      </div>

      {/* Color legend */}
      <div className="color-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--accent-green)' }} />
          Green = Profit / Bullish
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--accent-red)' }} />
          Red = Loss / Bearish
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--accent-purple)' }} />
          Purple = AI action
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--accent-blue)' }} />
          Blue = Open position / System
        </div>
      </div>

      {/* Metric Row */}
      <div className="metrics-container">
        <MetricCard
          label="Portfolio Value"
          value={`$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Total balance"
          subColor="var(--text-secondary)"
        />
        <MetricCard
          label={`${activeAsset} Price`}
          value={fmtPrice(currentPrice, activeAsset)}
          sub={`${isUp ? '+' : ''}${priceChangePct.toFixed(2)}% today`}
          subColor={priceColor}
        />
        <MetricCard
          label="Daily Profit/Loss"
          value={`${dailyPnl >= 0 ? '+' : '-'}$${Math.abs(dailyPnl).toFixed(2)}`}
          sub={dailyPnl >= 0 ? 'In profit today' : 'At a loss today'}
          subColor={dailyPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
          valueColor={dailyPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
        />
        <MetricCard
          label="Trades"
          value={totalTrades}
          sub="This session"
          subColor="var(--text-secondary)"
        />
        <MetricCard
          label="Win Rate"
          value={winRate === '—' ? '—' : `${winRate}%`}
          sub="Closed positions"
          subColor={+winRate >= 60 ? 'var(--accent-green)' : 'var(--text-secondary)'}
        />
      </div>

      {/* Asset Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
        {Object.keys(ASSETS).map(asset => (
          <button
            key={asset}
            onClick={() => setActiveAsset(asset)}
            style={{
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              border: activeAsset === asset
                ? `1px solid ${ASSET_COLORS[asset]}44`
                : '1px solid rgba(255,255,255,0.07)',
              background: activeAsset === asset
                ? `${ASSET_COLORS[asset]}16`
                : 'transparent',
              color: activeAsset === asset ? ASSET_COLORS[asset] : 'var(--text-secondary)',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {asset}
            {asset !== 'DOGE' && (
              <span style={{ opacity: 0.55, marginLeft: '0.3rem', fontSize: '0.6rem' }}>
                {fmtPrice(prices[asset], asset)}
              </span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isConnected && (
            <>
              <span className="live-indicator" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--accent-green)' }}>
                LIVE
              </span>
            </>
          )}
          {!isConnected && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
              SIMULATION PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Chart + AI Panel */}
      <div className="dashboard-grid">
        {/* Chart */}
        <div className="glass-panel widget" style={{ height: '300px' }}>
          <div className="widget-header">
            <span className="widget-title">
              <TrendingUp size={13} /> {activeAsset}/USD — 1H Price Chart
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
              color: priceColor, fontWeight: 600,
            }}>
              {isUp ? '▲' : '▼'} {Math.abs(priceChangePct).toFixed(2)}%
            </span>
          </div>
          <div style={{ flexGrow: 1, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${activeAsset}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={assetColor} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={assetColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="formattedTime"
                  stroke="transparent"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                  tickLine={false} axisLine={false} minTickGap={40}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  stroke="transparent"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                  tickLine={false} axisLine={false}
                  tickFormatter={v =>
                    activeAsset === 'DOGE' ? `$${v.toFixed(4)}`
                    : v > 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v.toFixed(0)}`
                  }
                  width={62}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={assetColor}
                  strokeWidth={2}
                  fill={`url(#grad-${activeAsset})`}
                  dot={false}
                  activeDot={{ r: 4, fill: assetColor, stroke: '#000', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <AIReasoningPanel aiStatus={aiStatus} aiThoughts={aiThoughts} isConnected={isConnected} />
      </div>

      {/* Order Book + Trades */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.2fr', gap: '0.75rem', marginTop: '0.75rem' }}>
        <OrderBook orderBook={orderBook} currentPrice={currentPrice} activeAsset={activeAsset} />
        <RecentTrades trades={trades} isConnected={isConnected} />
      </div>
    </div>
  );
}
