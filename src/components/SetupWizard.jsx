import React, { useState } from 'react';
import { Shield, Key, Cpu } from 'lucide-react';
import { authFetch } from '../lib/supabase';
import { apiUrl, readApiResponse } from '../lib/api';
import './SetupWizard.css';

export default function SetupWizard({ onComplete }) {
    const [coinbaseKey, setCoinbaseKey] = useState('');
    const [coinbaseSecret, setCoinbaseSecret] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConnect = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authFetch(apiUrl('/api/setup'), {
                method: 'POST',
                body: JSON.stringify({ coinbaseKey, coinbaseSecret })
            });
            const data = await readApiResponse(response);

            if (data.success) {
                onComplete();
            } else {
                setError(data.error || 'Failed to connect');
            }
        } catch (err) {
            setError(err.message === 'Failed to fetch'
                ? 'Cannot reach backend. Start the server on port 3001 and try again.'
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
                <h2>Secure Node Connection</h2>
                <p className="subtitle">AI is powered by your local Ollama instance — no API keys required for trading intelligence.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem', borderRadius: '10px', background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.2)', marginBottom: '1.25rem' }}>
                <Cpu size={15} color="var(--accent-green)" />
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-green)' }}>
                    Ollama · Local AI · Free &amp; Private
                </span>
            </div>

            <form onSubmit={handleConnect} className="wizard-form">
                <div className="input-group">
                    <label>Coinbase API Key <span style={{color:'var(--text-secondary)',fontSize:'0.7rem'}}>optional — for live trading only</span></label>
                    <div className="input-with-icon">
                        <Key size={16} />
                        <input
                            type="password"
                            value={coinbaseKey}
                            onChange={(e) => setCoinbaseKey(e.target.value)}
                            placeholder="organizations/{org_id}/apiKeys/{key_id}"
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label>Coinbase API Secret <span style={{color:'var(--text-secondary)',fontSize:'0.7rem'}}>optional — for live trading only</span></label>
                    <div className="input-with-icon">
                        <Key size={16} />
                        <input
                            type="password"
                            value={coinbaseSecret}
                            onChange={(e) => setCoinbaseSecret(e.target.value)}
                            placeholder="-----BEGIN EC PRIVATE KEY-----..."
                        />
                    </div>
                </div>

                {error && <div className="error-box">{error}</div>}

                <button type="submit" className="connect-btn pulse" disabled={loading}>
                    {loading ? 'Connecting to Ollama…' : 'Initialize AI Core'}
                </button>

                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>
                    Make sure Ollama is running locally: <code style={{ color: 'var(--accent-green)' }}>ollama serve</code>
                </p>
            </form>
        </div>
    );
}
