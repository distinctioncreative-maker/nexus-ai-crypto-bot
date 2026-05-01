# Post-Audit Execution Plan
## Quant — AI Crypto Trading Terminal
**Created:** 2026-05-01  
**Based on:** nexus_ai_audit.md  
**Status:** EXECUTING

---

## 1. Audit Summary

The nexus_ai_audit.md found the app is a well-designed paper-trading/AI-lab prototype with real backend functionality, but not yet production-ready for real money. Key findings:

**Already fixed (prior sessions):**
- WebSocket auth bypass (token required in production)
- `const now` kill-switch crash (TDZ bug)
- Hardcoded E2E credentials
- Reconciliation code overriding correct balance with impossible computed values
- Ghost holdings (22M units) causing billion-dollar portfolio values
- Auto-heal for corrupted portfolio state
- Compliance disclaimers, PAPER SIM/LIVE ORDER badges
- Engine state optimism removed from WS client

**Remaining from audit + this task's priorities:**
1. Paper accounting needs input validation guards (non-finite, zero, negative values)
2. No per-product/per-user trade execution cooldown — bot can BUY-spam
3. Kill switch UI state can appear contradictory in edge cases
4. Setup route blocks if GROQ_API_KEY missing AND Ollama unavailable (production breakage)
5. AI rate limits in Situation Room need better client UX
6. Backtest shows 0-trade results without warning
7. Debug panel production visibility
8. No minimal tests for accounting math

---

## 2. Files Involved in Critical Bugs

| Bug | File(s) |
|-----|---------|
| Paper accounting input validation | `server/userStore.js:342-476` |
| Trade execution cooldown missing | `server/services/marketStream.js:512-600`, `server/userStore.js` |
| Setup Ollama hard failure | `server/routes/api.js:108-132` |
| Backtest 0-trade warning | `src/components/BacktestModule.jsx`, `server/services/backtestEngine.js` |
| Debug panel gating | `src/components/DebugPanel.jsx`, `src/App.jsx` |
| Situation Room cooldown UX | `src/components/SituationRoom.jsx` |

---

## 3. Execution Order

1. P1 — Add input validation + comments to `executePaperTrade` (accounting hardening)
2. P1 — Add minimal accounting unit tests (`server/tests/accounting.test.js`)
3. P2 — Add per-product trade execution cooldown
4. P3 — Verify kill switch consistency (code review, no change if fine)
5. P4 — Fix setup to allow degraded mode (no AI provider = warning, not error)
6. P5 — Situation Room: preserve input on rate limit, show provider status
7. P6 — Backtest 0-trade warning
8. P7 — Debug panel production gating
9. P8 — Minor mobile/UX issues
10. Build, test, report

---

## 4. What Will Be Fixed

- `server/userStore.js`: Input guards in `executePaperTrade` (NaN, Infinity, ≤0 price/amount)
- `server/userStore.js`: `lastTradeByProduct` map for per-product cooldown tracking
- `server/services/marketStream.js`: Per-product cooldown check before executing trade decision
- `server/routes/api.js`: Degraded mode — paper trading allowed even with no AI provider
- `src/components/BacktestModule.jsx`: 0-trade out-of-sample warning
- `src/components/SituationRoom.jsx`: Input preservation during cooldown
- `src/components/DebugPanel.jsx` + `src/App.jsx`: Verify dev-only gating
- `server/tests/accounting.test.js`: Minimal paper accounting tests (Node.js built-in assert)

---

## 5. What Will NOT Be Touched

- Live Coinbase order execution paths
- Strategy/agent algorithms (momentum, mean reversion, etc.)
- Supabase schema/migrations
- Any deployed environment variables
- The audit logs or learning history schema
- Multi-exchange architecture
- Full CI/CD pipeline (out of scope for this pass)
- KYC/AML compliance (out of scope)
- Full accessibility audit

---

## 6. Test Plan

- Minimal Node.js `assert`-based tests in `server/tests/accounting.test.js`:
  - BUY: $1000 at $77000/BTC → ~0.012987 BTC, balance decreases ~$1007 (fees)
  - BUY: cannot spend more than available balance
  - SELL: cannot sell more than holdings
  - Invalid inputs: NaN price → trade rejected
  - Risk engine: order over maxSingleOrderUSD → rejected
- `npm run build` — frontend clean build
- `node --check` on all modified server files
- Server startup + /api/health smoke test

---

## 7. Rollback Plan

All changes are local (not pushed). Each fix is a small, isolated patch. To rollback any single fix: `git diff` the file and revert the specific hunk. No schema changes, no dependency changes, no destructive operations.

---

## 8. Risk Level Per Change

| Change | Risk |
|--------|------|
| Input guards in executePaperTrade | LOW — reject-only, no behavior change for valid inputs |
| Trade execution cooldown | LOW-MEDIUM — reduces trade frequency, conservative direction |
| Setup degraded mode | LOW — wider acceptance, adds warning message |
| Backtest 0-trade warning | LOW — display only |
| Situation Room input preservation | LOW — frontend state only |
| Debug panel gating | LOW — hide/show only |
| Accounting tests | LOW — test-only, no prod code |

---

## Workstream Ownership

**1. Accounting Agent** — server/userStore.js, server/tests/accounting.test.js  
**2. Risk Agent** — server/services/marketStream.js, server/services/riskEngine.js  
**3. Backend Wiring Agent** — server/routes/api.js, server/services/aiEngine.js  
**4. UI/UX Agent** — BacktestModule.jsx, SituationRoom.jsx, DebugPanel.jsx  
**5. Security/QA Agent** — build, lint, tests, final report  
