import React, { useState, useMemo } from 'react';
import { Plus, X, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { sendProductChange, sendWatchlistUpdate } from '../services/websocket';

const SIGNAL_COLORS = {
    BUY: '#34c759',
    SELL: '#ff453a',
    HOLD: 'rgba(255,255,255,0.25)'
};

const SIGNAL_LABELS = { BUY: 'B', SELL: 'S', HOLD: '–' };

export default function WatchlistSidebar() {
    const { watchlist, selectedProduct, productPrices, productSignals, availableProducts, currentPrice } = useStore();
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Prices for all watchlist items
    const getPriceFor = (productId) => {
        if (productId === selectedProduct) return currentPrice;
        return productPrices[productId] || 0;
    };

    const productList = availableProducts.length > 0 ? availableProducts : [];
    const filteredSearch = useMemo(() => {
        if (!searchQuery) return productList.slice(0, 30);
        const q = searchQuery.toUpperCase();
        return productList.filter(p => p.id.includes(q) || p.base.includes(q) || (p.name || '').toUpperCase().includes(q)).slice(0, 30);
    }, [productList, searchQuery]);

    const handleAdd = (productId) => {
        if (watchlist.includes(productId)) return;
        const updated = [...watchlist, productId].slice(0, 10);
        sendWatchlistUpdate(updated);
        setShowSearch(false);
        setSearchQuery('');
    };

    const handleRemove = (productId) => {
        if (watchlist.length <= 1) return; // keep at least 1
        const updated = watchlist.filter(p => p !== productId);
        sendWatchlistUpdate(updated);
    };

    const handleSelect = (productId) => {
        if (productId !== selectedProduct) {
            sendProductChange(productId);
        }
    };

    return (
        <div style={{
            width: '188px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            paddingRight: '0.75rem',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            marginRight: '0.75rem',
            minHeight: '400px'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '6px', paddingBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.07)'
            }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Watchlist
                </span>
                <button
                    onClick={() => setShowSearch(v => !v)}
                    title="Add coin"
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '2px', lineHeight: 0,
                        borderRadius: '4px',
                        transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Search dropdown */}
            {showSearch && (
                <div style={{
                    position: 'relative', marginBottom: '6px'
                }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                        <input
                            autoFocus
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search…"
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '6px',
                                padding: '5px 8px 5px 24px',
                                color: 'var(--text-primary)',
                                fontSize: '0.75rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: '#1a1a22',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        marginTop: '2px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}>
                        {filteredSearch.length === 0 && (
                            <div style={{ padding: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                No results
                            </div>
                        )}
                        {filteredSearch.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleAdd(p.id)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left',
                                    background: watchlist.includes(p.id) ? 'rgba(10,132,255,0.08)' : 'none',
                                    border: 'none', cursor: 'pointer',
                                    padding: '6px 10px',
                                    fontSize: '0.75rem',
                                    color: watchlist.includes(p.id) ? 'var(--accent-blue)' : 'var(--text-primary)',
                                    borderRadius: '4px',
                                    transition: 'background 0.1s'
                                }}
                                onMouseEnter={e => { if (!watchlist.includes(p.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { if (!watchlist.includes(p.id)) e.currentTarget.style.background = 'none'; }}
                            >
                                <span style={{ fontWeight: 600 }}>{p.base}</span>
                                <span style={{ color: 'var(--text-secondary)', marginLeft: '5px', fontSize: '0.68rem' }}>{p.name || ''}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Watchlist items */}
            {watchlist.map(productId => {
                const isActive = productId === selectedProduct;
                const price = getPriceFor(productId);
                const signal = productSignals[productId];
                const base = productId.split('-')[0];

                return (
                    <div
                        key={productId}
                        onClick={() => handleSelect(productId)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: isActive ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.03)',
                            border: isActive ? '1px solid rgba(10,132,255,0.3)' : '1px solid transparent',
                            transition: 'all 0.15s',
                            position: 'relative',
                            group: 'true'
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.querySelector('.remove-btn').style.opacity = '1'; } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.querySelector('.remove-btn').style.opacity = '0'; } }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{
                                    fontSize: '0.78rem', fontWeight: 700,
                                    color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                                    fontFamily: 'var(--font-mono)'
                                }}>{base}</span>
                                {/* Signal dot */}
                                {signal && (
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 700,
                                        color: SIGNAL_COLORS[signal.action] || SIGNAL_COLORS.HOLD,
                                        background: `${SIGNAL_COLORS[signal.action]}22` || 'transparent',
                                        border: `1px solid ${SIGNAL_COLORS[signal.action]}55`,
                                        borderRadius: '3px',
                                        padding: '0 3px',
                                        lineHeight: '14px',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {SIGNAL_LABELS[signal.action]}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                {price > 0
                                    ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 6 : 2 })}`
                                    : '—'
                                }
                            </div>
                        </div>

                        {/* Remove button (only visible on hover, not for active) */}
                        <button
                            className="remove-btn"
                            onClick={e => { e.stopPropagation(); handleRemove(productId); }}
                            style={{
                                opacity: 0, background: 'none', border: 'none',
                                cursor: 'pointer', color: 'rgba(255,69,58,0.7)',
                                padding: '0', lineHeight: 0, transition: 'opacity 0.15s',
                                flexShrink: 0
                            }}
                            title="Remove from watchlist"
                        >
                            <X size={11} />
                        </button>
                    </div>
                );
            })}

            {watchlist.length < 10 && (
                <div style={{ marginTop: '4px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
                    {watchlist.length}/10 slots
                </div>
            )}
        </div>
    );
}
