# Claude Continuation Prompt
## Quant — AI Crypto Trading Terminal
**Session:** 2026-05-01 (post-audit execution pass)  
**Status:** Committed locally. Not yet pushed.

---

## Completed This Session

From POST_AUDIT_CRITICAL_FIX_REPORT.md:

1. ✅ **Paper accounting hardening** — `executePaperTrade` input validation (NaN, Infinity, ≤0 price/amount), JSDoc explaining units (amount = base qty not USD, etc.)
2. ✅ **Accounting tests** — 12 unit tests, all passing: `node server/tests/accounting.test.js`
3. ✅ **Trade execution cooldown** — 5-minute per-product cooldown in `executeTradeDecision` (FULL_AUTO only), `lastTradeByProduct` tracking
4. ✅ **Setup degraded mode** — `/api/setup` no longer fails when Ollama unreachable AND no Groq key; returns `aiWarning` instead of 400 error
5. ✅ **Backtest 0-trade warning** — displays warning when out-of-sample has 0 trades, low-sample warning for <5 trades, fee/disclaimer always shown
6. ✅ **Debug panel production fix** — `window.fetch` patch + panel render both gated to `import.meta.env.DEV`
7. ✅ **server/package.json** — `npm test` now runs `node tests/accounting.test.js`

---

## Still Needs To Be Done

### HIGH — Do First
1. **Rotate exposed account password** — see SECURITY_ROTATION_REQUIRED.md
2. **Push to GitHub** — if user approves: `git push origin main`

### MEDIUM — Next Session
3. **Upgrade CryptoJS → Node crypto with random IV** — `server/userStore.js` lines ~500-510 (encrypt/decrypt methods). CryptoJS AES without IV is weak; use `crypto.randomBytes(16)` IV stored prepended to ciphertext.
4. **Add `express-rate-limit`** — protect API routes from spam: `npm install express-rate-limit` in server, add to routes/api.js
5. **Session expiry warning** — add toast at 55 minutes before 1h JWT expires in `src/App.jsx`
6. **WS reconnect STRATEGY_UPDATE** — after WS reconnect, server should re-send STRATEGY_UPDATE so agents page stays current. Add to server/index.js WS connect handler after restoreState.

### LOW — Polish Pass
7. **Backtest ResultBlock totalTrades field** — `server/services/backtestEngine.js` — verify `totalTrades` is in the response object so the zero-trade warning renders correctly
8. **Authenticated E2E run** — set `E2E_APP_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_BACKEND_URL` and run `node test-e2e.cjs`
9. **Mobile real-device test** — inspect dashboard, portfolio, pending trade card at 390x844

---

## Files to Inspect Next Session
- `server/userStore.js` lines 500-510 — encrypt/decrypt (CryptoJS upgrade)
- `src/App.jsx` — session expiry useEffect
- `server/index.js` WS connect handler (after restoreState) — add STRATEGY_UPDATE resend
- `server/services/backtestEngine.js` — verify `totalTrades` field in response

---

## Commands Run This Session

```bash
npm run build              → ✅ 433ms, clean
node --check server/...    → ✅ All OK
node server/tests/accounting.test.js → ✅ 12/12 pass
```

---

## Ready-to-Paste Next Prompt

```
Continue the Quant crypto trading terminal work.
Repo: /Users/mattcorez/Claude/crypto-ai-bot

Completed in last session (see POST_AUDIT_CRITICAL_FIX_REPORT.md):
- Paper accounting input validation in executePaperTrade
- 12 accounting unit tests (all passing)
- 5-minute per-product trade execution cooldown
- Setup degraded mode (no AI provider no longer blocks paper trading)
- Backtest 0-trade warning
- Debug panel production gating

Next tasks in priority order:

1. Upgrade CryptoJS → Node crypto with random IV in server/userStore.js
   - Lines ~500-510 (encrypt/decrypt static methods)
   - Use crypto.createCipheriv('aes-256-cbc', ...) with randomBytes(16) IV
   - Store IV prepended to ciphertext (hex:hex format)
   - Add backward-compat decrypt path for old-format strings

2. Add express-rate-limit to server/routes/api.js
   - npm install express-rate-limit (add to server/package.json dependencies)
   - 100 req/15min for general routes
   - 10 req/15min for /api/setup and /api/confirm-trade

3. Add session expiry warning to src/App.jsx
   - useEffect that checks token expiry, shows toast 5 minutes before expire
   - Use supabase.auth.getSession() to get expiry timestamp

4. Verify server/services/backtestEngine.js returns totalTrades in test/train results
   - If missing, add totalTrades: trades.length to the result objects

5. Run full build + tests before stopping
   npm run build
   node server/tests/accounting.test.js

Do not push. Do not deploy. Do not touch real .env files.
```
