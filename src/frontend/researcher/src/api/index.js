// API 基础配置
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
  login: (username, password) => 
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => 
    request('/api/auth/logout', { method: 'POST' }),
  getCurrentUser: () => 
    request('/users/me'),
};

// ==================== 病例管理接口 ====================
export const casesApi = {
  getCases: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/cases${queryString ? `?${queryString}` : ''}`);
  },
  getCaseById: (id) => request(`/api/cases/${id}`),
};

// ==================== Study（检查）接口 ====================
export const studyApi = {
  getStudiesByCaseId: (caseId) => request(`/api/cases/${caseId}/studies`),
  getStudyById: (caseId, studyId) => request(`/api/cases/${caseId}/studies/${studyId}`),
  getStudyByIdOnly: (studyId) => request(`/api/studies/${studyId}`),
};

// ==================== 影像相关接口 ====================
export const imageApi = {
  getByCaseId: (caseId) => request(`/image-asset-controller/listByCaseId?caseId=${caseId}`),
  
  getPreview: async (imageId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/images/${imageId}/preview`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });
    if (!response.ok) {
      throw new Error(`获取预览图失败: ${response.status}`);
    }
    return response.blob();
  },
  
  getImagesByStudyId: async (studyId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/images/study/${studyId}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });
    return response.json();
  },
  
  listAllImages: (page = 0, size = 20) => request(`/api/images?page=${page}&size=${size}`),
  listAll: () => request('/image-asset-controller/listAll'),
  getById: (id) => request(`/image-asset-controller/getById?id=${id}`),
};

// ==================== AI推理接口 ====================
export const inferenceApi = {
  listTasks: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/inference/tasks${queryString ? `?${queryString}` : ''}`);
  },
  
  createTask: (data) => request('/api/inference/tasks', {
    method: 'POST',
    body: JSON.stringify({
      imageId: data.imageId,
      modelId: data.modelId || null,
    }),
  }),
  
  getTask: (taskId) => request(`/api/inference/tasks/${taskId}`),
  listResults: (taskId) => request(`/api/inference/tasks/${taskId}/results`),
  getResultsByCaseId: (caseId) => request(`/inference-task-controller/listResults?caseId=${caseId}`),
  getReviewsByCaseId: (caseId) => request(`/inference-task-controller/listReviews?caseId=${caseId}`),
  reviewTask: (taskId, correct, comment) => request(`/api/inference/tasks/${taskId}/review`, {
    method: 'POST',
    body: JSON.stringify({ correct, comment }),
  }),
};

// ==================== 模型管理接口 ====================
export const modelApi = {
  getModels: () => request('/api/models'),
  updateParams: (modelId, params) => request(`/api/models/${modelId}/params`, {
    method: 'PUT',
    body: JSON.stringify(params),
  }),
  enableModel: (modelId) => request(`/api/models/${modelId}/enable`, {
    method: 'PUT',
  }),
  disableModel: (modelId) => request(`/api/models/${modelId}/disable`, {
    method: 'PUT',
  }),
};

// ==================== 导出接口 ====================
export const exportApi = {
  exportJSON: (taskId) => request(`/api/inference/tasks/${taskId}/export`),
  exportPDF: async (taskId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/inference/tasks/${taskId}/export-pdf`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });
    if (!response.ok) {
      throw new Error(`导出PDF失败: ${response.status}`);
    }
    return response.blob();
  },
};

// 默认导出
export default {
  auth: authApi,
  cases: casesApi,
  study: studyApi,
  image: imageApi,
  inference: inferenceApi,
  model: modelApi,
  export: exportApi,
};