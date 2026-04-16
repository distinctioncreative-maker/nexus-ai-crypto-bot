# Crypto AI Bot Project Handoff

Last updated: April 16, 2026

## Executive Summary

Crypto AI Bot is a React/Vite frontend paired with a Node/Express backend for a multiuser crypto trading intelligence app. The current production shape is:

- Frontend: Vercel
- Backend API and WebSocket server: Railway
- Authentication: Supabase Auth
- Market data: Coinbase Advanced Trade public WebSocket ticker for `BTC-USD`
- AI decisions: Gemini via `@google/genai`
- Trading mode today: paper-trading execution in backend memory

The app no longer needs to run on the local machine for normal usage. Local commands remain available only for development.

## Production URLs And Status

- Vercel production frontend: `https://crypto-ai-bot-psi.vercel.app`
- Railway backend API: `https://kalshi-backend-production-b847.up.railway.app`
- Backend health endpoint: `https://kalshi-backend-production-b847.up.railway.app/api/health`
- GitHub repository: `https://github.com/distinctioncreative-maker/nexus-ai-crypto-bot`

Verified on April 16, 2026:

- Vercel production deployment is `READY`.
- Railway latest deployment is `SUCCESS`.
- Railway `/api/health` returns HTTP 200 JSON.
- Railway CORS allows `https://crypto-ai-bot-psi.vercel.app`.
- Vercel production env vars are present for `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- No local dev server was left listening on ports `3001` or `5173` after deployment verification.

## Current Tech Stack

Frontend:

- React 19
- Vite 8
- React Router 7
- Zustand for app state
- Lightweight Charts for live price charting
- Recharts for dashboard-style visualizations
- Framer Motion for UI animation
- Lucide React icons
- Supabase JS client for browser auth

Backend:

- Node.js, pinned to Node 22+ for deployment
- Express 5
- `ws` WebSocket server
- Supabase service-role auth verification
- Coinbase Advanced Trade public WebSocket for ticker data
- Gemini API via `@google/genai`
- In-memory per-user paper trading state
- Railway deployment through `railway.json`

Infrastructure:

- GitHub for source control
- Vercel for static frontend hosting
- Railway for backend process hosting
- Supabase for multiuser identity

## App Architecture

The frontend boots through `src/App.jsx`. If Supabase browser env vars exist, users go through Supabase Auth. If they do not exist, the app falls back to a local development user. Production Vercel now has Supabase env vars configured, so production should not use the local-dev fallback.

Once authenticated, the frontend calls `GET /api/status` on the Railway backend. If the user has configured API keys in the current backend process memory, the app enters the trading terminal and opens a WebSocket to the backend. If not, the user sees the setup wizard.

The setup wizard posts Coinbase and Gemini keys to `POST /api/setup`. The backend stores those keys in a per-user in-memory store. That means keys are cleared when the backend process restarts. This is safer than committing or browser-storing secrets, but it is not yet a durable production key vault.

The backend keeps one shared public Coinbase market data connection. For each connected app user, the backend streams ticks every two seconds. If that user has keys configured and enough price history exists, Gemini evaluates a market signal about every 30 seconds. Non-hold decisions above the confidence threshold execute a paper trade in the per-user backend memory state.

## Important Current Limitations

Live Coinbase order execution is not implemented yet. The UI has a live/paper toggle, and the setup form asks for Coinbase API credentials, but the backend currently only executes paper trades through `userStore.executePaperTrade`.

API keys are not persisted. They are stored only in memory. This means each user must re-enter keys after a Railway restart or redeploy. For real multiuser SaaS, implement encrypted persistence before promising durable sessions.

The frontend production bundle is large. The build passes, but Vite warns that the main JS chunk exceeds 500 kB. Code splitting route pages is a good future optimization.

Supabase database migrations are not committed yet. The only local `supabase/` content observed was `.temp`, which is Supabase CLI cache and is now ignored by git.

## Provenance And Change History

Attribution below is based on git commit messages and visible code history. The repo does not contain tool-signed metadata proving which AI tool made every earlier change, so entries marked "inferred" should be treated as historical guidance, not legal provenance.

Initial build:

- Commit `5160af7`: `Initial build: Nexus AI crypto trading bot dashboard`
- Added the initial Vite React app, dashboard, portfolio, backtest, AI config, assets, and baseline styling.

Pre-existing UX expansion:

- Commit `bcf68c7`: `Major UX overhaul: luxury branding, tutorial, 3 new pages`
- Added luxury visual branding, tutorial behavior, Agents, Data Lab, and Intelligence pages.

Pre-existing iOS/PWA and realtime state pass:

- Commit `0207b7d`: `feat: Luxury iOS Mobile UX Overhaul, Apple PWA setup, Lightweight Charts, API Circuit Breakers, & Global Zustand WebSocket Store`
- Added PWA-style metadata, global Zustand WebSocket state, improved dashboard charting, and circuit breaker concepts.

Antigravity-associated change:

- Commit `e967408`: `Fix Dashboard for real backend hook + open in Antigravity`
- This is the only commit message that explicitly names Antigravity.
- Added the backend folder, Express routes, in-memory store, market stream service, Gemini AI engine, setup wizard, and real backend hook work.

Claude/agentic SaaS pass, inferred from user context and commit content:

- Commit `cdeeb01`: `feat: Multi-user SaaS architecture - Supabase Auth, per-user isolation, Railway deployment config, AuthPage UI, JWT WebSocket auth`
- Added Supabase Auth support, per-user backend isolation, auth middleware, `userStore`, JWT WebSocket auth, AuthPage UI, env examples, and deployment-oriented config.

Codex changes made in this session:

- Commit `b239943`: `Fix crypto bot backend connectivity`
- Added a shared frontend API helper.
- Rewired setup/status/WebSocket calls away from hardcoded local backend URLs.
- Improved setup error handling.
- Fixed Express CORS, root route, health behavior, WebSocket URL parsing, and startup errors.
- Replaced Binance market data with Coinbase Advanced Trade public ticker streaming.
- Cleaned lint/tooling split between frontend ESM React code and backend CommonJS code.
- Updated README with real setup and health-check notes.

Codex deployment and handoff changes made after `b239943`:

- Added `railway.json` so Railway deploys the backend process from `server/` instead of serving the frontend.
- Changed backend host binding so Railway uses `0.0.0.0`, while local development defaults to `127.0.0.1`.
- Added Node 22+ engine requirements to root and backend packages.
- Set Railway `FRONTEND_URL` to the Vercel production frontend.
- Set Vercel production `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- Redeployed Vercel production.
- Redeployed Railway backend production successfully.
- Ignored Supabase local CLI cache with `supabase/.temp/`.
- Added this handoff report.

## Security Notes

The Supabase anon key is intentionally public in the browser. The Supabase service-role key must never be exposed to the browser or committed.

During CLI inspection, Railway printed raw environment variable values in terminal output. This report intentionally does not include those values. For best hygiene, rotate the Railway `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_SECRET` after this handoff, especially before onboarding real users.

Do not store Coinbase API secrets in localStorage, browser IndexedDB, plain Supabase tables, or logs. The current in-memory-only backend approach avoids durable leakage but is not enough for production persistence.

## Passkey Login And API Key Vault Roadmap

The desired product direction is "login with passkey" on iPhone, macOS, Windows Hello, Android, and hardware security keys.

Important technical clarification: passkeys/WebAuthn authenticators do not normally store arbitrary Coinbase or Gemini API keys directly. A safer production design is:

1. Use WebAuthn/passkeys for phishing-resistant login and step-up authentication.
2. Store encrypted API-key bundles server-side, not on the authenticator.
3. Use envelope encryption:
   - Server stores ciphertext in Supabase Postgres.
   - A backend KMS or app encryption key wraps per-user data keys.
   - A successful passkey ceremony authorizes decrypt/use.
4. For higher assurance, investigate WebAuthn PRF / device-bound key support where available, but keep a fallback because not every platform/security key supports the same extensions.
5. Require passkey re-authentication before enabling live trading, editing keys, or placing high-risk orders.
6. Keep audit logs for key creation, key rotation, AI decisions, order submissions, and failed auth attempts.
7. Support multiple credentials per user: iPhone passkey, laptop passkey, and at least one hardware key backup.

Recommended implementation phases:

