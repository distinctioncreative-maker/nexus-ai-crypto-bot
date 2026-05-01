# YC Full Audit & Execution Plan
## Quant — AI Crypto Trading Terminal
**Audited:** 2026-04-30  
**Auditor role:** Senior full-stack engineer, fintech/trading-platform auditor, mobile/PWA UX reviewer, security engineer, YC technical partner  
**Source of truth:** Actual codebase (README ignored)

---

## Part 1 — Current Product Reality

### ✅ Real, Working Functionality
| Feature | Status | Notes |
|---------|--------|-------|
| Paper trading execution | ✅ Real | $100k virtual balance, per-product P&L, fee simulation (0.6% taker + 0.1% slippage) |
| 5-agent algorithmic consensus | ✅ Real | Atlas/Vera/Rex/Luna/Nova compute independent signals each tick |
| Groq AI synthesis | ✅ Real | llama-3.3-70b-versatile, 15s cooldown, strong-consensus bypass |
| Market data stream | ✅ Real | Coinbase public WS, 25 products, real-time OHLCV candles |
| Fear & Greed / TVL / Polymarket signals | ✅ Real | External APIs, cached |
| Oracle chat (Situation Room) | ✅ Real | Multi-agent Q&A, localStorage persistence |
| Supabase auth (JWT) | ✅ Real | Sessions, per-user isolation |
| Portfolio persistence | ✅ Real | saveTradeState fires after every trade |
| Kill switch | ✅ Real | Stops eval loop, cancels live orders |
| Risk settings (SL/TP/Kelly/trailing stop) | ✅ Real | SmartTrade multi-TP wired |
| Shadow portfolio tournament | ✅ Real | Agents compete on Sharpe, loser mutates parameters |
| PWA / Add to Home Screen | ✅ Real | Manifest, icons, standalone mode |
| Mobile bottom nav | ✅ Real | 900px breakpoint, touch targets |

### ⚠️ Partially Wired
| Feature | Gap |
|---------|-----|
| Live Coinbase execution | Wired for AI_ASSISTED only; FULL_AUTO blocked correctly. JWT key handling works but weak encryption (CryptoJS no IV). |
| Backtest | Works for 7/30 days; 90-day breaks on CoinGecko rate limits |
| Agent snapshots DB table | Written in migrations but never surfaced in UI |
| learning_history DB table | Written and read, but lessons not displayed in agents page |
| WS reconnect state sync | No FULL_STATE_SYNC message on reconnect; UI can go stale |

### ❌ UI-Only / Weak
| Feature | Issue |
|---------|-------|
| Watchlist on mobile | Hidden on small screens, no alternative entry point |
| Chart tooltip boundary | Can overflow viewport on mobile |
| Session expiry warning | JWT is 1 hour; no proactive warning |

### 🟡 Paper-Trading Ready
App is solid for paper trading simulation with realistic fee/slippage model.

### 🟡 Live-Assisted Internal Testing Ready
AI-Assisted + Coinbase execution path is wired. Needs key permission guidance, better preflight error UX, and stronger encryption before broad user exposure.

### 🔴 Not Real-Money-User Ready
- CryptoJS AES without IV for key encryption
- No withdrawal-permission warning in setup
- No rate-limit safeguards on live order bursts
- Full audit trail incomplete

### 🔵 Future Mobile/PWA Ready
PWA infrastructure in place. React Native–friendly state shape.

### 🔵 Future Multi-Exchange Ready
Exchange logic isolated in `liveTrading.js`. Adapter pattern needed but not blocking.

---

## Part 2 — Architecture Map

### Frontend
```
React 19 + Vite 8
├── src/App.jsx           — auth gate, WS init, routing
├── src/store/useStore.js — Zustand; balance, trades, prices, engine state
├── src/services/websocket.js — WS client, message dispatch
├── src/lib/supabase.js   — authFetch (10s timeout), getAccessToken
├── src/lib/api.js        — apiUrl, wsUrl, readApiResponse
└── src/components/
    ├── Dashboard.jsx     — chart, hero balance, engine control, watchlist
    ├── PortfolioPage.jsx — equity curve, positions table, trade history, Reset button
    ├── AgentsPage.jsx    — 5 agent cards, signals, Sharpe
    ├── IntelligencePage.jsx — Fear&Greed, TVL, news, Polymarket
    ├── SituationRoom.jsx — Oracle chat
    ├── BacktestModule.jsx— backtest form + results
    ├── RiskSettingsModal.jsx — 3-tab risk settings
    ├── PendingTradeCard.jsx — AI_ASSISTED confirmation card
    ├── LiveModeConfirmModal.jsx — live mode checklist
    ├── KillSwitch.jsx    — kill switch button + ACK
    ├── EngineControl.jsx — START/STOP, PAPER/LIVE pills
    ├── NotificationCenter.jsx — toast feed
    └── SetupWizard.jsx   — first-run wizard (no Coinbase keys required)
```

