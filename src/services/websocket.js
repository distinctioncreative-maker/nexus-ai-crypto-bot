import { useStore } from '../store/useStore';
import { getAccessToken } from '../lib/supabase';
import { wsUrl as getBackendWsUrl } from '../lib/api';

let ws = null;
let deliberateClose = false;

export const initWebSocket = async () => {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    deliberateClose = false;

    const token = await getAccessToken();
    const { selectedProduct } = useStore.getState();
    const wsUrl = `${getBackendWsUrl()}?${token ? `token=${token}&` : ''}product=${encodeURIComponent(selectedProduct)}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        useStore.getState().setWsConnected(true);
        useStore.getState().setAiStatus('🟢 Active — Streaming Intelligence');
        console.log("WebSocket Connected to Quant Core");
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const store = useStore.getState();

        switch (message.type) {
            case 'TICK':
                store.addMarketPoint({
                    time: Math.floor(Date.now() / 1000),
                    value: message.payload.price
                });
                store.setCurrentPrice(message.payload.price);
                // Track price per product so Portfolio can show P&L for selected product
                if (message.payload.product) {
                    store.updateProductPrices({ [message.payload.product]: message.payload.price });
                }
                break;

            case 'PORTFOLIO_STATE':
                store.setBalance(message.payload.balance ?? 0);
                store.setAssetHoldings(message.payload.assetHoldings ?? 0);
                if (Array.isArray(message.payload.trades)) {
                    store.setTrades(message.payload.trades);
                }
                if (message.payload.riskSettings) {
                    store.setRiskSettings(message.payload.riskSettings);
                }
                if (message.payload.tradingMode) {
                    store.setTradingMode(message.payload.tradingMode);
                }
                if (message.payload.engineStatus) {
                    store.setEngineStatus(message.payload.engineStatus);
                } else if (typeof message.payload.isLiveMode === 'boolean') {
                    store.setIsLiveMode(message.payload.isLiveMode);
                }
                if (message.payload.selectedProduct) {
                    store.setSelectedProduct(message.payload.selectedProduct);
                }
                if (message.payload.productHoldings) {
                    store.setProductHoldings(message.payload.productHoldings);
                }
                break;

            case 'CANDLE_HISTORY':
                if (Array.isArray(message.payload) && message.payload.length > 0) {
                    store.setMarketHistory(message.payload);
                }
                break;

            case 'HOLDINGS_PRICES':
                if (message.payload && typeof message.payload === 'object') {
                    store.updateProductPrices(message.payload);
                }
                break;

            case 'ENGINE_STATE':
                if (message.payload?.engineStatus) store.setEngineStatus(message.payload.engineStatus);
                if (message.payload?.tradingMode) store.setTradingMode(message.payload.tradingMode);
                if (typeof message.payload?.isLiveMode === 'boolean') store.setIsLiveMode(message.payload.isLiveMode);
                if (typeof message.payload?.killSwitch === 'boolean') {
                    store.setKillSwitchActive(message.payload.killSwitch, message.payload.killSwitchReason || '');
                }
                break;

            case 'AI_STATUS':
                store.setAiStatus(message.payload);
                break;

            case 'TRADE_EXEC':
                store.addTrade(message.payload);
                store.setBalance(message.payload.newBalance ?? store.balance);
                store.setAssetHoldings(message.payload.newAssetHoldings ?? store.assetHoldings);
                store.addAuditLog({
                    id: Date.now(),
                    action: message.payload.type,
                    amount: message.payload.amount,
                    price: message.payload.price,
                    reason: message.payload.reason,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'PENDING_TRADE':
                store.setPendingTrade(message.payload);
                break;

            case 'NOTIFICATION':
                if (message.payload) store.addNotification(message.payload);
                break;

            case 'STRATEGY_UPDATE':
                if (Array.isArray(message.payload)) store.setStrategies(message.payload);
                break;

            case 'KILL_SWITCH_ALERT':
                store.setKillSwitchActive(!!message.payload?.reason, message.payload?.reason || '');
                break;

            case 'SITUATION_ROOM_AGENT':
                if (ws._situationRoomOnAgent) {
                    const { agentId, name, role, color, text } = message.payload;
                    ws._situationRoomOnAgent(agentId, name, role, color, text);
                }
                break;

            case 'SITUATION_ROOM_DONE':
                if (ws._situationRoomOnDone) {
                    ws._situationRoomOnDone();
                    ws._situationRoomOnDone = null;
                    ws._situationRoomOnAgent = null;
                }
                break;

            default:
                break;
        }
    };

    ws.onclose = () => {
        useStore.getState().setWsConnected(false);
        if (!deliberateClose) {
            useStore.getState().setAiStatus('🔴 Connection Lost — Reconnecting…');
        }
        ws = null;
        if (!deliberateClose) {
            setTimeout(initWebSocket, 5000);
        }
    };

    ws.onerror = (err) => {
        console.error("WebSocket Error:", err);
    };
};

export const closeWebSocket = () => {
    if (ws) {
        deliberateClose = true;
        ws.close();
        ws = null;
    }
};

// Send a product change request to the backend
export const sendProductChange = (productId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CHANGE_PRODUCT', payload: { productId } }));
        useStore.getState().clearMarketHistory();
        useStore.getState().setSelectedProduct(productId);
    }
};

export const sendConfirmTrade = (tradeId, accepted, amount) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CONFIRM_TRADE', payload: { tradeId, accepted, amount } }));
        useStore.getState().clearPendingTrade(); // Only clear after successful WS send
    } else {
        // WS is down — don't clear pending trade so user can retry when reconnected
        console.warn('sendConfirmTrade: WebSocket not connected, trade not sent');
    }
};

export const sendKillSwitch = (activate, reason = '') => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'KILL_SWITCH', payload: { activate, reason } }));
    }
};

export const sendTradingModeChange = (mode) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'SET_TRADING_MODE', payload: { mode } }));
        useStore.getState().setTradingMode(mode);
    }
};

export const sendSituationRoomQuery = (message, onAgent, onDone) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws._situationRoomOnAgent = onAgent;
        ws._situationRoomOnDone = onDone;
        ws.send(JSON.stringify({ type: 'SITUATION_ROOM_QUERY', payload: { message } }));
    } else {
        onAgent('ERROR', 'System', 'Error', '#ff453a', 'WebSocket not connected. Try refreshing the page.');
        onDone();
    }
};

export const sendEngineStatusChange = (engineStatus) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'SET_ENGINE_STATUS', payload: { engineStatus } }));
    }
    useStore.getState().setEngineStatus(engineStatus);
};
