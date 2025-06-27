import React from 'react';

interface PowerBarProps {
  power: number;
  maxPower?: number;
}

export const PowerBar: React.FC<PowerBarProps> = ({ 
  power, 
  maxPower = 400 
}) => {
  const percentage = Math.min((power / maxPower) * 100, 100);
  
  const getColorClass = () => {
    if (percentage < 30) return 'low';
    if (percentage < 60) return 'medium';
    if (percentage < 80) return 'high';
    return 'max';
  };

  return (
    <div className="power-bar-section">
      <h3>🔥 パワー出力</h3>
      <div className="power-display">
        <span className="power-value">{power}</span>
        <span className="power-unit">W</span>
      </div>
      <div className="power-bar">
        <div 
          className={`power-bar-fill ${getColorClass()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="power-labels">
        <span>0W</span>
        <span>{maxPower}W</span>
      </div>
    </div>
  );
};