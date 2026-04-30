import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Helper to get the current session JWT
export const getAccessToken = async () => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
};

// Helper for authenticated fetch calls to our backend
export const authFetch = async (url, options = {}) => {
    const token = await getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout ?? 10000);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('Request timed out — backend is slow or unreachable');
        throw err;
    } finally {
        clearTimeout(timer);
    }
};
