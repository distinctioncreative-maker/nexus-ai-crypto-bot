import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader, User, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { sendSituationRoomQuery } from '../services/websocket';

const AGENTS = [
    { id: 'MOMENTUM',        name: 'Atlas', emoji: '⚡', color: '#F7931A', role: 'Momentum Analyst' },
    { id: 'MEAN_REVERSION',  name: 'Vera',  emoji: '📊', color: '#627EEA', role: 'Mean Reversion Quant' },
    { id: 'TREND_FOLLOWING', name: 'Rex',   emoji: '🌊', color: '#9945FF', role: 'Trend Following Strategist' },
    { id: 'SENTIMENT_DRIVEN',name: 'Luna',  emoji: '🌐', color: '#34C759', role: 'Sentiment & Macro Intelligence' },
    { id: 'COMBINED',        name: 'Orion', emoji: '🔮', color: '#0A84FF', role: 'Chief Strategist' },
];

const AGENT_BY_ID = Object.fromEntries(AGENTS.map(a => [a.id, a]));

const STARTER_PROMPTS = [
    "What's the current market structure telling you?",
    "Should we be positioned long or flat right now?",
    "Atlas and Rex, do you agree on momentum?",
    "Luna, what is macro sentiment signaling?",
    "Vera, are we at an extreme that warrants fading?",
    "Orion, give me your final trade thesis.",
];

let msgIdCounter = 0;

// ── Message bubble components ─────────────────────────────────────────────────

