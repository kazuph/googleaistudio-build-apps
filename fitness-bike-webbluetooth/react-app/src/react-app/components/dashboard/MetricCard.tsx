import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: string;
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  onClick,
  className = '',
}) => {
  const cardClass = `metric-card ${className} ${onClick ? 'clickable' : ''}`;

  return (
    <div className={cardClass} onClick={onClick}>
      <div className="metric-header">
        {icon && <span className="metric-icon">{icon}</span>}
        <h3>{title}</h3>
      </div>
      <div className="metric-value">
        <span className="value">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
};