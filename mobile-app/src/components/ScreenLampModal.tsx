import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ScreenLampModalProps {
  visible: boolean;
  brightness: number;
  onClose: () => void;
  onBrightnessChange: (val: number) => void;
}

export const ScreenLampModal: React.FC<ScreenLampModalProps> = ({
  visible,
  brightness,
  onClose,
  onBrightnessChange,
}) => {
  const [colorMode, setColorMode] = useState<'warm' | 'white' | 'ambient'>('warm');

  const getBackgroundColor = () => {
    const alpha = Math.max(0.15, brightness / 100);
    switch (colorMode) {
      case 'warm':
        return `rgba(255, 230, 160, ${alpha})`;
      case 'white':
        return `rgba(255, 255, 255, ${alpha})`;
      case 'ambient':
        return `rgba(56, 189, 248, ${alpha})`;
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <View style={styles.centerContent}>
          <Ionicons
            name="bulb"
            size={90}
            color={colorMode === 'warm' ? '#D97706' : colorMode === 'ambient' ? '#0284C7' : '#475569'}
          />
          <Text style={styles.modeTitle}>Smart Ambient Lamp</Text>
          <Text style={styles.brightnessLabel}>{brightness}% Brightness</Text>

          {/* Color Selector */}
          <View style={styles.colorRow}>
            <TouchableOpacity
              style={[styles.colorChip, colorMode === 'warm' && styles.colorActive]}
              onPress={() => setColorMode('warm')}
            >
              <Text style={styles.colorText}>Warm White</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.colorChip, colorMode === 'white' && styles.colorActive]}
              onPress={() => setColorMode('white')}
            >
              <Text style={styles.colorText}>Pure White</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.colorChip, colorMode === 'ambient' && styles.colorActive]}
              onPress={() => setColorMode('ambient')}
            >
              <Text style={styles.colorText}>Cyber Cyan</Text>
            </TouchableOpacity>
          </View>

          {/* Stepper Controls */}
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => onBrightnessChange(Math.max(10, brightness - 10))}
            >
              <Ionicons name="remove" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{brightness}%</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => onBrightnessChange(Math.min(100, brightness + 10))}
            >
              <Ionicons name="add" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.hintText}>Tap close or turn off in dashboard to exit lamp</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  topBar: {
    alignItems: 'flex-end',
    paddingTop: 24,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
  },
  brightnessLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 6,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  colorChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  colorActive: {
    backgroundColor: '#0F172A',
  },
  colorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  hintText: {
    fontSize: 12,
    color: '#475569',
  },
});
