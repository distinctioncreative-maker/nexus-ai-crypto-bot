import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, AlertCircle, Radio } from 'lucide-react';
import { sendSituationRoomQuery } from '../services/websocket';
import { useStore } from '../store/useStore';

const STARTER_PROMPTS = [
    "What does the current market structure look like? Should I be long or flat?",
    "Which of your agents has the best track record right now and why?",
    "What's the fear & greed sentiment telling us? How are you weighting it?",
    "Walk me through your current trading thesis for BTC.",
    "What would make you pull the trigger on a trade right now?",
    "Are we in a good position? What's your risk assessment?",
];

function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '1.25rem',
        }}>
            {!isUser && (
                <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(10,132,255,0.4)',
                }}>
                    <Bot size={16} color="white" />
                </div>
            )}
            <div style={{
                maxWidth: '72%',
                padding: '0.75rem 1rem',
                borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: isUser
                    ? 'rgba(10,132,255,0.15)'
                    : 'rgba(255,255,255,0.05)',
                border: isUser
                    ? '1px solid rgba(10,132,255,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
            }}>
                {msg.error ? (
                    <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertCircle size={14} /> {msg.content}
                    </span>
                ) : msg.content}
                {msg.thinking && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        <Loader size={12} className="spin" /> Agents deliberating…
                    </span>
                )}
            </div>
            {isUser && (
                <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <User size={16} color="var(--text-secondary)" />
                </div>
            )}
        </div>
    );
}

export default function SituationRoom() {
    const { selectedProduct, currentPrice, engineStatus } = useStore();
    const [messages, setMessages] = useState([
        {
            id: 0,
            role: 'agent',
            content: `Situation Room online. We're monitoring ${selectedProduct || 'BTC-USD'} with all 5 strategy agents active.\n\nAsk us anything — market structure, agent consensus, trade thesis, risk assessment. We have live context on your portfolio and all macro signals.`
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = (text) => {
        const message = (text || input).trim();
        if (!message || loading) return;
        setInput('');

        const userMsg = { id: Date.now(), role: 'user', content: message };
        const thinkingMsg = { id: Date.now() + 1, role: 'agent', content: '', thinking: true };

        setMessages(prev => [...prev, userMsg, thinkingMsg]);
        setLoading(true);

        sendSituationRoomQuery(message, (data) => {
            setMessages(prev => prev.map(m =>
                m.id === thinkingMsg.id
                    ? { ...m, content: data.response || data.error, thinking: false, error: !!data.error }
                    : m
            ));
            setLoading(false);
            inputRef.current?.focus();
        });
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: 'calc(100vh - 120px)',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-primary)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexShrink: 0,
            }}>
                <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: engineStatus === 'STOPPED' ? 'var(--accent-orange)' : 'var(--accent-green)',
                    boxShadow: `0 0 8px ${engineStatus === 'STOPPED' ? 'var(--accent-orange)' : 'var(--accent-green)'}`,
                    animation: 'pulse 2s infinite',
                }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    Situation Room
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    <Radio size={11} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                    5 agents · {selectedProduct} · ${currentPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—'}
                </span>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem',
                scrollbarWidth: 'thin',
            }}>
                {messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Starter prompts */}
            {messages.length <= 1 && (
                <div style={{
                    padding: '0 1.25rem 0.75rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                }}>
                    {STARTER_PROMPTS.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => send(p)}
                            style={{
                                padding: '0.3rem 0.7rem',
                                borderRadius: '20px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-primary)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.target.style.background = 'rgba(10,132,255,0.1)'; e.target.style.borderColor = 'var(--accent-blue)'; e.target.style.color = 'var(--accent-blue)'; }}
                            onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.borderColor = 'var(--border-primary)'; e.target.style.color = 'var(--text-secondary)'; }}
                        >
                            {p.length > 52 ? p.slice(0, 52) + '…' : p}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{
                padding: '0.75rem 1.25rem 1rem',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'flex-end',
                flexShrink: 0,
            }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask the agents anything… (Enter to send, Shift+Enter for newline)"
                    rows={2}
                    style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '10px',
                        padding: '0.6rem 0.85rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        resize: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                        outline: 'none',
                        transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-primary)'; }}
                    disabled={loading}
                />
                <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading}
                    style={{
                        width: 40, height: 40,
                        borderRadius: '10px',
                        background: input.trim() && !loading ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
                        border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: input.trim() && !loading ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                        marginBottom: '2px',
                    }}
                >
                    {loading ? <Loader size={16} color="var(--text-secondary)" /> : <Send size={16} color="white" />}
                </button>
            </div>
        </div>
    );
}
