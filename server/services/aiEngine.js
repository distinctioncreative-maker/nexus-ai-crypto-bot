const memoryStore = require('../memoryStore');
const { OpenAI } = require('openai');

async function evaluateMarketSignal(pricePoints) {
    if (!memoryStore.hasKeys()) return null;

    const keys = memoryStore.getKeys();
    const openai = new OpenAI({ apiKey: keys.openAiApiKey });
    const state = memoryStore.getPaperState();

    // The Auto-Enhancement Context: What did the AI learn from recent trades?
    const memoryContext = state.learningHistory.map((h, i) => `Lesson ${i+1}: ${h.knowledge}`).join('\n');
    
    // Construct Prompt
    const prompt = `
You are an elite, highly intelligent algorithmic trading assistant running locally in an institutional Enclave.
You manage a live portfolio.
Current Balance: $${state.balance.toFixed(2)}
Current BTC Holdings: ${state.btcHoldings}

Recent Market Activity (Prices, last = most recent):
${JSON.stringify(pricePoints)}

Your historical algorithmic learnings from past PnL Analysis:
${memoryContext || "First analysis. Focus on momentum and mean-reversion rules."}

Based strictly on this data, should we BUY, SELL, or HOLD right now?
Respond with a JSON object strictly in this format:
{
  "action": "BUY" | "SELL" | "HOLD",
  "reasoning": "A 1-sentence technical analysis explanation",
  "confidence": 0-100,
  "lesson_learned": "What you learned about this market setup to remember for next time"
}
`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview", // Note: Ensure you have credits, else change to gpt-3.5-turbo
            messages: [{ role: "system", content: "You are a quantitative trading JSON API." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const decision = JSON.parse(response.choices[0].message.content);
        const currentPrice = pricePoints[pricePoints.length - 1];
        
        // PnL Auto-Enhancing Check
        if (decision.action === 'SELL' && state.trades.length > 0) {
           const lastBuyTrade = state.trades.find(t => t.type === 'BUY');
           if (lastBuyTrade) {
               const pnl = currentPrice - lastBuyTrade.price;
               if (pnl < 0) {
                   memoryStore.recordLearning(`[CRITICAL MISS] A trade resulted in a loss of $${Math.abs(pnl).toFixed(2)} per BTC. Setup failed. Tighten confirmation criteria before entering next position.`);
               } else {
                   memoryStore.recordLearning(`[WIN] Successful execution. Pattern recognized and exploited for profit of $${pnl.toFixed(2)} per BTC.`);
               }
           }
        } else if (decision.lesson_learned && decision.action !== 'HOLD') {
            memoryStore.recordLearning(decision.lesson_learned);
        }

        return decision;
    } catch (error) {
        console.error("AI Engine Error:", error.message);
        return null; // Fail safe
    }
}

module.exports = { evaluateMarketSignal };
