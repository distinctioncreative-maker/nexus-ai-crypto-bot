import React, { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';

const ASSET_COLORS = {
    'BTC-USD': '#F7931A', 'ETH-USD': '#627EEA', 'SOL-USD': '#9945FF',
    'DOGE-USD': '#C2A633', 'XRP-USD': '#346AA9', 'ADA-USD': '#0033AD',
    'AVAX-USD': '#E84142', 'MATIC-USD': '#8247E5', 'LINK-USD': '#2A5ADA',
    'LTC-USD': '#BFBBBB',
};

function assetColor(productId) {
    return ASSET_COLORS[productId] || 'var(--accent-blue)';
}

function fmtPrice(p) {
    if (!p && p !== 0) return '—';
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
const INITIAL_BALANCE = 100000;

function RowHeader() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: '0.5rem', padding: '0 0 0.45rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            <span>Asset</span><span>Qty</span><span>Avg Buy</span><span>Current</span><span>P&L $</span><span style={{ textAlign: 'right' }}>P&L %</span>
        </div>
    );
}

function PositionRow({ productId, holdings, avgBuy, currentPrice, hasLivePrice }) {
    const base = productId.split('-')[0];
    const color = assetColor(productId);
    const unrealizedPnl = avgBuy > 0 && currentPrice > 0 ? (currentPrice - avgBuy) * holdings : null;
    const unrealizedPct = avgBuy > 0 && currentPrice > 0 ? ((currentPrice - avgBuy) / avgBuy) * 100 : null;
    const isGain = unrealizedPnl !== null && unrealizedPnl >= 0;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: TABLE_COLS, gap: '0.5rem', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontWeight: 700 }}>{base}</span>
                {!hasLivePrice && (
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', opacity: 0.6 }}>last</span>
                )}
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>
                {holdings < 0.001 ? holdings.toFixed(8) : holdings.toFixed(6)}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{avgBuy > 0 ? fmtPrice(avgBuy) : '—'}</span>
            <span>{currentPrice > 0 ? fmtPrice(currentPrice) : '—'}</span>
            <span style={{ color: unrealizedPnl !== null ? (isGain ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-secondary)', fontWeight: 600 }}>
                {unrealizedPnl !== null ? `${isGain ? '+' : '-'}$${Math.abs(unrealizedPnl).toFixed(2)}` : '—'}
            </span>
            <div style={{ textAlign: 'right' }}>
                {unrealizedPct !== null ? (
                    <span style={{ background: isGain ? 'rgba(48,209,88,0.1)' : 'rgba(255,69,58,0.1)', color: isGain ? 'var(--accent-green)' : 'var(--accent-red)', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.65rem' }}>
                        {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
                    </span>
                ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
            </div>
        </div>
    );
}

function TradeRow({ trade }) {
    const [expanded, setExpanded] = useState(false);
    const hasReason = trade.reason && trade.reason.length > 30;

    return (
        <>
            <div
                onClick={() => hasReason && setExpanded(e => !e)}
                style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 90px 20px', gap: '0.5rem', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: hasReason ? 'pointer' : 'default' }}
            >
                <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', background: trade.type === 'BUY' ? 'rgba(48,209,88,0.1)' : 'rgba(255,69,58,0.1)', color: trade.type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700, textAlign: 'center', fontSize: '0.65rem' }}>
                    {trade.type}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {trade.product || ''} {trade.reason ? `— ${trade.reason.replace(/^\[.*?\]\s*/, '')}` : ''}
                </span>
                <span>{fmtPrice(trade.price)}</span>
                <span style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                    {new Date(trade.time).toLocaleTimeString()}
                </span>
                {hasReason ? (
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                ) : <span />}
            </div>
            {expanded && trade.reason && (
                <div style={{ padding: '0.45rem 0.6rem 0.6rem', marginBottom: '0.1rem', background: 'rgba(10,132,255,0.04)', borderRadius: '6px', borderLeft: '2px solid rgba(10,132,255,0.3)', fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {trade.reason}
                </div>
            )}
        </>
    );
}

export default function PortfolioPage() {
    const { balance, assetHoldings, selectedProduct, trades, productHoldings, productPrices } = useStore();

    // Build the full list of positions (selected product + all other held products)
    const allPositions = useMemo(() => {
        const positions = [];

        // Combine productHoldings with current selected product state
        const allHoldings = {
            ...productHoldings,
            [selectedProduct]: {
                assetHoldings,
                trades: trades.filter(t => t.product === selectedProduct)
            }
        };

        for (const [productId, holding] of Object.entries(allHoldings)) {
            const qty = holding?.assetHoldings ?? 0;
            if (qty <= 0.000001) continue;

            const productTrades = Array.isArray(holding?.trades) ? holding.trades : trades.filter(t => t.product === productId);
            const buys = productTrades.filter(t => t.type === 'BUY');
            const totalCost = buys.reduce((s, t) => s + t.amount * t.price, 0);
            const totalQty = buys.reduce((s, t) => s + t.amount, 0);
            const avgBuy = totalQty > 0 ? totalCost / totalQty : 0;

            const livePrice = productPrices[productId] || 0;
            const hasLivePrice = livePrice > 0;

            positions.push({ productId, qty, avgBuy, livePrice, hasLivePrice });
        }

        return positions;
    }, [productHoldings, selectedProduct, assetHoldings, trades, productPrices]);

    // Total portfolio value across all positions
    const totalHoldingsValue = useMemo(() =>
        allPositions.reduce((sum, p) => sum + p.qty * (p.livePrice || 0), 0),
        [allPositions]
    );

    const totalPortfolio = balance + totalHoldingsValue;
    const totalPnl = totalPortfolio - INITIAL_BALANCE;
    const totalPnlPct = (totalPnl / INITIAL_BALANCE) * 100;

    // Equity curve: track total portfolio value (cash + holdings at trade price)
    const equityCurve = useMemo(() => {
        const chronological = [...trades].reverse();
        let cash = INITIAL_BALANCE;
        const holdingsMap = {};
        const points = [{ i: 0, v: INITIAL_BALANCE }];
        for (const t of chronological) {
            const amount = Number(t.amount) || 0;
            const price  = Number(t.price)  || 0;
            if (!amount || !price) continue; // skip malformed trades
            const pid = t.product || 'BTC-USD';
            if (t.type === 'BUY') {
                cash -= amount * price * 1.007;
                holdingsMap[pid] = (holdingsMap[pid] || 0) + amount;
            } else if (t.type === 'SELL') {
                cash += amount * price * 0.993;
                holdingsMap[pid] = Math.max(0, (holdingsMap[pid] || 0) - amount);
            }
            const holdingsValue = Object.entries(holdingsMap).reduce((sum, [, qty]) => sum + qty * price, 0);
            const total = cash + holdingsValue;
            if (isFinite(total)) points.push({ i: points.length, v: total });
        }
        return points.length > 1 ? points : [{ i: 0, v: INITIAL_BALANCE }];
    }, [trades]);

    // Pie allocation data
    const pieData = useMemo(() => {
        const data = [];
        for (const pos of allPositions) {
            const value = pos.qty * (pos.livePrice || 0);
            if (value > 0) {
                data.push({
                    name: pos.productId.split('-')[0],
                    value: (value / totalPortfolio) * 100,
                    color: assetColor(pos.productId)
                });
            }
        }
        if (balance > 0 && totalPortfolio > 0) {
            data.push({ name: 'USD', value: (balance / totalPortfolio) * 100, color: 'rgba(255,255,255,0.3)' });
        }
        return data;
    }, [allPositions, balance, totalPortfolio]);

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
                        {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} ({totalPnlPct.toFixed(2)}%) from ${(INITIAL_BALANCE / 1000).toFixed(0)}k start
                    </div>
                    {equityCurve.length > 1 && (
                        <div style={{ height: 48, marginTop: '0.85rem' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={equityCurve} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
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

                {/* Positions count */}
                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Open Positions
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 700 }}>
                        {allPositions.length}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                        {allPositions.length > 0
                            ? allPositions.map(p => p.productId.split('-')[0]).join(', ')
                            : 'No positions yet'}
                    </div>
                </div>
            </div>

            {/* Main grid */}
            <div className="portfolio-main-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '0.85rem' }}>

                {/* Allocation donut — hidden on mobile */}
                <div className="portfolio-donut glass-panel widget">
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
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700 }}>{allPositions.length}</div>
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
                            {allPositions.length > 1 && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--accent-blue)', background: 'rgba(10,132,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                    {allPositions.length} assets
                                </span>
                            )}
                        </div>
                        <div className="holdings-scroll-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <div className="holdings-table-header"><RowHeader /></div>

                        {allPositions.length > 0 ? (
                            allPositions.map(pos => (
                                <PositionRow
                                    key={pos.productId}
                                    productId={pos.productId}
                                    holdings={pos.qty}
                                    avgBuy={pos.avgBuy}
                                    currentPrice={pos.livePrice}
                                    hasLivePrice={pos.hasLivePrice}
                                />
                            ))
                        ) : (
                            <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                No open positions — waiting for first AI trade
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
                        </div>{/* end overflow-x wrapper */}
                    </div>

                    {/* Trade history */}
                    <div className="glass-panel widget">
                        <div className="widget-header">
                            <h2 className="widget-title"><Clock size={13} /> Trade History</h2>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{trades.length} trades</span>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                            {trades.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0', fontSize: '0.8rem' }}>
                                    No trades yet — start the engine to begin
                                </div>
                            ) : (
                                trades.slice(0, 50).map(trade => (
                                    <TradeRow key={trade.id} trade={trade} />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Holdings across all products summary */}
            {allPositions.length > 1 && (
                <div className="glass-panel" style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={12} color="var(--accent-green)" />
                        Multi-Asset Summary
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {allPositions.map(pos => {
                            const pnl = pos.avgBuy > 0 && pos.livePrice > 0
                                ? (pos.livePrice - pos.avgBuy) * pos.qty : null;
                            const pnlPct = pos.avgBuy > 0 && pos.livePrice > 0
                                ? ((pos.livePrice - pos.avgBuy) / pos.avgBuy) * 100 : null;
                            return (
                                <div key={pos.productId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: assetColor(pos.productId) }} />
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
                                        {pos.productId.split('-')[0]}
                                    </span>
                                    {pnl !== null && (
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
