import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../common/Header';
import TopNotice from '../common/TopNotice';
import StudyDetail from './StudyDetail';
import EditCaseModal from './EditCaseModal';
import CreateExaminationModal from './CreateExaminationModal';
import ConfirmModal from './ConfirmModal';
import './DoctorDashboard.css';
import './StudiesPage.css';
import { logoutToLogin } from '../../utils/auth';

const StudiesPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageInput, setPageInput] = useState('1');
  const [pageSizeInput, setPageSizeInput] = useState('10');

  const [selectedStudy, setSelectedStudy] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createExaminationModalOpen, setCreateExaminationModalOpen] = useState(false);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingStudy, setDeletingStudy] = useState(null);

  const [showSensitive, setShowSensitive] = useState(false);
  const [sensitiveInfo, setSensitiveInfo] = useState(null);
  const [loadingSensitive, setLoadingSensitive] = useState(false);

  // TopNotice 状态
  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const showNotice = (message, type = 'info') => {
    setNotice({
      visible: true,
      message,
      type
    });
  };

  const closeNotice = () => {
    setNotice({
      visible: false,
      message: '',
      type: 'info'
    });
  };

  const getPatientNameDisplay = () => {
    if (showSensitive) {
      return sensitiveInfo?.patientName || caseData?.patientNameMasked || '-';
    }

    return caseData?.patientNameMasked || '-';
  };

  const getPatientIdDisplay = () => {
    if (showSensitive) {
      return sensitiveInfo?.patientIdDeidentified || sensitiveInfo?.patientId || caseData?.patientIdMasked || '-';
    }

    return caseData?.patientIdMasked || '-';
  };

  const fetchSensitiveInfo = async () => {
    const response = await fetch(`/api/cases/${caseId}/sensitive-info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.code === 0 && result.data) {
      return result.data;
    }

    throw new Error(result.message || '获取敏感信息失败');
  };

  const handleToggleSensitive = async () => {
    if (showSensitive) {
      setShowSensitive(false);
      return;
    }

    if (sensitiveInfo?.patientName || sensitiveInfo?.patientIdDeidentified || sensitiveInfo?.patientId) {
      setShowSensitive(true);
      return;
    }

    try {
      setLoadingSensitive(true);
      const data = await fetchSensitiveInfo();
      setSensitiveInfo(data);
      setShowSensitive(true);
    } catch (error) {
      showNotice('显示敏感信息失败：' + error.message, 'error');
    } finally {
      setLoadingSensitive(false);
    }
  };

  const fetchCaseDetail = async () => {
    const response = await fetch(`/api/cases/${caseId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.code === 0 && result.data) {
      setCaseData(result.data);
      setShowSensitive(false);
      setSensitiveInfo(null);
      return;
    }

    throw new Error(result.message || '获取病例详情失败');
  };

  const fetchStudies = async () => {
    const response = await fetch(`/api/cases/${caseId}/studies`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(result.message || '获取检查记录失败');
    }

    let studiesList = [];
    const data = result.data;

    if (data && Array.isArray(data.items)) {
      studiesList = data.items;
    } else if (Array.isArray(data)) {
      studiesList = data;
    }

    setStudies(studiesList);
  };

  const fetchAllData = async () => {
    if (!caseId) return;

    setLoading(true);
    setError('');

    try {
      await Promise.all([fetchCaseDetail(), fetchStudies()]);
    } catch (err) {
      console.error(err);
      setError(err.message || '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [caseId, refreshKey]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(studies.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [studies.length, pageSize, currentPage]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai'
    });
  };

  const total = studies.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pagedStudies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return studies.slice(start, end);
  }, [studies, currentPage, pageSize]);

  const goToPage = (page) => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(safePage);
  };

  const commitPageInput = () => {
    if (pageInput.trim() === '') {
      setPageInput(String(currentPage));
      return;
    }

    const value = Number(pageInput);
    if (!Number.isInteger(value) || value < 1) {
      setPageInput(String(currentPage));
      return;
    }

    goToPage(value);
  };

  const commitPageSizeInput = () => {
    if (pageSizeInput.trim() === '') {
      setPageSizeInput(String(pageSize));
      return;
    }

    const value = Number(pageSizeInput);
    if (!Number.isInteger(value) || value < 1) {
      setPageSizeInput(String(pageSize));
      return;
    }

    setPageSize(value);
    setCurrentPage(1);
  };

  const handleViewStudy = (study) => {
    setSelectedStudy(study);
    setDetailModalOpen(true);
  };

  const handleDeleteStudy = (study) => {
    setDeletingStudy(study);
    setConfirmModalOpen(true);
  };

  const handleConfirmDeleteStudy = async () => {
    if (!deletingStudy) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/cases/${caseId}/studies/${deletingStudy.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.code === 0) {
        showNotice('删除成功', 'success');
        setConfirmModalOpen(false);
        setDeletingStudy(null);
        handleRefresh();
      } else {
        showNotice('删除失败：' + result.message, 'error');
      }
    } catch (error) {
      console.error('删除检查失败:', error);
      showNotice('删除失败：' + error.message, 'error');
    }
  };

  const handleCancelDeleteStudy = () => {
    setConfirmModalOpen(false);
    setDeletingStudy(null);
  };

  const handleLogout = async () => {
    await logoutToLogin();
  };

  const normalizeGender = (gender) => {
    if (gender === '' || gender == null || gender === '未知') {
      return null;
    }

    return gender;
  };

  const handleSaveEdit = async (formData) => {
    console.log('=== StudiesPage 收到的数据 ===', formData);
    
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
      
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      console.log('保存结果:', result);

      if (result.code === 0) {
        showNotice('编辑成功', 'success');
        setEditModalOpen(false);
        handleRefresh();
      } else {
        showNotice('编辑失败：' + result.message, 'error');
      }
    } catch (error) {
      console.error('编辑失败:', error);
      showNotice('编辑失败：' + error.message, 'error');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载病例详情中...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <p className="error-message">❌ {error}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={handleRefresh} className="retry-btn">
              重新加载
            </button>
            <button onClick={() => navigate('/cases')} className="retry-btn">
              返回
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <TopNotice
          visible={notice.visible}
          message={notice.message}
          type={notice.type}
          onClose={closeNotice}
        />

        <div className="studies-page-header-row">
          <button onClick={() => navigate('/cases')} className="studies-back-btn">
            ← 返回
          </button>

          <div className="studies-page-title-block">
            <h2>病例详情</h2>
            <p>病例号：{caseData?.caseNumber || caseData?.id}</p>
          </div>

          <button onClick={handleRefresh} className="refresh-btn">
            🔄 刷新数据
          </button>
        </div>

        <div className="case-info-panel">
          <div
            className="case-info-panel-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <h3 style={{ margin: 0 }}>📋 病例基本信息</h3>

            <button
              className="action-btn"
              onClick={handleToggleSensitive}
              disabled={loadingSensitive}
              style={{
                padding: '8px 18px',
                minWidth: '132px',
                justifyContent: 'center'
              }}
            >
              {loadingSensitive
                ? '加载中...'
                : showSensitive
                  ? '隐藏敏感信息'
                  : '显示敏感信息'}
            </button>
          </div>

          <div className="case-info-panel-grid">
            <div className="case-info-panel-item">
              <span className="case-info-panel-label">病例号</span>
              <span className="case-info-panel-value">{caseData?.caseNumber || '-'}</span>
            </div>

            <div className="case-info-panel-item">
              <span className="case-info-panel-label">病人姓名</span>
              <span className="case-info-panel-value">{getPatientNameDisplay()}</span>
            </div>

            <div className="case-info-panel-item">
              <span className="case-info-panel-label">病人编号</span>
              <span className="case-info-panel-value">{getPatientIdDisplay()}</span>
            </div>

            <div className="case-info-panel-item">
              <span className="case-info-panel-label">性别 / 年龄</span>
              <span className="case-info-panel-value">
                {caseData?.gender || '-'} / {caseData?.age ?? '-'}
              </span>
            </div>

            <div className="case-info-panel-item">
              <span className="case-info-panel-label">创建时间</span>
              <span className="case-info-panel-value">{formatDate(caseData?.createdAt)}</span>
            </div>

            <div className="case-info-panel-item case-info-panel-item-desc">
              <span className="case-info-panel-label">病例描述</span>
              <span className="case-info-panel-value">
                {caseData?.remark || caseData?.description || '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="cases-table-container studies-table-section">
          <div className="table-header">
            <h3 className="section-title">检查记录</h3>
            <div className="btn-row">
              <button
                className="action-btn edit"
                onClick={() => setEditModalOpen(true)}
              >
                编辑信息
              </button>
              <button
                className="action-btn create-examination"
                onClick={() => setCreateExaminationModalOpen(true)}
              >
                新建检查
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table
              className="cases-table"
              style={{ tableLayout: 'fixed', width: '100%' }}
            >
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '34%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>检查时间</th>
                  <th>模态</th>
                  <th>描述</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedStudies.length > 0 ? (
                  pagedStudies.map((study) => (
                    <tr key={study.id}>
                      <td style={{ textAlign: 'left' }}>{formatDate(study.studyTime)}</td>
                      <td style={{ textAlign: 'left' }}>{study.modality || 'DX'}</td>
                      <td style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                        {study.description || '-'}
                      </td>
                      <td className="actions-cell" style={{ textAlign: 'left' }}>
                        <div className="btn-row">
                          <button
                            className="action-btn"
                            onClick={() => navigate(`/cases/${caseId}/studies/${study.id}`)}
                          >
                            查看检查
                          </button>

                          <button
                            className="action-btn delete"
                            onClick={() => handleDeleteStudy(study)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="no-data">暂无检查记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div className="pagination-left">
              <div className="page-size-selector bottom-page-size-selector">
                <span>每页显示</span>
                <input
                  className="page-size-input"
                  type="text"
                  inputMode="numeric"
                  value={pageSizeInput}
                  onChange={(e) => setPageSizeInput(e.target.value)}
                  onBlur={commitPageSizeInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitPageSizeInput();
                    }
                  }}
                />
                <span>条，共</span>
                <strong>{total}</strong>
                <span>条记录</span>
              </div>
            </div>

            <div className="pagination-actions">
              <button
                className="pagination-btn"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
              >
                首页
              </button>

              <button
                className="pagination-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                上一页
              </button>

              <input
                className="page-jump-input"
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitPageInput();
                  }
                }}
              />

              <span className="page-jump-text">/ {totalPages}</span>

              <button
                className="pagination-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                下一页
              </button>

              <button
                className="pagination-btn"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                末页
              </button>
            </div>
          </div>
        </div>

        <StudyDetail
          isOpen={detailModalOpen}
          study={selectedStudy}
          caseId={caseId}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedStudy(null);
          }}
        />

        <EditCaseModal
          isOpen={editModalOpen}
          caseData={caseData}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSaveEdit}
        />

        <ConfirmModal
          isOpen={confirmModalOpen}
          title="确认删除"
          message={`确定要删除检查【${formatDate(deletingStudy?.studyTime)}】吗？此操作不可恢复！`}
          onConfirm={handleConfirmDeleteStudy}
          onCancel={handleCancelDeleteStudy}
        />

        <CreateExaminationModal
          isOpen={createExaminationModalOpen}
          caseItem={caseData}
          onClose={() => {
            setCreateExaminationModalOpen(false);
            handleRefresh();
          }}
          onSuccess={(result) => {
            const newStudyId = result?.data?.id ?? result?.id;

            setCreateExaminationModalOpen(false);
            handleRefresh();

            if (newStudyId) {
              navigate(`/cases/${caseId}/studies/${newStudyId}`);
            }
          }}
        />
      </>
    );
  };

  return (
    <div className="doctor-container">
      <Header title="医生工作台" />
      <div className="doctor-layout">
        <div className="doctor-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">医生导航</span>
          </div>

          <nav className="sidebar-nav">
            <button className="nav-item" onClick={() => navigate('/overview')}>
              <span className="nav-icon">🏠</span>
              <span className="nav-label">首页概览</span>
            </button>
            <button className="nav-item active" onClick={() => navigate('/cases')}>
              <span className="nav-icon">📋</span>
              <span className="nav-label">病例管理</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <button onClick={handleLogout} className="logout-btn">
              🚪 退出登录
            </button>
          </div>
        </div>

        <div className="doctor-content">{renderContent()}</div>
      </div>
    </div>
  );
};

export default StudiesPage;