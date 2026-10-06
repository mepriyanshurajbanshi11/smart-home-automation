export type DeviceType = 'light' | 'fan' | 'plug' | 'ac' | 'alarm';

export type RoomId = 'all' | 'living_room' | 'bedroom' | 'kitchen' | 'outdoor';

export interface Device {
  id: string;
  name: string;
  room: RoomId;
  type: DeviceType;
  state: boolean;
  value?: number; // Brightness (0-100), Speed (1-3), Temp (16-30)
  unit?: string;
  cmdTopic: string;
  stateTopic: string;
}

export interface SensorData {
  temperature: number;
  humidity: number;
  motionDetected: boolean;
  lastUpdated: string;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface MqttConfig {
  host: string;
  port: number;
  path: string;
  clientId: string;
  username?: string;
  password?: string;
  useSSL: boolean;
}
