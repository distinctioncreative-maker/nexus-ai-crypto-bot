import React, { useState } from 'react';
import {
    BookOpen, Layers, GitCommit, Map, ChevronRight,
    CheckCircle2, Circle, Clock, Zap, TrendingUp, Shield,
    BrainCircuit, BarChart2, Radio, Cpu, Activity, Binary,
    Briefcase, LayoutDashboard, AlertTriangle, Star, ArrowRight,
    Terminal, FlaskConical, Rocket, Package
} from 'lucide-react';

// ── Data ──────────────────────────────────────────────────────────────────────

const CHANGELOG = [
    {
        phase: 11,
        date: '2026-04-26',
        title: 'Algorithm Maximization',
        subtitle: '151 Trading Strategies audit + 2025 quant research',
        status: 'live',
        color: '#FF9F0A',
        changes: [
            { type: 'new', text: 'MACD(5/35/5) — crypto-optimized over standard 12/26/9 per Kang 2021 analysis of 19,456 MACD variations' },
            { type: 'new', text: 'ATR (Average True Range) standalone helper — used for volatility-scaled position sizing' },
            { type: 'new', text: 'OBV (On-Balance Volume) — detects institutional accumulation/distribution before price moves' },
            { type: 'new', text: 'BB squeeze detection — identifies Bollinger Band compression (volatility coiling before breakout)' },
            { type: 'new', text: 'Nova — 5th AI agent (Volume + MACD divergence), inspired by PDF §18.2 multi-timeframe ANN strategy' },
            { type: 'new', text: 'Multi-coin momentum rotation scoring — ranks watchlist coins by 7d×0.6 + 30d×0.4 dual momentum (PDF §4.1.2)' },
            { type: 'upgrade', text: 'Atlas: SMA 5/20 → EMA 9/21 + MACD confirmation + volume spike filter (77% win rate documented)' },
            { type: 'upgrade', text: 'Vera: RSI thresholds 32/68 → standard 30/70 + OBV divergence signal' },
            { type: 'upgrade', text: 'Rex: MACD filter added — eliminates false trend signals in choppy/ranging markets' },
            { type: 'upgrade', text: 'ATR-based position sizing: risk 2% of portfolio / (ATR × 2 stop distance) — reduces drawdown from ~20% to ~8-12%' },
            { type: 'upgrade', text: 'Fear & Greed size multiplier: 0.5× at F&G>80 (extreme greed), 1.25× at F&G<20 — don\'t chase euphoria' },
            { type: 'upgrade', text: 'AI agent prompts now receive computed indicator values (MACD hist, OBV trend, RSI, EMA gap) — agents no longer reasoning blind' },
        ],
    },
    {
        phase: 10,
        date: '2026-04-25',
        title: 'Debug Panel + Error Logging',
        subtitle: 'Server errors piped to frontend with copy-all',
        status: 'live',
        color: '#0A84FF',
        changes: [
            { type: 'new', text: 'SERVER_LOG WebSocket event — server broadcasts AI eval failures, kill switch trips, circuit breaker events' },
            { type: 'new', text: 'Copy All button in debug panel — formats all logs as timestamped plaintext for paste-to-Claude' },
            { type: 'upgrade', text: 'Debug panel now logs KILL_SWITCH_ALERT, TRADE_EXEC, AI_STATUS, WS connect/disconnect events' },
            { type: 'upgrade', text: 'AI eval errors show source tag: [strategyEngine], [circuitBreaker] with orange/red color coding' },
            { type: 'fix', text: 'Groq 429 rate limit: retry with exponential backoff (2s → 4s → 8s), up to 3 attempts' },
            { type: 'fix', text: 'Situation room agents serialized (sequential) to avoid burst-tripping Groq rate limit' },
        ],
    },
    {
        phase: 9,
        date: '2026-04-24',
        title: 'Kill Switch Fixes + Multi-Coin Terminal',
        subtitle: 'Circuit breaker overhaul + positions bar + paper trading realism',
        status: 'live',
        color: '#FF453A',
        changes: [
            { type: 'fix', text: 'Kill switch loop: resetKillSwitch() now clears stale takeProfitPrice/stopLossPrice — was re-tripping circuit breaker on every tick' },
            { type: 'fix', text: 'Cross-product TP/SL contamination: DOGE $2.657 target was firing against BTC ($77k) after product switch' },
            { type: 'fix', text: 'restoreState() clears tripped circuit breaker + stale TP/SL on reconnect — old DB rows no longer re-halt the engine' },
            { type: 'fix', text: 'Circuit breaker threshold raised 5% → 20% (5% was tripping on normal volatility within minutes)' },
            { type: 'fix', text: 'KILL_SWITCH_ALERT throttled to once per 60s — was flooding frontend on every 2s tick' },
            { type: 'new', text: 'Active Positions Bar — horizontal strip showing all held coins with live P&L, qty, price, and AI signal badge' },
            { type: 'new', text: 'Watchlist tab pills above chart — one-click coin switching without dropdown' },
            { type: 'upgrade', text: 'Paper trading fee simulation: 0.6% Coinbase taker + 0.1% slippage = 0.7% per side (realistic fill prices stored)' },
            { type: 'upgrade', text: 'Sharpe ratio now uses sample variance (n-1) instead of population variance' },
            { type: 'upgrade', text: 'Agent lessons persisted to Supabase strategies table on every lesson + tournament cycle' },
        ],
    },
    {
        phase: 8,
        date: '2026-04-23',
        title: 'Candlestick Chart + Supabase Persistence',
        subtitle: 'OHLCV charts, trade markers, lesson persistence',
        status: 'live',
        color: '#30D158',
        changes: [
            { type: 'upgrade', text: 'Chart upgraded from AreaSeries to CandlestickSeries (lightweight-charts v5) with OHLCV data' },
            { type: 'new', text: 'Live candle building from WebSocket ticks — 1-minute OHLCV in Zustand, persisted up to 500 candles' },
            { type: 'new', text: 'OHLC tooltip on hover — shows open/high/low/close for each candle' },
            { type: 'fix', text: 'Trade markers on chart fixed — was using trade.timestamp (undefined) instead of trade.time' },
            { type: 'new', text: 'Agent lessons persist across server restarts via Supabase strategies table' },
            { type: 'new', text: 'CANDLE_HISTORY WebSocket event populates both area and candlestick series on connect' },
        ],
    },
    {
        phase: 7,
        date: '2026-04-20',
        title: 'Situation Room',
        subtitle: 'Multi-agent debate interface for on-demand market analysis',
        status: 'live',
        color: '#BF5AF2',
        changes: [
            { type: 'new', text: 'Situation Room page — ask any market question, get multi-agent debate with Orion synthesis' },
            { type: 'new', text: 'Streamed agent responses via WebSocket (SITUATION_ROOM_AGENT events)' },
            { type: 'new', text: 'Conversation history maintained across queries (last 6 exchanges feed back to agents)' },
            { type: 'new', text: 'Agent lessons from tournament injected into Situation Room context' },
        ],
    },
    {
        phase: 6,
        date: '2026-04-18',
        title: 'Walk-Forward Backtest Module',
        subtitle: 'Real historical OHLCV, 80/20 train/test split, no look-ahead bias',
        status: 'live',
        color: '#64D2FF',
        changes: [
            { type: 'new', text: 'Backtest engine — fetches real candles from CoinGecko API for any asset/date range' },
            { type: 'new', text: '80/20 train/test split — tests on unseen data only (no look-ahead bias)' },
            { type: 'new', text: 'Applies 0.6% taker fees + 0.1% slippage to all backtest trades' },
            { type: 'new', text: 'Results: total return, Sharpe ratio, max drawdown, win rate, trade count' },
            { type: 'new', text: 'Strategy selector for all 5 agent algorithms' },
        ],
    },
    {
        phase: 5,
        date: '2026-04-15',
        title: 'Strategy Tournament Engine',
        subtitle: 'Agents run shadow portfolios and evolve through genetic mutation',
        status: 'live',
        color: '#FF9F0A',
        changes: [
            { type: 'new', text: 'Shadow portfolios — each agent runs $100k paper book in parallel to track real performance' },
            { type: 'new', text: 'Tournament cycle triggers every 20 closed trades — worst performer is mutated ±15% on parameters' },
            { type: 'new', text: 'Sharpe-weighted voting — better-performing agents get more weight in Orion consensus' },
            { type: 'new', text: 'Agents page — live agent stats, signal, Sharpe, wins/losses, generation, lessons learned' },
            { type: 'new', text: 'Agent autopsy system — after losses, AI records a lesson and updates strategy rules' },
            { type: 'new', text: 'ADX filter for Rex — only signals when trend strength exceeds threshold' },
        ],
    },
    {
        phase: 4,
        date: '2026-04-10',
        title: 'Intelligence Signals + News Feed',
        subtitle: 'Real-time macro signals feeding AI decisions',
        status: 'live',
        color: '#34C759',
        changes: [
            { type: 'new', text: 'Crypto Fear & Greed Index (alternative.me API) — feeds Luna agent and AI prompt' },
            { type: 'new', text: 'DeFi TVL 7-day change (DefiLlama API)' },
            { type: 'new', text: 'Polymarket BTC bull probability (prediction market signal)' },
            { type: 'new', text: 'Composite score — blends all 3 signals into single ±100 number for AI context' },
            { type: 'new', text: 'News feed — RSS from CoinDesk, Cointelegraph, Decrypt, Blockworks, The Defiant' },
            { type: 'new', text: 'Reddit sentiment — r/CryptoCurrency, r/Bitcoin, r/ethereum, r/SatoshiStreetBets' },
            { type: 'new', text: 'Twitter/X integration — crypto accounts via Bearer token (optional)' },
            { type: 'new', text: 'Intelligence page — live dashboard of all signals and news feed' },
        ],
    },
    {
        phase: 3,
        date: '2026-04-05',
        title: 'Dashboard + Portfolio UI',
        subtitle: 'Full trading terminal with AI thesis panel',
        status: 'live',
        color: '#0A84FF',
        changes: [
            { type: 'new', text: 'Dashboard trading terminal — live chart, AI Neural Engine panel, active positions bar' },
            { type: 'new', text: 'Intelligence Strip — Fear & Greed, TVL, Polymarket displayed below metrics' },
            { type: 'new', text: 'Portfolio page — equity curve, trades log, balance, allocation split, unrealized P&L' },
            { type: 'new', text: 'Notification center — alerts for trade executions, circuit breaker events' },
            { type: 'new', text: 'Pending Trade Card — 60-second approval card with full AI reasoning (AI Assisted mode)' },
            { type: 'new', text: 'Risk Settings modal — per-trade max, daily loss limit, stop-loss, take-profit' },
            { type: 'new', text: 'Kill Switch button — instant halt with reason, persists via Supabase' },
        ],
    },
    {
        phase: 2,
        date: '2026-03-28',
        title: 'Multi-Agent AI Engine',
        subtitle: 'Groq + Llama 3.3, 5 strategy agents, Orion synthesizer',
        status: 'live',
        color: '#BF5AF2',
        changes: [
            { type: 'new', text: 'Atlas — Momentum agent (MA crossover + volume)' },
            { type: 'new', text: 'Vera — Mean Reversion agent (RSI + Bollinger Bands)' },
            { type: 'new', text: 'Rex — Trend Following agent (EMA cloud + ADX)' },
            { type: 'new', text: 'Luna — Sentiment agent (Fear & Greed + macro)' },
            { type: 'new', text: 'Orion — Combined synthesizer (Sharpe-weighted consensus vote)' },
            { type: 'new', text: 'Groq API integration (Llama 3.3 70B) with Ollama fallback' },
            { type: 'new', text: 'JSON-mode AI decisions: action, reasoning, confidence, TP%, SL%, position_size_override' },
            { type: 'new', text: 'Paper trading execution with balance tracking and trade history' },
        ],
    },
    {
        phase: 1,
        date: '2026-03-20',
        title: 'Foundation',
        subtitle: 'WebSocket streaming, auth, paper engine core',
        status: 'live',
        color: '#8E8E93',
        changes: [
            { type: 'new', text: 'React + Vite frontend, Express + Node.js backend' },
            { type: 'new', text: 'Coinbase Advanced Trade WebSocket for real-time price streaming' },
            { type: 'new', text: 'Supabase auth (JWT) with encrypted user state storage' },
            { type: 'new', text: 'Paper trading state: balance, holdings, trades per product, product holdings map' },
            { type: 'new', text: 'Zustand state management for frontend' },
            { type: 'new', text: 'Deploy pipeline to Railway (backend) and static hosting (frontend)' },
            { type: 'new', text: 'Debug panel with API call logging, health ping, env var check' },
        ],
    },
];

