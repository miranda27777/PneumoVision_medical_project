import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { imageApi, inferenceApi } from '../../api';
import Header from '../../components/common/Header';
import TopNotice from '../../components/common/TopNotice';
import ImageTaskHistoryModal from './ImageTaskHistoryModal';
import './DoctorDashboard.css';
import './ImageTaskDetailPage.css';
import { logoutToLogin } from '../../utils/auth';

const REVIEW_OPTIONS = [
  { value: '', label: '未评价' },
  { value: 'CORRECT', label: '正确' },
  { value: 'ERROR', label: '错误' },
  { value: 'MISSED', label: '漏检' },
  { value: 'FALSE_POSITIVE', label: '误检' }
];

const MIN_BOX_SIZE = 8;

const ImageTaskDetailPage = () => {
  const { caseId, studyId, imageId } = useParams();
  const navigate = useNavigate();

  const [selectedModel, setSelectedModel] = useState('pneumo_v1');
  const imageItem = imageId ? { id: imageId } : null;

  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [detectionResults, setDetectionResults] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);

  const [doctorEvaluationStatus, setDoctorEvaluationStatus] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [originalDoctorEvaluationStatus, setOriginalDoctorEvaluationStatus] = useState('');
  const [originalReviewComment, setOriginalReviewComment] = useState('');

  const [savingReview, setSavingReview] = useState(false);
  const [savingBoxes, setSavingBoxes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [historyTasks, setHistoryTasks] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryTask, setSelectedHistoryTask] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyPageInput, setHistoryPageInput] = useState('1');
  const [historyPageSizeInput, setHistoryPageSizeInput] = useState('10');

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState('original');
  const [viewerImageUrl, setViewerImageUrl] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const [viewerDragStart, setViewerDragStart] = useState({ x: 0, y: 0 });

  const [scoreThreshold, setScoreThreshold] = useState(0);

  const [boxEditMode, setBoxEditMode] = useState(false);
  const [addBoxMode, setAddBoxMode] = useState(false);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState(null);
  const [boxDrag, setBoxDrag] = useState(null);
  const [boxDirty, setBoxDirty] = useState(false);

  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const originalImgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const viewerCanvasRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const boxEditBackupRef = useRef([]);

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

  const isApiSuccess = (response) => {
    return response && (response.code === 0 || response.code === 200);
  };

  const deepCloneBoxes = (boxes) => {
    return JSON.parse(JSON.stringify(boxes || []));
  };

  const clearClientBoxFlags = (boxes) => {
    return (boxes || []).map((box) => {
      const { __new, __draft, ...rest } = box;
      return rest;
    });
  };

  const restoreBoxEditBackup = () => {
    setDetectionResults(deepCloneBoxes(boxEditBackupRef.current));
    setBoxDirty(false);
    setAddBoxMode(false);
    setSelectedBoxIndex(null);
    setBoxDrag(null);
  };

  const exitBoxEditMode = (shouldRestore = true) => {
    if (shouldRestore && (boxDirty || detectionResults.some((item) => item.__draft))) {
      restoreBoxEditBackup();
    }

    setBoxEditMode(false);
    setAddBoxMode(false);
    setSelectedBoxIndex(null);
    setBoxDrag(null);

    if (shouldRestore) {
      setBoxDirty(false);
    }
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

  const applyReviewStateFromTask = (taskData) => {
    const status = normalizeEvaluationStatus(taskData);
    const comment = normalizeReviewComment(taskData);

    setDoctorEvaluationStatus(status);
    setReviewComment(comment);
    setOriginalDoctorEvaluationStatus(status);
    setOriginalReviewComment(comment);
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

  const normalizeTaskList = (response) => {
    if (!isApiSuccess(response)) return [];

    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (response.data && Array.isArray(response.data.items)) {
      return response.data.items;
    }

    return [];
  };

  const formatDateTime = (value) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 19);

    const pad = (num) => String(num).padStart(2, '0');

    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getTaskDetectionTime = (task) => {
    return task?.finishedAt || task?.startedAt || task?.createdAt || task?.created_at || null;
  };

  const summarizeResults = (results) => {
    if (!Array.isArray(results) || results.length === 0) return '无结果';

    const pneumoniaResult = results.find((item) => item?.label === 'pneumonia');
    if (pneumoniaResult) return '肺炎';

    const firstLabel = results.find((item) => item?.label)?.label;
    return getResultText(firstLabel);
  };

  const loadHistoryTasks = async (tasks) => {
    setHistoryLoading(true);

    try {
      const rows = await Promise.all(
        (tasks || []).map(async (task) => {
          try {
            const resultRes = await inferenceApi.listResults(task.id);
            const results = isApiSuccess(resultRes) && resultRes.data
              ? Array.isArray(resultRes.data)
                ? resultRes.data
                : [resultRes.data]
              : [];

            return {
              ...task,
              historyResults: results,
              historyResultLabel: summarizeResults(results)
            };
          } catch (err) {
            console.error('加载历史检测结果失败:', err);
            return {
              ...task,
              historyResults: [],
              historyResultLabel: '加载失败'
            };
          }
        })
      );

      setHistoryTasks(rows);
      setHistoryCurrentPage(1);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryTaskDetail = (task) => {
    setSelectedHistoryTask(task);
    setHistoryModalOpen(true);
  };

  const closeHistoryTaskDetail = () => {
    setHistoryModalOpen(false);
    setSelectedHistoryTask(null);
  };

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
    const nextTotalPages = Math.max(1, Math.ceil(historyTasks.length / historyPageSize));

    if (historyCurrentPage > nextTotalPages) {
      setHistoryCurrentPage(nextTotalPages);
    }
  }, [historyTasks.length, historyPageSize, historyCurrentPage]);

  const canUseReview = taskStatus === 'SUCCESS' && detectionResults.length > 0 && !!taskId;
  const canEditBoxes = taskStatus === 'SUCCESS' && !!taskId && !!originalImageUrl;

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const getImageSize = () => {
    const img = originalImgRef.current;
    if (!img) {
      return { width: 0, height: 0 };
    }

    return {
      width: img.naturalWidth || 0,
      height: img.naturalHeight || 0
    };
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

    // 医生新增框 / 没有 score 的框，始终显示，不受阈值影响
    if (box.score == null) return true;

    return Number(box.score) >= scoreThreshold;
  };

  const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
  };

  const normalizeBox = (box) => {
    const { width: imageWidth, height: imageHeight } = getImageSize();

    let x = Number(box.x || 0);
    let y = Number(box.y || 0);
    let width = Number(box.width || 0);
    let height = Number(box.height || 0);

    if (width < 0) {
      x += width;
      width = Math.abs(width);
    }

    if (height < 0) {
      y += height;
      height = Math.abs(height);
    }

    width = Math.max(MIN_BOX_SIZE, width);
    height = Math.max(MIN_BOX_SIZE, height);

    x = clamp(x, 0, Math.max(0, imageWidth - width));
    y = clamp(y, 0, Math.max(0, imageHeight - height));

    if (x + width > imageWidth) {
      width = Math.max(MIN_BOX_SIZE, imageWidth - x);
    }

    if (y + height > imageHeight) {
      height = Math.max(MIN_BOX_SIZE, imageHeight - y);
    }

    return {
      ...box,
      x,
      y,
      width,
      height
    };
  };

  const getBoxLabelText = (box) => {
    const label = box.label === 'pneumonia' ? '肺炎' : box.label === 'normal' ? '正常' : (box.label || '肺炎');
    const confidence = box.score != null ? Math.round(box.score * 100) : null;
    return confidence != null ? `${label} ${confidence}%` : label;
  };

  const drawResizeHandles = (ctx, box) => {
    const handleSize = 10;
    const half = handleSize / 2;

    const points = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
      [box.x + box.width / 2, box.y],
      [box.x + box.width / 2, box.y + box.height],
      [box.x, box.y + box.height / 2],
      [box.x + box.width, box.y + box.height / 2]
    ];

    ctx.fillStyle = '#f97316';
    points.forEach(([x, y]) => {
      ctx.fillRect(x - half, y - half, handleSize, handleSize);
    });
  };

  const drawBoxesOnCanvas = (canvas, options = {}) => {
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

    detectionResults.forEach((box, index) => {
      if (!shouldShowBoxByThreshold(box)) return;

      const isSelected = options.showEdit && selectedBoxIndex === index;
      const isDraft = box.__draft;

      ctx.strokeStyle = isSelected ? '#f97316' : isDraft ? '#38bdf8' : '#ef4444';
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      const text = getBoxLabelText(box);
      ctx.font = 'bold 14px sans-serif';
      const textWidth = ctx.measureText(text).width;

      ctx.fillStyle = isSelected ? '#f97316' : isDraft ? '#38bdf8' : '#ef4444';
      ctx.fillRect(box.x, Math.max(0, box.y - 22), textWidth + 8, 22);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, box.x + 4, Math.max(14, box.y - 8));

      if (options.showEdit && isSelected) {
        drawResizeHandles(ctx, box);
      }
    });
  };

  const drawPreviewCanvas = () => {
    drawBoxesOnCanvas(previewCanvasRef.current, { showEdit: false });
  };

  const drawViewerCanvas = () => {
    drawBoxesOnCanvas(viewerCanvasRef.current, {
      showEdit: boxEditMode
    });
  };

  useEffect(() => {
    if (detectionResults.length > 0 && originalImgRef.current) {
      drawPreviewCanvas();
    }

    if (viewerOpen && viewerType === 'detection') {
      drawViewerCanvas();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    detectionResults,
    selectedBoxIndex,
    boxEditMode,
    viewerOpen,
    viewerType,
    scoreThreshold
  ]);

  const refreshTaskDetail = async (currentTaskId) => {
    const taskDetail = await inferenceApi.getTask(currentTaskId);
    if (isApiSuccess(taskDetail) && taskDetail.data) {
      setTaskStatus(taskDetail.data.status);
      applyReviewStateFromTask(taskDetail.data);
      return taskDetail.data;
    }
    return null;
  };

  const startPolling = (currentTaskId) => {
    stopPolling();

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await inferenceApi.getTask(currentTaskId);

        if (isApiSuccess(response) && response.data) {
          setTaskStatus(response.data.status);
          applyReviewStateFromTask(response.data);

          if (response.data.status === 'SUCCESS') {
            stopPolling();

            const resultsRes = await inferenceApi.listResults(currentTaskId);
            if (isApiSuccess(resultsRes) && resultsRes.data) {
              const list = Array.isArray(resultsRes.data) ? resultsRes.data : [resultsRes.data];
              setDetectionResults(list);
              boxEditBackupRef.current = deepCloneBoxes(list);
              setHistoryTasks((prev) => prev.map((item) => (
                item.id === currentTaskId
                  ? {
                      ...item,
                      ...response.data,
                      historyResults: list,
                      historyResultLabel: summarizeResults(list)
                    }
                  : item
              )));
            } else {
              setDetectionResults([]);
              boxEditBackupRef.current = [];
            }
          } else if (response.data.status === 'FAILED') {
            stopPolling();
            showNotice('检测失败：' + (response.data.errorMessage || '未知错误'), 'error');
          }
        }
      } catch (err) {
        console.error('轮询失败:', err);
      }
    }, 3000);
  };

  useEffect(() => {
    if (imageItem) {
      loadData();
    }

    return () => {
      stopPolling();
      if (originalImageUrl) {
        URL.revokeObjectURL(originalImageUrl);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  const resetReviewState = () => {
    setDoctorEvaluationStatus('');
    setReviewComment('');
    setOriginalDoctorEvaluationStatus('');
    setOriginalReviewComment('');
  };

  const resetBoxEditState = () => {
    setBoxEditMode(false);
    setAddBoxMode(false);
    setSelectedBoxIndex(null);
    setBoxDrag(null);
    setBoxDirty(false);
    boxEditBackupRef.current = [];
  };

  const loadData = async () => {
    if (!imageItem) return;

    setLoading(true);
    resetReviewState();
    resetBoxEditState();

    try {
      const blob = await imageApi.getPreview(imageItem.id);
      const url = URL.createObjectURL(blob);

      setOriginalImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      const tasksRes = await inferenceApi.listTasks({ imageId: imageItem.id });
      const tasks = normalizeTaskList(tasksRes);
      await loadHistoryTasks(tasks);

      const task = tasks.length > 0 ? tasks[0] : null;

      if (task) {
        setTaskId(task.id);
        setTaskStatus(task.status);
        applyReviewStateFromTask(task);

        if (task.status === 'QUEUED' || task.status === 'PENDING' || task.status === 'RUNNING') {
          startPolling(task.id);
        }

        const resultRes = await inferenceApi.listResults(task.id);

        if (isApiSuccess(resultRes) && resultRes.data) {
          const list = Array.isArray(resultRes.data) ? resultRes.data : [resultRes.data];
          setDetectionResults(list);
          boxEditBackupRef.current = deepCloneBoxes(list);
        } else {
          setDetectionResults([]);
          boxEditBackupRef.current = [];
        }

        await refreshTaskDetail(task.id);
      } else {
        setTaskId(null);
        setTaskStatus(null);
        setDetectionResults([]);
        boxEditBackupRef.current = [];
        setHistoryTasks([]);
        resetReviewState();
      }
    } catch (err) {
      console.error('加载图片详情失败:', err);
      setTaskId(null);
      setTaskStatus(null);
      setDetectionResults([]);
      boxEditBackupRef.current = [];
      setHistoryTasks([]);
      resetReviewState();
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    setTimeout(() => {
      if (detectionResults.length > 0) {
        drawPreviewCanvas();

        if (viewerOpen && viewerType === 'detection') {
          drawViewerCanvas();
        }
      }
    }, 100);
  };

  const openImageViewer = (url, title = '图片预览') => {
    if (!url) return;

    if (boxEditMode) {
      exitBoxEditMode(true);
    }

    setViewerType('original');
    setViewerImageUrl(url);
    setViewerTitle(title);
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerDragging(false);
    setViewerOpen(true);
  };

  const openCanvasViewer = () => {
    if (!originalImageUrl) {
      showNotice('暂无推理图像可预览', 'error');
      return;
    }

    if (detectionResults.length === 0) {
      showNotice('暂无检测结果可预览', 'error');
      return;
    }

    setViewerType('detection');
    setViewerTitle('推理图像');
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    setViewerDragging(false);
    setBoxEditMode(false);
    setAddBoxMode(false);
    setSelectedBoxIndex(null);
    setBoxDrag(null);
    setBoxDirty(false);
    setViewerOpen(true);

    setTimeout(() => {
      drawViewerCanvas();
    }, 100);
  };

  const closeImageViewer = () => {
    if (boxEditMode) {
      exitBoxEditMode(true);
    }

    setViewerOpen(false);
    setViewerType('original');
    setViewerImageUrl('');
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

  const getCanvasCoords = (e) => {
    const canvas = viewerCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    return { x, y };
  };

  const getPickTolerance = () => {
    const canvas = viewerCanvasRef.current;
    if (!canvas) return 10;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return 10;

    return Math.max(6, 12 * (canvas.width / rect.width));
  };

  const getBoxIndexAt = (x, y) => {
    for (let i = detectionResults.length - 1; i >= 0; i -= 1) {
      const box = detectionResults[i];

      if (!shouldShowBoxByThreshold(box)) continue;

      if (
        x >= box.x &&
        x <= box.x + box.width &&
        y >= box.y &&
        y <= box.y + box.height
      ) {
        return i;
      }
    }

    return -1;
  };

  const getResizeCorner = (box, x, y) => {
    const tolerance = getPickTolerance();

    const points = [
      { name: 'tl', x: box.x, y: box.y },
      { name: 'tr', x: box.x + box.width, y: box.y },
      { name: 'bl', x: box.x, y: box.y + box.height },
      { name: 'br', x: box.x + box.width, y: box.y + box.height },
      { name: 'top', x: box.x + box.width / 2, y: box.y },
      { name: 'bottom', x: box.x + box.width / 2, y: box.y + box.height },
      { name: 'left', x: box.x, y: box.y + box.height / 2 },
      { name: 'right', x: box.x + box.width, y: box.y + box.height / 2 }
    ];

    for (const point of points) {
      if (Math.abs(x - point.x) <= tolerance && Math.abs(y - point.y) <= tolerance) {
        return point.name;
      }
    }

    return null;
  };

  const createBoxFromPoints = (startX, startY, currentX, currentY) => {
    const { width: imageWidth, height: imageHeight } = getImageSize();

    const x1 = clamp(startX, 0, imageWidth);
    const y1 = clamp(startY, 0, imageHeight);
    const x2 = clamp(currentX, 0, imageWidth);
    const y2 = clamp(currentY, 0, imageHeight);

    return normalizeBox({
      id: null,
      label: 'pneumonia',
      score: null,
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      __new: true,
      __draft: true
    });
  };

  const resizeBox = (box, corner, dx, dy) => {
    let next = { ...box };

    switch (corner) {
      case 'tl':
        next.x = box.x + dx;
        next.y = box.y + dy;
        next.width = box.width - dx;
        next.height = box.height - dy;
        break;
      case 'tr':
        next.y = box.y + dy;
        next.width = box.width + dx;
        next.height = box.height - dy;
        break;
      case 'bl':
        next.x = box.x + dx;
        next.width = box.width - dx;
        next.height = box.height + dy;
        break;
      case 'br':
        next.width = box.width + dx;
        next.height = box.height + dy;
        break;
      case 'top':
        next.y = box.y + dy;
        next.height = box.height - dy;
        break;
      case 'bottom':
        next.height = box.height + dy;
        break;
      case 'left':
        next.x = box.x + dx;
        next.width = box.width - dx;
        break;
      case 'right':
        next.width = box.width + dx;
        break;
      default:
        break;
    }

    return normalizeBox(next);
  };

  const handleViewerCanvasMouseDown = (e) => {
    if (!boxEditMode) {
      handleViewerPanStart(e);
      return;
    }

    e.preventDefault();

    const { x, y } = getCanvasCoords(e);

    if (addBoxMode) {
      const draftBox = createBoxFromPoints(x, y, x + MIN_BOX_SIZE, y + MIN_BOX_SIZE);
      const cleanedCount = detectionResults.filter((item) => !item.__draft).length;

      setDetectionResults((prev) => {
        const cleaned = prev.filter((item) => !item.__draft);
        return [...cleaned, draftBox];
      });

      setSelectedBoxIndex(cleanedCount);
      setBoxDrag({
        type: 'create',
        startX: x,
        startY: y
      });

      return;
    }

    const boxIndex = getBoxIndexAt(x, y);

    if (boxIndex !== -1) {
      const box = detectionResults[boxIndex];
      const corner = getResizeCorner(box, x, y);

      setSelectedBoxIndex(boxIndex);
      setBoxDrag({
        type: corner ? 'resize' : 'move',
        index: boxIndex,
        corner,
        startX: x,
        startY: y,
        originalBox: { ...box }
      });

      return;
    }

    setSelectedBoxIndex(null);
    handleViewerPanStart(e);
  };

  const handleViewerMouseMove = (e) => {
    if (boxDrag) {
      e.preventDefault();

      const { x, y } = getCanvasCoords(e);

      if (boxDrag.type === 'create') {
        const newBox = createBoxFromPoints(boxDrag.startX, boxDrag.startY, x, y);

        setDetectionResults((prev) => {
          const cleaned = prev.filter((item) => !item.__draft);
          return [...cleaned, newBox];
        });

        return;
      }

      if (boxDrag.type === 'move' || boxDrag.type === 'resize') {
        const dx = x - boxDrag.startX;
        const dy = y - boxDrag.startY;

        setDetectionResults((prev) => {
          const next = [...prev];
          const originalBox = boxDrag.originalBox;

          if (!originalBox || boxDrag.index == null || !next[boxDrag.index]) {
            return prev;
          }

          if (boxDrag.type === 'move') {
            const moved = normalizeBox({
              ...originalBox,
              x: originalBox.x + dx,
              y: originalBox.y + dy
            });

            next[boxDrag.index] = moved;
          }

          if (boxDrag.type === 'resize') {
            next[boxDrag.index] = resizeBox(originalBox, boxDrag.corner, dx, dy);
          }

          return next;
        });
      }

      return;
    }

    handleViewerPanMove(e);
  };

  const handleViewerMouseUp = () => {
    if (boxDrag?.type === 'create') {
      setDetectionResults((prev) => {
        const next = prev
          .map((item) => {
            if (!item.__draft) return item;

            if (item.width < MIN_BOX_SIZE || item.height < MIN_BOX_SIZE) {
              return null;
            }

            return {
              ...item,
              __draft: false,
              __new: true
            };
          })
          .filter(Boolean);

        setSelectedBoxIndex(next.length > 0 ? next.length - 1 : null);
        return next;
      });

      setAddBoxMode(false);
      setBoxDirty(true);
    }

    if (boxDrag?.type === 'move' || boxDrag?.type === 'resize') {
      setBoxDirty(true);
    }

    setBoxDrag(null);
    handleViewerPanEnd();
  };

  const handleToggleBoxEditMode = () => {
    if (!canEditBoxes) {
      showNotice('只有检测成功后才能编辑检测框', 'error');
      return;
    }

    if (boxEditMode) {
      if (boxDirty || detectionResults.some((item) => item.__draft)) {
        restoreBoxEditBackup();
        showNotice('已退出编辑，未保存的检测框修改已撤销', 'info');
      }

      exitBoxEditMode(false);
      return;
    }

    boxEditBackupRef.current = deepCloneBoxes(clearClientBoxFlags(detectionResults));

    setDetectionResults(clearClientBoxFlags(detectionResults));
    setBoxEditMode(true);
    setSelectedBoxIndex(null);
    setAddBoxMode(false);
    setBoxDrag(null);
    setBoxDirty(false);
  };

  const handleToggleAddBoxMode = () => {
    if (!boxEditMode) return;

    if (addBoxMode) {
      setAddBoxMode(false);
      setBoxDrag(null);
      setSelectedBoxIndex(null);
      setDetectionResults((prev) => prev.filter((item) => !item.__draft));
      return;
    }

    setAddBoxMode(true);
    setSelectedBoxIndex(null);
    setBoxDrag(null);
    setDetectionResults((prev) => prev.filter((item) => !item.__draft));
  };

  const handleDeleteSelectedBox = () => {
    if (selectedBoxIndex == null) {
      showNotice('请先选中要删除的检测框', 'error');
      return;
    }

    setDetectionResults((prev) => prev.filter((_, index) => index !== selectedBoxIndex));
    setSelectedBoxIndex(null);
    setBoxDirty(true);
  };

  useEffect(() => {
    if (!viewerOpen || viewerType !== 'detection' || !boxEditMode) {
      return undefined;
    }

    const handleKeyDown = (e) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') {
        return;
      }

      const target = e.target;
      const tagName = target?.tagName?.toLowerCase();

      const isEditable =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable;

      if (isEditable) {
        return;
      }

      if (selectedBoxIndex == null) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setDetectionResults((prev) => prev.filter((_, index) => index !== selectedBoxIndex));
      setSelectedBoxIndex(null);
      setBoxDirty(true);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewerOpen, viewerType, boxEditMode, selectedBoxIndex]);

  const handleSaveBoxes = async () => {
    if (!taskId) {
      showNotice('当前图片暂无检测任务', 'error');
      return;
    }

    if (!canEditBoxes) {
      showNotice('只有检测成功后才能保存检测框', 'error');
      return;
    }

    const cleanResults = detectionResults
      .filter((item) => hasBox(item) && !item.__draft)
      .map((item) => {
        const box = normalizeBox(item);

        return {
          id: box.id || null,
          label: box.label || 'pneumonia',
          score: box.score ?? null,
          x: Number(box.x.toFixed(2)),
          y: Number(box.y.toFixed(2)),
          width: Number(box.width.toFixed(2)),
          height: Number(box.height.toFixed(2)),
          maskPath: box.maskPath || null
        };
      });

    setSavingBoxes(true);

    try {
      const response = await fetch(`/api/inference/tasks/${taskId}/results`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          results: cleanResults
        })
      });

      const result = await response.json();

      if (isApiSuccess(result)) {
        const latest = Array.isArray(result.data)
          ? clearClientBoxFlags(result.data)
          : clearClientBoxFlags(cleanResults);

        setDetectionResults(latest);
        boxEditBackupRef.current = deepCloneBoxes(latest);
        setHistoryTasks((prev) => prev.map((item) => (
          item.id === taskId
            ? {
                ...item,
                historyResults: latest,
                historyResultLabel: summarizeResults(latest)
              }
            : item
        )));
        setSelectedBoxIndex(null);
        setAddBoxMode(false);
        setBoxDrag(null);
        setBoxDirty(false);
        showNotice('检测框保存成功', 'success');
      } else {
        showNotice('保存检测框失败：' + (result.message || '未知错误'), 'error');
      }
    } catch (err) {
      console.error('保存检测框失败:', err);
      showNotice('保存检测框失败：' + err.message, 'error');
    } finally {
      setSavingBoxes(false);
    }
  };

  const handleRunDetection = async () => {
    if (!imageItem) {
      showNotice('请先选择图片', 'error');
      return;
    }

    setDetecting(true);

    try {
      const response = await inferenceApi.createTask({
        imageId: imageItem.id,
        modelId: selectedModel
      });

      if (isApiSuccess(response) && response.data?.id) {
        const newTaskId = response.data.id;

        setTaskId(newTaskId);
        setTaskStatus('QUEUED');
        setHistoryTasks((prev) => [
          {
            ...response.data,
            id: newTaskId,
            imageId: imageItem.id,
            status: 'QUEUED',
            historyResults: [],
            historyResultLabel: '无结果'
          },
          ...prev.filter((item) => item.id !== newTaskId)
        ]);
        setDetectionResults([]);
        boxEditBackupRef.current = [];
        resetReviewState();
        resetBoxEditState();
        showNotice('检测任务已创建，正在排队处理...', 'success');
        startPolling(newTaskId);
      } else {
        showNotice('运行检测失败：' + (response.message || '未知错误'), 'error');
      }
    } catch (err) {
      console.error('运行检测失败:', err);
      showNotice('运行检测失败：' + err.message, 'error');
    } finally {
      setDetecting(false);
    }
  };

  const handleSaveReview = async () => {
    if (!canUseReview) {
      showNotice('只有任务成功且有检测结果后才能评价', 'error');
      return;
    }

    const currentStatus = doctorEvaluationStatus || null;
    const currentComment = reviewComment.trim();

    const oldStatus = originalDoctorEvaluationStatus || null;
    const oldComment = (originalReviewComment || '').trim();

    const isFirstReview = oldStatus == null && oldComment === '';

    if (isFirstReview && !currentStatus) {
      showNotice('第一次评价时必须选择评价状态', 'error');
      return;
    }

    const statusChanged = currentStatus !== oldStatus;
    const commentChanged = currentComment !== oldComment;

    if (!statusChanged && !commentChanged) {
      showNotice('没有修改内容', 'info');
      return;
    }

    const payloadEvaluationStatus = statusChanged ? currentStatus : oldStatus;
    const payloadComment = commentChanged ? currentComment : oldComment;

    if (!payloadEvaluationStatus) {
      showNotice('当前要求评价状态不能为空，请先选择评价状态', 'error');
      return;
    }

    setSavingReview(true);

    try {
      const response = await inferenceApi.reviewTask(
        taskId,
        payloadEvaluationStatus,
        payloadComment
      );

      if (isApiSuccess(response)) {
        await refreshTaskDetail(taskId);
        showNotice('医生评价保存成功', 'success');
      } else {
        showNotice('保存评价失败：' + (response.message || '未知错误'), 'error');
      }
    } catch (err) {
      console.error('保存评价失败:', err);
      showNotice('保存评价失败：' + err.message, 'error');
    } finally {
      setSavingReview(false);
    }
  };

  const handleExportJSON = async () => {
    if (!taskId) {
      showNotice('当前图片暂无检测任务', 'error');
      return;
    }

    setExporting(true);

    try {
      const response = await fetch(`/api/inference/tasks/${taskId}/export`, {
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
        a.download = `task_${taskId}_result.json`;
        a.click();

        URL.revokeObjectURL(url);
        showNotice('导出成功', 'success');
      } else {
        showNotice('导出失败：' + (result.message || '未知错误'), 'error');
      }
    } catch (err) {
      console.error('导出失败:', err);
      showNotice('导出失败：' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!taskId) {
      showNotice('当前图片暂无检测任务', 'error');
      return;
    }

    setExporting(true);

    try {
      const response = await fetch(`/api/inference/tasks/${taskId}/export-pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        showNotice('导出失败：HTTP ' + response.status, 'error');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `task_${taskId}_report.pdf`;
      a.click();

      URL.revokeObjectURL(url);
      showNotice('导出成功', 'success');
    } catch (err) {
      console.error('导出PDF失败:', err);
      showNotice('导出PDF失败：' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await logoutToLogin();
  };

  const handleBack = () => {
    if (caseId && studyId) {
      navigate(`/cases/${caseId}/studies/${studyId}`);
      return;
    }

    navigate(-1);
  };

  if (!imageItem) {
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

          <div className="doctor-content">
            <div className="error-container">
              <p className="error-message">❌ 未找到图片ID</p>

              <button onClick={handleBack} className="retry-btn">
                返回
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="doctor-content">
          <TopNotice
            visible={notice.visible}
            message={notice.message}
            type={notice.type}
            onClose={closeNotice}
          />

          <div className="image-task-page-header-row">
            <button onClick={handleBack} className="studies-back-btn">
              ← 返回
            </button>

            <div className="studies-page-title-block">
              <h2>图片详情</h2>
              <p>图片ID：{imageItem.id}</p>
            </div>

            <button onClick={loadData} className="refresh-btn">
              🔄 刷新数据
            </button>
          </div>

          <div className="image-task-page-card">
            <div className="image-task-modal-body">
              <div className="image-task-preview-grid">
                <div className="image-task-preview-box">
                  <div className="image-task-preview-title">原图</div>

                  {loading ? (
                    <div className="image-task-placeholder">加载中...</div>
                  ) : originalImageUrl ? (
                    <img
                      ref={originalImgRef}
                      src={originalImageUrl}
                      alt="原图"
                      className="image-task-preview-image"
                      onLoad={handleImageLoad}
                      onClick={() => openImageViewer(originalImageUrl, '原图')}
                      title="点击查看大图"
                    />
                  ) : (
                    <div className="image-task-placeholder">暂无影像</div>
                  )}
                </div>

                <div className="image-task-preview-box">
                  <div className="image-task-preview-title">推理图像（带检测框）</div>

                  {loading ? (
                    <div className="image-task-placeholder">加载中...</div>
                  ) : detectionResults.length > 0 ? (
                    <canvas
                      ref={previewCanvasRef}
                      className="image-task-preview-canvas"
                      onClick={openCanvasViewer}
                      title="点击查看大图"
                    />
                  ) : (
                    <div className="image-task-placeholder">暂无检测结果</div>
                  )}
                </div>
              </div>

              <div className="image-task-status-row">
                <span className="image-task-status-label">检测状态：</span>

                <span className={`status-badge ${getStatusClass(taskStatus)}`}>
                  {getStatusText(taskStatus)}
                </span>

                {detectionResults.length > 0 && detectionResults[0] && (
                  <>
                    <span className="image-task-status-label">结果：</span>

                    <span className={`result-badge ${getResultClass(detectionResults[0].label)}`}>
                      {getResultText(detectionResults[0].label)}
                    </span>
                  </>
                )}

                <span className="image-task-status-label">医生评价：</span>

                <span className={`result-badge ${getDoctorEvaluationClass(doctorEvaluationStatus)}`}>
                  {getDoctorEvaluationText(doctorEvaluationStatus)}
                </span>
              </div>

              <div className="image-task-review-block">
                <div className="image-task-review-header">
                  <div className="image-task-review-title">医生评价</div>

                  <div className="image-task-review-controls">
                    <select
                      className="image-task-review-select"
                      value={doctorEvaluationStatus}
                      onChange={(e) => setDoctorEvaluationStatus(e.target.value)}
                      disabled={!canUseReview || savingReview}
                    >
                      {REVIEW_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      className="image-task-review-save-btn"
                      onClick={handleSaveReview}
                      disabled={!canUseReview || savingReview}
                    >
                      {savingReview ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>

                <textarea
                  className="image-task-review-textarea"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="请输入医生评价说明"
                  maxLength={500}
                  disabled={!canUseReview || savingReview}
                />

                {!canUseReview && (
                  <div className="image-task-review-disabled-hint">
                    只有任务成功且存在检测结果后，才可以进行医生评价。
                  </div>
                )}
              </div>

              <div className="image-task-action-row">
                <button
                  className="action-btn image-task-bottom-btn"
                  onClick={handleRunDetection}
                  disabled={detecting}
                >
                  {detecting ? '检测中...' : '运行检测'}
                </button>

                <button
                  className="action-btn create-examination image-task-bottom-btn"
                  onClick={handleExportJSON}
                  disabled={exporting || !taskId || taskStatus !== 'SUCCESS'}
                >
                  导出JSON
                </button>

                <button
                  className="action-btn image-task-bottom-btn"
                  onClick={handleExportPDF}
                  disabled={exporting || !taskId || taskStatus !== 'SUCCESS'}
                >
                  导出PDF
                </button>

                <select
                  className="image-task-model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={detecting}
                >
                  <option value="pneumo_v1">pneumo_v1 (YOLOv11)</option>
                  <option value="pneumo_v2">pneumo_v2 (RT-DETR)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="image-task-history-card">
            <div className="image-task-history-header">
              <div>
                <h3>历史检测</h3>
                <p>当前图片的全部检测任务记录</p>
              </div>

              <button
                type="button"
                className="image-task-history-refresh"
                onClick={loadData}
                disabled={loading || historyLoading}
              >
                刷新历史
              </button>
            </div>

            <div className="image-task-history-table-wrap">
              <table className="image-task-history-table">
                <thead>
                  <tr>
                    <th>检测时间</th>
                    <th>检测状态</th>
                    <th>结果</th>
                    <th>医生评价</th>
                    <th>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan="5" className="image-task-history-empty">
                        历史检测加载中...
                      </td>
                    </tr>
                  ) : historyTasks.length > 0 ? (
                    historyPageTasks.map((historyTask) => (
                      <tr key={historyTask.id} className={historyTask.id === taskId ? 'is-current-task' : ''}>
                        <td>{formatDateTime(getTaskDetectionTime(historyTask))}</td>

                        <td>
                          <span className={`status-badge ${getStatusClass(historyTask.status)}`}>
                            {getStatusText(historyTask.status)}
                          </span>
                        </td>

                        <td>
                          <span className={`result-badge ${getResultClass(historyTask.historyResults?.[0]?.label)}`}>
                            {historyTask.historyResultLabel || summarizeResults(historyTask.historyResults)}
                          </span>
                        </td>

                        <td>
                          <span className={`result-badge ${getDoctorEvaluationClass(normalizeEvaluationStatus(historyTask))}`}>
                            {getDoctorEvaluationText(normalizeEvaluationStatus(historyTask))}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="image-task-history-detail-btn"
                            onClick={() => openHistoryTaskDetail(historyTask)}
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="image-task-history-empty">
                        暂无历史检测记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!historyLoading && historyTasks.length > 0 && (
              <div className="image-task-history-pagination">
                <div className="image-task-history-pagination-left">
                  <div className="image-task-history-page-size-selector">
                    <span>每页显示</span>
                    <input
                      className="image-task-history-page-size-input"
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

                <div className="image-task-history-pagination-actions">
                  <button
                    type="button"
                    className="image-task-history-pagination-btn"
                    onClick={() => goToHistoryPage(1)}
                    disabled={historyCurrentPage === 1}
                  >
                    首页
                  </button>

                  <button
                    type="button"
                    className="image-task-history-pagination-btn"
                    onClick={() => goToHistoryPage(historyCurrentPage - 1)}
                    disabled={historyCurrentPage === 1}
                  >
                    上一页
                  </button>

                  <input
                    className="image-task-history-page-jump-input"
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

                  <span className="image-task-history-page-jump-text">/ {historyTotalPages}</span>

                  <button
                    type="button"
                    className="image-task-history-pagination-btn"
                    onClick={() => goToHistoryPage(historyCurrentPage + 1)}
                    disabled={historyCurrentPage === historyTotalPages}
                  >
                    下一页
                  </button>

                  <button
                    type="button"
                    className="image-task-history-pagination-btn"
                    onClick={() => goToHistoryPage(historyTotalPages)}
                    disabled={historyCurrentPage === historyTotalPages}
                  >
                    末页
                  </button>
                </div>
              </div>
            )}
          </div>


          {viewerOpen && (
            <div className="image-viewer-overlay">
              <div className="image-viewer-panel">
                <div className="image-viewer-header">
                  <div>
                    <div className="image-viewer-title">{viewerTitle}</div>

                    <div className="image-viewer-tip">
                      鼠标滚轮缩放，放大后按住图片拖动查看，双击图片重置
                      {boxEditMode && (
                        <span className="image-viewer-edit-tip">
                          ；编辑模式下可拖动 / 缩放检测框，选中框后可按 Backspace / Delete 删除
                          {addBoxMode ? '，请在图上拖拽画出新框' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="image-viewer-actions">
                    {viewerType === 'detection' && (
                      <div className="image-viewer-threshold">
                        <span>阈值</span>

                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={scoreThreshold}
                          onChange={(e) => {
                            setScoreThreshold(Number(e.target.value));
                            setSelectedBoxIndex(null);
                          }}
                        />

                        <strong>{Math.round(scoreThreshold * 100)}%</strong>
                      </div>
                    )}

                    {viewerType === 'detection' && boxEditMode && (
                      <>
                        <button
                          type="button"
                          className={addBoxMode ? 'viewer-btn-warning' : 'viewer-btn-primary'}
                          onClick={handleToggleAddBoxMode}
                          disabled={savingBoxes}
                        >
                          {addBoxMode ? '取消新增' : '新增框'}
                        </button>

                        <button
                          type="button"
                          onClick={handleDeleteSelectedBox}
                          disabled={savingBoxes || selectedBoxIndex == null}
                        >
                          删除选中
                        </button>

                        <button
                          type="button"
                          className="viewer-btn-success"
                          onClick={handleSaveBoxes}
                          disabled={savingBoxes}
                        >
                          {savingBoxes ? '保存中...' : '保存框'}
                        </button>
                      </>
                    )}

                    {viewerType === 'detection' && (
                      <button
                        type="button"
                        className={boxEditMode ? 'viewer-btn-warning' : 'viewer-btn-primary'}
                        onClick={handleToggleBoxEditMode}
                        disabled={!canEditBoxes || savingBoxes}
                      >
                        {boxEditMode ? '退出编辑' : '编辑检测框'}
                      </button>
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

                    <button
                      type="button"
                      className="image-viewer-close"
                      onClick={closeImageViewer}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div
                  className="image-viewer-body"
                  onWheel={handleViewerWheel}
                  onMouseMove={handleViewerMouseMove}
                  onMouseUp={handleViewerMouseUp}
                  onMouseLeave={handleViewerMouseUp}
                >
                  {viewerType === 'original' ? (
                    <img
                      src={viewerImageUrl}
                      alt={viewerTitle}
                      className="image-viewer-image"
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
                      className="image-viewer-canvas"
                      onMouseDown={handleViewerCanvasMouseDown}
                      onDoubleClick={() => {
                        if (!boxEditMode) {
                          resetViewerZoom();
                        }
                      }}
                      style={{
                        transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerScale})`,
                        cursor: boxEditMode
                          ? addBoxMode
                            ? 'crosshair'
                            : selectedBoxIndex != null
                              ? 'move'
                              : 'default'
                          : viewerScale > 1
                            ? viewerDragging
                              ? 'grabbing'
                              : 'grab'
                            : 'default'
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}


          <ImageTaskHistoryModal
            isOpen={historyModalOpen}
            imageItem={imageItem}
            taskItem={selectedHistoryTask}
            onClose={closeHistoryTaskDetail}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageTaskDetailPage;