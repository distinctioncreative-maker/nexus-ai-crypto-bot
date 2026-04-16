import React, { useState } from 'react';
import { Shield, Key, CheckCircle } from 'lucide-react';
import './SetupWizard.css';

export default function SetupWizard({ onComplete }) {
    const [coinbaseKey, setCoinbaseKey] = useState('');
    const [coinbaseSecret, setCoinbaseSecret] = useState('');
    const [openAiKey, setOpenAiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConnect = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:3001/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coinbaseKey, coinbaseSecret, openAiKey })
            });
            const data = await response.json();
            
            if (data.success) {
                onComplete();
            } else {
                setError(data.error || 'Failed to authenticate');
            }
        } catch (err) {
            setError('Is the backend server running on port 3001?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="setup-wizard-container glass-panel">
            <div className="wizard-header">
                <Shield size={32} color="var(--accent-green)" />
                <h2>Secure Node Connection</h2>
                <p className="subtitle">Your keys are held exclusively in local RAM and wiped upon exit. They never touch a hard drive.</p>
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
                    <label>OpenAI API Key (For AI Engine)</label>
                    <div className="input-with-icon">
                        <Key size={16} />
                        <input 
                            type="password" 
                            value={openAiKey} 
                            onChange={(e) => setOpenAiKey(e.target.value)} 
                            placeholder="sk-..."
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