const FEATURES = [
    {
        section: 'Live Trading Terminal',
        icon: LayoutDashboard,
        color: '#0A84FF',
        items: [
            'Real-time Coinbase WebSocket price streaming for BTC, ETH, SOL, DOGE, XRP and more',
            'Live OHLCV candlestick chart (1-minute candles built from ticks, up to 500 candle history)',
            'OHLC tooltip on hover — open, high, low, close per candle',
            'Trade markers on chart — every executed buy/sell stamped on the timeline',
            'Active Positions Bar — all open positions across coins with live P&L and AI signal badge',
            'Watchlist tab pills — one-click switching between all monitored coins',
            'Intelligence Strip — Fear & Greed, TVL 7d, Polymarket probability below the metrics row',
            'AI Neural Engine panel — live reasoning, confidence score, agent vote breakdown',
        ],
    },
    {
        section: 'Multi-Agent AI Strategy Engine',
        icon: BrainCircuit,
        color: '#BF5AF2',
        items: [
            'Atlas — EMA 9/21 crossover + MACD(5/35/5) confirmation + volume spike detection',
            'Vera — RSI 14 (30/70) + Bollinger Bands + OBV divergence + BB squeeze detection',
            'Rex — EMA cloud + ADX trend strength + MACD confirmation filter',
            'Luna — Crypto Fear & Greed + DeFi TVL + Polymarket sentiment',
            'Nova — OBV accumulation/distribution + MACD momentum convergence (5th agent)',
            'Orion — Sharpe-weighted consensus synthesis of all 5 agents',
            'Agent decisions powered by Groq (Llama 3.3 70B) with Ollama fallback',
            'JSON-mode structured decisions: action, reasoning, confidence, TP%, SL%, size override',
            'Multi-coin parallel evaluation — all watchlist coins evaluated every 15 seconds',
        ],
    },
    {
        section: 'Technical Indicators (computed)',
        icon: BarChart2,
        color: '#FF9F0A',
        items: [
            'SMA (Simple Moving Average)',
            'EMA (Exponential Moving Average)',
            'RSI (Relative Strength Index) — 14-period standard',
            'MACD (Moving Average Convergence Divergence) — 5/35/5 crypto-optimized',
            'Bollinger Bands — 20-period, 2 std dev, with squeeze detection',
            'ADX (Average Directional Index) — trend strength filter',
            'ATR (Average True Range) — used for volatility-scaled position sizing',
            'OBV (On-Balance Volume) — accumulation/distribution trend',
            'BB Width — band compression detection (volatility coiling)',
        ],
    },
    {
        section: 'Strategy Tournament & Evolution',
        icon: Activity,
        color: '#30D158',
        items: [
            'Shadow portfolios — each agent runs an independent $100k paper book',
            'Tournament triggers every 20 closed trades — bottom performer is genetically mutated (±15% params)',
            'Sharpe-weighted voting — higher Sharpe agents have more influence in Orion consensus',
            'Agent autopsy — after losses, AI records a lesson and updates its own rules',
            'Agent lessons persisted to Supabase — survive server restarts',
            'Sharpe ratio tracked per agent using sample variance (n-1)',
            'Agents page — live stats, generation counter, lessons learned, signal history',
        ],
    },
    {
        section: 'Paper Trading Engine',
        icon: FlaskConical,
        color: '#64D2FF',
        items: [
            'Starts with $100,000 virtual capital',
            'Realistic fee simulation: 0.6% Coinbase taker fee + 0.1% slippage = 0.7% per side',
            'Fill prices stored at slippage-adjusted level (not mid-market)',
            'Fee field per trade record for accurate P&L tracking',
            'Multi-product holdings tracking (productHoldings map per user)',
            'Balance, asset holdings, and portfolio value synced live to frontend',
            'Daily P&L tracking with configurable daily loss limit',
        ],
    },
    {
        section: 'Risk Management',
        icon: Shield,
        color: '#FF453A',
        items: [
            'Circuit breaker — auto-halts engine at configurable max drawdown (default 20%)',
            'Kill switch — manual halt button, reason persisted to DB',
            'ATR-based position sizing — risk 2% of portfolio / (ATR × 2) per trade',
            'Fear & Greed size multiplier — 0.5× at extreme greed (>80), 1.25× at extreme fear (<20)',
            'Per-trade max percentage of portfolio',
            'Maximum single order USD cap',
            'Daily loss limit percentage',
            'Take-profit and stop-loss price targets (AI-set or manual)',
            'checkPositions() — monitors TP/SL on every 2s tick and auto-exits',
            'Risk settings modal — all limits configurable from the UI',
        ],
    },
    {
        section: 'Execution Modes',
        icon: Zap,
        color: '#FF9F0A',
        items: [
            'Paper Trading — virtual $100k, all math identical to live, no real money',
            'Full Auto — AI executes immediately without approval',
            'AI Assisted — 60-second approval card with full reasoning, accept or reject',
            'Live Mode — places real Coinbase orders (requires confirmation + API keys)',
        ],
    },
    {
        section: 'Market Intelligence',
        icon: TrendingUp,
        color: '#34C759',
        items: [
            'Crypto Fear & Greed Index (alternative.me) — cached 5 minutes',
            'DeFi Total Value Locked 7-day change (DefiLlama)',
            'Polymarket BTC bull probability (prediction market)',
            'Composite score — weighted blend of all 3 signals (−100 to +100)',
            'Multi-coin momentum rotation scores — 7d×0.6 + 30d×0.4 ranking',
            'RSS news feed: CoinDesk, Cointelegraph, Decrypt, Blockworks, The Defiant',
            'Reddit hot posts: r/CryptoCurrency, r/Bitcoin, r/ethereum, r/SatoshiStreetBets',
            'Twitter/X: high-signal crypto accounts (optional, requires bearer token)',
            'Sentiment scoring on headlines (bullish/bearish/neutral keyword matching)',
        ],
    },
    {
        section: 'Situation Room',
        icon: Radio,
        color: '#BF5AF2',
        items: [
            'On-demand multi-agent debate — ask any market question',
            'Streamed responses from each specialist agent (Atlas, Vera, Rex, Luna, Nova)',
            'Orion synthesis — synthesizes the debate with clear LONG/FLAT/WATCH stance',
            'Conversation history — last 6 exchanges feed back into agent context',
            'Agent lessons and live portfolio state included in every query',
        ],
    },
    {
        section: 'Backtest Module',
        icon: Binary,
        color: '#64D2FF',
        items: [
            'Real OHLCV historical data from CoinGecko API',
            '80/20 walk-forward train/test split (no look-ahead bias)',
            '0.6% taker fees + 0.1% slippage applied to all backtest trades',
            'Metrics: total return, Sharpe ratio, max drawdown, win rate, number of trades',
            'Strategy selector covering all 5 agent algorithms',
        ],
    },
    {
        section: 'Infrastructure & Persistence',
        icon: Package,
        color: '#8E8E93',
        items: [
            'Backend: Node.js + Express on Railway (auto-deploy from GitHub)',
            'Frontend: React + Vite + Zustand + react-router-dom',
            'WebSocket: real-time bidirectional (price ticks, AI signals, trade execution, debug logs)',
            'Supabase: user auth (JWT), portfolio state, trade history, strategy lessons',
            'Encrypted API key storage for future live trading integration',
            'Debug panel: all WS events, API calls, server errors — Copy All to clipboard',
            'SERVER_LOG WebSocket event — server errors forwarded to browser debug panel',
            'Groq 429 retry with exponential backoff (2s/4s/8s)',
        ],
    },
];

