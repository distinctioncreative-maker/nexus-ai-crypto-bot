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
    setSelectedProduct: (product) => set({ selectedProduct: product, marketHistory: [], currentPrice: 0 }),

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
    clearMarketHistory: () => set({ marketHistory: [], currentPrice: 0 }),
    setMarketHistory: (points) => set({ marketHistory: points }),
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
