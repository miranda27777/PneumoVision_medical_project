import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import CasesTable from './CasesTable';
import QuickActions from './QuickActions';
import NewCaseModal from './NewCaseModal';
import EditCaseModal from './EditCaseModal';
import TopNotice from '../common/TopNotice';
import { useDashboardData } from '../../hooks/useDashboardData';
import './DoctorDashboard.css';
import { logoutToLogin } from '../../utils/auth';

const DoctorDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [filters, setFilters] = useState({
    keyword: '',
    searchType: 'caseNumber',
    startDate: '',
    endDate: ''
  });

  const [noticeVisible, setNoticeVisible] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeType, setNoticeType] = useState('info');

  // 防止重复提交导致栈溢出
  const isSavingRef = useRef(false);

  const showNotice = (message, type = 'info') => {
    setNoticeMessage(message);
    setNoticeType(type);
    setNoticeVisible(true);
  };

  const closeNotice = () => {
    setNoticeVisible(false);
    setNoticeMessage('');
  };

  const {
    loading,
    error,
    cases,
    total,
    refreshData,
    updateCaseTaskId
  } = useDashboardData(currentPage, pageSize, filters);

  const pathname = location.pathname;
  const activeMenu = pathname.startsWith('/cases') ? 'cases' : 'overview';

  const handleLogout = async () => {
    await logoutToLogin();
  };

  const handleNewCase = () => {
    setIsNewCaseModalOpen(true);
  };

  const handleEditCase = async (caseItem) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/cases/${caseItem.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.code === 0) {
        setEditingCase(result.data);
        setIsEditModalOpen(true);
      } else {
        showNotice('获取病例详情失败', 'error');
      }
    } catch (error) {
      console.error('获取病例详情失败:', error);
      showNotice('获取病例详情失败', 'error');
    }
  };

  const normalizeGender = (gender) => {
    if (gender === '' || gender == null || gender === '未知') {
      return null;
    }

    return gender;
  };

  const handleSaveCase = async (formData) => {
    console.log('=== DoctorDashboard 收到的数据 ===', formData);
    
    // 防止重复提交导致栈溢出
    if (isSavingRef.current) {
      console.log('正在保存中，跳过重复调用');
      return;
    }
    isSavingRef.current = true;
    
    try {
      const token = localStorage.getItem('token');
      const requestBody = {
        patientName: formData.patientName,
        patientIdDeidentified: formData.patientIdDeidentified || '',
        gender: normalizeGender(formData.gender),
        age: formData.age ? parseInt(formData.age, 10) : null,
        remark: formData.remark || ''
      };
      
      console.log('发送到后端的请求体:', requestBody);
      
      const response = await fetch(`/api/cases/${editingCase.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const result = await response.json();
      console.log('保存结果:', result);
      
      if (result.code === 0) {
        showNotice('更新成功', 'success');
        setIsEditModalOpen(false);
        
        // 延迟关闭弹窗和刷新，避免递归
        setTimeout(() => {
          setEditingCase(null);
          refreshData();
        }, 100);
        
        // 如果当前在病例详情页，强制刷新页面数据
        const currentPath = window.location.pathname;
        if (currentPath.includes(`/cases/${editingCase.id}`)) {
          setTimeout(() => {
            window.location.reload();
          }, 200);
        }
      } else {
        showNotice('更新失败：' + result.message, 'error');
      }
    } catch (error) {
      console.error('更新病例失败:', error);
      showNotice('更新失败：' + error.message, 'error');
    } finally {
      // 延迟重置保存标志
      setTimeout(() => {
        isSavingRef.current = false;
      }, 500);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  // 新建病例成功后的回调
  const handleNewCaseSuccess = (newCaseId) => {
    showNotice('病例创建成功', 'success');
    refreshData();
    // 可选：跳转到病例详情页
    if (newCaseId) {
      navigate(`/cases/${newCaseId}`);
    }
  };

  const menuItems = [
    { id: 'overview', icon: '🏠', label: '首页概览', path: '/overview' },
    { id: 'cases', icon: '📋', label: '病例管理', path: '/cases' }
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
        <div className="header-actions">
          <button onClick={refreshData} className="refresh-btn">
            🔄 刷新数据
          </button>
        </div>
      </div>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{total}</div>
            <div className="stat-label">总病例数</div>
          </div>
        </div>
      </div>

      <div className="info-card">
        <h3>📋 医生工作台使用指南</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-icon">📤</span>
            <div>
              <strong>上传影像</strong>
              <p>点击病例旁的“上传图像”按钮，选择 X 光片上传</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">🤖</span>
            <div>
              <strong>肺炎检测</strong>
              <p>对已上传的影像进行 AI 肺炎检测，获取诊断结果</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">📊</span>
            <div>
              <strong>查看结果</strong>
              <p>查看检测结果，包括肺炎概率和病灶位置</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">📥</span>
            <div>
              <strong>导出数据</strong>
              <p>导出检测结果为 JSON 格式，用于研究和记录</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderCases = () => (
    <>
      <QuickActions
        onNewCase={handleNewCase}
        onRefresh={refreshData}
        cases={cases}
      />
      <CasesTable
        cases={cases}
        total={total}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        onRefresh={refreshData}
        onUpdateCaseTaskId={updateCaseTaskId}
        onFilterChange={handleFilterChange}
        onEditCase={handleEditCase}
        filters={filters}
      />
      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onRefresh={handleNewCaseSuccess}
      />
      
      <EditCaseModal
        isOpen={isEditModalOpen}
        caseData={editingCase}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCase(null);
        }}
        onSave={handleSaveCase}
      />
    </>
  );

  const renderContent = () => {
  // 病例管理页面不要因为 loading 把 CasesTable 整个卸载掉
  // 否则搜索框每次实时查询都会丢光标
  if (activeMenu === 'cases') {
    if (error && cases.length === 0) {
      return (
        <div className="error-container">
          <p className="error-message">❌ {error}</p>
          <button onClick={refreshData} className="retry-btn">
            重新加载
          </button>
        </div>
      );
    }

    return renderCases();
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>加载数据中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">❌ {error}</p>
        <button onClick={refreshData} className="retry-btn">
          重新加载
        </button>
      </div>
    );
  }

  return renderOverview();
};

  return (
    <div className="doctor-container">
      <TopNotice
        visible={noticeVisible}
        message={noticeMessage}
        type={noticeType}
        onClose={closeNotice}
      />

      <Header title="医生工作台" />

      <div className="doctor-layout">
        <div className="doctor-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">医生导航</span>
          </div>

          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
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

        <div className="doctor-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;