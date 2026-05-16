import React, { useState, useEffect, useRef } from 'react';
import { imageApi, inferenceApi } from "../../api";
import TopNotice from '../common/TopNotice';
import './StudyDetail.css';

const StudyDetail = ({ isOpen, study, caseId, onClose, onRefresh }) => {
  const [originalImage, setOriginalImage] = useState(null);
  const [detectedImage, setDetectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [doctorReview, setDoctorReview] = useState('');
  const [detectionResults, setDetectionResults] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [selectedModel, setSelectedModel] = useState('pneumo_v1');
  const [imageId, setImageId] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const fileInputRef = useRef(null);
  const originalImgRef = useRef(null);
  const canvasRef = useRef(null);

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

  useEffect(() => {
    if (isOpen && study && caseId) {
      loadData();
    }
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [isOpen, study, caseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const imagesRes = await fetch(`/api/images/study/${study.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const imagesData = await imagesRes.json();

      if (imagesData.code === 0 && imagesData.data?.items?.length > 0) {
        const imgId = imagesData.data.items[0].id;
        setImageId(imgId);

        try {
          const blob = await imageApi.getPreview(imgId);
          setOriginalImage(URL.createObjectURL(blob));
        } catch (err) {
          console.error('加载原图失败:', err);
        }

        const tasksRes = await inferenceApi.listTasks({ imageId: imgId });
        if (tasksRes.code === 0 && tasksRes.data?.length > 0) {
          const task = tasksRes.data[0];
          setTaskId(task.id);
          setTaskStatus(task.status);

          const resultsRes = await inferenceApi.listResults(task.id);
          if (resultsRes.code === 0 && resultsRes.data) {
            const data = Array.isArray(resultsRes.data) ? resultsRes.data : [resultsRes.data];
            setDetectionResults(data);
          }

          const taskDetail = await inferenceApi.getTask(task.id);
          if (taskDetail.code === 0 && taskDetail.data) {
            const review = taskDetail.data.review_comment || taskDetail.data.reviewComment || '';
            setDoctorReview(review || '暂无评价');
          }

          try {
            const resultImageRes = await fetch(`/api/inference/tasks/${task.id}/result-image`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (resultImageRes.ok) {
              const resultBlob = await resultImageRes.blob();
              setDetectedImage(URL.createObjectURL(resultBlob));
            }
          } catch (err) {
            console.error('加载检测图片失败:', err);
          }
        }
      }
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['.png', '.jpg', '.jpeg', '.dcm'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(fileExt)) {
      showNotice('请选择 PNG、JPG 或 DICOM 格式的图片', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(`/api/images/upload?studyId=${study.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        if (uploadResult.code === 0) {
          const newImageId = uploadResult.data?.id;
          setImageId(newImageId);
          const blob = await imageApi.getPreview(newImageId);
          setOriginalImage(URL.createObjectURL(blob));
          setTaskId(null);
          setTaskStatus(null);
          setDetectedImage(null);
          setDetectionResults([]);
          setDoctorReview('');
          showNotice('图片上传成功！', 'success');
          if (onRefresh) onRefresh();
        } else {
          showNotice('上传失败：' + uploadResult.message, 'error');
        }
      } else {
        showNotice('上传失败', 'error');
      }
    } catch (error) {
      console.error('上传失败:', error);
      showNotice('上传失败：' + error.message, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'QUEUED': return '排队中';
      case 'PENDING': return '排队中';
      case 'RUNNING': return '检测中';
      case 'SUCCESS': return '已完成';
      case 'FAILED': return '失败';
      default: return '未检测';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'SUCCESS': return 'status-success';
      case 'FAILED': return 'status-failed';
      case 'RUNNING': return 'status-running';
      case 'QUEUED': return 'status-pending';
      case 'PENDING': return 'status-pending';
      default: return 'status-pending';
    }
  };

  const startPolling = (taskId) => {
    if (pollingInterval) clearInterval(pollingInterval);

    const interval = setInterval(async () => {
      try {
        const response = await inferenceApi.getTask(taskId);
        if (response.code === 0 && response.data) {
          setTaskStatus(response.data.status);

          if (response.data.status === 'SUCCESS') {
            clearInterval(interval);
            setPollingInterval(null);

            const resultsRes = await inferenceApi.listResults(taskId);
            if (resultsRes.code === 0 && resultsRes.data) {
              const data = Array.isArray(resultsRes.data) ? resultsRes.data : [resultsRes.data];
              setDetectionResults(data);
            }

            const taskDetail = await inferenceApi.getTask(taskId);
            if (taskDetail.code === 0 && taskDetail.data) {
              const review = taskDetail.data.review_comment || taskDetail.data.reviewComment || '';
              setDoctorReview(review || '暂无评价');
            }

            try {
              const resultImageRes = await fetch(`/api/inference/tasks/${taskId}/result-image`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              });
              if (resultImageRes.ok) {
                const resultBlob = await resultImageRes.blob();
                setDetectedImage(URL.createObjectURL(resultBlob));
              }
            } catch (err) {
              console.error('加载检测图片失败:', err);
            }

            showNotice('检测完成！', 'success');
            if (onRefresh) onRefresh();
          } else if (response.data.status === 'FAILED') {
            clearInterval(interval);
            setPollingInterval(null);
            showNotice('检测失败：' + (response.data.errorMessage || '未知错误'), 'error');
          }
        }
      } catch (err) {
        console.error('轮询失败:', err);
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const handleRunDetection = async () => {
    if (!imageId) {
      showNotice('请先上传图片', 'error');
      return;
    }

    setDetecting(true);
    try {
      const response = await inferenceApi.createTask({
        imageId: imageId,
        modelId: selectedModel
      });

      if (response.code === 0) {
        const newTaskId = response.data?.id;
        setTaskId(newTaskId);
        setTaskStatus('QUEUED');
        showNotice(`检测任务已创建，任务ID: ${newTaskId}`, 'success');
        startPolling(newTaskId);
      } else {
        showNotice('创建检测任务失败：' + response.message, 'error');
      }
    } catch (error) {
      showNotice('检测失败：' + error.message, 'error');
    } finally {
      setDetecting(false);
    }
  };

  const drawDetectionBoxes = () => {
    if (!canvasRef.current || !originalImgRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = originalImgRef.current;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    detectionResults.forEach(det => {
      if (det.x !== undefined && det.y !== undefined && det.width !== undefined && det.height !== undefined) {
        ctx.strokeStyle = '#E53E3E';
        ctx.lineWidth = 3;
        ctx.strokeRect(det.x, det.y, det.width, det.height);

        ctx.fillStyle = '#E53E3E';
        ctx.font = 'bold 14px sans-serif';
        const label = det.label === 'pneumonia' ? '肺炎' : '正常';
        const confidence = Math.round((det.score || 0) * 100);
        const text = `${label} ${confidence}%`;
        const textWidth = ctx.measureText(text).width;

        ctx.fillRect(det.x, det.y - 22, textWidth + 8, 22);
        ctx.fillStyle = 'white';
        ctx.fillText(text, det.x + 4, det.y - 8);
      }
    });
  };

  const handleImageLoad = () => {
    setTimeout(() => {
      if (detectionResults.length > 0) {
        drawDetectionBoxes();
      }
    }, 100);
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

  if (!isOpen) return null;

  return (
    <div className="study-detail-overlay" onClick={onClose}>
      <div className="study-detail-container" onClick={(e) => e.stopPropagation()}>
        <TopNotice
          visible={notice.visible}
          message={notice.message}
          type={notice.type}
          onClose={closeNotice}
        />

        <div className="study-detail-header">
          <h3>检查详情 - {formatDateTime(study?.studyTime)}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="study-detail-body">
          <div className="info-section">
            <h4>基本信息</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">检查时间：</span>
                <span className="value">{formatDateTime(study?.studyTime)}</span>
              </div>
              <div className="info-item">
                <span className="label">模态：</span>
                <span className="value">{study?.modality || 'DX'}</span>
              </div>
              <div className="info-item full-width">
                <span className="label">描述：</span>
                <span className="value">{study?.description || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">检测状态：</span>
                <span className={`status-badge ${getStatusClass(taskStatus)}`}>
                  {getStatusText(taskStatus)}
                </span>
              </div>
            </div>
          </div>

          <div className="upload-section">
            <h4>上传图片</h4>
            <input
              type="file"
              ref={fileInputRef}
              accept=".png,.jpg,.jpeg,.dcm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button className="upload-btn" onClick={handleFileSelect} disabled={uploading}>
              {uploading ? '上传中...' : '选择图片'}
            </button>
          </div>

          {imageId && !taskId && (
            <div className="detection-section">
              <h4>模型选择</h4>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="model-select"
              >
                <option value="pneumo_v1">YOLOv11</option>
                <option value="pneumo_v2">RT-DETR</option>
              </select>
              <button className="detect-btn" onClick={handleRunDetection} disabled={detecting}>
                {detecting ? '检测中...' : '运行检测'}
              </button>
            </div>
          )}

          {originalImage && (
            <div className="images-section">
              <h4>影像对比</h4>
              <div className="images-compare">
                <div className="image-box">
                  <div className="image-label">原图</div>
                  <img
                    ref={originalImgRef}
                    src={originalImage}
                    alt="原图"
                    className="study-image"
                    onLoad={handleImageLoad}
                  />
                </div>
                <div className="image-box">
                  <div className="image-label">推理图像</div>
                  {detectedImage ? (
                    <img src={detectedImage} alt="检测结果" className="study-image" />
                  ) : detectionResults.length > 0 ? (
                    <canvas ref={canvasRef} className="study-image-canvas" />
                  ) : (
                    <div className="image-placeholder">暂无检测结果</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {detectionResults.length > 0 && (
            <div className="results-section">
              <h4>检测结果</h4>
              <table className="results-table">
                <thead>
                  <tr>
                    <th>标签</th>
                    <th>置信度</th>
                    <th>位置 (x, y, w, h)</th>
                  </tr>
                </thead>
                <tbody>
                  {detectionResults.map((result, idx) => (
                    <tr key={idx}>
                      <td>{result.label === 'pneumonia' ? '肺炎' : (result.label || '正常')}</td>
                      <td>{result.score ? `${(result.score * 100).toFixed(1)}%` : '-'}</td>
                      <td>
                        {result.x !== undefined
                          ? `${result.x}, ${result.y}, ${result.width}, ${result.height}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="review-section">
            <h4>医生评价</h4>
            <div className="review-display">{doctorReview}</div>
          </div>
        </div>

        <div className="study-detail-footer">
          <button className="close-bottom-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default StudyDetail;