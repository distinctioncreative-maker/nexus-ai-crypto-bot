const userStore = require('../userStore');
const axios = require('axios');
const { getSignals } = require('./signalEngine');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

/**
 * Call AI: uses Groq if GROQ_API_KEY is set, otherwise falls back to local Ollama.
 * Returns the response text, or throws on error.
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

        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', body, {
            headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 60000
        });
        return res.data?.choices?.[0]?.message?.content || '';
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

    const systemInstruction = 'You are an elite quantitative trading JSON API. Only output valid JSON with exactly these fields: action (string: BUY, SELL, or HOLD), reasoning (string), confidence (integer 0-100), take_profit_pct (number or null), stop_loss_pct (number or null), position_size_override (number or null), lesson_learned (string).';

    const recentCandles = candles.slice(-20).map(c => {
        const t = new Date(c.time * 1000).toISOString().slice(11, 19);
        const o = c.open != null ? `O:$${Number(c.open).toFixed(2)} ` : '';
        const h = c.high != null ? `H:$${Number(c.high).toFixed(2)} ` : '';
        const l = c.low  != null ? `L:$${Number(c.low).toFixed(2)} `  : '';
        const vol = c.volume ? ` Vol:${Number(c.volume).toFixed(2)}` : '';
        return `[T:${t}] ${o}${h}${l}C:$${Number(c.value).toFixed(2)}${vol}`;
    });

    const prompt = `You are the Quant AI trading engine managing a paper trading portfolio.

=== PORTFOLIO STATE ===
Balance: $${state.balance.toFixed(2)}
${baseAsset} Holdings: ${state.assetHoldings} units (worth $${(state.assetHoldings * currentPrice).toFixed(2)})
Total Portfolio Value: $${totalValue.toFixed(2)}
Current Drawdown: ${drawdownPct.toFixed(2)}%

=== MARKET SIGNALS ===
Asset: ${product}
Current Price: $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Recent Price Action (Last 20 minutes):
${recentCandles.join('\n')}

Fear & Greed Index: ${fearGreedStr}
DeFi TVL 7d Change: ${tvlStr}
Polymarket BTC Bull Probability: ${polyStr}

${newsContext}
=== RISK CONTEXT ===
Daily P&L today: $${dailyPnl.toFixed(2)}
Daily loss limit remaining: ${dailyLimitRemaining.toFixed(2)}%
Circuit breaker: ${state.circuitBreaker?.tripped ? 'TRIPPED — ' + state.circuitBreaker.reason : 'Active'}

=== LEARNED RULES (from past performance) ===
${memoryContext || `First analysis for ${product}. Focus on momentum and mean-reversion rules.`}

Given ALL signals above, what is your decision for ${baseAsset}?
Determine your action ('BUY', 'SELL', or 'HOLD'). Decide on a logic-backed 'take_profit_pct' (e.g. 5.5) and 'stop_loss_pct' (e.g. 2.0). Provide solid 'reasoning' and 'confidence'.
Respond with JSON only.`;

    try {
        const raw = await aiChat(systemInstruction, prompt, true, 800);
        const decision = JSON.parse(raw);
        const finalAction = ['BUY', 'SELL', 'HOLD'].includes(decision.action) ? decision.action : 'HOLD';
        decision.action = finalAction;

        if (decision.action === 'SELL' && state.trades.length > 0) {
            const lastBuyTrade = state.trades.find(t => t.type === 'BUY');
            if (lastBuyTrade) {
                const pnl = currentPrice - lastBuyTrade.price;
                if (pnl < 0) {
                    userStore.recordLearning(userId, `[CRITICAL MISS] ${product} loss of $${Math.abs(pnl).toFixed(2)}. Tighten entry criteria.`);
                } else {
                    userStore.recordLearning(userId, `[WIN] ${product} profit of $${pnl.toFixed(2)}. Pattern exploited successfully.`);
                }
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
 * Evaluates a closed trade and generates a concise lesson for the Vector DB/Memory.
 */
