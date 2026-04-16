import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

/* ── static mock data ─────────────────────────────────────────────────────── */
const HOLDINGS = [
  { symbol: 'BTC',  name: 'Bitcoin',  color: '#F7931A', allocation: 60,  qty: 0.1823,  avgBuy: 58200,  currentPrice: 67250 },
  { symbol: 'ETH',  name: 'Ethereum', color: '#627EEA', allocation: 25,  qty: 2.41,    avgBuy: 2850,   currentPrice: 3420  },
  { symbol: 'SOL',  name: 'Solana',   color: '#9945FF', allocation: 10,  qty: 24.5,    avgBuy: 121.50, currentPrice: 152.5 },
  { symbol: 'USDC', name: 'USD Coin', color: '#2775CA', allocation: 5,   qty: 642.15,  avgBuy: 1.00,   currentPrice: 1.00  },
];

const TOTAL  = HOLDINGS.reduce((s, h) => s + h.qty * h.currentPrice, 0);
const ALL_PNL = HOLDINGS.reduce((s, h) => s + (h.currentPrice - h.avgBuy) * h.qty, 0);

function sparkData(base, len = 28) {
  let v = base;
  return Array.from({ length: len }, () => {
    v += (Math.random() - 0.48) * base * 0.014;
    return { v };
  });
}

function fmtPrice(p) {
  if (p < 2) return `$${p.toFixed(4)}`;
  if (p > 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${p.toFixed(2)}`;
}

/* ── pie tooltip ─────────────────────────────────────────────────────────── */
function PieTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,10,14,0.96)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '0.4rem 0.7rem',
      fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
    }}>
      <span style={{ fontWeight: 700 }}>{payload[0].name}</span>
      {' '}<span style={{ color: 'var(--text-secondary)' }}>{payload[0].value}%</span>
    </div>
  );
}

/* ── main ────────────────────────────────────────────────────────────────── */
export default function PortfolioPage() {
  const sorted      = [...HOLDINGS].sort((a, b) =>
    ((b.currentPrice - b.avgBuy) / b.avgBuy) - ((a.currentPrice - a.avgBuy) / a.avgBuy)
  );
  const best  = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

      {/* ── Top row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>

        {/* Total Value + Sparkline */}
        <div className="glass-panel" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
          <div style={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem',
          }}>
            Total Portfolio Value
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '2.1rem',
            fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15,
          }}>
            ${TOTAL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
            color: ALL_PNL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            marginTop: '0.25rem',
          }}>
            {ALL_PNL >= 0 ? '+' : '-'}${Math.abs(ALL_PNL).toFixed(2)} ({((ALL_PNL / (TOTAL - ALL_PNL)) * 100).toFixed(1)}%) all time
          </div>
          <div style={{ height: 48, marginTop: '0.85rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData(TOTAL)} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent-green)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone" dataKey="v"
                  stroke="var(--accent-green)" strokeWidth={1.5}
                  fill="url(#spkGrad)" dot={false} isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best Performer */}
        <PerformerCard
          title="Best Performer"
          asset={best}
          icon={TrendingUp}
          positive
        />

        {/* Worst Performer */}
        <PerformerCard
          title="Worst Performer"
          asset={worst}
          icon={TrendingDown}
          positive={false}
        />
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '0.85rem' }}>

        {/* Donut */}
        <div className="glass-panel widget">
          <div className="widget-header">
            <span className="widget-title"><Wallet size={13} /> Allocation</span>
          </div>

          <div style={{ height: 200, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={HOLDINGS}
                  dataKey="allocation"
                  nameKey="symbol"
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={88}
                  paddingAngle={3}
                  stroke="none"
                >
                  {HOLDINGS.map((h, i) => (
                    <Cell key={i} fill={h.color} opacity={0.88} />
                  ))}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700 }}>4</div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Assets
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {HOLDINGS.map(h => (
              <div key={h.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{h.name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600 }}>
                  {h.allocation}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Holdings Table */}
        <div className="glass-panel widget">
          <div className="widget-header">
            <span className="widget-title">Holdings &amp; Performance</span>
          </div>

          {/* Head */}
          <div style={rowStyle(true)}>
            <span>Asset</span>
            <span>Quantity</span>
            <span>Avg Buy</span>
            <span>Current</span>
            <span>P&amp;L $</span>
            <span style={{ textAlign: 'right' }}>P&amp;L %</span>
          </div>

          {HOLDINGS.map(h => {
            const pnl$   = (h.currentPrice - h.avgBuy) * h.qty;
            const pnlPct = ((h.currentPrice - h.avgBuy) / h.avgBuy) * 100;
            const pos    = pnlPct >= 0;
            const col    = pos ? 'var(--accent-green)' : 'var(--accent-red)';

            return (
              <div key={h.symbol} style={rowStyle()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.color }} />
                  <span style={{ fontWeight: 700 }}>{h.symbol}</span>
                </div>
                <span style={{ color: 'var(--text-secondary)' }}>{h.qty}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{fmtPrice(h.avgBuy)}</span>
                <span>{fmtPrice(h.currentPrice)}</span>
                <span style={{ color: col, fontWeight: 600 }}>
                  {pos ? '+' : '-'}${Math.abs(pnl$).toFixed(2)}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: pos ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
                    color: col,
                    padding: '0.12rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                  }}>
                    {pos ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}

          {/* Totals */}
          <div style={{ ...rowStyle(), borderBottom: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>
            <span>TOTAL</span>
            <span />
            <span />
            <span>${TOTAL.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span style={{ color: ALL_PNL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {ALL_PNL >= 0 ? '+' : '-'}${Math.abs(ALL_PNL).toFixed(2)}
            </span>
            <span style={{ textAlign: 'right', color: ALL_PNL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {ALL_PNL >= 0 ? '+' : ''}{((ALL_PNL / (TOTAL - ALL_PNL)) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function PerformerCard({ title, asset, icon: Icon }) {
  const pct = ((asset.currentPrice - asset.avgBuy) / asset.avgBuy * 100);
  const pos = pct >= 0;
  const col = pos ? 'var(--accent-green)' : 'var(--accent-red)';
  const borderCol = pos ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)';
  const bgCol     = pos ? 'rgba(48,209,88,0.04)' : 'rgba(255,69,58,0.04)';

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', borderColor: borderCol, background: bgCol }}>
      <div style={{
        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: col,
        marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
      }}>
        <Icon size={12} /> {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: asset.color }} />
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{asset.symbol}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{asset.name}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 700, color: col }}>
        {pos ? '+' : ''}{pct.toFixed(1)}%
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
        {pos ? '+' : '-'}${Math.abs((asset.currentPrice - asset.avgBuy) * asset.qty).toFixed(2)} unrealized
      </div>
    </div>
  );
}

const TABLE_COLS = '100px 80px 100px 100px 100px 1fr';

function rowStyle(isHeader = false) {
  return {
    display: 'grid',
    gridTemplateColumns: TABLE_COLS,
    gap: '0.5rem',
    alignItems: 'center',
    padding: isHeader ? '0 0 0.45rem' : '0.6rem 0',
    borderBottom: `1px solid rgba(255,255,255,${isHeader ? '0.06' : '0.03'})`,
    fontFamily: 'var(--font-mono)',
    fontSize: isHeader ? '0.6rem' : '0.72rem',
    fontWeight: isHeader ? 800 : 400,
    letterSpacing: isHeader ? '0.07em' : 'normal',
    textTransform: isHeader ? 'uppercase' : 'none',
    color: isHeader ? 'var(--text-secondary)' : 'var(--text-primary)',
  };
}
