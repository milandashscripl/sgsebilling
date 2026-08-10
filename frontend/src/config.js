const renderApiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5001/api' : 'https://sgsebilling.onrender.com/api');
export const API_BASE_URL = renderApiBaseUrl;
