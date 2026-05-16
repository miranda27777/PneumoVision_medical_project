import React, { useEffect, useRef, useState } from 'react';
import { imageApi, inferenceApi } from '../../../api';
import TopNotice from '../../../components/common/TopNotice';
import './ResearchImageTaskDetailPage.css';

const isApiSuccess = (response) => {
  return response && (response.code === 0 || response.code === 200);
};

const normalizeTaskList = (response) => {
  if (!isApiSuccess(response) || !response.data) return [];

  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data.items)) return response.data.items;

  return [];
};

const normalizeEvaluationStatus = (taskData) => {
  if (!taskData) return '';

  if (taskData.doctorEvaluationStatus != null) return taskData.doctorEvaluationStatus;
  if (taskData.doctor_evaluation_status != null) return taskData.doctor_evaluation_status;

  if (typeof taskData.reviewedCorrect === 'boolean') {
    return taskData.reviewedCorrect ? 'CORRECT' : 'ERROR';
  }

  if (typeof taskData.reviewed_correct === 'boolean') {
    return taskData.reviewed_correct ? 'CORRECT' : 'ERROR';
  }

  return '';
};

const normalizeReviewComment = (taskData) => {
  if (!taskData) return '';
  return taskData.reviewComment ?? taskData.review_comment ?? '';
};

const getStatusText = (status) => {
  switch (status) {
    case 'QUEUED':
    case 'PENDING':
      return '排队中';
    case 'RUNNING':
      return '检测中';
    case 'SUCCESS':
      return '已完成';
    case 'FAILED':
      return '失败';
    default:
      return '未检测';
  }
};

const getStatusClass = (status) => {
  switch (status) {
    case 'SUCCESS':
      return 'status-success';
    case 'FAILED':
      return 'status-failed';
    case 'RUNNING':
      return 'status-running';
    case 'QUEUED':
    case 'PENDING':
      return 'status-pending';
    default:
      return 'status-none';
  }
};

const getResultText = (label) => {
  if (!label) return '未知';
  if (label === 'pneumonia') return '肺炎';
  if (label === 'normal') return '正常';
  return label;
};

const getResultClass = (label) => {
  if (!label) return 'result-unknown';
  if (label === 'normal') return 'result-normal';
  return 'result-pneumonia';
};

const getDoctorEvaluationText = (status) => {
  switch (status) {
    case 'CORRECT':
      return '正确';
    case 'ERROR':
      return '错误';
    case 'MISSED':
      return '漏检';
    case 'FALSE_POSITIVE':
      return '误检';
    case '':
    case null:
    case undefined:
    default:
      return '未评价';
  }
};

const getDoctorEvaluationClass = (status) => {
  switch (status) {
    case 'CORRECT':
      return 'evaluation-correct';
    case 'ERROR':
    case 'MISSED':
    case 'FALSE_POSITIVE':
      return 'evaluation-negative';
    case '':
    case null:
    case undefined:
    default:
      return 'evaluation-unreviewed';
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 19);
  }

  const pad = (num) => String(num).padStart(2, '0');

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getTaskDetectionTime = (task) => {
  return (
    task?.finishedAt ||
    task?.finished_at ||
    task?.startedAt ||
    task?.started_at ||
    task?.createdAt ||
    task?.created_at ||
    null
  );
};

const summarizeResults = (results) => {
  if (!Array.isArray(results) || results.length === 0) return '无结果';

  const pneumoniaResult = results.find((item) => item?.label === 'pneumonia');
  if (pneumoniaResult) return '肺炎';

  const firstLabel = results.find((item) => item?.label)?.label;
  return getResultText(firstLabel);
};

const getSummaryClassLabel = (results) => {
  if (!Array.isArray(results) || results.length === 0) return '';

  const pneumoniaResult = results.find((item) => item?.label === 'pneumonia');
  if (pneumoniaResult) return 'pneumonia';

  return results.find((item) => item?.label)?.label || '';
};

