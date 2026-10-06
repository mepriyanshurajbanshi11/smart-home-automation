import { Client, Message } from 'paho-mqtt';
import { AppState, AppStateStatus } from 'react-native';
import { MqttConfig, ConnectionStatus } from '../types';

type MessageCallback = (topic: string, message: string) => void;
type StatusCallback = (status: ConnectionStatus, errorMsg?: string) => void;

class MqttService {
  private client: Client | null = null;
  private messageCallbacks: MessageCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private subscribedTopics: Set<string> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private currentConfig: MqttConfig | null = null;
  private shouldReconnect: boolean = true;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;

  constructor() {
    // Listen for phone foreground events to immediately restore connection
    AppState.addEventListener('change', this.handleAppStateChange);
    this.startWatchdog();
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // Phone screen woke up or app returned to foreground
      if (this.shouldReconnect && (!this.client || !this.client.isConnected())) {
        this.reconnectAttempts = 0;
        this.scheduleReconnect(100);
      }
    }
  };

  public onMessage(callback: MessageCallback) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  public onStatusChange(callback: StatusCallback) {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyStatus(status: ConnectionStatus, errorMsg?: string) {
    this.statusCallbacks.forEach(cb => cb(status, errorMsg));
  }

  private notifyMessage(topic: string, message: string) {
    this.messageCallbacks.forEach(cb => cb(topic, message));
  }

  public connect(config: MqttConfig) {
    if (this.isConnecting) return;
    this.shouldReconnect = true;
    this.currentConfig = config;
    this.isConnecting = true;
    this.notifyStatus('connecting');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (this.client) {
        try {
          if (this.client.isConnected()) {
            this.client.disconnect();
          }
        } catch (_) {}
      }

      const path = config.path.startsWith('/') ? config.path : `/${config.path}`;
      // Append a stable random session id if not present
      const clientId = config.clientId || `home_app_${Math.random().toString(16).substring(2, 8)}`;
      this.client = new Client(config.host, Number(config.port), path, clientId);

      this.client.onConnectionLost = (responseObject) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        const err = responseObject?.errorMessage || 'Connection lost';
        this.notifyStatus('disconnected', err);
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.client.onMessageArrived = (msg: Message) => {
        try {
          const topic = msg.destinationName;
          const payload = msg.payloadString;
          this.notifyMessage(topic, payload);
        } catch (e) {
          console.warn('Error processing incoming MQTT message:', e);
        }
      };

      const connectOptions: any = {
        timeout: 10,
        keepAliveInterval: 20, // 20s keepalive to prevent carrier/NAT drop
        cleanSession: true,
        useSSL: config.useSSL,
        onSuccess: () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyStatus('connected');
          this.startHeartbeat();

          // Re-subscribe to all active topics
          this.subscribedTopics.forEach(topic => {
            try {
              this.client?.subscribe(topic, { qos: 1 });
            } catch (_) {}
          });
        },
        onFailure: (err: any) => {
          this.isConnecting = false;
          this.stopHeartbeat();
          const errString = err?.errorMessage || 'Failed to connect';
          this.notifyStatus('error', errString);
          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        },
      };

      if (config.username) {
        connectOptions.userName = config.username;
        connectOptions.password = config.password || '';
      }

      this.client.connect(connectOptions);
    } catch (err: any) {
      this.isConnecting = false;
      this.stopHeartbeat();
      this.notifyStatus('error', err?.message || 'MQTT Initialization Error');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Active application-level heartbeat every 15s to guarantee
   * mobile network carriers and Wi-Fi routers never drop the socket.
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.client && this.client.isConnected()) {
        try {
          const msg = new Message(JSON.stringify({ t: Date.now() }));
          msg.destinationName = 'home/heartbeat';
          msg.qos = 0;
          this.client.send(msg);
        } catch (_) {}
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Background watchdog checking connection state every 8s
   */
  private startWatchdog() {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      if (this.shouldReconnect && !this.isConnecting && this.currentConfig) {
        if (!this.client || !this.client.isConnected()) {
          this.scheduleReconnect(500);
        }
      }
    }, 8000);
  }

  private scheduleReconnect(delayMs?: number) {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    // Reconnect quickly (2s) on early attempts, max 10s backoff
    const delay = delayMs ?? Math.min(2000 * Math.min(this.reconnectAttempts, 4), 10000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentConfig && this.shouldReconnect) {
        this.connect(this.currentConfig);
      }
    }, delay);
  }

  public subscribe(topic: string) {
    this.subscribedTopics.add(topic);
    if (this.client && this.client.isConnected()) {
      try {
        this.client.subscribe(topic, { qos: 1 });
      } catch (e) {
        console.warn(`Failed to subscribe to ${topic}:`, e);
      }
    }
  }

  public publish(topic: string, payload: string, retained: boolean = false) {
    if (!this.client || !this.client.isConnected()) {
      console.warn('MQTT Client not connected. Cannot publish message.');
      return false;
    }
    try {
      const msg = new Message(payload);
      msg.destinationName = topic;
      msg.qos = 1;
      msg.retained = retained;
      this.client.send(msg);
      return true;
    } catch (e) {
      console.error(`Failed to publish to ${topic}:`, e);
      return false;
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client && this.client.isConnected()) {
      try {
        this.client.disconnect();
      } catch (e) {
        console.warn('Error during disconnect:', e);
      }
    }
    this.notifyStatus('disconnected');
  }

  public isConnected(): boolean {
    return !!(this.client && this.client.isConnected());
  }
}

export const mqttClient = new MqttService();
