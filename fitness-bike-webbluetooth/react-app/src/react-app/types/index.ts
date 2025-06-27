export interface WorkoutData {
  time: number[];
  speed: number[];
  power: number[];
  cadence: number[];
  distance: number[];
}

export interface DailyRecord {
  distance: number;
  duration: number;
  sessions: number;
}

export interface WorkoutStorage {
  totalDistance: number;
  dailyRecords: Record<string, DailyRecord>;
  monthlyTotals: Record<string, number>;
}

export interface UserSettings {
  weight: number;
  units: 'metric' | 'imperial';
  autoConnect: boolean;
}

export interface BluetoothState {
  isConnected: boolean;
  isMonitoring: boolean;
  device: BluetoothDevice | null;
  server: BluetoothRemoteGATTServer | null;
}

export interface MetricData {
  speed: number;
  cadence: number;
  power: number;
  calories: number;
  sessionDistance: number;
  totalDistance: number;
  duration: number;
  resistance: number;
}

export interface BikeServiceData {
  speed?: number;
  cadence?: number;
  power?: number;
  resistance?: number;
  totalDistance?: number;
  elapsedTime?: number;
  heartRate?: number;
}

export interface ResistanceLevel {
  level: number;
  description: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type ChartDataType = 'speed' | 'power' | 'cadence';

export interface ChartConfig {
  type: ChartDataType;
  data: number[];
  labels: string[];
  color: string;
}