const hasBox = (box) => {
  return (
    box &&
    box.x != null &&
    box.y != null &&
    box.width != null &&
    box.height != null
  );
};

const getBoxLabelText = (box) => {
  const label =
    box.label === 'pneumonia'
      ? '肺炎'
      : box.label === 'normal'
        ? '正常'
        : box.label || '肺炎';

  const confidence = box.score != null ? Math.round(Number(box.score) * 100) : null;

  return confidence != null ? `${label} ${confidence}%` : label;
};

const ReadOnlyTaskViewer = ({ imageItem, taskItem, compact = false }) => {
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [detectionResults, setDetectionResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState('original');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const [viewerDragStart, setViewerDragStart] = useState({ x: 0, y: 0 });
  const [scoreThreshold, setScoreThreshold] = useState(0);

  const originalImgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const viewerCanvasRef = useRef(null);
  const originalImageUrlRef = useRef(null);

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

  const shouldShowBoxByThreshold = (box) => {
    if (!hasBox(box)) return false;
    if (box.score == null) return true;
    return Number(box.score) >= scoreThreshold;
  };

  const drawBoxesOnCanvas = (canvas, useThreshold = false) => {
    const img = originalImgRef.current;
    if (!canvas || !img) return;

    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;

    if (!imageWidth || !imageHeight) return;

    canvas.width = imageWidth;
    canvas.height = imageHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, imageWidth, imageHeight);
    ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

    detectionResults.forEach((box) => {
      if (useThreshold ? !shouldShowBoxByThreshold(box) : !hasBox(box)) return;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      const text = getBoxLabelText(box);
      ctx.font = 'bold 14px sans-serif';
      const textWidth = ctx.measureText(text).width;

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(box.x, Math.max(0, box.y - 22), textWidth + 8, 22);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, box.x + 4, Math.max(14, box.y - 8));
    });
  };

  const drawPreviewCanvas = () => {
    drawBoxesOnCanvas(previewCanvasRef.current, false);
  };

  const drawViewerCanvas = () => {
    drawBoxesOnCanvas(viewerCanvasRef.current, true);
  };

  const loadData = async () => {
    if (!imageItem?.id) return;

    setLoading(true);
    setDetectionResults([]);

    try {
      const blob = await imageApi.getPreview(imageItem.id);
      const url = URL.createObjectURL(blob);

      if (originalImageUrlRef.current) {
        URL.revokeObjectURL(originalImageUrlRef.current);
      }

      originalImageUrlRef.current = url;
      setOriginalImageUrl(url);

      if (!taskItem?.id) {
        setDetectionResults([]);
        return;
      }

      if (Array.isArray(taskItem.historyResults)) {
        setDetectionResults(taskItem.historyResults);
        return;
      }

      const resultRes = await inferenceApi.listResults(taskItem.id);
      const list =
        isApiSuccess(resultRes) && resultRes.data
          ? Array.isArray(resultRes.data)
            ? resultRes.data
            : [resultRes.data]
          : [];

      setDetectionResults(list);
    } catch (err) {
      console.error('加载图像详情失败:', err);
      setDetectionResults([]);
      showNotice('加载图像详情失败：' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    return () => {
      if (originalImageUrlRef.current) {
        URL.revokeObjectURL(originalImageUrlRef.current);
        originalImageUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageItem?.id, taskItem?.id]);

  useEffect(() => {
    if (detectionResults.length > 0 && originalImgRef.current) {
      drawPreviewCanvas();
    }

    if (viewerOpen && viewerType === 'detection') {
      drawViewerCanvas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionResults, viewerOpen, viewerType, scoreThreshold]);

  const handleImageLoad = () => {
    setTimeout(() => {
      drawPreviewCanvas();

      if (viewerOpen && viewerType === 'detection') {
        drawViewerCanvas();
      }
    }, 100);
  };

  const openOriginalViewer = () => {
    if (!originalImageUrl) return;

    setViewerType('original');
    setViewerTitle('原图');
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerDragging(false);
    setViewerOpen(true);
  };

  const openDetectionViewer = () => {
    if (!originalImageUrl || detectionResults.length === 0) return;

    setViewerType('detection');
    setViewerTitle('推理图像');
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerDragging(false);
    setViewerOpen(true);

    setTimeout(drawViewerCanvas, 100);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerType('original');
    setViewerTitle('');
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerDragging(false);
  };

  const zoomInViewer = () => {
    setViewerScale((prev) => Math.min(5, Number((prev + 0.25).toFixed(2))));
  };

  const zoomOutViewer = () => {
    setViewerScale((prev) => Math.max(0.25, Number((prev - 0.25).toFixed(2))));
  };

  const resetViewerZoom = () => {
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerDragging(false);
  };

  const handleViewerWheel = (e) => {
    e.preventDefault();

    if (e.deltaY < 0) {
      zoomInViewer();
    } else {
      zoomOutViewer();
    }
  };

  const handleViewerPanStart = (e) => {
    if (viewerScale <= 1) return;

    setViewerDragging(true);
    setViewerDragStart({
      x: e.clientX - viewerOffset.x,
      y: e.clientY - viewerOffset.y
    });
  };

  const handleViewerPanMove = (e) => {
    if (!viewerDragging) return;

    setViewerOffset({
      x: e.clientX - viewerDragStart.x,
      y: e.clientY - viewerDragStart.y
    });
  };

  const handleViewerPanEnd = () => {
    setViewerDragging(false);
  };

  const handleExportJSON = async () => {
    if (!taskItem?.id) {
      showNotice('当前图片暂无检测任务', 'error');
      return;
    }

    setExporting(true);

    try {
      const response = await fetch(`/api/inference/tasks/${taskItem.id}/export`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();

      if (isApiSuccess(result) && result.data) {
        const dataStr = JSON.stringify(result.data, null, 2);
        const blob = new Blob([dataStr], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `task_${taskItem.id}_result.json`;
        a.click();

        URL.revokeObjectURL(url);
        showNotice('导出JSON成功', 'success');
      } else {
        showNotice('导出JSON失败：' + (result.message || '未知错误'), 'error');
      }
    } catch (err) {
      console.error('导出JSON失败:', err);
      showNotice('导出JSON失败：' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!taskItem?.id) {
      showNotice('当前图片暂无检测任务', 'error');
      return;
    }

    setExporting(true);

    try {
      const response = await fetch(`/api/inference/tasks/${taskItem.id}/export-pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        showNotice('导出PDF失败：HTTP ' + response.status, 'error');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `task_${taskItem.id}_report.pdf`;
      a.click();

      URL.revokeObjectURL(url);
      showNotice('导出PDF成功', 'success');
    } catch (err) {
      console.error('导出PDF失败:', err);
      showNotice('导出PDF失败：' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const resultLabel = taskItem?.historyResultLabel || summarizeResults(detectionResults);
  const resultClassLabel = getSummaryClassLabel(detectionResults);
  const evaluationStatus = normalizeEvaluationStatus(taskItem);
  const reviewComment = normalizeReviewComment(taskItem);
  const canExport = !!taskItem?.id && taskItem.status === 'SUCCESS';

  return (
    <>
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className={compact ? 'research-readonly-viewer compact' : 'research-readonly-viewer'}>
        {loading ? (
          <div className="research-loading-block">加载图像详情中...</div>
        ) : (
          <>
            <div className="research-preview-grid">
              <div className="research-preview-box">
                <div className="research-preview-title">原图</div>

                {originalImageUrl ? (
                  <img
                    ref={originalImgRef}
                    src={originalImageUrl}
                    alt="原图"
                    className="research-preview-image"
                    onLoad={handleImageLoad}
                    onClick={openOriginalViewer}
                  />
                ) : (
                  <div className="research-placeholder">暂无原图</div>
                )}
              </div>

              <div className="research-preview-box">
                <div className="research-preview-title">推理图像</div>

                {originalImageUrl && detectionResults.length > 0 ? (
                  <canvas
                    ref={previewCanvasRef}
                    className="research-preview-canvas"
                    onClick={openDetectionViewer}
                  />
                ) : (
                  <div className="research-placeholder">暂无检测结果</div>
                )}
              </div>
            </div>

            <div className="research-status-row">
              <span className="research-status-label">检测状态：</span>
              <span className={`status-badge ${getStatusClass(taskItem?.status)}`}>
                {getStatusText(taskItem?.status)}
              </span>

              <span className="research-status-label">检测结果：</span>
              <span className={`result-badge ${getResultClass(resultClassLabel)}`}>
                {resultLabel}
              </span>

              <span className="research-status-label">医生评价：</span>
              <span className={`evaluation-badge ${getDoctorEvaluationClass(evaluationStatus)}`}>
                {getDoctorEvaluationText(evaluationStatus)}
              </span>
            </div>

            <div className="research-export-row">
              <button
                type="button"
                className="research-export-btn research-export-json"
                onClick={handleExportJSON}
                disabled={exporting || !canExport}
              >
                {exporting ? '导出中...' : '导出JSON'}
              </button>

              <button
                type="button"
                className="research-export-btn research-export-pdf"
                onClick={handleExportPDF}
                disabled={exporting || !canExport}
              >
                {exporting ? '导出中...' : '导出PDF'}
              </button>
            </div>

            <div className="research-review-block">
              <div className="research-review-title">医生评价</div>
              <textarea
                className="research-review-textarea"
                value={reviewComment}
                readOnly
                placeholder="暂无医生评价说明"
              />
            </div>
          </>
        )}
      </div>

      {viewerOpen && (
        <div className="research-viewer-overlay">
          <div className="research-viewer-panel">
            <div className="research-viewer-header">
              <div>
                <div className="research-viewer-title">{viewerTitle}</div>
                <div className="research-viewer-tip">
                  鼠标滚轮缩放，放大后按住图片拖动查看，双击图片重置
                </div>
              </div>

              <div className="research-viewer-actions">
                {viewerType === 'detection' && (
                  <div className="research-viewer-threshold">
                    <span>阈值</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={scoreThreshold}
                      onChange={(e) => setScoreThreshold(Number(e.target.value))}
                    />
                    <strong>{Math.round(scoreThreshold * 100)}%</strong>
                  </div>
                )}

                <button type="button" onClick={zoomOutViewer}>
                  －
                </button>
                <span>{Math.round(viewerScale * 100)}%</span>
                <button type="button" onClick={zoomInViewer}>
                  ＋
                </button>
                <button type="button" onClick={resetViewerZoom}>
                  重置
                </button>
                <button type="button" className="research-viewer-close" onClick={closeViewer}>
                  ×
                </button>
              </div>
            </div>

            <div
              className="research-viewer-body"
              onWheel={handleViewerWheel}
              onMouseMove={handleViewerPanMove}
              onMouseUp={handleViewerPanEnd}
              onMouseLeave={handleViewerPanEnd}
            >
              {viewerType === 'original' ? (
                <img
                  src={originalImageUrl}
                  alt="原图"
                  className="research-viewer-image"
                  draggable={false}
                  onMouseDown={handleViewerPanStart}
                  onDoubleClick={resetViewerZoom}
                  style={{
                    transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerScale})`,
                    cursor: viewerScale > 1 ? (viewerDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                />
              ) : (
                <canvas
                  ref={viewerCanvasRef}
                  className="research-viewer-canvas"
                  onMouseDown={handleViewerPanStart}
                  onDoubleClick={resetViewerZoom}
                  style={{
                    transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerScale})`,
                    cursor: viewerScale > 1 ? (viewerDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ResearchImageTaskDetailPage = ({ imageItem, onBack }) => {
  const [historyTasks, setHistoryTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedHistoryTask, setSelectedHistoryTask] = useState(null);

  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyPageInput, setHistoryPageInput] = useState('1');
  const [historyPageSizeInput, setHistoryPageSizeInput] = useState('10');

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

  const loadTaskResults = async (taskId) => {
    if (!taskId) return [];

    try {
      const resultRes = await inferenceApi.listResults(taskId);

      if (isApiSuccess(resultRes) && resultRes.data) {
        return Array.isArray(resultRes.data) ? resultRes.data : [resultRes.data];
      }

      return [];
    } catch (err) {
      console.error(`加载任务 ${taskId} 检测结果失败:`, err);
      return [];
    }
  };

  const loadTaskHistory = async () => {
    if (!imageItem?.id) return;

    setLoading(true);

    try {
      const tasksRes = await inferenceApi.listTasks({
        imageId: imageItem.id
      });

      const taskList = normalizeTaskList(tasksRes);

      const rows = await Promise.all(
        taskList.map(async (task) => {
          const results = task.status === 'SUCCESS' && task.id ? await loadTaskResults(task.id) : [];

          return {
            ...task,
            historyResults: results,
            historyResultLabel: summarizeResults(results)
          };
        })
      );

      rows.sort((a, b) => {
        const timeA = new Date(getTaskDetectionTime(a) || 0).getTime();
        const timeB = new Date(getTaskDetectionTime(b) || 0).getTime();
        return timeB - timeA;
      });

      setHistoryTasks(rows);
      setHistoryCurrentPage(1);
    } catch (err) {
      console.error('加载图像详情失败:', err);
      setHistoryTasks([]);
      showNotice('加载图像详情失败：' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaskHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageItem?.id]);

  const historyTotalElements = historyTasks.length;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotalElements / historyPageSize));
  const historyPageTasks = historyTasks.slice(
    (historyCurrentPage - 1) * historyPageSize,
    historyCurrentPage * historyPageSize
  );

  const goToHistoryPage = (page) => {
    const safePage = Math.min(Math.max(1, page), historyTotalPages);
    setHistoryCurrentPage(safePage);
  };

  const commitHistoryPageInput = () => {
    if (historyPageInput.trim() === '') {
      setHistoryPageInput(String(historyCurrentPage));
      return;
    }

    const value = Number(historyPageInput);

    if (!Number.isInteger(value) || value < 1) {
      setHistoryPageInput(String(historyCurrentPage));
      return;
    }

    const safePage = Math.min(Math.max(1, value), historyTotalPages);
    setHistoryCurrentPage(safePage);
    setHistoryPageInput(String(safePage));
  };

  const commitHistoryPageSizeInput = () => {
    if (historyPageSizeInput.trim() === '') {
      setHistoryPageSizeInput(String(historyPageSize));
      return;
    }

    const value = Number(historyPageSizeInput);

    if (!Number.isInteger(value) || value < 1) {
      setHistoryPageSizeInput(String(historyPageSize));
      return;
    }

    setHistoryPageSize(value);
    setHistoryCurrentPage(1);
    setHistoryPageSizeInput(String(value));
  };

  useEffect(() => {
    setHistoryPageInput(String(historyCurrentPage));
  }, [historyCurrentPage]);

  useEffect(() => {
    setHistoryPageSizeInput(String(historyPageSize));
  }, [historyPageSize]);

  useEffect(() => {
    if (historyCurrentPage > historyTotalPages) {
      setHistoryCurrentPage(historyTotalPages);
    }
  }, [historyCurrentPage, historyTotalPages]);

  const currentTask = historyTasks[0] || null;

  return (
    <div className="research-image-task-page">
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="research-image-task-header-row">
        <button type="button" className="research-back-btn" onClick={onBack}>
          ← 返回图像列表
        </button>

        <div className="research-page-title-block">
          <h2>图像详情</h2>
          <p>图片ID：{imageItem?.id || '-'}</p>
        </div>
      </div>

      {loading ? (
        <div className="research-loading-block">加载图像详情中...</div>
      ) : (
        <>
          <ReadOnlyTaskViewer imageItem={imageItem} taskItem={currentTask} />

          <div className="research-history-block">
            <div className="research-history-header">
              <div>
                <h3>历史检测</h3>
              </div>
            </div>

            <div className="research-history-table-wrapper">
              <table className="research-history-table">
                <thead>
                  <tr>
                    <th>检测时间</th>
                    <th>检测状态</th>
                    <th>检测结果</th>
                    <th>医生评价</th>
                    <th>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {historyTasks.length > 0 ? (
                    historyPageTasks.map((task) => {
                      const evaluationStatus = normalizeEvaluationStatus(task);
                      const classLabel = getSummaryClassLabel(task.historyResults);

                      return (
                        <tr
                          key={task.id}
                          className={currentTask?.id === task.id ? 'is-current-task' : ''}
                        >
                          <td>{formatDateTime(getTaskDetectionTime(task))}</td>

                          <td>
                            <span className={`status-badge ${getStatusClass(task.status)}`}>
                              {getStatusText(task.status)}
                            </span>
                          </td>

                          <td>
                            <span className={`result-badge ${getResultClass(classLabel)}`}>
                              {task.historyResultLabel || summarizeResults(task.historyResults)}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`evaluation-badge ${getDoctorEvaluationClass(
                                evaluationStatus
                              )}`}
                            >
                              {getDoctorEvaluationText(evaluationStatus)}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="research-history-detail-btn"
                              onClick={() => setSelectedHistoryTask(task)}
                            >
                              查看详情
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="research-history-empty">
                        暂无检测记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {historyTasks.length > 0 && (
              <div className="research-history-pagination">
                <div className="research-history-pagination-left">
                  <div className="research-history-page-size-selector">
                    <span>每页显示</span>
                    <input
                      className="research-history-page-size-input"
                      type="text"
                      inputMode="numeric"
                      value={historyPageSizeInput}
                      onChange={(e) => setHistoryPageSizeInput(e.target.value)}
                      onBlur={commitHistoryPageSizeInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitHistoryPageSizeInput();
                        }
                      }}
                    />
                    <span>条，共</span>
                    <strong>{historyTotalElements}</strong>
                    <span>条记录</span>
                  </div>
                </div>

                <div className="research-history-pagination-actions">
                  <button
                    type="button"
                    className="research-history-pagination-btn"
                    onClick={() => goToHistoryPage(1)}
                    disabled={historyCurrentPage === 1}
                  >
                    首页
                  </button>

                  <button
                    type="button"
                    className="research-history-pagination-btn"
                    onClick={() => goToHistoryPage(historyCurrentPage - 1)}
                    disabled={historyCurrentPage === 1}
                  >
                    上一页
                  </button>

                  <input
                    className="research-history-page-jump-input"
                    type="text"
                    inputMode="numeric"
                    value={historyPageInput}
                    onChange={(e) => setHistoryPageInput(e.target.value)}
                    onBlur={commitHistoryPageInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitHistoryPageInput();
                      }
                    }}
                  />

                  <span className="research-history-page-jump-text">/ {historyTotalPages}</span>

                  <button
                    type="button"
                    className="research-history-pagination-btn"
                    onClick={() => goToHistoryPage(historyCurrentPage + 1)}
                    disabled={historyCurrentPage === historyTotalPages}
                  >
                    下一页
                  </button>

                  <button
                    type="button"
                    className="research-history-pagination-btn"
                    onClick={() => goToHistoryPage(historyTotalPages)}
                    disabled={historyCurrentPage === historyTotalPages}
                  >
                    末页
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {selectedHistoryTask && (
        <div className="research-history-modal-overlay">
          <div className="research-history-modal-container">
            <div className="research-history-modal-header">
              <div>
                <h3>历史检测详情</h3>
                <p>任务ID：{selectedHistoryTask.id}</p>
              </div>

              <button
                type="button"
                className="research-history-modal-close"
                onClick={() => setSelectedHistoryTask(null)}
              >
                ×
              </button>
            </div>

            <div className="research-history-modal-body">
              <ReadOnlyTaskViewer imageItem={imageItem} taskItem={selectedHistoryTask} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchImageTaskDetailPage;