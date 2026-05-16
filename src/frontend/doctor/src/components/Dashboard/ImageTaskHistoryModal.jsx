import React, { useEffect, useRef, useState } from 'react';
import { imageApi, inferenceApi } from '../../api';
import TopNotice from '../../components/common/TopNotice';
import './ImageTaskHistoryModal.css';

const ImageTaskHistoryModal = ({
  isOpen,
  imageItem,
  taskItem,
  onClose
}) => {
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [detectionResults, setDetectionResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState('original');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const [viewerDragStart, setViewerDragStart] = useState({ x: 0, y: 0 });
  const [scoreThreshold, setScoreThreshold] = useState(0);

  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const originalImgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const viewerCanvasRef = useRef(null);

  const isApiSuccess = (response) => {
    return response && (response.code === 0 || response.code === 200);
  };

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

  const hasBox = (box) => {
    return (
      box &&
      box.x != null &&
      box.y != null &&
      box.width != null &&
      box.height != null
    );
  };

  const shouldShowBoxByThreshold = (box) => {
    if (!hasBox(box)) return false;
    if (box.score == null) return true;
    return Number(box.score) >= scoreThreshold;
  };

  const normalizeEvaluationStatus = (taskData) => {
    if (!taskData) return '';
    if (taskData.doctorEvaluationStatus != null) return taskData.doctorEvaluationStatus;
    if (taskData.doctor_evaluation_status != null) return taskData.doctor_evaluation_status;
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
        return 'status-pending';
    }
  };

  const getResultText = (label) => {
    if (!label) return '未知';
    if (label === 'pneumonia') return '肺炎';
    if (label === 'normal') return '正常';
    return label;
  };

  const getResultClass = (label) => {
    return label === 'pneumonia' ? 'result-pneumonia' : 'result-normal';
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

  const summarizeResults = (results) => {
    if (!Array.isArray(results) || results.length === 0) return '无结果';

    const pneumoniaResult = results.find((item) => item?.label === 'pneumonia');
    if (pneumoniaResult) return '肺炎';

    const firstLabel = results.find((item) => item?.label)?.label;
    return getResultText(firstLabel);
  };

  const getSummaryLabel = () => {
    if (taskItem?.historyResultLabel) return taskItem.historyResultLabel;
    return summarizeResults(detectionResults);
  };

  const getSummaryClassLabel = () => {
    const pneumoniaResult = detectionResults.find((item) => item?.label === 'pneumonia');
    if (pneumoniaResult) return 'pneumonia';
    return detectionResults.find((item) => item?.label)?.label;
  };

  const getBoxLabelText = (box) => {
    const label = box.label === 'pneumonia' ? '肺炎' : box.label === 'normal' ? '正常' : (box.label || '肺炎');
    const confidence = box.score != null ? Math.round(box.score * 100) : null;
    return confidence != null ? `${label} ${confidence}%` : label;
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
    if (!imageItem || !taskItem) return;

    setLoading(true);

    try {
      const blob = await imageApi.getPreview(imageItem.id);
      const url = URL.createObjectURL(blob);

      setOriginalImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      if (Array.isArray(taskItem.historyResults)) {
        setDetectionResults(taskItem.historyResults);
      } else {
        const resultRes = await inferenceApi.listResults(taskItem.id);
        const list = isApiSuccess(resultRes) && resultRes.data
          ? Array.isArray(resultRes.data)
            ? resultRes.data
            : [resultRes.data]
          : [];

        setDetectionResults(list);
      }
    } catch (err) {
      console.error('加载历史检测详情失败:', err);
      setDetectionResults([]);
      showNotice('加载历史检测详情失败：' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && imageItem && taskItem) {
      loadData();
    }

    return () => {
      if (originalImageUrl) {
        URL.revokeObjectURL(originalImageUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, imageItem?.id, taskItem?.id]);

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

    setTimeout(() => {
      drawViewerCanvas();
    }, 100);
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
    setViewerScale((prev) => {
      const next = Math.max(0.5, Number((prev - 0.25).toFixed(2)));

      if (next <= 1) {
        setViewerOffset({ x: 0, y: 0 });
      }

      return next;
    });
  };

  const resetViewerZoom = () => {
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
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

    e.preventDefault();
    setViewerDragging(true);
    setViewerDragStart({
      x: e.clientX - viewerOffset.x,
      y: e.clientY - viewerOffset.y
    });
  };

  const handleViewerPanMove = (e) => {
    if (!viewerDragging) return;

    e.preventDefault();
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
      showNotice('当前历史任务不存在，无法导出', 'error');
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
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `task_${taskItem.id}_result.json`;
        a.click();

        URL.revokeObjectURL(url);
        showNotice('导出 JSON 成功', 'success');
      } else {
        showNotice('导出 JSON 失败：' + (result.message || '未知错误'), 'error');
      }
    } catch (err) {
      console.error('导出JSON失败:', err);
      showNotice('导出 JSON 失败：' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!taskItem?.id) {
      showNotice('当前历史任务不存在，无法导出', 'error');
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
        showNotice('导出 PDF 失败：HTTP ' + response.status, 'error');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `task_${taskItem.id}_report.pdf`;
      a.click();

      URL.revokeObjectURL(url);
      showNotice('导出 PDF 成功', 'success');
    } catch (err) {
      console.error('导出PDF失败:', err);
      showNotice('导出 PDF 失败：' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const exportButtonBaseStyle = {
    height: '42px',
    border: 'none',
    borderRadius: '10px',
    padding: '0 18px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: exporting ? 'not-allowed' : 'pointer'
  };

  const exportJsonButtonStyle = {
    ...exportButtonBaseStyle,
    background: exporting ? '#e2e8f0' : '#eef4ff',
    color: exporting ? '#94a3b8' : '#2563eb'
  };

  const exportPdfButtonStyle = {
    ...exportButtonBaseStyle,
    background: exporting ? '#e2e8f0' : '#2563eb',
    color: exporting ? '#94a3b8' : '#ffffff'
  };

  if (!isOpen || !imageItem || !taskItem) return null;

  return (
    <>
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="history-modal-overlay">
        <div className="history-modal-container">
          <div className="history-modal-header">
            <div>
              <h3>历史检测详情</h3>
              <p>任务ID：{taskItem.id}</p>
            </div>

            <button type="button" className="history-modal-close" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="history-modal-body">
            <div className="history-preview-grid">
              <div className="history-preview-box">
                <div className="history-preview-title">原图</div>

                {loading ? (
                  <div className="history-placeholder">加载中...</div>
                ) : originalImageUrl ? (
                  <img
                    ref={originalImgRef}
                    src={originalImageUrl}
                    alt="原图"
                    className="history-preview-image"
                    onLoad={handleImageLoad}
                    onClick={openOriginalViewer}
                    title="点击查看大图"
                  />
                ) : (
                  <div className="history-placeholder">暂无影像</div>
                )}
              </div>

              <div className="history-preview-box">
                <div className="history-preview-title">推理图像（带检测框）</div>

                {loading ? (
                  <div className="history-placeholder">加载中...</div>
                ) : detectionResults.length > 0 ? (
                  <canvas
                    ref={previewCanvasRef}
                    className="history-preview-canvas"
                    onClick={openDetectionViewer}
                    title="点击查看大图"
                  />
                ) : (
                  <div className="history-placeholder">暂无检测结果</div>
                )}
              </div>
            </div>

            <div className="history-status-row">
              <span className="history-status-label">检测状态：</span>
              <span className={`status-badge ${getStatusClass(taskItem.status)}`}>
                {getStatusText(taskItem.status)}
              </span>

              <span className="history-status-label">结果：</span>
              <span className={`result-badge ${getResultClass(getSummaryClassLabel())}`}>
                {getSummaryLabel()}
              </span>

              <span className="history-status-label">医生评价：</span>
              <span className={`result-badge ${getDoctorEvaluationClass(normalizeEvaluationStatus(taskItem))}`}>
                {getDoctorEvaluationText(normalizeEvaluationStatus(taskItem))}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '16px',
                margin: '18px 0 8px'
              }}
            >
              <button
                type="button"
                style={exportJsonButtonStyle}
                onClick={handleExportJSON}
                disabled={exporting || !taskItem?.id || taskItem.status !== 'SUCCESS'}
              >
                {exporting ? '导出中...' : '导出JSON'}
              </button>

              <button
                type="button"
                style={exportPdfButtonStyle}
                onClick={handleExportPDF}
                disabled={exporting || !taskItem?.id || taskItem.status !== 'SUCCESS'}
              >
                {exporting ? '导出中...' : '导出PDF'}
              </button>
            </div>

            <div className="history-review-block">
              <div className="history-review-title">医生评价说明</div>
              <textarea
                className="history-review-textarea"
                value={normalizeReviewComment(taskItem)}
                readOnly
                placeholder="暂无医生评价说明"
              />
            </div>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <div className="history-viewer-overlay">
          <div className="history-viewer-panel">
            <div className="history-viewer-header">
              <div>
                <div className="history-viewer-title">{viewerTitle}</div>
                <div className="history-viewer-tip">
                  鼠标滚轮缩放，放大后按住图片拖动查看，双击图片重置
                </div>
              </div>

              <div className="history-viewer-actions">
                {viewerType === 'detection' && (
                  <div className="history-viewer-threshold">
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

                <button type="button" onClick={zoomOutViewer}>－</button>
                <span>{Math.round(viewerScale * 100)}%</span>
                <button type="button" onClick={zoomInViewer}>＋</button>
                <button type="button" onClick={resetViewerZoom}>重置</button>
                <button type="button" className="history-viewer-close" onClick={closeViewer}>
                  ×
                </button>
              </div>
            </div>

            <div
              className="history-viewer-body"
              onWheel={handleViewerWheel}
              onMouseMove={handleViewerPanMove}
              onMouseUp={handleViewerPanEnd}
              onMouseLeave={handleViewerPanEnd}
            >
              {viewerType === 'original' ? (
                <img
                  src={originalImageUrl}
                  alt="原图"
                  className="history-viewer-image"
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
                  className="history-viewer-canvas"
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

export default ImageTaskHistoryModal;