const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️ Supabase env vars missing. Auth will not work in production.");
}

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// Express middleware: verify Supabase JWT and attach userId
const authenticate = async (req, res, next) => {
    // Skip auth in local dev if Supabase is not configured
    if (!supabase) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({ error: 'Authentication service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
        }
        req.userId = 'local-dev-user';
        return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No authentication token provided.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired session.' });
        }

        req.userId = user.id;
        req.userEmail = user.email;
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ error: 'Authentication service unavailable.' });
    }
};

module.exports = { authenticate, supabase };
