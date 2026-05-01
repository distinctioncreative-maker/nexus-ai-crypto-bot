# Claude Continuation Prompt
## Quant — AI Crypto Trading Terminal
**Session ended:** 2026-04-30  
**Status:** P0 fixes complete. P1 and Playwright audit remain.

---

## What Was Completed This Session

### P0 Security/Safety Fixes (All Done)
1. ✅ `test-e2e.cjs` — Removed hardcoded email/password. Replace with `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_APP_URL`, `E2E_BACKEND_URL` env vars. Password `Marcano2005$` for `mattcoreloops@gmail.com` was public — **MUST BE ROTATED**.
2. ✅ `server/index.js` — Fixed WebSocket auth bypass: when Supabase configured, connections without token now rejected (4001). Production with no Supabase also rejected (4003).
3. ✅ `server/services/marketStream.js` — Fixed `const now = Date.now()` declared at line 492 but used at lines 448/457 in the kill-switch block. Moved to top of interval callback. This was causing `ReferenceError` that silently crashed the eval loop whenever kill switch was active.
4. ✅ `server/index.js` — WS malformed message handling: JSON parse errors now log safe warning and send `ERROR` type to client.
5. ✅ `server/.env.example` — Fixed wrong MARKET_WS_URL, added GROQ_MODEL, E2E vars.
6. ✅ `src/components/SetupWizard.jsx` — Compliance: "not financial advice", "paper trading simulation" labels.
7. ✅ `src/components/LiveModeConfirmModal.jsx` — Added Coinbase key permission guidance (trade-only, no withdrawal), fee disclosure, "not financial advice".

### Docs Created
- `YC_FULL_AUDIT_AND_EXECUTION_PLAN.md` — Full audit findings
- `YC_FULL_AUDIT_EXECUTION_REPORT.md` — Execution report

---

## What Still Needs To Be Done

### P1 — Backend/WS Wiring
- [ ] WS reconnect: no state resync after reconnect. After reconnect, client should receive a full PORTFOLIO_STATE + STRATEGY_UPDATE immediately. Add `wasReconnect` flag to WS URL or handle in `websocket.js`.
- [ ] Duplicate WS connection prevention: if the same user opens two tabs, they get two WS connections and two eval loops. Consider storing per-user WS reference and closing old one on new connect.
- [ ] Pending trade expire handling: if WS drops while a pending trade is awaiting confirmation, client has no way to know it expired. Add explicit `PENDING_TRADE_EXPIRED` message.

### P1 — Compliance
- [ ] `src/components/PendingTradeCard.jsx` — Label price as "Estimated fill at $X (market order, actual fill may vary)"
- [ ] `src/components/Dashboard.jsx` — Hero balance: already labeled "Paper Trading Balance" in Dashboard. Verify on mobile.
- [ ] `src/components/SituationRoom.jsx` — Add "AI-assisted analysis — not financial advice" to the footer or first Oracle message.

### P1 — Mobile/Desktop UX (Playwright Audit Needed)
Run Playwright at these viewports: 1440x900, 1280x800, 768x1024, 390x844, 375x667

Known remaining mobile issues:
- Watchlist is inaccessible on 375x667 — no alternative entry point
- Chart tooltip can overflow viewport at top on small screens
- Pending trade card may be taller than viewport on landscape

To run Playwright against production:
```bash
E2E_APP_URL=https://crypto-ai-bot-psi.vercel.app \
E2E_EMAIL=<email> \
E2E_PASSWORD=<password> \
node test-e2e.cjs
```

### P2 — Security Hardening (Lower Priority)
- [ ] CryptoJS AES without random IV for Coinbase key encryption in `server/userStore.js`. Upgrade to Node `crypto` with `randomBytes(16)` IV stored alongside ciphertext.
- [ ] Add a smoke test script (`server/smoke-test.js`) that hits `/api/health`, validates response, and exits 0/1 for CI use.
- [ ] Add ESLint config (`npm install --save-dev eslint`) — currently no lint step.

---

## Files To Inspect Next Session
- `src/components/PendingTradeCard.jsx` — compliance label
- `src/services/websocket.js` — reconnect behavior, duplicate connection
- `src/components/SituationRoom.jsx` — not-financial-advice footer
- `server/userStore.js` lines 500-508 — encryption upgrade
- `src/App.css` — safe-area insets for iPhone notch

---

## Commands Run This Session
```bash
npm run build                          # ✅ Clean, 458ms
node --check server/index.js           # ✅ OK
node --check server/services/marketStream.js  # ✅ OK
node --check test-e2e.cjs              # ✅ OK
```

## Playwright Status
Not run this session (rate limit hit before execution). Run against production with env vars set.

---

## Ready-to-Paste Next Prompt

```
Continue the YC audit for the Quant crypto trading terminal.
Repo: /Users/mattcorez/Claude/crypto-ai-bot

P0 fixes are complete (see YC_FULL_AUDIT_EXECUTION_REPORT.md).

Remaining work:

1. P1 backend fixes:
   - src/services/websocket.js: add full state resync on reconnect (send PORTFOLIO_STATE + STRATEGY_UPDATE after reconnect)
   - src/services/websocket.js: prevent duplicate WS connections (close old socket if same tab reconnects)
   - src/components/PendingTradeCard.jsx: label price as "Estimated fill" and add "market order — actual fill may vary"

2. Compliance:
   - src/components/SituationRoom.jsx: add "AI-assisted analysis — not financial advice" to initial Oracle message or footer
   
3. Run Playwright E2E audit at 5 viewports (1440x900, 1280x800, 768x1024, 390x844, 375x667) using:
   E2E_APP_URL=https://crypto-ai-bot-psi.vercel.app
   E2E_EMAIL=<ask user>
   E2E_PASSWORD=<ask user>
   Fix any mobile overflow, hidden buttons, or tap target issues found.

4. Update YC_FULL_AUDIT_EXECUTION_REPORT.md after each phase.

Do not deploy, do not push, do not touch real .env files.
```
