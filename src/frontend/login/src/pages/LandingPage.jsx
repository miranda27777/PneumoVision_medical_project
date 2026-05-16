import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LungsGraphic from '../components/LungsGraphic';
import styles from '../styles/appStyles';

const LandingPage = () => {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const sequence = [
      { id: 0, duration: 1200 },
      { id: 1, duration: 500 },
      { id: 2, duration: 200 },
      { id: 3, duration: 3000 },
      { id: 4, duration: 1200 },
      { id: 5, duration: 500 },
      { id: 6, duration: 200 },
      { id: 7, duration: 3000 },
    ];

    let current = 0;
    let timer;

    const runSequence = () => {
      setStep(sequence[current].id);
      timer = setTimeout(() => {
        current = (current + 1) % sequence.length;
        runSequence();
      }, sequence[current].duration);
    };

    runSequence();

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = () => {
    navigate('/signin', { state: { email } });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLogin();
    }
  };

  const isClicking = step === 1 || step === 5;
  const isPressed = step === 2 || step === 6;
  const showIllResult = step === 3;
  const showHealthyResult = step === 7;
  const showAnyResult = showIllResult || showHealthyResult;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none" stroke="#00f2ff" strokeWidth="6">
            <path d="M 20 20 L 80 20 L 85 60 Q 50 100 15 60 Z" />
          </svg>
          <span style={styles.logoText}>PneumoVision</span>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.stage}>
          <div
            style={{
              ...styles.card,
              transform: isPressed ? 'scale(0.92)' : 'scale(1)',
              borderColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <div style={styles.xrayWrapper}>
              <LungsGraphic hasLesion={false} isHealthy={false} />
            </div>

            <div
              style={{
                ...styles.mouseCursor,
                transform: isClicking || isPressed ? 'translate(-60px, -80px)' : 'translate(0, 0)',
                opacity: [0, 1, 2, 4, 5, 6].includes(step) ? 1 : 0,
                transition: isPressed ? 'none' : 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="white" stroke="black" strokeWidth="1">
                <path d="M5.5 2.5L18.5 13.5L12.5 14.5L16.5 20.5L13.5 22L9.5 16L4.5 20.5V2.5Z" />
              </svg>
              {isPressed && <div className="click-ripple" />}
            </div>
          </div>

          <div
            style={{
              ...styles.card,
              opacity: showAnyResult ? 1 : 0,
              transform: showAnyResult ? 'translateX(0)' : 'translateX(-30px)',
              borderColor: showHealthyResult
                ? 'rgba(74, 222, 128, 0.2)'
                : showIllResult
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(255,255,255,0.05)',
              boxShadow: showHealthyResult
                ? '0 0 40px rgba(74, 222, 128, 0.1)'
                : showIllResult
                ? '0 0 40px rgba(239, 68, 68, 0.1)'
                : 'none',
            }}
          >
            <div style={styles.xrayWrapper}>
              <LungsGraphic hasLesion={showIllResult} isHealthy={showHealthyResult} />
            </div>
          </div>
        </div>

        <div style={styles.bottomSection}>
          <h1 style={styles.mainTitle}>
            影像所见，不止于所见
            <br />
          </h1>

          <p style={styles.subTitle}>
           整合胸部影像管理、异常检测与 AI 辅助分析，
            <br />
            帮助临床与科研在更有序的数据中获得更高效的判断支持
          </p>

          <div style={styles.authBar}>
            <div style={styles.inputBox}>
              <input
                className="email-input"
                placeholder="请输入用户名"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="login-btn"
                onClick={handleLogin}
              >
                登录
              </button>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .lungs-breathe { animation: breathe 4s infinite ease-in-out; }

        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }

        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        .click-ripple {
          position: absolute;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          background: rgba(255,255,255,0.4);
          border-radius: 50%;
          animation: ripple 0.3s ease-out;
        }

        @keyframes ripple {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(4); opacity: 0; }
        }

        .login-btn {
          background: rgb(26, 127, 55);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 0 30px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 2px 0 rgba(0,0,0,0.35),
            0 8px 18px rgba(0,0,0,0.22);
        }

        .login-btn:hover,
        .login-btn:focus-visible {
          background: rgb(17, 99, 41);
          transform: translateY(1px);
          box-shadow:
            inset 0 2px 4px rgba(0,0,0,0.18),
            0 4px 10px rgba(0,0,0,0.18);
          outline: none;
        }

        .login-btn:active {
          background: rgb(17, 99, 41);
          transform: translateY(2px) scale(0.985);
          box-shadow:
            inset 0 3px 6px rgba(0,0,0,0.24),
            0 0 0 rgba(0,0,0,0.2);
        }

        .reg-btn {
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.32);
          padding: 18px 35px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 1px 0 rgba(0,0,0,0.2);
        }

        .reg-btn:hover,
        .reg-btn:focus-visible {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 1px 0 rgba(0,0,0,0.16);
          outline: none;
        }

        .reg-btn:active {
          background: rgba(255, 255, 255, 0.01);
          border-color: rgba(255, 255, 255, 0.14);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
        }

        .email-input {
          flex: 1;
          border: none;
          padding: 18px 24px;
          outline: none;
          font-size: 15px;
          color: #111827;
          background: #f3f4f6;
        }

        .email-input::placeholder {
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;