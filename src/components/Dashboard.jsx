import React, { useEffect, useRef } from 'react';
import { Brain, TrendingUp, Zap } from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

export default function Dashboard() {
  const { currentPrice, aiStatus, trades, balance, isLiveMode, marketHistory } = useStore();
  const chartContainerRef = useRef();
  const lineSeriesRef = useRef(null);

  const priceColor = isLiveMode ? 'rgba(255, 69, 58, 1)' : 'rgba(10, 132, 255, 1)'; // Red for Live, Blue for Paper
  const bgColor = 'transparent';

  useEffect(() => {
    // Initialize Lightweight Chart for Luxury UX
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor: 'rgba(255, 255, 255, 0.6)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 480,
    });

    const lineSeries = chart.addAreaSeries({ 
        lineColor: priceColor,
        topColor: isLiveMode ? 'rgba(255, 69, 58, 0.3)' : 'rgba(10, 132, 255, 0.3)',
        bottomColor: isLiveMode ? 'rgba(255, 69, 58, 0.0)' : 'rgba(10, 132, 255, 0.0)',
        lineWidth: 2,
    });

    lineSeriesRef.current = lineSeries;

    // Load Initial Data
    if (marketHistory.length > 0) {
        // Remove duplicates and ensure unique ascending times
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

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  // Recreate the chart only when mode changes; live data is streamed into the existing series below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveMode]);

  // Update chart when realtime data comes in
  useEffect(() => {
     if (lineSeriesRef.current && marketHistory.length > 0) {
         try {
             // Lightweight charts requires strictly ascending time values
             const latestPoint = marketHistory[marketHistory.length - 1];
             lineSeriesRef.current.update(latestPoint);
         } catch(e) {
             console.error("Chart Update Error (time out of order):", e);
         }
     }
  }, [marketHistory]);

  const containerVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } }
  };

  const itemVariants = {
      hidden: { opacity: 0, scale: 0.95 },
      visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div className="metrics-container" variants={itemVariants}>
        <div className="glass-panel metric-card">
          <div className="metric-label">Total Portfolio ({isLiveMode ? 'Real' : 'Virtual'})</div>
          <div className="metric-value">
            ${balance.toLocaleString('en-US', {minimumFractionDigits: 2})}
          </div>
        </div>
        <div className="glass-panel metric-card">
          <div className="metric-label">BTC Live Execution Price</div>
          <div className="metric-value price-display" style={{ color: priceColor }}>
            ${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>
        <div className="glass-panel metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <Zap size={16} color={isLiveMode ? 'var(--accent-red)' : 'var(--accent-blue)'}/> Engine Status
          </div>
          <div className="metric-value" style={{ fontSize: '1rem', marginTop: '0.2rem', color: 'var(--text-primary)' }}>
            {aiStatus}
          </div>
        </div>
      </motion.div>

      <div className="dashboard-grid">
        <motion.div className="glass-panel widget chart-container" variants={itemVariants} style={{ height: '540px' }}>
          <div className="widget-header">
            <h2 className="widget-title"><TrendingUp size={20} /> Kalshi Core Engine</h2>
          </div>
          <div ref={chartContainerRef} style={{ flexGrow: 1, width: '100%', position: 'relative' }}></div>
        </motion.div>

        <motion.div className="glass-panel widget trades-list" variants={itemVariants} style={{ maxHeight: '540px' }}>
          <div className="widget-header">
             <h2 className="widget-title"><Brain size={20} /> AI Trade Feed</h2>
          </div>
          
            <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
              {trades.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem'}}>Awaiting AI Signals...</div>}
              {trades.map(trade => (
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={trade.id} 
                    className="trade-item"
                >
                  <div className="trade-info">
                    <span className={`trade-type ${trade.type.toLowerCase()}`}>
                      {trade.type} • AI Signal
                    </span>
                    <span className="trade-time">{new Date(trade.time).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="trade-amount">{trade.amount} BTC</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      @ ${trade.price.toLocaleString('en-US', {minimumFractionDigits: 2})}
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
