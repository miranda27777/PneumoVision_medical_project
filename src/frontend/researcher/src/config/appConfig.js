const hostname = window.location.hostname;

const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

// API 保持相对路径：本地走 Vite proxy，服务器走 Nginx
export const API_BASE_URL = '';

export const LOGIN_BASE_URL = isLocal
    ? 'http://localhost:3000/'
    : '/';

export const apiUrl = (path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};