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
    const [saveError, setSaveError] = useState('');

    const handleOpen = () => {
        setLocal({ ...riskSettings });
        setOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        try {
            const res = await authFetch(apiUrl('/api/risk-settings'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(local)
            });
            const data = await res.json();
            if (data.error) { setSaveError(data.error); return; }
            if (data.riskSettings) setRiskSettings(data.riskSettings);
            setOpen(false);
        } catch (err) {
            setSaveError(err.message || 'Failed to save. Check your connection.');
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
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '16px',
                        width: '460px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        <div style={{ padding: '1.75rem 1.75rem 0', overflowY: 'auto', flex: 1 }}>
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

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Absolute Price Targets (per position)</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Stop Loss Price (USD)</label>
                                    <input
                                        type="number" min={0} step={1}
                                        placeholder="e.g. 88000"
                                        value={local.stopLossPrice || ''}
                                        onChange={e => setLocal(l => ({ ...l, stopLossPrice: e.target.value ? parseFloat(e.target.value) : null }))}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255,69,58,0.06)',
                                            border: '1px solid rgba(255,69,58,0.25)',
                                            borderRadius: '6px', color: 'var(--text-primary)',
                                            padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)',
                                            fontSize: '0.82rem'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Take Profit Price (USD)</label>
                                    <input
                                        type="number" min={0} step={1}
                                        placeholder="e.g. 110000"
                                        value={local.takeProfitPrice || ''}
                                        onChange={e => setLocal(l => ({ ...l, takeProfitPrice: e.target.value ? parseFloat(e.target.value) : null }))}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(48,209,88,0.06)',
                                            border: '1px solid rgba(48,209,88,0.25)',
                                            borderRadius: '6px', color: 'var(--text-primary)',
                                            padding: '0.4rem 0.75rem', fontFamily: 'var(--font-mono)',
                                            fontSize: '0.82rem'
                                        }}
                                    />
                                </div>
                            </div>
                            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>Leave blank to disable. Triggers auto-sell when price crosses these levels.</p>
                        </div>

                        {/* SmartTrade: Trailing Stop */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                SmartTrade: Trailing Stop
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    id="trailingStop"
                                    checked={!!local.trailingStopPct}
                                    onChange={e => setLocal(l => ({ ...l, trailingStopPct: e.target.checked ? (l.trailingStopPct || 3) : null }))}
                                    style={{ accentColor: 'var(--accent-blue)', width: '16px', height: '16px' }}
                                />
                                <label htmlFor="trailingStop" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    Enable trailing stop — stop follows price up, locks in gains
                                </label>
                            </div>
                            {!!local.trailingStopPct && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Trail distance</label>
                                    <input
                                        type="number" min={0.5} max={20} step={0.5}
                                        value={local.trailingStopPct}
                                        onChange={e => setLocal(l => ({ ...l, trailingStopPct: parseFloat(e.target.value) || null }))}
                                        style={{ width: '80px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: 'var(--text-primary)', padding: '0.35rem 0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                                    />
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>%</span>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                        Sells if price drops {local.trailingStopPct}% from peak
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* SmartTrade: Multi-TP Levels */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                SmartTrade: Multi Take-Profit Levels
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    id="multiTp"
                                    checked={Array.isArray(local.multiTpLevels) && local.multiTpLevels.length > 0}
                                    onChange={e => setLocal(l => ({
                                        ...l,
                                        multiTpLevels: e.target.checked
                                            ? [{ pct: 5, qtyPct: 33 }, { pct: 10, qtyPct: 33 }, { pct: 20, qtyPct: 34 }]
                                            : null
                                    }))}
                                    style={{ accentColor: 'var(--accent-green)', width: '16px', height: '16px' }}
                                />
                                <label htmlFor="multiTp" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    Sell in stages — lock in profits at multiple levels
                                </label>
                            </div>
                            {Array.isArray(local.multiTpLevels) && local.multiTpLevels.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr 30px', gap: '0.4rem', fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.1rem' }}>
                                        <span>At gain %</span><span /><span>Sell qty %</span><span /><span />
                                    </div>
                                    {local.multiTpLevels.map((level, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 16px 80px 1fr 30px', gap: '0.4rem', alignItems: 'center' }}>
                                            <input
                                                type="number" min={1} max={100} step={1}
                                                value={level.pct}
                                                onChange={e => setLocal(l => {
                                                    const levels = [...l.multiTpLevels];
                                                    levels[i] = { ...levels[i], pct: parseFloat(e.target.value) || 0 };
                                                    return { ...l, multiTpLevels: levels };
                                                })}
                                                style={{ background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: '6px', color: 'var(--text-primary)', padding: '0.35rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                                            />
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center' }}>%</span>
                                            <input
                                                type="number" min={1} max={100} step={1}
                                                value={level.qtyPct}
                                                onChange={e => setLocal(l => {
                                                    const levels = [...l.multiTpLevels];
                                                    levels[i] = { ...levels[i], qtyPct: parseFloat(e.target.value) || 0 };
                                                    return { ...l, multiTpLevels: levels };
                                                })}
                                                style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.2)', borderRadius: '6px', color: 'var(--text-primary)', padding: '0.35rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                                            />
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                                of position
                                            </span>
                                            <button
                                                onClick={() => setLocal(l => ({ ...l, multiTpLevels: l.multiTpLevels.filter((_, j) => j !== i) }))}
                                                style={{ background: 'none', border: 'none', color: 'rgba(255,69,58,0.5)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                                            >✕</button>
                                        </div>
                                    ))}
                                    {local.multiTpLevels.length < 5 && (
                                        <button
                                            onClick={() => setLocal(l => ({ ...l, multiTpLevels: [...l.multiTpLevels, { pct: 30, qtyPct: 25 }] }))}
                                            style={{ alignSelf: 'flex-start', background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)', borderRadius: '6px', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                        >
                                            + Add level
                                        </button>
                                    )}
                                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.25rem' }}>
                                        Total qty % should add up to 100%. Partial sells execute automatically as price hits each target.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div style={{ background: 'rgba(255, 159, 10, 0.06)', border: '1px solid rgba(255, 159, 10, 0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.75rem', color: 'rgba(255, 159, 10, 0.8)', lineHeight: 1.5 }}>
                            These settings apply to all future trades. Crypto is highly volatile — never risk money you cannot afford to lose.
                        </div>

                        </div>{/* end scrollable area */}

                        {/* Pinned footer */}
                        <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                            {saveError && (
                                <div style={{ marginBottom: '0.6rem', padding: '0.4rem 0.75rem', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--accent-red)' }}>
                                    {saveError}
                                </div>
                            )}
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
                                    style={{ padding: '0.5rem 1.4rem', background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.4)', borderRadius: '8px', color: 'var(--accent-blue)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                                >
                                    {saving ? 'Saving…' : 'Save Settings'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
