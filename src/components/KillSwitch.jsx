import React, { useState } from 'react';
import { ShieldOff, AlertTriangle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { sendKillSwitch } from '../services/websocket';

export default function KillSwitch() {
    const { killSwitchActive, killSwitchReason, engineStatus } = useStore();
    const [showConfirm, setShowConfirm] = useState(false);

    // Show whenever engine is running (paper OR live) or kill switch is already active
    if (engineStatus === 'STOPPED' && !killSwitchActive) return null;

    const handleActivate = () => {
        sendKillSwitch(true, 'Manual kill switch — user activated');
        setShowConfirm(false);
    };

    const handleReset = () => {
        sendKillSwitch(false);
    };

    return (
        <>
            {killSwitchActive ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 0.75rem',
                    background: 'rgba(255, 69, 58, 0.15)',
                    border: '1px solid rgba(255, 69, 58, 0.4)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--accent-red)',
                }}>
                    <ShieldOff size={14} />
                    <span title={killSwitchReason || 'Kill switch active'}>KILL SWITCH ACTIVE</span>
                    <button
                        onClick={handleReset}
                        style={{
                            background: 'rgba(255, 69, 58, 0.2)',
                            border: '1px solid rgba(255, 69, 58, 0.4)',
                            borderRadius: '4px',
                            color: 'var(--accent-red)',
                            cursor: 'pointer',
                            padding: '0.1rem 0.4rem',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)'
                        }}
                    >
                        RESET
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowConfirm(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.35rem 0.75rem',
                        background: 'rgba(255, 69, 58, 0.1)',
                        border: '1px solid rgba(255, 69, 58, 0.3)',
                        borderRadius: '8px',
                        color: 'var(--accent-red)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                    }}
                    title="Emergency Kill Switch"
                >
                    <ShieldOff size={14} />
                    KILL
                </button>
            )}

            {showConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid rgba(255, 69, 58, 0.4)',
                        borderRadius: '16px',
                        padding: '2rem',
                        width: '420px',
                        maxWidth: 'calc(100vw - 32px)',
                        textAlign: 'center'
                    }}>
                        <AlertTriangle size={40} color="var(--accent-red)" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Activate Kill Switch?</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                            This will <strong style={{ color: 'var(--text-primary)' }}>immediately halt all AI trading activity</strong> and block any new orders.
                            Cancel all pending orders before activating if in live mode.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowConfirm(false)}
                                style={{
                                    padding: '0.6rem 1.5rem',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleActivate}
                                style={{
                                    padding: '0.6rem 1.5rem',
                                    background: 'rgba(255, 69, 58, 0.2)',
                                    border: '1px solid rgba(255, 69, 58, 0.5)',
                                    borderRadius: '8px',
                                    color: 'var(--accent-red)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 700
                                }}
                            >
                                ACTIVATE KILL SWITCH
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
