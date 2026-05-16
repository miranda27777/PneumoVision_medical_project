import React from 'react'
import './Header.css'
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const username = params.get('username');

if (token) {
  localStorage.setItem('token', token);
}
if (username) {
  localStorage.setItem('adminName', username);
}

const Header = ({ title }) => {
  const adminName = localStorage.getItem('adminName') || '管理员'

  return (
    <header className="admin-header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-icon">🏥</span>
          <span className="logo-text">PneumoVision</span>
        </div>
        <span className="header-title">{title}</span>
      </div>
      
      <div className="header-right">
        <div className="user-profile">
          <div className="user-avatar">
            <span className="avatar-text">{adminName?.charAt(0) || '管'}</span>
          </div>
          <div className="user-info">
            <span className="user-name">{adminName}</span>
            <span className="user-role">系统管理员</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header