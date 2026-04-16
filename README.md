# Crypto AI Bot

React/Vite trading terminal with a Node/Express backend, Coinbase Advanced Trade public WebSocket market stream, Supabase auth support, and per-user in-memory API key storage for Coinbase Advanced Trade and Gemini.

## Local Development

Run the backend and frontend in two terminals:

```bash
npm run dev:server
npm run dev
```

Open the app at `http://localhost:5173`. The frontend expects the backend at `http://127.0.0.1:3001` unless `VITE_BACKEND_URL` is set.

## Environment

Copy `.env.example` to `.env` for the frontend and `server/.env.example` to `server/.env` for the backend.

Supabase is optional for local development. If the frontend has no Supabase variables, it auto-signs in as `dev@local`. If the backend has no Supabase service credentials, it accepts local dev requests as `local-dev-user`.

## Health Checks

Backend:

```bash
curl http://127.0.0.1:3001/api/health
```

Frontend:

```bash
curl http://127.0.0.1:5173
```

## Notes

API keys entered in the setup screen are stored only in the running Node process memory. Restarting the backend clears them.
