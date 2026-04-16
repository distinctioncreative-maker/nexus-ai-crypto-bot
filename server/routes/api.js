const express = require('express');
const router = express.Router();
const memoryStore = require('../memoryStore');

// Check if backend is configured
router.get('/status', (req, res) => {
    res.json({
        isConfigured: memoryStore.hasKeys(),
        paperMode: true // Forced true for now based on user request
    });
});

// Securely ingest keys into memory (RAM)
router.post('/setup', (req, res) => {
    const { coinbaseKey, coinbaseSecret, openAiKey } = req.body;
    
    if (!coinbaseKey || !coinbaseSecret || !openAiKey) {
        return res.status(400).json({ error: "Missing required keys." });
    }

    memoryStore.setKeys(coinbaseKey, coinbaseSecret, openAiKey);
    console.log("🔒 Credentials securely loaded into memory.");
    res.json({ success: true, message: "Keys securely loaded." });
});

// Fetch current mock/paper portfolio
router.get('/portfolio', (req, res) => {
    res.json(memoryStore.getPaperState());
});

module.exports = router;
