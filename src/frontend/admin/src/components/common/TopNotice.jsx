import React, { useEffect } from 'react';
import './TopNotice.css';

const TopNotice = ({ visible, message, type = 'info', duration = 5000, onClose }) => {
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible || !message) return null;

  return (
    <div className="top-notice">
      <div className={`top-notice-title ${type === 'error' ? 'error' : ''}`}>
        系统提示：
      </div>
      <div className={`top-notice-message ${type === 'error' ? 'error' : ''}`}>
        {message}
      </div>
    </div>
  );
};

export default TopNotice;