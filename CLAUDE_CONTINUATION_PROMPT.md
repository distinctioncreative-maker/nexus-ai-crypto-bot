# Claude Continuation Prompt
## Quant — AI Crypto Trading Terminal
**Session ended:** 2026-05-01  
**Commits:** `fc1df56` (P0), `b688f1a` (P1-P5) — committed locally, not pushed

---

## Completed This Session

### Verified + Committed (P0 — commit fc1df56)
- ✅ test-e2e.cjs: hardcoded credentials removed, env var guards added
- ✅ mobile-audit.cjs, pnl-audit.cjs, debug-audit.cjs: credentials removed, added to .gitignore
- ✅ server/index.js: WS auth bypass fixed (token required when Supabase configured)
- ✅ server/index.js: production WS rejection when Supabase missing
- ✅ server/services/marketStream.js: `const now` moved before kill-switch (ReferenceError fix)
- ✅ server/index.js: malformed WS message handling improved
- ✅ server/.env.example: corrected MARKET_WS_URL, added GROQ_MODEL, E2E vars
- ✅ SetupWizard.jsx: "paper trading simulation — not financial advice" disclaimer
- ✅ LiveModeConfirmModal.jsx: Coinbase key permission guidance, fee disclosure
- ✅ SECURITY_ROTATION_REQUIRED.md created

### Verified + Committed (P1-P5 — commit b688f1a)
- ✅ websocket.js: duplicate connection guard (CONNECTING state check)
- ✅ websocket.js: try/catch on onmessage JSON.parse
- ✅ websocket.js: sendEngineStatusChange no longer optimistically updates when WS down
- ✅ PendingTradeCard.jsx: LIVE ORDER / PAPER SIM badge, "Est. Fill Price" label, fee note
- ✅ SituationRoom.jsx: "not financial advice" in initial Oracle message
- ✅ AuthPage.jsx: "AI-assisted paper trading — not financial advice" footer
- ✅ AuthPage.css: .auth-toggle button min-height:44px (was 36px, below HIG minimum)
- ✅ viewport-audit.cjs: 5-viewport non-auth layout audit script

---

## Still Needs To Be Done

### HIGH — Do Immediately
1. **Rotate the exposed account password.** The email/password was committed to a public GitHub repo. Even though credentials are removed from code, they're in git history. See `SECURITY_ROTATION_REQUIRED.md`.

### MEDIUM — Next Session

2. **Authenticated viewport audit** — Run `test-e2e.cjs` with E2E env vars to inspect the authenticated app at mobile viewports:
   ```bash
   E2E_APP_URL=https://crypto-ai-bot-psi.vercel.app \
   E2E_BACKEND_URL=https://kalshi-enterprise-production.up.railway.app \
   E2E_EMAIL=<email> \
   E2E_PASSWORD=<password> \
   node test-e2e.cjs
   ```
   Currently only login page was inspected. Inner pages (dashboard, portfolio, agents, backtest, situation room) need mobile visual inspection.

3. **WS reconnect deep sync** — After reconnect, PORTFOLIO_STATE is sent. But candle history and strategy state are only sent on initial connect or product switch. Add `STRATEGY_UPDATE` send on reconnect.  
   Files: `server/index.js` WS `onopen` equivalent (on connect, after state restore)

4. **CryptoJS → Node crypto for key encryption** — `server/userStore.js` uses CryptoJS AES without random IV. Upgrade to Node built-in `crypto.createCipheriv('aes-256-cbc', key, iv)` with 16-byte random IV prepended to ciphertext.  
   Files: `server/userStore.js` lines 500–508 (encrypt/decrypt methods)

5. **ESLint setup** — No lint config in repo. Add minimal ESLint:
   ```bash
   npm install --save-dev eslint @eslint/js
   ```
   Document in `package.json` as `"lint": "eslint src/ server/ --ext .js,.jsx"`

6. **Session expiry warning** — JWT is 1 hour. Add proactive warning at 55 minutes so user doesn't lose state mid-trade.  
   File: `src/App.jsx` — add useEffect that checks token expiry and shows a toast

### LOW — Polish
7. `src/components/BacktestModule.jsx` — Add "Backtesting uses historical simulation data and does not predict future results" disclaimer below results
8. `server/services/signalEngine.js` — Add `fetchPolymarketBTC` error handling (currently throws on non-200; should return null gracefully)
9. `agent_snapshots` DB table — Never surfaced in UI. Either use it (AgentsPage could show historical snapshot) or add a comment that it's reserved.

---

## Files to Inspect Next Session
- `server/index.js` WS reconnect path (lines 118–135) — add STRATEGY_UPDATE on reconnect
- `server/userStore.js` lines 500–508 — encryption upgrade
- `src/App.jsx` — session expiry warning
- `src/components/BacktestModule.jsx` — results disclaimer
- `server/services/signalEngine.js` — fetchPolymarketBTC error handling

---

## Commands Run

```bash
# Credential scan
rg "Marcano|mattcoreloops" . --glob '!*.md' --glob '!node_modules/**'
→ ✅ CLEAN

# Build (both commits)
npm run build
→ ✅ Clean, 432-458ms

# Server syntax checks
node --check server/index.js server/services/marketStream.js server/routes/api.js server/db/persistence.js test-e2e.cjs
→ ✅ All OK

# Server startup health check
NODE_ENV=development ENCRYPTION_SECRET=test PORT=3099 node server/index.js
curl http://localhost:3099/api/health
→ ✅ {"status":"ok"}

# Viewport audit (non-authenticated)
node viewport-audit.cjs
→ ✅ No overflow at any viewport
→ ⚠️ 1 small button (auth toggle, fixed in code)
→ ⚠️ E2E env vars not set — authenticated pages not inspected

# npm run lint
→ ⏭️ No lint config in repo
```

---

## Ready-to-Paste Next Prompt

```
Continue the YC audit/fix pass for the Quant crypto trading terminal.
Repo: /Users/mattcorez/Claude/crypto-ai-bot

Two commits are done locally (not pushed):
- fc1df56: P0 security fixes
- b688f1a: P1-P5 backend, compliance, mobile UX

What still needs doing:

1. Run authenticated E2E viewport audit (if user provides E2E_EMAIL, E2E_PASSWORD):
   Ask user: "Can you provide E2E_EMAIL and E2E_PASSWORD so I can run the full authenticated 
   Playwright audit at mobile/desktop viewports?"
   If provided, run: E2E_APP_URL=https://crypto-ai-bot-psi.vercel.app E2E_EMAIL=... E2E_PASSWORD=... node test-e2e.cjs
   Then visually inspect screenshots and fix any new mobile issues found.

2. Add STRATEGY_UPDATE to WS reconnect path (server/index.js lines 118-135)

3. Add session expiry warning to App.jsx (5-minute toast before 1h JWT expires)

4. Add backtest results disclaimer to BacktestModule.jsx

5. Fix signalEngine.js fetchPolymarketBTC to handle non-200 gracefully

6. Add minimal ESLint config

7. Update YC_FULL_AUDIT_EXECUTION_REPORT.md after each fix

Do not push. Do not deploy. Do not touch real .env files. Build must stay clean.
```
