const DEFAULT_BACKEND_URL = 'http://127.0.0.1:3001';

const normalizeBaseUrl = (url) => {
    const value = (url || DEFAULT_BACKEND_URL).trim();
    return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL);

export const apiUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const wsUrl = () => (
    API_BASE_URL
        .replace(/^http:\/\//, 'ws://')
        .replace(/^https:\/\//, 'wss://')
);

export const readApiResponse = async (response) => {
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const data = text && contentType.includes('application/json') ? JSON.parse(text) : null;

    if (!response.ok) {
        const message = data?.error || data?.message || `Backend returned ${response.status}`;
        throw new Error(message);
    }

    return data;
};
