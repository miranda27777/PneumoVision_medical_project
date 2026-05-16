import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';
import CreateExaminationModal from './CreateExaminationModal';
import TopNotice from '../common/TopNotice';
import './CasesTable.css';

const CasesTable = ({
  cases = [],
  total = 0,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onUpdateCaseTaskId,
  onFilterChange,
  filters: externalFilters = {}
}) => {
  const navigate = useNavigate();

  const searchInputRef = useRef(null);
  const isSearchFocusedRef = useRef(false);
  const caretPositionRef = useRef(null);

  // 只保留病例编号搜索
  const [searchTerm, setSearchTerm] = useState(
    externalFilters.keyword || externalFilters.caseNumber || ''
  );

  const [dateRange, setDateRange] = useState({
    from: externalFilters.startDate || '',
    to: externalFilters.endDate || ''
  });

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingCase, setDeletingCase] = useState(null);
  const [createExaminationModalOpen, setCreateExaminationModalOpen] = useState(false);
  const [selectedCaseForExamination, setSelectedCaseForExamination] = useState(null);

  const [pageInput, setPageInput] = useState(String(currentPage));
  const [pageSizeInput, setPageSizeInput] = useState(String(pageSize));

  const [showAllSensitive, setShowAllSensitive] = useState(false);
  const [sensitiveInfoMap, setSensitiveInfoMap] = useState({});
  const [loadingAllSensitive, setLoadingAllSensitive] = useState(false);

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

  const maskName = (name) => {
    if (!name) return '-';
    if (name.length === 1) return '*';
    return name[0] + '*'.repeat(name.length - 1);
  };

  const triggerFilterChange = (keywordValue = searchTerm, dateValue = dateRange) => {
    if (!onFilterChange) return;

    onFilterChange({
      keyword: keywordValue.trim(),
      searchType: 'caseNumber',
      startDate: dateValue.from,
      endDate: dateValue.to
    });
  };

  // 同步外部筛选条件。
  // 注意：输入框聚焦时，不允许父组件刷新回来的 filters 覆盖 searchTerm，否则光标会丢。
  useEffect(() => {
    if (!isSearchFocusedRef.current) {
      setSearchTerm(externalFilters.keyword || externalFilters.caseNumber || '');
    }

    setDateRange({
      from: externalFilters.startDate || '',
      to: externalFilters.endDate || ''
    });
  }, [
    externalFilters.keyword,
    externalFilters.caseNumber,
    externalFilters.startDate,
    externalFilters.endDate
  ]);

  // 实时搜索：输入停止 300ms 后自动刷新
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerFilterChange(searchTerm, dateRange);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, dateRange.from, dateRange.to]);

  // 数据刷新后，如果输入框本来在聚焦，就重新聚焦并恢复光标位置
  useEffect(() => {
    if (!isSearchFocusedRef.current) return;
    if (!searchInputRef.current) return;

    searchInputRef.current.focus();

    const position = caretPositionRef.current;

    if (position !== null && position !== undefined) {
      const safePosition = Math.min(position, searchInputRef.current.value.length);
      searchInputRef.current.setSelectionRange(safePosition, safePosition);
    }
  }, [searchTerm, cases]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  // 换页 / 改页大小 / 数据刷新后，默认重新隐藏明文
  useEffect(() => {
    setShowAllSensitive(false);
  }, [currentPage, pageSize, cases]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearchInputChange = (e) => {
    caretPositionRef.current = e.target.selectionStart;
    setSearchTerm(e.target.value);
  };

  const handleSearchInputFocus = (e) => {
    isSearchFocusedRef.current = true;
    caretPositionRef.current = e.target.selectionStart;
  };

  const handleSearchInputBlur = () => {
    isSearchFocusedRef.current = false;
    caretPositionRef.current = null;
  };

  const handleDateRangeChange = (e) => {
    const newDateRange = {
      ...dateRange,
      [e.target.name]: e.target.value
    };

    setDateRange(newDateRange);
  };

  const handleClearFilters = () => {
    const emptyDateRange = { from: '', to: '' };

    caretPositionRef.current = 0;
    setSearchTerm('');
    setDateRange(emptyDateRange);

    if (onFilterChange) {
      onFilterChange({
        keyword: '',
        searchType: 'caseNumber',
        startDate: '',
        endDate: ''
      });
    }
  };

  const handleCreateExamination = (caseItem, e) => {
    if (e) e.stopPropagation();
    setSelectedCaseForExamination(caseItem);
    setCreateExaminationModalOpen(true);
  };

  const handleDelete = (caseItem, e) => {
    if (e) e.stopPropagation();
    setDeletingCase(caseItem);
    setConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCase) return;

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/cases/${deletingCase.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.code === 0) {
        showNotice('删除成功', 'success');
        setConfirmModalOpen(false);
        setDeletingCase(null);

        if (onRefresh) onRefresh();
      } else {
        showNotice('删除失败：' + result.message, 'error');
      }
    } catch (error) {
      showNotice('删除失败：' + error.message, 'error');
    }
  };

  const handleCancelDelete = () => {
    setConfirmModalOpen(false);
    setDeletingCase(null);
  };

  const parseApiResult = async (response) => {
    let result = null;

    try {
      result = await response.json();
    } catch (error) {
      result = null;
    }

    if (!response.ok) {
      const err = new Error(result?.message || `请求失败，状态码：${response.status}`);
      err.status = response.status;
      throw err;
    }

    if (
      result &&
      result.code !== undefined &&
      result.code !== 0 &&
      result.code !== 200 &&
      result.data === undefined
    ) {
      throw new Error(result.message || '请求失败');
    }

    return result?.data ?? result;
  };

  const fetchSensitiveInfoSingle = async (caseId) => {
    const token = localStorage.getItem('token');

    const response = await fetch(`/api/cases/${caseId}/sensitive-info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await parseApiResult(response);

    return {
      caseId,
      patientName: data?.patientName,
      patientIdDeidentified: data?.patientIdDeidentified
    };
  };

  const handleToggleAllSensitive = async () => {
    if (showAllSensitive) {
      setShowAllSensitive(false);
      return;
    }

    const caseIds = cases
      .map(item => item.id)
      .filter(id => id !== null && id !== undefined);

    if (caseIds.length === 0) {
      showNotice('当前没有病例数据', 'info');
      return;
    }

    const needFetchIds = caseIds.filter(id => {
      const cached = sensitiveInfoMap[id];
      return !cached?.patientName && !cached?.patientIdDeidentified;
    });

    try {
      setLoadingAllSensitive(true);

      if (needFetchIds.length > 0) {
        const fetchedList = await Promise.all(
          needFetchIds.map(caseId => fetchSensitiveInfoSingle(caseId))
        );

        setSensitiveInfoMap(prev => {
          const next = { ...prev };

          fetchedList.forEach(item => {
            if (!item.caseId) return;

            next[item.caseId] = {
              patientName: item.patientName,
              patientIdDeidentified: item.patientIdDeidentified
            };
          });

          return next;
        });
      }

      setShowAllSensitive(true);
    } catch (error) {
      showNotice('显示明文失败：' + error.message, 'error');
    } finally {
      setLoadingAllSensitive(false);
    }
  };

  const getDisplayPatientName = (item) => {
    if (showAllSensitive) {
      return sensitiveInfoMap[item.id]?.patientName || item.patientNameMasked || maskName(item.patientName);
    }

    return item.patientNameMasked || maskName(item.patientName);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';

    const date = new Date(dateStr);

    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const goToPage = (page) => {
    const safePage = Math.min(Math.max(1, page), totalPages);

    if (onPageChange) {
      onPageChange(safePage);
    }
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

    if (onPageChange) {
      onPageChange(safePage);
    }
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

    if (onPageSizeChange) {
      onPageSizeChange(value);
    }
  };

  return (
    <div className="cases-table-container">
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="table-header">
        <h3 className="section-title">病例列表</h3>

        <div className="table-header-actions">
          <button
            className="show-sensitive-all-btn"
            onClick={handleToggleAllSensitive}
            disabled={loadingAllSensitive || cases.length === 0}
          >
            {loadingAllSensitive
              ? '加载中...'
              : showAllSensitive
                ? '隐藏明文'
                : '显示本页明文'}
          </button>

          <button className="clear-filter-btn" onClick={handleClearFilters}>
            清除筛选
          </button>
        </div>
      </div>

      <div className="search-bar">
        <div className="search-input-wrapper">
          <span className="search-input-label">病例号：</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="输入病例编号..."
            className="search-input"
            value={searchTerm}
            onChange={handleSearchInputChange}
            onFocus={handleSearchInputFocus}
            onBlur={handleSearchInputBlur}
          />
        </div>

        <div className="date-range">
          <input
            type="date"
            name="from"
            placeholder="开始日期"
            value={dateRange.from}
            onChange={handleDateRangeChange}
          />
          <span>至</span>
          <input
            type="date"
            name="to"
            placeholder="结束日期"
            value={dateRange.to}
            onChange={handleDateRangeChange}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="cases-table">
          <thead>
            <tr>
              <th>病例号</th>
              <th>病人姓名</th>
              <th>上传时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {cases.length > 0 ? (
              cases.map((item) => (
                <tr key={item.id}>
                  <td className="case-number">{item.caseNumber || item.id}</td>

                  <td>
                    <span className={showAllSensitive ? 'sensitive-value-visible' : 'sensitive-value-masked'}>
                      {getDisplayPatientName(item)}
                    </span>
                  </td>

                  <td>{formatDate(item.createdAt)}</td>

                  <td className="actions-cell">
                    <div className="btn-row">
                      <button
                        className="action-btn create-examination"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/cases/${item.id}`);
                        }}
                      >
                        查看病例
                      </button>

                      <button
                        className="action-btn delete"
                        onClick={(e) => handleDelete(item, e)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="no-data">
                  暂无病例数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
            <strong>{total}</strong>
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

      <ConfirmModal
        isOpen={confirmModalOpen}
        title="确认删除"
        message={`确定要删除病例【${deletingCase?.caseNumber || deletingCase?.id}】吗？此操作不可恢复！`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <CreateExaminationModal
        isOpen={createExaminationModalOpen}
        caseItem={selectedCaseForExamination}
        onClose={() => {
          setCreateExaminationModalOpen(false);
          setSelectedCaseForExamination(null);
        }}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};

export default CasesTable;