import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status }) => {
  const getStatusConfig = () => {
    switch(status) {
      case '已完成':
        return { className: 'completed', text: '✅ 已完成' };
      case '处理中':
        return { className: 'processing', text: '⏳ 处理中' };
      case '待处理':
        return { className: 'pending', text: '⏱️ 待处理' };
      default:
        return { className: 'pending', text: status };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`status-badge ${config.className}`}>
      {config.text}
    </span>
  );
};

export default StatusBadge;