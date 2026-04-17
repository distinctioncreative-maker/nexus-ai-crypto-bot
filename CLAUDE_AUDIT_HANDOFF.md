# Claude Audit Handoff - Crypto AI Bot

Last updated: April 17, 2026 (Claude Code follow-on pass)

## Executive Summary

Codex completed the requested full audit-and-repair pass inside `crypto-ai-bot`. The app now has an explicit execution engine state, a five-agent shadow-portfolio tournament, cleaner paper/live gating, persisted engine settings, broader Coinbase USD product discovery, and a clean lint/build baseline.

The safest current product posture is:

- Market data can stream continuously.
- Strategy agents can keep learning in shadow portfolios.
- User portfolio execution is controlled by `STOPPED`, `PAPER_RUNNING`, or `LIVE_RUNNING`.
- Live trading is AI Assisted only in this release. Full Auto live execution is intentionally blocked.

## Folder Scan Summary

Important app surfaces reviewed:

- `README.md`, `PROJECT_HANDOFF.md`, `AUDIT.md` for product objectives and prior known risks.
- `server/index.js`, `server/routes/api.js`, `server/userStore.js`, `server/db/persistence.js` for auth, persistence, WebSocket, and user state.
- `server/services/*` for market streaming, live trading, strategy agents, risk, signals, AI, and backtesting.
- `src/App.jsx`, `src/services/websocket.js`, `src/store/useStore.js`, `src/components/*` for frontend state, dashboard, portfolio, agents, risk, pending trades, live modal, and intelligence.
- `supabase/migrations/*` for user settings, trades, learning history, strategy state, snapshots, and engine status.

Generated/vendor folders excluded from audit: `node_modules`, `dist`, `.git`, and Supabase CLI cache.

## Implemented Changes

### Execution Engine

- Added canonical per-user engine states:
  - `STOPPED`: ticks and agent learning may continue, but no user portfolio orders execute.
  - `PAPER_RUNNING`: paper execution can run in Full Auto or AI Assisted mode.
  - `LIVE_RUNNING`: live Coinbase execution is allowed only through AI Assisted confirmation.
- Added `POST /api/engine` and extended `GET /api/status` with `engineStatus`, `tradingMode`, `isLiveMode`, `selectedProduct`, `riskSettings`, and `persistedStateReady`.
- Kept `POST /api/live-mode` as a compatibility wrapper around the new engine state.
- WebSocket now broadcasts `ENGINE_STATE` and accepts `SET_ENGINE_STATUS`.
- Frontend now shows explicit `STOPPED`, `PAPER`, and `LIVE` controls instead of a loose paper/live toggle.

### Five-Agent Strategy Tournament

- Reworked `server/services/strategyEngine.js` around exactly five base agents:
  - Momentum MA Cross
  - Mean Reversion RSI
  - Trend Following EMA
  - Sentiment Driven
  - Combined Signal
- Each agent now maintains a shadow portfolio per selected product with cash, holdings, entry price, equity, realized P&L, trades, closed trades, win/loss count, Sharpe-like score, max drawdown, generation, and lessons.
- Every AI evaluation lets all five agents vote and update their own hypothetical trade state.
- Consensus is weighted by performance, win rate, and equity improvement.
- Every 20 closed shadow trades, the top two agents stay active and underperforming agents mutate parameters in place. No extra agents are spawned, preserving the requested five-agent shape.
- Agent state persists through the existing `strategies` table and tournament snapshots continue writing to `agent_snapshots`.

### Paper And Live Trade Safety

- REST and WebSocket pending-trade confirmation paths now share the same safety assumptions:
  - `STOPPED` rejects execution.
  - `PAPER_RUNNING` executes paper trades.
  - `LIVE_RUNNING` routes to Coinbase live order placement only after user confirmation.
- Live Full Auto is blocked. If live mode is activated, backend coerces trading mode to `AI_ASSISTED`.
- Stop-loss and take-profit triggers respect engine state:
  - Stopped engine: no execution.
  - Paper engine: paper sell.
  - Live engine: creates a pending live confirmation instead of auto-placing a real order.
- Kill switch remains a hard halt and can cancel live open orders when Coinbase keys are present.

### Coinbase Product Coverage

- Added `server/services/productCatalog.js`.
- `/api/products` now tries Coinbase brokerage products, then falls through to Coinbase Exchange public products, then falls back to the static list.
- Local smoke confirmed the public catalog returned 385 USD spot products and included `BONK-USD`.
- WebSocket product changes validate against the catalog before subscribing.
- Dynamic subscription smoke confirmed `BCH-USD`, which is outside the old static list, produced a live tick.
- Backtesting remains limited to mapped CoinGecko assets and now returns a clear historical-data-unavailable error for unmapped assets.

### Live Coinbase Auth

- Added backend dependency `@coinbase/cdp-sdk`.
- `server/services/liveTrading.js` now prefers `@coinbase/cdp-sdk/auth.generateJwt`, matching Coinbase’s current JWT guidance.
- Legacy ES256 PEM fallback remains only for older keys.
- Ed25519 keys now fail clearly if the SDK is unavailable instead of silently using the wrong signing algorithm.
- Market buys use `quote_size` derived from requested base amount and reference price. Sells use `base_size`.
- Live order response handling now checks the fetched order status and does not mark `success: true` as automatically filled.
- No secrets are printed in audit output.

