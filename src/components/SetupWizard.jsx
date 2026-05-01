import React, { useState } from 'react';
import { Shield, Zap } from 'lucide-react';
import { authFetch } from '../lib/supabase';
import { apiUrl, readApiResponse } from '../lib/api';
import './SetupWizard.css';

export default function SetupWizard({ onComplete }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLaunch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authFetch(apiUrl('/api/setup'), {
                method: 'POST',
                body: JSON.stringify({})
            });
            const data = await readApiResponse(response);

            if (data.success) {
                onComplete();
            } else {
                setError(data.error || 'Failed to connect to backend');
            }
        } catch (err) {
            setError(err.message === 'Failed to fetch'
                ? 'Cannot reach backend. Make sure the server is running.'
                : err.message
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="setup-wizard-container glass-panel">
            <div className="wizard-header">
                <Shield size={32} color="var(--accent-green)" />
                <h2>Quant Paper Trading</h2>
                <p className="subtitle">AI-assisted market analysis using Groq (LLaMA 3.3 70B). Paper trading simulation — no real money involved.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                    'Real-time price feed from Coinbase public data',
                    'AI-assisted analysis evaluates market every 30 seconds',
                    'Full auto or user-confirmed trade mode (paper only)',
                    'Fear & Greed, TVL, Polymarket macro signals',
                ].map(feature => (
                    <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Zap size={13} color="var(--accent-green)" />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{feature}</span>
                    </div>
                ))}
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '1rem',
                fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.55,
            }}>
                ⓘ Paper trading simulation only — uses virtual $100,000. No real funds at risk.
                AI signals are for educational purposes and are <strong>not financial advice</strong>.
                Past simulated performance does not predict real trading results.
            </div>

            <form onSubmit={handleLaunch} className="wizard-form">
                {error && <div className="error-box">{error}</div>}

                <button type="submit" className="connect-btn pulse" disabled={loading}>
                    {loading ? 'Launching…' : 'Launch Paper Trading'}
                </button>

                <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.75rem', opacity: 0.6 }}>
                    Coinbase API keys for live-assisted trading can be added later in Settings.
                </p>
            </form>
        </div>
    );
}
