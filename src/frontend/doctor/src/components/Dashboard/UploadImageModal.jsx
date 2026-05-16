import React, { useState, useRef } from 'react';
import TopNotice from '../common/TopNotice';
import './UploadImageModal.css';

const UploadImageModal = ({ isOpen, caseItem, onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const fileInputRef = useRef(null);

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['.png', '.jpg', '.jpeg', '.dcm'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(fileExt)) {
      showNotice('请选择 PNG、JPG 或 DICOM 格式的图片', 'error');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showNotice('请先选择图片', 'error');
      return;
    }

    setUploading(true);
    try {
      const now = new Date();
      const studyResponse = await fetch(`/api/cases/${caseItem.id}/studies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          studyTime: now.toISOString(),
          modality: 'DX',
          description: `检查 ${now.toLocaleString()}`
        })
      });
      const studyResult = await studyResponse.json();

      if (studyResult.code === 0 && studyResult.data) {
        const studyId = studyResult.data.id;

        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadResponse = await fetch(`/api/images/upload?studyId=${studyId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        let uploadResult = null;
        try {
          uploadResult = await uploadResponse.json();
        } catch (e) {
          uploadResult = null;
        }

        if (uploadResponse.ok && uploadResult?.code === 0) {
          showNotice('上传成功！', 'success');
          if (onSuccess) onSuccess();
          onClose();
        } else {
          showNotice('上传失败：' + (uploadResult?.message || '未知错误'), 'error');
        }
      } else {
        showNotice('创建检查失败：' + (studyResult.message || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('上传失败:', error);
      showNotice('上传失败：' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="upload-modal-overlay" onClick={handleCancel}>
      <div className="upload-modal-content" onClick={(e) => e.stopPropagation()}>
        <TopNotice
          visible={notice.visible}
          message={notice.message}
          type={notice.type}
          onClose={closeNotice}
        />

        <div className="upload-modal-header">
          <h3>上传图像 - {caseItem?.caseNumber}</h3>
          <button className="close-btn" onClick={handleCancel}>✕</button>
        </div>

        <div className="upload-modal-body">
          <div className="upload-area" onClick={() => fileInputRef.current.click()}>
            <input
              type="file"
              ref={fileInputRef}
              accept=".png,.jpg,.jpeg,.dcm"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="预览" className="preview-image" />
            ) : (
              <div className="upload-placeholder">
                <span className="upload-icon">📤</span>
                <span>点击选择图片</span>
                <span className="file-hint">支持 PNG、JPG、DICOM 格式</span>
              </div>
            )}
          </div>
          {selectedFile && (
            <div className="file-info">
              已选择: {selectedFile.name}
            </div>
          )}
        </div>

        <div className="upload-modal-footer">
          <button className="cancel-btn" onClick={handleCancel}>取消</button>
          <button className="upload-btn" onClick={handleUpload} disabled={uploading}>
            {uploading ? '上传中...' : '上传'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadImageModal;