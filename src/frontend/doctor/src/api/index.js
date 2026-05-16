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
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });

    // 处理 401/403 未授权 - 只触发事件，不自动跳转
    if (response.status === 401 || response.status === 403) {
      // 清除本地存储
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('doctorName');
      localStorage.removeItem('adminName');
      
      // 触发全局错误事件，让页面显示 TopNotice
      triggerAuthError('登录已过期，请重新登录');
      
      // 返回错误响应，不抛出异常，避免页面崩溃
      return { code: response.status, message: '未授权，请重新登录' };
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `请求失败: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API请求错误:', error);
    throw error;
  }
}

// ==================== 认证接口 ====================
export const authApi = {
  login: (username, password) => 
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getCurrentUser: () => request('/users/me'),
};

// ==================== 病例管理接口 ====================
export const casesApi = {
  // 获取病例列表
  getCases: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/cases${queryString ? `?${queryString}` : ''}`);
  },
  
  // 获取单个病例详情
  getCaseById: (id) => request(`/api/cases/${id}`),
  
  // 创建新病例
  createCase: (data) => request('/api/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ==================== 影像上传接口 ====================
export const uploadApi = {
  uploadImage: async (file, studyId) => {
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('上传文件:', file);
    console.log('studyId:', studyId);
    
    const response = await fetch(`/api/images/upload?studyId=${studyId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `上传失败: ${response.status}`);
    }
    
    return response.json();
  },

  uploadMultiple: async (files, studyId) => {
    const formData = new FormData();
    files.forEach(file => formData.append('file', file));
    return request(`/api/images/upload?studyId=${studyId}`, {
      method: 'POST',
      headers: {},
      body: formData,
    });
  },

  getUploadHistory: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/uploads${queryString ? `?${queryString}` : ''}`);
  },

  getImage: (imageId) => 
    request(`/images/${imageId}`, {
      headers: { Accept: 'image/*' },
    }),
};

// ==================== 推理任务接口 ====================
export const inferenceApi = {
  // 获取推理任务列表
  listTasks: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/inference/tasks${queryString ? `?${queryString}` : ''}`);
  },

  // 创建推理任务（发起检测）
  createTask: (data) => request('/api/inference/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 获取任务详情
  getTask: (taskId) => request(`/api/inference/tasks/${taskId}`),

  // 提交医生评价 - 支持 evaluationStatus 字段
  reviewTask: (taskId, evaluationStatus, comment) => request(`/api/inference/tasks/${taskId}/review`, {
    method: 'POST',
    body: JSON.stringify({ evaluationStatus, comment }),
  }),

  // 获取任务的结果列表
  listResults: (taskId) => request(`/api/inference/tasks/${taskId}/results`),
};

// ==================== AI检测接口 ====================
export const detectionApi = {
  runDetection: (imageId, modelVersion = 'v2.1') => 
    request('/detection/run', {
      method: 'POST',
      body: JSON.stringify({ image_id: imageId, model_version: modelVersion }),
    }),
  runBatchDetection: (imageIds, modelVersion = 'v2.1') => 
    request('/detection/batch', {
      method: 'POST',
      body: JSON.stringify({ image_ids: imageIds, model_version: modelVersion }),
    }),
  getDetectionResult: (taskId) => request(`/detection/result/${taskId}`),
  getDetectionHistory: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/detection/history${queryString ? `?${queryString}` : ''}`);
  },
};

// ==================== 影像接口 ====================
export const imageApi = {
  // 获取影像列表（分页）
  listImages: (page = 0, size = 10) => 
    request(`/api/images?page=${page}&size=${size}`),
  
  // 获取单个影像详情
  getImageById: (id) => 
    request(`/api/images/${id}`),
  
  // 获取影像预览图（返回图片blob）
  getPreview: async (id) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/images/${id}/preview`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });
    
    if (!response.ok) {
      throw new Error(`获取预览图失败: ${response.status}`);
    }
    
    return response.blob();
  },
};

// ==================== 导出功能接口 ====================
export const exportApi = {
  exportJSON: (resultId) => request(`/export/json/${resultId}`, {
    headers: { Accept: 'application/json' },
  }),
  exportImage: (resultId) => request(`/export/image/${resultId}`, {
    headers: { Accept: 'image/png' },
  }),
  exportBatch: (resultIds, format = 'json') => 
    request('/export/batch', {
      method: 'POST',
      body: JSON.stringify({ result_ids: resultIds, format }),
    }),
};

// ==================== 科研人员接口 ====================
export const researchApi = {
  getStats: () => request('/research/stats'),
  getDataset: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/research/dataset${queryString ? `?${queryString}` : ''}`);
  },
  getModelPerformance: () => request('/models/performance'),
};

// ==================== 医生评价接口 ====================
export const reviewApi = {
  submitReview: (taskId, content) => 
    request(`/inference-task-controller/reviewTask?taskId=${taskId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  getReviews: (caseId) => 
    request(`/inference-task-controller/listReviews?caseId=${caseId}`),
};

// ==================== Study（检查）接口 ====================
export const studyApi = {
  // 获取病例下的所有 Study
  getStudiesByCaseId: (caseId) => request(`/api/cases/${caseId}/studies`),
  
  // 获取单个 Study 详情
  getStudyById: (caseId, studyId) => request(`/api/cases/${caseId}/studies/${studyId}`),
  
  // 创建 Study
  createStudy: (caseId, data) => request(`/api/cases/${caseId}/studies`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // 更新 Study
  updateStudy: (caseId, studyId, data) => request(`/api/cases/${caseId}/studies/${studyId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // 删除 Study
  deleteStudy: (caseId, studyId) => request(`/api/cases/${caseId}/studies/${studyId}`, {
    method: 'DELETE',
  }),
};

// 默认导出
export default {
  auth: authApi,
  cases: casesApi,
  upload: uploadApi,
  detection: detectionApi,
  export: exportApi,
  research: researchApi,
  review: reviewApi,
  image: imageApi,
  study: studyApi,
};