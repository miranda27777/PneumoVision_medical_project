import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  API_BASE_URL,
  ADMIN_BASE_URL,
  DOCTOR_BASE_URL,
  RESEARCHER_BASE_URL
} from '../config/appConfig';

const SignInPage = () => {
  const location = useLocation();
  const passedEmail = location.state?.email || '';

  const [email, setEmail] = useState(passedEmail);
  const [password, setPassword] = useState('');
  const [activeField, setActiveField] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buildRedirectUrl = (baseUrl, token, username) => {
    return `${baseUrl}?token=${encodeURIComponent(token)}&username=${encodeURIComponent(username)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password: password })
      });

      const data = await response.json();
      console.log('登录返回:', data);

      if (data.code === 0) {
        const token = data.data.token;
        const role = data.data.role;
        const username = data.data.username || email;

        if (role === 'ADMIN') {
          window.location.href = buildRedirectUrl(ADMIN_BASE_URL, token, username);
        } else if (role === 'DOCTOR') {
          window.location.href = buildRedirectUrl(DOCTOR_BASE_URL, token, username);
        } else if (role === 'RESEARCHER') {
          window.location.href = buildRedirectUrl(RESEARCHER_BASE_URL, token, username);
        } else {
          window.location.href = '/';
        }
      } else {
        setError(data.message || '登录失败，请检查账号密码');
      }
    } catch (err) {
      console.error('登录请求失败:', err);
      setError('网络错误，请检查后端是否已在 8080 端口启动');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>PneumoVision</div>
          <h1 style={styles.title}>欢迎回来</h1>
          <p style={styles.desc}>登录你的账号，继续使用平台</p>

          {error && (
              <div style={styles.errorMsg}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={styles.form} autoComplete="off">
            <input
                type="text"
                name="fake-username"
                autoComplete="username"
                tabIndex={-1}
                style={styles.hiddenInput}
            />
            <input
                type="password"
                name="fake-password"
                autoComplete="current-password"
                tabIndex={-1}
                style={styles.hiddenInput}
            />

            <input
                type="text"
                name="loginAccount"
                autoComplete="off"
                placeholder={activeField === 'email' ? '' : '请输入用户名'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onClick={() => setActiveField('email')}
                style={styles.input}
            />

            <input
                type="password"
                name="loginSecret"
                autoComplete="new-password"
                placeholder={activeField === 'password' ? '' : '请输入密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onClick={() => setActiveField('password')}
                style={styles.input}
            />

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    background:
        'radial-gradient(100% 100% at 50% 0%, #2b1354 0%, #171136 50%, #0d0a20 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px 20px',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '480px',
    background: 'rgba(19, 17, 38, 0.95)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '28px',
    padding: '48px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
  },
  brand: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '24px',
    color: '#c4b5fd',
  },
  title: {
    fontSize: '40px',
    lineHeight: 1.1,
    margin: '0 0 12px 0',
  },
  desc: {
    margin: '0 0 28px 0',
    color: '#94a3b8',
    fontSize: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    height: '54px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    padding: '0 18px',
    fontSize: '15px',
    outline: 'none',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    width: '1px',
    height: '1px',
  },
  submitBtn: {
    height: '56px',
    border: 'none',
    borderRadius: '14px',
    color: '#fff',
    background: 'rgb(26, 127, 55)',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '8px',
  },
  errorMsg: {
    backgroundColor: 'rgba(255,0,0,0.2)',
    border: '1px solid #ff4444',
    borderRadius: '12px',
    padding: '10px',
    marginBottom: '16px',
    color: '#ff8888',
    fontSize: '14px',
    textAlign: 'center',
  },
};

export default SignInPage;