### Persistence

- Added `engine_status` to `user_settings`.
- Added migration: `supabase/migrations/20260417010000_add_engine_status.sql`.
- Updated the original create-table migration so fresh environments include `engine_status`.
- `GET /api/status` hydrates persisted Supabase state before deciding whether the user is configured.

### Frontend Fixes

- Fixed the Backtest page runtime bug by importing `useEffect`.
- Fixed React purity lint issues in Intelligence and Portfolio.
- Synced backend engine/live/trading state into Zustand from `/api/status`, `PORTFOLIO_STATE`, and `ENGINE_STATE`.
- Updated live-mode modal copy so it no longer claims Full Auto live execution.
- Updated setup copy to reflect encrypted backend persistence instead of RAM-only key storage.
- Cleaned lint blockers across Dashboard, Agents, KillSwitch, Signal Engine, and backend catches.

### Claude Code Follow-on Pass (April 17, 2026)

- **AgentsPage complete rewrite** — removed all dead code (`MOCK_AGENTS`, `AgentCard`, `generateSparkline`). New design surfaces real shadow portfolio data per agent: equity vs. $100k baseline, equity gain %, position (LONG/FLAT), wins/losses, Sharpe, drawdown, and up to 3 agent-learned lessons. Equity sparkline built from actual `closedTrades` array. Empty state shows for agents with no trades yet.
- **Agent Consensus bar** — new `ConsensusBar` component at the top of AgentsPage shows real-time vote breakdown (BUY/HOLD/SELL counts with proportional bar) computed from each strategy's `lastSignal`. Also shows full debate string (each agent's current signal).
- **Engine control UX** — added `.mode-pill.stopped` CSS class (amber/orange) so STOPPED, PAPER, and LIVE each have visually distinct active states. Previously STOPPED (active) and LIVE (active) both used the same red class, making them indistinguishable. Tooltips updated to be descriptive.
- **LIVE button fixed** — was keyed to `isLiveMode` bool which could lag state; now uses `engineStatus === 'LIVE_RUNNING'` directly for consistent active-state highlighting.

## Verification Results

Static checks:

- `npm run lint` - pass.
- `npm run build` - pass. Existing warning remains: main JS chunk is larger than 500 kB.
- `node -c server/index.js` - pass.
- `node -c server/routes/api.js` - pass.
- `node -c server/services/marketStream.js` - pass.
- `node -c server/services/liveTrading.js` - pass.
- `node -c server/services/strategyEngine.js` - pass.

Local smoke checks:

- Backend started on `127.0.0.1:3012` with Supabase env blanked for local-dev fallback.
- `GET /api/health` returned 200 JSON.
- `GET /api/status` returned local user state with `engineStatus: "STOPPED"`.
- `GET /api/products` returned 385 USD spot products through the public Coinbase catalog fallback.
- `GET /api/backtest?productId=BTC-USD&days=7&strategy=COMBINED` succeeded with 42 candles.
- `GET /api/backtest?productId=BONK-USD&days=7&strategy=COMBINED` returned the expected historical-data-unavailable error.
- WebSocket smoke for `BTC-USD` received `PORTFOLIO_STATE`, `ENGINE_STATE`, and `TICK`.
- WebSocket smoke for dynamic non-static product `BCH-USD` received a live `TICK:BCH-USD`.
- `POST /api/engine` accepted `PAPER_RUNNING`.
- `POST /api/engine` rejected `LIVE_RUNNING` when Coinbase keys were missing.

Dependency note:

- `@coinbase/cdp-sdk` is declared in `server/package.json` and installed locally.
- `npm install` reported 2 moderate vulnerabilities in backend dependencies. No `npm audit fix --force` was run because that can introduce breaking changes.

## Remaining Risks And Next Tasks

- Live Coinbase order placement is safer but still needs a real sandbox/small-size manual verification with the exact Coinbase key type before trusting production money.
- Supabase persistence is still minimal. API keys are encrypted with app-level AES, but production should move toward a hardened key vault/envelope encryption model.
- Agent shadow portfolios now learn and compete, but they use simple fixed 10% shadow sizing. A later pass should let risk settings or agent-specific sizing policies drive shadow trades.
- Backtesting still covers only mapped CoinGecko assets. A future data provider is needed for all Coinbase instruments.
- The frontend bundle remains large. Route-level code splitting is still recommended.
- Protected route smoke with real Supabase JWT was not run locally because local smoke intentionally blanked Supabase env to test dev fallback without exposing tokens.

## Claude Notes

Please preserve these current guarantees in future edits:

- Live mode must remain AI Assisted only until explicitly re-approved.
- `STOPPED` must never place user portfolio orders.
- Agents may learn while stopped, but user portfolio execution must not occur while stopped.
- Strategy tournament must remain five primary agents unless the product direction changes.
- Do not log Coinbase, Gemini, Supabase service-role, or encryption secrets.
