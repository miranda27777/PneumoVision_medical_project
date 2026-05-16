import React, { useState, useEffect } from 'react';
import { adminUserApi } from '../../../api';
import './SystemOverview.css';

const SystemOverview = () => {
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await adminUserApi.listUsers();
        if (response.code === 0) {
          const count = Array.isArray(response.data)
            ? response.data.length
            : (response.data?.items?.length || 0);
          setTotalUsers(count);
        }
      } catch (error) {
        console.error('获取用户数失败:', error);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="system-overview">
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

      <h2 className="page-title">系统概览</h2>

      {/* 功能介绍卡片 */}
      <div className="info-card">
        <h3>⚙️ 管理员控制台使用指南</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-icon">👥</span>
            <div>
              <strong>用户管理</strong>
              <p>创建、启用、禁用用户账号，管理医生和科研人员</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">📋</span>
            <div>
              <strong>审计日志</strong>
              <p>查看所有用户的操作记录，追踪系统使用情况</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">📊</span>
            <div>
              <strong>系统监控</strong>
              <p>查看系统运行状态和数据统计</p>
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 - 只有总用户数 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <span className="stat-value">{totalUsers}</span>
            <span className="stat-label">总用户数</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemOverview;