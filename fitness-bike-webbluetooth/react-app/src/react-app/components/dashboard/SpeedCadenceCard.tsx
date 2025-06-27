import React, { useState } from 'react';
import { MetricCard } from './MetricCard';

interface SpeedCadenceCardProps {
  speed: number;
  cadence: number;
}

export const SpeedCadenceCard: React.FC<SpeedCadenceCardProps> = ({
  speed,
  cadence,
}) => {
  const [showSpeed, setShowSpeed] = useState(true);

  const toggleDisplay = () => {
    setShowSpeed(!showSpeed);
  };

  if (showSpeed) {
    return (
      <MetricCard
        title="速度"
        value={speed.toFixed(1)}
        unit="km/h"
        icon="🏃‍♂️"
        onClick={toggleDisplay}
        className="speed-cadence-toggle"
      />
    );
  }

  return (
    <MetricCard
      title="ケイデンス"
      value={cadence.toFixed(0)}
      unit="rpm"
      icon="🔄"
      onClick={toggleDisplay}
      className="speed-cadence-toggle"
    />
  );
};