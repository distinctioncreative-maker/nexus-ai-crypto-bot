# Quant — AI Crypto Trading Terminal

**Quant** is a full-stack AI-powered crypto paper trading terminal built by [Distinction Creative](https://distinctioncreative.us). It runs 5 algorithmic strategy agents simultaneously, synthesizes their signals through a Groq-powered LLM, executes paper trades against a live Coinbase price feed, and tracks performance through a self-improving tournament system. The mobile-optimized PWA can be added to your iPhone home screen.

---

## Features

### AI Trading Engine
- **5 Specialist Agents** — Atlas (momentum/EMA/MACD), Vera (mean reversion/RSI/Bollinger), Rex (trend following/EMA cloud/ADX), Luna (sentiment/Fear&Greed/macro), Nova (volume/OBV/MACD divergence)
- **Quant Oracle (Orion)** — synthesizes all 5 agent votes into a final BUY/SELL/HOLD decision using Groq LLaMA 3.3 70B
- **Strong Consensus Bypass** — when ≥80% of agents agree, skips the LLM call entirely (saves tokens, prevents rate limiting)
- **Shadow Portfolio Tournament** — each agent runs its own paper portfolio; the bottom performer gets its parameters mutated every 8 closed trades
- **Self-Learning (Autopsy System)** — after every SELL, each agent records a lesson from the trade outcome using the fast LLaMA 3.1 8B model
- **AI Assisted Mode** — AI proposes trades, you approve or reject within a 60-second window
- **Full Auto Mode** — AI executes trades instantly without confirmation

### Risk Management
- ATR-based position sizing
- Fear & Greed index size multiplier
- Kelly Criterion position sizing (optional, requires 5+ trade history)
- Per-trade max % cap, daily loss limit, volatility reduce threshold
- Trailing stop, multi-level take-profit (sell in stages)
- Absolute stop-loss and take-profit price targets
- Kill Switch — instantly halts all trading activity
- Circuit breaker — auto-halts on hard drawdown limits

### Market Data
- **Live Coinbase WebSocket** — real-time OHLCV price feed for 25 supported assets
- **Multi-coin watchlist** — up to 10 coins tracked simultaneously
- **Fear & Greed Index** — via Alternative.me API
- **DeFi TVL** — via DeFiLlama
- **Polymarket** — BTC bull probability
- **Composite macro score** — weighted combination of all signals
- **Crypto news feed** — with sentiment analysis, impact scoring, and source filtering

### Backtesting
- Historical strategy backtesting with walk-forward validation
- Equity curve visualization, Sharpe ratio, max drawdown, profit factor
- Supports all 5 strategy types across any supported asset

### Ask AI (Quant Oracle Chat)
- Conversational interface powered by the Oracle
- Has live access to your portfolio, agent signals, and market data
- 15-second rate-limit cooldown to prevent Groq 429 errors
- Chat history persists in localStorage

### Mobile / PWA
- iPhone-optimized layout: bottom tab bar, bottom sheets for modals
- Add to Home Screen from Safari — opens fullscreen with proper icon
- Hero balance display, swipe-scroll metric cards
- Engine start/stop accessible directly from the Trading page on mobile

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Zustand, Framer Motion, lightweight-charts v5 |
| Backend | Node.js, Express 5, WebSocket (ws) |
| AI | Groq API — LLaMA 3.3 70B (decisions), LLaMA 3.1 8B (autopsies) |
| Auth | Supabase (JWT) |
| Market Data | Coinbase Advanced Trade public WebSocket |
| Deployment | Railway (backend), Vercel (frontend) |

---

## Architecture

```
Browser (React PWA)
    │
    ├── WebSocket (wss://) ←──────────────────────────────────────┐
    │                                                              │
    └── HTTP (REST /api/*)                                        │
                                                                   │
Railway Backend (Node/Express)                                    │
    │                                                              │
    ├── marketStream.js — Coinbase public WS, price ticks         │
    │       └── evaluates 1 coin every 30s (sequential)           │
    │                                                              │
    ├── aiEngine.js — Groq API calls                              │
    │       ├── evaluateMarketSignal() — 5-agent consensus → LLM  │
    │       ├── answerUserQueryMultiAgent() — Oracle chat          │
    │       └── runAgentAutopsies() — sequential, fast model      │
    │                                                              │
    ├── strategyEngine.js — algorithmic signals (no API cost)     │
    │       ├── getAgentConsensus() — 5 strategy algorithms        │
    │       ├── tickShadowPortfolios() — per-agent paper trading   │
    │       └── tournament mutation                                │
    │                                                              │
    ├── riskEngine.js — position sizing, risk checks              │
    ├── positionManager.js — TP/SL/trailing stop tracking         │
    ├── signalEngine.js — Fear&Greed, TVL, Polymarket, news       │
    └── userStore.js — in-memory state per user                   │
                                         │                         │
                                         └── broadcasts via WS ───┘
```

---

## Local Development

### Prerequisites
- Node.js ≥ 22
- A [Groq API key](https://console.groq.com) (free tier: 6,000 tokens/min)
- Supabase project (optional — app works in local dev mode without it)

### Setup

```bash
# Clone
git clone https://github.com/distinctioncreative-maker/nexus-ai-crypto-bot.git
cd nexus-ai-crypto-bot

# Install frontend deps
npm install

# Install backend deps
npm --prefix server install

# Copy env files
cp .env.example .env
cp server/.env.example server/.env
# Edit both files with your keys
```

### Environment Variables

**Frontend (`.env`)**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://127.0.0.1:3001
```

**Backend (`server/.env`)**
```env
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
```

> **Local dev mode**: If Supabase vars are missing, the frontend auto-logs in as `dev@local` and the backend accepts all requests as `local-dev-user`. Groq is required for AI features.

### Run

```bash
# Terminal 1 — backend
npm run dev:server

# Terminal 2 — frontend
npm run dev
```

Open `http://localhost:5173`. The backend runs at `http://127.0.0.1:3001`.

---

## Deployment

### Backend → Railway

The `railway.json` configures Railway to build from the `server/` root directory:

```json
{
  "deploy": {
    "startCommand": "node index.js",
    "healthcheckPath": "/api/health"
  }
}
```

Set these env vars in Railway:
- `GROQ_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (Railway sets this automatically)

### Frontend → Vercel

```bash
npx vercel --prod
```

Set `VITE_BACKEND_URL` to your Railway backend URL in Vercel's environment settings.

### Mobile (Add to Home Screen)

1. Open your Vercel URL in **Safari on iPhone**
2. Tap the **Share** button → **Add to Home Screen**
3. App installs with the Quant icon and opens fullscreen

For native App Store distribution, use [Capacitor.js](https://capacitorjs.com) to wrap the built `dist/` folder:
```bash
npm install @capacitor/core @capacitor/ios
npx cap init "Quant" "us.distinctioncreative.quant" --web-dir dist
npx cap add ios
npm run build && npx cap sync
npx cap open ios  # opens Xcode
```

---

## Supported Assets

BTC-USD, ETH-USD, SOL-USD, XRP-USD, DOGE-USD, ADA-USD, AVAX-USD, MATIC-USD, LINK-USD, DOT-USD, UNI-USD, ATOM-USD, LTC-USD, BCH-USD, ALGO-USD, XLM-USD, VET-USD, FIL-USD, THETA-USD, ICP-USD, AAVE-USD, COMP-USD, MKR-USD, SNX-USD, YFI-USD

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/status` | Config status (keys set up?) |
| `POST` | `/api/setup` | Save Coinbase/Groq API keys |
| `POST` | `/api/risk-settings` | Update risk parameters |
| `POST` | `/api/reset-kill-switch` | Reset kill switch / circuit breaker |
| `WS` | `/` | Main WebSocket — all real-time data |

### WebSocket Message Types (server → client)

| Type | Payload |
|------|---------|
| `ENGINE_STATE` | Full engine + portfolio state |
| `TICK` | Price update for selected product |
| `TRADE_EXEC` | Executed paper trade |
| `PENDING_TRADE` | AI trade awaiting approval (AI Assisted mode) |
| `STRATEGY_UPDATE` | Agent signals update |
| `AI_STATUS` | Current AI reasoning string |
| `SITUATION_ROOM_AGENT` | Oracle chat response chunk |
| `SITUATION_ROOM_DONE` | Oracle response complete |
| `NOTIFICATION` | New system notification |

---

## Groq Rate Limits (Free Tier)

The free Groq tier has strict limits that the app is optimized for:

| Model | Tokens/min | Req/min |
|-------|-----------|---------|
| `llama-3.3-70b-versatile` | 6,000 | 30 |
| `llama-3.1-8b-instant` | 20,000+ | 30 |

**Optimizations in place:**
- Background eval runs 1 coin every 30 seconds (sequential, not parallel)
- Strong consensus bypass skips LLM when ≥80% agents agree
- Autopsies use the fast 8B model (separate rate-limit pool)
- Oracle chat has a 15-second per-user cooldown
- Concurrency limiter caps simultaneous Groq calls at 2
- Retry with exponential backoff + Groq reset-tokens header

---

## Project Structure

```
nexus-ai-crypto-bot/
├── src/                          # React frontend
│   ├── components/
│   │   ├── Dashboard.jsx         # Main trading terminal
│   │   ├── EngineControl.jsx     # Start/stop + mode selector
│   │   ├── AgentsPage.jsx        # Strategy tournament view
│   │   ├── PortfolioPage.jsx     # Holdings, P&L, equity curve
│   │   ├── SituationRoom.jsx     # Ask AI chat
│   │   ├── IntelligencePage.jsx  # Market signals feed
│   │   ├── BacktestModule.jsx    # Historical backtesting
│   │   ├── RiskSettingsModal.jsx # 3-tab risk config (tabs: Sizing/Risk/Smart Trade)
│   │   ├── KillSwitch.jsx        # Emergency stop
│   │   ├── NotificationCenter.jsx
│   │   ├── WatchlistSidebar.jsx
│   │   ├── PendingTradeCard.jsx  # AI trade approval UI
│   │   ├── Tutorial.jsx
│   │   └── ChangelogPage.jsx     # Docs & feature guide
│   ├── store/useStore.js         # Zustand global state
│   ├── services/websocket.js     # WS client + message handlers
│   ├── lib/
│   │   ├── api.js                # Backend URL helpers
│   │   └── supabase.js           # Supabase client + authFetch
│   ├── App.jsx                   # Routing, auth, navbar
│   ├── App.css                   # Layout, responsive breakpoints
│   └── index.css                 # Design tokens, global styles
│
├── server/                       # Node.js backend
│   ├── index.js                  # Express + WebSocket server
│   ├── userStore.js              # In-memory per-user state
│   ├── services/
│   │   ├── aiEngine.js           # Groq API, agent consensus, autopsies
│   │   ├── marketStream.js       # Coinbase WS, eval loop, trade execution
│   │   ├── strategyEngine.js     # 5 trading algorithms, shadow portfolios
│   │   ├── riskEngine.js         # Position sizing, risk checks
│   │   ├── positionManager.js    # TP/SL/trailing stop
│   │   ├── signalEngine.js       # External signals (F&G, TVL, news)
│   │   └── productCatalog.js     # Supported asset list
│   └── package.json
│
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── icon-192.png              # App icon (home screen)
│   └── icon-512.png              # App icon (splash)
│
├── railway.json                  # Railway deploy config
└── package.json                  # Frontend deps
```

---

## Legal

Quant is a **paper trading simulator**. No real funds are used or transferred. The app does not constitute financial advice. Crypto markets are highly volatile — never risk money you cannot afford to lose.

For live trading integration (real Coinbase orders), additional regulatory compliance is required depending on jurisdiction (US: MSB registration with FinCEN, state Money Transmitter Licenses; EU: MiCA compliance).

---

Built by [Distinction Creative](https://distinctioncreative.us)
