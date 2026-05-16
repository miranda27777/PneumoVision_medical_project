// src/api/index.js

// API 基础地址
const API_BASE = '';

// 触发全局错误事件
const triggerAuthError = (message) => {
  window.dispatchEvent(new CustomEvent('auth-error', { 
    detail: { message: message || '登录已过期，请重新登录' }
  }));
};

// 通用请求函数
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  });

  // 处理 401/403 未授权
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('doctorName');
    localStorage.removeItem('adminName');
    triggerAuthError('登录已过期，请重新登录');
    throw new Error('未授权，请重新登录');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ==================== 认证接口 ====================
export const authApi = {
  // 登录
  login: (username, password) => 
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // 退出
  logout: () => 
    request('/api/auth/logout', { method: 'POST' }),

  // 获取当前用户信息
  getCurrentUser: () => 
    request('/users/me'),
};

// 管理员用户管理接口
export const adminUserApi = {
  // 获取用户列表（支持分页、筛选参数）
  listUsers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/admin/users${queryString ? `?${queryString}` : ''}`);
  },

  // 创建用户
  createUser: (userData) => request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),

  // 启用用户 - 注意：用的是 id，不是 userId
  enableUser: (id) => request(`/api/admin/users/${id}/enable`, {
    method: 'POST',
  }),

  // 禁用用户 - 注意：用的是 id，不是 userId
  disableUser: (id) => request(`/api/admin/users/${id}/disable`, {
    method: 'POST',
  }),

  // 获取单个用户
  getUserById: (id) => request(`/api/admin/users/${id}`),
};

// 管理员通用接口（用于获取用户列表下拉框等）
export const adminApi = {
  // 获取用户列表（不分页，用于下拉框）
  getUsers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/admin/users${queryString ? `?${queryString}` : ''}`);
  },
};

// ==================== 审计日志接口 ====================
export const auditApi = {
  // 获取日志列表（支持分页、筛选参数）
  listLogs: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/admin/audit-logs${queryString ? `?${queryString}` : ''}`);
  },

  // 导出日志
  exportLogs: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/admin/audit-logs/export${queryString ? `?${queryString}` : ''}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('导出失败');
    return response.blob();
  },
};

// ==================== 系统概览接口 ====================
export const systemApi = {
  // 获取系统统计信息
  getStats: () => request('/api/admin/stats'),
};

// ==================== 系统健康检查接口 ====================
export const healthApi = {
  // 检查服务健康状态
  check: () => request('/api/health'),
};

// 默认导出
export default {
  auth: authApi,
  adminUser: adminUserApi,
  admin: adminApi,
  audit: auditApi,
  system: systemApi,
  health: healthApi,
};