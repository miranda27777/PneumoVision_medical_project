import { useState, useEffect, useCallback } from 'react';
import { casesApi } from '../api';

export const useDashboardData = (currentPage = 1, pageSize = 10, filters = {}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    pendingCases: 0,
    completedDetections: 0,
    aiAbnormalities: 0
  });
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [aiResults, setAiResults] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [recentUploads, setRecentUploads] = useState([]);
  
  // 添加强制刷新触发器
  const [refreshKey, setRefreshKey] = useState(0);

  const getTaskIdMap = () => {
    const saved = localStorage.getItem('caseTaskIds');
    return saved ? JSON.parse(saved) : {};
  };

  const saveTaskId = (caseId, taskId) => {
    const currentMap = getTaskIdMap();
    const newMap = { ...currentMap, [caseId]: taskId };
    localStorage.setItem('caseTaskIds', JSON.stringify(newMap));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: currentPage - 1,
        size: pageSize
      };
      
      if (filters.keyword) {
        if (filters.searchType === 'caseNumber') {
          params.caseNumber = filters.keyword;
        } else if (filters.searchType === 'patientName') {
          params.patientName = filters.keyword;
        } else {
          params.caseNumber = filters.keyword;
          params.patientName = filters.keyword;
        }
      }
      if (filters.startDate) {
        params.from = filters.startDate;
      }
      if (filters.endDate) {
        params.to = filters.endDate;
      }
      
      console.log('🔄 正在获取病例列表，参数:', params);
      const casesRes = await casesApi.getCases(params);
      console.log('📊 API 返回数据:', casesRes);

      if (casesRes.code === 0) {
        const responseData = casesRes.data || {};
        
        let caseList = [];
        let totalCount = 0;
        
        if (Array.isArray(responseData)) {
          caseList = responseData;
          totalCount = responseData.length;
        } 
        else if (responseData.items && Array.isArray(responseData.items)) {
          caseList = responseData.items;
          totalCount = responseData.total || responseData.items.length;
        }
        else if (responseData.records && Array.isArray(responseData.records)) {
          caseList = responseData.records;
          totalCount = responseData.total || responseData.records.length;
        }
        else if (responseData.list && Array.isArray(responseData.list)) {
          caseList = responseData.list;
          totalCount = responseData.total || responseData.list.length;
        }
        else if (responseData.content && Array.isArray(responseData.content)) {
          caseList = responseData.content;
          totalCount = responseData.totalElements || responseData.total || responseData.content.length;
        }
        else {
          caseList = [];
          totalCount = 0;
          console.warn('未知的数据格式:', responseData);
        }

        console.log('📋 解析后的病例列表数量:', caseList.length);
        console.log('📊 总病例数:', totalCount);

        const taskIdMap = getTaskIdMap();

        const mergedList = caseList.map(c => ({
          ...c,
          taskId: taskIdMap[c.id] || c.taskId
        }));

        setCases(mergedList);
        setTotal(totalCount);

        const pending = totalCount;
        const completed = 0;
        const abnormal = mergedList.filter(
          c => c.prediction === '肺炎可疑' || c.prediction === '肺炎阳性'
        ).length;

        setStats({
          pendingCases: pending,
          completedDetections: completed,
          aiAbnormalities: abnormal
        });
      } else {
        console.error('API 返回错误:', casesRes.message);
        setCases([]);
        setTotal(0);
        setError(casesRes.message || '获取数据失败');
      }
    } catch (err) {
      console.error('获取数据失败:', err);
      setCases([]);
      setTotal(0);
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters.keyword, filters.searchType, filters.startDate, filters.endDate, refreshKey]); // 添加 refreshKey 依赖

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 修改 refreshData 函数，触发强制刷新
  const refreshData = () => {
    console.log('🔄 强制刷新数据...');
    setRefreshKey(prev => prev + 1);
  };

  const addUploadedImage = (imageData) => {
    if (imageData.imageId) {
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === imageData.caseId
            ? { ...c, imageId: imageData.imageId }
            : c
        )
      );

      const newImage = {
        id: imageData.imageId,
        caseId: imageData.caseId,
        fileName: imageData.file.name,
        confidence: 87,
        uploadTime: new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      setImagePreviews(prev => [newImage, ...prev]);
      setRecentUploads(prev => [
        {
          fileName: imageData.file.name,
          caseId: imageData.caseId,
          time: newImage.uploadTime
        },
        ...prev
      ]);
    }
  };

  const updateCaseTaskId = (caseId, taskId) => {
    console.log('保存 taskId:', caseId, taskId);
    saveTaskId(caseId, taskId);
    setCases(prevCases =>
      prevCases.map(c =>
        c.id === caseId ? { ...c, taskId: taskId } : c
      )
    );
  };

  return {
    loading,
    error,
    stats,
    cases,
    total,
    aiResults,
    imagePreviews,
    recentUploads,
    refreshData,
    addUploadedImage,
    updateCaseTaskId
  };
};