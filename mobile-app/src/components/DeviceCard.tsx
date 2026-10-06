import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Device } from '../types';

interface DeviceCardProps {
  device: Device;
  onToggle: (id: string, currentState: boolean) => void;
  onValueChange: (id: string, newValue: number) => void;
  onOpenScreenLamp?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onToggle,
  onValueChange,
  onOpenScreenLamp,
}) => {
  const getDeviceIcon = () => {
    switch (device.type) {
      case 'light':
        return device.state ? 'bulb' : 'bulb-outline';
      case 'fan':
        return 'sync-outline';
      case 'plug':
        return 'power-outline';
      case 'ac':
        return 'snow-outline';
      case 'alarm':
        return device.state ? 'shield-checkmark' : 'shield-outline';
      default:
        return 'cube-outline';
    }
  };

  const getThemeColor = () => {
    if (!device.state) return '#64748B';
    switch (device.type) {
      case 'light':
        return '#F59E0B'; // Amber Glow
      case 'fan':
        return '#06B6D4'; // Cyan
      case 'plug':
        return '#10B981'; // Green
      case 'ac':
        return '#3B82F6'; // Blue
      case 'alarm':
        return '#EF4444'; // Red
      default:
        return '#38BDF8';
    }
  };

  const themeColor = getThemeColor();

  return (
    <View
      style={[
        styles.card,
        device.state && { borderColor: `${themeColor}40` },
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: device.state ? `${themeColor}20` : '#334155' },
          ]}
        >
          <Ionicons name={getDeviceIcon() as any} size={24} color={themeColor} />
        </View>

        <Switch
          value={device.state}
          onValueChange={() => onToggle(device.id, device.state)}
          trackColor={{ false: '#334155', true: `${themeColor}80` }}
          thumbColor={device.state ? themeColor : '#94A3B8'}
        />
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {device.name}
        </Text>
        <Text style={styles.statusLabel}>
          {device.state ? 'Running / ON' : 'Turned OFF'}
        </Text>
      </View>

      {/* Special button for Mobile Flashlight: Screen Lamp */}
      {device.id === 'mobile_torch' && onOpenScreenLamp && (
        <TouchableOpacity
          style={styles.screenLampBtn}
          onPress={onOpenScreenLamp}
          activeOpacity={0.7}
        >
          <Ionicons name="sunny-outline" size={16} color="#38BDF8" />
          <Text style={styles.screenLampText}>Open Screen Lamp Mode</Text>
        </TouchableOpacity>
      )}

      {/* Control adjustment for Light (Brightness), AC (Temp), Fan (Speed) */}
      {device.state && device.value !== undefined && (
        <View style={styles.controlRow}>
          <Text style={styles.valueLabel}>
            {device.type === 'ac' ? 'Target:' : 'Level:'}{' '}
            <Text style={{ color: themeColor, fontWeight: '700' }}>
              {device.value}
              {device.unit}
            </Text>
          </Text>

          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                const step = device.type === 'fan' ? 1 : device.type === 'ac' ? 1 : 10;
                const min = device.type === 'fan' ? 1 : device.type === 'ac' ? 16 : 10;
                if ((device.value ?? 0) > min) {
                  onValueChange(device.id, (device.value ?? 0) - step);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={16} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                const step = device.type === 'fan' ? 1 : device.type === 'ac' ? 1 : 10;
                const max = device.type === 'fan' ? 3 : device.type === 'ac' ? 30 : 100;
                if ((device.value ?? 0) < max) {
                  onValueChange(device.id, (device.value ?? 0) + step);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    marginBottom: 6,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  valueLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenLampBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#38BDF840',
    gap: 6,
  },
  screenLampText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
});
