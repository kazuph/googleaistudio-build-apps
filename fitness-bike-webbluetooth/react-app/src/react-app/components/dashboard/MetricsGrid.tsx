import React from 'react';
import { MetricCard } from './MetricCard';
import { SpeedCadenceCard } from './SpeedCadenceCard';
import { MetricData } from '../../types';

interface MetricsGridProps {
  metrics: MetricData;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <div className="data-grid">
      <SpeedCadenceCard 
        speed={metrics.speed} 
        cadence={metrics.cadence} 
      />
      
      <MetricCard
        title="消費カロリー"
        value={metrics.calories.toFixed(0)}
        unit="kcal"
        icon="🔥"
      />
      
      <MetricCard
        title="パワー"
        value={metrics.power.toFixed(0)}
        unit="W"
        icon="⚡"
      />
      
      <MetricCard
        title="セッション距離"
        value={formatDistance(metrics.sessionDistance)}
        icon="📏"
      />
      
      <MetricCard
        title="総距離"
        value={formatDistance(metrics.totalDistance)}
        icon="🏁"
      />
      
      <MetricCard
        title="時間"
        value={formatDuration(metrics.duration)}
        icon="⏱️"
      />
    </div>
  );
};