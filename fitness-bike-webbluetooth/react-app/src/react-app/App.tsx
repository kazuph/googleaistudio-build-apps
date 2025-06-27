import { useState, useCallback } from 'react';
import './App.css';

// Components
import { Header } from './components/common/Header';
import { ConnectionStatus } from './components/common/ConnectionStatus';
import { MetricsGrid } from './components/dashboard/MetricsGrid';
import { PowerBar } from './components/dashboard/PowerBar';
import { ResistancePanel } from './components/panels/ResistancePanel';
import { LogPanel } from './components/panels/LogPanel';
import { SettingsModal } from './components/modals/SettingsModal';

// Hooks
import { useBluetooth } from './hooks/useBluetooth';
import { useWorkoutData } from './hooks/useWorkoutData';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  
  // Bluetooth functionality
  const {
    bluetoothState,
    connectionStatus,
    currentData,
    logs,
    connect,
    disconnect,
    startMonitoring,
    setResistanceLevel,
    clearLogs,
  } = useBluetooth();

  // Workout data management
  const {
    workoutStorage,
    metrics,
    userWeight,
    resetSession,
    completeSession,
    resetAllData,
    updateUserWeight,
  } = useWorkoutData(currentData, bluetoothState.isMonitoring);

  // Event handlers
  const handleSettingsClick = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
  }, []);

  const handleConnect = useCallback(async () => {
    const result = await connect();
    if (result && typeof result === 'object' && result.success && result.server) {
      // 接続後すぐにモニタリングを開始
      resetSession();
      const started = await startMonitoring(result.server);
      return started;
    }
    return false;
  }, [connect, startMonitoring, resetSession]);

  const handleDisconnect = useCallback(async () => {
    if (bluetoothState.isMonitoring) {
      completeSession();
    }
    await disconnect();
  }, [disconnect, bluetoothState.isMonitoring, completeSession]);


  const handleResistanceChange = useCallback(async (level: number) => {
    return await setResistanceLevel(level);
  }, [setResistanceLevel]);


  // Check Web Bluetooth API support
  if (!navigator.bluetooth) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h1>❌ Web Bluetooth API 未サポート</h1>
          <p>このブラウザはWeb Bluetooth APIをサポートしていません。</p>
          <p>Chrome、Edge、またはOperaの最新版をお使いください。</p>
          <p>また、HTTPSまたはlocalhost環境が必要です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Header onSettingsClick={handleSettingsClick} />
      
      <ConnectionStatus
        status={connectionStatus}
        isMonitoring={bluetoothState.isMonitoring}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <div className="main-dashboard">
        <MetricsGrid metrics={metrics} />
        <PowerBar power={metrics.power} />
      </div>

      <ResistancePanel
        currentResistance={metrics.resistance}
        onResistanceChange={handleResistanceChange}
        isConnected={bluetoothState.isConnected}
      />

      <LogPanel logs={logs} onClear={clearLogs} />

      <SettingsModal
        isOpen={showSettings}
        onClose={handleSettingsClose}
        workoutStorage={workoutStorage}
        userWeight={userWeight}
        onUpdateUserWeight={updateUserWeight}
        onResetData={resetAllData}
      />
    </div>
  );
}

export default App;