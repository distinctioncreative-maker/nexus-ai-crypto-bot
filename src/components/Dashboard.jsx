import React, { useEffect, useRef, useState } from 'react';
import { Brain, TrendingUp, Zap, ChevronDown, Activity, BarChart2, TrendingDown } from 'lucide-react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { sendProductChange } from '../services/websocket';
import { authFetch } from '../lib/supabase';
import { apiUrl } from '../lib/api';

const PRODUCTS = [
    { id: 'BTC-USD',  label: 'Bitcoin',   symbol: 'BTC'  },
    { id: 'ETH-USD',  label: 'Ethereum',  symbol: 'ETH'  },
    { id: 'SOL-USD',  label: 'Solana',    symbol: 'SOL'  },
    { id: 'DOGE-USD', label: 'Dogecoin',  symbol: 'DOGE' },
    { id: 'XRP-USD',  label: 'XRP',       symbol: 'XRP'  },
    { id: 'ADA-USD',  label: 'Cardano',   symbol: 'ADA'  },
    { id: 'AVAX-USD', label: 'Avalanche', symbol: 'AVAX' },
    { id: 'MATIC-USD',label: 'Polygon',   symbol: 'MATIC'},
    { id: 'LINK-USD', label: 'Chainlink', symbol: 'LINK' },
    { id: 'LTC-USD',  label: 'Litecoin',  symbol: 'LTC'  },
];

export default function Dashboard() {
    const {
        currentPrice, aiStatus, trades, balance, assetHoldings,
        isLiveMode, marketHistory, selectedProduct, setSelectedProduct,
        strategies
    } = useStore();

    const [signals, setSignals] = useState(null);
    useEffect(() => {
        authFetch(apiUrl('/api/signals'))
            .then(r => r.json())
            .then(setSignals)
            .catch(() => {});
        const t = setInterval(() => {
            authFetch(apiUrl('/api/signals')).then(r => r.json()).then(setSignals).catch(() => {});
        }, 5 * 60 * 1000);
        return () => clearInterval(t);
    }, []);

    const winningStrategy = strategies?.filter(s => s.status === 'active').sort((a, b) => b.sharpe - a.sharpe)[0];

    const chartContainerRef = useRef();
    const lineSeriesRef = useRef(null);
    const chartRef = useRef(null);

    const priceColor = isLiveMode ? 'rgba(255, 69, 58, 1)' : 'rgba(10, 132, 255, 1)';
    const bgColor = 'transparent';

    const activeProduct = PRODUCTS.find(p => p.id === selectedProduct) || PRODUCTS[0];

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

        // Load existing history
        if (marketHistory.length > 0) {
            const uniqueHistory = [];
            const seenTimes = new Set();
            marketHistory.forEach(point => {
                if (!seenTimes.has(point.time)) {
                    seenTimes.add(point.time);
                    uniqueHistory.push(point);
                }
            });
            lineSeries.setData(uniqueHistory);
        }

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                lineSeriesRef.current = null;
            }
        };
    }, [isLiveMode, selectedProduct]); // Recreate on mode or product change

    // Stream new ticks into the chart
    useEffect(() => {
        if (lineSeriesRef.current && marketHistory.length > 0) {
            try {
                const latestPoint = marketHistory[marketHistory.length - 1];
                lineSeriesRef.current.update(latestPoint);
            } catch (e) {
                // Time ordering issues are expected; ignore silently
            }
        }
    }, [marketHistory]);

    const handleProductChange = (e) => {
        const newProduct = e.target.value;
        sendProductChange(newProduct);
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
                    <div className="metric-label">{activeProduct.symbol} Live Price</div>
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
                        <strong style={{ color: 'var(--text-primary)' }}>{activeProduct.symbol} Holdings:</strong>{' '}
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
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Fear & Greed</div>
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
                            <TrendingUp size={20} />
                            {winningStrategy ? `${winningStrategy.name}` : 'Quant Core Engine'}
                        </h2>

                        {/* Instrument Selector */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <select
                                value={selectedProduct}
                                onChange={handleProductChange}
                                style={{
                                    appearance: 'none',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    padding: '0.4rem 2rem 0.4rem 0.75rem',
                                    fontSize: '0.8rem',
                                    fontFamily: 'var(--font-mono)',
                                    cursor: 'pointer',
                                    outline: 'none',
                                }}
                            >
                                {PRODUCTS.map(p => (
                                    <option key={p.id} value={p.id} style={{ background: '#0a0a0a' }}>
                                        {p.symbol} / USD
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                size={14}
                                style={{
                                    position: 'absolute',
                                    right: '0.5rem',
                                    pointerEvents: 'none',
                                    color: 'var(--text-secondary)'
                                }}
                            />
                        </div>
                    </div>

                    <div ref={chartContainerRef} style={{ width: '100%', height: '380px' }} />
                </motion.div>

                <motion.div className="glass-panel widget trades-list" variants={itemVariants} style={{ maxHeight: '480px' }}>
                    <div className="widget-header">
                        <h2 className="widget-title"><Brain size={20} /> AI Trade Feed</h2>
                    </div>

                    <div style={{ overflowY: 'auto', paddingRight: '0.5rem', flexGrow: 1 }}>
                        {trades.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.85rem' }}>
                                Awaiting AI signals on {selectedProduct}…
                            </div>
                        )}
                        {trades.map(trade => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={trade.id}
                                className="trade-item"
                            >
                                <div className="trade-info">
                                    <span className={`trade-type ${trade.type.toLowerCase()}`}>
                                        {trade.type} • {trade.product || selectedProduct}
                                    </span>
                                    <span className="trade-time">{new Date(trade.time).toLocaleTimeString()}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="trade-amount">{trade.amount} {activeProduct.symbol}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        @ ${trade.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
