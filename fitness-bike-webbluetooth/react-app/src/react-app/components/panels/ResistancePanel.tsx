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
  const [targetResistance, setTargetResistance] = useState(currentResistance || 32);
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
    const newLevel = Math.max(1, Math.min(80, targetResistance + delta));
    handleResistanceChange(newLevel);
  };

  // 5段階のプリセットボタン: 軽い、やや軽い、普通、やや重い、重い
  const presetLevels = [
    { label: '軽い', value: 16, emoji: '🟢' },     // 1-80の20%
    { label: 'やや軽い', value: 32, emoji: '🟡' },  // 1-80の40%
    { label: '普通', value: 48, emoji: '🟠' },     // 1-80の60%
    { label: 'やや重い', value: 64, emoji: '🔴' },  // 1-80の80%
    { label: '重い', value: 80, emoji: '🟣' },     // 1-80の100%
  ];

  const resistanceButtons = presetLevels.map(preset => (
    <button
      key={preset.value}
      className={`resistance-preset-btn ${targetResistance === preset.value ? 'active' : ''}`}
      onClick={() => handleResistanceChange(preset.value)}
      disabled={!isConnected || isAdjusting}
    >
      <span className="preset-emoji">{preset.emoji}</span>
      <span className="preset-label">{preset.label}</span>
      <span className="preset-value">{preset.value}</span>
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
          onClick={() => adjustResistance(-10)}
          disabled={!isConnected || isAdjusting || targetResistance <= 1}
        >
          --
        </button>
        <button
          className="resistance-control-btn"
          onClick={() => adjustResistance(-1)}
          disabled={!isConnected || isAdjusting || targetResistance <= 1}
        >
          -
        </button>
        <button
          className="resistance-control-btn"
          onClick={() => adjustResistance(1)}
          disabled={!isConnected || isAdjusting || targetResistance >= 80}
        >
          +
        </button>
        <button
          className="resistance-control-btn"
          onClick={() => adjustResistance(10)}
          disabled={!isConnected || isAdjusting || targetResistance >= 80}
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