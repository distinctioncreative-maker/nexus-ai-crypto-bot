import { create } from 'zustand';

// Global state using Zustand for ultra-fast re-rendering during WebSocket ticks
export const useStore = create((set) => ({
    // Auth & Modes
    isConfigured: false,
    setIsConfigured: (status) => set({ isConfigured: status }),
    hasCoinbaseKeys: false,
    setHasCoinbaseKeys: (v) => set({ hasCoinbaseKeys: v }),
    isLiveMode: false,
    setIsLiveMode: (status) => set({ isLiveMode: status }),
    engineStatus: 'STOPPED',
    setEngineStatus: (engineStatus) => set({
        engineStatus,
        isLiveMode: engineStatus === 'LIVE_RUNNING'
    }),

    // Trading mode: FULL_AUTO | AI_ASSISTED
    tradingMode: 'FULL_AUTO',
    setTradingMode: (mode) => set({ tradingMode: mode }),

    // Instrument selection
    selectedProduct: 'BTC-USD',
    setSelectedProduct: (product) => set({ selectedProduct: product, marketHistory: [], candleHistory: [], currentPrice: 0 }),

    // Multi-asset watchlist
    watchlist: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD'],
    setWatchlist: (watchlist) => set({ watchlist }),

    // Per-product AI signals from PRODUCT_SIGNAL messages
    productSignals: {},
    setProductSignal: (product, signal) => set((state) => ({
        productSignals: { ...state.productSignals, [product]: signal }
    })),

    // WebSockets & Market Data
    wsConnected: false,
    setWsConnected: (status) => set({ wsConnected: status }),
    currentPrice: 0,
    setCurrentPrice: (price) => set({ currentPrice: price }),
    marketHistory: [],
    addMarketPoint: (point) => set((state) => {
        const last = state.marketHistory[state.marketHistory.length - 1];
        if (last && last.value === point.value) return {}; // skip duplicate price
        const newHistory = [...state.marketHistory, point];
        if (newHistory.length > 500) newHistory.shift();
        return { marketHistory: newHistory };
    }),
    clearMarketHistory: () => set({ marketHistory: [], candleHistory: [], currentPrice: 0 }),
    setMarketHistory: (points) => set({ marketHistory: points }),
    // OHLCV candlestick data — used by the chart for proper candlestick rendering
    candleHistory: [],
    setCandleHistory: (candles) => set({ candleHistory: candles }),
    // Update the current 1-minute candle in place (called on every TICK)
    updateLiveCandle: (price) => set((state) => {
        const nowSecs = Math.floor(Date.now() / 1000);
        const minuteTime = nowSecs - (nowSecs % 60);
        const history = [...state.candleHistory];
        if (history.length === 0) {
            return { candleHistory: [{ time: minuteTime, open: price, high: price, low: price, close: price }] };
        }
        const last = history[history.length - 1];
        if (last.time === minuteTime) {
            history[history.length - 1] = {
                time: minuteTime,
                open: last.open,
                high: Math.max(last.high, price),
                low: Math.min(last.low, price),
                close: price
            };
        } else if (minuteTime > last.time) {
            history.push({ time: minuteTime, open: last.close, high: price, low: price, close: price });
            if (history.length > 500) history.shift();
        }
        return { candleHistory: history };
    }),
    lastTickTime: 0,
    setLastTickTime: (t) => set({ lastTickTime: t }),

    // Portfolio State
    balance: 0,
    setBalance: (balance) => set({ balance }),
    assetHoldings: 0,
    setAssetHoldings: (assetHoldings) => set({ assetHoldings }),
    trades: [],
    addTrade: (trade) => set((state) => ({ trades: [trade, ...state.trades] })),
    setTrades: (trades) => set({ trades }),
    // Multi-asset holdings: { 'BTC-USD': { assetHoldings, trades[] }, ... }
    productHoldings: {},
    setProductHoldings: (productHoldings) => set({ productHoldings }),
    // Live prices for all held products (updated from HOLDINGS_PRICES WS messages)
    productPrices: {},
    updateProductPrices: (prices) => set((state) => ({ productPrices: { ...state.productPrices, ...prices } })),

    // AI & Audit
    aiStatus: 'Standby',
    setAiStatus: (status) => set({ aiStatus: status }),
    aiThesis: '',
    setAiThesis: (thesis) => set({ aiThesis: thesis }),
    auditLogs: [],
    addAuditLog: (log) => set((state) => ({ auditLogs: [log, ...state.auditLogs] })),

    // Notifications
    notifications: [],
    unreadCount: 0,
    addNotification: (notif) => set((state) => ({
        notifications: [notif, ...state.notifications].slice(0, 50),
        unreadCount: state.unreadCount + 1
    })),
    markAllRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
    })),
    clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

    // Pending trade (AI Assisted mode)
    pendingTrade: null,
    setPendingTrade: (trade) => set({ pendingTrade: trade }),
    clearPendingTrade: () => set({ pendingTrade: null }),

    // Available products (full Coinbase catalog)
    availableProducts: [],
    setAvailableProducts: (products) => set({ availableProducts: products }),

    // Risk settings (synced from backend on connect)
    riskSettings: {
        maxTradePercent: 2,
        dailyLossLimitPercent: 5,
        maxSingleOrderUSD: 1000,
        maxPositionPercent: 40,
        volatilityReduceThreshold: 8,
        stopLossPercent: 3,
        takeProfitPercent: 6,
        enableKellySize: false,
        stopLossPrice: null,
        takeProfitPrice: null,
        multiTpLevels: null,
        trailingStopPct: null
    },
    setRiskSettings: (settings) => set({ riskSettings: settings }),

    // Strategy tournament data
    strategies: [],
    setStrategies: (strategies) => set({ strategies }),

    // Kill switch
    killSwitchActive: false,
    killSwitchReason: '',
    setKillSwitchActive: (active, reason = '') => set({ killSwitchActive: active, killSwitchReason: reason }),

    // UI Features
    tutorialsActive: false,
    toggleTutorials: () => set((state) => ({ tutorialsActive: !state.tutorialsActive })),
}));
