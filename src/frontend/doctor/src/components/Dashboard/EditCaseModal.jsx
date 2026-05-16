import React, { useState, useEffect } from 'react';
import TopNotice from '../common/TopNotice';
import './EditCaseModal.css';

const EditCaseModal = ({ isOpen, caseData, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    caseNumber: '',
    patientName: '',
    patientId: '',
    gender: '',
    age: '',
    description: ''
  });

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

  const fetchSensitiveInfo = async (caseId) => {
    const response = await fetch(`/api/cases/${caseId}/sensitive-info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    const result = await response.json();

    if (result.code === 0 && result.data) {
      return {
        patientName: result.data.patientName || '',
        patientIdDeidentified: result.data.patientIdDeidentified || result.data.patientId || ''
      };
    }

    throw new Error(result.message || '获取患者明文信息失败');
  };

  useEffect(() => {
    let active = true;

    const initForm = async () => {
      if (!isOpen || !caseData) {
        return;
      }

      setNotice({
        visible: false,
        message: '',
        type: 'info'
      });

      // 基础非敏感字段先回显；敏感字段必须走 sensitive-info 接口拿明文，不能用脱敏值填表单
      setFormData({
        caseNumber: caseData.caseNumber || '',
        patientName: '',
        patientId: '',
        gender: caseData.gender || '',
        age: caseData.age ?? '',
        description: caseData.remark || caseData.description || ''
      });

      if (!caseData.id) {
        return;
      }

      try {
        setLoadingSensitive(true);
        const sensitiveInfo = await fetchSensitiveInfo(caseData.id);

        if (!active) return;

        setFormData(prev => ({
          ...prev,
          patientName: sensitiveInfo.patientName || '',
          patientId: sensitiveInfo.patientIdDeidentified || ''
        }));
      } catch (error) {
        if (!active) return;
        showNotice('加载患者明文信息失败：' + error.message, 'error');
      } finally {
        if (active) {
          setLoadingSensitive(false);
        }
      }
    };

    initForm();

    return () => {
      active = false;
    };
  }, [isOpen, caseData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = () => {
    if (loadingSensitive) {
      showNotice('患者明文信息仍在加载中，请稍后再保存', 'error');
      return;
    }

    if (!formData.caseNumber) {
      showNotice('请输入病例号', 'error');
      return;
    }

    if (!formData.patientName) {
      showNotice('请输入病人姓名', 'error');
      return;
    }

    const submitData = {
      patientName: formData.patientName,
      patientIdDeidentified: formData.patientId || '',
      gender: formData.gender === '' ? null : formData.gender,
      age: formData.age ? parseInt(formData.age, 10) : null,
      remark: formData.description || ''
    };

    console.log('EditCaseModal 提交的数据:', submitData);
    onSave(submitData);
  };

  if (!isOpen) return null;

  return (
    <div className="edit-modal-overlay">
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="edit-modal-content">
        <div className="edit-modal-header">
          <h3>编辑病例 - {caseData?.caseNumber}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="edit-modal-body">
          <div className="form-group">
            <label>病例号</label>
            <input
              type="text"
              value={formData.caseNumber}
              disabled
              className="disabled-input"
            />
            <small className="hint-text">病例号不可修改</small>
          </div>

          <div className="form-group">
            <label>病人姓名 <span className="required">*</span></label>
            <input
              type="text"
              name="patientName"
              value={formData.patientName}
              onChange={handleChange}
              placeholder={loadingSensitive ? '正在加载明文姓名...' : '请输入病人姓名'}
              disabled={loadingSensitive}
            />
          </div>

          <div className="form-group">
            <label>病人编号</label>
            <input
              type="text"
              name="patientId"
              value={formData.patientId}
              onChange={handleChange}
              placeholder={loadingSensitive ? '正在加载明文编号...' : '请输入病人编号（选填）'}
              disabled={loadingSensitive}
            />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>性别</label>
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="">未知</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>

            <div className="form-group half">
              <label>年龄</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="请输入年龄（选填）"
                min="0"
                max="150"
              />
            </div>
          </div>

          <div className="form-group">
            <label>描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="请输入病例描述（选填）"
              rows="3"
            />
          </div>
        </div>

        <div className="edit-modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loadingSensitive}
          >
            {loadingSensitive ? '加载中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCaseModal;
