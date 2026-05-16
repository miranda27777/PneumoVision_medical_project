import React from 'react';

const LungsGraphic = ({ hasLesion, isHealthy }) => {
  const baseColor = isHealthy ? '#4ade80' : '#00f2ff';

  return (
    <div
      style={{ position: 'relative', width: '160px', height: '160px' }}
      className="lungs-breathe"
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <radialGradient id={`lungGlow-${isHealthy}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={baseColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={baseColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          d="M46,25 C25,25 15,45 18,75 C20,85 40,85 46,70 Z"
          fill={`url(#lungGlow-${isHealthy})`}
          stroke={baseColor}
          strokeWidth="2"
          style={{
            filter: `drop-shadow(0 0 8px ${baseColor})`,
            transition: 'all 0.8s ease',
          }}
        />

        <path
          d="M54,25 C75,25 85,45 82,75 C80,85 60,85 54,70 Z"
          fill={`url(#lungGlow-${isHealthy})`}
          stroke={baseColor}
          strokeWidth="2"
          style={{
            filter: `drop-shadow(0 0 8px ${baseColor})`,
            transition: 'all 0.8s ease',
          }}
        />

        <path
          d="M50,15 L50,30 M48,30 L52,30"
          stroke={baseColor}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
          style={{ transition: 'all 0.8s ease' }}
        />
      </svg>

      {hasLesion && (
        <div
          style={{
            position: 'absolute',
            top: '42px',
            right: '16px',
            width: '30px',
            height: '30px',
            border: '2px solid #ef4444',
            borderRadius: '50%',
            animation: 'pulseRing 1.5s infinite',
            boxShadow: '0 0 10px #ef4444',
          }}
        />
      )}
    </div>
  );
};

export default LungsGraphic;