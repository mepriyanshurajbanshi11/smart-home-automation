import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Header } from './src/components/Header';
import { SensorCard } from './src/components/SensorCard';
import { QuickScenes } from './src/components/QuickScenes';
import { RoomTabs } from './src/components/RoomTabs';
import { DeviceCard } from './src/components/DeviceCard';
import { SettingsModal } from './src/components/SettingsModal';
import { TorchController } from './src/components/TorchController';
import { ScreenLampModal } from './src/components/ScreenLampModal';
import { mqttClient } from './src/services/mqttClient';
import { DEFAULT_MQTT_CONFIG, INITIAL_DEVICES } from './src/constants/config';
import { useKeepAwake } from 'expo-keep-awake';
import { Device, MqttConfig, RoomId, SensorData, ConnectionStatus } from './src/types';

const STORAGE_KEY_CONFIG = '@smart_home_mqtt_config_v1';
const STORAGE_KEY_OFFLINE = '@smart_home_offline_mode_v1';

export default function App() {
  // Prevent mobile screen from sleeping/locking to maintain permanent MQTT connection
  useKeepAwake();

  const [config, setConfig] = useState<MqttConfig>(DEFAULT_MQTT_CONFIG);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false); // Enabled online by default so laptop can control!
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [selectedRoom, setSelectedRoom] = useState<RoomId>('all');
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 24.2,
    humidity: 50,
    motionDetected: false,
    lastUpdated: 'Live',
  });
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [screenLampOpen, setScreenLampOpen] = useState<boolean>(false);

  // Find mobile torch state
  const mobileTorch = devices.find(d => d.id === 'mobile_torch');
  const isTorchActive = !!mobileTorch?.state;
  const torchBrightness = mobileTorch?.value ?? 100;

  // Load saved settings & offline mode preference
  useEffect(() => {
    (async () => {
      try {
        const savedOffline = await AsyncStorage.getItem(STORAGE_KEY_OFFLINE);
        const offline = savedOffline !== null ? JSON.parse(savedOffline) : false;
        setIsOfflineMode(offline);

        const savedConfig = await AsyncStorage.getItem(STORAGE_KEY_CONFIG);
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          setConfig(parsed);
          if (!offline) {
            mqttClient.connect(parsed);
          }
          return;
        }
      } catch (e) {
        console.warn('Failed to load settings from storage:', e);
      }
      mqttClient.connect(DEFAULT_MQTT_CONFIG);
    })();
  }, []);

  // Offline ambient sensor simulator
  useEffect(() => {
    if (!isOfflineMode) return;

    const interval = setInterval(() => {
      setSensorData(prev => {
        const tempDelta = (Math.random() - 0.5) * 0.2;
        const newTemp = Math.round((prev.temperature + tempDelta) * 10) / 10;
        const humDelta = (Math.random() - 0.5) * 0.5;
        const newHum = Math.round(prev.humidity + humDelta);
        const motion = Math.random() < 0.08;

        return {
          temperature: Math.max(18, Math.min(30, newTemp)),
          humidity: Math.max(35, Math.min(75, newHum)),
          motionDetected: motion,
          lastUpdated: 'Live (Local)',
        };
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isOfflineMode]);

  // Listen to MQTT status changes when in online mode
  useEffect(() => {
    if (isOfflineMode) return;

    const unsubscribeStatus = mqttClient.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribeStatus();
    };
  }, [isOfflineMode]);

  // Listen to incoming MQTT messages when in online mode
  useEffect(() => {
    if (isOfflineMode) return;

    const unsubscribeMessage = mqttClient.onMessage((topic, payload) => {
      try {
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

        if (topic.includes('sensors/humidity')) {
          const data = JSON.parse(payload);
          const hum = typeof data === 'object' ? data.value : parseFloat(data);
          if (!isNaN(hum)) {
            setSensorData(prev => ({ ...prev, humidity: hum }));
          }
          return;
        }

        if (topic.includes('sensors/motion')) {
          const data = JSON.parse(payload);
          const motion = typeof data === 'object' ? !!data.motion_detected : data === 'ON' || data === 'true';
          setSensorData(prev => ({ ...prev, motionDetected: motion }));
          return;
        }

        // Device State & Command Updates (from Laptop or other controllers)
        setDevices(prevDevices =>
          prevDevices.map(dev => {
            const isMatch =
              dev.stateTopic === topic ||
              dev.cmdTopic === topic ||
              (dev.id === 'mobile_torch' && (topic === 'home/torch/set' || topic === 'home/flashlight/set'));

            if (isMatch) {
              let newState = dev.state;
              let newValue = dev.value;
              try {
                const parsed = JSON.parse(payload);
                if (typeof parsed === 'object') {
                  if (parsed.state !== undefined) {
                    newState = String(parsed.state).toUpperCase() === 'ON' || parsed.state === true || parsed.state === 1;
                  }
                  if (parsed.brightness !== undefined) newValue = parsed.brightness;
                  if (parsed.speed !== undefined) newValue = parsed.speed;
                  if (parsed.temperature !== undefined) newValue = parsed.temperature;
                } else {
                  newState = String(parsed).toUpperCase() === 'ON' || parsed === '1';
                }
              } catch (_) {
                const clean = payload.trim().toUpperCase();
                newState = clean === 'ON' || clean === '1' || clean === 'TRUE';
              }

              // If this was a command from the laptop, publish confirmation state back
              if (dev.cmdTopic === topic || topic.endsWith('/set')) {
                mqttClient.publish(
                  dev.stateTopic,
                  JSON.stringify({ state: newState ? 'ON' : 'OFF', active: newState, value: newValue })
                );
              }

              return { ...dev, state: newState, value: newValue };
            }
            return dev;
          })
        );
      } catch (err) {
        console.warn('MQTT message parse error:', err);
      }
    });

    // Subscriptions
    mqttClient.subscribe('home/sensors/#');
    mqttClient.subscribe('home/+/+/state');
    mqttClient.subscribe('home/+/+/set');
    mqttClient.subscribe('home/torch/set');
    mqttClient.subscribe('home/flashlight/set');
    mqttClient.subscribe('home/status');

    return () => {
      unsubscribeMessage();
    };
  }, [isOfflineMode]);

  const toggleOfflineMode = async () => {
    const nextMode = !isOfflineMode;
    setIsOfflineMode(nextMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_OFFLINE, JSON.stringify(nextMode));
    } catch (_) {}

    if (nextMode) {
      mqttClient.disconnect();
      setStatus('disconnected');
    } else {
      mqttClient.connect(config);
    }
  };

  const handleToggleDevice = useCallback((id: string, currentState: boolean) => {
    const nextState = !currentState;
    setDevices(prev =>
      prev.map(d => (d.id === id ? { ...d, state: nextState } : d))
    );

    const targetDev = devices.find(d => d.id === id);
    if (targetDev && !isOfflineMode) {
      const payload = JSON.stringify({
        state: nextState ? 'ON' : 'OFF',
        active: nextState,
        value: targetDev.value,
      });
      mqttClient.publish(targetDev.cmdTopic, payload);
    }
  }, [devices, isOfflineMode]);

  const handleValueChange = useCallback((id: string, newValue: number) => {
    setDevices(prev =>
      prev.map(d => (d.id === id ? { ...d, value: newValue } : d))
    );

    const targetDev = devices.find(d => d.id === id);
    if (targetDev && !isOfflineMode) {
      const payload = JSON.stringify({
        state: targetDev.state ? 'ON' : 'OFF',
        brightness: targetDev.type === 'light' ? newValue : undefined,
        speed: targetDev.type === 'fan' ? newValue : undefined,
        temperature: targetDev.type === 'ac' ? newValue : undefined,
      });
      mqttClient.publish(targetDev.cmdTopic, payload);
    }
  }, [devices, isOfflineMode]);

  const handleTriggerScene = useCallback((sceneId: string) => {
    if (sceneId === 'all_off') {
      setDevices(prev => prev.map(d => ({ ...d, state: false })));
      if (!isOfflineMode) {
        devices.forEach(d => {
          mqttClient.publish(d.cmdTopic, JSON.stringify({ state: 'OFF' }));
        });
      }
    } else if (sceneId === 'movie_mode') {
      setDevices(prev =>
        prev.map(d => {
          if (d.id === 'lr_light' || d.id === 'mobile_torch') return { ...d, state: true, value: 20 };
          if (d.id === 'lr_plug') return { ...d, state: true };
          return d;
        })
      );
      if (!isOfflineMode) {
        mqttClient.publish('home/living_room/light/set', JSON.stringify({ state: 'ON', brightness: 20 }));
        mqttClient.publish('home/living_room/plug/set', JSON.stringify({ state: 'ON' }));
      }
    } else if (sceneId === 'night_mode') {
      setDevices(prev =>
        prev.map(d => {
          if (d.id === 'lr_light' || d.id === 'kitch_light') return { ...d, state: false };
          if (d.id === 'bed_light') return { ...d, state: true, value: 15 };
          return d;
        })
      );
      if (!isOfflineMode) {
        mqttClient.publish('home/living_room/light/set', JSON.stringify({ state: 'OFF' }));
        mqttClient.publish('home/kitchen/light/set', JSON.stringify({ state: 'OFF' }));
        mqttClient.publish('home/bedroom/light/set', JSON.stringify({ state: 'ON', brightness: 15 }));
      }
    } else if (sceneId === 'leaving') {
      setDevices(prev =>
        prev.map(d => {
          if (d.id === 'out_alarm') return { ...d, state: true };
          return { ...d, state: false };
        })
      );
      if (!isOfflineMode) {
        devices.forEach(d => {
          if (d.id !== 'out_alarm') {
            mqttClient.publish(d.cmdTopic, JSON.stringify({ state: 'OFF' }));
          }
        });
        mqttClient.publish('home/security/alarm/set', JSON.stringify({ state: 'ON', armed: true }));
      }
    }
  }, [devices, isOfflineMode]);

  const handleSaveSettings = async (newConfig: MqttConfig) => {
    setConfig(newConfig);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
    } catch (_) {}
    if (!isOfflineMode) {
      mqttClient.connect(newConfig);
    }
  };

  const filteredDevices =
    selectedRoom === 'all'
      ? devices
      : devices.filter(d => d.room === selectedRoom);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Physical Hardware Torch Controller (Hidden CameraView) */}
      <TorchController
        torchOn={isTorchActive}
        onPermissionDenied={() => {
          // If camera permission is denied, keep UI in sync
          setDevices(prev =>
            prev.map(d => (d.id === 'mobile_torch' ? { ...d, state: false } : d))
          );
        }}
      />

      {/* Screen Ambient Lamp Modal */}
      <ScreenLampModal
        visible={screenLampOpen}
        brightness={torchBrightness}
        onClose={() => setScreenLampOpen(false)}
        onBrightnessChange={(val) => handleValueChange('mobile_torch', val)}
      />

      {/* Top Header */}
      <Header
        status={status}
        brokerHost={config.host}
        isOfflineMode={isOfflineMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onRefresh={() => {
          if (!isOfflineMode) mqttClient.connect(config);
        }}
        onToggleOfflineMode={toggleOfflineMode}
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
              onOpenScreenLamp={
                device.id === 'mobile_torch'
                  ? () => setScreenLampOpen(true)
                  : undefined
              }
            />
          ))}
        </View>
      </ScrollView>

      {/* Settings Modal */}
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
