import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, User, KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore';

const AGENT_META = {
    Atlas: { emoji: '⚡', color: '#F7931A', role: 'Momentum Analyst' },
    Vera:  { emoji: '📊', color: '#627EEA', role: 'Mean Reversion Quant' },
    Rex:   { emoji: '🌊', color: '#9945FF', role: 'Trend Following Strategist' },
    Luna:  { emoji: '🌐', color: '#34C759', role: 'Sentiment & Macro Intelligence' },
    Orion: { emoji: '🔮', color: '#0A84FF', role: 'Chief Strategist' },
};

const STARTER_PROMPTS = [
    "What does the market structure look like right now?",
    "Should we be buying, selling, or holding here?",
    "Which strategy has the edge in current conditions?",
    "What's the macro sentiment telling us?",
    "Walk me through your current thesis on BTC.",
    "What would trigger you to place a trade right now?",
];

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `You are moderating a live trading room discussion between 5 AI trading agents who share market intelligence and debate strategy together. They respond to each other — not in isolation. Make each agent sound distinct and reference what the previous agents said where relevant.

Respond in EXACTLY this format (no extra text before or after):
**Atlas:** [2-3 sentences as momentum analyst — focus on price action, trend strength, moving averages]
**Vera:** [2-3 sentences as mean reversion quant — respond to Atlas, focus on RSI, overbought/oversold, statistical extremes]
**Rex:** [2-3 sentences as trend following strategist — respond to the debate so far, focus on sustained trends, EMA clouds, ADX]
**Luna:** [2-3 sentences as sentiment & macro analyst — bring in Fear & Greed, social signals, macro context]
**Orion:** [3-4 sentences as chief strategist — synthesize everything the team said, give final stance, end with: Stance: LONG / FLAT / WATCH]`;

function parseAgentBlocks(text) {
    const blocks = [];
    const pattern = /\*\*(\w+):\*\*\s*([\s\S]*?)(?=\*\*\w+:\*\*|$)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const name = match[1];
        const content = match[2].trim();
        if (AGENT_META[name] && content) {
            blocks.push({ name, content });
        }
    }
    return blocks;
}

let msgIdCounter = 0;

function AgentBubble({ name, text, thinking }) {
    const meta = AGENT_META[name] || { emoji: '🤖', color: '#888', role: name };
    return (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: `${meta.color}22`,
                border: `1.5px solid ${meta.color}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
            }}>
                {meta.emoji}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: meta.color }}>{name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{meta.role}</span>
                </div>
                <div style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: '4px 14px 14px 14px',
                    background: `${meta.color}0d`,
                    border: `1px solid ${meta.color}22`,
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                }}>
                    {thinking
                        ? <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> deliberating…
                          </span>
                        : text}
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

export default function SituationRoom() {
    const { selectedProduct, currentPrice, wsConnected, geminiKey } = useStore();
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
            name: 'Orion',
            text: `Situation Room is live. We're monitoring ${selectedProduct || 'BTC-USD'} with all 5 agents active. Ask us anything — market structure, strategy thesis, risk assessment. The team will deliberate and give you a unified read.`,
            thinking: false,
        }]);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async (text) => {
        const message = (text || input).trim();
        if (!message || loading) return;
        setInput('');
        setLoading(true);

        const userMsgId = ++msgIdCounter;
        const thinkingId = ++msgIdCounter;

        setMessages(prev => [
            ...prev,
            { id: userMsgId, type: 'user', text: message },
            { id: ++msgIdCounter, type: 'divider', label: 'Team deliberating…' },
            { id: thinkingId, type: 'thinking' },
        ]);

        try {
            if (!geminiKey) {
                throw new Error('No Gemini key — use the key icon in the nav to configure your API key first.');
            }

            const marketContext = `Market context: ${selectedProduct || 'BTC-USD'}${currentPrice > 0 ? ` at $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}.`;

            const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents: [{ role: 'user', parts: [{ text: `${marketContext}\n\nUser question: ${message}` }] }],
                    generationConfig: { maxOutputTokens: 900, temperature: 0.8 }
                })
            });

            const data = await res.json();

            if (!res.ok) {
                const errMsg = data?.error?.message || `Gemini API error ${res.status}`;
                throw new Error(errMsg);
            }

            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const agentBlocks = parseAgentBlocks(responseText);

            // Replace thinking indicator with agent bubbles
            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== thinkingId && !(m.type === 'divider' && m.label === 'Team deliberating…'));
                const divider = { id: ++msgIdCounter, type: 'divider', label: 'Agent responses' };
                const agentMsgs = agentBlocks.length > 0
                    ? agentBlocks.map(b => ({ id: ++msgIdCounter, type: 'agent', name: b.name, text: b.content, thinking: false }))
                    : [{ id: ++msgIdCounter, type: 'agent', name: 'Orion', text: responseText || 'No response from agents.', thinking: false }];
                return [...filtered, divider, ...agentMsgs];
            });
        } catch (err) {
            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== thinkingId && !(m.type === 'divider' && m.label === 'Team deliberating…'));
                return [...filtered,
                    { id: ++msgIdCounter, type: 'divider', label: 'Error' },
                    { id: ++msgIdCounter, type: 'agent', name: 'Orion', text: `⚠️ ${err.message}`, thinking: false },
                ];
            });
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
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
                {!geminiKey && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <KeyRound size={11} /> Configure Gemini key to activate
                    </span>
                )}
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
                    if (msg.type === 'thinking') return (
                        <div key={msg.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.6rem 0', color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            <Loader size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                            All 5 agents are deliberating together…
                        </div>
                    );
                    return <AgentBubble key={msg.id} name={msg.name} text={msg.text} thinking={msg.thinking} />;
                })}
                <div ref={bottomRef} />
            </div>

            {/* Starters */}
            {messages.length <= 1 && (
                <div style={{ padding: '0 1.25rem 0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {STARTER_PROMPTS.map((p, i) => (
                        <button key={i} onClick={() => send(p)} disabled={loading} style={{
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
                    placeholder={geminiKey ? "Ask the team anything… (Enter to send)" : "Configure Gemini key first (key icon in nav)"}
                    rows={2}
                    disabled={loading || !geminiKey}
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
                    disabled={!input.trim() || loading || !geminiKey}
                    style={{
                        width: 38, height: 38, borderRadius: '10px', border: 'none',
                        background: input.trim() && !loading && geminiKey ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: input.trim() && !loading && geminiKey ? 'pointer' : 'default',
                        flexShrink: 0, marginBottom: '1px',
                    }}
                >
                    {loading ? <Loader size={15} color="var(--text-secondary)" /> : <Send size={15} color="white" />}
                </button>
            </div>
        </div>
    );
}
