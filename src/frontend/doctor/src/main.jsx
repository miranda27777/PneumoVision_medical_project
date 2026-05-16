import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

import { apiUrl, LOGIN_BASE_URL } from './config/appConfig';
import { authHeaders, clearAuthStorage } from './utils/auth';

// 显示加载状态
const showLoading = () => {
  const rootElement = document.getElementById('root');
  rootElement.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    ">
      <div style="text-align: center;">
        <div style="
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        "></div>
        <p>验证登录状态...</p>
      </div>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
};

// 显示未登录页面
const showUnauthorized = () => {
  const rootElement = document.getElementById('root');
  rootElement.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      text-align: center;
    ">
      <div style="
        background: rgba(255,255,255,0.1);
        border-radius: 20px;
        padding: 40px;
        backdrop-filter: blur(10px);
        max-width: 500px;
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
        <h1 style="font-size: 28px; margin-bottom: 16px;">未登录</h1>
        <p style="font-size: 16px; margin-bottom: 24px; opacity: 0.9;">
          您尚未登录，请先登录后再访问此页面。
        </p>
        <button onclick="window.location.href='${LOGIN_BASE_URL}'" style="
          background: white;
          color: #667eea;
          border: none;
          padding: 12px 30px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 30px;
          cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          前往登录
        </button>
      </div>
    </div>
  `;
};

// 渲染 React 应用
const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter basename="/doctor">
          <App />
        </BrowserRouter>
      </React.StrictMode>
  );
};

// 主入口函数
const init = async () => {
  // 从 URL 中读取 token
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');

  if (urlToken) {
    localStorage.setItem('token', urlToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const token = localStorage.getItem('token');

  // 没有 token，直接显示未登录页面
  if (!token) {
    showUnauthorized();
    return;
  }

  // 有 token，显示加载状态
  showLoading();

  try {
    const response = await fetch(apiUrl('/api/images?page=0&size=1'), {
      headers: authHeaders()
    });

    if (response.status === 401 || response.status === 403) {
      // token 无效，清除并显示未登录页面
      clearAuthStorage();
      showUnauthorized();
    } else {
      // token 有效，渲染应用
      renderApp();
    }
  } catch (error) {
    // 网络错误，尝试渲染（可能后端没启动）
    console.error('验证 token 失败:', error);
    renderApp();
  }
};

// 启动应用
init();