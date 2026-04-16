require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const apiRoutes = require('./routes/api');
const { startUserStream, ensureBinanceConnection } = require('./services/marketStream');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORS: allow Railway frontend domain + localhost
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:4173',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json());

// Load API Routes
app.use('/api', apiRoutes);

// Supabase admin client for WebSocket auth
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Start shared Binance stream immediately
ensureBinanceConnection();

// WebSocket: authenticate user via JWT query param, then start per-user stream
wss.on('connection', async (ws, req) => {
    const params = url.parse(req.url, true).query;
    let userId = 'local-dev-user';

    // Authenticate if Supabase is configured
    if (supabase && params.token) {
        try {
            const { data: { user }, error } = await supabase.auth.getUser(params.token);
            if (error || !user) {
                ws.close(4001, 'Invalid token');
                return;
            }
            userId = user.id;
        } catch (err) {
            ws.close(4001, 'Auth failed');
            return;
        }
    }

    console.log(`📊 User ${userId} connected to live stream`);

    const sendData = (type, payload) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, payload }));
        }
    };

    // Start per-user market stream + AI
    const cleanup = startUserStream(userId, sendData);

    ws.on('close', () => {
        console.log(`📊 User ${userId} disconnected`);
        cleanup();
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Kalshi Enterprise Backend (Multi-User) running on port ${PORT}`);
});
