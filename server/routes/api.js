const express = require('express');
const router = express.Router();
const userStore = require('../userStore');
const { authenticate } = require('../middleware/auth');

// Public: health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected: check if this user has configured their keys
router.get('/status', authenticate, (req, res) => {
    res.json({
        isConfigured: userStore.hasKeys(req.userId),
        paperMode: true,
        userId: req.userId
    });
});

// Protected: securely ingest keys into per-user memory
router.post('/setup', authenticate, (req, res) => {
    const { coinbaseKey, coinbaseSecret, geminiKey } = req.body;

    if (!coinbaseKey || !coinbaseSecret || !geminiKey) {
        return res.status(400).json({ error: "Missing required keys." });
    }

    userStore.setKeys(req.userId, coinbaseKey, coinbaseSecret, geminiKey);
    console.log(`🔒 Keys loaded for user ${req.userId}`);
    res.json({ success: true, message: "Keys securely loaded for your session." });
});

// Protected: fetch this user's portfolio
router.get('/portfolio', authenticate, (req, res) => {
    res.json(userStore.getPaperState(req.userId));
});

module.exports = router;
