const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

export const API_BASE_URL = isLocal
    ? 'http://localhost:8080'
    : '';

export const ADMIN_BASE_URL = isLocal
    ? 'http://localhost:5174/admin/'
    : '/admin/';

export const DOCTOR_BASE_URL = isLocal
    ? 'http://localhost:5173/doctor/'
    : '/doctor/';

export const RESEARCHER_BASE_URL = isLocal
    ? 'http://localhost:5175/researcher/'
    : '/researcher/';