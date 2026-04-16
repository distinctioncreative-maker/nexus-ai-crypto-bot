import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Bot, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import './AuthPage.css';

export default function AuthPage({ onAuth }) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Local dev fallback — no Supabase configured
        if (!supabase) {
            onAuth({ id: 'local-dev-user', email: 'dev@local' });
            return;
        }

        try {
            if (isSignUp) {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password
                });
                if (signUpError) throw signUpError;
                if (data.user && !data.session) {
                    setSuccess('Check your email for a confirmation link!');
                } else if (data.session) {
                    onAuth(data.user);
                }
            } else {
                const { data, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (signInError) throw signInError;
                onAuth(data.user);
            }
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-hero">
                <div className="hero-glow"></div>
                <Bot size={48} strokeWidth={1.5} />
                <h1 className="text-gradient">Kalshi Enterprise</h1>
                <p className="auth-subtitle">AI-Powered Trading Intelligence</p>
            </div>

            <div className="auth-card glass-panel">
                <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="auth-description">
                    {isSignUp 
                        ? 'Start your AI trading journey.' 
                        : 'Sign in to access your trading terminal.'}
                </p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-input-group">
                        <Mail size={18} />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="auth-input-group">
                        <Lock size={18} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <button type="submit" className="auth-submit" disabled={loading}>
                        {loading ? (
                            <span className="live-indicator" style={{ width: 12, height: 12 }}></span>
                        ) : (
                            <>
                                {isSignUp ? 'Create Account' : 'Sign In'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}>
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </div>
            </div>

            <div className="auth-footer">
                <Sparkles size={14} /> Encrypted In-Memory Architecture
            </div>
        </div>
    );
}
