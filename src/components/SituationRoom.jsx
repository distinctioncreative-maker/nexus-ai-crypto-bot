import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, Radio, User } from 'lucide-react';
import { sendSituationRoomQuery } from '../services/websocket';
import { useStore } from '../store/useStore';

const AGENT_META = {
    MOMENTUM:        { emoji: '⚡', short: 'Atlas' },
    MEAN_REVERSION:  { emoji: '📊', short: 'Vera' },
    TREND_FOLLOWING: { emoji: '🌊', short: 'Rex' },
    SENTIMENT_DRIVEN:{ emoji: '🌐', short: 'Luna' },
    COMBINED:        { emoji: '🔮', short: 'Orion' },
    ERROR:           { emoji: '⚠️', short: 'System' },
};

const STARTER_PROMPTS = [
    "What does the market structure look like right now?",
    "Should we be buying, selling, or holding here?",
    "Which strategy has the edge in current conditions?",
    "What's the macro sentiment telling us?",
    "Walk me through your current thesis on BTC.",
    "What would trigger you to place a trade right now?",
];

function AgentBubble({ msg }) {
    const meta = AGENT_META[msg.agentId] || { emoji: '🤖', short: msg.name };
    return (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: `${msg.color}22`,
                border: `1.5px solid ${msg.color}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
            }}>
                {meta.emoji}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: msg.color }}>{msg.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{msg.role}</span>
                </div>
                <div style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: '4px 14px 14px 14px',
                    background: `${msg.color}0d`,
                    border: `1px solid ${msg.color}22`,
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                }}>
                    {msg.thinking
                        ? <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> deliberating…
                          </span>
                        : msg.text}
                </div>
            </div>
        </div>
    );
}

function UserBubble({ text }) {
    return (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', justifyContent: 'flex-end', marginBottom: '1.1rem' }}>
            <div style={{
                maxWidth: '68%',
                padding: '0.6rem 0.9rem',
                borderRadius: '14px 4px 14px 14px',
                background: 'rgba(10,132,255,0.12)',
                border: '1px solid rgba(10,132,255,0.25)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
            }}>
                {text}
            </div>
            <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <User size={15} color="var(--text-secondary)" />
            </div>
        </div>
    );
}

function Divider({ label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.6rem 0 0.9rem', opacity: 0.4 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
        </div>
    );
}

let msgIdCounter = 0;

export default function SituationRoom() {
    const { selectedProduct, currentPrice, engineStatus, wsConnected } = useStore();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Initial greeting from Orion
    useEffect(() => {
        setMessages([{
            id: ++msgIdCounter,
            type: 'agent',
            agentId: 'COMBINED',
            name: 'Orion',
            role: 'Chief Strategist',
            color: '#0A84FF',
            text: `Situation Room is live. We're monitoring ${selectedProduct || 'BTC-USD'} with all 5 agents active. Ask us anything — market structure, strategy thesis, risk assessment. Each agent will give you their independent read.`,
        }]);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = (text) => {
        const message = (text || input).trim();
        if (!message || loading) return;
        setInput('');
        setLoading(true);

        // Add user message
        const userMsgId = ++msgIdCounter;
        setMessages(prev => [...prev, { id: userMsgId, type: 'user', text: message }]);

        // Add 5 thinking placeholders immediately (in agent order)
        const agentOrder = [
            { agentId: 'MOMENTUM',        name: 'Atlas', role: 'Momentum Analyst',              color: '#F7931A' },
            { agentId: 'MEAN_REVERSION',  name: 'Vera',  role: 'Mean Reversion Quant',          color: '#627EEA' },
            { agentId: 'TREND_FOLLOWING', name: 'Rex',   role: 'Trend Following Strategist',     color: '#9945FF' },
            { agentId: 'SENTIMENT_DRIVEN',name: 'Luna',  role: 'Sentiment & Macro Intelligence', color: '#34C759' },
            { agentId: 'COMBINED',        name: 'Orion', role: 'Chief Strategist',               color: '#0A84FF' },
        ];

        const placeholders = agentOrder.map(a => ({
            id: ++msgIdCounter,
            type: 'agent',
            thinking: true,
            ...a,
            text: '',
        }));

        setMessages(prev => [...prev,
            { id: ++msgIdCounter, type: 'divider', label: 'Agent responses' },
            ...placeholders
        ]);

        const placeholderIds = placeholders.map(p => ({ agentId: p.agentId, id: p.id }));

        sendSituationRoomQuery(
            message,
            // onAgent — called as each agent finishes
            (agentId, name, role, color, text) => {
                const match = placeholderIds.find(p => p.agentId === agentId);
                if (match) {
                    setMessages(prev => prev.map(m =>
                        m.id === match.id ? { ...m, thinking: false, text } : m
                    ));
                } else {
                    // Unknown agent (e.g. ERROR)
                    setMessages(prev => [...prev, {
                        id: ++msgIdCounter, type: 'agent', thinking: false,
                        agentId, name, role, color, text,
                    }]);
                }
            },
            // onDone
            () => {
                setLoading(false);
                inputRef.current?.focus();
            }
        );
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100%', maxHeight: 'calc(100vh - 120px)',
            background: 'var(--bg-card)',
            borderRadius: '16px', border: '1px solid var(--border-primary)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0,
            }}>
                <div style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: wsConnected ? 'var(--accent-green)' : 'var(--accent-orange)',
                    boxShadow: `0 0 7px ${wsConnected ? 'var(--accent-green)' : 'var(--accent-orange)'}`,
                }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Situation Room</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
                    {['⚡','📊','🌊','🌐','🔮'].map((e, i) => (
                        <span key={i} style={{ fontSize: '0.85rem', opacity: 0.7 }}>{e}</span>
                    ))}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '0.3rem', alignSelf: 'center' }}>
                        5 agents · {selectedProduct}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', scrollbarWidth: 'thin' }}>
                {messages.map(msg => {
                    if (msg.type === 'user') return <UserBubble key={msg.id} text={msg.text} />;
                    if (msg.type === 'divider') return <Divider key={msg.id} label={msg.label} />;
                    return <AgentBubble key={msg.id} msg={msg} />;
                })}
                <div ref={bottomRef} />
            </div>

            {/* Starters */}
            {messages.length <= 1 && (
                <div style={{ padding: '0 1.25rem 0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {STARTER_PROMPTS.map((p, i) => (
                        <button key={i} onClick={() => send(p)} style={{
                            padding: '0.25rem 0.65rem', borderRadius: '20px',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-primary)',
                            color: 'var(--text-secondary)', fontSize: '0.68rem', cursor: 'pointer',
                        }}>
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{
                padding: '0.65rem 1.25rem 0.9rem',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0,
            }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask the team anything… (Enter to send)"
                    rows={2}
                    disabled={loading}
                    style={{
                        flex: 1, background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-primary)', borderRadius: '10px',
                        padding: '0.55rem 0.8rem', color: 'var(--text-primary)',
                        fontSize: '0.875rem', resize: 'none', fontFamily: 'inherit',
                        lineHeight: 1.5, outline: 'none',
                    }}
                />
                <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading}
                    style={{
                        width: 38, height: 38, borderRadius: '10px', border: 'none',
                        background: input.trim() && !loading ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: input.trim() && !loading ? 'pointer' : 'default',
                        flexShrink: 0, marginBottom: '1px',
                    }}
                >
                    {loading ? <Loader size={15} color="var(--text-secondary)" /> : <Send size={15} color="white" />}
                </button>
            </div>
        </div>
    );
}
