import React, { useState } from 'react';
import { inferenceApi, exportApi } from '../../api';
import TaskResultModal from './TaskResultModal';
import TopNotice from '../common/TopNotice';
import './AIResults.css';

const AIResults = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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

  const handleExportJSON = async (resultId) => {
    try {
      const data = await exportApi.exportJSON(resultId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `result_${resultId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotice('导出失败：' + error.message, 'error');
    }
  };

  const handleViewDetails = (taskId) => {
    setSelectedTaskId(taskId);
    setModalOpen(true);
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <>
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="ai-results-container">
        <h3 className="section-title">AI检测结果</h3>

        <div className="results-list">
          {results.length > 0 ? (
            results.map((result, index) => (
              <div
                key={index}
                className={`result-card ${
                  result.label === '肺炎阳性'
                    ? 'red'
                    : result.label === '正常'
                    ? 'green'
                    : 'yellow'
                }`}
              >
                <div className="result-header">
                  <span className="case-id">{result.caseNumber || result.caseId || result.id}</span>
                  <span className="result-badge">
                    {result.label === '肺炎阳性'
                      ? '🔴 肺炎阳性'
                      : result.label === '正常'
                      ? '🟢 正常'
                      : '🟡 肺炎可疑'}
                  </span>
                </div>

                <div className="result-content">
                  <div className="image-placeholder">
                    <span className="xray-icon">🖼️</span>
                  </div>

                  <div className="result-details">
                    <div className="confidence-display">
                      <span className="confidence-label">置信度</span>
                      <span className="confidence-value">{result.confidence || result.score}%</span>
                    </div>
                    <div className="confidence-bar">
                      <div
                        className={`confidence-fill ${
                          result.label === '肺炎阳性'
                            ? 'red'
                            : result.label === '正常'
                            ? 'green'
                            : 'yellow'
                        }`}
                        style={{ width: `${result.confidence || result.score}%` }}
                      />
                    </div>
                    <div className="result-actions">
                      <button
                        className="action-btn export"
                        onClick={() => handleExportJSON(result.id)}
                      >
                        📥 导出JSON
                      </button>
                      <button
                        className="action-btn view"
                        onClick={() => handleViewDetails(result.taskId || result.id)}
                      >
                        👁️ 查看详情
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-data">点击"运行检测"创建任务，完成后点击"查看结果"查看检测详情</div>
          )}
        </div>
      </div>

      <TaskResultModal
        isOpen={modalOpen}
        taskId={selectedTaskId}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

export default AIResults;