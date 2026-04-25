import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { sendProductChange } from '../services/websocket';

const ASSET_COLORS = {
    'BTC-USD': '#F7931A', 'ETH-USD': '#627EEA', 'SOL-USD': '#9945FF',
    'DOGE-USD': '#C2A633', 'XRP-USD': '#346AA9', 'ADA-USD': '#0033AD',
    'AVAX-USD': '#E84142', 'MATIC-USD': '#8247E5', 'LINK-USD': '#2A5ADA',
    'LTC-USD': '#BFBBBB',
};

const SIGNAL_STYLES = {
    BUY:  { bg: 'rgba(52,199,89,0.15)',  color: '#34C759', label: 'BUY' },
    SELL: { bg: 'rgba(255,69,58,0.15)',   color: '#ff453a', label: 'SELL' },
    HOLD: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', label: 'HOLD' },
};

function fmtPrice(p) {
    if (!p && p !== 0) return '—';
    if (p < 0.01) return `$${p.toFixed(6)}`;
    if (p < 2)    return `$${p.toFixed(4)}`;
    if (p > 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${p.toFixed(2)}`;
}

export default function ActivePositionsBar() {
    const {
        selectedProduct, assetHoldings, currentPrice,
        productHoldings, productPrices, productSignals
    } = useStore();

    // Build list of all held positions across all products
    const positions = useMemo(() => {
        const list = [];

        // Selected product position (uses main assetHoldings)
        if (assetHoldings > 0) {
            const trades = productHoldings[selectedProduct]?.trades || [];
            const buys = trades.filter(t => t.type === 'BUY');
            const avgBuy = buys.length > 0
                ? buys.reduce((s, t) => s + t.price * t.amount, 0) / buys.reduce((s, t) => s + t.amount, 0)
                : 0;
            list.push({
                productId: selectedProduct,
                qty: assetHoldings,
                price: currentPrice,
                avgBuy,
                signal: productSignals[selectedProduct],
            });
        }

        // Other product positions
        for (const [productId, held] of Object.entries(productHoldings || {})) {
            if (productId === selectedProduct) continue;
            if ((held?.assetHoldings || 0) <= 0) continue;
            const price = productPrices[productId] || held._lastPrice || 0;
            const buys = (held.trades || []).filter(t => t.type === 'BUY');
            const avgBuy = buys.length > 0
                ? buys.reduce((s, t) => s + t.price * t.amount, 0) / buys.reduce((s, t) => s + t.amount, 0)
                : 0;
            list.push({
                productId,
                qty: held.assetHoldings,
                price,
                avgBuy,
                signal: productSignals[productId],
            });
        }

        return list;
    }, [selectedProduct, assetHoldings, currentPrice, productHoldings, productPrices, productSignals]);

    if (positions.length === 0) return null;

    return (
        <div style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
            padding: '0.6rem 0.75rem',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '12px',
        }}>
            {/* Label */}
            <div style={{
                display: 'flex', alignItems: 'center',
                fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                marginRight: '0.25rem', alignSelf: 'center', whiteSpace: 'nowrap'
            }}>
                Open Positions
            </div>

            {positions.map(({ productId, qty, price, avgBuy, signal }) => {
                const base = productId.split('-')[0];
                const color = ASSET_COLORS[productId] || 'var(--accent-blue)';
                const isActive = productId === selectedProduct;

                const pnlDollar = avgBuy > 0 && price > 0 ? (price - avgBuy) * qty : null;
                const pnlPct    = avgBuy > 0 && price > 0 ? ((price - avgBuy) / avgBuy) * 100 : null;
                const isGain    = pnlDollar !== null && pnlDollar >= 0;

                const sig = signal ? SIGNAL_STYLES[signal.action] || SIGNAL_STYLES.HOLD : null;

                return (
                    <button
                        key={productId}
                        onClick={() => sendProductChange(productId)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            background: isActive ? 'rgba(10,132,255,0.1)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isActive ? 'rgba(10,132,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: 'var(--font-mono)',
                        }}
                    >
                        {/* Coin indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                                {base}
                            </span>
                        </div>

                        {/* Qty */}
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                            {qty < 0.001 ? qty.toFixed(6) : qty.toFixed(4)}
                        </span>

                        {/* Live price */}
                        {price > 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)' }}>
                                {fmtPrice(price)}
                            </span>
                        )}

                        {/* P&L */}
                        {pnlDollar !== null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                {isGain
                                    ? <TrendingUp size={11} color="var(--accent-green)" />
                                    : <TrendingDown size={11} color="var(--accent-red)" />
                                }
                                <span style={{
                                    fontSize: '0.7rem', fontWeight: 700,
                                    color: isGain ? 'var(--accent-green)' : 'var(--accent-red)'
                                }}>
                                    {isGain ? '+' : ''}{pnlPct !== null ? pnlPct.toFixed(2) : '—'}%
                                </span>
                            </div>
                        )}

                        {/* AI Signal badge */}
                        {sig && (
                            <span style={{
                                fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.05em',
                                padding: '0.1rem 0.35rem', borderRadius: '4px',
                                background: sig.bg, color: sig.color,
                            }}>
                                {sig.label}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
