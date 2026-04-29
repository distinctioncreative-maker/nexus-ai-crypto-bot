const userStore = require('../userStore');
const axios = require('axios');
const { getSignals, computeRotationScores } = require('./signalEngine');
const { getAgentConsensus, tickShadowPortfolios, recordAgentLesson } = require('./strategyEngine');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

/**
 * Call AI: uses Groq if GROQ_API_KEY is set, otherwise falls back to local Ollama.
 * Returns the response text, or throws on error.
 * Retries up to 3 times on 429 (rate limit) with exponential backoff.
 */
async function aiChat(systemPrompt, userContent, jsonMode = false, maxTokens = 500) {
    if (GROQ_API_KEY) {
        const body = {
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            max_tokens: maxTokens,
            temperature: 0.7,
        };
        if (jsonMode) body.response_format = { type: 'json_object' };

        const maxRetries = 4;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', body, {
                    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                    timeout: 60000
                });
                return res.data?.choices?.[0]?.message?.content || '';
            } catch (err) {
                const status = err.response?.status;
                if (status === 429 && attempt < maxRetries - 1) {
                    // Groq rate limit — check token reset header first, then request retry-after, then exponential backoff
                    const headers = err.response?.headers || {};
                    const tokenReset = headers['x-ratelimit-reset-tokens']; // e.g. "58.421s"
                    const requestRetry = parseInt(headers['retry-after'] || '0', 10);
                    let waitMs;
                    if (tokenReset && tokenReset.endsWith('s')) {
                        waitMs = Math.ceil(parseFloat(tokenReset) * 1000) + 500; // wait for token window to reset
                    } else if (requestRetry > 0) {
                        waitMs = requestRetry * 1000 + 200;
                    } else {
                        // Exponential: 3s, 8s, 20s — enough for a 6000 token/min window to clear
                        waitMs = [3000, 8000, 20000][attempt] || 20000;
                    }
                    console.warn(`Groq 429 — waiting ${(waitMs/1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }
                throw err;
            }
        }
    }

    // Fallback: local Ollama
    const body = {
        model: OLLAMA_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ],
        stream: false,
        options: { temperature: 0.7, num_predict: maxTokens }
    };
    if (jsonMode) body.format = 'json';

    const res = await axios.post(`${OLLAMA_URL}/api/chat`, body, { timeout: 90000 });
    return res.data?.message?.content || '';
}

async function evaluateMarketSignal(userId, candles, productId) {
    const state = userStore.getPaperState(userId);
    const product = productId || state.selectedProduct || 'BTC-USD';
    const [baseAsset] = product.split('-');

    const [signals, newsItems] = await Promise.all([
        getSignals().catch(() => null),
        require('./signalEngine').getNews().catch(() => [])
    ]);
    // Cache F&G on user object so riskEngine can apply size multiplier without extra API call
    if (signals?.fearGreed?.value != null) {
        userStore._ensureUser(userId)._lastFearGreed = signals.fearGreed.value;
    }

    // candles is an array of {time, value/close, open, high, low, volume}
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].value : 0;

    const totalValue = state.balance + (state.assetHoldings * currentPrice);
    const drawdownPct = ((state.initialBalance - totalValue) / state.initialBalance) * 100;

    const today = new Date().toISOString().slice(0, 10);
    const dailyPnl = state.dailyStats?.date === today ? state.dailyStats.pnlToday : 0;
    const dailyLimitRemaining = (state.riskSettings?.dailyLossLimitPercent || 5) - Math.max(0, (-dailyPnl / state.initialBalance) * 100);

    const memoryContext = state.learningHistory.slice(0, 5).map((h, i) => `Rule ${i + 1}: ${h.knowledge}`).join('\n');

    const fearGreedStr = signals?.fearGreed
        ? `${signals.fearGreed.value}/100 — ${signals.fearGreed.classification}`
        : 'Unavailable';
    const tvlStr = signals?.tvl
        ? `${signals.tvl.changePct > 0 ? '+' : ''}${signals.tvl.changePct}% 7d change`
        : 'Unavailable';
    const polyStr = signals?.polymarket
        ? `${(signals.polymarket.bullProb * 100).toFixed(0)}% BTC bull probability`
        : 'Unavailable';
    const compositeStr = signals
        ? `${signals.compositeScore > 0 ? '+' : ''}${signals.compositeScore}`
        : 'Unavailable';

    const topHeadlines = Array.isArray(newsItems) ? newsItems.slice(0, 3)
        .map((n, i) => `${i + 1}. [${n.source || 'News'}] ${n.headline} (${n.sentiment || 'neutral'})`)
        .join('\n') : '';
    const newsContext = topHeadlines
        ? `\n=== RECENT NEWS (top 3 headlines) ===\n${topHeadlines}\n`
        : '';

    // ── Agent Consensus (algorithmic, zero API cost) ──────────────────────────
    const { votes, orion: consensusResult } = getAgentConsensus(userId, candles, signals);
    try { tickShadowPortfolios(userId, candles, signals); } catch {}

    // ── Strong Consensus Bypass ────────────────────────────────────────────────
    // When 4+ of 5 specialist agents agree, skip the Groq synthesis call entirely.
    // The LLM would just ratify the consensus anyway — skipping saves ~400 tokens
    // and prevents Groq 429 rate limit exhaustion on the background eval loop.
    const subVotes = votes.filter(v => v.agentId !== 'COMBINED');
    const dominantCount = Math.max(consensusResult.buyCount, consensusResult.sellCount, consensusResult.holdCount);
    const isStrongConsensus = dominantCount >= Math.ceil(subVotes.length * 0.8); // ≥80% agreement

    if (isStrongConsensus && consensusResult.strength > 40) {
        const decision = {
            action: consensusResult.signal,
            reasoning: `${consensusResult.consensus} consensus (${dominantCount}/${subVotes.length} agents). ${consensusResult.reason}`,
            confidence: Math.round(consensusResult.strength),
            take_profit_pct: null,
            stop_loss_pct: null,
            position_size_override: null,
            lesson_learned: '',
            agentVotes: votes,
            agentConsensus: consensusResult,
        };
        const finalAction = ['BUY', 'SELL', 'HOLD'].includes(decision.action) ? decision.action : 'HOLD';
        decision.action = finalAction;
        return decision;
    }

    const voteDebate = votes.filter(v => v.agentId !== 'COMBINED').map(v =>
        `${v.name}(${v.agentId.split('_')[0]}): ${v.signal} — ${v.reason}`
    ).join('\n');
    const agentDebateSection = `\n=== 5-AGENT ALGORITHMIC DEBATE ===
${voteDebate}
AGENT CONSENSUS: ${consensusResult.signal} (${consensusResult.consensus}, dissent=${(Number(consensusResult.dissent)*100).toFixed(0)}%)
Buy votes: ${consensusResult.buyCount} | Sell votes: ${consensusResult.sellCount} | Hold votes: ${consensusResult.holdCount}
`;

    // Per-agent learned lessons injected per-agent
    const user = userStore._ensureUser(userId);
    const agentLessons = (user.strategies || [])
        .filter(s => s.lessons?.length > 0)
        .map(s => `${s.name}: ${s.lessons.slice(0, 2).map(l => l.lesson).join('; ')}`)
        .join('\n');
    const agentLessonsSection = agentLessons
        ? `\n=== AGENT SELF-LEARNED RULES ===\n${agentLessons}\n`
        : '';

    const systemInstruction = 'You are an elite quantitative trading JSON API. Only output valid JSON with exactly these fields: action (string: BUY, SELL, or HOLD), reasoning (string), confidence (integer 0-100), take_profit_pct (number or null), stop_loss_pct (number or null), position_size_override (number or null), lesson_learned (string).';

    const recentCandles = candles.slice(-20).map(c => {
        const t = new Date(c.time * 1000).toISOString().slice(11, 19);
        const o = c.open != null ? `O:$${Number(c.open).toFixed(2)} ` : '';
        const h = c.high != null ? `H:$${Number(c.high).toFixed(2)} ` : '';
        const l = c.low  != null ? `L:$${Number(c.low).toFixed(2)} `  : '';
        const vol = c.volume ? ` Vol:${Number(c.volume).toFixed(2)}` : '';
        return `[T:${t}] ${o}${h}${l}C:$${Number(c.value).toFixed(2)}${vol}`;
    });

    const prompt = `You are the Quant AI Chief Strategist (Orion) synthesizing input from 4 specialist agents.

=== PORTFOLIO STATE ===
Balance: $${state.balance.toFixed(2)}
${baseAsset} Holdings: ${state.assetHoldings} units (worth $${(state.assetHoldings * currentPrice).toFixed(2)})
Total Portfolio Value: $${totalValue.toFixed(2)}
Current Drawdown: ${drawdownPct.toFixed(2)}%
${agentDebateSection}
=== MARKET SIGNALS ===
Asset: ${product}
Current Price: $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Recent Price Action (Last 20 candles):
${recentCandles.join('\n')}

Fear & Greed Index: ${fearGreedStr}
DeFi TVL 7d Change: ${tvlStr}
Polymarket BTC Bull Probability: ${polyStr}
Composite Score: ${compositeStr}
Momentum Rotation (7d/30d): ${((() => { try { const r = computeRotationScores(userStore._ensureUser(userId)._productPriceHistory || {}); return r.ranked?.join(' > ') || 'N/A'; } catch { return 'N/A'; } })())}
${newsContext}${agentLessonsSection}
=== RISK CONTEXT ===
Daily P&L today: $${dailyPnl.toFixed(2)}
Daily loss limit remaining: ${dailyLimitRemaining.toFixed(2)}%
Circuit breaker: ${state.circuitBreaker?.tripped ? 'TRIPPED — ' + state.circuitBreaker.reason : 'Active'}

=== PORTFOLIO MEMORY ===
${memoryContext || `First analysis for ${product}. Establish baseline rules.`}

The 4 specialist agents have voted algorithmically above. As Chief Strategist, review their debate and ALL market signals.
- Weight votes by agent consensus strength
- Override only if macro/news data strongly contradicts algorithmic signals
- Provide a final decision with clear reasoning citing which agents you agree or disagree with.
Respond with JSON only.`;

    try {
        const raw = await aiChat(systemInstruction, prompt, true, 400);
        const decision = JSON.parse(raw);
        const finalAction = ['BUY', 'SELL', 'HOLD'].includes(decision.action) ? decision.action : 'HOLD';
        decision.action = finalAction;

        // Attach agent votes to decision for downstream use (autopsy, broadcast)
        decision.agentVotes = votes;

        if (decision.action === 'SELL' && state.trades.length > 0) {
            const lastBuyTrade = state.trades.find(t => t.type === 'BUY');
            if (lastBuyTrade) {
                const pnlPct = ((currentPrice - lastBuyTrade.price) / lastBuyTrade.price) * 100;
                // Fire-and-forget: run per-agent autopsies + global memory in background
                runAgentAutopsies(userId, product, lastBuyTrade.price, currentPrice, pnlPct, votes).catch(() => {});
            }
        } else if (decision.lesson_learned && decision.action !== 'HOLD') {
            userStore.recordLearning(userId, decision.lesson_learned);
        }

        return decision;
    } catch (error) {
        console.error(`AI Engine Error for user ${userId}:`, error.message);
        return null;
    }
}

/**
 * Phase 3: True LLM Self-Learning (Autopsy)
 * Runs per-agent and for the global portfolio memory.
 * Non-blocking — called fire-and-forget after a SELL.
 */
async function performAutopsy(userId, product, entryPrice, exitPrice, pnlPct) {
    const isWin = pnlPct > 0;
    const systemPrompt = 'You are a quantitative trading autopsy agent. Analyze the trade result and output a single concise sentence summarizing the lesson learned. Respond with JSON containing { "lesson": "..." }';

    const prompt = `Trade Autopsy for ${product}:
- Entry: $${Number(entryPrice).toFixed(2)} | Exit: $${Number(exitPrice).toFixed(2)} | PnL: ${pnlPct.toFixed(2)}%
This trade was a ${isWin ? 'WIN' : 'LOSS'}.
What specific rule should this agent apply to improve future trades? One precise sentence.`;

    try {
        const raw = await aiChat(systemPrompt, prompt, true, 150);
        const data = JSON.parse(raw);
        return data.lesson || `Trade closed with ${pnlPct.toFixed(2)}% PnL.`;
    } catch (err) {
        console.error('Autopsy failed:', err.message);
        return null;
    }
}

/**
 * Run autopsy for all agents simultaneously after a closed trade.
 * Each agent gets a lesson personalized to its strategy type.
 * Fire-and-forget — caller should not await.
 */
async function runAgentAutopsies(userId, product, entryPrice, exitPrice, pnlPct, agentVotes) {
    const pnlStr = pnlPct.toFixed(2);
    const isWin = pnlPct > 0;
    const systemPrompt = 'You are a specialist trading agent analyzing your own trade outcome. Output ONE precise rule as JSON: { "lesson": "..." }. Max 30 words.';

    const AGENT_TYPES = {
        MOMENTUM:         'momentum (MA crossover, trend strength)',
        MEAN_REVERSION:   'mean reversion (RSI extremes, Bollinger Bands)',
        TREND_FOLLOWING:  'trend following (EMA cloud, ADX filter)',
        SENTIMENT_DRIVEN: 'sentiment (Fear & Greed, macro composite)',
    };

    const jobs = Object.entries(AGENT_TYPES).map(async ([agentId, approach]) => {
        const vote = agentVotes?.find(v => v.agentId === agentId);
        const wasCorrect = vote ? (
            (vote.signal === 'BUY' && isWin) || (vote.signal === 'SELL' && !isWin)
        ) : null;

        const prompt = `You are the ${agentId} agent using ${approach}.
Trade: ${product} | Entry $${Number(entryPrice).toFixed(2)} | Exit $${Number(exitPrice).toFixed(2)} | ${pnlStr}% ${isWin ? 'PROFIT' : 'LOSS'}
Your signal was: ${vote?.signal || 'HOLD'} (${wasCorrect === true ? 'CORRECT' : wasCorrect === false ? 'WRONG' : 'N/A'})
Write one rule to improve YOUR specific ${approach} strategy going forward.`;

        try {
            const raw = await aiChat(systemPrompt, prompt, true, 100);
            const data = JSON.parse(raw);
            if (data.lesson) recordAgentLesson(userId, agentId, data.lesson);
        } catch {}
    });

    // Run all agent autopsies in parallel + global memory
    const globalLesson = await performAutopsy(userId, product, entryPrice, exitPrice, pnlPct);
    if (globalLesson) userStore.recordLearning(userId, globalLesson);

    await Promise.allSettled(jobs);
    console.log(`🧠 Autopsies complete for ${product} trade (${pnlStr}%)`);
}

const AGENT_PERSONAS = [
    {
        id: 'MOMENTUM',
        name: 'Atlas',
        role: 'Momentum Analyst',
        color: '#F7931A',
        personality: `You are Atlas, the Momentum Analyst. You live and breathe trend strength, moving average crossovers, and volume confirmation. You are direct, confident, and always reference price action. You speak in first person as Atlas. Keep responses to 2-3 sentences — sharp and specific.`
    },
    {
        id: 'MEAN_REVERSION',
        name: 'Vera',
        role: 'Mean Reversion Quant',
        color: '#627EEA',
        personality: `You are Vera, the Mean Reversion Quant. You focus on RSI extremes, overbought/oversold conditions, and statistical deviation from the mean. You are measured, analytical, and often play contrarian. You speak in first person as Vera. Keep responses to 2-3 sentences — precise and data-driven.`
    },
    {
        id: 'TREND_FOLLOWING',
        name: 'Rex',
        role: 'Trend Following Strategist',
        color: '#9945FF',
        personality: `You are Rex, the Trend Following Strategist. You ride sustained trends using EMA clouds and ADX filters. You are patient, disciplined, and never fight the tape. You speak in first person as Rex. Keep responses to 2-3 sentences — calculated and resolute.`
    },
    {
        id: 'SENTIMENT_DRIVEN',
        name: 'Luna',
        role: 'Sentiment & Macro Intelligence',
        color: '#34C759',
        personality: `You are Luna, the Sentiment & Macro Intelligence. You track Fear & Greed, social signals, DeFi TVL trends, and Polymarket probabilities. You see the human side of the market. You speak in first person as Luna. Keep responses to 2-3 sentences — intuitive and macro-aware.`
    },
    {
        id: 'COMBINED',
        name: 'Orion',
        role: 'Chief Strategist',
        color: '#0A84FF',
        personality: `You are Orion, the Chief Strategist. You synthesize ALL signals — technical, sentiment, and agent votes — into the final call. You are the decision-maker. You always give a clear recommendation at the end. You speak in first person as Orion. Keep responses to 3-4 sentences. Always end with a clear stance: LONG, FLAT, or WATCH.`
    }
];

/**
 * Situation Room: 5 agents in a persistent group chat.
 * - Accepts full conversation history so agents can reference prior exchanges.
 * - Round 1: 4 sub-agents respond in parallel, each aware of chat history.
 * - Round 2: Orion reads the full debate + history and gives the final verdict.
 *
 * history: [{ role: 'user'|'agent', agentName?: string, content: string }]
 */
async function answerUserQueryMultiAgent(userId, userMessage, productId, onAgentResponse, history = []) {
    const state = userStore.getPaperState(userId);
    const product = productId || state.selectedProduct || 'BTC-USD';
    const [baseAsset] = product.split('-');

    const [signals, newsItems] = await Promise.all([
        getSignals().catch(() => null),
        require('./signalEngine').getNews().catch(() => [])
    ]);

    const fearGreedStr = signals?.fearGreed ? `${signals.fearGreed.value}/100 — ${signals.fearGreed.classification}` : 'N/A';
    const compositeStr = signals ? `${signals.compositeScore > 0 ? '+' : ''}${signals.compositeScore}` : 'N/A';
    const learningContext = state.learningHistory.slice(0, 3).map((h, i) => `${i + 1}. ${h.knowledge}`).join('\n');

    // Build agent lessons summary
    const user = userStore._ensureUser(userId);
    const agentLessons = (user.strategies || [])
        .filter(s => s.lessons?.length > 0)
        .map(s => `${s.name}: ${s.lessons[0].lesson}`)
        .join(' | ');

    // Build conversation history summary (last 6 exchanges)
    const recentHistory = history.slice(-6);
    const historyText = recentHistory.length > 0
        ? '\n=== PRIOR CONVERSATION ===\n' + recentHistory.map(m =>
            m.role === 'user' ? `User: ${m.content}` : `${m.agentName || 'Agent'}: ${m.content}`
          ).join('\n') + '\n'
        : '';

    const newsHeadlines = Array.isArray(newsItems) ? newsItems.slice(0, 2).map(n => `• [${n.source}] ${n.headline}`).join('\n') : '';

    const sharedContext = `=== LIVE MARKET DATA ===
Asset: ${product} | Balance: $${state.balance.toFixed(2)} | Holdings: ${state.assetHoldings} ${baseAsset}
Engine: ${state.engineStatus || 'STOPPED'} | Mode: ${state.tradingMode || 'FULL_AUTO'}
Fear & Greed: ${fearGreedStr} | Composite Signal: ${compositeStr}
${newsHeadlines ? '=== BREAKING NEWS ===\n' + newsHeadlines + '\n' : ''}${historyText}
=== AGENT SELF-LEARNED RULES ===
${agentLessons || learningContext || 'No learned rules yet'}

=== NEW USER MESSAGE ===
${userMessage}

Important: Reference the conversation history and what your fellow agents say. Stay in character.`;

    const subAgents = AGENT_PERSONAS.filter(a => a.id !== 'COMBINED');
    const orionAgent = AGENT_PERSONAS.find(a => a.id === 'COMBINED');
    const subAgentResponses = {};

    // Round 1: Sub-agents respond sequentially to avoid Groq 429 burst
    for (const agent of subAgents) {
        // Each agent gets context of what other agents have said in history
        const priorAgentMessages = recentHistory
            .filter(m => m.role === 'agent' && m.agentName !== agent.name)
            .slice(-2)
            .map(m => `${m.agentName}: "${m.content.slice(0, 100)}…"`)
            .join('\n');

        const agentContext = priorAgentMessages
            ? `${sharedContext}\n\nRecent team input:\n${priorAgentMessages}`
            : sharedContext;

        try {
            const text = await aiChat(agent.personality, agentContext, false, 200);
            subAgentResponses[agent.name] = text;
            onAgentResponse(agent.id, agent.name, agent.role, agent.color, text);
        } catch (err) {
            subAgentResponses[agent.name] = `[offline: ${err.message}]`;
            onAgentResponse(agent.id, agent.name, agent.role, agent.color, subAgentResponses[agent.name]);
        }
    }

    // Round 2: Orion synthesizes the full debate
    const debateContext = Object.entries(subAgentResponses)
        .map(([name, text]) => `${name}: ${text}`)
        .join('\n\n');

    const orionContext = `${sharedContext}

=== THIS ROUND'S DEBATE ===
${debateContext}

You are Orion. Synthesize this debate. Call out where agents agree or disagree. Reference any conflicting signals.
End with a clear LONG, FLAT, or WATCH stance and one actionable insight.`;

    try {
        const text = await aiChat(orionAgent.personality, orionContext, false, 280);
        onAgentResponse(orionAgent.id, orionAgent.name, orionAgent.role, orionAgent.color, text);
    } catch (err) {
        onAgentResponse(orionAgent.id, orionAgent.name, orionAgent.role, orionAgent.color, `[offline: ${err.message}]`);
    }
}

module.exports = { evaluateMarketSignal, answerUserQueryMultiAgent, performAutopsy, runAgentAutopsies };
