import React, { useState, useEffect } from 'react';
import { Play, Square, FlaskConical, Zap, Lock, Loader } from 'lucide-react';
import { useStore } from '../store/useStore';
import { sendEngineStatusChange, sendTradingModeChange } from '../services/websocket';

export default function EngineControl({ onLiveRequest }) {
    const { engineStatus, tradingMode, hasCoinbaseKeys } = useStore();
    const [transitioning, setTransitioning] = useState(false);

    // Clear transitioning state once the server confirms the new engine status
    useEffect(() => { setTransitioning(false); }, [engineStatus]);

    const isRunning = engineStatus !== 'STOPPED';
    const isPaper   = engineStatus === 'PAPER_RUNNING';
    const isLive    = engineStatus === 'LIVE_RUNNING';

    const selectedMode = isLive ? 'LIVE' : 'PAPER'; // which mode pill is highlighted

    const handleModeSelect = (mode) => {
        // Mode selection only — does NOT start the engine
        if (mode === 'LIVE' && !hasCoinbaseKeys) return;
        if (mode === 'LIVE' && isRunning) {
            onLiveRequest?.();
            return;
        }
        // If engine stopped, just remember the intended mode (not persisted — user must press START)
    };

    const handleStartStop = () => {
        if (transitioning) return;
        setTransitioning(true);
        if (isRunning) {
            sendEngineStatusChange('STOPPED');
        } else {
            if (selectedMode === 'LIVE') {
                setTransitioning(false); // modal takes over, no WS call yet
                onLiveRequest?.();
            } else {
                sendEngineStatusChange('PAPER_RUNNING');
            }
        }
        // Safety: clear transitioning after 4s if server doesn't respond
        setTimeout(() => setTransitioning(false), 4000);
    };

    const handleTradingModeToggle = () => {
        const next = tradingMode === 'FULL_AUTO' ? 'AI_ASSISTED' : 'FULL_AUTO';
        sendTradingModeChange(next);
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-xl, 18px)',
            padding: '0.3rem 0.5rem',
        }}>
            {/* Mode selector pills */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
                {/* PAPER pill */}
                <button
                    onClick={() => !isLive && sendEngineStatusChange(isRunning ? 'STOPPED' : 'PAPER_RUNNING')}
                    title="Paper trading — virtual $100k, no real money"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: 'var(--radius-md, 10px)',
                        border: `1px solid ${isPaper ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                        background: isPaper ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.04)',
                        color: isPaper ? 'var(--accent-blue)' : 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        transition: 'all 0.15s',
                    }}
                >
                    <FlaskConical size={12} />
                    PAPER
                </button>

                {/* LIVE pill */}
                <button
                    onClick={() => hasCoinbaseKeys && onLiveRequest?.()}
                    title={hasCoinbaseKeys ? 'Live trading — real Coinbase orders' : 'Add Coinbase API keys to enable live trading'}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: 'var(--radius-md, 10px)',
                        border: `1px solid ${isLive ? 'rgba(255,69,58,0.5)' : 'rgba(255,255,255,0.06)'}`,
                        background: isLive ? 'rgba(255,69,58,0.15)' : 'rgba(255,255,255,0.04)',
                        color: isLive ? 'var(--accent-red)' : hasCoinbaseKeys ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)',
                        cursor: hasCoinbaseKeys ? 'pointer' : 'not-allowed',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        opacity: hasCoinbaseKeys ? 1 : 0.5,
                        transition: 'all 0.15s',
                    }}
                >
                    {hasCoinbaseKeys ? <Zap size={12} /> : <Lock size={12} />}
                    LIVE
                </button>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

            {/* START / STOP button */}
            <button
                onClick={handleStartStop}
                disabled={transitioning}
                title={transitioning ? 'Please wait…' : isRunning ? 'Stop the AI trading engine' : 'Start the AI trading engine in Paper mode'}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.35rem 0.9rem',
                    borderRadius: 'var(--radius-md, 10px)',
                    border: transitioning
                        ? '1px solid rgba(255,159,10,0.35)'
                        : isRunning
                            ? '1px solid rgba(48,209,88,0.4)'
                            : '1px solid rgba(255,255,255,0.15)',
                    background: transitioning
                        ? 'rgba(255,159,10,0.08)'
                        : isRunning
                            ? 'rgba(48,209,88,0.12)'
                            : 'rgba(255,255,255,0.07)',
                    color: transitioning ? 'var(--accent-orange)' : isRunning ? 'var(--accent-green)' : 'var(--text-primary)',
                    cursor: transitioning ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    transition: 'all 0.2s',
                    animation: (!transitioning && isRunning) ? 'enginePulse 2.5s ease-in-out infinite' : 'none',
                    boxShadow: (!transitioning && isRunning) ? '0 0 12px rgba(48,209,88,0.2)' : 'none',
                }}
            >
                {transitioning
                    ? <><Loader size={11} style={{ animation: 'spin 0.9s linear infinite' }} /> {isRunning ? 'STOPPING…' : 'STARTING…'}</>
                    : isRunning
                        ? <><Square size={11} fill="currentColor" /> RUNNING</>
                        : <><Play  size={11} fill="currentColor" /> START ENGINE</>
                }
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

            {/* Trading mode toggle */}
            <button
                onClick={handleTradingModeToggle}
                title={tradingMode === 'FULL_AUTO'
                    ? 'Full Auto: AI executes trades without asking you'
                    : 'AI Assisted: You approve each trade in a 60s window'}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: 'var(--radius-md, 10px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: tradingMode === 'AI_ASSISTED'
                        ? 'rgba(191,90,242,0.1)'
                        : 'rgba(255,255,255,0.04)',
                    color: tradingMode === 'AI_ASSISTED'
                        ? 'var(--accent-purple)'
                        : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                }}
            >
                {tradingMode === 'AI_ASSISTED' ? 'AI ASSISTED' : 'FULL AUTO'}
            </button>
        </div>
    );
}
