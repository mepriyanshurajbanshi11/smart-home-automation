import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  brokerHost: string;
  onOpenSettings: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  brokerHost,
  onOpenSettings,
  onRefresh,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#10B981'; // Emerald Green
      case 'connecting':
        return '#F59E0B'; // Amber
      case 'error':
        return '#EF4444'; // Red
      default:
        return '#64748B'; // Slate Gray
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Online';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Offline';
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>Smart Living</Text>
        <TouchableOpacity style={styles.statusRow} onPress={onRefresh} activeOpacity={0.7}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
          <Text style={styles.brokerText}>• {brokerHost}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconButton} onPress={onRefresh} accessibilityLabel="Refresh connection">
          <Ionicons name="refresh-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onOpenSettings} accessibilityLabel="MQTT Settings">
          <Ionicons name="settings-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#0F172A',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  brokerText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
});
