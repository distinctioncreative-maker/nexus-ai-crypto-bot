const userStore = require('../userStore');
const axios = require('axios');
const { getSignals, computeRotationScores } = require('./signalEngine');
const { getAgentConsensus, recordAgentLesson } = require('./strategyEngine');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
// Fast 8b model for autopsies/lessons — separate rate-limit pool from the 70b eval/Oracle model
const GROQ_FAST_MODEL = 'llama-3.1-8b-instant';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

// Concurrency limiter: max 2 simultaneous Groq calls on the primary model
let _pendingGroqCalls = 0;
const _groqQueue = [];

async function aiChatQueued(systemPrompt, userContent, jsonMode = false, maxTokens = 500, model) {
    if (_pendingGroqCalls >= 2) {
        await new Promise(r => _groqQueue.push(r));
    }
    _pendingGroqCalls++;
    try {
        return await aiChat(systemPrompt, userContent, jsonMode, maxTokens, model);
    } finally {
        _pendingGroqCalls--;
        if (_groqQueue.length > 0) _groqQueue.shift()();
    }
}

/**
 * Call AI: uses Groq if GROQ_API_KEY is set, otherwise falls back to local Ollama.
 * Returns the response text, or throws on error.
 * Retries up to 3 times on 429 (rate limit) with exponential backoff.
 */
