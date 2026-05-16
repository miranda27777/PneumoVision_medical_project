import React, { useState, useEffect } from 'react';
import { studyApi, inferenceApi } from '../../api';
import StudyDetail from './StudyDetail';
import TaskResultModal from './TaskResultModal';
import TopNotice from '../common/TopNotice';
import './StudyList.css';

const StudyList = ({ caseId, caseName, onRefresh }) => {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
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

  const loadStudies = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const response = await studyApi.getStudiesByCaseId(caseId);
      console.log('获取Study列表响应:', response);

      if (response.code === 0) {
        const data = response.data;
        let studiesList = [];
        if (data && Array.isArray(data.items)) {
          studiesList = data.items;
        } else if (Array.isArray(data)) {
          studiesList = data;
        }

        for (let i = 0; i < studiesList.length; i++) {
          const study = studiesList[i];

          const imagesRes = await fetch(`/api/images/study/${study.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          const imagesData = await imagesRes.json();

          if (imagesData.code === 0 && imagesData.data && imagesData.data.items && imagesData.data.items.length > 0) {
            const imgId = imagesData.data.items[0].id;

            const tasksRes = await inferenceApi.listTasks({ imageId: imgId });
            if (tasksRes.code === 0 && tasksRes.data && tasksRes.data.length > 0) {
              const task = tasksRes.data[0];
              study.taskId = task.id;
              study.taskStatus = task.status;
            } else {
              study.taskId = null;
              study.taskStatus = null;
            }
          } else {
            study.taskId = null;
            study.taskStatus = null;
          }
        }
        setStudies(studiesList);
      }
    } catch (error) {
      console.error('加载检查列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudies();
  }, [caseId]);

  const handleViewDetail = (study) => {
    setSelectedStudy(study);
    setDetailModalOpen(true);
  };

  const handleViewResult = (study) => {
    if (study.taskId) {
      setSelectedTaskId(study.taskId);
      setResultModalOpen(true);
    } else {
      showNotice('该检查暂无检测结果', 'error');
    }
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'SUCCESS':
        return { text: '成功', className: 'status-success' };
      case 'FAILED':
        return { text: '失败', className: 'status-failed' };
      case 'RUNNING':
        return { text: '检测中', className: 'status-running' };
      case 'PENDING':
        return { text: '待处理', className: 'status-pending' };
      default:
        return { text: '未检测', className: 'status-pending' };
    }
  };

  const formatDateTime = (dateStr) => {
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

  return (
    <>
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="study-list-container">
        <div className="study-list-header" onClick={() => setExpanded(!expanded)}>
          <div className="study-header-left">
            <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
            <span className="study-title">📋 检查记录 - {caseName}</span>
            <span className="study-count">({studies.length})</span>
          </div>
        </div>

        {expanded && (
          <div className="study-list-content">
            {loading && <div className="study-loading">加载中...</div>}
            {!loading && studies.length === 0 && <div className="study-empty">暂无检查记录</div>}
            {!loading && studies.length > 0 && (
              <table className="study-table">
                <thead>
                  <tr>
                    <th>检查时间</th>
                    <th>模态</th>
                    <th>检测状态</th>
                    <th>描述</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {studies.map((study) => {
                    const statusDisplay = getStatusDisplay(study.taskStatus);
                    return (
                      <tr key={study.id}>
                        <td>{formatDateTime(study.studyTime)}</td>
                        <td>{study.modality || 'DX'}</td>
                        <td>
                          <span className={`status-badge ${statusDisplay.className}`}>
                            {statusDisplay.text}
                          </span>
                        </td>
                        <td>{study.description || '-'}</td>
                        <td className="study-actions">
                          <button
                            className="view-result-btn"
                            onClick={() => handleViewResult(study)}
                            disabled={!study.taskId}
                            style={{ opacity: study.taskId ? 1 : 0.5 }}
                          >
                            查看结果
                          </button>
                          <button
                            className="view-detail-btn"
                            onClick={() => handleViewDetail(study)}
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <StudyDetail
        isOpen={detailModalOpen}
        study={selectedStudy}
        caseId={caseId}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedStudy(null);
        }}
        onRefresh={() => {
          loadStudies();
          if (onRefresh) onRefresh();
        }}
      />

      <TaskResultModal
        isOpen={resultModalOpen}
        taskId={selectedTaskId}
        onClose={() => {
          setResultModalOpen(false);
          setSelectedTaskId(null);
        }}
      />
    </>
  );
};

export default StudyList;