const ROADMAP = [
    {
        status: 'planned',
        priority: 'high',
        title: 'Coinbase Advanced Trade API — Real Money Execution',
        desc: 'Users connect their own Coinbase API keys. App never holds funds — sends order instructions on their behalf. Market orders, limit orders, stop-limit support. No money transmitter license required.',
    },
    {
        status: 'planned',
        priority: 'high',
        title: 'Multi-Exchange Support',
        desc: 'Exchange adapter pattern: Kraken, Binance US, Bybit, Gemini. Unified order interface regardless of exchange. User selects preferred exchange in setup wizard.',
    },
    {
        status: 'planned',
        priority: 'high',
        title: 'Mobile App (TestFlight / App Store)',
        desc: 'Capacitor wrapper around existing React frontend for native iOS distribution via TestFlight. PWA "Add to Home Screen" available now from the Railway URL as interim solution.',
    },
    {
        status: 'planned',
        priority: 'medium',
        title: 'On-Chain Signals',
        desc: 'MVRV Z-Score (historically predicts BTC cycle tops within 2 weeks), exchange USDT flows (inflows = bearish, outflows = bullish accumulation), NVT ratio, active addresses. Sources: Glassnode API, CoinMetrics.',
    },
    {
        status: 'planned',
        priority: 'medium',
        title: 'Funding Rate + Open Interest Signals',
        desc: 'Derivatives market sentiment proxy for spot traders. High funding rates (>100% annualized) = leveraged imbalance, potential volatility. Rising OI + rising price = trend continuation. Source: CoinGlass API.',
    },
    {
        status: 'planned',
        priority: 'medium',
        title: 'Grid Trading Bot Mode',
        desc: 'Automated buy/sell at price intervals within a configured range. Excels in sideways/volatile markets. Runs parallel to AI strategy engine. Configurable grid size, lower/upper bounds, total investment.',
    },
    {
        status: 'planned',
        priority: 'medium',
        title: 'DCA (Dollar-Cost Averaging) Mode',
        desc: 'Scheduled buys at fixed intervals (hourly/daily/weekly). Shown to outperform buy-and-hold for volatile assets like SOL (+80.92% vs hold). Optional RSI filter to pause DCA when overbought.',
    },
    {
        status: 'planned',
        priority: 'medium',
        title: 'Stochastic RSI + Ichimoku Cloud Agents',
        desc: 'StochRSI agent for intraday crypto entries (more sensitive than RSI for short timeframes). Ichimoku cloud agent for multi-component trend confluence (Tenkan/Kijun cross, cloud support/resistance).',
    },
    {
        status: 'planned',
        priority: 'medium',
        title: 'Push Notifications',
        desc: 'Web Push API notifications for trade executions, kill switch triggers, circuit breaker alerts, and significant signal changes. Works on mobile via PWA.',
    },
    {
        status: 'planned',
        priority: 'low',
        title: 'Custom Agent Builder',
        desc: 'UI to define a new strategy agent: choose indicator combination, parameters, signal logic. Agent enters tournament on creation and competes against defaults.',
    },
    {
        status: 'planned',
        priority: 'low',
        title: 'Social / Leaderboard',
        desc: 'Opt-in leaderboard showing anonymized paper trading performance across users. Strategy sharing: publish a winning agent configuration for others to clone.',
    },
    {
        status: 'planned',
        priority: 'low',
        title: 'Multi-LLM Backend Selection',
        desc: 'Let users choose which AI model powers their agents: Groq (Llama 3.3), Anthropic (Claude), OpenAI (GPT-4o), or local Ollama. Model-agnostic interface already partially in place.',
    },
];

