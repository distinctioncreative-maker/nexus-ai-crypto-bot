import React, { useState, useEffect } from 'react';
import { Check, X, Brain, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { sendConfirmTrade } from '../services/websocket';

export default function PendingTradeCard() {
    const { pendingTrade, tradingMode, wsConnected } = useStore();
    const [timeLeft, setTimeLeft] = useState(60);
    const [customAmount, setCustomAmount] = useState(null);
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        if (!pendingTrade) { setTimeLeft(60); setTimedOut(false); return; }
        setCustomAmount(pendingTrade.amount);
        setTimedOut(false);

        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.floor((pendingTrade.expiresAt - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                setTimedOut(true);
                clearInterval(interval);
                setTimeout(() => {
                    sendConfirmTrade(pendingTrade.tradeId, false);
                }, 2500);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [pendingTrade]);

    if (!pendingTrade || tradingMode !== 'AI_ASSISTED') return null;

    const isBuy = pendingTrade.side === 'BUY';
    const isLiveTrade = !!pendingTrade.isLive;
    const accentColor = isBuy ? 'var(--accent-green)' : 'var(--accent-red)';
    const tradeValue = (customAmount || pendingTrade.amount) * pendingTrade.price;
    const timerPct = (timeLeft / 60) * 100;

    const signals = pendingTrade.signals;
    const fearGreed = signals?.fearGreed;
    const composite = signals?.compositeScore;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 8000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            {/* Bottom sheet on mobile, centered card on desktop */}
            <div style={{
                background: 'var(--bg-card)',
                border: `1px solid ${accentColor}40`,
                borderRadius: 'clamp(20px, 4vw, 20px) clamp(20px, 4vw, 20px) 0 0',
                padding: 'clamp(1.25rem, 5vw, 2rem)',
                width: '100%',
                maxWidth: '480px',
                maxHeight: '92vh',
                overflowY: 'auto',
                paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            {isBuy ? <TrendingUp size={20} color={accentColor} /> : <TrendingDown size={20} color={accentColor} />}
                            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: accentColor }}>
                                {pendingTrade.side} {pendingTrade.product}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            AI-assisted analysis — user-confirmed execution
                            {isLiveTrade ? (
                                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,69,58,0.2)', color: 'var(--accent-red)', border: '1px solid rgba(255,69,58,0.4)', letterSpacing: '0.06em' }}>
                                    LIVE ORDER
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(10,132,255,0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(10,132,255,0.3)', letterSpacing: '0.06em' }}>
                                    PAPER SIM
                                </span>
                            )}
                        </div>
                    </div>
                    {timedOut ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-orange)', fontSize: '0.8rem', fontWeight: 700 }}>
                            <Clock size={14} />
                            TIMED OUT
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: timeLeft < 15 ? 'var(--accent-red)' : 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            <Clock size={14} />
                            {timeLeft}s
                        </div>
                    )}
                </div>

                {/* Timer bar */}
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginBottom: '1.25rem', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${timerPct}%`,
                        background: timerPct > 33 ? accentColor : 'var(--accent-red)',
                        transition: 'width 0.5s linear, background 0.3s'
                    }} />
                </div>

                {/* Trade details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {[
                        ['Est. Fill Price', `$${pendingTrade.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                        ['Est. Value', `$${tradeValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                        ['Confidence', `${pendingTrade.confidence}%`],
                        ...(fearGreed ? [['Fear & Greed', `${fearGreed.value}/100`]] : []),
                        ...(composite !== undefined ? [['Signal Score', composite > 0 ? `+${composite}` : `${composite}`]] : [])
                    ].map(([label, value]) => (
                        <div key={label} style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>{label}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                        </div>
                    ))}
                </div>

                {/* Confidence meter */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        <span>AI Confidence</span>
                        <span style={{ color: 'var(--text-primary)' }}>{pendingTrade.confidence}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pendingTrade.confidence}%`, background: pendingTrade.confidence > 80 ? 'var(--accent-green)' : pendingTrade.confidence > 60 ? 'var(--accent-blue)' : 'rgba(255,159,10,0.8)', borderRadius: '3px' }} />
                    </div>
                </div>

                {/* AI Reasoning */}
                <div style={{ padding: '0.75rem', background: 'rgba(10, 132, 255, 0.06)', border: '1px solid rgba(10, 132, 255, 0.15)', borderRadius: '8px', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.75rem', color: 'var(--accent-blue)' }}>
                        <Brain size={12} /> AI Reasoning
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                        {pendingTrade.reasoning}
                    </p>
                </div>

                {/* Amount slider */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <span>Trade Amount</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {(customAmount || pendingTrade.amount).toFixed(6)} {pendingTrade.product?.split('-')[0]}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={pendingTrade.amount * 0.1}
                        max={pendingTrade.amount * 2}
                        step={pendingTrade.amount * 0.1}
                        value={customAmount || pendingTrade.amount}
                        onChange={e => setCustomAmount(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: accentColor }}
                    />
                </div>

                <div style={{ marginBottom: '0.75rem', fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.65, textAlign: 'center', lineHeight: 1.4 }}>
                    {isLiveTrade
                        ? 'Real Coinbase order — actual fill price and fees may differ from estimates. Not financial advice.'
                        : 'Paper trading simulation — virtual funds only. Includes ~0.6% taker fee + 0.1% slippage estimate.'}
                </div>

                {!wsConnected && (
                    <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.3)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--accent-orange)' }}>
                        ⚠ WebSocket disconnected — approval will be sent when reconnected. Trade remains open.
                    </div>
                )}

                {/* Buttons — stacked for better mobile tap targets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <button
                        onClick={() => sendConfirmTrade(pendingTrade.tradeId, true, customAmount)}
                        style={{
                            width: '100%', padding: '0.85rem',
                            background: isBuy ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
                            border: `1px solid ${accentColor}50`,
                            borderRadius: '12px', color: accentColor,
                            cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            minHeight: 52,
                        }}
                    >
                        <Check size={18} /> Accept {pendingTrade.side}
                    </button>
                    <button
                        onClick={() => sendConfirmTrade(pendingTrade.tradeId, false)}
                        style={{
                            width: '100%', padding: '0.75rem',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            minHeight: 44,
                        }}
                    >
                        <X size={16} /> Reject Trade
                    </button>
                </div>
            </div>
        </div>
    );
}
