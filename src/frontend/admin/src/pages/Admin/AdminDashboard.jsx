import React, { useState } from 'react';
import Header from '../../components/common/Header';
import SystemOverview from './components/SystemOverview';
import UserManagement from './components/UserManagement';
import AuditLogs from './components/AuditLogs';
import './AdminDashboard.css';
import { logoutToLogin } from '../../utils/auth';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const handleLogout = async () => {
    await logoutToLogin();
  };

  const menuItems = [
    { id: 'overview', icon: '📊', label: '系统概览' },
    { id: 'users', icon: '👥', label: '用户管理' },
    { id: 'logs', icon: '📋', label: '审计日志' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SystemOverview />;
      case 'users':
        return <UserManagement />;
      case 'logs':
        return <AuditLogs />;
      case 'models':
        return <ModelConfig />;
      default:
        return <SystemOverview />;
    }
  };

  return (
    <div className="admin-container">
      <Header title="系统管理控制台" />

      <div className="admin-layout">
        <div className="admin-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">管理菜单</span>
          </div>

          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button onClick={handleLogout} className="logout-btn">
              🚪 退出登录
            </button>
          </div>
        </div>

        <div className="admin-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;