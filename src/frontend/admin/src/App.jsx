import React, { useEffect, useState } from 'react';
import AdminDashboard from './pages/Admin/AdminDashboard';
import './styles/App.css';
import { apiUrl, LOGIN_BASE_URL } from './config/appConfig';
import { authHeaders, clearAuthStorage } from './utils/auth';

// 触发全局错误事件
const triggerAuthError = (message) => {
  window.dispatchEvent(new CustomEvent('auth-error', { 
    detail: { message: message || '登录已过期，请重新登录' }
  }));
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [showNotice, setShowNotice] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      
      try {
        const response = await fetch(apiUrl('/api/images?page=0&size=1'), {
          headers: authHeaders()
        });
        
        if (response.status === 401 || response.status === 403) {
          clearAuthStorage();
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    const handleAuthError = (event) => {
      setNoticeMessage(event.detail?.message || '登录已过期，请重新登录');
      setShowNotice(true);
      clearAuthStorage();
      setIsAuthenticated(false);
    };
    
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  // 修改 request 函数中的 401/403 处理需要在 api/index.js 中添加

  if (isAuthenticated === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>加载中...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '40px',
          backdropFilter: 'blur(10px)',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
          <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>未登录</h1>
          <p style={{ fontSize: '16px', marginBottom: '24px', opacity: 0.9 }}>
            您尚未登录，请先登录后再访问此页面。
          </p>
          <button onClick={() => window.location.href = LOGIN_BASE_URL} style={{
            background: 'white',
            color: '#667eea',
            border: 'none',
            padding: '12px 30px',
            fontSize: '16px',
            fontWeight: 600,
            borderRadius: '30px',
            cursor: 'pointer'
          }}>
            前往登录
          </button>
        </div>
        {showNotice && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#f44336',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            zIndex: 9999,
            fontSize: '14px'
          }}>
            {noticeMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {showNotice && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#f44336',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          zIndex: 9999,
          fontSize: '14px'
        }}>
          {noticeMessage}
        </div>
      )}
      <AdminDashboard />
    </div>
  );
}

export default App;