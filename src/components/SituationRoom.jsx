import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, User } from 'lucide-react';
import { useStore } from '../store/useStore';

const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'qwen2.5:14b';

const AGENTS = [
    {
        id: 'Atlas',
        emoji: '⚡',
        color: '#F7931A',
        role: 'Momentum Analyst',
        systemPrompt: 'You are Atlas, the Momentum Analyst. You focus exclusively on price action, trend strength, moving average crossovers, and volume confirmation. You are direct, confident, and always cite specific price levels. Speak in first person as Atlas. 2-3 sentences maximum — sharp and specific.',
    },
    {
        id: 'Vera',
        emoji: '📊',
        color: '#627EEA',
        role: 'Mean Reversion Quant',
        systemPrompt: 'You are Vera, the Mean Reversion Quant. You focus on RSI extremes, overbought/oversold conditions, and statistical deviations from the mean. You are measured, analytical, often contrarian. Speak in first person as Vera. 2-3 sentences maximum — precise and data-driven.',
    },
    {
        id: 'Rex',
        emoji: '🌊',
        color: '#9945FF',
        role: 'Trend Following Strategist',
        systemPrompt: 'You are Rex, the Trend Following Strategist. You focus on sustained multi-day trends, EMA cloud positions, and ADX filter strength. You are patient and disciplined — never fight the tape. Speak in first person as Rex. 2-3 sentences maximum — calculated and resolute.',
    },
    {
        id: 'Luna',
        emoji: '🌐',
        color: '#34C759',
        role: 'Sentiment & Macro Intelligence',
        systemPrompt: 'You are Luna, the Sentiment & Macro Intelligence. You focus on Fear & Greed index readings, social signals, DeFi TVL trends, and Polymarket probabilities. You see the human side of the market. Speak in first person as Luna. 2-3 sentences maximum — intuitive and macro-aware.',
    },
    {
        id: 'Orion',
        emoji: '🔮',
        color: '#0A84FF',
        role: 'Chief Strategist',
        systemPrompt: 'You are Orion, the Chief Strategist. You synthesize all technical, sentiment, and macro signals into a final actionable stance. You are the decision-maker — always give a clear recommendation and end with exactly one of these tags: [Stance: LONG] [Stance: FLAT] [Stance: WATCH]. Speak in first person as Orion. 3-4 sentences.',
    },
];

const STARTER_PROMPTS = [
    "What does the market structure look like right now?",
    "Should we be buying, selling, or holding here?",
    "Which strategy has the edge in current conditions?",
    "What's the macro sentiment telling us?",
    "Walk me through your current thesis on BTC.",
    "What would trigger you to place a trade right now?",
];

let msgIdCounter = 0;

async function callOllama(systemPrompt, userContent) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            stream: false,
            options: { temperature: 0.75, num_predict: 220 }
        })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama ${res.status}: ${err.slice(0, 120)}`);
    }
    const data = await res.json();
    return data?.message?.content || '(no response)';
}

function AgentBubble({ agent, text, thinking }) {
    const stanceMatch = text?.match(/\[Stance:\s*(LONG|FLAT|WATCH)\]/i);
    const cleanText = text?.replace(/\[Stance:\s*(LONG|FLAT|WATCH)\]/gi, '').trim();
    const stanceColors = { LONG: '#30d158', FLAT: '#636366', WATCH: '#ff9f0a' };
    const stance = stanceMatch?.[1]?.toUpperCase();

    return (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: `${agent.color}22`, border: `1.5px solid ${agent.color}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            }}>
                {agent.emoji}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: agent.color }}>{agent.id}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{agent.role}</span>
                    {stance && (
                        <span style={{
                            fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.45rem',
                            borderRadius: '20px', background: `${stanceColors[stance]}22`,
                            color: stanceColors[stance], border: `1px solid ${stanceColors[stance]}44`,
                            letterSpacing: '0.05em',
                        }}>
                            {stance}
                        </span>
                    )}
                </div>
                <div style={{
                    padding: '0.6rem 0.85rem', borderRadius: '4px 14px 14px 14px',
                    background: `${agent.color}0d`, border: `1px solid ${agent.color}22`,
                    color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                    {thinking
                        ? <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> deliberating…
                          </span>
                        : cleanText}
                </div>
            </div>
        </div>
    );
}

