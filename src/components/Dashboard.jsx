import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Brain, TrendingUp, Zap, ChevronDown, Activity, BarChart2, TrendingDown, Search } from 'lucide-react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { sendProductChange } from '../services/websocket';
import { authFetch } from '../lib/supabase';
import { apiUrl } from '../lib/api';

const FALLBACK_PRODUCTS = [
    { id: 'BTC-USD', base: 'BTC', name: 'Bitcoin' },
    { id: 'ETH-USD', base: 'ETH', name: 'Ethereum' },
    { id: 'SOL-USD', base: 'SOL', name: 'Solana' },
    { id: 'DOGE-USD', base: 'DOGE', name: 'Dogecoin' },
    { id: 'XRP-USD', base: 'XRP', name: 'XRP' },
    { id: 'ADA-USD', base: 'ADA', name: 'Cardano' },
    { id: 'AVAX-USD', base: 'AVAX', name: 'Avalanche' },
    { id: 'MATIC-USD', base: 'MATIC', name: 'Polygon' },
    { id: 'LINK-USD', base: 'LINK', name: 'Chainlink' },
    { id: 'LTC-USD', base: 'LTC', name: 'Litecoin' },
    { id: 'AMP-USD', base: 'AMP', name: 'Amp' },
    { id: 'LRC-USD', base: 'LRC', name: 'Loopring' },
    { id: 'ALGO-USD', base: 'ALGO', name: 'Algorand' },
    { id: 'XYO-USD', base: 'XYO', name: 'XYO Network' },
    { id: 'ANKR-USD', base: 'ANKR', name: 'Ankr' },
    { id: 'FLOKI-USD', base: 'FLOKI', name: 'Floki' },
    { id: 'SHIB-USD', base: 'SHIB', name: 'Shiba Inu' },
    { id: 'PEPE-USD', base: 'PEPE', name: 'Pepe' },
    { id: 'ARB-USD', base: 'ARB', name: 'Arbitrum' },
    { id: 'OP-USD', base: 'OP', name: 'Optimism' },
];

