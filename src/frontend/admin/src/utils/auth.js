import { apiUrl, LOGIN_BASE_URL } from '../config/appConfig';

export const getToken = () => {
    return localStorage.getItem('token');
};

export const clearAuthStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('doctorName');
    localStorage.removeItem('adminName');
    localStorage.removeItem('researcherName');
};

export const authHeaders = (extraHeaders = {}) => {
    const token = getToken();

    if (!token) {
        return extraHeaders;
    }

    return {
        ...extraHeaders,
        Authorization: `Bearer ${token}`
    };
};

export const goLogin = () => {
    window.location.href = LOGIN_BASE_URL;
};

export const logoutToLogin = async () => {
    const token = getToken();

    try {
        if (token) {
            await fetch(apiUrl('/api/auth/logout'), {
                method: 'POST',
                headers: authHeaders()
            });
        }
    } catch (error) {
        console.error('退出失败:', error);
    } finally {
        clearAuthStorage();
        goLogin();
    }
};