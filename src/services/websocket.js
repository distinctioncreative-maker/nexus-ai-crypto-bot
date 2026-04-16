import { useStore } from '../store/useStore';

let ws = null;

export const initWebSocket = () => {
    if (ws) return;

    ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
        useStore.getState().setWsConnected(true);
        useStore.getState().setAiStatus('🟢 Active - Streaming Intelligence');
        console.log("WebSocket Connected to Local AI Core");
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const store = useStore.getState();
        
        switch (message.type) {
            case 'TICK':
                store.addMarketPoint({
                    time: Math.floor(Date.now() / 1000), // lightweight-charts uses unix timestamps
                    value: message.payload.price      // lightweight-charts needs 'value' for lines
                });
                store.setCurrentPrice(message.payload.price);
                break;
            case 'AI_STATUS':
                store.setAiStatus(message.payload);
                break;
            case 'TRADE_EXEC':
                store.addTrade(message.payload);
                
                // Add to Audit logs for extreme compliance
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
        setTimeout(initWebSocket, 5000); // Auto-reconnect
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
