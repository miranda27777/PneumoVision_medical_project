import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TopNotice from './components/common/TopNotice';
import DoctorDashboard from './components/Dashboard/DoctorDashboard';
import StudiesPage from './components/Dashboard/StudiesPage';
import StudiesDetailsPage from './components/Dashboard/StudiesDetailsPage';
import ImageTaskDetailPage from './components/Dashboard/ImageTaskDetailPage';
import './App.css';

import { apiUrl, LOGIN_BASE_URL } from './config/appConfig';
import { authHeaders, clearAuthStorage } from './utils/auth';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notice, setNotice] = useState({ visible: false, message: '', type: 'info' });

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setIsAuthenticated(false);
        setAuthChecked(true);
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
        console.error('验证登录状态失败:', error);
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleAuthError = (event) => {
      setNotice({
        visible: true,
        message: event.detail?.message || '登录已过期，请重新登录',
        type: 'error'
      });
      clearAuthStorage();
      setIsAuthenticated(false);
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const closeNotice = () => {
    setNotice({ visible: false, message: '', type: 'info' });
    window.location.href = LOGIN_BASE_URL;
  };

  // 登录状态检查中
  if (!authChecked) {
    return (
        <div
            className="loading-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }}
            ></div>
            <p>验证登录状态...</p>
          </div>
          <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        </div>
    );
  }

  // 未通过认证，显示未登录页面
  if (!isAuthenticated) {
    return (
        <div
            style={{
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
            }}
        >
          <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '40px',
                backdropFilter: 'blur(10px)',
                maxWidth: '500px'
              }}
          >
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
            <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>未登录</h1>
            <p style={{ fontSize: '16px', marginBottom: '24px', opacity: 0.9 }}>
              您尚未登录，请先登录后再访问此页面。
            </p>
            <button
                onClick={() => window.location.href = LOGIN_BASE_URL}
                style={{
                  background: 'white',
                  color: '#667eea',
                  border: 'none',
                  padding: '12px 30px',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '30px',
                  cursor: 'pointer'
                }}
            >
              前往登录
            </button>
          </div>
        </div>
    );
  }

  return (
      <div className="app">
        <TopNotice
            visible={notice.visible}
            message={notice.message}
            type={notice.type}
            onClose={closeNotice}
        />

        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<DoctorDashboard />} />
          <Route path="/cases" element={<DoctorDashboard />} />
          <Route path="/cases/:caseId" element={<StudiesPage />} />
          <Route path="/cases/:caseId/studies/:studyId" element={<StudiesDetailsPage />} />
          <Route path="/cases/:caseId/studies/:studyId/images/:imageId" element={<ImageTaskDetailPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </div>
  );
}

export default App;