/**
 * Supabase Postgres persistence layer.
 * All reads/writes go through the service-role client from middleware/auth.js.
 * Encryption/decryption uses UserStore's static helpers (CryptoJS AES).
 */

const UserStore = require('../userStore');

/**
 * Load full user state from DB. Returns null if no row found.
 */
async function loadUserState(supabase, userId) {
    if (!supabase) return null;

    try {
        // Load settings
        const { data: settings, error: settingsErr } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (settingsErr || !settings) return null;

        // Load trades (last 500, newest first)
        const { data: trades } = await supabase
            .from('paper_trades')
            .select('*')
            .eq('user_id', userId)
            .order('executed_at', { ascending: false })
            .limit(500);

        // Load learning history (last 20)
        const { data: learning } = await supabase
            .from('learning_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        // Load strategies
        const { data: strategies } = await supabase
            .from('strategies')
            .select('*')
            .eq('user_id', userId);

        // Decrypt keys
        let cbKey = null, cbSecret = null, gemKey = null;
        try {
            if (settings.cb_key_enc) cbKey = UserStore.decrypt(settings.cb_key_enc);
            if (settings.cb_sec_enc) cbSecret = UserStore.decrypt(settings.cb_sec_enc);
            if (settings.gem_key_enc) gemKey = UserStore.decrypt(settings.gem_key_enc);
        } catch (e) {
            console.error('Key decryption failed for user', userId, e.message);
        }

        // Rebuild per-product holdings from trade history
        const productHoldings = settings.product_holdings || {};

        return {
            keys: {
                coinbaseApiKey: cbKey,
                coinbaseApiSecret: cbSecret,
                geminiApiKey: gemKey
            },
            balance: parseFloat(settings.balance) || 100000,
            assetHoldings: parseFloat(settings.asset_holdings) || 0,
            selectedProduct: settings.selected_product || 'BTC-USD',
            tradingMode: settings.trading_mode || 'FULL_AUTO',
            engineStatus: settings.engine_status || (settings.is_live_mode ? 'LIVE_RUNNING' : 'STOPPED'),
            isLiveMode: settings.is_live_mode || false,
            riskSettings: settings.risk_settings || {},
            circuitBreaker: settings.circuit_breaker || {},
            productHoldings,
            trades: (trades || []).map(normalizeTradeRow),
            learningHistory: (learning || []).map(r => ({
                time: r.created_at,
                knowledge: r.knowledge
            })),
            strategies: (strategies || []).map(r => r.data)
        };
    } catch (err) {
        console.error('loadUserState error:', err.message);
        return null;
    }
}

function normalizeTradeRow(row) {
    return {
        id: row.id,
        type: row.type,
        amount: parseFloat(row.amount),
        price: parseFloat(row.price),
        product: row.product,
        reason: row.reason || '',
        time: row.executed_at
    };
}

/**
 * Upsert the user_settings row with encrypted keys + current state snapshot.
 */
async function saveUserSettings(supabase, userId, user) {
    if (!supabase) return;

    try {
        const row = {
            user_id: userId,
            balance: user.paperTradingState?.balance ?? 100000,
            asset_holdings: user.paperTradingState?.assetHoldings ?? 0,
            selected_product: user.selectedProduct || 'BTC-USD',
            trading_mode: user.tradingMode || 'FULL_AUTO',
            engine_status: user.engineStatus || 'STOPPED',
            is_live_mode: user.isLiveMode || false,
            risk_settings: user.riskSettings || {},
            circuit_breaker: user.circuitBreaker || {},
            product_holdings: user.productHoldings || {},
            updated_at: new Date().toISOString()
        };

        // Encrypt keys if present
        if (user.keys?.coinbaseApiKey) row.cb_key_enc = UserStore.encrypt(user.keys.coinbaseApiKey);
        if (user.keys?.coinbaseApiSecret) row.cb_sec_enc = UserStore.encrypt(user.keys.coinbaseApiSecret);
        if (user.keys?.geminiApiKey) row.gem_key_enc = UserStore.encrypt(user.keys.geminiApiKey);

        await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' });
    } catch (err) {
        console.error('saveUserSettings error:', err.message);
    }
}

/**
 * Insert a single trade record.
 */
async function saveTrade(supabase, userId, trade) {
    if (!supabase) return;

    try {
        await supabase.from('paper_trades').insert({
            user_id: userId,
            type: trade.type,
            amount: trade.amount,
            price: trade.price,
            product: trade.product || 'BTC-USD',
            reason: trade.reason || null,
            executed_at: trade.time || new Date().toISOString()
        });
    } catch (err) {
        console.error('saveTrade error:', err.message);
    }
}

/**
 * Insert a learning record. Trims old rows to keep only the most recent 20.
 */
async function saveLearning(supabase, userId, knowledge) {
    if (!supabase) return;

    try {
        await supabase.from('learning_history').insert({
            user_id: userId,
            knowledge,
            created_at: new Date().toISOString()
        });

        // Keep only latest 20 per user — delete older rows
        const { data: rows } = await supabase
            .from('learning_history')
            .select('id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (rows && rows.length > 20) {
            const toDelete = rows.slice(20).map(r => r.id);
            await supabase.from('learning_history').delete().in('id', toDelete);
        }
    } catch (err) {
        console.error('saveLearning error:', err.message);
    }
}

/**
 * Upsert all strategy rows for a user.
 */
async function saveStrategies(supabase, userId, strategies) {
    if (!supabase || !Array.isArray(strategies) || strategies.length === 0) return;

    try {
        const rows = strategies.map(s => ({
            id: s.id,
            user_id: userId,
            data: s,
            updated_at: new Date().toISOString()
        }));

        await supabase.from('strategies').upsert(rows, { onConflict: 'user_id,id' });
    } catch (err) {
        console.error('saveStrategies error:', err.message);
    }
}

module.exports = { loadUserState, saveUserSettings, saveTrade, saveLearning, saveStrategies };
