import { useStore } from '../store/useStore';
import { getAccessToken } from '../lib/supabase';
import { wsUrl as getBackendWsUrl } from '../lib/api';

let ws = null;

export const initWebSocket = async () => {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    const token = await getAccessToken();
    const wsUrl = `${getBackendWsUrl()}${token ? `?token=${token}` : ''}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        useStore.getState().setWsConnected(true);
        useStore.getState().setAiStatus('🟢 Active - Streaming Intelligence');
        console.log("WebSocket Connected to AI Core");
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
            case 'AI_STATUS':
                store.setAiStatus(message.payload);
                break;
            case 'TRADE_EXEC':
                store.addTrade(message.payload);
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
        useStore.getState().setAiStatus('🔴 Connection Lost');
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
