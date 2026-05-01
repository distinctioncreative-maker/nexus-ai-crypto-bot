import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader, User, RefreshCw, Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { sendSituationRoomQuery } from '../services/websocket';

const ORACLE = { id: 'COMBINED', name: 'Quant Oracle', color: '#0A84FF' };

const STARTER_PROMPTS = [
    "What's the market telling you right now?",
    "Should I be positioned long or flat?",
    "Analyze the current Fear & Greed reading",
    "Which coin has the best setup right now?",
    "What are the agents learning from recent trades?",
    "Is this a good entry or should I wait?",
];

const STORAGE_KEY = 'quant_oracle_chat';
let msgId = 0;

function OracleBubble({ text, thinking, isNew }) {
    const isOffline = !thinking && text?.startsWith('[offline:');
    const cooldownMatch = !thinking && text?.match(/^\[cooldown: ?(\d+)\]/);
    const cooldownSecs = cooldownMatch ? parseInt(cooldownMatch[1], 10) : null;
    const stanceMatch = !isOffline && !cooldownSecs && text?.match(/\b(LONG|FLAT|WATCH|EXIT)\b/);
    const stance = stanceMatch?.[1];
    const stanceColor = { LONG: '#30D158', FLAT: '#636366', WATCH: '#FF9F0A', EXIT: '#FF453A' }[stance];
    const StanceIcon = { LONG: TrendingUp, FLAT: Minus, WATCH: Brain, EXIT: TrendingDown }[stance] || null;

    return (
        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', marginBottom: '1rem', animation: isNew ? 'fadeSlideIn 0.2s ease' : 'none' }}>
            {/* Oracle avatar */}
            <div style={{
                width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
                background: (isOffline || cooldownSecs) ? 'rgba(255,159,10,0.1)' : 'rgba(10,132,255,0.12)',
                border: `1px solid ${(isOffline || cooldownSecs) ? 'rgba(255,159,10,0.3)' : 'rgba(10,132,255,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Brain size={16} color={(isOffline || cooldownSecs) ? '#FF9F0A' : '#0A84FF'} />
            </div>

            <div style={{ flex: 1, maxWidth: '88%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: (isOffline || cooldownSecs) ? '#FF9F0A' : '#0A84FF' }}>Quant Oracle</span>
                    {stance && StanceIcon && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                            fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.45rem',
                            borderRadius: '20px', background: `${stanceColor}22`,
                            color: stanceColor, border: `1px solid ${stanceColor}44`,
                            letterSpacing: '0.06em',
                        }}>
                            <StanceIcon size={9} /> {stance}
                        </span>
                    )}
                </div>
                <div style={{
                    padding: '0.7rem 0.95rem',
                    borderRadius: '4px 14px 14px 14px',
                    background: (isOffline || cooldownSecs) ? 'rgba(255,159,10,0.06)' : 'rgba(10,132,255,0.06)',
                    border: `1px solid ${(isOffline || cooldownSecs) ? 'rgba(255,159,10,0.2)' : 'rgba(10,132,255,0.15)'}`,
                    fontSize: '0.875rem', lineHeight: 1.6,
                    color: thinking ? 'var(--text-secondary)' : 'var(--text-primary)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                    {thinking ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontStyle: 'italic', fontSize: '0.82rem' }}>
                            <Loader size={11} style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
                            Analyzing market conditions…
                        </span>
                    ) : cooldownSecs ? (
                        <span style={{ color: 'rgba(255,159,10,0.85)', fontSize: '0.83rem' }}>
                            Please wait {cooldownSecs}s before asking again — the Oracle has a short cooldown to stay within API limits.
                        </span>
                    ) : isOffline ? (
                        <span style={{ color: 'rgba(255,159,10,0.85)', fontSize: '0.83rem' }}>
                            Oracle is temporarily unavailable — the AI provider is rate-limited. Wait 30 seconds and try again.
                        </span>
                    ) : text}
                </div>
            </div>
        </div>
    );
}

function UserBubble({ text, isNew }) {
    return (
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginBottom: '0.9rem', animation: isNew ? 'fadeSlideIn 0.2s ease' : 'none' }}>
            <div style={{
                maxWidth: '72%', padding: '0.6rem 0.9rem',
                borderRadius: '14px 4px 14px 14px',
                background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.25)',
                fontSize: '0.875rem', lineHeight: 1.55, wordBreak: 'break-word',
                color: 'var(--text-primary)',
            }}>
                {text}
            </div>
            <div style={{
                width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
                background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <User size={14} color="rgba(10,132,255,0.7)" />
            </div>
        </div>
    );
}

export default function SituationRoom() {
    const { selectedProduct, wsConnected, strategies } = useStore();

    // Restore chat from localStorage on mount
    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch {}
        return [{
            id: ++msgId, type: 'oracle', text:
                `Quant Oracle online. I'm watching ${selectedProduct || 'BTC-USD'} and all your agent signals continuously. Ask me anything about the market, your positions, or what the agents are learning.\n\nℹ AI-assisted analysis only — not financial advice. Paper trading simulation uses virtual funds.`,
            isNew: false,
        }];
    });

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Persist messages to localStorage
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch {}
    }, [messages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // iOS keyboard avoidance — scroll chat to bottom when virtual keyboard resizes viewport
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const handler = () => {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        };
        vv.addEventListener('resize', handler);
        return () => vv.removeEventListener('resize', handler);
    }, []);

    const buildHistory = useCallback(() => {
        return messages
            .filter(m => (m.type === 'user' || m.type === 'oracle') && m.text && !m.thinking)
            .map(m => ({ role: m.type === 'user' ? 'user' : 'agent', content: m.text?.slice(0, 300) || '' }))
            .slice(-10);
    }, [messages]);

    const send = useCallback(async (textOverride) => {
        const message = (textOverride || input).trim();
        if (!message || loading || !wsConnected) return;
        setInput('');
        setLoading(true);

        const history = buildHistory();
        const userMsgId = ++msgId;
        const oracleMsgId = ++msgId;

        setMessages(prev => [
            ...prev,
            { id: userMsgId, type: 'user', text: message, isNew: true },
            { id: oracleMsgId, type: 'oracle', text: '', thinking: true, isNew: true },
        ]);

        sendSituationRoomQuery(
            message,
            history,
            (_agentId, _name, _role, _color, text) => {
                setMessages(prev => prev.map(m =>
                    m.id === oracleMsgId ? { ...m, text, thinking: false } : m
                ));
            },
            () => {
                setLoading(false);
                inputRef.current?.focus();
            }
        );
    }, [input, loading, wsConnected, buildHistory]);

    const clearChat = () => {
        localStorage.removeItem(STORAGE_KEY);
        setMessages([{
            id: ++msgId, type: 'oracle',
            text: `New session. Monitoring ${selectedProduct || 'BTC-USD'}. What do you want to know?\n\nℹ AI-assisted analysis only — not financial advice.`,
            isNew: true,
        }]);
    };

    // Agent signal summary for header
    const agentSummary = strategies
        .filter(s => s.id !== 'COMBINED' && s.lastSignal)
        .map(s => ({ name: s.name.slice(0, 4), signal: s.lastSignal, sharpe: s.sharpe || 0 }));

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100%', maxHeight: 'calc(var(--vh, 1vh) * 100 - 120px)',
            background: 'var(--bg-card)',
            borderRadius: '16px', border: '1px solid var(--card-border)',
            overflow: 'hidden',
        }}>
            <style>{`
                @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            {/* Header */}
            <div style={{
                padding: '0.8rem 1.1rem', flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: '0.6rem',
            }}>
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: wsConnected ? '#30D158' : '#FF9F0A',
                    boxShadow: `0 0 6px ${wsConnected ? '#30D158' : '#FF9F0A'}`,
                }} />
                <Brain size={15} color="#0A84FF" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Quant Oracle</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    — watching {selectedProduct}
                </span>

                {/* Live agent signal dots */}
                {agentSummary.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.5rem' }}>
                        {agentSummary.map(a => (
                            <span key={a.name} title={`${a.name}: ${a.signal}`} style={{
                                fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                background: a.signal === 'BUY' ? 'rgba(48,209,88,0.15)' : a.signal === 'SELL' ? 'rgba(255,69,58,0.15)' : 'rgba(255,255,255,0.06)',
                                color: a.signal === 'BUY' ? '#30D158' : a.signal === 'SELL' ? '#FF453A' : 'var(--text-secondary)',
                            }}>
                                {a.name}
                            </span>
                        ))}
                    </div>
                )}

                <button onClick={clearChat} title="Clear chat" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column' }}>
                {messages.map(m => {
                    if (m.type === 'oracle') return <OracleBubble key={m.id} text={m.text} thinking={m.thinking} isNew={m.isNew} />;
                    if (m.type === 'user')   return <UserBubble key={m.id} text={m.text} isNew={m.isNew} />;
                    return null;
                })}
                <div ref={bottomRef} />
            </div>

            {/* Starter prompts — only when no conversation yet */}
            {messages.length <= 1 && !loading && (
                <div className="starter-prompt-chips" style={{ padding: '0 1.1rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {STARTER_PROMPTS.map(p => (
                        <button
                            key={p}
                            onClick={() => send(p)}
                            disabled={!wsConnected}
                            style={{
                                padding: '0.3rem 0.7rem', borderRadius: '20px', cursor: 'pointer',
                                background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)',
                                color: 'var(--text-secondary)', fontSize: '0.75rem',
                                transition: 'all 0.15s',
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{
                padding: '0.75rem 1.1rem', borderTop: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0, display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
            }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={wsConnected ? "Ask the Oracle anything…" : "Connecting…"}
                    disabled={loading || !wsConnected}
                    rows={1}
                    style={{
                        flex: 1, resize: 'none', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px',
                        color: 'var(--text-primary)', padding: '0.6rem 0.9rem',
                        fontSize: '0.875rem', fontFamily: 'var(--font-ui)',
                        outline: 'none', lineHeight: 1.5, maxHeight: '120px',
                    }}
                />
                <button
                    onClick={() => send()}
                    disabled={loading || !wsConnected || !input.trim()}
                    style={{
                        width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
                        background: loading ? 'rgba(10,132,255,0.1)' : 'rgba(10,132,255,0.2)',
                        border: '1px solid rgba(10,132,255,0.35)',
                        color: 'var(--accent-blue)', cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                >
                    {loading ? <Loader size={15} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Send size={15} />}
                </button>
            </div>
        </div>
    );
}
