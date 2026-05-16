import React, { useState, useEffect } from 'react';
import TopNotice from '../common/TopNotice';
import './CreateExaminationModal.css';

const CreateExaminationModal = ({ isOpen, caseItem, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    studyTime: '',
    modality: 'DX',
    description: ''
  });
  const [creating, setCreating] = useState(false);

  // TopNotice 状态
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

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const defaultTime = beijingTime.toISOString().slice(0, 16);
      setFormData({
        studyTime: defaultTime,
        modality: 'DX',
        description: ''
      });
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.studyTime) {
      showNotice('请填写检查时间', 'error');
      return;
    }

    setCreating(true);
    try {
      const studyDateTime = new Date(formData.studyTime);
      const beijingTime = new Date(studyDateTime.getTime() + 8 * 60 * 60 * 1000);
      
      const response = await fetch(`/api/cases/${caseItem.id}/studies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          studyTime: beijingTime.toISOString(),
          modality: formData.modality,
          description: formData.description
        })
      });
      const result = await response.json();

      if (result.code === 0) {
        showNotice('检查创建成功！', 'success');
        if (onSuccess) onSuccess(result);
        onClose();
      } else {
        showNotice('创建检查失败：' + result.message, 'error');
      }
    } catch (error) {
      console.error('创建检查失败:', error);
      showNotice('创建检查失败：' + error.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="create-examination-modal-overlay" onClick={handleCancel}>
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="create-examination-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="create-examination-modal-header">
          <h3>创建检查 - {caseItem?.caseNumber}</h3>
          <button className="close-btn" onClick={handleCancel}>✕</button>
        </div>

        <div className="create-examination-modal-body">
          <div className="form-section">
            <h4>检查信息</h4>
            <div className="form-group">
              <label>检查时间 <span className="required">*</span></label>
              <input
                type="datetime-local"
                name="studyTime"
                value={formData.studyTime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>模态 <span className="required">*</span></label>
              <select name="modality" value={formData.modality} onChange={handleChange} required>
                <option value="DX">DX（数字X光）</option>
                <option value="CR">CR（计算机X光）</option>
              </select>
            </div>

            <div className="form-group">
              <label>描述</label>
              <textarea
                name="description"
                placeholder="请输入检查描述（选填）"
                value={formData.description}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>
        </div>

        <div className="create-examination-modal-footer">
          <button className="cancel-btn" onClick={handleCancel}>取消</button>
          <button className="submit-btn" onClick={handleSubmit} disabled={creating}>
            {creating ? '创建中...' : '创建检查'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateExaminationModal;