import { useState, useCallback, useRef } from 'react';
import { BluetoothState, BikeServiceData, ConnectionStatus } from '../types';

const FITNESS_MACHINE_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';
const CYCLING_POWER_SERVICE = '00001818-0000-1000-8000-00805f9b34fb';
const CSC_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';

const INDOOR_BIKE_DATA_CHARACTERISTIC = '00002ad2-0000-1000-8000-00805f9b34fb';
const CYCLING_POWER_MEASUREMENT_CHARACTERISTIC = '00002a63-0000-1000-8000-00805f9b34fb';
const CSC_MEASUREMENT_CHARACTERISTIC = '00002a5b-0000-1000-8000-00805f9b34fb';
const FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC = '00002ad9-0000-1000-8000-00805f9b34fb';

export const useBluetooth = () => {
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>({
    isConnected: false,
    isMonitoring: false,
    device: null,
    server: null,
  });
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentData, setCurrentData] = useState<BikeServiceData>({});
  const [logs, setLogs] = useState<string[]>([]);
  
  const controlPointRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<{ distance: number; time: number }>({ distance: 0, time: 0 });

  const log = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-49), logMessage]);
    console.log(logMessage);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    log('🧹 ログをクリアしました');
  }, [log]);

  const parseIndoorBikeData = useCallback((dataView: DataView): BikeServiceData => {
    const flags = dataView.getUint16(0, true);
    let offset = 2;
    const data: BikeServiceData = {};

    console.log('🔍 Indoor Bike Data flags:', flags.toString(16), 'binary:', flags.toString(2), 'length:', dataView.byteLength);
    
    // 生データをログ出力
    const bytes = [];
    for (let i = 0; i < dataView.byteLength; i++) {
      bytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
    }
    console.log('🔍 Raw data bytes:', bytes.join(' '));

    console.log('🔍 Flag checks:');
    console.log('  - Speed (0x01):', !!(flags & 0x01));
    console.log('  - Cadence (0x02):', !!(flags & 0x02));
    console.log('  - Total Distance (0x04):', !!(flags & 0x04));
    console.log('  - Resistance (0x08):', !!(flags & 0x08));
    console.log('  - Power (0x10):', !!(flags & 0x10));
    console.log('  - Heart Rate (0x20):', !!(flags & 0x20));
    console.log('  - Elapsed Time (0x40):', !!(flags & 0x40));

    if (flags & 0x01) {
      data.speed = (dataView.getUint16(offset, true) / 100);
      console.log('  → Speed value:', data.speed, 'km/h');
      offset += 2;
    }
    if (flags & 0x02) {
      data.cadence = (dataView.getUint16(offset, true) / 2);
      console.log('  → Cadence value:', data.cadence, 'rpm');
      offset += 2;
    }
    if (flags & 0x04) {
      // getUint24 doesn't exist, so we construct it manually
      data.totalDistance = dataView.getUint8(offset) | 
                           (dataView.getUint8(offset + 1) << 8) | 
                           (dataView.getUint8(offset + 2) << 16);
      console.log('  → Total Distance value:', data.totalDistance, 'm');
      offset += 3;
    }
    if (flags & 0x08) {
      data.resistance = dataView.getInt16(offset, true);
      console.log('  → Resistance value:', data.resistance);
      offset += 2;
    }
    if (flags & 0x10) {
      data.power = dataView.getInt16(offset, true);
      console.log('  → Power value:', data.power, 'W');
      offset += 2;
    }
    if (flags & 0x20) {
      data.heartRate = dataView.getUint8(offset);
      console.log('  → Heart Rate value:', data.heartRate, 'bpm');
      offset += 1;
    }
    if (flags & 0x40) {
      data.elapsedTime = dataView.getUint16(offset, true);
      console.log('  → Elapsed Time value:', data.elapsedTime, 's');
      offset += 2;
    }

    // フィットネス機器がspeed/cadence/powerを送信しない場合の対処
    // totalDistanceから速度を推定する
    if (!data.speed && data.totalDistance !== undefined && data.elapsedTime !== undefined) {
      const prevDistance = previousDataRef.current.distance;
      const prevTime = previousDataRef.current.time;
      
      if (data.elapsedTime > prevTime) {
        const distanceDiff = data.totalDistance - prevDistance; // meters
        const timeDiff = data.elapsedTime - prevTime; // seconds
        
        if (timeDiff > 0 && distanceDiff > 0) {
          data.speed = (distanceDiff / timeDiff) * 3.6; // m/s to km/h
          console.log('  → Calculated Speed from distance:', data.speed.toFixed(2), 'km/h');
          
          // エアロバイクの一般的な公式でパワーを推定
          // Power (watts) ≈ speed^2 * constant + base resistance
          if (!data.power && data.speed > 0) {
            const estimatedPower = Math.round(data.speed * data.speed * 0.5 + 50);
            data.power = estimatedPower;
            console.log('  → Estimated Power from speed:', data.power, 'W');
          }
          
          // ケイデンスの推定（一般的なエアロバイクの経験値）
          if (!data.cadence && data.speed > 0) {
            const estimatedCadence = Math.round(40 + data.speed * 2); // 経験的な式
            data.cadence = Math.min(estimatedCadence, 120); // 現実的な上限
            console.log('  → Estimated Cadence from speed:', data.cadence, 'rpm');
          }
        }
      }
      
      previousDataRef.current.distance = data.totalDistance;
      previousDataRef.current.time = data.elapsedTime;
    }

    console.log('🔍 Final parsed data:', data);
    return data;
  }, []);

  const parseCyclingPowerData = useCallback((dataView: DataView): BikeServiceData => {
    const flags = dataView.getUint16(0, true);
    let offset = 2;
    const data: BikeServiceData = {};

    data.power = dataView.getInt16(offset, true);
    offset += 2;

    if (flags & 0x20) {
      data.cadence = dataView.getUint8(offset);
      offset += 1;
    }

    return data;
  }, []);

  const parseCSCData = useCallback((dataView: DataView): BikeServiceData => {
    const flags = dataView.getUint8(0);
    let offset = 1;
    const data: BikeServiceData = {};

    if (flags & 0x01) {
      // Wheel revolution data
      offset += 4; // wheelRevolutions
      offset += 2; // lastWheelEventTime
      // Calculate speed from wheel data if needed
    }

    if (flags & 0x02) {
      const crankRevolutions = dataView.getUint16(offset, true);
      offset += 2;
      offset += 2; // lastCrankEventTime
      // Calculate cadence from crank data
      data.cadence = crankRevolutions; // Simplified
    }

    return data;
  }, []);

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      log('❌ Web Bluetooth APIはサポートされていません');
      return false;
    }

    try {
      setConnectionStatus('connecting');
      log('🔍 Bluetoothデバイスを検索中...');

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [FITNESS_MACHINE_SERVICE] },
          { services: [CYCLING_POWER_SERVICE] },
          { services: [CSC_SERVICE] }
        ],
        optionalServices: [
          FITNESS_MACHINE_SERVICE,
          CYCLING_POWER_SERVICE,
          CSC_SERVICE
        ]
      });

      if (!device.gatt) {
        throw new Error('GATT not available');
      }

      log(`📱 デバイス発見: ${device.name || 'Unknown Device'}`);
      
      const server = await device.gatt.connect();
      log('🔗 GATTサーバーに接続完了');

      setBluetoothState({
        isConnected: true,
        isMonitoring: false,
        device,
        server,
      });

      setConnectionStatus('connected');
      
      // Try to get control point for resistance control
      try {
        const fitnessService = await server.getPrimaryService(FITNESS_MACHINE_SERVICE);
        const controlPoint = await fitnessService.getCharacteristic(FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC);
        controlPointRef.current = controlPoint;
        log('⚡ フィットネスマシン制御ポイント取得完了');
      } catch (e) {
        log('⚠️ 制御ポイントは利用できません');
      }

      return { success: true, server };
    } catch (error) {
      log(`❌ 接続エラー: ${error}`);
      setConnectionStatus('error');
      return { success: false, server: null };
    }
  }, [log]);

  const startMonitoring = useCallback(async (server?: BluetoothRemoteGATTServer) => {
    const targetServer = server || bluetoothState.server;
    
    if (!targetServer || !targetServer.connected) {
      log('❌ デバイスが接続されていません');
      return false;
    }

    try {
      setBluetoothState(prev => ({ ...prev, isMonitoring: true }));
      log('📊 データモニタリング開始');
      
      // Reset previous data for fresh calculations
      previousDataRef.current = { distance: 0, time: 0 };

      // Try different services in order of preference
      const services = [
        { uuid: FITNESS_MACHINE_SERVICE, characteristic: INDOOR_BIKE_DATA_CHARACTERISTIC, parser: parseIndoorBikeData, name: 'Indoor Bike' },
        { uuid: CYCLING_POWER_SERVICE, characteristic: CYCLING_POWER_MEASUREMENT_CHARACTERISTIC, parser: parseCyclingPowerData, name: 'Cycling Power' },
        { uuid: CSC_SERVICE, characteristic: CSC_MEASUREMENT_CHARACTERISTIC, parser: parseCSCData, name: 'CSC' },
      ];

      let successfulService = false;
      
      // Try to connect to multiple services for comprehensive data
      for (const serviceInfo of services) {
        try {
          const service = await targetServer.getPrimaryService(serviceInfo.uuid);
          const characteristic = await service.getCharacteristic(serviceInfo.characteristic);
          
          await characteristic.startNotifications();
          
          characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
            const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
            const dataView = target.value;
            if (dataView) {
              const data = serviceInfo.parser(dataView);
              log(`📈 ${serviceInfo.name}データ受信: ${JSON.stringify(data)}`);
              
              // Merge data with intelligent priority (latest data wins, but keep existing if new is empty)
              setCurrentData(prev => {
                const merged = { ...prev };
                
                // Type-safe data merging
                if (data.speed !== undefined && data.speed !== null) merged.speed = data.speed;
                if (data.cadence !== undefined && data.cadence !== null) merged.cadence = data.cadence;
                if (data.power !== undefined && data.power !== null) merged.power = data.power;
                if (data.resistance !== undefined && data.resistance !== null) merged.resistance = data.resistance;
                if (data.totalDistance !== undefined && data.totalDistance !== null) merged.totalDistance = data.totalDistance;
                if (data.elapsedTime !== undefined && data.elapsedTime !== null) merged.elapsedTime = data.elapsedTime;
                if (data.heartRate !== undefined && data.heartRate !== null) merged.heartRate = data.heartRate;
                
                return merged;
              });
            }
          });

          log(`✅ ${serviceInfo.name}サービス監視開始`);
          successfulService = true;
          
          // Don't break - try to connect to all available services for maximum data coverage
        } catch (e) {
          log(`⚠️ ${serviceInfo.name}サービスは利用できません: ${e}`);
          console.log(`Service error for ${serviceInfo.name}:`, e);
        }
      }
      
      if (!successfulService) {
        log('❌ 利用可能なサービスが見つかりませんでした');
        setBluetoothState(prev => ({ ...prev, isMonitoring: false }));
        return false;
      }

      return true;
    } catch (error) {
      log(`❌ モニタリング開始エラー: ${error}`);
      setBluetoothState(prev => ({ ...prev, isMonitoring: false }));
      return false;
    }
  }, [bluetoothState.server, log, parseIndoorBikeData, parseCyclingPowerData, parseCSCData]);

  const stopMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    
    setBluetoothState(prev => ({ ...prev, isMonitoring: false }));
    log('⏹️ データモニタリング停止');
  }, [log]);

  const disconnect = useCallback(async () => {
    try {
      stopMonitoring();
      
      if (bluetoothState.device?.gatt?.connected) {
        await bluetoothState.device.gatt.disconnect();
      }
      
      setBluetoothState({
        isConnected: false,
        isMonitoring: false,
        device: null,
        server: null,
      });
      
      setConnectionStatus('disconnected');
      setCurrentData({});
      controlPointRef.current = null;
      
      log('❌ デバイスから切断しました');
    } catch (error) {
      log(`❌ 切断エラー: ${error}`);
    }
  }, [bluetoothState.device, stopMonitoring, log]);

  const setResistanceLevel = useCallback(async (level: number) => {
    if (!controlPointRef.current) {
      log('❌ 抵抗制御は利用できません');
      return false;
    }

    try {
      const buffer = new ArrayBuffer(3);
      const view = new DataView(buffer);
      view.setUint8(0, 0x04); // Set Target Resistance Level command
      view.setInt16(1, level, true); // Resistance level
      
      await controlPointRef.current.writeValue(buffer);
      log(`⚙️ 抵抗レベルを ${level} に設定`);
      return true;
    } catch (error) {
      log(`❌ 抵抗設定エラー: ${error}`);
      return false;
    }
  }, [log]);

  return {
    bluetoothState,
    connectionStatus,
    currentData,
    logs,
    connect,
    disconnect,
    startMonitoring,
    stopMonitoring,
    setResistanceLevel,
    clearLogs,
  };
};