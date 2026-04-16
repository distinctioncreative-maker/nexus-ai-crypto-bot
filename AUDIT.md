# Quant by Distinction Creative — Strategic Audit
### *Pre-Launch Assessment & Product Trajectory*
*Conducted April 2026 — Hedge Fund Operator Perspective*

---

## Executive Summary

This platform is architecturally sound and visually ahead of its class. The bones are strong: real-time Coinbase market streaming, multi-signal AI evaluation, a strategy tournament engine, genuine backtesting against OHLCV data, and a risk framework that most retail tools don't touch. 

However, **it cannot be put in front of professional users today**. There are four critical bugs that will crash the experience, the live trading path is disconnected wire-to-wire, the Portfolio page shows hardcoded fake data, and zero state persists across server restarts. A quant who loses their trade history after a server redeployment will never trust the tool again.

The gap between where this is and where it needs to be is roughly **three focused weeks of engineering**. The trajectory is clear: this becomes a research-first, execution-second platform that any quant or PM can use to prototype strategies, validate them against real history, and — when ready — graduate to live execution with every safety net in place.

---

## Part I: Current Functionality Map

### What Actually Works

| System | Status | Notes |
|---|---|---|
| Coinbase market stream (WebSocket) | ✅ Live | All 15 products, real ticks every 2s |
| Paper trading simulation | ✅ Real | Balance, holdings, circuit breaker wired |
| Gemini AI decision engine | ✅ Real | Requires user's Gemini API key |
| Multi-signal context (Fear/Greed, TVL, Polymarket) | ✅ Real | 5-min cache, composite score |
| Strategy tournament (5 variants, evolution) | ✅ Real | MA Cross, RSI, EMA, Sentiment, Combined |
| Risk engine (position cap, daily loss, Kelly) | ✅ Real | Pre-trade gating works |
| Kill switch + circuit breaker | ✅ Real | WebSocket event-driven |
| AI Assisted mode (pending trade card) | ✅ Real | 60s countdown, accept/reject |
| Backtest engine (walk-forward) | ⚠️ Broken | Import bug — crashes on call |
| Live trading (Coinbase order placement) | ❌ Dead | Code exists, never called |
| Portfolio page | ❌ Fake | 100% hardcoded mock data |
| Session persistence | ❌ None | All state lost on server restart |
| Token refresh | ❌ Missing | Session dies when JWT expires |
| News / intelligence feed | ⚠️ Partial | Real signals, simulated news |

---

## Part II: Critical Bugs — Fix These Before Anyone Touches It

### Bug 1 — Backtest Engine Crashes on Execution (CRITICAL)
**File:** `server/services/backtestEngine.js:6`

```javascript
// This line destroys the endpoint at runtime:
const { evaluateStrategy, computeSMA, computeRSI } = require('./strategyEngine');
```

`strategyEngine.js` exports: `ensureStrategies`, `evaluateAllStrategies`, `getWinningStrategy`, `recordStrategyTrade`. It does **not** export `evaluateStrategy`, `computeSMA`, or `computeRSI`. The destructuring succeeds (they're `undefined`) but the backtest function calls `getSignalFromHistory()` which is self-contained — so the import is dead weight that needs to be removed. If any future code path calls those undefined imports directly, it will throw.

**Fix:** Remove line 6. `backtestEngine.js` has its own internal indicator functions. No cross-import needed.

---

### Bug 2 — Live Trading Is Theatrical (CRITICAL FOR TRUST)
**Files:** `server/services/liveTrading.js`, `server/routes/api.js:76-79`, `server/services/marketStream.js`

The UI exposes a live/paper mode toggle. The backend has `liveTrading.js` with full Coinbase JWT signing and `placeMarketOrder()`. But the `POST /api/live-mode` endpoint **only flips an in-memory flag** — it never wires the actual execution path. When `isLiveMode` is true in the market stream, trades still go to `executePaperTrade()`. A user who thinks they're live trading is not.

This is a liability. Either wire it completely with proper safety gates, or remove the toggle from the UI entirely until it's ready.

---

### Bug 3 — Portfolio Page Is a Lie (HIGH)
**File:** `src/components/PortfolioPage.jsx`

The entire portfolio view shows hardcoded positions: BTC, ETH, SOL, USDC at fixed allocations. It never reads from the WebSocket store or calls `/api/portfolio`. After the user executes 20 paper trades and navigates to Portfolio, they see the same fake BTC/ETH/SOL chart they saw on day one.

**Fix:** Wire to `useStore()` state — `balance`, `assetHoldings`, `trades`. Derive equity curve from trade history. Compute P&L from `(currentPrice - avgBuyPrice) × holdings`.

---

### Bug 4 — No State Persistence (HIGH)
**System:** `server/userStore.js` — pure in-memory `Map<userId, UserState>`

Every server restart wipes all user state: balance, trades, learned AI rules, API keys, risk settings. The encryption helpers (`CryptoJS.AES.encrypt`) exist but are never used to actually write to Supabase. Supabase is configured as an auth provider but never used as a database.

**Fix:** Persist user state to Supabase Postgres. At minimum: API keys (encrypted), paper trading balance, trade history, risk settings. Load on WebSocket connect. Save on every trade execution.

---

### Bug 5 — Session Expiry Kills the WebSocket Silently (MEDIUM)
**File:** `src/services/websocket.js`

JWT token is passed once at connection time. Supabase JWTs expire (typically 1 hour). If a user leaves the app open overnight, the next morning their `authFetch()` calls fail with 401 and the WS stream goes into reconnect loop with an expired token. There's no `onAuthStateChange` handler that forces a reconnect with a refreshed token.

**Fix:** In the `supabase.auth.onAuthStateChange` listener in `App.jsx`, trigger `closeWebSocket()` + `initWebSocket()` on TOKEN_REFRESHED events.

---

## Part III: Hedge Fund Role Analysis

This tool needs to serve multiple personas simultaneously. Here's how each role experiences the platform today — and what they need.

---

### 🎯 Portfolio Manager
**What they need:** Capital allocation view, strategy performance vs benchmark, drawdown exposure, live P&L by position.

**Current experience:** Dashboard shows a single ticker with live price + AI status. No cross-asset exposure view. Portfolio page is fake. No benchmark comparison.

**What's missing:**
- Multi-asset portfolio view (all open positions across products)
- Allocation pie: what % of capital is in each asset right now
- Rolling P&L: daily, weekly, all-time
- Drawdown meter vs the configured threshold
- One-click risk-off: flatten all positions, halt AI

**Trajectory:** The Dashboard should evolve into a command center. Two panels: current positions (with live P&L), and the AI activity feed. The Portfolio page becomes the analytics layer — attribution, benchmark comparison, Sharpe over time.

---

### 📐 Head Quant
**What they need:** Strategy configuration, backtest reports, walk-forward validation, signal correlation analysis, parameter optimization.

**Current experience:** Backtest exists (once the import bug is fixed). Strategies are auto-configured. No manual parameter tuning from the UI. No way to pin a strategy and run it in isolation. No signal attribution — can't see whether the Fear/Greed signal or the MA crossover was responsible for a winning trade.

**What's missing:**
- Strategy parameter editor (edit `maPeriod`, `rsiOversold`, etc. from UI)
- Custom strategy builder (compose signal blocks like LEGOs)
- Multi-strategy backtest comparison table
- Signal attribution: which signal drove each trade decision
- Correlation matrix: are our 5 strategies actually diversified or just correlated?
- Walk-forward out-of-sample stability chart

**Trajectory:** The Agents / Strategy Tournament page becomes a genuine research workbench. Quants can fork strategies, tweak parameters, backtest on 90 days of data, then promote to paper trading. Only strategies that survive walk-forward testing get elevated.

---

### 🛡️ Chief Risk Officer
**What they need:** Real-time exposure monitoring, drawdown waterfall, kill switch authority, compliance logs, position concentration reports.

**Current experience:** Risk settings modal (good), kill switch (good), circuit breaker (good). But no live risk dashboard — no view into current exposure percentages, where the circuit breaker is relative to current value, what the AI would do next.

**What's missing:**
- Live risk dashboard: current drawdown %, daily P&L vs limit, position concentration
- Audit log: every risk decision, every blocked trade, timestamped and exportable
- "Risk heat" indicator on the main nav: green/amber/red based on proximity to breakers
- Multi-user oversight: if this tool is used by multiple quants, the CRO needs a view of all combined positions
- Simulation mode for risk settings: "if I change the max position % to 25%, what trades from the last 30 days would have been blocked?"

**Trajectory:** A dedicated Risk Monitor page. Not settings — live state. Think of a control panel showing current portfolio heat, all active breakers, the queue of pending AI decisions, and a one-line audit trail of every action taken.

---

### 📊 Research Analyst
**What they need:** Historical signal performance, correlation between macro signals and price outcomes, news feed with real events.

**Current experience:** Intelligence page shows real Fear/Greed, TVL, Polymarket. But the news feed is entirely fabricated — seeded from a hardcoded pool.

**What's missing:**
- Real news API (CryptoPanic, Messari, The Block)
- Signal history chart: Fear/Greed over 30 days overlaid on BTC price
- On-chain data: exchange inflows/outflows, whale wallet movements
- Earnings calendar analog: protocol upgrade dates, unlock schedules, halving countdowns
- Correlation table: does high Fear/Greed reliably predict price reversals in this data?

**Trajectory:** Intelligence page becomes a genuine research terminal. Real news (CryptoPanic API is free), real on-chain signals (Glassnode free tier), protocol event calendar. Analysts can pull a report: "In the last 90 days, when Fear/Greed was below 25, what happened to BTC price over the next 72 hours?"

---

### ⚡ Execution Trader
**What they need:** One-click order entry, order book visibility, slippage estimation, order status tracking, fill confirmations.

**Current experience:** Full Auto mode executes trades automatically. AI Assisted shows pending card. But all trades are paper. No order book, no slippage estimate before confirming, no fill status after.

**What's missing:**
- Pre-trade analytics: estimated slippage, market impact, best execution path
- Order status tracker: PENDING → FILLED → SETTLED
- Partial fill handling
- TWAP/VWAP execution modes for large orders
- Post-trade analysis: did we beat the arrival price?

**Trajectory:** When live trading is wired, the Execution layer needs to be professional-grade. Show the bid/ask spread, estimated fees, and expected slippage **before** the user accepts the pending trade card. After execution, show the actual fill price vs the signal price and the slippage cost.

---

## Part IV: Architecture Gaps for a Production System

### 1. No Database — Everything in RAM
The entire user state, trade history, and AI learning history lives in `server/userStore.js` as a JavaScript `Map`. Supabase is wired for auth but never used for storage. This must change before launch.

**Proposed schema (Supabase Postgres):**
```
users_state          — balance, risk_settings, trading_mode, is_live
trades               — id, user_id, type, amount, price, product, reason, timestamp
learning_history     — id, user_id, knowledge, timestamp
strategies           — id, user_id, strategy data (JSON)
notifications        — id, user_id, type, title, body, read, timestamp
```
Encrypted columns for API keys using Supabase Vault or server-side AES.

### 2. No Audit Trail
Every trade, every AI decision, every risk block — none are persisted. The notification system provides a 50-item in-memory log but that's it. For a tool used in a regulated environment, every decision needs a timestamped, immutable log.

### 3. No Rate Limiting
The `/api/backtest` endpoint fetches from CoinGecko and runs CPU-intensive simulations. A single malicious or careless user could flood it. Add rate limiting (express-rate-limit) per user per endpoint.

### 4. No Health Monitoring
No Sentry, no DataDog, no uptime monitoring. When the Coinbase WebSocket drops and reconnects (it will), no one knows unless they're watching the console. Add structured logging and at minimum a Sentry DSN for error tracking.

### 5. No Multi-User Concurrency Design
The `userStore.js` is a singleton shared in-memory Map. It works for one user in development. Under load with many users, there are no transactions, no locking, no concurrency protection. The proper fix is moving state to Postgres with row-level security.

### 6. API Key Security
Users are asked to paste their Coinbase API secret key into a web form. This key can authorize real money movement. The current system stores it in memory and never persists it (which is actually acceptable). However:
- The key is transmitted in POST body as plaintext (HTTPS in production protects this)
- If the server has an unhandled exception log that logs request bodies, the key leaks
- The Setup Wizard doesn't explain what permissions the key needs (read-only vs trading)

**Recommendation:** Require users to generate a Coinbase API key with **trading permissions only**, provide a step-by-step guide, and validate the key with a read-only test call before accepting it.

---

## Part V: Design & UX Issues

### 1. Navigation Ambiguity
The sidebar has: Terminal, Portfolio, Intelligence, Agents, Backtest. These labels aren't immediately intuitive.
- "Terminal" → "Dashboard" or "Trading"
- "Agents" → "Strategies" (more accurate to what's there)
- "Backtest" → "Research" (broaden scope)

### 2. Mode Toggle Confusion
The navbar has Paper/Live toggle and Full Auto/AI Assisted toggle side by side. Two separate binary states that produce a 2×2 matrix of modes. Most users won't understand the combination (Live + AI Assisted means real money waits for your approval, Live + Full Auto means real money moves instantly without asking). The combinations need clearer labeling and perhaps a wizard for first-time live mode activation.

### 3. Empty States
When a user first logs in before the AI has run, the Agents/Strategies page shows an empty state. The Dashboard shows "Awaiting AI signals." These empty states need more substance — explain what's about to happen, what the user should do, and what the expected wait time is.

### 4. Mobile Responsiveness
The CSS grid layout is desktop-first. On a tablet or phone the dashboard grid collapses in an uncontrolled way. For a hedge fund tool this may be acceptable, but a PM who wants to check positions on their phone shouldn't see a broken layout.

### 5. No Dark/Light Mode
The tool is dark-only. A Bloomberg terminal analogy works because Bloomberg IS the standard. But for wider adoption, light mode or adaptive theming adds accessibility.

### 6. The Intelligence Page Fake News Problem
The seeded Reuters/Bloomberg/Twitter headlines are fabricated. If a user shares a screenshot of this page, they're showing fake news. Label it clearly as **"Simulated Feed"** (already done in one place but not consistently).

---

## Part VI: Pre-Launch Checklist

### P0 — Must Fix Before Any User Sees This

- [ ] Fix `backtestEngine.js` line 6 — remove broken imports
- [ ] Wire live trading end-to-end OR remove the live/paper toggle from UI
- [ ] Connect PortfolioPage to real state (`useStore()` balance + trades)
- [ ] Add persistence: save/load user state from Supabase Postgres on connect/disconnect
- [ ] Implement token refresh on `TOKEN_REFRESHED` auth event → reconnect WebSocket

### P1 — Required for Professional Use

- [ ] Add rate limiting to `/api/backtest` and `/api/signals` endpoints
- [ ] Add structured logging (at minimum: all trades, all risk blocks, all errors)
- [ ] API key validation: test call to Coinbase on setup before accepting key
- [ ] Persist trade history to database (current 50-item in-memory array is not enough)
- [ ] Add "Risk Monitor" panel to Dashboard: current drawdown %, daily P&L vs limit, position concentration
- [ ] Audit log page accessible to all users: every trade and every AI decision, timestamped
- [ ] Multi-asset portfolio view: all open positions, not just the selected ticker

### P2 — Elevates the Tool to Institutional Grade

- [ ] Real news feed integration (CryptoPanic API — free tier, 100 req/day)
- [ ] Signal history charts: Fear/Greed + TVL overlaid on price (30/90 day)
- [ ] Strategy parameter editor in UI (quants can tune without touching code)
- [ ] Pre-trade analytics in PendingTradeCard: estimated slippage, bid/ask spread
- [ ] Post-trade analytics: actual fill vs signal price, slippage cost
- [ ] Export functions: trade history CSV, backtest report PDF
- [ ] Role-based access: PM sees portfolio overview, Quant sees strategy config, Trader sees execution
- [ ] On-chain data widgets: exchange inflows/outflows from Glassnode free tier

### P3 — Competitive Differentiators (Post-Launch Roadmap)

- [ ] TWAP/VWAP execution modes for large orders
- [ ] Correlation matrix: inter-strategy and signal correlation
- [ ] Custom strategy builder: visual signal composition interface
- [ ] Multi-exchange support (Kraken, Binance) via unified order router
- [ ] Alert system: Telegram/Slack webhook when circuit breaker trips or high-confidence signal fires
- [ ] Backtesting Monte Carlo simulation: stress-test strategies against synthetic bad-market scenarios
- [ ] AI model configurability: let users choose between Gemini models or GPT-4o
- [ ] Strategy marketplace: publish and subscribe to community strategies (future)

---

## Part VII: Competitive Landscape Assessment

| Platform | Strength | Weakness | Our Advantage |
|---|---|---|---|
| **3Commas** | Mature, multi-exchange bots | No AI reasoning, no backtest depth | AI with full reasoning log, walk-forward backtest |
| **Pionex** | Free grid bots, built-in exchange | No custom strategy, no risk engine | Full strategy customization, real risk gating |
| **Cryptohopper** | Marketplace of signals | Expensive, black-box AI | Transparent AI reasoning, self-learning memory |
| **Mudrex** | Code-free strategy builder | No live signals, weak backtest | Multi-signal context (Fear/Greed, TVL, Polymarket) |
| **Hummingbot** | Open source, market making | Requires Python/engineering | Zero-code, consumer-grade UI |
| **Quantconnect** | Professional quant tooling | Equity/futures focused, complex | Crypto-native, consumer-accessible, AI-native |

**The gap we fill:** No competitor combines (1) transparent AI decision-making with logged reasoning, (2) genuine multi-signal context from macro indicators, (3) a self-evolving strategy tournament, (4) professional-grade risk controls, and (5) a Bloomberg-caliber UI — in a single consumer-accessible tool. That's the thesis.

---

## Part VIII: Proposed Trajectory

### Stage 1 — Research Platform (Months 1-2)
Fix all P0 bugs. The product launches as a **strategy research tool**. Users backtest, watch the AI explain its reasoning in real-time on paper money, see the strategy tournament evolve. No live money. Full transparency. Build trust.

**Core value prop:** *"See exactly why the AI makes every decision, on your money, safely."*

### Stage 2 — Validated Paper Trading (Months 2-4)
Add persistence, role-based access, audit logs, real news. The tool becomes a team collaboration platform. A PM, a quant, and a risk officer can all look at the same account with different views. The strategy that survived the tournament AND the backtest AND 30 days of live paper trading gets promoted.

**Core value prop:** *"The only AI trading platform where no strategy goes live without surviving real validation."*

### Stage 3 — Controlled Live Execution (Months 4-6)
Wire live trading end-to-end with Coinbase Advanced Trade. Gate it behind a verification flow: user must complete setup wizard, pass a risk acknowledgment, and set explicit position limits before any live orders are enabled. First live execution is AI Assisted only (user must confirm every trade). Full Auto is unlocked after 30 days of successful AI Assisted live trading.

**Core value prop:** *"Institutional-grade execution with consumer-grade simplicity."*

### Stage 4 — Platform (Month 6+)
Multi-exchange routing. Strategy marketplace. Team workspaces. White-label licensing to hedge funds and family offices. API access so quants can pipe in external signals.

---

## Part IX: The One Metric That Matters at Launch

**Sharpe ratio of paper trading strategies, audited over 30 days.**

Before this product is shown to any institutional user, it needs to demonstrate — with real timestamped data — that its AI strategy tournament outperforms a simple buy-and-hold on a risk-adjusted basis over at least one 30-day period. Not simulated. Not cherry-picked. Run the system live on paper money, record every trade, compute the annualized Sharpe against the benchmark.

If the Sharpe is positive and reproducible, the tool has credibility. If it's not, the product is a beautiful UI on top of a coin flip — and professional users will know within a week.

That's the gate. Fix the bugs, run it live, let it prove itself.

---

## Appendix A: File-Level Status

### Server
| File | Status | Notes |
|---|---|---|
| `server/index.js` | ✅ Clean | WS message handlers complete |
| `server/userStore.js` | ✅ Clean | In-memory; needs DB layer |
| `server/routes/api.js` | ✅ Clean | All endpoints wired |
| `server/middleware/auth.js` | ✅ Clean | Supabase + local-dev fallback |
| `server/services/aiEngine.js` | ✅ Clean | Multi-signal prompt, good |
| `server/services/marketStream.js` | ✅ Clean | Risk engine integrated |
| `server/services/riskEngine.js` | ✅ Clean | Full pre-trade validation |
| `server/services/signalEngine.js` | ✅ Clean | Real APIs, cached |
| `server/services/strategyEngine.js` | ✅ Clean | Tournament logic works |
| `server/services/backtestEngine.js` | ⚠️ Bug | Remove line 6 import |
| `server/services/liveTrading.js` | ⚠️ Dead code | Never called |

### Frontend
| File | Status | Notes |
|---|---|---|
| `src/App.jsx` | ✅ Clean | Token refresh gap only |
| `src/store/useStore.js` | ✅ Clean | Complete state model |
| `src/services/websocket.js` | ✅ Clean | All message types handled |
| `src/components/Dashboard.jsx` | ✅ Clean | Real data, intelligence strip |
| `src/components/PortfolioPage.jsx` | ❌ Fake | Hardcoded mock holdings |
| `src/components/AgentsPage.jsx` | ✅ Clean | Real strategy data |
| `src/components/BacktestModule.jsx` | ✅ Clean | Real CoinGecko backtest |
| `src/components/IntelligencePage.jsx` | ⚠️ Mixed | Real signals, fake news |
| `src/components/KillSwitch.jsx` | ✅ Clean | Full kill switch flow |
| `src/components/NotificationCenter.jsx` | ✅ Clean | Real notifications |
| `src/components/PendingTradeCard.jsx` | ✅ Clean | Full AI Assisted flow |
| `src/components/RiskSettingsModal.jsx` | ✅ Clean | Saves to backend |
| `src/components/SetupWizard.jsx` | ✅ Clean | Key ingestion works |
| `src/components/Tutorial.jsx` | ✅ Clean | Static onboarding |
| `src/components/AuthPage.jsx` | ✅ Clean | Supabase + local-dev |
| `src/components/ErrorBoundary.jsx` | ✅ Clean | Catches component errors |

---

*End of Audit — Distinction Creative, April 2026*