async function aiChat(systemPrompt, userContent, jsonMode = false, maxTokens = 500, model) {
    if (GROQ_API_KEY) {
        const body = {
            model: model || GROQ_MODEL,
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
    // Note: tickShadowPortfolios is called from marketStream.js with the selected
    // product's candles — not here — to avoid per-coin cross-contamination.
    const { votes, orion: consensusResult } = getAgentConsensus(userId, candles, signals);

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

    const systemInstruction = 'You are an elite quantitative trading JSON API. Only output valid JSON with exactly these fields: action (string: BUY, SELL, or HOLD), reasoning (string), confidence (integer 0-100), take_profit_pct (number or null — percentage of entry price for take profit), stop_loss_pct (number or null — percentage of entry price for stop loss), position_size_override (number or null — BASE ASSET UNITS to trade, e.g. 0.015 for 0.015 BTC, NOT a USD amount; set null to use default sizing), lesson_learned (string).';

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
        const raw = await aiChatQueued(systemInstruction, prompt, true, 400);
        const decision = JSON.parse(raw);
        const finalAction = ['BUY', 'SELL', 'HOLD'].includes(decision.action) ? decision.action : 'HOLD';
        decision.action = finalAction;

        // Attach agent votes to decision for downstream use (broadcast)
        decision.agentVotes = votes;

        if (decision.lesson_learned && decision.action !== 'HOLD') {
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
        const raw = await aiChatQueued(systemPrompt, prompt, true, 150, GROQ_FAST_MODEL);
        const data = JSON.parse(raw);
        return data.lesson || `Trade closed with ${pnlPct.toFixed(2)}% PnL.`;
    } catch (err) {
        console.error('Autopsy failed:', err.message);
        return null;
    }
}

/**
 * Run autopsy for all agents sequentially after a closed trade.
 * Each agent gets a lesson personalized to its strategy type.
 * Sequential (not parallel) to stay under Groq's 30 req/min limit.
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

    for (const [agentId, approach] of Object.entries(AGENT_TYPES)) {
        const vote = agentVotes?.find(v => v.agentId === agentId);
        const wasCorrect = vote ? (
            (vote.signal === 'BUY' && isWin) || (vote.signal === 'SELL' && !isWin)
        ) : null;

        const prompt = `You are the ${agentId} agent using ${approach}.
Trade: ${product} | Entry $${Number(entryPrice).toFixed(2)} | Exit $${Number(exitPrice).toFixed(2)} | ${pnlStr}% ${isWin ? 'PROFIT' : 'LOSS'}
Your signal was: ${vote?.signal || 'HOLD'} (${wasCorrect === true ? 'CORRECT' : wasCorrect === false ? 'WRONG' : 'N/A'})
Write one rule to improve YOUR specific ${approach} strategy going forward.`;

        try {
            // Use fast 8b model for autopsies — separate rate-limit pool from eval/Oracle
            const raw = await aiChatQueued(systemPrompt, prompt, true, 100, GROQ_FAST_MODEL);
            const data = JSON.parse(raw);
            if (data.lesson) recordAgentLesson(userId, agentId, data.lesson);
        } catch {}
        await new Promise(r => setTimeout(r, 400));
    }

    // Global portfolio memory — runs after all agent lessons
    const globalLesson = await performAutopsy(userId, product, entryPrice, exitPrice, pnlPct);
    if (globalLesson) userStore.recordLearning(userId, globalLesson);

    console.log(`Autopsies complete for ${product} trade (${pnlStr}%)`);
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
 * Quant Oracle — single unified AI replacing the 5-agent debate.
 * One Groq call instead of 6. Combines all agent perspectives in the system prompt.
 * Includes live computed indicator values from the algorithmic engine.
 *
 * history: [{ role: 'user'|'agent', content: string }]
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

    const user = userStore._ensureUser(userId);

    // Include computed algorithmic indicator signals so Oracle has real data
    const strategies = user.strategies || [];
    const agentSignals = strategies
        .filter(s => s.id !== 'COMBINED' && s.lastSignal)
        .map(s => `${s.name}(${s.id.split('_')[0]}): ${s.lastSignal} — Sharpe ${(s.sharpe || 0).toFixed(2)}, W${s.wins}/L${s.losses}`)
        .join('\n') || 'No signals yet — engine not running';

    const agentLessons = strategies
        .filter(s => s.lessons?.length > 0)
        .map(s => `${s.name}: ${s.lessons[0].lesson}`)
        .join('\n') || 'No lessons recorded yet';

    const newsHeadlines = Array.isArray(newsItems) ? newsItems.slice(0, 3).map(n => `• [${n.source}] ${n.headline}`).join('\n') : '';

    const recentHistory = history.slice(-8);
    const historyText = recentHistory.length > 0
        ? '\n=== CONVERSATION HISTORY ===\n' + recentHistory.map(m =>
            m.role === 'user' ? `You: ${m.content}` : `Oracle: ${m.content}`
          ).join('\n') + '\n'
        : '';

    const systemPrompt = `You are the Quant Oracle — an elite quantitative AI trading advisor for a professional crypto terminal. You have internalized the expertise of five specialist agents: Atlas (momentum/EMA/MACD), Vera (mean reversion/RSI/Bollinger Bands), Rex (trend following/EMA cloud/ADX), Luna (sentiment/Fear&Greed/macro), and Nova (volume/OBV/MACD divergence). You synthesize all of their perspectives naturally in every response.

You have direct access to live portfolio state, computed indicator signals from these agents, and market data. You are direct, specific, and always cite the actual indicator values or agent signals you're referencing. Give clear recommendations — never hedge excessively. End every response with one of: LONG, FLAT, WATCH, or EXIT.`;

    const userPrompt = `=== PORTFOLIO ===
${baseAsset} at $${Number(state.assetHoldings * (state.trades?.slice(-1)[0]?.price || 0)).toFixed(2) || 0} held | Cash: $${state.balance.toFixed(2)} | Engine: ${state.engineStatus || 'STOPPED'}

=== LIVE INDICATORS (computed) ===
${agentSignals}

=== MACRO ===
Fear & Greed: ${fearGreedStr} | Composite: ${compositeStr}

=== AGENT LESSONS ===
${agentLessons}
${newsHeadlines ? '\n=== LATEST NEWS ===\n' + newsHeadlines : ''}${historyText}

=== QUESTION ===
${userMessage}`;

    const ORACLE_ID = 'COMBINED';
    const ORACLE_NAME = 'Quant Oracle';
    const ORACLE_COLOR = '#0A84FF';

    try {
        const text = await aiChatQueued(systemPrompt, userPrompt, false, 500);
        onAgentResponse(ORACLE_ID, ORACLE_NAME, 'Chief Strategist', ORACLE_COLOR, text);
    } catch (err) {
        // Distinguish rate-limit (retryable) from config errors (not retryable)
        const isRateLimit = err.response?.status === 429 || /429|rate.?limit|quota/i.test(err.message);
        const isAuthError = err.response?.status === 401 || err.response?.status === 403;
        let offlineMsg;
        if (isRateLimit) {
            offlineMsg = '[offline: rate-limited — Groq token quota exceeded. Wait 30–60 seconds and try again.]';
        } else if (isAuthError) {
            offlineMsg = '[offline: AI provider authentication failed — check GROQ_API_KEY on the server.]';
        } else if (!GROQ_API_KEY && !process.env.OLLAMA_URL) {
            offlineMsg = '[offline: no AI provider configured — set GROQ_API_KEY on the server to enable Oracle.]';
        } else {
            offlineMsg = `[offline: ${err.message}]`;
        }
        console.error('Oracle error:', err.message);
        onAgentResponse(ORACLE_ID, ORACLE_NAME, 'Chief Strategist', ORACLE_COLOR, offlineMsg);
    }
}

module.exports = { evaluateMarketSignal, answerUserQueryMultiAgent, performAutopsy, runAgentAutopsies };
