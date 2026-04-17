import React, { useState } from 'react';
import { Shield, Key, CheckCircle } from 'lucide-react';
import { authFetch } from '../lib/supabase';
import { apiUrl, readApiResponse } from '../lib/api';
import './SetupWizard.css';

export default function SetupWizard({ onComplete }) {
    const [coinbaseKey, setCoinbaseKey] = useState('');
    const [coinbaseSecret, setCoinbaseSecret] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConnect = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authFetch(apiUrl('/api/setup'), {
                method: 'POST',
                body: JSON.stringify({ coinbaseKey, coinbaseSecret, geminiKey })
            });
            const data = await readApiResponse(response);

            if (data.success) {
                onComplete();
            } else {
                setError(data.error || 'Failed to authenticate');
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
                <p className="subtitle">Your keys are encrypted server-side and only used by the backend trading engine.</p>
            </div>

            <form onSubmit={handleConnect} className="wizard-form">
                <div className="input-group">
                    <label>Coinbase Advanced Trade API Key</label>
                    <div className="input-with-icon">
                        <Key size={16} />
                        <input
                            type="password"
                            value={coinbaseKey}
                            onChange={(e) => setCoinbaseKey(e.target.value)}
                            placeholder="organizations/{org_id}/apiKeys/{key_id}"
                            required
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label>Coinbase API Secret</label>
                    <div className="input-with-icon">
                        <Key size={16} />
                        <input
                            type="password"
                            value={coinbaseSecret}
                            onChange={(e) => setCoinbaseSecret(e.target.value)}
                            placeholder="-----BEGIN EC PRIVATE KEY-----..."
                            required
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label>Gemini API Key (Google AI Pro Engine)</label>
                    <div className="input-with-icon">
                        <Key size={16} />
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            required
                        />
                    </div>
                </div>

                {error && <div className="error-box">{error}</div>}

                <button type="submit" className="connect-btn pulse" disabled={loading}>
                    {loading ? 'Securing Engine...' : 'Initialize AI Core'}
                </button>
            </form>
        </div>
    );
}
