require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const apiRoutes = require('./routes/api');
const { startUserStream, ensureMarketConnection } = require('./services/marketStream');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORS: allow Railway frontend domain + localhost
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
    res.json({ status: 'ok', service: 'crypto-ai-bot-backend' });
});

// Load API Routes
app.use('/api', apiRoutes);

// Supabase admin client for WebSocket auth
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Start shared public market stream immediately
ensureMarketConnection();

// WebSocket: authenticate user via JWT query param, then start per-user stream
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
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
    console.log(`🚀 Crypto AI Bot Backend running at http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the old backend or set PORT to another value.`);
    } else {
        console.error('Backend server failed:', error);
    }
    process.exit(1);
});
