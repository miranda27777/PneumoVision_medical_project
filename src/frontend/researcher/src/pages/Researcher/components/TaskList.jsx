import React, { useEffect, useRef, useState } from 'react';
import { imageApi, inferenceApi } from '../../../api';
import ResearchImageTaskDetailPage from './ResearchImageTaskDetailPage';
import './TaskList.css';

const TaskList = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImages, setPreviewImages] = useState({});
  const [taskInfoMap, setTaskInfoMap] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const [pageInput, setPageInput] = useState('1');
  const [pageSizeInput, setPageSizeInput] = useState('10');

  const [filters, setFilters] = useState({
    imageId: '',
    startDate: '',
    endDate: '',
    detectionResult: '',
    evaluationStatus: ''
  });

  const [selectedDetailImage, setSelectedDetailImage] = useState(null);

  const abortControllerRef = useRef(null);
  const previewUrlMapRef = useRef({});

  const getStatusText = (status) => {
    switch (status) {
      case 'SUCCESS':
        return '✅ 成功';
      case 'FAILED':
        return '❌ 失败';
      case 'RUNNING':
        return '⏳ 检测中';
      case 'QUEUED':
      case 'PENDING':
        return '⏰ 排队中';
      default:
        return '⚪ 未检测';
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

  const normalizeEvaluationStatus = (task) => {
    if (!task) return '';

    if (task.doctorEvaluationStatus != null) return task.doctorEvaluationStatus;
    if (task.doctor_evaluation_status != null) return task.doctor_evaluation_status;

    if (typeof task.reviewedCorrect === 'boolean') {
      return task.reviewedCorrect ? 'CORRECT' : 'ERROR';
    }

    if (typeof task.reviewed_correct === 'boolean') {
      return task.reviewed_correct ? 'CORRECT' : 'ERROR';
    }

    return '';
  };

  const cleanupPreviewUrls = () => {
    Object.values(previewUrlMapRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    previewUrlMapRef.current = {};
  };

  const cancelPendingRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const loadPreview = async (imageId) => {
    try {
      const blob = await imageApi.getPreview(imageId);
      const url = URL.createObjectURL(blob);
      return { imageId, url };
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(`加载图片 ${imageId} 预览失败:`, err);
      }
      return { imageId, url: null };
    }
  };

  const loadTaskInfo = async (imageId) => {
    try {
      const tasksRes = await inferenceApi.listTasks({ imageId });
      let task = null;

      if (tasksRes.code === 0 || tasksRes.code === 200) {
        if (Array.isArray(tasksRes.data) && tasksRes.data.length > 0) {
          task = tasksRes.data[0];
        } else if (tasksRes.data?.items && tasksRes.data.items.length > 0) {
          task = tasksRes.data.items[0];
        }
      }

      if (!task) {
        return { imageId, taskInfo: null };
      }

      let detectionResult = null;

      if (task.status === 'SUCCESS' && task.id) {
        const resultRes = await inferenceApi.listResults(task.id);
        if ((resultRes.code === 0 || resultRes.code === 200) && resultRes.data) {
          const list = Array.isArray(resultRes.data) ? resultRes.data : [resultRes.data];
          detectionResult = list.find((item) => item?.label === 'pneumonia') || list[0];
        }
      }

      return {
        imageId,
        taskInfo: {
          status: task.status,
          detectionLabel: detectionResult?.label || '',
          doctorEvaluationStatus: normalizeEvaluationStatus(task)
        }
      };
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(`加载图片 ${imageId} 任务信息失败:`, err);
      }
      return { imageId, taskInfo: null };
    }
  };

  const loadImages = async () => {
    cancelPendingRequest();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setImages([]);
    setPreviewImages({});
    setTaskInfoMap({});
    cleanupPreviewUrls();

    try {
      const params = new URLSearchParams();
      params.append('page', currentPage - 1);
      params.append('size', pageSize);

      if (filters.imageId) params.append('imageId', filters.imageId);
      if (filters.startDate) params.append('fromTime', filters.startDate);
      if (filters.endDate) params.append('toTime', filters.endDate);
      if (filters.detectionResult) params.append('resultLabel', filters.detectionResult);
      if (filters.evaluationStatus) params.append('doctorEvaluationStatus', filters.evaluationStatus);

      const response = await fetch(`/api/images?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        signal: abortController.signal
      });

      const imagesResponse = await response.json();

      if (abortController.signal.aborted) return;

      const imageList = Array.isArray(imagesResponse?.data?.items)
        ? imagesResponse.data.items
        : Array.isArray(imagesResponse?.data)
          ? imagesResponse.data
          : [];

      const totalPagesValue = Math.max(1, imagesResponse?.data?.totalPages || 1);
      const totalElementsValue =
        imagesResponse?.data?.total ||
        imagesResponse?.data?.totalElements ||
        imageList.length;

      setImages(imageList);
      setTotalPages(totalPagesValue);
      setTotalElements(totalElementsValue);

      const [previewResults, taskResults] = await Promise.all([
        Promise.all(imageList.map((img) => loadPreview(img.id))),
        Promise.all(imageList.map((img) => loadTaskInfo(img.id)))
      ]);

      if (abortController.signal.aborted) return;

      const nextPreviewMap = {};
      previewResults.forEach(({ imageId, url }) => {
        if (url) nextPreviewMap[imageId] = url;
      });

      previewUrlMapRef.current = nextPreviewMap;
      setPreviewImages(nextPreviewMap);

      const nextTaskInfoMap = {};
      taskResults.forEach(({ imageId, taskInfo }) => {
        nextTaskInfoMap[imageId] = taskInfo;
      });

      setTaskInfoMap(nextTaskInfoMap);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('加载图片失败:', error);
        setImages([]);
        setTotalPages(1);
        setTotalElements(0);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }

      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadImages, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    pageSize,
    filters.imageId,
    filters.startDate,
    filters.endDate,
    filters.detectionResult,
    filters.evaluationStatus
  ]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    return () => {
      cancelPendingRequest();
      cleanupPreviewUrls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setSelectedDetailImage(null);
    setCurrentPage(1);
    setFilters({
      imageId: '',
      startDate: '',
      endDate: '',
      detectionResult: '',
      evaluationStatus: ''
    });
  };

  const resetFilters = () => {
    setCurrentPage(1);
    setFilters({
      imageId: '',
      startDate: '',
      endDate: '',
      detectionResult: '',
      evaluationStatus: ''
    });
  };

  const handleFilterChange = (key, value) => {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  };

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
    setPageInput(String(Math.min(Math.max(1, value), totalPages)));
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
    setPageSizeInput(String(value));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return String(dateStr).replace('T', ' ').slice(0, 16);
    }

    const pad = (num) => String(num).padStart(2, '0');

    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getImageTime = (img) => {
    return (
      img.createdAt ||
      img.created_at ||
      img.uploadTime ||
      img.upload_time ||
      img.updatedAt ||
      img.updated_at
    );
  };

  const openImageDetail = (img) => {
    setSelectedDetailImage(img);
  };

  if (selectedDetailImage) {
    return (
      <ResearchImageTaskDetailPage
        imageItem={selectedDetailImage}
        onBack={() => setSelectedDetailImage(null)}
      />
    );
  }

  return (
    <div className="task-list-page">
      <div className="task-list-header">
        <div>
          <h3>图像列表</h3>
          <p>查看全部图像、检测状态、检测结果和医生评价</p>
        </div>

        <button type="button" className="refresh-btn" onClick={handleRefresh}>
          刷新
        </button>
      </div>

      <div className="filter-panel">
        <div className="filter-row">
          <div className="filter-group">
            <label>图片ID</label>
            <input
              type="text"
              placeholder="请输入图片ID"
              value={filters.imageId}
              onChange={(e) => handleFilterChange('imageId', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>开始时间</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>结束时间</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label>检测结果</label>
            <select
              value={filters.detectionResult}
              onChange={(e) => handleFilterChange('detectionResult', e.target.value)}
            >
              <option value="">全部</option>
              <option value="pneumonia">肺炎</option>
              <option value="normal">正常</option>
            </select>
          </div>

          <div className="filter-group">
            <label>医生评价</label>
            <select
              value={filters.evaluationStatus}
              onChange={(e) => handleFilterChange('evaluationStatus', e.target.value)}
            >
              <option value="">全部</option>
              <option value="CORRECT">正确</option>
              <option value="ERROR">错误</option>
              <option value="MISSED">漏检</option>
              <option value="FALSE_POSITIVE">误检</option>
            </select>
          </div>

          <div className="filter-group filter-actions">
            <button type="button" className="reset-filter-btn" onClick={resetFilters}>
              重置筛选
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="task-list-loading">加载中...</div>
      ) : images.length === 0 ? (
        <div className="task-list-empty">暂无图片</div>
      ) : (
        <>
          <div className="task-list-grid">
            {images.map((img) => {
              const taskInfo = taskInfoMap[img.id];

              return (
                <div
                  key={img.id}
                  className="task-image-card"
                  onClick={() => openImageDetail(img)}
                >
                  <div className="task-image-thumb">
                    {previewImages[img.id] ? (
                      <img
                        src={previewImages[img.id]}
                        alt={`图片 ${img.id}`}
                        className="task-image-thumb-img"
                      />
                    ) : (
                      <div className="task-image-placeholder">加载中...</div>
                    )}
                  </div>

                  <div className="task-image-info">
                    <div className="task-image-title">图片ID：{img.id}</div>
                    <div className="task-image-date">上传时间：{formatDate(getImageTime(img))}</div>

                    <div className="task-image-badges">
                      <span className={`status-badge ${getStatusClass(taskInfo?.status)}`}>
                        {getStatusText(taskInfo?.status)}
                      </span>

                      {taskInfo?.status === 'SUCCESS' && taskInfo?.detectionLabel && (
                        <span className={`result-badge ${getResultClass(taskInfo.detectionLabel)}`}>
                          {getResultText(taskInfo.detectionLabel)}
                        </span>
                      )}

                      <span
                        className={`evaluation-badge ${getDoctorEvaluationClass(
                          taskInfo?.doctorEvaluationStatus
                        )}`}
                      >
                        {getDoctorEvaluationText(taskInfo?.doctorEvaluationStatus)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="task-list-pagination">
            <div className="pagination-info">
              <span>每页</span>
              <input
                type="text"
                value={pageSizeInput}
                onChange={(e) => setPageSizeInput(e.target.value)}
                onBlur={commitPageSizeInput}
                onKeyDown={(e) => e.key === 'Enter' && commitPageSizeInput()}
              />
              <span>条，共 {totalElements} 条</span>
            </div>

            <div className="pagination-controls">
              <button type="button" onClick={() => goToPage(1)} disabled={currentPage === 1}>
                首页
              </button>
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                上一页
              </button>
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => e.key === 'Enter' && commitPageInput()}
              />
              <span>/ {totalPages}</span>
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                下一页
              </button>
              <button
                type="button"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                末页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskList;