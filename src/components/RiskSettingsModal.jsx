import React, { useState, useRef } from 'react';
import { Settings, X, Info, Scale, ShieldCheck, TrendingUp, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { authFetch } from '../lib/supabase';
import { apiUrl } from '../lib/api';

function SliderField({ label, tooltip, value, min, max, step, unit, onChange }) {
    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {label}
                    {tooltip && (
                        <span title={tooltip} style={{ cursor: 'help', color: 'rgba(255,255,255,0.3)' }}>
                            <Info size={11} />
                        </span>
                    )}
                </label>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {value}{unit}
                </span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{min}{unit}</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{max}{unit}</span>
            </div>
        </div>
    );
}

function NumberInput({ label, tooltip, value, min, max, step, prefix, onChange }) {
    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.4rem' }}>
                {label}
                {tooltip && (
                    <span title={tooltip} style={{ cursor: 'help', color: 'rgba(255,255,255,0.3)' }}>
                        <Info size={11} />
                    </span>
                )}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {prefix && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prefix}</span>}
                <input
                    type="number" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(parseFloat(e.target.value))}
                    style={{
                        width: '120px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', color: 'var(--text-primary)',
                        padding: '0.45rem 0.75rem', fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem'
                    }}
                />
            </div>
        </div>
    );
}

