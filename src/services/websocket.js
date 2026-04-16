import { useStore } from '../store/useStore';
import { getAccessToken } from '../lib/supabase';
import { wsUrl as getBackendWsUrl } from '../lib/api';

let ws = null;

export const initWebSocket = async () => {
    if (ws && ws.readyState === WebSocket.OPEN) return;

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
                break;

            case 'PORTFOLIO_STATE':
                // Initialize portfolio from backend on connect
                store.setBalance(message.payload.balance ?? 0);
                store.setAssetHoldings(message.payload.assetHoldings ?? 0);
                if (Array.isArray(message.payload.trades)) {
                    store.setTrades(message.payload.trades);
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

            default:
                break;
        }
    };

    ws.onclose = () => {
        useStore.getState().setWsConnected(false);
        useStore.getState().setAiStatus('🔴 Connection Lost — Reconnecting…');
        ws = null;
        setTimeout(initWebSocket, 5000);
    };

    ws.onerror = (err) => {
        console.error("WebSocket Error:", err);
    };
};

export const closeWebSocket = () => {
    if (ws) {
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
