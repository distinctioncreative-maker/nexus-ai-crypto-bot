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
You are an elite, highly intelligent algorithmic trading assistant running locally.
You are managing a paper-trading portfolio.
Current Balance: $${state.balance.toFixed(2)}
Current BTC Holdings: ${state.btcHoldings}

Recent Market Activity (Prices):
${JSON.stringify(pricePoints)}

Your historical algorithmic learnings from past trades:
${memoryContext || "You have no past learnings yet. Start analyzing pure price price action."}

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
            model: "gpt-4-turbo-preview", // or gpt-3.5-turbo if cost is issue
            messages: [{ role: "system", content: "You are a quantitative trading JSON API." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const decision = JSON.parse(response.choices[0].message.content);
        
        // Auto-Enhancing step: Save the lesson to memory
        if (decision.lesson_learned && decision.action !== 'HOLD') {
            memoryStore.recordLearning(decision.lesson_learned);
        }

        return decision;
    } catch (error) {
        console.error("AI Engine Error:", error.message);
        return null;
    }
}

module.exports = { evaluateMarketSignal };
