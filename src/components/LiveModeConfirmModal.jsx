import React, { useState } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';

const DEFAULT_RISK = { maxTradePercent: 2, stopLossPercent: 3, takeProfitPercent: 6, dailyLossLimitPercent: 5 };

function isOnDefaults(rs) {
    if (!rs) return true;
    return rs.maxTradePercent === DEFAULT_RISK.maxTradePercent &&
        rs.stopLossPercent === DEFAULT_RISK.stopLossPercent &&
        rs.takeProfitPercent === DEFAULT_RISK.takeProfitPercent &&
        rs.dailyLossLimitPercent === DEFAULT_RISK.dailyLossLimitPercent;
}

export default function LiveModeConfirmModal({ onConfirm, onCancel, riskSettings }) {
    const [check1, setCheck1] = useState(false);
    const [check2, setCheck2] = useState(false);
    const [check3, setCheck3] = useState(false);

    const onDefaults = isOnDefaults(riskSettings);
    const canConfirm = check1 && check2 && (!onDefaults || check3);

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
                        This will connect AI-assisted analysis to your <strong style={{ color: 'var(--text-primary)' }}>real Coinbase account</strong>.
                        Live mode is AI Assisted: every proposed real order requires your manual confirmation before execution.
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                        You are solely responsible for all trades, profits, and losses.
                        Crypto markets are highly volatile. Only use funds you can afford to lose entirely.
                        AI signals are not financial advice.
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85 }}>
                        🔑 <strong style={{ color: 'var(--text-primary)' }}>Key permissions:</strong> Use Coinbase API keys with <em>trade</em> permission only.
                        Never grant <em>transfer</em> or <em>withdrawal</em> permissions to these keys.
                        Estimated fills include 0.6% taker fee + 0.1% slippage — actual Coinbase fees may differ.
                    </p>
                </div>

                {onDefaults && (
                    <div style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--accent-red)', lineHeight: 1.5 }}>
                        ⚠ Your risk settings are still at factory defaults. We strongly recommend opening <strong>Risk Settings ⚙</strong> and customising your stop-loss, take-profit, and daily loss limit before trading with real money.
                    </div>
                )}

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
                    {onDefaults && (
                        <label style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                            cursor: 'pointer', color: 'rgba(255,69,58,0.85)', fontSize: '0.85rem'
                        }}>
                            <input
                                type="checkbox"
                                checked={check3}
                                onChange={e => setCheck3(e.target.checked)}
                                style={{ marginTop: '2px', accentColor: '#FF453A', flexShrink: 0 }}
                            />
                            I acknowledge my risk settings are at defaults and I accept any losses that may result.
                        </label>
                    )}
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
