import React, { useState, useEffect, useRef } from 'react';
import { X, Bug, Trash2, Wifi, WifiOff, Copy, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { apiUrl } from '../lib/api';

// Global log store (outside React so it persists across renders and can be written from anywhere)
const logs = [];
const listeners = new Set();

export function debugLog(type, message, data = null) {
    const entry = {
        id: Date.now() + Math.random(),
        ts: new Date().toLocaleTimeString(),
        type,  // 'api', 'ws', 'error', 'info'
        message,
        data: data ? JSON.stringify(data, null, 2) : null,
    };
    logs.unshift(entry);
    if (logs.length > 100) logs.pop();
    listeners.forEach(fn => fn());
}

// Patch global fetch to auto-log API calls
const _originalFetch = window.fetch;
window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '?';
    const method = args[1]?.method || 'GET';
    const isApiCall = url.includes('/api/');
    if (!isApiCall) return _originalFetch(...args);

    const shortUrl = url.replace(/^https?:\/\/[^/]+/, '') || '/';
    debugLog('api', `→ ${method} ${shortUrl} [${url.match(/^https?:\/\/[^/]+/)?.[0] || 'relative'}]`);

    try {
        const res = await _originalFetch(...args);
        const statusIcon = res.ok ? '✓' : '✗';
        const ct = res.headers.get('content-type') || '';
        const typeNote = ct.includes('html') ? ' [HTML — wrong endpoint or proxy]' : '';
        debugLog(res.ok ? 'api' : 'error', `${statusIcon} ${res.status} ${method} ${shortUrl}${typeNote}`);
        return res;
    } catch (err) {
        debugLog('error', `✗ NETWORK ${method} ${shortUrl}: ${err.message}`);
        throw err;
    }
};

export default function DebugPanel() {
    const [open, setOpen] = useState(false);
    const [, forceUpdate] = useState(0);
    const [serverInfo, setServerInfo] = useState(null);
    const [serverError, setServerError] = useState('');
    const [copied, setCopied] = useState(false);
    const { wsConnected } = useStore();
    const bottomRef = useRef(null);

    useEffect(() => {
        const cb = () => forceUpdate(n => n + 1);
        listeners.add(cb);
        return () => listeners.delete(cb);
    }, []);

    const checkServer = async () => {
        setServerError('');
        setServerInfo(null);
        try {
            const res = await _originalFetch(apiUrl('/api/debug'));
            const data = await res.json();
            setServerInfo(data);
        } catch (err) {
            setServerError(err.message);
        }
    };

    const checkHealth = async () => {
        setServerError('');
        try {
            const res = await _originalFetch(apiUrl('/api/health'));
            const data = await res.json();
            debugLog('info', `Health check: ${data.status} at ${data.timestamp}`);
        } catch (err) {
            debugLog('error', `Health check FAILED: ${err.message}`);
        }
    };

    const copyAll = () => {
        const header = `=== Quant Debug Log — ${new Date().toISOString()} ===\n`;
        const body = logs.map(l =>
            `[${l.ts}] [${l.type.toUpperCase()}] ${l.message}${l.data ? '\n  ' + l.data : ''}`
        ).join('\n');
        navigator.clipboard.writeText(header + body).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const typeColor = {
        api: 'var(--accent-blue)',
        error: 'var(--accent-red)',
        warn: 'var(--accent-orange)',
        ws: 'var(--accent-green)',
        info: 'var(--text-secondary)',
    };

    if (!open) {
        return (
            <button
                onClick={() => { setOpen(true); checkServer(); }}
                style={{
                    position: 'fixed', bottom: 16, right: 16, zIndex: 9000,
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'rgba(255,159,10,0.15)',
                    border: '1px solid rgba(255,159,10,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--accent-orange)',
                }}
                title="Open Debug Panel"
            >
                <Bug size={18} />
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: 16, right: 16, zIndex: 9000,
            width: Math.min(420, (typeof window !== 'undefined' ? window.innerWidth : 420) - 16), maxHeight: '70vh',
            background: '#0a0a0d',
            border: '1px solid rgba(255,159,10,0.4)',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
            {/* Header */}
            <div style={{
                padding: '0.6rem 0.75rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
                <Bug size={14} color="var(--accent-orange)" />
                <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>Debug Panel</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', color: wsConnected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                    WS {wsConnected ? 'connected' : 'disconnected'}
                </span>
                <button
                    onClick={copyAll}
                    title="Copy all logs to clipboard"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', padding: 2, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span style={{ fontSize: '0.65rem' }}>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button onClick={() => { logs.length = 0; forceUpdate(n => n + 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}>
                    <Trash2 size={13} />
                </button>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}>
                    <X size={14} />
                </button>
            </div>

            {/* Server info */}
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <button onClick={checkServer} style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        Check /api/debug
                    </button>
                    <button onClick={checkHealth} style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        Health ping
                    </button>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginLeft: 'auto', alignSelf: 'center' }}>
                        {apiUrl('/api').replace('/api', '')}
                    </span>
                </div>
                {serverError && <div style={{ color: 'var(--accent-red)' }}>✗ {serverError}</div>}
                {serverInfo && (
                    <div style={{ color: 'var(--accent-green)' }}>
                        ✓ Router loaded · {serverInfo.routes?.length} routes · {Object.entries(serverInfo.env || {}).filter(([,v]) => v.startsWith('✓')).length}/{Object.keys(serverInfo.env || {}).length} env vars set
                    </div>
                )}
                {serverInfo?.env && (
                    <div style={{ marginTop: '0.3rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {Object.entries(serverInfo.env).map(([k, v]) => (
                            <span key={k} style={{ marginRight: '0.6rem', color: v.startsWith('✓') ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                {k.replace('SUPABASE_', 'SB_').replace('_SERVICE_ROLE_KEY', '_SRK')}: {v}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Log entries */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 0.5rem' }}>
                {logs.length === 0 && (
                    <div style={{ color: 'var(--text-secondary)', padding: '0.5rem', textAlign: 'center' }}>
                        No API calls logged yet. Try clicking a button.
                    </div>
                )}
                {logs.map(log => (
                    <div key={log.id} style={{ padding: '0.2rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)', lineHeight: 1.4 }}>
                        <span style={{ color: 'var(--text-secondary)', marginRight: '0.4rem' }}>{log.ts}</span>
                        <span style={{ color: typeColor[log.type] || 'white' }}>{log.message}</span>
                        {log.data && (
                            <pre style={{ margin: '0.2rem 0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.65rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {log.data.slice(0, 300)}
                            </pre>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
