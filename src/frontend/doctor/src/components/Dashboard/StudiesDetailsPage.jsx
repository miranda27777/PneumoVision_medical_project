import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/common/Header';
import TopNotice from '../../components/common/TopNotice';
import StudyModal from './StudyModal';
import ConfirmModal from './ConfirmModal';
import { imageApi, inferenceApi } from '../../api';
import './DoctorDashboard.css';
import './StudiesDetailsPage.css';
import { logoutToLogin } from '../../utils/auth';

const StudiesDetailsPage = () => {
  const { caseId, studyId } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [studyData, setStudyData] = useState(null);
  const [allImages, setAllImages] = useState([]);
  const [imagePreviewMap, setImagePreviewMap] = useState({});
  const [taskStatusMap, setTaskStatusMap] = useState({});
  const [doctorEvaluationMap, setDoctorEvaluationMap] = useState({});
  const [detectionResultMap, setDetectionResultMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageInput, setPageInput] = useState('1');
  const [pageSizeInput, setPageSizeInput] = useState('10');

  // 筛选条件
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    taskStatus: '',
    detectionResult: '',
    evaluationStatus: ''
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingImage, setDeletingImage] = useState(null);

  const [selectedModel, setSelectedModel] = useState('pneumo_v1');

  const [batchDetecting, setBatchDetecting] = useState(false);

  const [selectedImageIds, setSelectedImageIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // 敏感信息显示状态：本页面只控制“病人姓名”
  const [showSensitive, setShowSensitive] = useState(false);
  const [sensitiveInfo, setSensitiveInfo] = useState(null);
  const [loadingSensitive, setLoadingSensitive] = useState(false);

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

  const fileInputRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const pendingTaskIdsRef = useRef(new Set());
  const taskImageMapRef = useRef({});
  const failedTaskMessagesRef = useRef([]);
  const previewUrlMapRef = useRef({});

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    setSelectedImageIds(new Set());
    setSelectAll(false);
    setCurrentPage(1);
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

  const getPatientNameDisplay = () => {
    if (showSensitive) {
      return sensitiveInfo?.patientName || caseData?.patientNameMasked || '-';
    }

    return caseData?.patientNameMasked || '-';
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

    if (sensitiveInfo?.patientName) {
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

  const normalizeDoctorEvaluationStatus = (task) => {
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

  const getDoctorEvaluationText = (status) => {
    switch (status) {
      case 'CORRECT':
        return '正确';
      case 'FALSE_POSITIVE':
        return '误检';
      case 'MISSED':
        return '漏检';
      case 'ERROR':
        return '错误';
      default:
        return '未评价';
    }
  };

  const getDoctorEvaluationClass = (status) => {
    switch (status) {
      case 'CORRECT':
        return 'review-correct';
      case 'FALSE_POSITIVE':
      case 'MISSED':
      case 'ERROR':
        return 'review-negative';
      default:
        return 'review-unreviewed';
    }
  };

  const getDetectionResultText = (label) => {
    if (!label) return '未知';
    if (label === 'pneumonia') return '肺炎';
    if (label === 'normal') return '正常';
    return label;
  };

  const getDetectionResultClass = (label) => {
    if (!label) return 'result-unknown';
    if (label === 'normal') return 'result-normal';
    return 'result-abnormal';
  };

  const fetchTaskResultLabel = async (taskId) => {
    try {
      const resultRes = await inferenceApi.listResults(taskId);
      if (resultRes.code === 0 && resultRes.data) {
        const list = Array.isArray(resultRes.data) ? resultRes.data : [resultRes.data];
        if (list.length > 0 && list[0]?.label) {
          return list[0].label;
        }
      }
      return '';
    } catch (err) {
      console.error(`获取任务 ${taskId} 检测结果失败:`, err);
      return '';
    }
  };

  const fetchImageTaskMeta = async (imageId) => {
    try {
      const tasksRes = await inferenceApi.listTasks({ imageId });
      if (tasksRes.code === 0 && tasksRes.data) {
        const taskList = Array.isArray(tasksRes.data)
          ? tasksRes.data
          : (tasksRes.data.items || []);

        if (taskList.length > 0) {
          const latestTask = taskList[0];
          let resultLabel = '';

          if (latestTask.status === 'SUCCESS' && latestTask.id) {
            resultLabel = await fetchTaskResultLabel(latestTask.id);
          }

          return {
            status: latestTask.status || null,
            doctorEvaluationStatus: normalizeDoctorEvaluationStatus(latestTask),
            resultLabel
          };
        }
      }

      return {
        status: null,
        doctorEvaluationStatus: '',
        resultLabel: ''
      };
    } catch (err) {
      console.error(`获取图片 ${imageId} 任务状态失败:`, err);
      return {
        status: null,
        doctorEvaluationStatus: '',
        resultLabel: ''
      };
    }
  };

  const handleLogout = async () => {
    await logoutToLogin();
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

  const fetchStudyDetail = async () => {
    const response = await fetch(`/api/cases/${caseId}/studies`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(result.message || '获取检查详情失败');
    }

    const list = Array.isArray(result.data?.items)
      ? result.data.items
      : Array.isArray(result.data)
        ? result.data
        : [];

    const currentStudy = list.find((item) => String(item.id) === String(studyId));
    if (!currentStudy) {
      throw new Error('未找到该检查');
    }

    setStudyData(currentStudy);
  };

  const fetchStudyImages = async () => {
    const response = await fetch(`/api/images/study/${studyId}?page=0&size=1000`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    const result = await response.json();

    let list = [];
    if (result.code === 0 && result.data) {
      list = Array.isArray(result.data?.items)
        ? result.data.items
        : Array.isArray(result.data)
          ? result.data
          : [];
    }

    setAllImages(list);

    const metaPromises = list.map((img) => fetchImageTaskMeta(img.id));
    const metaResults = await Promise.all(metaPromises);

    const statusMap = {};
    const reviewMap = {};
    const resultMap = {};

    list.forEach((img, idx) => {
      const meta = metaResults[idx];
      if (meta?.status) {
        statusMap[img.id] = meta.status;
      }
      reviewMap[img.id] = meta?.doctorEvaluationStatus || '';
      resultMap[img.id] = meta?.resultLabel || '';
    });

    setTaskStatusMap(statusMap);
    setDoctorEvaluationMap(reviewMap);
    setDetectionResultMap(resultMap);

    const previewEntries = await Promise.all(
      list.map(async (img) => {
        try {
          const blob = await imageApi.getPreview(img.id);
          const url = URL.createObjectURL(blob);
          return [img.id, url];
        } catch (previewError) {
          console.error(`加载图片 ${img.id} 预览失败:`, previewError);
          return [img.id, null];
        }
      })
    );

    const nextPreviewMap = Object.fromEntries(previewEntries);

    Object.values(previewUrlMapRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });

    previewUrlMapRef.current = nextPreviewMap;
    setImagePreviewMap(nextPreviewMap);
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      await fetchCaseDetail();
      await fetchStudyDetail();
      await fetchStudyImages();
    } catch (err) {
      console.error(err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredImages = useMemo(() => {
    let filtered = [...allImages];

    if (filters.dateRange.start) {
      const startDateTime = new Date(filters.dateRange.start);
      startDateTime.setHours(0, 0, 0, 0);
      filtered = filtered.filter(img => {
        const uploadTime = new Date(img.createdAt);
        return uploadTime >= startDateTime;
      });
    }

    if (filters.dateRange.end) {
      const endDateTime = new Date(filters.dateRange.end);
      endDateTime.setHours(23, 59, 59, 999);
      filtered = filtered.filter(img => {
        const uploadTime = new Date(img.createdAt);
        return uploadTime <= endDateTime;
      });
    }

    if (filters.taskStatus) {
      filtered = filtered.filter(img => {
        const status = taskStatusMap[img.id];
        if (filters.taskStatus === 'SUCCESS') return status === 'SUCCESS';
        if (filters.taskStatus === 'FAILED') return status === 'FAILED';
        if (filters.taskStatus === 'RUNNING') return status === 'RUNNING';
        if (filters.taskStatus === 'QUEUED') return status === 'QUEUED' || status === 'PENDING';
        if (filters.taskStatus === 'NONE') return !status || status === '';
        return true;
      });
    }

    if (filters.detectionResult) {
      filtered = filtered.filter(img => {
        const result = detectionResultMap[img.id];
        if (filters.detectionResult === 'pneumonia') return result === 'pneumonia';
        if (filters.detectionResult === 'normal') return result === 'normal';
        return true;
      });
    }

    if (filters.evaluationStatus) {
      filtered = filtered.filter(img => {
        const evaluation = doctorEvaluationMap[img.id] || '';
        return evaluation === filters.evaluationStatus;
      });
    }

    return filtered;
  }, [allImages, filters, taskStatusMap, detectionResultMap, doctorEvaluationMap]);

  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredImages.slice(start, end);
  }, [filteredImages, currentPage, pageSize]);

  const totalElements = filteredImages.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredImages.length]);

  useEffect(() => {
    fetchAllData();
  }, [caseId, studyId, refreshKey]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlMapRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const toggleSelectImage = (imageId, e) => {
    if (e) e.stopPropagation();

    const newSet = new Set(selectedImageIds);
    if (newSet.has(imageId)) {
      newSet.delete(imageId);
    } else {
      newSet.add(imageId);
    }

    setSelectedImageIds(newSet);
    setSelectAll(newSet.size === paginatedImages.length && paginatedImages.length > 0);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(paginatedImages.map((img) => img.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleUpdateStudy = async (formData) => {
    try {
      const response = await fetch(`/api/cases/${caseId}/studies/${studyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          studyTime: new Date(formData.studyTime).toISOString(),
          modality: formData.modality,
          description: formData.description
        })
      });

      const result = await response.json();
      if (result.code === 0) {
        showNotice('更新成功', 'success');
        setEditModalOpen(false);
        handleRefresh();
      } else {
        showNotice('更新失败：' + result.message, 'error');
      }
    } catch (err) {
      showNotice('更新失败：' + err.message, 'error');
    }
  };

  const handleBatchUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const formData = new FormData();
    formData.append('studyId', studyId);
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/images/upload-batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.code !== 0) {
        const errorMsg =
          result.message ||
          result.error ||
          result.data?.message ||
          '未知错误';

        showNotice('批量上传失败：' + errorMsg, 'error');
        return;
      }

      if (!Array.isArray(result.data)) {
        showNotice('批量上传失败：返回结果格式不正确', 'error');
        return;
      }

      const successItems = result.data.filter((item) => !item.error);
      const failItems = result.data.filter((item) => item.error);

      const successCount = successItems.length;
      const failCount = failItems.length;

      if (failCount === 0) {
        showNotice(`上传完成！成功: ${successCount} 张`, 'success');
      } else {
        const failDetails = failItems
          .slice(0, 3)
          .map((item, index) => {
            const fileName =
              item.fileName ||
              item.filename ||
              item.originalFilename ||
              `第${index + 1}张`;

            const reason =
              item.error ||
              item.message ||
              item.errorMessage ||
              '未知原因';

            return `${fileName}：${reason}`;
          })
          .join('；');

        const moreText =
          failItems.length > 3 ? `；其余 ${failItems.length - 3} 张也上传失败` : '';

        showNotice(
          `上传完成！成功: ${successCount} 张，失败: ${failCount} 张。失败原因：${failDetails}${moreText}`,
          'error'
        );
      }

      handleRefresh();
    } catch (err) {
      console.error('批量上传失败:', err);
      showNotice('批量上传失败：' + err.message, 'error');
    } finally {
      event.target.value = '';
    }
  };

  const finishBatchPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setBatchDetecting(false);

    if (failedTaskMessagesRef.current.length > 0) {
      const failDetails = failedTaskMessagesRef.current
        .slice(0, 3)
        .join('；');
      const moreText =
        failedTaskMessagesRef.current.length > 3
          ? `；其余 ${failedTaskMessagesRef.current.length - 3} 个任务也失败`
          : '';

      showNotice(`批量检测完成，但有失败任务：${failDetails}${moreText}`, 'error');
    } else {
      showNotice('批量检测完成！', 'success');
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      const taskIds = Array.from(pendingTaskIdsRef.current);

      if (taskIds.length === 0) {
        finishBatchPolling();
        return;
      }

      try {
        await Promise.all(
          taskIds.map(async (taskId) => {
            try {
              const response = await inferenceApi.getTask(taskId);

              if (response.code === 0 && response.data) {
                const status = response.data.status;
                const imageId = response.data.imageId || taskImageMapRef.current[taskId];
                const reviewStatus = normalizeDoctorEvaluationStatus(response.data);

                if (imageId) {
                  setTaskStatusMap((prev) => ({
                    ...prev,
                    [imageId]: status
                  }));

                  setDoctorEvaluationMap((prev) => ({
                    ...prev,
                    [imageId]: reviewStatus
                  }));
                }

                if (status === 'SUCCESS') {
                  let resultLabel = '';
                  resultLabel = await fetchTaskResultLabel(taskId);

                  if (imageId) {
                    setDetectionResultMap((prev) => ({
                      ...prev,
                      [imageId]: resultLabel
                    }));
                  }

                  pendingTaskIdsRef.current.delete(taskId);
                  delete taskImageMapRef.current[taskId];
                  console.log(`任务 ${taskId} 完成`);
                } else if (status === 'FAILED') {
                  pendingTaskIdsRef.current.delete(taskId);

                  const imageIdText = imageId ? `图片${imageId}` : `任务${taskId}`;
                  const reason =
                    response.data.errorMessage ||
                    response.data.message ||
                    '未知原因';

                  if (imageId) {
                    setDetectionResultMap((prev) => ({
                      ...prev,
                      [imageId]: ''
                    }));
                  }

                  failedTaskMessagesRef.current.push(`${imageIdText}：${reason}`);
                  delete taskImageMapRef.current[taskId];
                  console.error(`任务 ${taskId} 失败:`, reason);
                }
              }
            } catch (err) {
              console.error(`轮询任务 ${taskId} 失败:`, err);
            }
          })
        );

        if (pendingTaskIdsRef.current.size === 0) {
          finishBatchPolling();
        }
      } catch (err) {
        console.error('批量轮询失败:', err);
      }
    }, 1200);
  };

  const submitBatchDetection = async (imageIds) => {
    if (imageIds.length === 0) {
      showNotice('请先选择要检测的图片', 'error');
      return;
    }

    if (imageIds.length > 50) {
      showNotice('单次最多支持50张图片，请分批处理', 'error');
      return;
    }

    setBatchDetecting(true);
    pendingTaskIdsRef.current.clear();
    taskImageMapRef.current = {};
    failedTaskMessagesRef.current = [];

    try {
      const response = await fetch('/api/inference/tasks/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          imageIds,
          modelId: selectedModel
        })
      });

      const result = await response.json();
      console.log('批量检测返回:', result);

      if (result.code !== 0) {
        const errorMsg =
          result.message ||
          result.error ||
          result.data?.message ||
          '未知错误';

        showNotice('批量检测失败：' + errorMsg, 'error');
        setBatchDetecting(false);
        return;
      }

      if (!Array.isArray(result.data)) {
        showNotice('批量检测失败：返回结果格式不正确', 'error');
        setBatchDetecting(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failMessages = [];
      const immediateStatusUpdates = {};
      const immediateReviewUpdates = {};
      const immediateResultUpdates = {};

      result.data.forEach((item, index) => {
        const fallbackImageId = imageIds[index];
        const imageId =
          item.imageId ||
          item.image?.id ||
          item.id ||
          item.task?.imageId ||
          fallbackImageId;

        const reason =
          item.error ||
          item.message ||
          item.errorMessage ||
          item.task?.errorMessage ||
          '未知原因';

        if (item.task?.id && !item.error) {
          successCount += 1;
          pendingTaskIdsRef.current.add(item.task.id);

          if (imageId) {
            taskImageMapRef.current[item.task.id] = imageId;
            immediateStatusUpdates[imageId] = 'QUEUED';
            immediateReviewUpdates[imageId] = '';
            immediateResultUpdates[imageId] = '';
          }
        } else {
          failCount += 1;

          if (imageId) {
            immediateStatusUpdates[imageId] = 'FAILED';
            immediateReviewUpdates[imageId] = '';
            immediateResultUpdates[imageId] = '';
          }

          failMessages.push(`图片${imageId || index + 1}：${reason}`);
        }
      });

      if (Object.keys(immediateStatusUpdates).length > 0) {
        setTaskStatusMap((prev) => ({
          ...prev,
          ...immediateStatusUpdates
        }));
      }

      if (Object.keys(immediateReviewUpdates).length > 0) {
        setDoctorEvaluationMap((prev) => ({
          ...prev,
          ...immediateReviewUpdates
        }));
      }

      if (Object.keys(immediateResultUpdates).length > 0) {
        setDetectionResultMap((prev) => ({
          ...prev,
          ...immediateResultUpdates
        }));
      }

      if (failCount > 0) {
        const failDetails = failMessages.slice(0, 3).join('；');
        const moreText =
          failMessages.length > 3 ? `；其余 ${failMessages.length - 3} 个也失败` : '';

        if (successCount === 0) {
          showNotice(`批量检测失败：${failDetails}${moreText}`, 'error');
          setBatchDetecting(false);
          return;
        }

        showNotice(
          `批量检测任务已创建！成功: ${successCount} 个，失败: ${failCount} 个。失败原因：${failDetails}${moreText}`,
          'error'
        );
      } else {
        showNotice(`批量检测任务已创建！成功: ${successCount} 个`, 'success');
      }

      if (pendingTaskIdsRef.current.size > 0) {
        startPolling();
      } else {
        setBatchDetecting(false);
      }

      setSelectedImageIds(new Set());
      setSelectAll(false);
    } catch (err) {
      console.error('批量检测失败:', err);
      showNotice('批量检测失败：' + err.message, 'error');
      setBatchDetecting(false);
    }
  };

  const handleBatchDetection = async () => {
    if (paginatedImages.length === 0) {
      showNotice('当前检查下暂无图片', 'error');
      return;
    }

    await submitBatchDetection(paginatedImages.map((img) => img.id));
  };

  const handleBatchDetectionSelected = async () => {
    await submitBatchDetection(Array.from(selectedImageIds));
  };

  const handleDeleteImage = (imageItem) => {
    setDeletingImage(imageItem);
    setConfirmModalOpen(true);
  };

  const handleConfirmDeleteImage = async () => {
    if (!deletingImage) return;

    try {
      const response = await fetch(`/api/images/${deletingImage.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      if (result.code === 0) {
        showNotice('删除成功', 'success');
        setConfirmModalOpen(false);
        setDeletingImage(null);
        handleRefresh();
      } else {
        showNotice('删除失败：' + result.message, 'error');
      }
    } catch (err) {
      showNotice('删除失败：' + err.message, 'error');
    }
  };

  const openImageDetail = (img) => {
    navigate(`/cases/${caseId}/studies/${studyId}/images/${img.id}`);
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
    const safePage = Math.min(value, totalPages);
    setCurrentPage(safePage);
    setPageInput(String(safePage));
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

  const handleFilterChange = (key, value) => {
    if (key === 'dateRangeStart') {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, start: value }
      }));
    } else if (key === 'dateRangeEnd') {
      setFilters(prev => ({
        ...prev,
        dateRange: { ...prev.dateRange, end: value }
      }));
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
    }
  };

  const resetFilters = () => {
    setFilters({
      dateRange: { start: '', end: '' },
      taskStatus: '',
      detectionResult: '',
      evaluationStatus: ''
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载检查详情中...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <p className="error-message">❌ {error}</p>
          <button onClick={handleRefresh} className="retry-btn">
            重新加载
          </button>
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
          <button
            onClick={() => navigate(`/cases/${caseId}`)}
            className="studies-back-btn"
          >
            ← 返回
          </button>

          <div className="studies-page-title-block">
            <h2>检查详情</h2>
            <p>检查时间：{formatDate(studyData?.studyTime)}</p>
          </div>

          <button onClick={handleRefresh} className="refresh-btn">
            🔄 刷新数据
          </button>
        </div>

        <div className="studies-case-card">
          <div
            className="studies-case-card-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <h3 style={{ margin: 0 }}>📋 检查基本信息</h3>

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

          <div className="studies-case-grid">
            <div className="studies-case-item">
              <span className="studies-case-label">病人姓名</span>
              <span className="studies-case-value">{getPatientNameDisplay()}</span>
            </div>

            <div className="studies-case-item">
              <span className="studies-case-label">检查时间</span>
              <span className="studies-case-value">{formatDate(studyData?.studyTime)}</span>
            </div>

            <div className="studies-case-item">
              <span className="studies-case-label">模态</span>
              <span className="studies-case-value">{studyData?.modality || 'CR'}</span>
            </div>

            <div className="studies-case-item studies-case-item-full">
              <span className="studies-case-label">描述</span>
              <span className="studies-case-value">{studyData?.description || '-'}</span>
            </div>
          </div>
        </div>


        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label>开始时间</label>
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => handleFilterChange('dateRangeStart', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>结束时间</label>
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => handleFilterChange('dateRangeEnd', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>任务状态</label>
              <select
                value={filters.taskStatus}
                onChange={(e) => handleFilterChange('taskStatus', e.target.value)}
              >
                <option value="">全部</option>
                <option value="SUCCESS">成功</option>
                <option value="FAILED">失败</option>
                <option value="RUNNING">检测中</option>
                <option value="QUEUED">排队中</option>
                <option value="NONE">未检测</option>
              </select>
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
                <option value="">未评价</option>
              </select>
            </div>
            <div className="filter-group filter-actions">
              <button className="reset-filter-btn" onClick={resetFilters}>重置筛选</button>
            </div>
          </div>
        </div>

        <div className="cases-table-container studies-table-section">
          <div className="table-header">
            <h3 className="section-title">操作栏</h3>
            <div className="studies-detail-toolbar">
              <button className="action-btn" onClick={() => setEditModalOpen(true)}>
                编辑信息
              </button>

              <label className="action-btn create-examination" style={{ cursor: 'pointer' }}>
                上传图片
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.dcm"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleBatchUpload}
                />
              </label>

              <button
                className="action-btn"
                onClick={handleBatchDetectionSelected}
                disabled={batchDetecting || selectedImageIds.size === 0}
              >
                批量检测选中({selectedImageIds.size})
              </button>

              <button className="action-btn" onClick={toggleSelectAll}>
                {selectAll ? '取消全选' : '全选'}
              </button>

              <select
                className="studies-model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={batchDetecting}
              >
                <option value="pneumo_v1">pneumo_v1 (YOLOv11)</option>
                <option value="pneumo_v2">pneumo_v2 (RT-DETR)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="studies-detail-gallery">
          {paginatedImages.length > 0 ? (
            paginatedImages.map((img) => {
              const taskStatus = taskStatusMap[img.id];
              const doctorEvaluationStatus = doctorEvaluationMap[img.id];
              const detectionResult = detectionResultMap[img.id];

              return (
                <div
                  key={img.id}
                  className="studies-image-card"
                  onClick={() => openImageDetail(img)}
                >
                  <div className="studies-image-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedImageIds.has(img.id)}
                      onChange={(e) => toggleSelectImage(img.id, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="studies-image-thumb">
                    {imagePreviewMap[img.id] ? (
                      <img
                        src={imagePreviewMap[img.id]}
                        alt={`图片 ${img.id}`}
                        className="studies-image-thumb-img"
                      />
                    ) : (
                      <span>🖼️ 图片 #{img.id}</span>
                    )}
                  </div>

                  <div className="studies-image-meta">
                    <div className="studies-image-id">图片ID：{img.id}</div>
                    <div>上传时间：{formatDate(img.createdAt)}</div>

                    <div className="studies-image-status-row">
                      <div className="studies-image-status">
                        <span className={`status-badge-small ${getStatusClass(taskStatus)}`}>
                          {getStatusText(taskStatus)}
                        </span>

                        {taskStatus === 'SUCCESS' && (
                          <>
                            <span className={`result-badge-small ${getDetectionResultClass(detectionResult)}`}>
                              {getDetectionResultText(detectionResult)}
                            </span>

                            <span className={`review-badge-small ${getDoctorEvaluationClass(doctorEvaluationStatus)}`}>
                              {getDoctorEvaluationText(doctorEvaluationStatus)}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        className="mini-link-btn danger studies-image-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(img);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="cases-table-container studies-empty-block">
              暂无上传图片
            </div>
          )}
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
              <strong>{totalElements}</strong>
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

        <StudyModal
          isOpen={editModalOpen}
          study={studyData}
          caseId={caseId}
          onClose={() => setEditModalOpen(false)}
          onSubmit={handleUpdateStudy}
        />

        <ConfirmModal
          isOpen={confirmModalOpen}
          title="确认删除"
          message={`确定要删除图片【${deletingImage?.id || ''}】吗？此操作不可恢复！`}
          onConfirm={handleConfirmDeleteImage}
          onCancel={() => {
            setConfirmModalOpen(false);
            setDeletingImage(null);
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

export default StudiesDetailsPage;