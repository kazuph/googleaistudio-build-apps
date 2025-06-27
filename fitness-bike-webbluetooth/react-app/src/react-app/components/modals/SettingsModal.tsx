import React, { useState } from 'react';
import { WorkoutStorage } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutStorage: WorkoutStorage;
  userWeight: number;
  onUpdateUserWeight: (weight: number) => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  workoutStorage,
  userWeight,
  onUpdateUserWeight,
  onResetData,
}) => {
  const [weightInput, setWeightInput] = useState(userWeight.toString());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isOpen) return null;

  const handleWeightUpdate = () => {
    const newWeight = parseFloat(weightInput);
    if (!isNaN(newWeight) && newWeight > 0 && newWeight < 500) {
      onUpdateUserWeight(newWeight);
    }
  };

  const handleResetData = () => {
    onResetData();
    setShowResetConfirm(false);
  };

  const getTotalSessions = () => {
    return Object.values(workoutStorage.dailyRecords).reduce(
      (total, record) => total + record.sessions,
      0
    );
  };

  const getTodaysData = () => {
    const today = new Date().toISOString().split('T')[0];
    return workoutStorage.dailyRecords[today] || { distance: 0, duration: 0, sessions: 0 };
  };

  const getRecentRecords = () => {
    const sortedDates = Object.keys(workoutStorage.dailyRecords).sort().reverse();
    return sortedDates.slice(0, 7).map(date => ({
      date,
      ...workoutStorage.dailyRecords[date],
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-panel show" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ 設定</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        {/* 運動統計 */}
        <div className="settings-section">
          <h3>📊 運動統計</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">総距離:</span>
              <span className="stat-value">
                {(workoutStorage.totalDistance / 1000).toFixed(1)} km
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">総セッション数:</span>
              <span className="stat-value">{getTotalSessions()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">今日の距離:</span>
              <span className="stat-value">
                {(getTodaysData().distance / 1000).toFixed(1)} km
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">今日のセッション:</span>
              <span className="stat-value">{getTodaysData().sessions}</span>
            </div>
          </div>
        </div>

        {/* ユーザー設定 */}
        <div className="settings-section">
          <h3>👤 ユーザー設定</h3>
          <div className="setting-row">
            <label>体重 (kg):</label>
            <input
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onBlur={handleWeightUpdate}
              min="30"
              max="300"
              step="0.1"
            />
          </div>
        </div>

        {/* 最近の記録 */}
        <div className="settings-section">
          <h3>📅 最近の記録</h3>
          <div className="recent-records">
            {getRecentRecords().length === 0 ? (
              <div className="no-records">記録がありません</div>
            ) : (
              getRecentRecords().map((record) => (
                <div key={record.date} className="record-item">
                  <span className="record-date">{record.date}</span>
                  <span className="record-distance">
                    {(record.distance / 1000).toFixed(1)} km
                  </span>
                  <span className="record-sessions">
                    {record.sessions} セッション
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* データリセット */}
        <div className="settings-section danger">
          <h3>🗑️ データリセット</h3>
          {!showResetConfirm ? (
            <button 
              className="reset-btn"
              onClick={() => setShowResetConfirm(true)}
            >
              全データをリセット
            </button>
          ) : (
            <div className="reset-confirm">
              <p>⚠️ 全てのワークアウトデータが削除されます。この操作は取り消せません。</p>
              <div className="reset-buttons">
                <button className="confirm-btn" onClick={handleResetData}>
                  確実にリセット
                </button>
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowResetConfirm(false)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};