### Backend (Railway, Node.js)
```
server/index.js           — Express app, WS server, per-user stream lifecycle
server/routes/api.js      — REST endpoints
server/middleware/auth.js — Supabase JWT middleware
server/userStore.js       — per-user in-memory state
server/db/persistence.js  — Supabase R/W, auto-heal corruption
server/services/
├── marketStream.js       — Coinbase public WS, candle builder, eval loop
├── aiEngine.js           — Groq/Ollama calls, concurrency limiter, Oracle
├── strategyEngine.js     — 5 agent algorithms, tournament, shadow portfolios
├── signalEngine.js       — Fear&Greed, TVL, Polymarket, news RSS/Reddit
├── positionManager.js    — SmartTrade multi-TP + trailing stop
├── backtestEngine.js     — CoinGecko OHLCV + walk-forward simulation
├── liveTrading.js        — Coinbase CDP JWT, placeMarketOrder, cancelAllOrders
└── productCatalog.js     — Live product catalog, isSupportedProduct, 1h cache
```

### WebSocket Message Types
**Server → Client:** `ENGINE_STATE`, `TICK`, `HOLDINGS_PRICES`, `CANDLE_HISTORY`, `TRADE_EXEC`, `PENDING_TRADE`, `STRATEGY_UPDATE`, `AI_STATUS`, `SITUATION_ROOM_AGENT`, `SITUATION_ROOM_DONE`, `NOTIFICATION`, `KILL_SWITCH_ALERT`, `KILL_SWITCH_ACK`, `PORTFOLIO_STATE`, `SERVER_LOG`  
**Client → Server:** `SET_ENGINE_STATUS`, `CHANGE_PRODUCT`, `SET_WATCHLIST`, `SET_TRADING_MODE`, `KILL_SWITCH`, `CONFIRM_TRADE`, `SITUATION_ROOM_QUERY`, `APPROVE_LIVE_MODE`

### Supabase Schema
- `user_settings` — balance, holdings, keys (encrypted), engine state, risk settings
- `paper_trades` — individual trade records
- `learning_history` — agent lesson strings
- `strategies` — serialized strategy state
- `agent_snapshots` — exists in DB, not used in UI

---

## Part 3 — P0 Findings (Confirmed)

### P0-A: CRITICAL — Hardcoded Credentials in test-e2e.cjs
**File:** `test-e2e.cjs` lines 3–6  
**Finding:** Real email (`mattcoreloops@gmail.com`) and plain-text password (`Marcano2005$`) committed to a public GitHub repository. Also points to the old (dead) Railway URL.  
**Impact:** Credentials compromised. Anyone with repo access can log in as this user.  
**Fix:** Replace with env vars `E2E_APP_URL`, `E2E_BACKEND_URL`, `E2E_EMAIL`, `E2E_PASSWORD`. Add guard that exits if vars are missing. Never log password.  
**Action required:** Rotate `mattcoreloops@gmail.com` password IMMEDIATELY after this fix is committed.

### P0-B: WebSocket Auth Bypass
**File:** `server/index.js` lines 72–87  
**Finding:** `if (supabase && requestUrl.searchParams.has('token'))` — if Supabase IS configured but the client connects WITHOUT a token, the block is skipped and `userId = 'local-dev-user'` is used. Any unauthenticated client gets full access to production WS as `local-dev-user`.  
**Fix:** When `supabase` is configured, REQUIRE a token. Close with 4001 if missing. Only allow `local-dev-user` when supabase is null AND `NODE_ENV !== 'production'`.

### P0-C: `now` Used Before Declaration — ReferenceError When Kill Switch Active
**File:** `server/services/marketStream.js` lines 448, 457  
**Finding:** `const now = Date.now()` is declared at line 492 but used at lines 448 and 457 inside the `if (user.killSwitch || user.circuitBreaker.tripped)` block. JavaScript `const` is in the temporal dead zone until its declaration — accessing it throws `ReferenceError`. The kill switch alert throttle (`if (now - lastKillAlertTime > 60000)`) is completely broken. The interval crashes with an uncaught error whenever the kill switch is active.  
**Fix:** Move `const now = Date.now()` to line 392, immediately after the `if (data.price <= 0) return;` guard.

### P0-D: Debug Route (Previously Fixed — Verified)
**File:** `server/routes/api.js`  
**Status:** Already protected with `authenticate` middleware from a prior session. ✅ No further action.

### P0-E: WebSocket Malformed Message Handling
**File:** `server/index.js` WS message handler  
**Finding:** `ws.on('message', async (raw) => { try { const msg = JSON.parse(raw); ... } catch {} })` — errors are silently swallowed. No validation of `msg.type`. No safe error response to client.  
**Fix:** Log a safe (non-sensitive) warning on parse error. Add basic `msg.type` string validation before processing. Send `{type:'ERROR', payload:{message:'Malformed message'}}` to client on bad input.

