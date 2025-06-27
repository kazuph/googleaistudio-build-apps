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

  const log = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-49), logMessage]);
    console.log(logMessage);
  }, []);

  const parseIndoorBikeData = useCallback((dataView: DataView): BikeServiceData => {
    const flags = dataView.getUint16(0, true);
    let offset = 2;
    const data: BikeServiceData = {};

    if (flags & 0x01) {
      data.speed = (dataView.getUint16(offset, true) / 100);
      offset += 2;
    }
    if (flags & 0x02) {
      data.cadence = (dataView.getUint16(offset, true) / 2);
      offset += 2;
    }
    if (flags & 0x04) {
      data.totalDistance = dataView.getUint24(offset, true);
      offset += 3;
    }
    if (flags & 0x08) {
      data.resistance = dataView.getInt16(offset, true);
      offset += 2;
    }
    if (flags & 0x10) {
      data.power = dataView.getInt16(offset, true);
      offset += 2;
    }
    if (flags & 0x20) {
      data.heartRate = dataView.getUint8(offset);
      offset += 1;
    }
    if (flags & 0x40) {
      data.elapsedTime = dataView.getUint16(offset, true);
      offset += 2;
    }

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
      const wheelRevolutions = dataView.getUint32(offset, true);
      offset += 4;
      const lastWheelEventTime = dataView.getUint16(offset, true);
      offset += 2;
      // Calculate speed from wheel data if needed
    }

    if (flags & 0x02) {
      const crankRevolutions = dataView.getUint16(offset, true);
      offset += 2;
      const lastCrankEventTime = dataView.getUint16(offset, true);
      offset += 2;
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

      return true;
    } catch (error) {
      log(`❌ 接続エラー: ${error}`);
      setConnectionStatus('error');
      return false;
    }
  }, [log]);

  const startMonitoring = useCallback(async () => {
    if (!bluetoothState.server || !bluetoothState.isConnected) {
      log('❌ デバイスが接続されていません');
      return false;
    }

    try {
      setBluetoothState(prev => ({ ...prev, isMonitoring: true }));
      log('📊 データモニタリング開始');

      // Try different services in order of preference
      const services = [
        { uuid: FITNESS_MACHINE_SERVICE, characteristic: INDOOR_BIKE_DATA_CHARACTERISTIC, parser: parseIndoorBikeData, name: 'Indoor Bike' },
        { uuid: CYCLING_POWER_SERVICE, characteristic: CYCLING_POWER_MEASUREMENT_CHARACTERISTIC, parser: parseCyclingPowerData, name: 'Cycling Power' },
        { uuid: CSC_SERVICE, characteristic: CSC_MEASUREMENT_CHARACTERISTIC, parser: parseCSCData, name: 'CSC' },
      ];

      for (const serviceInfo of services) {
        try {
          const service = await bluetoothState.server.getPrimaryService(serviceInfo.uuid);
          const characteristic = await service.getCharacteristic(serviceInfo.characteristic);
          
          await characteristic.startNotifications();
          
          characteristic.addEventListener('characteristicvaluechanged', (event) => {
            const target = event.target as BluetoothRemoteGATTCharacteristic;
            const dataView = target.value;
            if (dataView) {
              const data = serviceInfo.parser(dataView);
              setCurrentData(prev => ({ ...prev, ...data }));
            }
          });

          log(`✅ ${serviceInfo.name}サービス監視開始`);
          break;
        } catch (e) {
          log(`⚠️ ${serviceInfo.name}サービスは利用できません`);
        }
      }

      return true;
    } catch (error) {
      log(`❌ モニタリング開始エラー: ${error}`);
      setBluetoothState(prev => ({ ...prev, isMonitoring: false }));
      return false;
    }
  }, [bluetoothState.server, bluetoothState.isConnected, log, parseIndoorBikeData, parseCyclingPowerData, parseCSCData]);

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
  };
};