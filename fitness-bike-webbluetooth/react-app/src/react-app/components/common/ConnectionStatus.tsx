import React from 'react';
import { ConnectionStatus as ConnectionStatusType } from '../../types';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  isMonitoring: boolean;
  onConnect: () => Promise<boolean>;
  onDisconnect: () => Promise<void>;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  isMonitoring,
  onConnect,
  onDisconnect,
}) => {
  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return isMonitoring ? '接続済み - モニタリング中' : '接続済み';
      case 'connecting':
        return '接続中...';
      case 'error':
        return '接続エラー';
      default:
        return '未接続';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'connected':
        return 'status connected';
      case 'connecting':
        return 'status connecting';
      case 'error':
        return 'status disconnected';
      default:
        return 'status disconnected';
    }
  };

  const handleButtonClick = async () => {
    if (status === 'disconnected' || status === 'error') {
      await onConnect();
    }
  };

  const getButtonText = () => {
    if (status === 'connecting') return '接続中...';
    if (status === 'connected') {
      return 'デバイス接続済み';
    }
    return 'デバイスに接続';
  };

  const isButtonDisabled = status === 'connecting' || status === 'connected';

  return (
    <div className={getStatusClass()}>
      <div>{getStatusText()}</div>
      <div className="connection-buttons">
        <button
          className={`toggle-btn ${status === 'connected' ? 'connected' : ''}`}
          onClick={handleButtonClick}
          disabled={isButtonDisabled}
        >
          {getButtonText()}
        </button>
        {status === 'connected' && (
          <button
            className="disconnect-btn"
            onClick={onDisconnect}
          >
            切断
          </button>
        )}
      </div>
    </div>
  );
};