export default function Dashboard() {
    const {
        currentPrice, aiStatus, aiThesis, trades, balance, assetHoldings,
        isLiveMode, marketHistory, selectedProduct,
        availableProducts, setAvailableProducts, lastTickTime
    } = useStore();

    // Stale data detection — show reconnecting badge if no TICK for > 8s
    const [isStale, setIsStale] = useState(false);
    useEffect(() => {
        const check = setInterval(() => {
            if (lastTickTime > 0 && Date.now() - lastTickTime > 8000) {
                setIsStale(true);
            } else {
                setIsStale(false);
            }
        }, 2000);
        return () => clearInterval(check);
    }, [lastTickTime]);

    // Fetch full product catalog on mount
    useEffect(() => {
        authFetch(apiUrl('/api/products'))
            .then(r => r.json())
            .then(products => { if (Array.isArray(products) && products.length > 0) setAvailableProducts(products); })
            .catch(error => console.warn('Product catalog fetch failed:', error.message));
    }, [setAvailableProducts]);

    const [signals, setSignals] = useState(null);
    useEffect(() => {
        authFetch(apiUrl('/api/signals'))
            .then(r => r.json())
            .then(setSignals)
            .catch(error => console.warn('Signal fetch failed:', error.message));
        const t = setInterval(() => {
            authFetch(apiUrl('/api/signals')).then(r => r.json()).then(setSignals).catch(error => console.warn('Signal refresh failed:', error.message));
        }, 5 * 60 * 1000);
        return () => clearInterval(t);
    }, []);

    const chartContainerRef = useRef();
    const lineSeriesRef = useRef(null);
    const chartRef = useRef(null);
    const tooltipRef = useRef(null);

    const priceColor = isLiveMode ? 'rgba(255, 69, 58, 1)' : 'rgba(10, 132, 255, 1)';
    const bgColor = 'transparent';

    const productList = availableProducts.length > 0 ? availableProducts : FALLBACK_PRODUCTS;
    const activeProduct = productList.find(p => p.id === selectedProduct) || productList[0] || { id: selectedProduct, base: selectedProduct.split('-')[0], name: selectedProduct };

    // Searchable product dropdown state
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const filteredProducts = useMemo(() => {
        if (!productSearch) return productList.slice(0, 50);
        const q = productSearch.toUpperCase();
        return productList.filter(p => p.id.includes(q) || p.base.includes(q) || (p.name || '').toUpperCase().includes(q)).slice(0, 50);
    }, [productList, productSearch]);

    // Initialize / recreate chart when mode or product changes
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Destroy old chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            lineSeriesRef.current = null;
        }

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: bgColor },
                textColor: 'rgba(255, 255, 255, 0.6)',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth || 600,
            height: 380,
            crosshair: { mode: 1 },
            rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                timeVisible: true,
            },
        });

        chartRef.current = chart;

        const lineSeries = chart.addSeries(AreaSeries, {
            lineColor: priceColor,
            topColor: isLiveMode ? 'rgba(255, 69, 58, 0.25)' : 'rgba(10, 132, 255, 0.25)',
            bottomColor: 'rgba(0, 0, 0, 0)',
            lineWidth: 2,
        });

        lineSeriesRef.current = lineSeries;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        // Crosshair tooltip listener
        chart.subscribeCrosshairMove(param => {
            if (!tooltipRef.current || !chartContainerRef.current) return;
            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > chartContainerRef.current.clientWidth ||
                param.point.y < 0 ||
                param.point.y > chartContainerRef.current.clientHeight
            ) {
                tooltipRef.current.style.display = 'none';
                return;
            }

            const areaData = param.seriesData.get(lineSeries);
            if (!areaData) return;
            const price = areaData.value;
            const coordinate = lineSeries.priceToCoordinate(price);
            
            tooltipRef.current.style.display = 'block';
            tooltipRef.current.style.left = param.point.x + 'px';
            tooltipRef.current.style.top = coordinate + 'px';
            
            const dateStr = new Date(param.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            tooltipRef.current.innerHTML = `
                <div style="font-weight:600;font-size:0.9rem;margin-bottom:2px">$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                <div style="color:var(--text-secondary);font-size:0.75rem">${dateStr}</div>
            `;
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                lineSeriesRef.current = null;
            }
        };
    }, [isLiveMode, selectedProduct, priceColor]); // Recreate on mode or product change

    // Seed / update chart whenever market history changes.
    // setData() replaces the full series so the chart populates immediately on mount
    // and after product switches — not just one-point-at-a-time.
    useEffect(() => {
        if (lineSeriesRef.current && marketHistory.length > 0) {
            try {
                lineSeriesRef.current.setData(marketHistory);

                // Add trade markers to chart
                const productTrades = trades.filter(t => t.product === selectedProduct);
                const markers = productTrades.map(trade => {
                    // Try to align trade exactly to a chart timestamp, or just use the trade time if close
                    const tradeTimeSecs = Math.floor(new Date(trade.timestamp).getTime() / 1000);
                    const isBuy = trade.type === 'BUY';
                    return {
                        time: tradeTimeSecs,
                        position: isBuy ? 'belowBar' : 'aboveBar',
                        color: isBuy ? '#34C759' : '#ff453a',
                        shape: isBuy ? 'arrowUp' : 'arrowDown',
                        text: `${isBuy ? 'BUY' : 'SELL'} @ $${trade.price.toLocaleString()}`
                    };
                }).sort((a, b) => a.time - b.time);

                lineSeriesRef.current.setMarkers(markers);
            } catch {
                // Ignore lightweight-charts ordering errors silently
            }
        }
    }, [marketHistory, trades, selectedProduct]);

    const handleProductChange = (productId) => {
        sendProductChange(productId);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.25, staggerChildren: 0.06 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.25 } }
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            {/* Metrics Row */}
            <motion.div className="metrics-container" variants={itemVariants}>
                <div className="glass-panel metric-card">
                    <div className="metric-label">Portfolio Balance ({isLiveMode ? 'Real' : 'Paper'})</div>
                    <div className="metric-value">
                        ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="glass-panel metric-card">
                    <div className="metric-label">{activeProduct.base} Live Price</div>
                    <div className="metric-value price-display" style={{ color: priceColor }}>
                        {currentPrice > 0
                            ? `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                            : <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Connecting…</span>
                        }
                    </div>
                </div>

                <div className="glass-panel metric-card">
                    <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={16} color={isLiveMode ? 'var(--accent-red)' : 'var(--accent-blue)'} />
                        Engine Status
                    </div>
                    <div className="metric-value" style={{ fontSize: '0.85rem', marginTop: '0.2rem', color: 'var(--text-primary)' }}>
                        {aiStatus}
                    </div>
                </div>
            </motion.div>

            {/* Current Thesis / AI Thought Process */}
            {aiThesis && (
                <motion.div variants={itemVariants} className="glass-panel" style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    border: '1px solid rgba(10, 132, 255, 0.3)',
                    background: 'rgba(10, 132, 255, 0.05)',
                    borderRadius: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600 }}>
                        <Brain size={16} />
                        CURRENT THESIS
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        {aiThesis}
                    </div>
                </motion.div>
            )}

            {/* Holdings quick-stat */}
            {assetHoldings > 0 && (
                <motion.div variants={itemVariants} style={{
                    marginBottom: '1rem',
                    padding: '0.6rem 1rem',
                    background: 'rgba(10, 132, 255, 0.06)',
                    border: '1px solid rgba(10, 132, 255, 0.15)',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    gap: '1rem'
                }}>
                    <span>
                        <strong style={{ color: 'var(--text-primary)' }}>{activeProduct.base} Holdings:</strong>{' '}
                        {assetHoldings.toFixed(6)}
                    </span>
                    {currentPrice > 0 && (
                        <span>
                            ≈ ${(assetHoldings * currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    )}
                </motion.div>
            )}

            {/* Intelligence Strip */}
            {signals && (
                <motion.div variants={itemVariants} style={{
                    display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap'
                }}>
                    {signals.fearGreed && (
                        <div style={{
                            flex: 1, minWidth: '140px', padding: '0.6rem 0.9rem',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px', fontSize: '0.78rem'
                        }}>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Fear &amp; Greed</div>
                            <div style={{
                                color: signals.fearGreed.value < 30 ? 'var(--accent-green)' : signals.fearGreed.value > 70 ? 'var(--accent-red)' : 'var(--accent-blue)',
                                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem'
                            }}>
                                {signals.fearGreed.value}/100
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.1rem' }}>
                                {signals.fearGreed.classification}
                            </div>
                        </div>
                    )}
                    {signals.tvl && (
                        <div style={{
                            flex: 1, minWidth: '140px', padding: '0.6rem 0.9rem',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px', fontSize: '0.78rem'
                        }}>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>DeFi TVL 7d</div>
                            <div style={{
                                color: signals.tvl.changePct > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem',
                                display: 'flex', alignItems: 'center', gap: '0.25rem'
                            }}>
                                {signals.tvl.changePct > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                {signals.tvl.changePct > 0 ? '+' : ''}{signals.tvl.changePct}%
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.1rem' }}>DeFi Health</div>
                        </div>
                    )}
                    {signals.polymarket && (
                        <div style={{
                            flex: 1, minWidth: '140px', padding: '0.6rem 0.9rem',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px', fontSize: '0.78rem'
                        }}>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Polymarket BTC</div>
                            <div style={{
                                color: signals.polymarket.bullProb > 0.5 ? 'var(--accent-green)' : 'var(--accent-red)',
                                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem'
                            }}>
                                {(signals.polymarket.bullProb * 100).toFixed(0)}% Bull
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Prediction Market
                            </div>
                        </div>
                    )}
                    <div style={{
                        flex: 1, minWidth: '140px', padding: '0.6rem 0.9rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px', fontSize: '0.78rem'
                    }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Composite Signal</div>
                        <div style={{
                            color: signals.compositeScore > 0 ? 'var(--accent-green)' : signals.compositeScore < 0 ? 'var(--accent-red)' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem'
                        }}>
                            {signals.compositeScore > 0 ? '+' : ''}{signals.compositeScore}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.1rem' }}>
                            {signals.compositeScore > 20 ? 'Bullish' : signals.compositeScore < -20 ? 'Bearish' : 'Neutral'}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Chart + Trade Feed Grid */}
            <div className="dashboard-grid">
                <motion.div className="glass-panel widget chart-container" variants={itemVariants}>
                    <div className="widget-header">
                        <h2 className="widget-title">
                            <Brain size={20} color="var(--accent-blue)" />
                            LLM Alpha Engine
                        </h2>

                        {/* Instrument Selector — searchable full catalog */}
                        <div style={{ position: 'relative' }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowProductDropdown(false); }}>
                            <button
                                onClick={() => setShowProductDropdown(v => !v)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.8rem',
                                    fontFamily: 'var(--font-mono)',
                                    cursor: 'pointer',
                                    minWidth: '110px',
                                }}
                            >
                                {activeProduct.base} / USD
                                <ChevronDown size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                            </button>
                            {showProductDropdown && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 500,
                                    background: '#0e0e12', border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '10px', width: '200px',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{ padding: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '0.3rem 0.5rem' }}>
                                            <Search size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                            <input
                                                autoFocus
                                                placeholder="Search coins…"
                                                value={productSearch}
                                                onChange={e => setProductSearch(e.target.value)}
                                                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', width: '100%' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                                        {filteredProducts.map(p => (
                                            <button key={p.id} onMouseDown={() => { handleProductChange(p.id); setShowProductDropdown(false); setProductSearch(''); }}
                                                style={{
                                                    display: 'block', width: '100%', textAlign: 'left',
                                                    padding: '0.45rem 0.75rem', background: p.id === selectedProduct ? 'rgba(10,132,255,0.12)' : 'none',
                                                    border: 'none', cursor: 'pointer', color: p.id === selectedProduct ? 'var(--accent-blue)' : 'var(--text-primary)',
                                                    fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
                                                }}
                                            >
                                                {p.base} / USD {p.name && p.name !== p.base ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>— {p.name}</span> : null}
                                            </button>
                                        ))}
                                        {filteredProducts.length === 0 && <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>No results</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                {/* Chart Area */}
                <motion.div className="glass-panel" variants={itemVariants} style={{ padding: '1rem', position: 'relative' }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '1rem', fontFamily: 'var(--font-mono)'
                    }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{activeProduct.base} LIVE CHART</span>
                        {isStale ? (
                            <span style={{ fontSize: '0.85rem', color: '#FF9F0A', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                ◌ RECONNECTING…
                            </span>
                        ) : (
                            <span style={{ fontSize: '0.85rem', color: currentPrice > 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                ● {currentPrice > 0 ? 'STREAMING' : 'WAITING FOR DATA'}
                            </span>
                        )}
                    </div>
                    {/* Tooltip Overlay */}
                    <div
                        ref={tooltipRef}
                        style={{
                            position: 'absolute',
                            display: 'none',
                            padding: '8px',
                            boxSizing: 'border-box',
                            fontSize: '12px',
                            background: 'rgba(20, 20, 20, 0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            pointerEvents: 'none',
                            zIndex: 10,
                            transform: 'translate(-50%, -120%)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            minWidth: '80px',
                            textAlign: 'center'
                        }}
                    />
                    <div ref={chartContainerRef} style={{ width: '100%', height: '380px' }} />
                </motion.div>

                <motion.div className="glass-panel widget trades-list" variants={itemVariants} style={{ maxHeight: '480px' }}>
                    <div className="widget-header">
                        <h2 className="widget-title"><Brain size={20} /> AI Trade Feed</h2>
                    </div>

                    <div style={{ overflowY: 'auto', paddingRight: '0.5rem', flexGrow: 1 }}>
                        {trades.filter(t => !t.product || t.product === selectedProduct).length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.85rem' }}>
                                Awaiting AI signals on {selectedProduct}…
                            </div>
                        )}
                        {trades.filter(t => !t.product || t.product === selectedProduct).map(trade => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={trade.id}
                                className="trade-item"
                            >
                                <div className="trade-info">
                                    <span className={`trade-type ${trade.type?.toLowerCase()}`}>
                                        {trade.type} • {trade.product || selectedProduct}
                                    </span>
                                    <span className="trade-time">{trade.time ? new Date(trade.time).toLocaleTimeString() : '—'}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="trade-amount">{trade.amount} {activeProduct.base}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        @ ${trade.price != null ? trade.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
            </div>
        </motion.div>
    );
}
