import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal-content">
        <div className="confirm-modal-header">
          <h3>{title || '确认操作'}</h3>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-btn-cancel" onClick={onCancel}>取消</button>
          <button className="confirm-btn-confirm" onClick={onConfirm}>确定</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;