function AgentBubble({ agent, text, thinking, isNew }) {
    const stanceMatch = text?.match(/\b(LONG|FLAT|WATCH)\b/);
    const stance = stanceMatch?.[1]?.toUpperCase();
    const cleanText = text || '';
    const stanceColors = { LONG: '#30d158', FLAT: '#636366', WATCH: '#ff9f0a' };

    return (
        <div style={{
            display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.7rem',
            animation: isNew ? 'fadeSlideIn 0.25s ease' : 'none',
        }}>
            <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: `${agent.color}22`, border: `1.5px solid ${agent.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', position: 'relative',
            }}>
                {agent.emoji}
                {thinking && (
                    <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 8, height: 8, borderRadius: '50%',
                        background: agent.color, opacity: 0.9,
                        animation: 'pulse 1s ease-in-out infinite',
                    }} />
                )}
            </div>
            <div style={{ flex: 1, maxWidth: '85%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: agent.color }}>{agent.name}</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>{agent.role}</span>
                    {stance && (
                        <span style={{
                            fontSize: '0.58rem', fontWeight: 800, padding: '0.1rem 0.45rem',
                            borderRadius: '20px', background: `${stanceColors[stance]}22`,
                            color: stanceColors[stance], border: `1px solid ${stanceColors[stance]}44`,
                            letterSpacing: '0.06em',
                        }}>
                            {stance}
                        </span>
                    )}
                </div>
                <div style={{
                    padding: '0.55rem 0.8rem', borderRadius: '4px 12px 12px 12px',
                    background: `${agent.color}0c`, border: `1px solid ${agent.color}1a`,
                    color: 'var(--text-primary)', fontSize: '0.855rem', lineHeight: 1.55,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                    {thinking
                        ? (
                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                                <Loader size={10} style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
                                {agent.name} is thinking…
                            </span>
                        )
                        : cleanText
                    }
                </div>
            </div>
        </div>
    );
}

function UserBubble({ text, isNew }) {
    return (
        <div style={{
            display: 'flex', gap: '0.5rem', alignItems: 'flex-start', justifyContent: 'flex-end',
            marginBottom: '0.85rem',
            animation: isNew ? 'fadeSlideIn 0.2s ease' : 'none',
        }}>
            <div style={{
                maxWidth: '70%', padding: '0.55rem 0.85rem',
                borderRadius: '12px 4px 12px 12px',
                background: 'rgba(10,132,255,0.14)', border: '1px solid rgba(10,132,255,0.28)',
                color: 'var(--text-primary)', fontSize: '0.855rem', lineHeight: 1.55,
                wordBreak: 'break-word',
            }}>
                {text}
            </div>
            <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <User size={14} color="rgba(10,132,255,0.8)" />
            </div>
        </div>
    );
}

function SessionDivider({ label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0', opacity: 0.35 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SituationRoom() {
    const { selectedProduct, currentPrice, wsConnected, strategies } = useStore();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeAgents, setActiveAgents] = useState(new Set()); // agents currently "typing"
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const historyRef = useRef([]); // persistent conversation history for AI context

    // Initial welcome message
    useEffect(() => {
        const welcomeId = ++msgIdCounter;
        setMessages([{
            id: welcomeId, type: 'agent', agentId: 'COMBINED',
            text: `War room active. Monitoring ${selectedProduct || 'BTC-USD'} — 5 agents online. This is a persistent session: I'll remember everything you discuss. Ask me anything, or address an agent directly.`,
            thinking: false, isNew: false,
        }]);
    }, []);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const buildHistory = useCallback(() => {
        // Convert messages to history format for AI context
        return messages
            .filter(m => m.type === 'user' || (m.type === 'agent' && m.text && !m.thinking))
            .map(m => ({
                role: m.type === 'user' ? 'user' : 'agent',
                agentName: m.type === 'agent' ? (AGENT_BY_ID[m.agentId]?.name || 'Agent') : undefined,
                content: m.text?.slice(0, 200) || '', // truncate to keep context lean
            }))
            .slice(-12); // last 12 turns
    }, [messages]);

    const send = useCallback(async (textOverride) => {
        const message = (textOverride || input).trim();
        if (!message || loading) return;
        setInput('');
        setLoading(true);

        const history = buildHistory();

        // Add user bubble
        const userMsgId = ++msgIdCounter;
        setMessages(prev => [
            ...prev,
            { id: userMsgId, type: 'user', text: message, isNew: true },
        ]);

        // Add all 5 agents in "thinking" state, one by one
        const agentMsgIds = {};
        AGENTS.forEach(a => { agentMsgIds[a.id] = ++msgIdCounter; });

        setMessages(prev => [
            ...prev,
            { id: ++msgIdCounter, type: 'divider', label: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            ...AGENTS.map(a => ({ id: agentMsgIds[a.id], type: 'agent', agentId: a.id, text: '', thinking: true, isNew: true })),
        ]);

        setActiveAgents(new Set(AGENTS.map(a => a.id)));

        // Send via WS with history
        sendSituationRoomQuery(
            message,
            history,
            (agentId, _name, _role, _color, text) => {
                setMessages(prev => prev.map(m =>
                    m.id === agentMsgIds[agentId]
                        ? { ...m, text, thinking: false, isNew: true }
                        : m
                ));
                setActiveAgents(prev => { const next = new Set(prev); next.delete(agentId); return next; });
                // Append to history ref
                historyRef.current.push({ role: 'agent', agentName: AGENT_BY_ID[agentId]?.name, content: text });
            },
            () => {
                setLoading(false);
                setActiveAgents(new Set());
                inputRef.current?.focus();
                // Append user message to history ref
                historyRef.current.push({ role: 'user', content: message });
            }
        );
    }, [input, loading, buildHistory]);

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const clearChat = () => {
        historyRef.current = [];
        const welcomeId = ++msgIdCounter;
        setMessages([{
            id: welcomeId, type: 'agent', agentId: 'COMBINED',
            text: `Chat cleared. New session started. Still monitoring ${selectedProduct || 'BTC-USD'}.`,
            thinking: false, isNew: true,
        }]);
    };

    // Get top-performing agent for display
    const topAgent = strategies.length > 0
        ? [...strategies].sort((a, b) => (b.sharpe || 0) - (a.sharpe || 0))[0]
        : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 120px)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
            <style>{`
                @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
                @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.4); opacity: 0.5; } }
            `}</style>

            {/* Header */}
            <div style={{ padding: '0.75rem 1.1rem', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: wsConnected ? '#30d158' : '#ff9f0a', boxShadow: `0 0 6px ${wsConnected ? '#30d158' : '#ff9f0a'}` }} />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Situation Room</span>
                {topAgent && topAgent.sharpe > 0.1 && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginLeft: '0.2rem' }}>
                        · Leading: <span style={{ color: AGENT_BY_ID[topAgent.id]?.color || 'var(--text-primary)' }}>{topAgent.name}</span> (Sharpe {topAgent.sharpe.toFixed(2)})
                    </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {AGENTS.map(a => (
                        <div key={a.id} style={{ position: 'relative', fontSize: '0.85rem', opacity: activeAgents.has(a.id) ? 1 : 0.5, transition: 'opacity 0.2s' }} title={a.name}>
                            {a.emoji}
                            {activeAgents.has(a.id) && (
                                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: a.color, animation: 'pulse 1s ease-in-out infinite' }} />
                            )}
                        </div>
                    ))}
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginLeft: '0.2rem' }}>
                        {selectedProduct}
                    </span>
                    <button
                        onClick={clearChat}
                        title="Clear chat"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex', alignItems: 'center', marginLeft: '0.25rem' }}
                    >
                        <RefreshCw size={13} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.1rem', scrollbarWidth: 'thin' }}>
                {messages.map(msg => {
                    if (msg.type === 'user')    return <UserBubble key={msg.id} text={msg.text} isNew={msg.isNew} />;
                    if (msg.type === 'divider') return <SessionDivider key={msg.id} label={msg.label} />;
                    if (msg.type === 'agent') {
                        const agent = AGENT_BY_ID[msg.agentId] || AGENTS[4];
                        return <AgentBubble key={msg.id} agent={agent} text={msg.text} thinking={msg.thinking} isNew={msg.isNew} />;
                    }
                    return null;
                })}
                <div ref={bottomRef} />
            </div>

            {/* Quick prompts (only when no active loading) */}
            {messages.length <= 1 && !loading && (
                <div style={{ padding: '0 1.1rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {STARTER_PROMPTS.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => send(p)}
                            disabled={loading || !wsConnected}
                            style={{
                                padding: '0.22rem 0.6rem', borderRadius: '20px',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-primary)',
                                color: 'var(--text-secondary)', fontSize: '0.65rem', cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{ padding: '0.6rem 1.1rem 0.85rem', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: '0.45rem', alignItems: 'flex-end', flexShrink: 0 }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={
                        !wsConnected ? 'Connecting…'
                        : loading ? 'Agents are responding…'
                        : 'Ask the team anything… (Enter to send, Shift+Enter for newline)'
                    }
                    rows={2}
                    disabled={loading || !wsConnected}
                    style={{
                        flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-primary)',
                        borderRadius: '10px', padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                        fontSize: '0.855rem', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
                        opacity: loading ? 0.6 : 1,
                    }}
                />
                <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading || !wsConnected}
                    style={{
                        width: 36, height: 36, borderRadius: '10px', border: 'none', flexShrink: 0,
                        background: input.trim() && !loading && wsConnected ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: input.trim() && !loading && wsConnected ? 'pointer' : 'default',
                        marginBottom: '1px', transition: 'background 0.15s',
                    }}
                >
                    {loading
                        ? <Loader size={14} color="var(--text-secondary)" style={{ animation: 'spin 0.9s linear infinite' }} />
                        : <Send size={14} color="white" />
                    }
                </button>
            </div>
        </div>
    );
}
