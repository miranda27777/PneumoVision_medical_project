import React, { useState, useEffect } from 'react';
import Header from '../../components/common/Header';
import TaskList from './components/TaskList';
import ModelComparison from './components/ModelComparison';
import { inferenceApi } from '../../api';
import './ResearcherDashboard.css';
import { logoutToLogin } from '../../utils/auth';

const ResearcherDashboard = () => {
  const [activeMenu, setActiveMenu] = useState('overview');
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    pending: 0
  });

  const [loadingStats, setLoadingStats] = useState(false);

  const handleLogout = async () => {
    await logoutToLogin();
  };

  const loadStats = async () => {
    setLoadingStats(true);

    try {
      const imagesResponse = await fetch('/api/images?page=0&size=100', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      const imagesData = await imagesResponse.json();

      if (imagesData.code === 0 && imagesData.data) {
        const images = imagesData.data.items || imagesData.data || [];

        let total = 0;
        let success = 0;
        let failed = 0;
        let pending = 0;

        for (const image of images) {
          if (image.id) {
            try {
              const tasksRes = await inferenceApi.listTasks({
                imageId: image.id
              });

              if (tasksRes.code === 0 && tasksRes.data) {
                const taskList = Array.isArray(tasksRes.data)
                  ? tasksRes.data
                  : Array.isArray(tasksRes.data.items)
                    ? tasksRes.data.items
                    : [tasksRes.data];

                for (const task of taskList) {
                  total += 1;

                  if (task.status === 'SUCCESS') {
                    success += 1;
                  } else if (task.status === 'FAILED') {
                    failed += 1;
                  } else {
                    pending += 1;
                  }
                }
              }
            } catch (err) {
              console.error('获取任务失败:', err);
            }
          }
        }

        setStats({
          total,
          success,
          failed,
          pending
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const menuItems = [
    {
      id: 'overview',
      icon: '🏠',
      label: '首页概览'
    },
    {
      id: 'tasks',
      icon: '📋',
      label: '检测任务'
    },
    {
      id: 'models',
      icon: '🤖',
      label: '模型配置'
    }
  ];

  const renderOverview = () => (
    <>
      <div className="welcome-section">
        <div>
          <h2>欢迎回来</h2>
          <p className="date">
            {new Date().toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
      </div>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{loadingStats ? '-' : stats.total}</div>
            <div className="stat-label">总检测数</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{loadingStats ? '-' : stats.success}</div>
            <div className="stat-label">成功检测</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <div className="stat-value">{loadingStats ? '-' : stats.failed}</div>
            <div className="stat-label">失败检测</div>
          </div>
        </div>
      </div>

      <div className="info-card">
        <h3>🔬 科研平台使用指南</h3>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-icon">📋</span>
            <div>
              <strong>检测任务</strong>
              <p>查看所有AI检测任务，包括状态、结果和医生评价</p>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon">🤖</span>
            <div>
              <strong>模型配置</strong>
              <p>查看和配置AI模型参数</p>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon">📥</span>
            <div>
              <strong>数据导出</strong>
              <p>导出检测结果为JSON或PDF格式</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const isFlushContent = activeMenu === 'tasks';

  return (
    <div className="dashboard-container">
      <Header title="科研分析平台" />

      <div className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">科研导航</span>
          </div>

          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`sidebar-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => setActiveMenu(item.id)}
              >
                <span className="item-icon">{item.icon}</span>
                <span className="item-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button onClick={handleLogout} className="logout-btn">
              🚪 退出登录
            </button>
          </div>
        </aside>

        <div className={`content-area ${isFlushContent ? 'content-area-flush' : ''}`}>
          {activeMenu === 'overview' && renderOverview()}
          {activeMenu === 'tasks' && <TaskList />}
          {activeMenu === 'models' && <ModelComparison />}
        </div>
      </div>
    </div>
  );
};

export default ResearcherDashboard;