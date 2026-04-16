import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';

const ASSET_COLORS = {
    'BTC-USD': '#F7931A', 'ETH-USD': '#627EEA', 'SOL-USD': '#9945FF',
    'DOGE-USD': '#C2A633', 'XRP-USD': '#346AA9', 'ADA-USD': '#0033AD',
    'AVAX-USD': '#E84142', 'MATIC-USD': '#8247E5', 'LINK-USD': '#2A5ADA',
    'LTC-USD': '#BFBBBB',
};

function fmtPrice(p) {
    if (!p) return '—';
    if (p < 0.01) return `$${p.toFixed(6)}`;
    if (p < 2) return `$${p.toFixed(4)}`;
    if (p > 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${p.toFixed(2)}`;
}

function PieTip({ active, payload }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'rgba(10,10,14,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.4rem 0.7rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            <span style={{ fontWeight: 700 }}>{payload[0].name}</span>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{payload[0].value.toFixed(1)}%</span>
        </div>
    );
}

const TABLE_COLS = '1fr 90px 100px 100px 90px 80px';
function RowHeader() {
    const s = { display: 'grid', gridTemplateColumns: TABLE_COLS, gap: '0.5rem', padding: '0 0 0.45rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' };
    return <div style={s}><span>Asset</span><span>Qty</span><span>Avg Buy</span><span>Current</span><span>P&L $</span><span style={{ textAlign: 'right' }}>P&L %</span></div>;
}

export default function PortfolioPage() {
    const { balance, assetHoldings, currentPrice, selectedProduct, trades } = useStore();

    const [baseAsset] = selectedProduct.split('-');
    const assetColor = ASSET_COLORS[selectedProduct] || 'var(--accent-blue)';

    // Compute average buy price from trade history
    const avgBuyPrice = useMemo(() => {
        const buys = trades.filter(t => t.type === 'BUY' && t.product === selectedProduct);
        if (buys.length === 0) return 0;
        const totalCost = buys.reduce((s, t) => s + t.amount * t.price, 0);
        const totalQty  = buys.reduce((s, t) => s + t.amount, 0);
        return totalQty > 0 ? totalCost / totalQty : 0;
    }, [trades, selectedProduct]);

    const holdingsValue   = assetHoldings * (currentPrice || 0);
    const totalPortfolio  = balance + holdingsValue;
    const unrealizedPnl   = avgBuyPrice > 0 ? (currentPrice - avgBuyPrice) * assetHoldings : 0;
    const unrealizedPct   = avgBuyPrice > 0 && assetHoldings > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
    const initialBalance  = 100000;
    const totalPnl        = totalPortfolio - initialBalance;
    const totalPnlPct     = (totalPnl / initialBalance) * 100;

    // Build equity curve from trade history (reverse since trades are newest-first)
    const equityCurve = useMemo(() => {
        const reversed = [...trades].reverse();
        let runningBalance = initialBalance;
        const points = [];
        reversed.forEach(t => {
            if (t.type === 'BUY')  runningBalance -= t.amount * t.price;
            if (t.type === 'SELL') runningBalance += t.amount * t.price;
            points.push({ t: new Date(t.time).getTime(), value: runningBalance });
        });
        if (points.length === 0) return [{ t: Date.now(), value: initialBalance }];
        return points;
    }, [trades]);

    // Allocation pie
    const pieData = [];
    if (holdingsValue > 0) pieData.push({ name: baseAsset, value: (holdingsValue / totalPortfolio) * 100, color: assetColor });
    if (balance > 0) pieData.push({ name: 'USD', value: (balance / totalPortfolio) * 100, color: 'rgba(255,255,255,0.3)' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* Top row metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>

                {/* Total value + equity sparkline */}
                <div className="glass-panel" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Total Portfolio Value
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.1rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
                        ${totalPortfolio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '0.25rem' }}>
                        {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} ({totalPnlPct.toFixed(2)}%) from start
                    </div>
                    {equityCurve.length > 1 && (
                        <div style={{ height: 48, marginTop: '0.85rem' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={equityCurve.map((p, i) => ({ i, v: p.value }))} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                    <defs>
                                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="transparent" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="v" stroke={totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth={1.5} fill="url(#eqGrad)" dot={false} isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Cash balance */}
                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Cash Balance
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 700 }}>
                        ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                        {totalPortfolio > 0 ? ((balance / totalPortfolio) * 100).toFixed(1) : '100.0'}% of portfolio
                    </div>
                </div>

                {/* Asset position */}
                <div className="glass-panel" style={{ padding: '1.25rem', borderColor: assetHoldings > 0 ? `${assetColor}30` : undefined }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: assetColor }} />
                        {baseAsset} Position
                    </div>
                    {assetHoldings > 0 ? (
                        <>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700 }}>
                                {assetHoldings.toFixed(6)}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: unrealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '0.2rem' }}>
                                {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} ({unrealizedPct.toFixed(2)}%)
                            </div>
                        </>
                    ) : (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No open position</div>
                    )}
                </div>
            </div>

            {/* Main grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '0.85rem' }}>

                {/* Allocation donut */}
                <div className="glass-panel widget">
                    <div className="widget-header">
                        <span className="widget-title"><Wallet size={13} /> Allocation</span>
                    </div>
                    {pieData.length > 0 ? (
                        <>
                            <div style={{ height: 180, position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} stroke="none">
                                            {pieData.map((d, i) => <Cell key={i} fill={d.color} opacity={0.88} />)}
                                        </Pie>
                                        <Tooltip content={<PieTip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700 }}>{pieData.length}</div>
                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Assets</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
                                {pieData.map(d => (
                                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{d.name}</span>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600 }}>{d.value.toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            No positions yet
                        </div>
                    )}
                </div>

                {/* Holdings table + trade history */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                    {/* Holdings table */}
                    <div className="glass-panel widget">
                        <div className="widget-header">
                            <span className="widget-title">Holdings &amp; Performance</span>
                        </div>
                        <RowHeader />

                        {assetHoldings > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: '0.5rem', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: assetColor }} />
                                    <span style={{ fontWeight: 700 }}>{baseAsset}</span>
                                </div>
                                <span style={{ color: 'var(--text-secondary)' }}>{assetHoldings.toFixed(6)}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{avgBuyPrice > 0 ? fmtPrice(avgBuyPrice) : '—'}</span>
                                <span>{currentPrice > 0 ? fmtPrice(currentPrice) : '—'}</span>
                                <span style={{ color: unrealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                                    {unrealizedPnl >= 0 ? '+' : '-'}${Math.abs(unrealizedPnl).toFixed(2)}
                                </span>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ background: unrealizedPct >= 0 ? 'rgba(48,209,88,0.1)' : 'rgba(255,69,58,0.1)', color: unrealizedPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.65rem' }}>
                                        {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                No open positions on {selectedProduct}
                            </div>
                        )}

                        {/* USD row */}
                        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: '0.5rem', alignItems: 'center', padding: '0.6rem 0', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
                                <span style={{ fontWeight: 700 }}>USD</span>
                            </div>
                            <span style={{ color: 'var(--text-secondary)' }}>{balance.toFixed(2)}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>$1.00</span>
                            <span>$1.00</span>
                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>—</span>
                        </div>

                        {/* Totals */}
                        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: '0.5rem', alignItems: 'center', padding: '0.6rem 0', borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700 }}>
                            <span>TOTAL</span>
                            <span />
                            <span />
                            <span>${totalPortfolio.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span style={{ color: totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                {totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toFixed(2)}
                            </span>
                            <span style={{ textAlign: 'right', color: totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    {/* Trade history */}
                    <div className="glass-panel widget">
                        <div className="widget-header">
                            <h2 className="widget-title"><Clock size={13} /> Trade History</h2>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{trades.length} trades</span>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: '260px' }}>
                            {trades.length === 0 && (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0', fontSize: '0.8rem' }}>
                                    No trades yet — waiting for AI signals
                                </div>
                            )}
                            {trades.map(trade => (
                                <div key={trade.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 90px', gap: '0.5rem', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                                    <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: trade.type === 'BUY' ? 'rgba(48,209,88,0.1)' : 'rgba(255,69,58,0.1)', color: trade.type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700, textAlign: 'center', fontSize: '0.65rem' }}>
                                        {trade.type}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trade.reason || trade.product}</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{fmtPrice(trade.price)}</span>
                                    <span style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                                        {new Date(trade.time).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
