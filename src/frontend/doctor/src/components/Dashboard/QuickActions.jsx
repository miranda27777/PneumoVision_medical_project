import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesApi } from '../../api';
import TopNotice from '../common/TopNotice';
import './QuickActions.css';

const initialCaseForm = {
  caseNumber: '',
  patientName: '',
  patientIdDeidentified: '',
  gender: '',
  age: '',
  remark: ''
};

const initialDicomForm = {
  caseNumber: '',
  patientName: '',
  patientIdDeidentified: '',
  gender: '',
  age: '',
  caseDescription: '',
  studyDate: '',
  studyTime: '',
  modality: '',
  studyDescription: '',
  patientCaseId: ''
};

const QuickActions = ({ onRefresh, cases = [] }) => {
  const navigate = useNavigate();

  const dicomExportInputRef = useRef(null);
  const dicomImportInputRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialCaseForm);
  const [loading, setLoading] = useState(false);

  const [dicomImportOpen, setDicomImportOpen] = useState(false);
  const [dicomFile, setDicomFile] = useState(null);
  const [dicomParsed, setDicomParsed] = useState(null);
  const [dicomForm, setDicomForm] = useState(initialDicomForm);
  const [dicomMode, setDicomMode] = useState('create');
  const [dicomParsing, setDicomParsing] = useState(false);
  const [dicomImporting, setDicomImporting] = useState(false);
  const [dicomExporting, setDicomExporting] = useState(false);

  const [noticeVisible, setNoticeVisible] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeType, setNoticeType] = useState('info');

  const showNotice = (message, type = 'info') => {
    setNoticeMessage(message);
    setNoticeType(type);
    setNoticeVisible(true);
  };

  const closeNotice = () => {
    setNoticeVisible(false);
    setNoticeMessage('');
  };

  const resetForm = () => {
    setFormData(initialCaseForm);
  };

  const resetDicomImport = () => {
    setDicomFile(null);
    setDicomParsed(null);
    setDicomForm(initialDicomForm);
    setDicomMode('create');

    if (dicomImportInputRef.current) {
      dicomImportInputRef.current.value = '';
    }
  };

  const getToken = () => localStorage.getItem('token');

  const readErrorMessage = async (response, defaultMessage = '请求失败') => {
    try {
      const data = await response.clone().json();
      return data?.message || defaultMessage;
    } catch (e) {
      try {
        const text = await response.text();
        return text || defaultMessage;
      } catch (ignore) {
        return defaultMessage;
      }
    }
  };

  const normalizeTimeForInput = (value) => {
    if (!value) return '';
    const str = String(value);
    if (str.length >= 5) {
      return str.slice(0, 5);
    }
    return str;
  };

  const removeExtension = (fileName) => {
    if (!fileName) return 'dicom-export';
    const index = fileName.lastIndexOf('.');
    if (index <= 0) return fileName;
    return fileName.slice(0, index);
  };

  const getDownloadFileName = (contentDisposition, fallbackName) => {
    if (!contentDisposition) return fallbackName;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch (e) {
        return utf8Match[1];
      }
    }

    const normalMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    if (normalMatch && normalMatch[1]) {
      return normalMatch[1];
    }

    return fallbackName;
  };

  const downloadBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const buildQueryString = (params) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        query.append(key, String(value).trim());
      }
    });

    const text = query.toString();
    return text ? `?${text}` : '';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDicomInputChange = (e) => {
    const { name, value } = e.target;
    setDicomForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleExistingCaseSelect = (e) => {
    const value = e.target.value;
    const selected = cases.find(item => String(item.id) === String(value));

    setDicomForm(prev => ({
      ...prev,
      patientCaseId: value,
      patientName: selected?.patientName || prev.patientName,
      patientIdDeidentified: selected?.patientIdDeidentified || prev.patientIdDeidentified
    }));
  };

  const handleSubmit = async () => {
    if (!formData.caseNumber) {
      showNotice('请输入病例号', 'error');
      return;
    }

    if (!formData.patientName) {
      showNotice('请输入病人姓名', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await casesApi.createCase({
        caseNumber: formData.caseNumber,
        patientName: formData.patientName,
        patientIdDeidentified: formData.patientIdDeidentified || null,
        gender: formData.gender || null,
        age: formData.age ? parseInt(formData.age, 10) : null,
        remark: formData.remark || null
      });

      if (response.code === 0) {
        const newCaseId = response?.data?.id;

        showNotice('病例创建成功！', 'success');
        setShowModal(false);
        resetForm();

        if (onRefresh) onRefresh();

        if (newCaseId) {
          navigate(`/cases/${newCaseId}`);
        }
      } else {
        showNotice(`创建失败：${response.message}`, 'error');
      }
    } catch (error) {
      showNotice(`创建失败：${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportButtonClick = () => {
    if (dicomExporting) return;
    dicomExportInputRef.current?.click();
  };

  const handleExportFileChange = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.dcm')) {
      showNotice('请选择 .dcm 格式的 DICOM 文件', 'error');
      e.target.value = '';
      return;
    }

    setDicomExporting(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const response = await fetch('/api/dicom/export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        },
        body: fd
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, 'DICOM 解析导出失败');
        throw new Error(message);
      }

      const blob = await response.blob();
      const fallbackName = `${removeExtension(file.name)}.zip`;
      const fileName = getDownloadFileName(
        response.headers.get('Content-Disposition'),
        fallbackName
      );

      downloadBlob(blob, fileName);
      showNotice('DICOM 解析导出成功，文件已开始下载', 'success');
    } catch (error) {
      showNotice(`DICOM 解析导出失败：${error.message}`, 'error');
    } finally {
      setDicomExporting(false);
      e.target.value = '';
    }
  };

  const handleOpenDicomImport = () => {
    resetDicomImport();
    setDicomImportOpen(true);
  };

  const handleDicomImportFileChange = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.dcm')) {
      showNotice('请选择 .dcm 格式的 DICOM 文件', 'error');
      e.target.value = '';
      return;
    }

    setDicomFile(file);
    setDicomParsed(null);
    setDicomParsing(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const response = await fetch('/api/dicom/parse', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        },
        body: fd
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.message || 'DICOM 解析失败');
      }

      const parsed = result.data || {};
      setDicomParsed(parsed);

      setDicomForm(prev => ({
        ...prev,
        patientName: parsed.patientName || '',
        patientIdDeidentified: parsed.patientId || '',
        gender: parsed.sex || '',
        age: parsed.age !== null && parsed.age !== undefined ? String(parsed.age) : '',
        studyDate: parsed.studyDate || '',
        studyTime: normalizeTimeForInput(parsed.studyTime),
        modality: parsed.modality || 'CR',
        studyDescription: ''
      }));

      const missing = parsed.missingFields || [];
      if (missing.length > 0) {
        showNotice('DICOM 解析成功，部分字段缺失，请补充后确认导入', 'info');
      } else {
        showNotice('DICOM 解析成功，请确认信息后导入', 'success');
      }
    } catch (error) {
      showNotice(`DICOM 解析失败：${error.message}`, 'error');
    } finally {
      setDicomParsing(false);
    }
  };

  const validateDicomImport = () => {
    if (!dicomFile) {
      showNotice('请先选择 DICOM 文件', 'error');
      return false;
    }

    if (dicomMode === 'attach') {
      if (!dicomForm.patientCaseId) {
        showNotice('请选择或输入要挂载的病例ID', 'error');
        return false;
      }
    } else {
      if (!dicomForm.patientName) {
        showNotice('请填写病人姓名', 'error');
        return false;
      }
      
    }

    if (!dicomForm.studyDate) {
      showNotice('请填写检查日期', 'error');
      return false;
    }

    if (!dicomForm.studyTime) {
      showNotice('请填写检查时间', 'error');
      return false;
    }

    if (!dicomForm.modality) {
      showNotice('请填写检查模态', 'error');
      return false;
    }

    return true;
  };

  const handleConfirmDicomImport = async () => {
    if (!validateDicomImport()) return;

    setDicomImporting(true);

    try {
      const fileFormData = new FormData();
      fileFormData.append('file', dicomFile);

      const commonParams = {
        studyDate: dicomForm.studyDate,
        studyTime: dicomForm.studyTime,
        modality: dicomForm.modality,
        studyDescription: dicomForm.studyDescription
      };

      const params = dicomMode === 'attach'
        ? {
            ...commonParams,
            patientCaseId: dicomForm.patientCaseId
          }
        : {
            ...commonParams,
            caseNumber: dicomForm.caseNumber,
            patientName: dicomForm.patientName,
            patientIdDeidentified: dicomForm.patientIdDeidentified,
            gender: dicomForm.gender,
            age: dicomForm.age,
            caseDescription: dicomForm.caseDescription
          };

      const response = await fetch(`/api/dicom/import${buildQueryString(params)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        },
        body: fileFormData
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.message || 'DICOM 智能导入失败');
      }

      const newCaseId = result?.data?.patientCaseId;

      showNotice('DICOM 智能导入成功，已创建检查并保存影像', 'success');
      setDicomImportOpen(false);
      resetDicomImport();

      if (onRefresh) onRefresh();

      if (newCaseId) {
        navigate(`/cases/${newCaseId}`);
      }
    } catch (error) {
      showNotice(`DICOM 智能导入失败：${error.message}`, 'error');
    } finally {
      setDicomImporting(false);
    }
  };

  const handleCloseDicomImport = () => {
    if (dicomImporting || dicomParsing) return;
    setDicomImportOpen(false);
    resetDicomImport();
  };

  return (
    <>
      <TopNotice
        visible={noticeVisible}
        message={noticeMessage}
        type={noticeType}
        onClose={closeNotice}
      />

      <input
        ref={dicomExportInputRef}
        type="file"
        accept=".dcm,application/dicom"
        className="hidden-file-input"
        onChange={handleExportFileChange}
      />

      <div className="quick-actions">
        <h3 className="section-title">快捷操作</h3>

        <div className="actions-grid">
          <button className="quick-action-btn primary" onClick={() => setShowModal(true)}>
            <span className="quick-action-icon">📋</span>
            <span className="quick-action-text">新建病例</span>
          </button>

          <button
            className="quick-action-btn dicom-export"
            onClick={handleExportButtonClick}
            disabled={dicomExporting}
          >
            <span className="quick-action-icon">🧾</span>
            <span className="quick-action-text">
              {dicomExporting ? '解析中...' : 'DICOM解析导出'}
            </span>
          </button>

          <button
            className="quick-action-btn dicom-import"
            onClick={handleOpenDicomImport}
          >
            <span className="quick-action-icon">🧠</span>
            <span className="quick-action-text">DICOM智能建档</span>
          </button>
        </div>

        {showModal && (
          <div className="qa-modal-overlay">
            <div className="qa-modal-content">
              <h3>新建病例</h3>

              <div className="qa-form-group">
                <label>病例号 <span className="required">*</span></label>
                <input
                  type="text"
                  name="caseNumber"
                  placeholder="请输入病例号"
                  value={formData.caseNumber}
                  onChange={handleInputChange}
                />
              </div>

              <div className="qa-form-group">
                <label>病人姓名 <span className="required">*</span></label>
                <input
                  type="text"
                  name="patientName"
                  placeholder="请输入病人姓名"
                  value={formData.patientName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="qa-form-group">
                <label>病人编号</label>
                <input
                  type="text"
                  name="patientIdDeidentified"
                  placeholder="请输入病人编号（选填）"
                  value={formData.patientIdDeidentified}
                  onChange={handleInputChange}
                />
              </div>

              <div className="qa-form-row">
                <div className="qa-form-group half">
                  <label>性别</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange}>
                    <option value="">未知</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>

                <div className="qa-form-group half">
                  <label>年龄</label>
                  <input
                    type="number"
                    name="age"
                    placeholder="请输入年龄（选填）"
                    value={formData.age}
                    onChange={handleInputChange}
                    min="0"
                    max="150"
                  />
                </div>
              </div>

              <div className="qa-form-group">
                <label>描述</label>
                <textarea
                  name="remark"
                  placeholder="请输入病例描述（选填）"
                  value={formData.remark}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>

              <div className="qa-modal-actions">
                <button className="qa-btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button className="qa-btn-primary" onClick={handleSubmit} disabled={loading}>
                  {loading ? '创建中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {dicomImportOpen && (
          <div className="qa-modal-overlay">
            <div className="qa-modal-content dicom-modal-content">
              <div className="dicom-modal-header">
                <h3>DICOM智能建档</h3>
                <button
                  type="button"
                  className="dicom-modal-close"
                  onClick={handleCloseDicomImport}
                  disabled={dicomParsing || dicomImporting}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>

              <div className="dicom-upload-box">
                <div className="dicom-upload-info">
                  <div className="dicom-upload-title">上传 DICOM 文件</div>
                  <div className="dicom-upload-desc">
                    系统会解析患者信息、检查时间和模态，并在确认后自动创建检查与影像记录。
                  </div>
                  {dicomFile && (
                    <div className="dicom-file-name">
                      已选择：{dicomFile.name}
                    </div>
                  )}
                </div>

                <button
                  className="dicom-select-btn"
                  onClick={() => dicomImportInputRef.current?.click()}
                  disabled={dicomParsing || dicomImporting}
                >
                  {dicomParsing ? '解析中...' : '选择DCM文件'}
                </button>

                <input
                  ref={dicomImportInputRef}
                  type="file"
                  accept=".dcm,application/dicom"
                  className="hidden-file-input"
                  onChange={handleDicomImportFileChange}
                />
              </div>

              {dicomParsed && (
                <div className="dicom-parse-summary">
                  <div className="dicom-summary-title">解析结果</div>
                  <div className="dicom-summary-grid">
                    <span>患者姓名：{dicomParsed.patientName || '未解析到'}</span>
                    <span>患者ID：{dicomParsed.patientId || '未解析到'}</span>
                    <span>性别：{dicomParsed.sex || '未解析到'}</span>
                    <span>年龄：{dicomParsed.age ?? '未解析到'}</span>
                    <span>检查日期：{dicomParsed.studyDate || '未解析到'}</span>
                    <span>检查时间：{dicomParsed.studyTime || '未解析到'}</span>
                    <span>模态：{dicomParsed.modality || '未解析到'}</span>
                    <span>字符集：{dicomParsed.specificCharacterSet || '默认'}</span>
                  </div>

                  {dicomParsed.missingFields?.length > 0 && (
                    <div className="missing-fields">
                      缺失字段：
                      {dicomParsed.missingFields.map(field => (
                        <span key={field} className="missing-tag">{field}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="dicom-mode-tabs">
                <button
                  className={`dicom-mode-tab ${dicomMode === 'create' ? 'active' : ''}`}
                  onClick={() => setDicomMode('create')}
                  type="button"
                >
                  新建病例
                </button>
                <button
                  className={`dicom-mode-tab ${dicomMode === 'attach' ? 'active' : ''}`}
                  onClick={() => setDicomMode('attach')}
                  type="button"
                >
                  挂载已有病例
                </button>
              </div>

              {dicomMode === 'attach' ? (
                <>
                  <div className="qa-form-group">
                    <label>选择已有病例</label>
                    <select
                      value={dicomForm.patientCaseId}
                      onChange={handleExistingCaseSelect}
                    >
                      <option value="">请选择当前列表中的病例</option>
                      {cases.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.caseNumber || item.id} - {item.patientName || '未命名患者'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="qa-form-group">
                    <label>病例ID <span className="required">*</span></label>
                    <input
                      type="number"
                      name="patientCaseId"
                      placeholder="如果下拉框没有目标病例，可手动输入病例ID"
                      value={dicomForm.patientCaseId}
                      onChange={handleDicomInputChange}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="qa-form-group">
                    <label>病例号</label>
                    <input
                      type="text"
                      name="caseNumber"
                      placeholder="不填则自动生成"
                      value={dicomForm.caseNumber}
                      onChange={handleDicomInputChange}
                    />
                  </div>

                  <div className="qa-form-group">
                    <label>病人姓名 <span className="required">*</span></label>
                    <input
                      type="text"
                      name="patientName"
                      placeholder="请输入病人姓名"
                      value={dicomForm.patientName}
                      onChange={handleDicomInputChange}
                    />
                  </div>

                  <div className="qa-form-group">
                    <label>病人编号 </label>
                    <input
                      type="text"
                      name="patientIdDeidentified"
                      placeholder="请输入病人编号（选填）"
                      value={dicomForm.patientIdDeidentified}
                      onChange={handleDicomInputChange}
                    />
                  </div>

                  <div className="qa-form-row">
                    <div className="qa-form-group half">
                      <label>性别</label>
                      <select
                        name="gender"
                        value={dicomForm.gender}
                        onChange={handleDicomInputChange}
                      >
                        <option value="">未知</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                      </select>
                    </div>

                    <div className="qa-form-group half">
                      <label>年龄</label>
                      <input
                        type="number"
                        name="age"
                        placeholder="请输入年龄（选填）"
                        value={dicomForm.age}
                        onChange={handleDicomInputChange}
                        min="0"
                        max="150"
                      />
                    </div>
                  </div>

                  <div className="qa-form-group">
                    <label>病例描述</label>
                    <textarea
                      name="caseDescription"
                      placeholder="请输入病例描述（选填）"
                      value={dicomForm.caseDescription}
                      onChange={handleDicomInputChange}
                      rows="3"
                    />
                  </div>
                </>
              )}

              <div className="dicom-section-divider">检查信息</div>

              <div className="qa-form-row">
                <div className="qa-form-group half">
                  <label>检查日期 <span className="required">*</span></label>
                  <input
                    type="date"
                    name="studyDate"
                    value={dicomForm.studyDate}
                    onChange={handleDicomInputChange}
                  />
                </div>

                <div className="qa-form-group half">
                  <label>检查时间 <span className="required">*</span></label>
                  <input
                    type="time"
                    name="studyTime"
                    value={dicomForm.studyTime}
                    onChange={handleDicomInputChange}
                  />
                </div>
              </div>

              <div className="qa-form-group">
                <label>模态 <span className="required">*</span></label>
                <select
                  name="modality"
                  value={dicomForm.modality}
                  onChange={handleDicomInputChange}
                >
                  <option value="">请选择模态</option>
                  <option value="DX">DX</option>
                  <option value="CR">CR</option>
                </select>
              </div>

              <div className="qa-form-group">
                <label>检查描述</label>
                <textarea
                  name="studyDescription"
                  placeholder="请输入检查描述（选填）"
                  value={dicomForm.studyDescription}
                  onChange={handleDicomInputChange}
                  rows="3"
                />
              </div>

              <div className="qa-modal-actions dicom-confirm-actions">
                <button
                  className="qa-btn-primary"
                  onClick={handleConfirmDicomImport}
                  disabled={dicomParsing || dicomImporting || !dicomFile}
                >
                  {dicomImporting ? '导入中...' : '确认导入'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QuickActions;