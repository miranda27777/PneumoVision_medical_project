import React from 'react'
import './Header.css'
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const username = params.get('username');

if (token) {
  localStorage.setItem('token', token);
}
if (username) {
  localStorage.setItem('researcherName', username);
}

const Header = ({ title }) => {
  const researcherName = localStorage.getItem('researcherName') || '管理员'

  return (
    <header className="researcher-header">
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
            <span className="avatar-text">{researcherName?.charAt(0) || '科'}</span>
          </div>
          <div className="user-info">
            <span className="user-name">{researcherName}</span>
            <span className="user-role">科研人员</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header