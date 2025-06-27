import React from 'react';

interface HeaderProps {
  onSettingsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  return (
    <div className="header">
      <h1>🚴‍♂️ Fitness Bike Controller</h1>
      <button 
        className="settings-btn" 
        onClick={onSettingsClick}
        title="設定を開く"
      >
        ⚙️
      </button>
    </div>
  );
};