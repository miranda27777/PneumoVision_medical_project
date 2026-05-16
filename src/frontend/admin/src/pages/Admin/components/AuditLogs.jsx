import React, { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../../../api';
import TopNotice from '../../../components/common/TopNotice';
import './AuditLogs.css';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [pageInput, setPageInput] = useState('1');
  const [pageSizeInput, setPageSizeInput] = useState('10');

  // 筛选条件
  const [usernameSearch, setUsernameSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(''); // 具体日期查询

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const showNotice = (message, type = 'info') => {
    setNotice({
      visible: true,
      message,
      type
    });
  };

  const closeNotice = useCallback(() => {
    setNotice({
      visible: false,
      message: '',
      type: 'info'
    });
  }, []);

  useEffect(() => {
    setPageInput(String(page + 1));
  }, [page]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        size: pageSize,
        ...(usernameSearch && { username: usernameSearch })
      };

      // 优先级：具体日期 > 日期范围
      if (selectedDate) {
        params.startTime = `${selectedDate}T00:00:00`;
        params.endTime = `${selectedDate}T23:59:59`;
      } else if (startDate && endDate) {
        params.startTime = `${startDate}T00:00:00`;
        params.endTime = `${endDate}T23:59:59`;
      } else if (startDate) {
        params.startTime = `${startDate}T00:00:00`;
      } else if (endDate) {
        params.endTime = `${endDate}T23:59:59`;
      }

      const response = await auditApi.listLogs(params);
      console.log('获取审计日志返回:', response);

      if (response.code === 0) {
        setLogs(response.data?.items || response.data?.records || response.data?.list || []);
        setTotal(response.data?.total || 0);
      } else {
        showNotice('获取审计日志失败', 'error');
      }
    } catch (error) {
      console.error('获取审计日志失败:', error);
      showNotice('获取审计日志失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, usernameSearch, startDate, endDate, selectedDate]);

  const handleClearFilters = () => {
    setUsernameSearch('');
    setStartDate('');
    setEndDate('');
    setSelectedDate('');
    setPage(0);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN');
  };

  const goToPage = (pageNumber) => {
    const safePage = Math.min(Math.max(0, pageNumber), totalPages - 1);
    setPage(safePage);
  };

  const commitPageInput = () => {
    if (pageInput.trim() === '') {
      setPageInput(String(page + 1));
      return;
    }
    const value = Number(pageInput);
    if (!Number.isInteger(value) || value < 1) {
      setPageInput(String(page + 1));
      return;
    }
    goToPage(value - 1);
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
    setPage(0);
  };

  return (
    <div className="audit-logs">
      <TopNotice visible={notice.visible} message={notice.message} type={notice.type} onClose={closeNotice} />

      <div className="page-header">
        <h2>📋 审计日志</h2>
      </div>

      <div className="filters">
        <input
          type="text"
          className="filter-input"
          placeholder="🔍 搜索用户名"
          value={usernameSearch}
          onChange={(e) => {
            setUsernameSearch(e.target.value);
            setPage(0);
          }}
        />

        <div className="date-filter-group">
          <input
            type="date"
            className="filter-date"
            placeholder="具体日期"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setStartDate('');
              setEndDate('');
              setPage(0);
            }}
          />
          <span className="date-label">或</span>
          <input
            type="date"
            className="filter-date"
            placeholder="开始日期"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setSelectedDate('');
              setPage(0);
            }}
          />
          <span className="date-separator">至</span>
          <input
            type="date"
            className="filter-date"
            placeholder="结束日期"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setSelectedDate('');
              setPage(0);
            }}
          />
        </div>

        {(usernameSearch || startDate || endDate || selectedDate) && (
          <button className="clear-btn" onClick={handleClearFilters}>🗑️ 清除筛选</button>
        )}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="logs-table">
              <thead>
                <tr><th>时间</th><th>用户</th><th>操作</th><th>状态</th></tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log, idx) => (
                    <tr key={idx}>
                      <td>{formatTime(log.time || log.createdAt)}</td>
                      <td>{log.user || log.username}</td>
                      <td>{log.action}</td>
                      <td>
                        <span className={`status-tag ${log.status === 'SUCCESS' ? 'success' : 'fail'}`}>
                          {log.status === 'SUCCESS' ? '成功' : '失败'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="no-data">暂无日志数据</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div className="pagination-left">
              <div className="page-size-selector">
                <span>每页显示</span>
                <input className="page-size-input" type="text" value={pageSizeInput}
                  onChange={(e) => setPageSizeInput(e.target.value)}
                  onBlur={commitPageSizeInput}
                  onKeyDown={(e) => e.key === 'Enter' && commitPageSizeInput()} />
                <span>条，共 <strong>{total}</strong> 条记录</span>
              </div>
            </div>
            <div className="pagination-actions">
              <button className="pagination-btn" onClick={() => goToPage(0)} disabled={page === 0}>首页</button>
              <button className="pagination-btn" onClick={() => goToPage(page - 1)} disabled={page === 0}>上一页</button>
              <input className="page-jump-input" type="text" value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => e.key === 'Enter' && commitPageInput()} />
              <span className="page-jump-text">/ {totalPages}</span>
              <button className="pagination-btn" onClick={() => goToPage(page + 1)} disabled={page + 1 >= totalPages}>下一页</button>
              <button className="pagination-btn" onClick={() => goToPage(totalPages - 1)} disabled={page + 1 >= totalPages}>末页</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogs;