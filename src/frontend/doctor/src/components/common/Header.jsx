import React from 'react'
import './Header.css'
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const username = params.get('username');

if (token) {
  localStorage.setItem('token', token);
}
if (username) {
  localStorage.setItem('doctorName', username);
}

const Header = ({ title }) => {
  const doctorName = localStorage.getItem('doctorName') || '超声科医生'

  return (
    <header className="doctor-header">
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
            <span className="avatar-text">{doctorName?.charAt(0) || '超'}</span>
          </div>
          <div className="user-info">
            <span className="user-name">{doctorName}</span>
            <span className="user-role">超声科医生</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header