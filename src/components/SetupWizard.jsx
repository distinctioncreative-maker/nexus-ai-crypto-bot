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
                <p className="subtitle">AI-powered paper trading using Groq (LLaMA 3.3 70B). No API keys required to start.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    'Real-time price feed from Coinbase',
                    'AI evaluates market every 30 seconds',
                    'Full auto or AI-assisted trade mode',
                    'Fear & Greed, TVL, Polymarket signals',
                ].map(feature => (
                    <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Zap size={13} color="var(--accent-green)" />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{feature}</span>
                    </div>
                ))}
            </div>

            <form onSubmit={handleLaunch} className="wizard-form">
                {error && <div className="error-box">{error}</div>}

                <button type="submit" className="connect-btn pulse" disabled={loading}>
                    {loading ? 'Launching…' : 'Launch Paper Trading'}
                </button>

                <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.75rem', opacity: 0.6 }}>
                    Coinbase API keys for live trading can be added later in Settings.
                </p>
            </form>
        </div>
    );
}
