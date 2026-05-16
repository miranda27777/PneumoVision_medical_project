import React, { useState } from 'react';
import './NewCaseModal.css';

const NewCaseModal = ({ isOpen, onClose, onRefresh }) => {
  const [formData, setFormData] = useState({
    caseNumber: '',           // 病例号
    patientName: '',          // 病人姓名
    patientIdDeidentified: '', // 病人编号 - 修正字段名
    gender: '',               // 性别
    age: '',                  // 年龄
    remark: ''                // 描述 - 修正字段名
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 验证必填项
    if (!formData.caseNumber.trim()) {
      alert('请输入病例号');
      return;
    }
    if (!formData.patientName.trim()) {
      alert('请输入病人姓名');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      // 构建与后端匹配的请求体
      const requestBody = {
        caseNumber: formData.caseNumber.trim(),
        patientName: formData.patientName.trim(),
        patientIdDeidentified: formData.patientIdDeidentified?.trim() || '',
        gender: formData.gender || '',
        age: formData.age ? parseInt(formData.age, 10) : null,
        remark: formData.remark?.trim() || ''
      };

      console.log('发送到后端的数据:', requestBody);

      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      console.log('后端返回:', result);

      if (result.code === 0) {
        alert('病例创建成功！');
        onClose();
        // 重置表单
        setFormData({
          caseNumber: '',
          patientName: '',
          patientIdDeidentified: '',
          gender: '',
          age: '',
          remark: ''
        });
        // 刷新列表
        if (onRefresh) onRefresh();
        // 跳转到病例详情页
        if (result.data?.id) {
          window.location.href = `/cases/${result.data.id}`;
        }
      } else {
        alert('创建失败：' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('创建失败:', error);
      alert('创建失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>新建病例</h3>
          <button className="close-btn" onClick={onClose} disabled={loading}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>病例号 <span className="required">*</span></label>
            <input
              type="text"
              name="caseNumber"
              value={formData.caseNumber}
              onChange={handleChange}
              placeholder="请输入病例号"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>病人姓名 <span className="required">*</span></label>
            <input
              type="text"
              name="patientName"
              value={formData.patientName}
              onChange={handleChange}
              placeholder="请输入病人姓名"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>病人编号</label>
            <input
              type="text"
              name="patientIdDeidentified"
              value={formData.patientIdDeidentified}
              onChange={handleChange}
              placeholder="请输入病人编号（选填）"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>性别</label>
              <select name="gender" value={formData.gender} onChange={handleChange} disabled={loading}>
                <option value="">未知</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>年龄</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="请输入年龄（选填）"
                min="0"
                max="150"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>描述</label>
            <textarea
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              placeholder="请输入病例描述（选填）"
              rows="3"
              disabled={loading}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCaseModal;