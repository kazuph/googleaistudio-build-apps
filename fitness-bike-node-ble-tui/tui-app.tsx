#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { AerobikeController } from './build/aerobike-controller.js';

interface BikeMetrics {
  speed: number;
  averageSpeed: number;
  cadence: number;
  averageCadence: number;
  distance: number;
  power: number;
  resistance: number;
  isConnected: boolean;
}

interface GraphData {
  timestamp: number;
  speed: number;
  power: number;
  distance: number;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

interface TUIProps {
  debug?: boolean;
}

interface DiscoveredDevice {
  id: string;
  name: string;
  rssi: number;
}

const AerobikeTUI: React.FC<TUIProps> = ({ debug = false }) => {
  const [metrics, setMetrics] = useState<BikeMetrics>({
    speed: 0,
    averageSpeed: 0,
    cadence: 0,
    averageCadence: 0,
    distance: 0,
    power: 0,
    resistance: 0,
    isConnected: false
  });

  const [status, setStatus] = useState<string>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [controller] = useState(() => new AerobikeController());
  const [graphData, setGraphData] = useState<GraphData[]>([]);
  const [maxPower, setMaxPower] = useState<number>(100);
  const [maxSpeed, setMaxSpeed] = useState<number>(30);
  const [maxDistance, setMaxDistance] = useState<number>(1000); // meters
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState<number>(0);
  const [showDeviceSelection, setShowDeviceSelection] = useState<boolean>(false);

  // シグナルハンドリング
  useEffect(() => {
    const handleExit = () => {
      // クリーンアップ処理
      if ((controller as any).metricsInterval) {
        clearInterval((controller as any).metricsInterval);
      }
      process.exit(0);
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    return () => {
      process.removeListener('SIGINT', handleExit);
      process.removeListener('SIGTERM', handleExit);
    };
  }, []);

  // ログ追加関数
  const addLog = (level: LogEntry['level'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    setLogs(prevLogs => {
      const newLogs = [...prevLogs, { timestamp, level, message }];
      return newLogs.slice(-50); // 最新50件を保持
    });
  };

  // コントローラーのログを監視
  useEffect(() => {
    if (!debug) return;
    
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = (...args) => {
      if (debug) addLog('info', args.join(' '));
      // デバッグモード時は元のconsole.logを無効化してTUI上部への出力を抑制
    };

    console.error = (...args) => {
      if (debug) addLog('error', args.join(' '));
      originalConsoleError(...args);
    };

    console.warn = (...args) => {
      if (debug) addLog('warn', args.join(' '));
      originalConsoleWarn(...args);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, [debug]);

  useInput((input: string, key: any) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      // クリーンアップ処理
      if ((controller as any).metricsInterval) {
        clearInterval((controller as any).metricsInterval);
      }
      process.exit(0);
    }
    if (input === 's') {
      setStatus('scanning');
      if (debug) addLog('info', 'Starting Bluetooth scan...');
      controller.startScan(30).then(result => {
        if (result.success) {
          const devices = result.data?.devices || [];
          setDiscoveredDevices(devices);
          
          if (devices.length === 0) {
            setStatus('no_devices');
            if (debug) addLog('info', 'No devices found');
          } else if (devices.length === 1) {
            // 1台のみ発見時は自動接続
            setStatus('auto_connecting');
            if (debug) addLog('info', `Auto-connecting to ${devices[0].name}...`);
            connectToSelectedDevice(devices[0].id);
          } else {
            // 複数台発見時はデバイス選択画面を表示
            setStatus('device_selection');
            setShowDeviceSelection(true);
            setSelectedDeviceIndex(0);
            if (debug) addLog('info', `Found ${devices.length} devices. Please select one.`);
          }
          
          if (debug) addLog('info', `Scan completed. Found ${result.data?.devicesFound || 0} devices`);
          if (debug && result.data?.devices) {
            result.data.devices.forEach((device: any) => {
              addLog('info', `Device: ${device.name} (${device.id}) RSSI: ${device.rssi}`);
            });
          }
        } else {
          setStatus('scan_error');
          if (debug) addLog('error', `Scan failed: ${result.error}`);
        }
      }).catch(err => {
        setStatus('scan_error');
        if (debug) addLog('error', `Scan error: ${err.message}`);
      });
    }
    if (input === 'c') {
      if (discoveredDevices.length === 0) {
        if (debug) addLog('warn', 'No devices available. Please scan first.');
        return;
      }
      
      setStatus('connecting');
      if (debug) addLog('info', 'Attempting to connect to device...');
      connectToSelectedDevice();
    }
    
    // デバイス選択画面での操作
    if (showDeviceSelection) {
      if (key.upArrow) {
        setSelectedDeviceIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedDeviceIndex(prev => Math.min(discoveredDevices.length - 1, prev + 1));
      } else if (key.return) {
        // Enterキーで選択したデバイスに接続
        setShowDeviceSelection(false);
        setStatus('connecting');
        if (debug) addLog('info', `Connecting to selected device: ${discoveredDevices[selectedDeviceIndex].name}`);
        connectToSelectedDevice(discoveredDevices[selectedDeviceIndex].id);
      } else if (input === 'q') {
        // qキーでデバイス選択をキャンセル
        setShowDeviceSelection(false);
        setStatus('scan_complete');
      }
      return; // デバイス選択中は他の操作を無効化
    }
    
    // J/Kキーで負荷調整
    if (input === 'j' || input === 'J') {
      const currentResistance = metrics.resistance || 20; // デフォルト値を20に
      const newResistance = Math.max(1, currentResistance - 5);
      if (debug) addLog('info', `Decreasing resistance from ${currentResistance} to ${newResistance}...`);
      controller.setResistanceLevel(newResistance).then(result => {
        if (result.success) {
          setMetrics(prev => ({ ...prev, resistance: newResistance }));
          if (debug) addLog('info', `✅ Resistance decreased to level ${newResistance}`);
        } else {
          if (debug) addLog('error', `❌ Failed to set resistance: ${result.error}`);
        }
      }).catch(err => {
        if (debug) addLog('error', `❌ Resistance error: ${err.message}`);
      });
    }
    
    if (input === 'k' || input === 'K') {
      const currentResistance = metrics.resistance || 20; // デフォルト値を20に
      const newResistance = Math.min(80, currentResistance + 5);
      if (debug) addLog('info', `Increasing resistance from ${currentResistance} to ${newResistance}...`);
      controller.setResistanceLevel(newResistance).then(result => {
        if (result.success) {
          setMetrics(prev => ({ ...prev, resistance: newResistance }));
          if (debug) addLog('info', `✅ Resistance increased to level ${newResistance}`);
        } else {
          if (debug) addLog('error', `❌ Failed to set resistance: ${result.error}`);
        }
      }).catch(err => {
        if (debug) addLog('error', `❌ Resistance error: ${err.message}`);
      });
    }
    
    // 数字キー1-8で負荷設定 (1=10, 2=20, ..., 8=80)
    if (input >= '1' && input <= '8') {
      const resistanceLevel = parseInt(input) * 10;
      if (debug) addLog('info', `Setting resistance to level ${resistanceLevel}...`);
      controller.setResistanceLevel(resistanceLevel).then(result => {
        if (result.success) {
          setMetrics(prev => ({ ...prev, resistance: resistanceLevel }));
          if (debug) addLog('info', `✅ Resistance set to level ${resistanceLevel}`);
        } else {
          if (debug) addLog('error', `❌ Failed to set resistance: ${result.error}`);
        }
      }).catch(err => {
        if (debug) addLog('error', `❌ Resistance error: ${err.message}`);
      });
    }
  });

  // 接続関数
  const connectToSelectedDevice = (deviceId?: string) => {
    controller.connectToDevice(deviceId).then(result => {
      if (result.success) {
        setStatus('connected');
        if (debug) addLog('info', `Connected to ${result.deviceName}`);
        setMetrics(prev => ({ ...prev, isConnected: true }));
        
        // メトリクス更新の開始
        const metricsInterval = setInterval(() => {
          const currentMetrics = controller.getCurrentMetrics();
          const newMetrics = {
            speed: currentMetrics.speed,
            averageSpeed: currentMetrics.averageSpeed,
            cadence: currentMetrics.cadence,
            averageCadence: currentMetrics.averageCadence,
            distance: currentMetrics.distance,
            power: currentMetrics.power,
            resistance: currentMetrics.resistance,
            isConnected: true
          };
          setMetrics(newMetrics);
          setLastUpdate(formatTime(new Date()));
          
          // グラフデータ更新
          const now = Date.now();
          setGraphData(prevData => {
            const newData = [...prevData, {
              timestamp: now,
              speed: newMetrics.speed,
              power: newMetrics.power,
              distance: newMetrics.distance
            }];
            return newData.slice(-60); // 最新60秒分のデータを保持
          });
          
          // 最大値を動的に更新
          setMaxPower(prev => Math.max(prev, newMetrics.power + 10));
          setMaxSpeed(prev => Math.max(prev, newMetrics.speed + 5));
          setMaxDistance(prev => Math.max(prev, (newMetrics.distance / 1000) + 1)); // km単位で1km余裕を持たせる
        }, 1000);
        
        // クリーンアップのためにインターバルIDを保存
        (controller as any).metricsInterval = metricsInterval;
      } else {
        setStatus('connection_failed');
        if (debug) addLog('error', `Connection failed: ${result.error}`);
      }
    }).catch(err => {
      setStatus('connection_failed');
      if (debug) addLog('error', `Connection error: ${err.message}`);
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'green';
      case 'connecting': 
      case 'scanning': return 'yellow';
      case 'disconnected': 
      case 'error': return 'red';
      default: return 'white';
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'red';
      case 'warn': return 'yellow';
      case 'debug': return 'gray';
      case 'info': 
      default: return 'white';
    }
  };


  // レインボーバーコンポーネント
  const RainbowBar: React.FC<{ 
    value: number; 
    max: number; 
    label: string; 
    unit: string; 
    colorType: 'speed' | 'power' | 'distance' 
  }> = ({ value, max, label, unit, colorType }) => {
    const barWidth = 60; // バーの最大幅
    const targetMax = max * 0.8; // 80%で満タン表示
    const percentage = Math.min(value / targetMax, 1);
    const filledLength = Math.round(barWidth * percentage);
    
    // レインボー色のマッピング
    const getColors = (type: 'speed' | 'power' | 'distance') => {
      switch (type) {
        case 'speed':
          return ['cyan', 'blue', 'magenta', 'red']; // 速度: シアン→青→マゼンタ→赤
        case 'power':
          return ['green', 'yellow', 'red', 'magenta']; // パワー: 緑→黄→赤→マゼンタ
        case 'distance':
          return ['yellow', 'cyan', 'blue', 'green']; // 距離: 黄→シアン→青→緑
        default:
          return ['white'];
      }
    };
    
    const colors = getColors(colorType);
    const segmentLength = Math.ceil(barWidth / colors.length);
    
    // バーセグメントを生成
    const generateBar = () => {
      let bar = '';
      let colorIndex = 0;
      
      for (let i = 0; i < filledLength; i++) {
        if (i > 0 && i % segmentLength === 0) {
          colorIndex = Math.min(colorIndex + 1, colors.length - 1);
        }
        bar += '█';
      }
      
      // 空の部分
      const emptyLength = barWidth - filledLength;
      const emptyBar = '░'.repeat(emptyLength);
      
      return { bar, emptyBar, colorIndex };
    };
    
    const { bar, emptyBar } = generateBar();
    
    // セグメント別に色付けされたバーを作成
    const renderColoredBar = () => {
      const segments = [];
      let currentBar = bar;
      let colorIndex = 0;
      
      while (currentBar.length > 0 && colorIndex < colors.length) {
        const segmentEnd = Math.min(segmentLength, currentBar.length);
        const segment = currentBar.slice(0, segmentEnd);
        
        if (segment.length > 0) {
          segments.push(
            <Text key={colorIndex} color={colors[colorIndex] as any}>
              {segment}
            </Text>
          );
        }
        
        currentBar = currentBar.slice(segmentEnd);
        colorIndex++;
      }
      
      return segments;
    };
    
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="white">
            {label}: {value.toFixed(colorType === 'distance' ? 2 : 1)}{unit}
          </Text>
          <Text color="gray"> ({Math.round(percentage * 100)}%)</Text>
        </Box>
        <Box>
          {renderColoredBar()}
          <Text color="gray">{emptyBar}</Text>
        </Box>
      </Box>
    );
  };

  // シンプルグラフコンポーネント
  const SimpleGraph: React.FC<{ data: GraphData[]; type: 'speed-power' | 'distance'; title: string }> = ({ data, type, title }) => {
    const width = 40;
    const height = 8;
    
    if (data.length === 0) {
      return (
        <Box flexDirection="column" borderStyle="round" padding={1} width={width + 4}>
          <Text bold color="cyan">{title}</Text>
          <Text color="gray">No data available</Text>
        </Box>
      );
    }

    const generateGraph = () => {
      if (type === 'speed-power') {
        const speedMax = Math.max(...data.map(d => d.speed), 1);
        const powerMax = Math.max(...data.map(d => d.power), 1);
        
        const lines = [];
        for (let y = height - 1; y >= 0; y--) {
          let line = '';
          for (let x = 0; x < width; x++) {
            const dataIndex = Math.floor((x / width) * data.length);
            if (dataIndex < data.length) {
              const speedLevel = Math.floor((data[dataIndex].speed / speedMax) * height);
              const powerLevel = Math.floor((data[dataIndex].power / powerMax) * height);
              
              if (y === speedLevel) {
                line += '▲'; // Speed
              } else if (y === powerLevel) {
                line += '●'; // Power
              } else {
                line += ' ';
              }
            } else {
              line += ' ';
            }
          }
          lines.push(line);
        }
        return lines;
      } else {
        // Distance graph
        const distanceMax = Math.max(...data.map(d => d.distance), 1);
        
        const lines = [];
        for (let y = height - 1; y >= 0; y--) {
          let line = '';
          for (let x = 0; x < width; x++) {
            const dataIndex = Math.floor((x / width) * data.length);
            if (dataIndex < data.length) {
              const distanceLevel = Math.floor((data[dataIndex].distance / distanceMax) * height);
              
              if (y === distanceLevel) {
                line += '■'; // Distance
              } else {
                line += ' ';
              }
            } else {
              line += ' ';
            }
          }
          lines.push(line);
        }
        return lines;
      }
    };

    const graphLines = generateGraph();

    return (
      <Box flexDirection="column" borderStyle="round" padding={1} width={width + 4}>
        <Text bold color="cyan">{title}</Text>
        {type === 'speed-power' && (
          <Box>
            <Text color="green">▲ Speed </Text>
            <Text color="red">● Power</Text>
          </Box>
        )}
        {type === 'distance' && (
          <Text color="magenta">■ Distance</Text>
        )}
        {graphLines.map((line, index) => (
          <Text key={index} color={type === 'speed-power' ? 'white' : 'magenta'}>
            {line}
          </Text>
        ))}
        {type === 'speed-power' && data.length > 0 && (
          <Box>
            <Text color="green">S:{data[data.length - 1]?.speed.toFixed(1)}km/h </Text>
            <Text color="red">P:{data[data.length - 1]?.power}W</Text>
          </Box>
        )}
        {type === 'distance' && data.length > 0 && (
          <Text color="magenta">
            Distance: {(data[data.length - 1]?.distance / 1000).toFixed(2)}km
          </Text>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">🚴‍♂️ Aerobike Controller TUI {debug && <Text color="gray">(DEBUG MODE)</Text>}</Text>
      </Box>

      {/* Main Content */}
      <Box flexDirection="column">
        {/* Main UI */}
        <Box flexDirection="column">
          {/* Status */}
          <Box marginBottom={1}>
            <Text>Status: </Text>
            <Text color={getStatusColor(status)} bold>
              {status.toUpperCase()}
            </Text>
            {lastUpdate && (
              <Text color="gray"> (Last update: {lastUpdate})</Text>
            )}
          </Box>

          {/* Control Panel */}
          <Box flexDirection="column" borderStyle="round" padding={1} marginBottom={1}>
            <Text bold color="yellow">🎛️ Controls</Text>
            <Text>
              <Text color="cyan">s</Text> - Start scan | 
              <Text color="cyan"> c</Text> - Connect | 
              <Text color="cyan"> j/k</Text> - Resistance ±5
            </Text>
            <Text>
              <Text color="cyan">1-8</Text> - Set resistance (1=10, 2=20...8=80) | 
              <Text color="cyan"> q</Text> - Quit
            </Text>
          </Box>

          {/* Metrics Grid */}
          <Box flexDirection="column" borderStyle="round" padding={1} marginBottom={1}>
            <Text bold color="yellow">📊 Live Metrics</Text>
            
            <Box marginTop={1}>
              <Box width={25}>
                <Text>Speed: </Text>
                <Text color="green" bold>{metrics.speed.toFixed(1)} km/h</Text>
              </Box>
              <Box width={25}>
                <Text>Avg Speed: </Text>
                <Text color="green">{metrics.averageSpeed.toFixed(1)} km/h</Text>
              </Box>
            </Box>

            <Box>
              <Box width={25}>
                <Text>Cadence: </Text>
                <Text color="blue" bold>{metrics.cadence.toFixed(0)} rpm</Text>
              </Box>
              <Box width={25}>
                <Text>Avg Cadence: </Text>
                <Text color="blue">{metrics.averageCadence.toFixed(0)} rpm</Text>
              </Box>
            </Box>

            <Box>
              <Box width={25}>
                <Text>Power: </Text>
                <Text color="red" bold>{metrics.power} W</Text>
              </Box>
              <Box width={25}>
                <Text>Distance: </Text>
                <Text color="magenta">{(metrics.distance / 1000).toFixed(2)} km</Text>
              </Box>
            </Box>

            <Box>
              <Box width={25}>
                <Text>Resistance: </Text>
                <Text color="yellow" bold>Level {metrics.resistance}</Text>
              </Box>
              <Box width={25}>
                <Text>Connection: </Text>
                <Text color={metrics.isConnected ? 'green' : 'red'}>
                  {metrics.isConnected ? '✅ Connected' : '❌ Disconnected'}
                </Text>
              </Box>
            </Box>
          </Box>

          {/* レインボーバー */}
          <Box flexDirection="column" borderStyle="round" padding={1} marginBottom={1}>
            <Text bold color="yellow">🌈 Live Metrics Bars</Text>
            <RainbowBar 
              value={metrics.speed} 
              max={maxSpeed} 
              label="Speed" 
              unit="km/h" 
              colorType="speed" 
            />
            <RainbowBar 
              value={metrics.power} 
              max={maxPower} 
              label="Power" 
              unit="W" 
              colorType="power" 
            />
            <RainbowBar 
              value={metrics.distance / 1000} 
              max={maxDistance} 
              label="Distance" 
              unit="km" 
              colorType="distance" 
            />
          </Box>

          {/* Control Panel */}
          {/* Device Selection */}
          {showDeviceSelection && (
            <Box flexDirection="column" borderStyle="round" padding={1} marginBottom={1}>
              <Text bold color="yellow">📱 Select Device</Text>
              {discoveredDevices.map((device, index) => (
                <Box key={device.id}>
                  <Text color={index === selectedDeviceIndex ? 'cyan' : 'white'}>
                    {index === selectedDeviceIndex ? '→ ' : '  '}
                    {device.name} ({device.id}) RSSI: {device.rssi}
                  </Text>
                </Box>
              ))}
              <Box marginTop={1}>
                <Text color="gray">Use ↑↓ arrows to select, Enter to connect, q to cancel</Text>
              </Box>
            </Box>
          )}

          {/* Footer */}
          <Box justifyContent="center">
            <Text color="gray">Press any key to interact • Current time: {formatTime(new Date())}</Text>
          </Box>
        </Box>

        {/* Graphs Panel */}
        <Box flexDirection="row" marginTop={1}>
          <SimpleGraph 
            data={graphData} 
            type="speed-power" 
            title="📈 Speed & Power"
          />
          <Box marginLeft={2}>
            <SimpleGraph 
              data={graphData} 
              type="distance" 
              title="📏 Distance"
            />
          </Box>
          {debug && (
            <Box marginLeft={2} flexDirection="column" borderStyle="round" padding={1} width={40}>
              <Text bold color="magenta">🐛 Debug Logs</Text>
              <Box flexDirection="column" height={20} overflow="hidden">
                {logs.slice(-15).map((log, index) => (
                  <Box key={index}>
                    <Text color="gray">{log.timestamp} </Text>
                    <Text color={getLogColor(log.level)} wrap="truncate">[{log.level.toUpperCase()}] {log.message}</Text>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>

      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  // コマンドライン引数でデバッグモードを確認
  const debug = process.argv.includes('--debug') || process.argv.includes('-d');
  return <AerobikeTUI debug={debug} />;
};

// Entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  render(<App />);
}

export default App;