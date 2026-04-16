import { create } from 'zustand';

// Global state using Zustand for ultra-fast re-rendering during WebSocket ticks
export const useStore = create((set) => ({
    // Auth & Modes
    isConfigured: false,
    setIsConfigured: (status) => set({ isConfigured: status }),
    isLiveMode: false,
    toggleTradingMode: () => set((state) => ({ isLiveMode: !state.isLiveMode })),

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
        const newHistory = [...state.marketHistory, point];
        if (newHistory.length > 500) newHistory.shift(); // keep graph performant
        return { marketHistory: newHistory };
    }),
    clearMarketHistory: () => set({ marketHistory: [], currentPrice: 0 }),

    // Portfolio State
    balance: 0,
    setBalance: (balance) => set({ balance }),
    assetHoldings: 0,
    setAssetHoldings: (assetHoldings) => set({ assetHoldings }),
    trades: [],
    addTrade: (trade) => set((state) => ({ trades: [trade, ...state.trades] })),
    setTrades: (trades) => set({ trades }),

    // AI & Audit
    aiStatus: 'Standby',
    setAiStatus: (status) => set({ aiStatus: status }),
    auditLogs: [],
    addAuditLog: (log) => set((state) => ({ auditLogs: [log, ...state.auditLogs] })),

    // UI Features
    tutorialsActive: false,
    toggleTutorials: () => set((state) => ({ tutorialsActive: !state.tutorialsActive })),
}));
