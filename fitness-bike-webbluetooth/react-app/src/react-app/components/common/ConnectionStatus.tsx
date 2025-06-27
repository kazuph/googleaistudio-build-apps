import React from 'react';
import { ConnectionStatus as ConnectionStatusType } from '../../types';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  isMonitoring: boolean;
  onConnect: () => Promise<boolean>;
  onDisconnect: () => Promise<void>;
  onStartMonitoring: () => Promise<boolean>;
  onStopMonitoring: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  isMonitoring,
  onConnect,
  onDisconnect,
  onStartMonitoring,
  onStopMonitoring,
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
    if (status === 'connected') {
      if (isMonitoring) {
        onStopMonitoring();
      } else {
        await onStartMonitoring();
      }
    } else if (status === 'disconnected' || status === 'error') {
      const connected = await onConnect();
      if (connected) {
        await onStartMonitoring();
      }
    }
  };

  const getButtonText = () => {
    if (status === 'connecting') return '接続中...';
    if (status === 'connected') {
      return isMonitoring ? 'モニタリング停止' : 'モニタリング開始';
    }
    return 'デバイスに接続';
  };

  const isButtonDisabled = status === 'connecting';

  return (
    <div className={getStatusClass()}>
      <div>{getStatusText()}</div>
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
          style={{ marginLeft: '10px' }}
        >
          切断
        </button>
      )}
    </div>
  );
};