async function performAutopsy(userId, product, entryPrice, exitPrice, pnlPct) {
    const isWin = pnlPct > 0;
    const systemPrompt = 'You are a quantitative trading autopsy agent. Analyze the trade result and output a single concise sentence summarizing the lesson learned. Respond with JSON containing { "lesson": "..." }';
    
    const prompt = `
Trade Autopsy for ${product}:
- Entry Price: $${entryPrice.toFixed(2)}
- Exit Price: $${exitPrice.toFixed(2)}
- PnL: ${pnlPct.toFixed(2)}%

This trade was a ${isWin ? 'WIN' : 'LOSS'}. 
Based on standard market dynamics, why might this have happened, and what rule should we add to our memory to improve future trades? Keep it to one precise sentence.
`;

    try {
        const raw = await aiChat(systemPrompt, prompt, true, 200);
        const data = JSON.parse(raw);
        return data.lesson || `Trade closed with ${pnlPct.toFixed(2)}% PnL.`;
    } catch (err) {
        console.error('Autopsy failed:', err.message);
        return null;
    }
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
 * Situation Room: 5 agents each give individual responses.
 * Round 1: 4 sub-agents run in parallel.
 * Round 2: Orion synthesizes all 4 and gives final verdict.
 */
async function answerUserQueryMultiAgent(userId, userMessage, productId, onAgentResponse) {
    const state = userStore.getPaperState(userId);
    const product = productId || state.selectedProduct || 'BTC-USD';
    const [baseAsset] = product.split('-');

    const signals = await getSignals().catch(() => null);

    const fearGreedStr = signals?.fearGreed ? `${signals.fearGreed.value}/100 — ${signals.fearGreed.classification}` : 'N/A';
    const compositeStr = signals ? `${signals.compositeScore > 0 ? '+' : ''}${signals.compositeScore}` : 'N/A';
    const learningContext = state.learningHistory.slice(0, 5).map((h, i) => `${i + 1}. ${h.knowledge}`).join('\n');

    const sharedContext = `=== LIVE MARKET DATA ===
Asset: ${product} | Price context from last session
Portfolio: $${state.balance.toFixed(2)} cash, ${state.assetHoldings} ${baseAsset} holdings
Engine: ${state.engineStatus || 'STOPPED'} | Mode: ${state.tradingMode || 'FULL_AUTO'}
Fear & Greed: ${fearGreedStr} | Composite: ${compositeStr}
Learned Rules: ${learningContext || 'None yet'}

=== USER MESSAGE ===
${userMessage}`;

    const subAgents = AGENT_PERSONAS.filter(a => a.id !== 'COMBINED');
    const orionAgent = AGENT_PERSONAS.find(a => a.id === 'COMBINED');
    const subAgentResponses = {};

    // Round 1: Sub-agents run in parallel
    const agentCalls = subAgents.map(async (agent) => {
        try {
            const text = await aiChat(agent.personality, sharedContext, false, 200);
            subAgentResponses[agent.name] = text;
            onAgentResponse(agent.id, agent.name, agent.role, agent.color, text);
        } catch (err) {
            subAgentResponses[agent.name] = `[offline: ${err.message}]`;
            onAgentResponse(agent.id, agent.name, agent.role, agent.color, subAgentResponses[agent.name]);
        }
    });

    await Promise.allSettled(agentCalls);

    // Round 2: Orion synthesizes
    const debateContext = Object.entries(subAgentResponses)
        .map(([name, text]) => `${name}: ${text}`)
        .join('\n\n');

    const orionContext = `${sharedContext}

=== AGENT DEBATE (Round 1) ===
${debateContext}

Synthesize the above arguments. Agree or disagree, and provide final direction.`;

    try {
        const text = await aiChat(orionAgent.personality, orionContext, false, 250);
        onAgentResponse(orionAgent.id, orionAgent.name, orionAgent.role, orionAgent.color, text);
    } catch (err) {
        onAgentResponse(orionAgent.id, orionAgent.name, orionAgent.role, orionAgent.color, `[offline: ${err.message}]`);
    }
}

module.exports = { evaluateMarketSignal, answerUserQueryMultiAgent, performAutopsy };
