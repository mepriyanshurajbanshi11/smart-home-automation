import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Header } from './src/components/Header';
import { SensorCard } from './src/components/SensorCard';
import { QuickScenes } from './src/components/QuickScenes';
import { RoomTabs } from './src/components/RoomTabs';
import { DeviceCard } from './src/components/DeviceCard';
import { SettingsModal } from './src/components/SettingsModal';
import { mqttClient } from './src/services/mqttClient';
import { DEFAULT_MQTT_CONFIG, INITIAL_DEVICES } from './src/constants/config';
import { Device, MqttConfig, RoomId, SensorData, ConnectionStatus } from './src/types';

const STORAGE_KEY_CONFIG = '@smart_home_mqtt_config_v1';

export default function App() {
  const [config, setConfig] = useState<MqttConfig>(DEFAULT_MQTT_CONFIG);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [selectedRoom, setSelectedRoom] = useState<RoomId>('all');
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 24.5,
    humidity: 52,
    motionDetected: false,
    lastUpdated: 'Just now',
  });
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Load saved MQTT configuration
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_CONFIG);
        if (saved) {
          const parsed = JSON.parse(saved);
          setConfig(parsed);
          mqttClient.connect(parsed);
          return;
        }
      } catch (e) {
        console.warn('Failed to load saved config:', e);
      }
      mqttClient.connect(DEFAULT_MQTT_CONFIG);
    })();
  }, []);

  // Listen to MQTT status changes
  useEffect(() => {
    const unsubscribeStatus = mqttClient.onStatusChange((newStatus, errorMsg) => {
      setStatus(newStatus);
      if (newStatus === 'error' && errorMsg) {
        console.warn('MQTT Error:', errorMsg);
      }
    });

    return () => {
      unsubscribeStatus();
    };
  }, []);

  // Listen to incoming MQTT messages
  useEffect(() => {
    const unsubscribeMessage = mqttClient.onMessage((topic, payload) => {
      try {
        // 1. Temperature Telemetry
        if (topic.includes('sensors/temperature')) {
          const data = JSON.parse(payload);
          const temp = typeof data === 'object' ? data.value : parseFloat(data);
          if (!isNaN(temp)) {
            setSensorData(prev => ({
              ...prev,
              temperature: temp,
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
          }
          return;
        }

        // 2. Humidity Telemetry
        if (topic.includes('sensors/humidity')) {
          const data = JSON.parse(payload);
          const hum = typeof data === 'object' ? data.value : parseFloat(data);
          if (!isNaN(hum)) {
            setSensorData(prev => ({ ...prev, humidity: hum }));
          }
          return;
        }

        // 3. Motion Telemetry
        if (topic.includes('sensors/motion')) {
          const data = JSON.parse(payload);
          const motion = typeof data === 'object' ? !!data.motion_detected : data === 'ON' || data === 'true';
          setSensorData(prev => ({ ...prev, motionDetected: motion }));
          return;
        }

        // 4. Device State Updates
        setDevices(prevDevices =>
          prevDevices.map(dev => {
            if (dev.stateTopic === topic) {
              let newState = dev.state;
              let newValue = dev.value;

              try {
                const parsed = JSON.parse(payload);
                if (typeof parsed === 'object') {
                  if (parsed.state !== undefined) {
                    newState = String(parsed.state).toUpperCase() === 'ON' || parsed.state === true;
                  }
                  if (parsed.brightness !== undefined) newValue = parsed.brightness;
                  if (parsed.speed !== undefined) newValue = parsed.speed;
                  if (parsed.temperature !== undefined) newValue = parsed.temperature;
                } else {
                  newState = String(parsed).toUpperCase() === 'ON';
                }
              } catch (_) {
                newState = payload.trim().toUpperCase() === 'ON';
              }

              return { ...dev, state: newState, value: newValue };
            }
            return dev;
          })
        );
      } catch (err) {
        console.warn('Error parsing incoming topic payload:', topic, payload, err);
      }
    });

    // Subscribe to sensor and device state topics
    mqttClient.subscribe('home/sensors/#');
    mqttClient.subscribe('home/+/+/state');
    mqttClient.subscribe('home/status');

    return () => {
      unsubscribeMessage();
    };
  }, []);

  const handleToggleDevice = useCallback((id: string, currentState: boolean) => {
    const nextState = !currentState;
    setDevices(prev =>
      prev.map(d => (d.id === id ? { ...d, state: nextState } : d))
    );

    const targetDev = devices.find(d => d.id === id);
    if (targetDev) {
      const payload = JSON.stringify({
        state: nextState ? 'ON' : 'OFF',
        active: nextState,
        value: targetDev.value,
      });
      mqttClient.publish(targetDev.cmdTopic, payload);
    }
  }, [devices]);

  const handleValueChange = useCallback((id: string, newValue: number) => {
    setDevices(prev =>
      prev.map(d => (d.id === id ? { ...d, value: newValue } : d))
    );

    const targetDev = devices.find(d => d.id === id);
    if (targetDev) {
      const payload = JSON.stringify({
        state: targetDev.state ? 'ON' : 'OFF',
        brightness: targetDev.type === 'light' ? newValue : undefined,
        speed: targetDev.type === 'fan' ? newValue : undefined,
        temperature: targetDev.type === 'ac' ? newValue : undefined,
      });
      mqttClient.publish(targetDev.cmdTopic, payload);
    }
  }, [devices]);

  const handleTriggerScene = useCallback((sceneId: string) => {
    if (sceneId === 'all_off') {
      setDevices(prev => prev.map(d => ({ ...d, state: false })));
      devices.forEach(d => {
        mqttClient.publish(d.cmdTopic, JSON.stringify({ state: 'OFF' }));
      });
    } else if (sceneId === 'movie_mode') {
      // Dim living room light to 20%, turn on media plug
      setDevices(prev =>
        prev.map(d => {
          if (d.id === 'lr_light') return { ...d, state: true, value: 20 };
          if (d.id === 'lr_plug') return { ...d, state: true };
          return d;
        })
      );
      mqttClient.publish('home/living_room/light/set', JSON.stringify({ state: 'ON', brightness: 20 }));
      mqttClient.publish('home/living_room/plug/set', JSON.stringify({ state: 'ON' }));
    } else if (sceneId === 'night_mode') {
      // Turn off main room lights, turn on bedside lamp dimmed
      setDevices(prev =>
        prev.map(d => {
          if (d.id === 'lr_light' || d.id === 'kitch_light') return { ...d, state: false };
          if (d.id === 'bed_light') return { ...d, state: true, value: 15 };
          return d;
        })
      );
      mqttClient.publish('home/living_room/light/set', JSON.stringify({ state: 'OFF' }));
      mqttClient.publish('home/kitchen/light/set', JSON.stringify({ state: 'OFF' }));
      mqttClient.publish('home/bedroom/light/set', JSON.stringify({ state: 'ON', brightness: 15 }));
    } else if (sceneId === 'leaving') {
      // Turn off all, arm security
      setDevices(prev =>
        prev.map(d => {
          if (d.id === 'out_alarm') return { ...d, state: true };
          return { ...d, state: false };
        })
      );
      devices.forEach(d => {
        if (d.id !== 'out_alarm') {
          mqttClient.publish(d.cmdTopic, JSON.stringify({ state: 'OFF' }));
        }
      });
      mqttClient.publish('home/security/alarm/set', JSON.stringify({ state: 'ON', armed: true }));
    }
  }, [devices]);

  const handleSaveSettings = async (newConfig: MqttConfig) => {
    setConfig(newConfig);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
    } catch (e) {
      console.warn('Failed to save config to storage:', e);
    }
    mqttClient.connect(newConfig);
  };

  const handleReconnect = () => {
    mqttClient.connect(config);
  };

  const filteredDevices =
    selectedRoom === 'all'
      ? devices
      : devices.filter(d => d.room === selectedRoom);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Top Header */}
      <Header
        status={status}
        brokerHost={config.host}
        onOpenSettings={() => setSettingsOpen(true)}
        onRefresh={handleReconnect}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sensor Metrics Overview */}
        <SensorCard sensorData={sensorData} />

        {/* Quick Scenes */}
        <QuickScenes onTriggerScene={handleTriggerScene} />

        {/* Room Filter Tabs */}
        <RoomTabs selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />

        {/* Device Cards Grid */}
        <View style={styles.devicesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedRoom === 'all' ? 'All Connected Appliances' : 'Room Devices'}
            </Text>
            <Text style={styles.deviceCount}>
              {filteredDevices.filter(d => d.state).length} / {filteredDevices.length} ON
            </Text>
          </View>

          {filteredDevices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onToggle={handleToggleDevice}
              onValueChange={handleValueChange}
            />
          ))}
        </View>
      </ScrollView>

      {/* MQTT Broker Settings Modal */}
      <SettingsModal
        visible={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  devicesSection: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  deviceCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
});
