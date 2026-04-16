require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const apiRoutes = require('./routes/api');
const { startUserStream, ensureMarketConnection } = require('./services/marketStream');
const userStore = require('./userStore');
const { createClient } = require('@supabase/supabase-js');
const { loadUserState, saveUserSettings } = require('./db/persistence');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORS: allow Vercel frontend + localhost
app.use(cors({
    origin(origin, callback) {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:4173',
            'http://127.0.0.1:4173',
            process.env.FRONTEND_URL
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'quant-by-distinction-creative' });
});

// Load API Routes
app.use('/api', apiRoutes);

// Supabase admin client for WebSocket auth
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Start shared public market stream immediately
ensureMarketConnection();

// WebSocket: authenticate user, send portfolio state, start per-user stream
wss.on('connection', async (ws, req) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    let userId = 'local-dev-user';

    // Authenticate if Supabase is configured
    if (supabase && requestUrl.searchParams.has('token')) {
        try {
            const { data: { user }, error } = await supabase.auth.getUser(requestUrl.searchParams.get('token'));
            if (error || !user) {
                ws.close(4001, 'Invalid token');
                return;
            }
            userId = user.id;
        } catch {
            ws.close(4001, 'Auth failed');
            return;
        }
    }

    // Read initial product from query param (e.g. ?product=ETH-USD)
    const initialProduct = requestUrl.searchParams.get('product') || userStore.getSelectedProduct(userId) || 'BTC-USD';
    userStore.setSelectedProduct(userId, initialProduct);

    console.log(`📊 User ${userId} connected — trading ${initialProduct}`);

    const sendData = (type, payload) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, payload }));
        }
    };

    // Load persisted state from DB before sending initial portfolio snapshot
    const loaded = await loadUserState(supabase, userId);
    if (loaded) {
        userStore.restoreState(userId, loaded);
        // Re-apply the product from query param if explicitly set (overrides persisted product)
        if (requestUrl.searchParams.get('product')) {
            userStore.setSelectedProduct(userId, initialProduct);
        }
    }

    // Send current portfolio state immediately on connect so the UI initialises correctly
    const state = userStore.getPaperState(userId);
    sendData('PORTFOLIO_STATE', {
        balance: state.balance,
        assetHoldings: state.assetHoldings,
        trades: state.trades,
        selectedProduct: state.selectedProduct
    });

    // Start per-user market stream + AI
    const { cleanup, setProduct } = startUserStream(userId, sendData, state.selectedProduct);

    // Handle messages from the client
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);

            if (msg.type === 'CHANGE_PRODUCT' && msg.payload?.productId) {
                const newProduct = msg.payload.productId;
                setProduct(newProduct);
                console.log(`🔀 User ${userId} switched to ${newProduct}`);
                const updatedState = userStore.getPaperState(userId);
                sendData('PORTFOLIO_STATE', {
                    balance: updatedState.balance,
                    assetHoldings: updatedState.assetHoldings,
                    trades: updatedState.trades,
                    selectedProduct: updatedState.selectedProduct
                });
            }

            if (msg.type === 'KILL_SWITCH') {
                if (msg.payload?.activate) {
                    userStore.tripKillSwitch(userId, msg.payload.reason || 'Manual kill switch');
                    const u = userStore._ensureUser(userId);
                    sendData('KILL_SWITCH_ALERT', { reason: u.killSwitchReason });
                    // Cancel open Coinbase orders if user is in live mode
                    if (u.isLiveMode) {
                        const keys = userStore.getKeys(userId);
                        if (keys?.coinbaseApiKey) {
                            const { cancelAllOrders } = require('./services/liveTrading');
                            cancelAllOrders(keys.coinbaseApiKey, keys.coinbaseApiSecret, u.selectedProduct)
                                .then(r => console.log(`Kill switch: cancelled ${r.cancelled} live orders for user ${userId}`))
                                .catch(err => console.error('cancelAllOrders error:', err.message));
                        }
                    }
                } else {
                    userStore.resetKillSwitch(userId);
                    sendData('KILL_SWITCH_ALERT', { reason: null });
                }
            }

            if (msg.type === 'SET_TRADING_MODE' && msg.payload?.mode) {
                userStore.setTradingMode(userId, msg.payload.mode);
            }

            if (msg.type === 'CONFIRM_TRADE') {
                const { tradeId, accepted, amount } = msg.payload || {};
                const pending = userStore.getPendingTrade(userId);

                if (pending && pending.tradeId === tradeId) {
                    userStore.clearPendingTrade(userId);

                    if (accepted && Date.now() <= pending.expiresAt) {
                        const finalAmount = amount || pending.amount;
                        const u = userStore._ensureUser(userId);

                        if (u.isLiveMode) {
                            // AI Assisted + Live: place real Coinbase order
                            const { executeLiveOrder } = require('./services/marketStream');
                            executeLiveOrder(userId, pending.side, finalAmount, pending.price, pending.product, pending.reasoning, sendData);
                        } else {
                            // AI Assisted + Paper
                            const executed = userStore.executePaperTrade(
                                userId, pending.side, finalAmount, pending.price, pending.reasoning
                            );
                            if (executed) {
                                sendData('TRADE_EXEC', executed);
                                const notif = userStore.getNotifications(userId)[0];
                                sendData('NOTIFICATION', notif);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Ignore malformed messages
        }
    });

    ws.on('close', () => {
        console.log(`📊 User ${userId} disconnected`);
        cleanup();
        // Persist settings snapshot on disconnect (fire-and-forget)
        const userSnapshot = userStore._ensureUser(userId);
        saveUserSettings(supabase, userId, userSnapshot).catch(() => {});
    });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1');
server.listen(PORT, HOST, () => {
    console.log(`🚀 Quant by Distinction Creative — Backend running at http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the old backend or set PORT to another value.`);
    } else {
        console.error('Backend server failed:', error);
    }
    process.exit(1);
});
