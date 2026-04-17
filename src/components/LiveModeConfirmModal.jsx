import React, { useState } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';

export default function LiveModeConfirmModal({ onConfirm, onCancel }) {
    const [check1, setCheck1] = useState(false);
    const [check2, setCheck2] = useState(false);

    const canConfirm = check1 && check2;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(255, 159, 10, 0.4)',
                borderRadius: '16px',
                padding: '2rem',
                width: '100%',
                maxWidth: '480px',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <AlertTriangle size={40} color="#FF9F0A" style={{ marginBottom: '0.75rem' }} />
                    <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem' }}>
                        Switch to Live Trading
                    </h3>
                </div>

                <div style={{
                    background: 'rgba(255, 159, 10, 0.08)',
                    border: '1px solid rgba(255, 159, 10, 0.2)',
                    borderRadius: '10px',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.7
                }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                        This will connect the AI directly to your <strong style={{ color: 'var(--text-primary)' }}>real Coinbase account</strong>.
                        Live mode is AI Assisted in this release: every proposed real order requires your confirmation.
                    </p>
                    <p style={{ margin: 0 }}>
                        You are solely responsible for all trades, profits, and losses.
                        Crypto markets are highly volatile. Only use funds you can afford to lose.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem'
                    }}>
                        <input
                            type="checkbox"
                            checked={check1}
                            onChange={e => setCheck1(e.target.checked)}
                            style={{ marginTop: '2px', accentColor: '#FF9F0A', flexShrink: 0 }}
                        />
                        I understand this involves <strong style={{ color: 'var(--text-primary)' }}>&nbsp;real money&nbsp;</strong>
                        and real Coinbase orders can execute only after I confirm each AI Assisted trade.
                    </label>
                    <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem'
                    }}>
                        <input
                            type="checkbox"
                            checked={check2}
                            onChange={e => setCheck2(e.target.checked)}
                            style={{ marginTop: '2px', accentColor: '#FF9F0A', flexShrink: 0 }}
                        />
                        I have reviewed and configured my <strong style={{ color: 'var(--text-primary)' }}>&nbsp;risk limits&nbsp;</strong>
                        (per-trade %, daily loss limit, stop-loss) and the kill switch is accessible.
                    </label>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            padding: '0.7rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.85rem'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        style={{
                            flex: 1,
                            padding: '0.7rem',
                            background: canConfirm ? 'rgba(255, 159, 10, 0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${canConfirm ? 'rgba(255, 159, 10, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '8px',
                            color: canConfirm ? '#FF9F0A' : 'var(--text-muted)',
                            cursor: canConfirm ? 'pointer' : 'not-allowed',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Zap size={14} />
                        ACTIVATE LIVE TRADING
                    </button>
                </div>
            </div>
        </div>
    );
}