function UserBubble({ text }) {
    return (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', justifyContent: 'flex-end', marginBottom: '1.1rem' }}>
            <div style={{ maxWidth: '68%', padding: '0.6rem 0.9rem', borderRadius: '14px 4px 14px 14px', background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.25)', color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {text}
            </div>
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    const { selectedProduct, currentPrice, wsConnected } = useStore();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [ollamaOk, setOllamaOk] = useState(true);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        setMessages([{
            id: ++msgIdCounter, type: 'agent', agentIdx: 4, // Orion
            text: `Situation Room is live. We're monitoring ${selectedProduct || 'BTC-USD'} with all 5 agents active. Powered by local Ollama (${OLLAMA_MODEL}). Ask us anything — market structure, strategy thesis, risk assessment.`,
            thinking: false,
        }]);
        // Quick connectivity check
        fetch(`${OLLAMA_URL}/api/tags`).catch(() => setOllamaOk(false));
    }, []);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const send = async (text) => {
        const message = (text || input).trim();
        if (!message || loading) return;
        setInput('');
        setLoading(true);

        const marketContext = `Market context: ${selectedProduct || 'BTC-USD'}${currentPrice > 0 ? ` at $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}.`;
        const userContent = `${marketContext}\n\nUser question: ${message}`;

        // Add user message + all 5 agents in "thinking" state immediately
        const agentMsgIds = AGENTS.map(() => ++msgIdCounter);
        setMessages(prev => [
            ...prev,
            { id: ++msgIdCounter, type: 'user', text: message },
            { id: ++msgIdCounter, type: 'divider', label: 'Team deliberating…' },
            ...AGENTS.map((agent, i) => ({ id: agentMsgIds[i], type: 'agent', agentIdx: i, text: '', thinking: true })),
        ]);

        // First 4 agents run in parallel, Orion waits for them
        const subAgents = AGENTS.slice(0, 4);
        const orion = AGENTS[4];
        const subResponses = {};

        const subCalls = subAgents.map(async (agent, i) => {
            try {
                const responseText = await callOllama(agent.systemPrompt, userContent);
                subResponses[agent.id] = responseText;
                setMessages(prev => prev.map(m => m.id === agentMsgIds[i] ? { ...m, text: responseText, thinking: false } : m));
            } catch (err) {
                const errText = `⚠️ ${err.message.includes('fetch') ? 'Ollama not reachable — run: ollama serve' : err.message}`;
                subResponses[agent.id] = errText;
                setMessages(prev => prev.map(m => m.id === agentMsgIds[i] ? { ...m, text: errText, thinking: false } : m));
                setOllamaOk(false);
            }
        });

        await Promise.allSettled(subCalls);

        // Orion synthesizes the debate
        const debateContext = subAgents.map(a => `${a.id}: ${subResponses[a.id] || '(no response)'}`).join('\n\n');
        const orionPrompt = `${userContent}\n\n=== AGENT DEBATE ===\n${debateContext}\n\nSynthesize the above. Provide your final direction.`;

        try {
            const orionText = await callOllama(orion.systemPrompt, orionPrompt);
            setMessages(prev => prev.map(m => m.id === agentMsgIds[4] ? { ...m, text: orionText, thinking: false } : m));
        } catch (err) {
            const errText = `⚠️ ${err.message}`;
            setMessages(prev => prev.map(m => m.id === agentMsgIds[4] ? { ...m, text: errText, thinking: false } : m));
        }

        setLoading(false);
        inputRef.current?.focus();
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 120px)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: wsConnected ? 'var(--accent-green)' : 'var(--accent-orange)', boxShadow: `0 0 7px ${wsConnected ? 'var(--accent-green)' : 'var(--accent-orange)'}` }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Situation Room</span>
                {!ollamaOk && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-orange)' }}>
                        ⚠️ Ollama offline — run: <code>ollama serve</code>
                    </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {AGENTS.map((a, i) => <span key={i} style={{ fontSize: '0.85rem', opacity: 0.7 }}>{a.emoji}</span>)}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '0.3rem' }}>
                        5 agents · {selectedProduct} · {OLLAMA_MODEL}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', scrollbarWidth: 'thin' }}>
                {messages.map(msg => {
                    if (msg.type === 'user') return <UserBubble key={msg.id} text={msg.text} />;
                    if (msg.type === 'divider') return <Divider key={msg.id} label={msg.label} />;
                    if (msg.type === 'agent') return <AgentBubble key={msg.id} agent={AGENTS[msg.agentIdx]} text={msg.text} thinking={msg.thinking} />;
                    return null;
                })}
                <div ref={bottomRef} />
            </div>

            {/* Starters */}
            {messages.length <= 1 && (
                <div style={{ padding: '0 1.25rem 0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {STARTER_PROMPTS.map((p, i) => (
                        <button key={i} onClick={() => send(p)} disabled={loading} style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', fontSize: '0.68rem', cursor: 'pointer' }}>
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{ padding: '0.65rem 1.25rem 0.9rem', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask the team anything… (Enter to send)"
                    rows={2}
                    disabled={loading}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-primary)', borderRadius: '10px', padding: '0.55rem 0.8rem', color: 'var(--text-primary)', fontSize: '0.875rem', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
                />
                <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading}
                    style={{ width: 38, height: 38, borderRadius: '10px', border: 'none', background: input.trim() && !loading ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'default', flexShrink: 0, marginBottom: '1px' }}
                >
                    {loading ? <Loader size={15} color="var(--text-secondary)" /> : <Send size={15} color="white" />}
                </button>
            </div>
        </div>
    );
}
