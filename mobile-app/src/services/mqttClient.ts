import { Client, Message } from 'paho-mqtt';
import { MqttConfig, ConnectionStatus } from '../types';

type MessageCallback = (topic: string, message: string) => void;
type StatusCallback = (status: ConnectionStatus, errorMsg?: string) => void;

class MqttService {
  private client: Client | null = null;
  private messageCallbacks: MessageCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private subscribedTopics: Set<string> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentConfig: MqttConfig | null = null;
  private shouldReconnect: boolean = true;
  private isConnecting: boolean = false;

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
      if (this.client && this.client.isConnected()) {
        try {
          this.client.disconnect();
        } catch (_) {}
      }

      const path = config.path.startsWith('/') ? config.path : `/${config.path}`;
      this.client = new Client(config.host, Number(config.port), path, config.clientId);

      this.client.onConnectionLost = (responseObject) => {
        this.isConnecting = false;
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
        keepAliveInterval: 30,
        cleanSession: true,
        useSSL: config.useSSL,
        onSuccess: () => {
          this.isConnecting = false;
          this.notifyStatus('connected');
          // Re-subscribe to all active topics
          this.subscribedTopics.forEach(topic => {
            this.client?.subscribe(topic, { qos: 1 });
          });
        },
        onFailure: (err: any) => {
          this.isConnecting = false;
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
      this.notifyStatus('error', err?.message || 'MQTT Initialization Error');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentConfig && this.shouldReconnect) {
        this.connect(this.currentConfig);
      }
    }, 5000);
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
