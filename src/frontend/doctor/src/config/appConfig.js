const hostname = window.location.hostname;

const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

// 本地走 Vite proxy，服务器走 Nginx，统一使用 /api 相对路径
export const API_BASE_URL = '';

export const LOGIN_BASE_URL = isLocal
    ? 'http://localhost:3000/'
    : '/';

export const apiUrl = (path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};