### P0-F: Paper/Live Separation (Verified OK)
**Status:** FULL_AUTO live trading is correctly blocked in `setTradingMode()` and `setEngineStatus()`. Live mode always forces `AI_ASSISTED`. Pending trade confirmation is required before any Coinbase order executes. ✅ No change needed.

---

## Part 4 — P1 Functionality Issues

| # | Issue | File | Priority |
|---|-------|------|----------|
| P1-1 | WS reconnect: no state resync after reconnect | websocket.js, index.js | High |
| P1-2 | Duplicate WS connection prevention | websocket.js | High |
| P1-3 | Missing GROQ_MODEL in server/.env.example | server/.env.example | Medium |
| P1-4 | Wrong MARKET_WS_URL in server/.env.example | server/.env.example | Medium |
| P1-5 | E2E test references dead Railway URL | test-e2e.cjs | Medium (fixed in P0-A) |
| P1-6 | Compliance: no "not financial advice" disclaimers | Multiple UI files | Medium |
| P1-7 | Live key permission guidance missing | SetupWizard, LiveModeConfirmModal | Medium |
| P1-8 | liveTrading.js errors logged to console but AI_STATUS msg lacks detail | liveTrading.js | Low |
| P1-9 | productHoldings _lastPrice not set on restore | persistence.js | Low (fixed) |
| P1-10 | agent_snapshots table never used in UI | AgentsPage.jsx | Low |

---

## Part 5 — Mobile/Desktop UX Plan

**Viewports to test:** 1440x900, 1280x800, 768x1024, 390x844, 375x667

**Known issues from previous audits (some already fixed):**
- ✅ Bottom nav touch targets (52px, fixed)
- ✅ Portfolio metrics overlay on mobile (2-col grid, fixed)
- ✅ Agent cards 1-per-row on mobile (fixed)
- ⚠️ Watchlist inaccessible on small mobile — needs sheet/modal
- ⚠️ Chart tooltip viewport overflow — needs boundary check
- ⚠️ More drawer z-index / backdrop on some device sizes

---

## Part 6 — Compliance Language Plan

Required changes:
1. SetupWizard: add "paper trading simulation — not financial advice" disclaimer
2. LiveModeConfirmModal: add Coinbase key permission guidance (trading-only, no withdrawal)
3. Dashboard: label hero balance "Paper Trading Balance (Simulated)"
4. PendingTradeCard: label as "Estimated fill" not "execution"
5. SituationRoom: add "AI-assisted analysis — not financial advice" footer

---

## Part 7 — Security Audit Summary

| Area | Status |
|------|--------|
| Hardcoded credentials in test | ❌ P0-A — fix immediately |
| WS auth bypass | ❌ P0-B — fix immediately |
| Debug route | ✅ Protected |
| CORS | ✅ Origin whitelist enforced |
| Supabase service role | ✅ Server-side only, not exposed to frontend |
| API key encryption | ⚠️ CryptoJS AES without random IV — acceptable for MVP, needs upgrade |
| Log redaction | ✅ No keys logged |
| Production auth guard | ✅ Middleware rejects if Supabase missing |
| Local dev fallback | ⚠️ P0-B fix tightens this |

---

## Part 8 — Test/Stack Audit

| Area | Status |
|------|--------|
| test-e2e.cjs | ❌ Hardcoded credentials, wrong URLs |
| npm run build | ✅ Clean (chunk size warning only) |
| npm run lint | Not configured — no eslint in package.json |
| Backend smoke test | None — add /api/health check to CI |
| Playwright E2E | Works but requires env vars |

---

## Part 9 — Execution Phases

### Phase 1: P0 Safety/Security (Execute now)
- [ ] P0-A: Fix test-e2e.cjs credentials
- [ ] P0-B: Fix WS auth bypass
- [ ] P0-C: Fix `now` before declaration in marketStream.js
- [ ] P0-E: Fix WS malformed message handling

### Phase 2: Backend/WS Wiring
- [ ] server/.env.example: add GROQ_MODEL, fix MARKET_WS_URL
- [ ] WS reconnect: document current behavior, add reconnect toast

### Phase 3: Paper/Live Labeling
- [ ] Compliance disclaimers in SetupWizard, LiveModeConfirmModal
- [ ] Live key permission warning

### Phase 4: Mobile/Desktop UX
- [ ] Playwright audit at all 5 viewports
- [ ] Fix any new issues found

### Phase 5: Compliance Language
- [ ] Not financial advice disclaimers
- [ ] Estimated fill labels

### Phase 6: Tests/Build/Smoke
- [ ] Update .env.example files
- [ ] Verify npm run build clean
- [ ] Document test instructions

### Phase 7: Report
- [ ] Write YC_FULL_AUDIT_EXECUTION_REPORT.md
- [ ] Write CLAUDE_CONTINUATION_PROMPT.md if needed
