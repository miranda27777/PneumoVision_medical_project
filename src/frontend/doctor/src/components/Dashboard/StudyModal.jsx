import React, { useState, useEffect } from 'react';
import TopNotice from '../common/TopNotice';
import './StudyModal.css';

const StudyModal = ({ isOpen, study, caseId, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    studyTime: '',
    modality: 'DX',
    description: ''
  });

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
    if (study) {
      setFormData({
        studyTime: study.studyTime ? study.studyTime.slice(0, 16) : '',
        modality: study.modality || 'DX',
        description: study.description || ''
      });
    } else {
      const now = new Date();
      const defaultTime = now.toISOString().slice(0, 16);
      setFormData({
        studyTime: defaultTime,
        modality: 'DX',
        description: ''
      });
    }
  }, [study]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.studyTime) {
      showNotice('请填写检查时间', 'error');
      return;
    }
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="study-modal-overlay">
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="study-modal-content">
        <div className="study-modal-header">
          <h3>{study ? '编辑检查' : '新建检查'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className='damnForm'>
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
            <select
              name="modality"
              value={formData.modality}
              onChange={handleChange}
              required
            >
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

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary">
              {study ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudyModal;