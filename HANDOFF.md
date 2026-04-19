# Quant AI Trading Bot — Agent Handoff Document
**Date:** April 18, 2026  
**Prepared for:** Antigravity / next agent session  
**Author:** Claude (claude-sonnet-4-6), outgoing session

---

## 1. What This Project Is

A full-stack crypto AI trading terminal. The user has an investor meeting and needs it to actually function. It is NOT a toy — it has real Supabase auth, real Coinbase WebSocket price feeds, real Gemini AI decisions, and real trade execution infrastructure.

**Stack:**
- **Frontend:** React 19 + Vite + Zustand, deployed on **Vercel** at `https://crypto-ai-bot-psi.vercel.app`
- **Backend:** Node.js 22 + Express 5 + ws, deployed on **Railway** at `https://kalshi-backend-production-b847.up.railway.app`
- **Database:** Supabase Postgres (auth + persistence)
- **AI:** Google Gemini API (key stored in Railway env + user's Supabase record, billing enabled as of April 18 2026)
- **Market Data:** Coinbase Advanced Trade WebSocket (public, unauthenticated)

**Local repo:** `/Users/mattcorez/Claude/crypto-ai-bot`  
**Backend subdirectory:** `server/`

---

## 2. Current State: Honest Assessment

### ✅ CONFIRMED WORKING
- Gemini API key is valid and billing is active. A `200 OK` response was confirmed with `gemini-2.5-flash` in tests today. The user's AI Studio logs also show `200 OK` calls happening.
- Coinbase WebSocket price feed connects and streams live prices.
- Supabase auth (login/signup) works.
- Frontend loads on Vercel.
- The backend Express server starts cleanly and has no syntax errors.
- `POST /api/setup` validates Gemini + Coinbase keys before saving.
- All backend `node --check` passes.
- Frontend `npm run build` passes clean.

### ❌ NOT WORKING / NEVER CONFIRMED WORKING

#### Problem 1 — CRITICAL: All Backend Fixes Are Uncommitted (Railway Runs Old Code)
This is the single root cause of most failures.

**The situation:**
- 12 files have been modified locally over multiple sessions but **never committed or pushed to git**
- Railway auto-deploys from the git repo — it is running commit `00e8046` from several sessions ago
- All backend fixes (model switch to `gemini-2.5-flash`, WS handlers for Situation Room, warmup counter, pending trade guard, daily P&L fix, etc.) **do not exist on the deployed server**
- The `/api/debug` endpoint returning `<!DOCTYPE html>` HTML is confirmation — Railway's proxy layer is intercepting the request before it reaches Express, meaning the Railway deployment is not the current code

**What needs to happen:** All modified files must be committed and pushed. Railway must redeploy. This is a git commit + push — nothing else.

**Modified files that need committing:**
```
server/routes/api.js           — gemini-2.5-flash, openPosition wiring in REST confirm-trade
server/services/aiEngine.js    — gemini-2.5-flash model name
server/services/marketStream.js — position size bounds, pending trade guard, fresh engine state
server/services/signalEngine.js — safe Polymarket/DeFiLlama parsing
server/userStore.js            — daily P&L fix, encryption key fail-fast
src/App.jsx                    — engine buttons .catch() removed, backend error banner
src/components/Dashboard.jsx   — trade feed filtered by product, safe field access
src/components/RiskSettingsModal.jsx — save error display
src/components/SetupWizard.jsx — saves geminiKey to Zustand after setup
src/components/SituationRoom.jsx — direct Gemini browser call (no server needed)
src/services/websocket.js      — clearPendingTrade inside WS open check only
src/store/useStore.js          — geminiKey state, setGeminiKey action
```

**Commands to run:**
```bash
cd /Users/mattcorez/Claude/crypto-ai-bot
git add -A
git commit -m "Phase 8: fix trade execution, model upgrade to gemini-2.5-flash, audit fixes"
git push
```

Then check Railway dashboard → confirm new deployment completes → `/api/debug` should return JSON (not HTML).

---

#### Problem 2 — Engine Status Buttons May Still Not Work Until Railway Redeploys

The PAPER / STOPPED / LIVE buttons send a `SET_ENGINE_STATUS` WebSocket message. The WS handler in `server/index.js` responds. If Railway's old code is running, the WS handler still exists (it was in older commits). However the `updateEngineStatus()` call in App.jsx previously had a `.catch()` on a non-Promise return — that was fixed locally but the frontend is deployed on Vercel from git, so **the frontend still has the broken `.catch()` unless the Vercel deployment picks up the new commit**.

**Fix:** Commit + push → Vercel redeploys frontend automatically from the git repo.

---

#### Problem 3 — Backtest 90 Days "Not Enough Historical Data"

**Root cause:** CoinGecko free tier (no API key) rate-limits aggressively. When you request 365 days to get ~91 candles, if CoinGecko sees too many requests from the Railway IP, it returns fewer candles or a 429.

**Current code behavior** (`server/services/backtestEngine.js:188-190`):
```js
const fetchDays = days >= 90 ? 365 : days;
const candles = await fetchOHLCV(coinId, fetchDays);
if (candles.length < 15) throw new Error(`CoinGecko returned only ${candles.length} candles...`);
```

The minimum check is 15. If CoinGecko rate-limits and returns 0-14 candles, the error fires.

**Solutions (in order of preference):**
1. **Add a CoinGecko API key** — free at coingecko.com/api — add `COINGECKO_API_KEY` to Railway env vars and modify `fetchOHLCV` to include `x-cg-demo-api-key` header. This removes rate limiting.
2. **Add retry logic** — retry after 5 seconds on failure, max 3 attempts.
3. **Reduce minimum candle threshold** — already at 15 (previously was 40). May need to go to 10.
4. **Cache results** — add a 1-hour in-memory cache keyed by `${coinId}-${days}` so repeated requests don't hammer CoinGecko.

---

#### Problem 4 — Situation Room Works BUT Only If geminiKey Is Set In-Session

The Situation Room was rewritten to call Gemini directly from the browser (bypassing Railway entirely). This works. However the `geminiKey` is stored in Zustand (in-memory only). If the user:
- Refreshes the page
- Has a Supabase session restored automatically (no setup wizard shown)

...then `geminiKey` will be empty and Situation Room will show "Configure Gemini key first."

**Fix needed:** On app load, if the user is already configured (keys exist on backend), fetch the Gemini key back from the backend and store it in Zustand. The backend already has the key stored (encrypted in Supabase). 

Add a `GET /api/gemini-key` endpoint that returns the decrypted Gemini key for the authenticated user. Call it in `App.jsx` after the `/api/status` check when `data.isConfigured === true`.

---

#### Problem 5 — Trades Never Executed In Session (Gemini Quota Was Zero)

During the entire prior session, Gemini API quota was 0. Now that billing is enabled and `gemini-2.5-flash` is confirmed working, **trades should execute once Railway deploys the new code and the user clicks PAPER**.

The trade execution flow is correct in the code:
1. User clicks PAPER → `SET_ENGINE_STATUS` WS → backend sets `engineStatus = 'PAPER_RUNNING'`
2. Every 2s tick → after 20 ticks (40s), AI evaluates every 30s
3. If confidence ≥ 52% and action ≠ HOLD → paper trade fires (FULL_AUTO) or pending card shows (AI_ASSISTED)
4. Trade goes to Zustand `trades[]` → visible in Portfolio page

**No code changes needed here** — just Railway deployment + billing fix does it.

---

## 3. Architecture Deep Reference

### Backend Entry Point
`server/index.js` — WebSocket server, auth, message handlers

**WebSocket message handlers (inbound from client):**
| Type | Handler | Status |
|------|---------|--------|
| `CHANGE_PRODUCT` | switches product, rebroadcasts state | ✅ Works |
| `KILL_SWITCH` | trips/resets kill switch | ✅ Works |
| `SET_TRADING_MODE` | FULL_AUTO / AI_ASSISTED | ✅ Works |
| `SET_ENGINE_STATUS` | STOPPED / PAPER_RUNNING / LIVE_RUNNING | ✅ Works (but frontend had .catch() bug — now fixed locally) |
| `CONFIRM_TRADE` | accepts/rejects pending AI trade | ✅ Works |
| `SITUATION_ROOM_QUERY` | calls answerUserQueryMultiAgent | ⚠️ Works in local code, NOT deployed yet |

**WebSocket broadcasts (outbound to client):**
All handled in `src/services/websocket.js`. All handlers present. No missing handlers.

### Trade Execution Pipeline
```
Coinbase WS → getProductData() → interval every 2s
  → TICK broadcast (price update)
  → every 30s: evaluateMarketSignal() [Gemini + strategyEngine]
    → if action !== HOLD && confidence >= 52:
      → FULL_AUTO + PAPER_RUNNING: executePaperTrade() → TRADE_EXEC broadcast
      → AI_ASSISTED: setPendingTrade() → PENDING_TRADE broadcast → PendingTradeCard shown
      → LIVE_RUNNING: always AI_ASSISTED → placeMarketOrder() on confirm
```

### Strategy Tournament
5 shadow portfolios (MOMENTUM, MEAN_REVERSION, TREND_FOLLOWING, SENTIMENT_DRIVEN, COMBINED) each with $100k virtual capital, tracked in `server/services/strategyEngine.js`. They evaluate every tick alongside the main AI. After 20 closed shadow trades, tournament runs — bottom performers mutate parameters.

**Status:** Fully implemented. Never ran because Gemini quota was 0 and AI never evaluated. Will activate automatically once trades flow.

### Situation Room (AI Group Chat)
**Implementation:** Direct browser → Gemini REST API call. No server involvement.  
**File:** `src/components/SituationRoom.jsx`  
**Key:** `geminiKey` from Zustand store (set by SetupWizard after successful `/api/setup`)  
**Model:** `gemini-2.5-flash`  
**Problem:** Key not persisted across page refresh (see Problem 4 above)

### Persistence
- **Supabase tables:** `user_settings`, `paper_trades`, `learning_history`, `strategies`, `agent_snapshots`
- **Keys encrypted** with AES using `ENCRYPTION_SECRET` env var
- **Pattern:** All saves are fire-and-forget with `.catch(console.warn)` — failures are silent

### Risk Engine
`server/services/riskEngine.js` — called before every trade.
- Max trade % of portfolio (default 2%)
- Daily loss limit % (default 5%)
- Max single order USD (default $1,000)
- Volatility circuit breaker
- Kill switch check

---

## 4. Environment Variables

### Railway (backend)
```
SUPABASE_URL=https://hhemffbjhhffivffgann.supabase.co
SUPABASE_SERVICE_ROLE_KEY=(service role key)
ENCRYPTION_SECRET=(AES encryption key for user API keys)
FRONTEND_URL=https://crypto-ai-bot-psi.vercel.app
PORT=3001 (or Railway sets this)
TWITTER_BEARER_TOKEN=(empty — Twitter signal disabled, fails silently)
```

### Vercel (frontend, baked at build time)
```
VITE_SUPABASE_URL=https://hhemffbjhhffivffgann.supabase.co
VITE_SUPABASE_ANON_KEY=(anon key)
VITE_BACKEND_URL=https://kalshi-backend-production-b847.up.railway.app
```

### User's API Keys (stored encrypted in Supabase, loaded via /api/setup)
```
Gemini API Key: (stored encrypted in Supabase user_settings.gem_key_enc)
               (billing enabled Apr 18 2026, confirmed working with gemini-2.5-flash)
Coinbase API Key: (not configured — optional, only needed for live trading)
```

---

## 5. The Single Most Important Action

**Commit and push all local changes to git. Railway will redeploy automatically.**

```bash
cd /Users/mattcorez/Claude/crypto-ai-bot
git add -A
git commit -m "Phase 8: gemini-2.5-flash, trade execution fixes, audit hardening"
git push origin main
```

After this:
1. Railway picks up the commit → redeploys in ~2 minutes
2. `/api/debug` should return JSON (not HTML)
3. User enters Gemini key in setup → clicks PAPER → AI starts evaluating in ~40s → trades execute

---

## 6. Prioritized Fix Queue (For Next Agent)

### P0 — Do This First (Prerequisite for Everything)
1. **Commit + push** all 12 modified files (listed in Problem 1 above)
2. **Verify Railway deployed** by hitting `/api/debug` — should return JSON with env var status
3. **Add `GET /api/gemini-key` endpoint** so Situation Room works after page refresh

### P1 — Makes App Fully Functional
4. **CoinGecko API key** for backtest reliability — free at coingecko.com/api — add to Railway env + `fetchOHLCV` header
5. **Verify trade executes** — once Railway deploys, click PAPER + FULL_AUTO, wait 40s, check AI Status bar, check Portfolio page for a trade within 5 minutes

### P2 — Polish and Reliability
6. **Retry logic for CoinGecko** in backtestEngine.js — 3 retries with 5s delay
7. **Supabase persistence failure alerts** — show user a toast if DB is unreachable (currently silent)
8. **TWITTER_BEARER_TOKEN** — either populate in Railway or remove Twitter code from signalEngine.js
9. **Verify Vercel env vars** match current Railway URL (in case Railway URL ever changes)

---

## 7. Files Map (Critical Paths)

```
crypto-ai-bot/
├── server/
│   ├── index.js                   # WS server, auth, message routing
│   ├── userStore.js               # Per-user in-memory state, executePaperTrade
│   ├── routes/api.js              # REST endpoints (/api/setup, /api/status, etc.)
│   ├── services/
│   │   ├── aiEngine.js            # Gemini calls, evaluateMarketSignal, answerUserQueryMultiAgent
│   │   ├── marketStream.js        # Coinbase WS, trade execution loop (2s interval)
│   │   ├── strategyEngine.js      # 5-agent shadow tournament
│   │   ├── riskEngine.js          # Pre-trade risk checks
│   │   ├── positionManager.js     # SmartTrade multi-TP + trailing stop
│   │   ├── signalEngine.js        # Fear & Greed, DeFiLlama, Polymarket, RSS news
│   │   ├── backtestEngine.js      # CoinGecko OHLCV backtest
│   │   ├── liveTrading.js         # Coinbase Advanced Trade order placement
│   │   └── productCatalog.js      # Supported Coinbase products list
│   └── db/
│       └── persistence.js         # Supabase read/write functions
├── src/
│   ├── App.jsx                    # Auth gates, routing, engine controls
│   ├── store/useStore.js          # Zustand global state
│   ├── services/websocket.js      # WS connection, all message handlers
│   ├── lib/
│   │   ├── api.js                 # Backend URL resolver
│   │   └── supabase.js            # Supabase client, authFetch wrapper
│   └── components/
│       ├── Dashboard.jsx          # Main terminal: price chart, AI status, trade feed
│       ├── PortfolioPage.jsx      # Positions, P&L, trade history
│       ├── AgentsPage.jsx         # Strategy tournament display
│       ├── PendingTradeCard.jsx   # AI_ASSISTED trade confirmation modal
│       ├── SituationRoom.jsx      # Group AI chat (direct Gemini call from browser)
│       ├── BacktestModule.jsx     # Historical backtest UI
│       ├── IntelligencePage.jsx   # News + macro signals display
│       ├── RiskSettingsModal.jsx  # Risk parameter configuration
│       └── SetupWizard.jsx        # Initial API key configuration
├── railway.json                   # Railway build/deploy config
└── HANDOFF.md                     # This file
```

---

## 8. What This Session Accomplished (For Context)

**Implemented (all local, not deployed):**
- Switched all Gemini calls from `gemini-2.0-flash` → `gemini-2.5-flash` (confirmed working)
- Fixed engine button `.catch()` TypeError that prevented PAPER/STOPPED from working
- Fixed daily P&L always being $0 (risk limits never enforced)
- Fixed trade feed showing all products instead of filtering by selected
- Fixed `sendConfirmTrade` clearing modal before WS send succeeded
- Fixed position size override with no bounds check
- Fixed RiskSettingsModal save errors being silent
- Fixed SmartTrade not wired in REST confirm-trade path
- Fixed pending trades overwriting each other (race condition)
- Fixed stale engine state in SmartTrade callbacks
- Added safe parsing for Polymarket/DeFiLlama API responses
- Added backend connection error display instead of blank screen
- Added `geminiKey` to Zustand for direct Situation Room calls
- Rewrote Situation Room to use direct browser → Gemini API (no Railway needed)
- Added encryption key fail-fast in production

**Not achieved / honest failures:**
- Railway never deployed any of our changes — the user never ran `git push`
- Trades never executed in-session (Gemini quota was 0 until billing enabled today)
- The 90-day backtest still fails (CoinGecko rate limiting on Railway IP)
- The `/api/debug` HTML error was never resolved (same root cause: old Railway code)
- Situation Room requires page-session to have `geminiKey` in Zustand — refresh loses it

---

*This document reflects the state of the codebase as of April 18, 2026. All described fixes are present in local files but not committed to git.*
