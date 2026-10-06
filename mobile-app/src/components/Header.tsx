import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  brokerHost: string;
  isOfflineMode: boolean;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onToggleOfflineMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  brokerHost,
  isOfflineMode,
  onOpenSettings,
  onRefresh,
  onToggleOfflineMode,
}) => {
  const getStatusColor = () => {
    if (isOfflineMode) return '#38BDF8'; // Sky Blue for Local Mode
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
    if (isOfflineMode) return 'Local / Offline Mode';
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
        <TouchableOpacity style={styles.statusRow} onPress={onToggleOfflineMode} activeOpacity={0.7}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, isOfflineMode && { color: '#38BDF8' }]}>
            {getStatusText()}
          </Text>
          {!isOfflineMode && <Text style={styles.brokerText}>• {brokerHost}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.iconButton, isOfflineMode && styles.offlineActiveButton]}
          onPress={onToggleOfflineMode}
          accessibilityLabel="Toggle Local/Online Mode"
        >
          <Ionicons
            name={isOfflineMode ? 'flash' : 'cloud-outline'}
            size={20}
            color={isOfflineMode ? '#0F172A' : '#94A3B8'}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onOpenSettings} accessibilityLabel="MQTT Settings">
          <Ionicons name="settings-outline" size={20} color="#94A3B8" />
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
  offlineActiveButton: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
});
