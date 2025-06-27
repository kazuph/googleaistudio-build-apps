import React, { useState } from 'react';

interface ResistancePanelProps {
  currentResistance: number;
  onResistanceChange: (level: number) => Promise<boolean>;
  isConnected: boolean;
}

export const ResistancePanel: React.FC<ResistancePanelProps> = ({
  currentResistance,
  onResistanceChange,
  isConnected,
}) => {
  const [targetResistance, setTargetResistance] = useState(currentResistance);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const handleResistanceChange = async (newLevel: number) => {
    if (!isConnected || isAdjusting) return;
    
    setIsAdjusting(true);
    setTargetResistance(newLevel);
    
    try {
      await onResistanceChange(newLevel);
    } catch (error) {
      console.error('Failed to change resistance:', error);
    } finally {
      setIsAdjusting(false);
    }
  };

  const adjustResistance = (delta: number) => {
    const newLevel = Math.max(0, Math.min(20, targetResistance + delta));
    handleResistanceChange(newLevel);
  };

  const resistanceButtons = Array.from({ length: 21 }, (_, i) => i).map(level => (
    <button
      key={level}
      className={`resistance-btn ${targetResistance === level ? 'active' : ''}`}
      onClick={() => handleResistanceChange(level)}
      disabled={!isConnected || isAdjusting}
    >
      {level}
    </button>
  ));

  return (
    <div className="resistance-panel">
      <h3>⚙️ 負荷調整</h3>
      
      <div className="resistance-display">
        <span className="resistance-label">現在の負荷レベル:</span>
        <span className="resistance-value">{targetResistance}</span>
        {isAdjusting && <span className="resistance-status">調整中...</span>}
      </div>
      
      <div className="resistance-quick-controls">
        <button
          className="resistance-control-btn"
          onClick={() => adjustResistance(-5)}
          disabled={!isConnected || isAdjusting || targetResistance <= 0}
        >
          --
        </button>
        <button
          className="resistance-control-btn"
          onClick={() => adjustResistance(-1)}
          disabled={!isConnected || isAdjusting || targetResistance <= 0}
        >
          -
        </button>
        <button
          className="resistance-control-btn"
          onClick={() => adjustResistance(1)}
          disabled={!isConnected || isAdjusting || targetResistance >= 20}
        >
          +
        </button>
        <button
          className="resistance-control-btn"
          onClick={() => adjustResistance(5)}
          disabled={!isConnected || isAdjusting || targetResistance >= 20}
        >
          ++
        </button>
      </div>
      
      <div className="resistance-grid">
        {resistanceButtons}
      </div>
      
      {!isConnected && (
        <div className="resistance-warning">
          ⚠️ デバイスに接続してください
        </div>
      )}
    </div>
  );
};