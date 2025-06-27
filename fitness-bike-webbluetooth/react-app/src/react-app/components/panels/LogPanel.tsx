import React, { useEffect, useRef } from 'react';

interface LogPanelProps {
  logs: string[];
  onClear?: () => void;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs, onClear }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="log-panel">
      <div className="log-header">
        <h3>📝 システムログ</h3>
        {onClear && (
          <button className="log-clear-btn" onClick={onClear}>
            クリア
          </button>
        )}
      </div>
      
      <div className="log-content" ref={logContainerRef}>
        {logs.length === 0 ? (
          <div className="log-empty">ログがありません</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};