const TUTORIAL_SECTIONS = [
    {
        id: 'quickstart',
        title: 'Quick Start',
        icon: Rocket,
        color: '#0A84FF',
        steps: [
            { title: 'Sign In', body: 'Create an account or log in. Your portfolio state, trades, and agent lessons are tied to your account and persisted in Supabase.' },
            { title: 'Set Your Mode', body: 'Start in Paper Trading + AI Assisted. Paper uses virtual $100k — identical math to live, just not real money. AI Assisted shows you a 60-second approval card before each trade so you can see exactly what the AI is thinking.' },
            { title: 'Start the Engine', body: 'Hit the ENGINE button in the top bar to RUNNING. The AI will begin collecting candles (needs ~5 to warm up), then evaluate your watchlist every 15 seconds.' },
            { title: 'Watch the First Trade', body: 'When the AI wants to trade, a card appears bottom-right: "AI Wants to BUY 0.0024 BTC at $83,241 — Confidence 78%". Read the reasoning, accept or reject.' },
            { title: 'Monitor Your Portfolio', body: 'Switch to the Portfolio tab. You\'ll see your balance, holdings, equity curve, and trade log update in real time as trades execute.' },
        ],
    },
    {
        id: 'terminal',
        title: 'Trading Terminal',
        icon: LayoutDashboard,
        color: '#0A84FF',
        steps: [
            { title: 'Coin Tabs', body: 'The row of pills above the chart (BTC / ETH / SOL / DOGE / XRP) switches the active chart. Click any pill to switch — the AI evaluates all coins in parallel.' },
            { title: 'Active Positions Bar', body: 'If you hold any positions, a strip appears below the metrics row showing each coin you\'re in: symbol, quantity, live price, unrealized P&L %, and the last AI signal (BUY/SELL/HOLD). Click a position to switch chart to that coin.' },
            { title: 'Candlestick Chart', body: 'Each candle is 1 minute of price action built live from WebSocket ticks. Up to 500 candles of history load on connect. Hover any candle to see open/high/low/close. Buy and sell markers appear as colored triangles on the chart.' },
            { title: 'Intelligence Strip', body: 'Below the price metrics: Fear & Greed index, DeFi TVL 7d change, Polymarket BTC bull probability, and composite score. These are the same macro signals feeding the AI.' },
            { title: 'Neural Engine Panel', body: 'Right side of the dashboard: shows what the AI just decided and why. Full reasoning text, confidence score (0-100%), and the 5-agent vote breakdown (what each agent said).' },
        ],
    },
    {
        id: 'agents',
        title: 'AI Agents',
        icon: BrainCircuit,
        color: '#BF5AF2',
        steps: [
            { title: 'The 5 Specialist Agents', body: 'Atlas (Momentum: EMA crossover + MACD), Vera (Mean Reversion: RSI + BB + OBV), Rex (Trend: EMA cloud + ADX + MACD), Luna (Sentiment: Fear & Greed + macro), Nova (Volume: OBV + MACD divergence). Each votes BUY/SELL/HOLD with a strength score.' },
            { title: 'Orion — Chief Synthesizer', body: 'Orion doesn\'t compute indicators directly. It reads the 5 agent votes (weighted by their Sharpe ratios) and the full market context, then makes the final call via the Groq LLM. Its reasoning explains which agents it\'s agreeing with and why.' },
            { title: 'Shadow Portfolios', body: 'Each agent runs an independent $100k paper book in the background. This is how the system tracks whether Atlas\'s signals actually make money vs Vera\'s — the shadow portfolio shows the real track record.' },
            { title: 'The Tournament', body: 'Every 20 closed trades, a tournament runs. Agents are ranked by Sharpe ratio. The worst performer\'s parameters are randomly mutated ±15% and it restarts at generation+1. Over time this evolves toward the parameter set that actually works for current market conditions.' },
            { title: 'Lessons', body: 'After a losing trade, the AI runs an autopsy — it analyzes what went wrong and writes a lesson ("Do not buy BTC when RSI is above 75 and F&G is above 80"). These lessons persist in Supabase and feed back into future decisions.' },
        ],
    },
    {
        id: 'risk',
        title: 'Risk Management',
        icon: Shield,
        color: '#FF453A',
        steps: [
            { title: 'Risk Settings (gear icon)', body: 'Configure: max trade size (% of portfolio), daily loss limit (%), max single order USD, stop-loss %, take-profit %, Kelly criterion sizing toggle.' },
            { title: 'ATR-Based Sizing', body: 'When recent candles are available, position size is computed as: risk 2% of portfolio ÷ (ATR × 2). In a volatile market, BTC gets a smaller position. In a quiet market, it gets a larger one. This is standard prop-firm risk management.' },
            { title: 'Fear & Greed Multiplier', body: 'When Fear & Greed index is above 80 (extreme greed), all trade sizes are automatically cut to 50% — the AI shouldn\'t be chasing tops. When below 20 (extreme fear), sizes get a 25% boost — buy the blood.' },
            { title: 'Circuit Breaker', body: 'If your total portfolio value drops more than 20% from peak, the circuit breaker trips automatically and halts all AI activity. This is your hard stop. You can reset it manually once you\'ve reviewed what happened.' },
            { title: 'Kill Switch', body: 'The red KILL button in the top bar instantly halts all AI evaluation and trade execution. The reason you enter is stored in the database and shown on reconnect. Press Reset to resume.' },
        ],
    },
    {
        id: 'modes',
        title: 'Execution Modes',
        icon: Zap,
        color: '#FF9F0A',
        steps: [
            { title: 'Paper + AI Assisted (recommended start)', body: 'Virtual money, you approve every trade. Best way to learn the system — you see full reasoning before any execution, with no financial risk.' },
            { title: 'Paper + Full Auto', body: 'Virtual money, AI executes immediately. Good for letting the tournament run overnight and accumulating shadow portfolio data without monitoring.' },
            { title: 'Live + AI Assisted', body: 'Real Coinbase orders, but you approve each one with a 60-second window. The AI shows its reasoning and confidence — you\'re the final check.' },
            { title: 'Live + Full Auto', body: 'Real orders, AI executes immediately. Only use this after you\'ve verified the AI\'s behavior over many paper trades and are comfortable with the risk limits you\'ve set.' },
            { title: 'Switching Modes', body: 'Use the mode selector in the top bar. Switching to Live mode requires an explicit confirmation modal. Your risk settings apply in all modes — the circuit breaker and kill switch are always active.' },
        ],
    },
    {
        id: 'situation',
        title: 'Situation Room',
        icon: Radio,
        color: '#BF5AF2',
        steps: [
            { title: 'What It Is', body: 'The Situation Room is an on-demand multi-agent debate. You ask a market question and each of the 5 specialist agents responds in character, then Orion synthesizes the debate into an actionable stance.' },
            { title: 'Example Queries', body: '"Should I buy ETH right now?" / "What\'s the macro picture for BTC this week?" / "Why did the AI sell SOL at a loss?" / "Which coin has the best momentum?" / "What would you do differently given the current Fear & Greed of 32?"' },
            { title: 'Context It Has', body: 'Every query includes: your live portfolio state, current prices, Fear & Greed, composite score, recent news headlines, agent lessons, and conversation history. The agents know what you\'re holding and at what price.' },
            { title: 'Rate Limiting', body: 'Situation Room uses Groq (5 sequential agent calls + Orion synthesis = 6 total). On the free Groq tier, this can take 10-20 seconds. Responses auto-retry on 429 errors with backoff.' },
        ],
    },
    {
        id: 'debug',
        title: 'Debug & Troubleshooting',
        icon: Terminal,
        color: '#8E8E93',
        steps: [
            { title: 'Debug Panel', body: 'Click the orange bug icon (bottom-right corner). Shows all API calls, WebSocket events, server errors, and AI status changes in real time with timestamps.' },
            { title: 'Copy All Logs', body: 'The "Copy" button in the debug panel formats all logs as clean timestamped text. Paste directly to Claude (or any support channel) to share exactly what happened.' },
            { title: 'Server Errors in Browser', body: 'AI eval failures, kill switch trips, and circuit breaker events are forwarded from the server to the debug panel via SERVER_LOG WebSocket events. You don\'t need server logs access to diagnose most issues.' },
            { title: '"AI eval failed for BTC-USD"', body: 'Usually a Groq rate limit (429). The system retries automatically. If it persists: check your GROQ_API_KEY is valid and you haven\'t exhausted the free tier (30 req/min). Reduce watchlist size or increase eval interval.' },
            { title: 'Kill Switch Won\'t Reset', body: 'Check the debug panel for the reason. If it says "TAKE-PROFIT triggered at $X (target: $Y)" where Y is a price from a different coin, this was the cross-product TP/SL bug (fixed in Phase 9). Refresh and try reset again.' },
        ],
    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const badge = (status) => {
    const map = {
        live:    { bg: 'rgba(52,199,89,0.15)',  color: '#34C759', label: 'LIVE' },
        planned: { bg: 'rgba(255,159,10,0.15)', color: '#FF9F0A', label: 'PLANNED' },
        wip:     { bg: 'rgba(10,132,255,0.15)', color: '#0A84FF', label: 'IN PROGRESS' },
    };
    const s = map[status] || map.planned;
    return (
        <span style={{
            fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.08em',
            padding: '0.15rem 0.5rem', borderRadius: '4px',
            background: s.bg, color: s.color,
        }}>
            {s.label}
        </span>
    );
};

const priorityDot = (p) => {
    const c = p === 'high' ? '#FF453A' : p === 'medium' ? '#FF9F0A' : '#8E8E93';
    return <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block', marginRight: '0.4rem', flexShrink: 0 }} />;
};

const changeIcon = (type) => {
    if (type === 'new')     return <span style={{ color: '#34C759', fontWeight: 700, fontSize: '0.7rem', marginRight: '0.4rem', flexShrink: 0 }}>NEW</span>;
    if (type === 'upgrade') return <span style={{ color: '#0A84FF', fontWeight: 700, fontSize: '0.7rem', marginRight: '0.4rem', flexShrink: 0 }}>UPG</span>;
    if (type === 'fix')     return <span style={{ color: '#FF9F0A', fontWeight: 700, fontSize: '0.7rem', marginRight: '0.4rem', flexShrink: 0 }}>FIX</span>;
    return null;
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChangelogPage() {
    const [tab, setTab] = useState('tutorial');
    const [openPhase, setOpenPhase] = useState(null);
    const [openTutorial, setOpenTutorial] = useState('quickstart');
    const [openFeature, setOpenFeature] = useState(null);

    const tabs = [
        { id: 'tutorial',  label: 'Tutorial',   icon: BookOpen },
        { id: 'features',  label: 'Features',   icon: Layers },
        { id: 'changelog', label: 'Changelog',  icon: GitCommit },
        { id: 'roadmap',   label: 'Roadmap',    icon: Map },
    ];

    return (
        <div style={{
            minHeight: '100vh',
            padding: '2rem',
            maxWidth: '900px',
            margin: '0 auto',
            fontFamily: 'var(--font-sans, system-ui)',
        }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <Cpu size={28} color="#FF9F0A" />
                    <h1 style={{
                        fontFamily: 'var(--font-display, system-ui)',
                        fontSize: '1.8rem',
                        fontWeight: 900,
                        color: 'var(--text-primary, #fff)',
                        letterSpacing: '-0.02em',
                    }}>
                        Quant Platform Docs
                    </h1>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem' }}>
                    Complete reference — tutorial, feature list, full changelog, and roadmap.
                </p>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.35rem',
                marginBottom: '2rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px',
                padding: '0.3rem',
            }}>
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '9px',
                            border: 'none',
                            background: tab === id ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: tab === id ? 'var(--text-primary, #fff)' : 'rgba(255,255,255,0.4)',
                            fontSize: '0.82rem',
                            fontWeight: tab === id ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── TUTORIAL TAB ── */}
            {tab === 'tutorial' && (
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    {/* Sidebar */}
                    <div style={{ width: '180px', flexShrink: 0 }}>
                        {TUTORIAL_SECTIONS.map(({ id, title, icon: Icon, color }) => (
                            <button
                                key={id}
                                onClick={() => setOpenTutorial(id)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 0.75rem',
                                    marginBottom: '0.3rem',
                                    borderRadius: '9px',
                                    border: 'none',
                                    background: openTutorial === id ? `${color}15` : 'transparent',
                                    color: openTutorial === id ? color : 'rgba(255,255,255,0.45)',
                                    fontSize: '0.8rem',
                                    fontWeight: openTutorial === id ? 700 : 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Icon size={13} />
                                {title}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                        {TUTORIAL_SECTIONS.filter(s => s.id === openTutorial).map(({ title, icon: Icon, color, steps }) => (
                            <div key={title}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '10px',
                                        background: `${color}18`, border: `1px solid ${color}30`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Icon size={18} color={color} />
                                    </div>
                                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #fff)' }}>{title}</h2>
                                </div>

                                {steps.map((step, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        marginBottom: '1.25rem',
                                        paddingBottom: '1.25rem',
                                        borderBottom: i < steps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                    }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                            background: `${color}18`, border: `1px solid ${color}40`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.72rem', fontWeight: 800, color,
                                            fontFamily: 'var(--font-mono)',
                                            marginTop: '0.1rem',
                                        }}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary, #fff)', marginBottom: '0.3rem' }}>
                                                {step.title}
                                            </div>
                                            <div style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                                                {step.body}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── FEATURES TAB ── */}
            {tab === 'features' && (
                <div>
                    {FEATURES.map(({ section, icon: Icon, color, items }) => {
                        const isOpen = openFeature === section;
                        return (
                            <div key={section} style={{
                                marginBottom: '0.5rem',
                                background: 'rgba(255,255,255,0.025)',
                                border: `1px solid ${isOpen ? color + '35' : 'rgba(255,255,255,0.07)'}`,
                                borderRadius: '12px',
                                overflow: 'hidden',
                                transition: 'border-color 0.2s',
                            }}>
                                <button
                                    onClick={() => setOpenFeature(isOpen ? null : section)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.9rem 1.1rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-primary, #fff)',
                                    }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '8px',
                                        background: `${color}15`, border: `1px solid ${color}25`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <Icon size={15} color={color} />
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1, textAlign: 'left' }}>{section}</span>
                                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', marginRight: '0.5rem' }}>
                                        {items.length} features
                                    </span>
                                    <ChevronRight size={14} color="rgba(255,255,255,0.3)" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>

                                {isOpen && (
                                    <div style={{ padding: '0 1.1rem 1rem 1.1rem' }}>
                                        {items.map((item, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '0.6rem',
                                                padding: '0.4rem 0',
                                                borderTop: '1px solid rgba(255,255,255,0.04)',
                                            }}>
                                                <CheckCircle2 size={13} color={color} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── CHANGELOG TAB ── */}
            {tab === 'changelog' && (
                <div>
                    {CHANGELOG.map((entry) => {
                        const isOpen = openPhase === entry.phase;
                        return (
                            <div key={entry.phase} style={{
                                marginBottom: '0.5rem',
                                background: 'rgba(255,255,255,0.025)',
                                border: `1px solid ${isOpen ? entry.color + '40' : 'rgba(255,255,255,0.07)'}`,
                                borderRadius: '12px',
                                overflow: 'hidden',
                            }}>
                                <button
                                    onClick={() => setOpenPhase(isOpen ? null : entry.phase)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.9rem 1.1rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '9px', flexShrink: 0,
                                        background: `${entry.color}15`, border: `1px solid ${entry.color}30`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.7rem', fontWeight: 900, color: entry.color,
                                        fontFamily: 'var(--font-mono)',
                                    }}>
                                        v{entry.phase}
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary, #fff)' }}>{entry.title}</span>
                                            {badge(entry.status)}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                                            {entry.date} — {entry.subtitle}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)' }}>
                                            {entry.changes.length} changes
                                        </span>
                                        <ChevronRight size={14} color="rgba(255,255,255,0.25)" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                    </div>
                                </button>

                                {isOpen && (
                                    <div style={{ padding: '0 1.1rem 1rem 4.1rem' }}>
                                        {entry.changes.map((c, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                padding: '0.35rem 0',
                                                borderTop: '1px solid rgba(255,255,255,0.04)',
                                            }}>
                                                {changeIcon(c.type)}
                                                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{c.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── ROADMAP TAB ── */}
            {tab === 'roadmap' && (
                <div>
                    <div style={{
                        background: 'rgba(255,159,10,0.07)',
                        border: '1px solid rgba(255,159,10,0.2)',
                        borderRadius: '10px',
                        padding: '0.75rem 1rem',
                        fontSize: '0.82rem',
                        color: 'rgba(255,255,255,0.5)',
                        marginBottom: '1.5rem',
                        lineHeight: 1.5,
                    }}>
                        <AlertTriangle size={13} color="#FF9F0A" style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                        These are desired features — not committed timelines. Priority reflects current development focus.
                    </div>

                    {['high', 'medium', 'low'].map(priority => (
                        <div key={priority} style={{ marginBottom: '1.75rem' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                color: priority === 'high' ? '#FF453A' : priority === 'medium' ? '#FF9F0A' : '#8E8E93',
                            }}>
                                {priorityDot(priority)} {priority} priority
                            </div>

                            {ROADMAP.filter(r => r.priority === priority).map((item, i) => (
                                <div key={i} style={{
                                    background: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: '10px',
                                    padding: '0.9rem 1.1rem',
                                    marginBottom: '0.5rem',
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignItems: 'flex-start',
                                }}>
                                    <Clock size={14} color="rgba(255,255,255,0.2)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary, #fff)' }}>{item.title}</span>
                                            {badge(item.status)}
                                        </div>
                                        <p style={{ fontSize: '0.81rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, margin: 0 }}>{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
