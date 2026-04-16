const userStore = require('../userStore');
const { GoogleGenAI, Type } = require('@google/genai');

async function evaluateMarketSignal(userId, pricePoints, productId) {
    if (!userStore.hasKeys(userId)) return null;

    const keys = userStore.getKeys(userId);
    const ai = new GoogleGenAI({ apiKey: keys.geminiApiKey });
    const state = userStore.getPaperState(userId);
    const product = productId || state.selectedProduct || 'BTC-USD';
    const [baseAsset] = product.split('-');

    const memoryContext = state.learningHistory.map((h, i) => `Lesson ${i+1}: ${h.knowledge}`).join('\n');

    const prompt = `
You manage a live paper trading portfolio for ${product}.
Current Balance: $${state.balance.toFixed(2)}
Current ${baseAsset} Holdings: ${state.assetHoldings}

Recent ${product} Price Activity (oldest → newest):
${JSON.stringify(pricePoints)}

Your historical algorithmic learnings from past PnL Analysis:
${memoryContext || `First analysis for ${product}. Focus on momentum and mean-reversion rules.`}

Based strictly on this data, should we BUY, SELL, or HOLD ${baseAsset} right now?
Respond with JSON matching the strict schema. Action must be 'BUY', 'SELL', or 'HOLD'.
`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            confidence: { type: Type.INTEGER },
            lesson_learned: { type: Type.STRING }
        },
        required: ["action", "reasoning", "confidence", "lesson_learned"]
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                systemInstruction: "You are an elite quantitative trading JSON API assistant.",
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });

        const decision = JSON.parse(response.text);
        const currentPrice = pricePoints[pricePoints.length - 1];

        // PnL Auto-Enhancing
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

module.exports = { evaluateMarketSignal };
