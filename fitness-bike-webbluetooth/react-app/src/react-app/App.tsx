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
    stopMonitoring,
    setResistanceLevel,
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
    const connected = await connect();
    return connected;
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    if (bluetoothState.isMonitoring) {
      completeSession();
    }
    await disconnect();
  }, [disconnect, bluetoothState.isMonitoring, completeSession]);

  const handleStartMonitoring = useCallback(async () => {
    resetSession(); // Reset session data when starting new monitoring
    const started = await startMonitoring();
    return started;
  }, [startMonitoring, resetSession]);

  const handleStopMonitoring = useCallback(() => {
    completeSession(); // Save session data when stopping
    stopMonitoring();
  }, [stopMonitoring, completeSession]);

  const handleResistanceChange = useCallback(async (level: number) => {
    return await setResistanceLevel(level);
  }, [setResistanceLevel]);

  const clearLogs = useCallback(() => {
    // This would require updating the useBluetooth hook to support clearing logs
    // For now, we'll just implement it in the hook later
  }, []);

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
        onStartMonitoring={handleStartMonitoring}
        onStopMonitoring={handleStopMonitoring}
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