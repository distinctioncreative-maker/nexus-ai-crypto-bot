const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const apiRoutes = require('./routes/api');
const { startMarketStream } = require('./services/marketStream');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Load API Routes
app.use('/api', apiRoutes);

// WebSocket connection for live UI updates
wss.on('connection', (ws) => {
    console.log('Frontend Dashboard Connected');
    
    // Broadcast function to send data to this specific client
    const sendData = (type, payload) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, payload }));
        }
    };

    // Begin streaming live market/AI data to UI
    startMarketStream(sendData);

    ws.on('close', () => {
        console.log('Frontend Dashboard Disconnected');
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`AI Trading Backend running on http://localhost:${PORT}`);
});