- Phase 1: Supabase Auth passkey/WebAuthn login if supported by the selected Supabase auth stack, or a dedicated WebAuthn server library with Supabase user IDs.
- Phase 2: Encrypted API-key vault table with row-level security, key metadata, versioning, and audit events.
- Phase 3: Passkey-gated key unlock flow and backend-only Gemini/Coinbase use.
- Phase 4: Hardware-key enrollment, recovery policy, admin lockout tooling, and key rotation UI.
- Phase 5: Live Coinbase order execution gated behind passkey step-up and risk controls.

## Future Product Ideas

- Real Coinbase Advanced Trade order execution service with clear paper/live separation.
- Per-user encrypted persistent vault for Coinbase and Gemini keys.
- Supabase migrations for users, key metadata, portfolios, trades, audit logs, and AI decisions.
- Admin dashboard for users, deployment health, API errors, and suspicious activity.
- Multi-asset support beyond `BTC-USD`.
- Backtesting connected to historical candles instead of mostly mock data.
- Strategy marketplace or strategy profiles per user.
- AI explanation timeline with saved prompts, model responses, and confidence history.
- Position sizing controls, max daily loss, max order size, and kill-switch policies.
- Email/SMS/web push alerts for trade events and risk breaker trips.
- Route-level code splitting to reduce the Vercel frontend bundle.
- GitHub Actions CI for lint, build, server syntax checks, and deployment smoke tests.
- Playwright smoke tests for auth/setup/dashboard flows.
- Observability with structured logs, request IDs, and uptime checks.

## Suggested Supabase Data Model

Tables to add when moving beyond memory-only state:

- `profiles`: user profile and onboarding state.
- `api_key_vaults`: encrypted API-key bundle metadata, never plaintext.
- `paper_portfolios`: current per-user paper balances and holdings.
- `paper_trades`: immutable paper trade ledger.
- `ai_decisions`: prompt metadata, model, action, confidence, reasoning, and result.
- `audit_events`: login, setup, passkey enrollment, key unlock, order attempt, order result.
- `risk_limits`: per-user risk controls.

Use row-level security everywhere. Backend service-role access should be tightly scoped in server code and never exposed to frontend builds.

## Deployment Notes

Vercel:

- Production frontend alias: `https://crypto-ai-bot-psi.vercel.app`
- Required production env vars:
  - `VITE_BACKEND_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Deploy command used: `vercel --prod --yes`

Railway:

- Project: `kalshi-enterprise`
- Environment: `production`
- Service: `kalshi-backend`
- Public backend domain: `https://kalshi-backend-production-b847.up.railway.app`
- Required backend env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ENCRYPTION_SECRET`
  - `FRONTEND_URL`
- Optional market env vars:
  - `MARKET_WS_URL`
  - `MARKET_PRODUCT_ID`
- Deploy command used: `railway up --service kalshi-backend --environment production --detach`

## Verification Commands

Local static checks:

```bash
npm run lint
npm run build
node -c server/index.js
node -c server/services/marketStream.js
node -c server/routes/api.js
node -c server/middleware/auth.js
```

Remote checks:

```bash
curl https://kalshi-backend-production-b847.up.railway.app/api/health
curl -I https://crypto-ai-bot-psi.vercel.app
curl -i https://kalshi-backend-production-b847.up.railway.app/api/health \
  -H 'Origin: https://crypto-ai-bot-psi.vercel.app'
```

Deployment checks:

```bash
railway deployment list
vercel ls crypto-ai-bot
vercel env ls production
```

## Agent Handoff Instructions

For future AI agents:

1. Treat `server/` as the Railway backend and root `src/` as the Vercel frontend.
2. Do not commit `.env`, `server/.env`, `.vercel/`, `node_modules/`, `dist/`, or `supabase/.temp/`.
3. Do not print or copy service-role keys into reports.
4. Preserve the frontend/backend URL split:
   - Browser calls Railway through `VITE_BACKEND_URL`.
   - Backend validates Supabase JWTs with service-role credentials.
5. Keep local dev fallback available, but never rely on it for production.
6. Before pushing, run lint, build, and backend syntax checks.
7. Before calling the product "live trading," implement and test an exchange execution layer.
8. When implementing passkeys, build a key vault and unlock workflow; do not claim passkeys directly store API keys unless a specific supported authenticator extension is implemented and tested.

