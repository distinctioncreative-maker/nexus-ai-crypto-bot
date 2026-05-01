# Security Rotation Required

## Exposed Credentials — Immediate Action Needed

### What Happened
A plaintext password was committed to this repository in multiple files:
- `test-e2e.cjs` (committed, in git history)
- `mobile-audit.cjs`, `pnl-audit.cjs`, `debug-audit.cjs` (untracked but were present on disk)

These files referenced a Supabase/auth account. The password value is **not reproduced here**.

### Required Actions

1. **Rotate the password immediately** in your Supabase Auth dashboard (or whatever auth provider this account uses).
   - Go to auth provider → user management → find the affected account → force password reset or admin-set new password.

2. **Revoke active sessions** if your auth provider supports it.
   - In Supabase: Settings → Auth → Sessions → revoke all sessions for the affected user.

3. **Check password reuse** — if the same password was used anywhere else (email provider, other services), change it there too.

4. **Review git history** for any other leaked secrets:
   ```bash
   git log --all --oneline -20
   git log -p -- test-e2e.cjs | grep -i "password\|email"
   ```

5. **If the repo is public**, consider using [GitHub's secret scanning](https://docs.github.com/en/code-security/secret-scanning) and [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to scrub the history if needed.

### What Was Fixed
All hardcoded credentials in active files have been replaced with environment variable guards:
- `process.env.E2E_EMAIL`
- `process.env.E2E_PASSWORD`
- `process.env.E2E_APP_URL`
- `process.env.E2E_BACKEND_URL`

The scripts exit immediately with a clear error if these variables are not set.

### Going Forward
- Never commit credentials, tokens, or passwords to source control.
- Use `.env` files (already in `.gitignore`) for secrets.
- Use CI/CD secret injection for E2E test credentials.
- Audit any future scripts before committing with: `rg "password|secret|token|api_key" --glob '!*.md' --glob '!node_modules/**'`
