import React from 'react'
import './ConfidenceBar.css'

const ConfidenceBar = ({ value }) => {
  const getColorClass = () => {
    if (value >= 90) return 'high'
    if (value >= 75) return 'medium'
    return 'low'
  }

  return (
    <div className="confidence-container">
      <div className="confidence-bar">
        <div 
          className={`confidence-fill ${getColorClass()}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="confidence-value">{value}%</span>
    </div>
  )
}

export default ConfidenceBar