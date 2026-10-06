import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SensorData } from '../types';

interface SensorCardProps {
  sensorData: SensorData;
}

export const SensorCard: React.FC<SensorCardProps> = ({ sensorData }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Environment & Sensors</Text>
      
      <View style={styles.grid}>
        {/* Temperature Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="thermometer" size={20} color="#D97706" />
            </View>
            <Text style={styles.badgeText}>Ambient</Text>
          </View>
          <Text style={styles.valueText}>
            {sensorData.temperature.toFixed(1)}
            <Text style={styles.unitText}>°C</Text>
          </Text>
          <Text style={styles.label}>Temperature</Text>
        </View>

        {/* Humidity Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="water" size={20} color="#0284C7" />
            </View>
            <Text style={styles.badgeText}>Indoor</Text>
          </View>
          <Text style={styles.valueText}>
            {sensorData.humidity.toFixed(0)}
            <Text style={styles.unitText}>%</Text>
          </Text>
          <Text style={styles.label}>Humidity</Text>
        </View>

        {/* Motion Sensor Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: sensorData.motionDetected ? '#FEE2E2' : '#DCFCE7',
                },
              ]}
            >
              <Ionicons
                name={sensorData.motionDetected ? 'walk' : 'shield-checkmark'}
                size={20}
                color={sensorData.motionDetected ? '#DC2626' : '#16A34A'}
              />
            </View>
            <View
              style={[
                styles.indicatorDot,
                { backgroundColor: sensorData.motionDetected ? '#EF4444' : '#22C55E' },
              ]}
            />
          </View>
          <Text
            style={[
              styles.motionText,
              { color: sensorData.motionDetected ? '#EF4444' : '#22C55E' },
            ]}
          >
            {sensorData.motionDetected ? 'Active' : 'Clear'}
          </Text>
          <Text style={styles.label}>PIR Motion</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  valueText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  motionText: {
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
});
