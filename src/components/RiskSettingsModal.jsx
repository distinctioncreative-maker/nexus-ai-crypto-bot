import React, { useState } from 'react';
import { Settings, X, Info } from 'lucide-react';
import { useStore } from '../store/useStore';
import { authFetch } from '../lib/supabase';
import { apiUrl } from '../lib/api';

function SliderField({ label, tooltip, value, min, max, step, unit, onChange }) {
    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {label}
                    <span title={tooltip} style={{ cursor: 'help', color: 'rgba(255,255,255,0.3)' }}>
                        <Info size={11} />
                    </span>
                </label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {value}{unit}
                </span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
            />
        </div>
    );
}

export default function RiskSettingsModal() {
    const { riskSettings, setRiskSettings } = useStore();
    const [open, setOpen] = useState(false);
    const [local, setLocal] = useState({ ...riskSettings });
    const [saving, setSaving] = useState(false);

    const handleOpen = () => {
        setLocal({ ...riskSettings });
        setOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(apiUrl('/api/risk-settings'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(local)
            });
            const data = await res.json();
            if (data.riskSettings) setRiskSettings(data.riskSettings);
            setOpen(false);
        } catch (err) {
            console.error('Failed to save risk settings:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <button
                onClick={handleOpen}
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0.35rem 0.6rem',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="Risk Settings"
            >
                <Settings size={18} />
            </button>

            {open && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9000,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        width: '460px',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Settings size={18} /> Risk Settings
                            </h3>
                            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <SliderField
                            label="Per-Trade Max (%)" unit="%" min={0.5} max={10} step={0.5}
                            value={local.maxTradePercent}
                            tooltip="Maximum % of portfolio risked per trade. Industry standard: 1-2%."
                            onChange={v => setLocal(l => ({ ...l, maxTradePercent: v }))}
                        />
                        <SliderField
                            label="Daily Loss Limit (%)" unit="%" min={1} max={20} step={0.5}
                            value={local.dailyLossLimitPercent}
                            tooltip="AI halts trading if daily portfolio loss exceeds this threshold."
                            onChange={v => setLocal(l => ({ ...l, dailyLossLimitPercent: v }))}
                        />
                        <SliderField
                            label="Stop Loss (%)" unit="%" min={0.5} max={10} step={0.5}
                            value={local.stopLossPercent}
                            tooltip="Auto sell if position drops this % below entry price (live mode)."
                            onChange={v => setLocal(l => ({ ...l, stopLossPercent: v }))}
                        />
                        <SliderField
                            label="Take Profit (%)" unit="%" min={1} max={25} step={0.5}
                            value={local.takeProfitPercent}
                            tooltip="Auto sell if position gains this % above entry price (live mode)."
                            onChange={v => setLocal(l => ({ ...l, takeProfitPercent: v }))}
                        />
                        <SliderField
                            label="Max Position Size (%)" unit="%" min={10} max={100} step={5}
                            value={local.maxPositionPercent}
                            tooltip="Maximum % of portfolio that can be in a single asset at once."
                            onChange={v => setLocal(l => ({ ...l, maxPositionPercent: v }))}
                        />
                        <SliderField
                            label="Volatility Reduce Threshold (%)" unit="%" min={2} max={20} step={1}
                            value={local.volatilityReduceThreshold}
                            tooltip="If the asset moves this % in 1 hour, order size is halved."
                            onChange={v => setLocal(l => ({ ...l, volatilityReduceThreshold: v }))}
                        />

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Max Single Order (USD)</label>
                            <input
                                type="number" min={10} max={100000} step={10}
                                value={local.maxSingleOrderUSD}
                                onChange={e => setLocal(l => ({ ...l, maxSingleOrderUSD: parseFloat(e.target.value) }))}
                                style={{
                                    width: '100%', marginTop: '0.4rem',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px', color: 'var(--text-primary)',
                                    padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <input
                                type="checkbox"
                                id="kelly"
                                checked={local.enableKellySize}
                                onChange={e => setLocal(l => ({ ...l, enableKellySize: e.target.checked }))}
                                style={{ accentColor: 'var(--accent-blue)', width: '16px', height: '16px' }}
                            />
                            <label htmlFor="kelly" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                Use Kelly Criterion for position sizing
                                <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '0.3rem' }} title="Dynamically sizes trades based on win rate and average win/loss. Requires 5+ trade history.">
                                    <Info size={11} />
                                </span>
                            </label>
                        </div>

                        <div style={{ background: 'rgba(255, 159, 10, 0.06)', border: '1px solid rgba(255, 159, 10, 0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.75rem', color: 'rgba(255, 159, 10, 0.8)', lineHeight: 1.5 }}>
                            These settings apply to all future trades. Crypto is highly volatile — never risk money you cannot afford to lose.
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setOpen(false)}
                                style={{ padding: '0.5rem 1.2rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{ padding: '0.5rem 1.4rem', background: 'rgba(10, 132, 255, 0.15)', border: '1px solid rgba(10, 132, 255, 0.4)', borderRadius: '8px', color: 'var(--accent-blue)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                            >
                                {saving ? 'Saving…' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
