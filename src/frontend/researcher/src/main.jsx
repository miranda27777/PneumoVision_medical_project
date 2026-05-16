import React from 'react';
import ReactDOM from 'react-dom/client';
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
        ">
          前往登录
        </button>
      </div>
    </div>
  `;
};

const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
  );
};

const init = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    localStorage.setItem('token', token);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const storedToken = localStorage.getItem('token');

  if (!storedToken) {
    showUnauthorized();
    return;
  }

  showLoading();

  try {
    const response = await fetch(apiUrl('/api/images?page=0&size=1'), {
      headers: authHeaders()
    });

    if (response.status === 401 || response.status === 403) {
      clearAuthStorage();
      showUnauthorized();
    } else {
      renderApp();
    }
  } catch (error) {
    console.error('验证 token 失败:', error);
    renderApp();
  }
};

init();