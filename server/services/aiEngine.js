const userStore = require('../userStore');
const { GoogleGenAI, Type } = require('@google/genai');
const { getSignals } = require('./signalEngine');
const { getWinningStrategy, getStrategyConsensus } = require('./strategyEngine');

async function evaluateMarketSignal(userId, pricePoints, productId) {
    const keys = userStore.getKeys(userId);
    if (!keys?.geminiApiKey) return null;

    const ai = new GoogleGenAI({ apiKey: keys.geminiApiKey });
    const state = userStore.getPaperState(userId);
    const product = productId || state.selectedProduct || 'BTC-USD';
    const [baseAsset] = product.split('-');

    const signals = await getSignals().catch(() => null);
    const winningStrategy = getWinningStrategy(userId);
    const consensus = getStrategyConsensus(userId, pricePoints, signals, product);
    const currentPrice = pricePoints[pricePoints.length - 1];

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

    const winnerDesc = winningStrategy
        ? `${winningStrategy.name} (Win Rate: ${winningStrategy.wins + winningStrategy.losses > 0 ? ((winningStrategy.wins / (winningStrategy.wins + winningStrategy.losses)) * 100).toFixed(0) : 0}%, Sharpe: ${winningStrategy.sharpe.toFixed(2)})`
        : 'No active strategy yet (generation 1 — building track record)';
    const dissentPct = Math.round(consensus.dissent * 100);
    const consensusContext = `=== AGENT DEBATE (${consensus.totalAgents} strategy agents voted) ===
Consensus Vote: ${consensus.consensus} — BUY ${consensus.buyPct}% | SELL ${consensus.sellPct}% | HOLD ${consensus.holdPct}%
Dissent Level: ${dissentPct}% — ${consensus.dissent > 0.3 ? 'SPLIT VOTE: agents disagree, be cautious with confidence' : 'strong agreement among agents'}
Leading Agent: ${consensus.topStrategy}
Full Debate: ${consensus.debate}`;

    const prompt = `You are the Quant AI trading engine. You manage a paper trading portfolio.

=== PORTFOLIO STATE ===
Balance: $${state.balance.toFixed(2)}
${baseAsset} Holdings: ${state.assetHoldings} units (worth $${(state.assetHoldings * currentPrice).toFixed(2)})
Total Portfolio Value: $${totalValue.toFixed(2)}
Current Drawdown: ${drawdownPct.toFixed(2)}%
Active Strategy: ${winnerDesc}

=== MARKET SIGNALS ===
Asset: ${product}
Current Price: $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Recent Price Data (last ${Math.min(pricePoints.length, 20)} ticks): ${JSON.stringify(pricePoints.slice(-20))}
Fear & Greed Index: ${fearGreedStr}
DeFi TVL 7d Change: ${tvlStr}
Polymarket BTC Bull Probability: ${polyStr}
Composite Signal Score: ${compositeStr}

${consensusContext}

=== RISK CONTEXT ===
Daily P&L today: $${dailyPnl.toFixed(2)}
Daily loss limit remaining: ${dailyLimitRemaining.toFixed(2)}%
Circuit breaker: ${state.circuitBreaker?.tripped ? 'TRIPPED — ' + state.circuitBreaker.reason : 'Active'}

=== LEARNED RULES (from past performance) ===
${memoryContext || `First analysis for ${product}. Focus on momentum and mean-reversion rules.`}

Given ALL signals above, what is your decision for ${baseAsset}?
Respond with strict JSON. Action must be exactly 'BUY', 'SELL', or 'HOLD'.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            confidence: { type: Type.INTEGER },
            lesson_learned: { type: Type.STRING },
            position_size_override: { type: Type.NUMBER }
        },
        required: ['action', 'reasoning', 'confidence', 'lesson_learned']
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction: 'You are an elite quantitative trading JSON API assistant. Only output valid JSON.',
                responseMimeType: 'application/json',
                responseSchema
            }
        });

        const decision = JSON.parse(response.text);
        const modelAction = ['BUY', 'SELL', 'HOLD'].includes(decision.action) ? decision.action : 'HOLD';
        const agentAction = consensus.consensus || 'HOLD';
        const finalAction = agentAction !== 'HOLD' ? agentAction : modelAction;

        if (finalAction !== modelAction) {
            decision.reasoning = `[Agent consensus override: ${agentAction}] ${decision.reasoning}`;
            decision.confidence = Math.min(decision.confidence || 0, 68);
        }
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

        return { ...decision, signals, topStrategyId: consensus.topStrategyId, agentConsensus: consensus };
    } catch (error) {
        console.error(`AI Engine Error for user ${userId}:`, error.message);
        return null;
    }
}

module.exports = { evaluateMarketSignal };