function Toggle({ id, label, tooltip, checked, onChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
            <div
                onClick={() => onChange(!checked)}
                style={{
                    width: 38, height: 22, borderRadius: 11, flexShrink: 0, cursor: 'pointer',
                    background: checked ? 'rgba(10,132,255,0.6)' : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${checked ? 'rgba(10,132,255,0.8)' : 'rgba(255,255,255,0.2)'}`,
                    position: 'relative', transition: 'all 0.2s', marginTop: '2px',
                }}
            >
                <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2, left: checked ? 18 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }} />
            </div>
            <label htmlFor={id} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.5 }} onClick={() => onChange(!checked)}>
                {label}
                {tooltip && (
                    <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '0.3rem', verticalAlign: 'middle' }} title={tooltip}>
                        <Info size={11} />
                    </span>
                )}
            </label>
        </div>
    );
}

const TABS = [
    { id: 'sizing', label: 'Sizing', icon: Scale, desc: 'How much capital the AI uses per trade' },
    { id: 'risk',   label: 'Risk',   icon: ShieldCheck, desc: 'Loss protection and circuit breakers' },
    { id: 'smart',  label: 'Smart Trade', icon: TrendingUp, desc: 'Advanced automated exit strategies' },
];

const LABEL_MAP = {
    maxTradePercent: 'Per-Trade Max %',
    dailyLossLimitPercent: 'Daily Loss Limit %',
    maxSingleOrderUSD: 'Max Single Order USD',
    maxPositionPercent: 'Max Position Size %',
    volatilityReduceThreshold: 'Volatility Reduce Threshold %',
    stopLossPercent: 'Stop Loss %',
    takeProfitPercent: 'Take Profit %',
    enableKellySize: 'Kelly Criterion',
    stopLossPrice: 'Stop Loss Price',
    takeProfitPrice: 'Take Profit Price',
    trailingStopPct: 'Trailing Stop %',
    multiTpLevels: 'Multi Take-Profit',
};

function buildDiff(prev, next) {
    const changes = [];
    for (const key of Object.keys(LABEL_MAP)) {
        const a = prev[key], b = next[key];
        const aStr = JSON.stringify(a), bStr = JSON.stringify(b);
        if (aStr !== bStr) {
            const label = LABEL_MAP[key] || key;
            if (key === 'multiTpLevels') {
                changes.push(`${label}: ${a ? `${a.length} levels` : 'off'} → ${b ? `${b.length} levels` : 'off'}`);
            } else if (typeof b === 'boolean') {
                changes.push(`${label}: ${a ? 'on' : 'off'} → ${b ? 'on' : 'off'}`);
            } else {
                changes.push(`${label}: ${a ?? '—'} → ${b ?? '—'}`);
            }
        }
    }
    return changes;
}

export default function RiskSettingsModal() {
    const { riskSettings, setRiskSettings } = useStore();
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('sizing');
    const [local, setLocal] = useState({ ...riskSettings });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [undoToast, setUndoToast] = useState(null);
    const undoTimerRef = useRef(null);

    const validationError = (() => {
        if (local.stopLossPercent >= local.takeProfitPercent) {
            return 'Stop Loss % must be lower than Take Profit %.';
        }
        if (Array.isArray(local.multiTpLevels) && local.multiTpLevels.length > 0) {
            const totalQty = local.multiTpLevels.reduce((s, l) => s + (l.qtyPct || 0), 0);
            if (totalQty > 100) return `Multi-TP qty sums to ${totalQty}% — must be ≤ 100%.`;
        }
        return null;
    })();

    const handleOpen = () => {
        setLocal({ ...riskSettings });
        setActiveTab('sizing');
        setOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        const prevSettings = { ...riskSettings };
        const changes = buildDiff(prevSettings, local);
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
            // Show undo toast for 5s
            clearTimeout(undoTimerRef.current);
            setUndoToast({ prev: prevSettings, changes });
            undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
        } catch (err) {
            setSaveError(err.message || 'Failed to save. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    const handleUndo = async () => {
        clearTimeout(undoTimerRef.current);
        const prev = undoToast?.prev;
        setUndoToast(null);
        if (!prev) return;
        try {
            const res = await authFetch(apiUrl('/api/risk-settings'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prev)
            });
            const data = await res.json();
            if (data.riskSettings) setRiskSettings(data.riskSettings);
        } catch { /* silent */ }
    };

    const set = (key, val) => setLocal(l => ({ ...l, [key]: val }));

    const diffPreview = open ? buildDiff(riskSettings, local) : [];

    return (
        <>
            {/* Undo toast */}
            {undoToast && (
                <div style={{
                    position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: '50%',
                    transform: 'translateX(-50%)', zIndex: 9500,
                    background: 'rgba(16,16,20,0.97)', border: '1px solid rgba(48,209,88,0.3)',
                    borderRadius: '12px', padding: '0.65rem 1rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 260, maxWidth: 'calc(100vw - 32px)',
                    animation: 'fadeSlideIn 0.2s ease',
                }}>
                    <CheckCircle size={16} color="var(--accent-green)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>Settings saved</div>
                        {undoToast.changes.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {undoToast.changes.slice(0, 3).join(' · ')}{undoToast.changes.length > 3 ? ` +${undoToast.changes.length - 3} more` : ''}
                            </div>
                        )}
                    </div>
                    <button onClick={handleUndo} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.25rem 0.6rem', fontWeight: 600, flexShrink: 0 }}>
                        Undo
                    </button>
                </div>
            )}

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
                <div
                    className="risk-modal-overlay"
                    style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
                >
                    <div className="risk-modal-sheet" style={{
                        background: 'var(--bg-card)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '18px',
                        width: '520px',
                        maxWidth: 'calc(100vw - 32px)',
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '1.4rem 1.6rem 0', flexShrink: 0 }}>
                        {/* Drag handle — visible on mobile bottom sheet */}
                        <div className="risk-modal-drag-handle" />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                                <h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem' }}>
                                    <Settings size={17} color="var(--accent-blue)" /> Risk Settings
                                </h3>
                                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '0.25rem' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Tab pills */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0' }}>
                                {TABS.map(tab => {
                                    const Icon = tab.icon;
                                    const active = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            style={{
                                                flex: 1, padding: '0.55rem 0.5rem',
                                                borderRadius: '10px 10px 0 0',
                                                border: active ? '1px solid rgba(10,132,255,0.3)' : '1px solid transparent',
                                                borderBottom: 'none',
                                                background: active ? 'rgba(10,132,255,0.1)' : 'rgba(255,255,255,0.03)',
                                                color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                                cursor: 'pointer', fontSize: '0.78rem', fontWeight: active ? 700 : 500,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <Icon size={13} /> {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tab content */}
                        <div style={{
                            flex: 1, overflowY: 'auto',
                            padding: '1.2rem 1.6rem',
                            borderTop: '1px solid rgba(10,132,255,0.2)',
                            background: 'rgba(10,132,255,0.02)',
                        }}>
                            {/* Tab description */}
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', opacity: 0.8 }}>
                                {TABS.find(t => t.id === activeTab)?.desc}
                            </p>

                            {activeTab === 'sizing' && (
                                <>
                                    <SliderField
                                        label="Per-Trade Max (%)" unit="%" min={0.5} max={10} step={0.5}
                                        value={local.maxTradePercent}
                                        tooltip="Maximum % of portfolio risked per trade. Industry standard: 1–2%."
                                        onChange={v => set('maxTradePercent', v)}
                                    />
                                    <SliderField
                                        label="Max Position Size (%)" unit="%" min={10} max={100} step={5}
                                        value={local.maxPositionPercent}
                                        tooltip="Maximum % of portfolio that can be in a single asset at once."
                                        onChange={v => set('maxPositionPercent', v)}
                                    />
                                    <NumberInput
                                        label="Max Single Order (USD)"
                                        tooltip="Hard cap per individual order regardless of position size settings."
                                        value={local.maxSingleOrderUSD}
                                        min={10} max={100000} step={10}
                                        prefix="$"
                                        onChange={v => set('maxSingleOrderUSD', v)}
                                    />
                                    <Toggle
                                        id="kelly"
                                        label="Use Kelly Criterion for position sizing"
                                        tooltip="Dynamically sizes trades based on win rate and average win/loss. Requires 5+ trade history."
                                        checked={local.enableKellySize}
                                        onChange={v => set('enableKellySize', v)}
                                    />
                                </>
                            )}

                            {activeTab === 'risk' && (
                                <>
                                    <SliderField
                                        label="Daily Loss Limit (%)" unit="%" min={1} max={20} step={0.5}
                                        value={local.dailyLossLimitPercent}
                                        tooltip="AI halts trading if daily portfolio loss exceeds this threshold."
                                        onChange={v => set('dailyLossLimitPercent', v)}
                                    />
                                    <SliderField
                                        label="Stop Loss (%)" unit="%" min={0.5} max={10} step={0.5}
                                        value={local.stopLossPercent}
                                        tooltip="Auto sell if position drops this % below entry price (live mode)."
                                        onChange={v => set('stopLossPercent', v)}
                                    />
                                    <SliderField
                                        label="Take Profit (%)" unit="%" min={1} max={25} step={0.5}
                                        value={local.takeProfitPercent}
                                        tooltip="Auto sell if position gains this % above entry price (live mode)."
                                        onChange={v => set('takeProfitPercent', v)}
                                    />
                                    <SliderField
                                        label="Volatility Reduce Threshold (%)" unit="%" min={2} max={20} step={1}
                                        value={local.volatilityReduceThreshold}
                                        tooltip="If the asset moves this % in 1 hour, order size is halved."
                                        onChange={v => set('volatilityReduceThreshold', v)}
                                    />

                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.1rem', marginTop: '0.25rem' }}>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.9rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Absolute Price Targets</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Stop Loss Price (USD)</label>
                                                <input
                                                    type="number" min={0} step={1}
                                                    placeholder="e.g. 88000"
                                                    value={local.stopLossPrice || ''}
                                                    onChange={e => set('stopLossPrice', e.target.value ? parseFloat(e.target.value) : null)}
                                                    style={{ width: '100%', background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.25)', borderRadius: '8px', color: 'var(--text-primary)', padding: '0.45rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Take Profit Price (USD)</label>
                                                <input
                                                    type="number" min={0} step={1}
                                                    placeholder="e.g. 110000"
                                                    value={local.takeProfitPrice || ''}
                                                    onChange={e => set('takeProfitPrice', e.target.value ? parseFloat(e.target.value) : null)}
                                                    style={{ width: '100%', background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.25)', borderRadius: '8px', color: 'var(--text-primary)', padding: '0.45rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                                                />
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>Leave blank to disable. Triggers auto-sell when price crosses these levels.</p>
                                    </div>
                                </>
                            )}

                            {activeTab === 'smart' && (
                                <>
                                    {/* Trailing Stop */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                                        <Toggle
                                            id="trailingStop"
                                            label="Trailing Stop — stop follows price up, locking in gains"
                                            checked={!!local.trailingStopPct}
                                            onChange={v => set('trailingStopPct', v ? (local.trailingStopPct || 3) : null)}
                                        />
                                        {!!local.trailingStopPct && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '3rem' }}>
                                                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Trail distance</label>
                                                <input
                                                    type="number" min={0.5} max={20} step={0.5}
                                                    value={local.trailingStopPct}
                                                    onChange={e => set('trailingStopPct', parseFloat(e.target.value) || null)}
                                                    style={{ width: '80px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'var(--text-primary)', padding: '0.35rem 0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                                                />
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>%</span>
                                                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                                    Sells if price drops {local.trailingStopPct}% from peak
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Multi-TP */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem' }}>
                                        <Toggle
                                            id="multiTp"
                                            label="Multi Take-Profit — sell in stages at multiple price targets"
                                            checked={Array.isArray(local.multiTpLevels) && local.multiTpLevels.length > 0}
                                            onChange={v => set('multiTpLevels', v
                                                ? [{ pct: 5, qtyPct: 33 }, { pct: 10, qtyPct: 33 }, { pct: 20, qtyPct: 34 }]
                                                : null
                                            )}
                                        />
                                        {Array.isArray(local.multiTpLevels) && local.multiTpLevels.length > 0 && (
                                            <div style={{ paddingLeft: '3rem' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr 30px', gap: '0.4rem', fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                                    <span>At gain %</span><span /><span>Sell qty %</span><span /><span />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
                                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>of position</span>
                                                            <button
                                                                onClick={() => setLocal(l => ({ ...l, multiTpLevels: l.multiTpLevels.filter((_, j) => j !== i) }))}
                                                                style={{ background: 'none', border: 'none', color: 'rgba(255,69,58,0.5)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                                                            >✕</button>
                                                        </div>
                                                    ))}
                                                    {local.multiTpLevels.length < 5 && (
                                                        <button
                                                            onClick={() => setLocal(l => ({ ...l, multiTpLevels: [...l.multiTpLevels, { pct: 30, qtyPct: 25 }] }))}
                                                            style={{ alignSelf: 'flex-start', background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)', borderRadius: '6px', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.72rem', padding: '0.25rem 0.6rem', marginTop: '0.25rem' }}
                                                        >
                                                            + Add level
                                                        </button>
                                                    )}
                                                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.25rem' }}>
                                                        Total qty % should add up to 100%. Partial sells execute automatically as price hits each target.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Pinned footer */}
                        <div style={{ padding: '0.9rem 1.6rem', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                            {diffPreview.length > 0 && !validationError && (
                                <div style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.2)', borderRadius: '8px', padding: '0.45rem 0.75rem', marginBottom: '0.6rem', fontSize: '0.7rem', color: 'rgba(10,132,255,0.85)', lineHeight: 1.5 }}>
                                    <strong>Changes:</strong> {diffPreview.join(' · ')}
                                </div>
                            )}
                            <div style={{ background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.2)', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.72rem', color: 'rgba(255,159,10,0.8)', lineHeight: 1.5 }}>
                                Settings apply to all future trades. Crypto is highly volatile — never risk money you cannot afford to lose.
                            </div>
                            {(validationError || saveError) && (
                                <div style={{ marginBottom: '0.6rem', padding: '0.4rem 0.75rem', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--accent-red)' }}>
                                    {validationError || saveError}
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
                                    disabled={saving || !!validationError}
                                    title={validationError || undefined}
                                    style={{ padding: '0.5rem 1.4rem', background: (saving || validationError) ? 'rgba(255,255,255,0.04)' : 'rgba(10,132,255,0.15)', border: `1px solid ${(saving || validationError) ? 'rgba(255,255,255,0.1)' : 'rgba(10,132,255,0.4)'}`, borderRadius: '8px', color: (saving || validationError) ? 'var(--text-secondary)' : 'var(--accent-blue)', cursor: (saving || validationError) ? 'not-allowed' : 'pointer', fontWeight: 600 }}
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
