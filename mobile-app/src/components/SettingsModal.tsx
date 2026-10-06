import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MqttConfig } from '../types';

interface SettingsModalProps {
  visible: boolean;
  config: MqttConfig;
  onClose: () => void;
  onSave: (newConfig: MqttConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  config,
  onClose,
  onSave,
}) => {
  const [host, setHost] = useState(config.host);
  const [port, setPort] = useState(config.port.toString());
  const [path, setPath] = useState(config.path);
  const [clientId, setClientId] = useState(config.clientId);
  const [username, setUsername] = useState(config.username || '');
  const [password, setPassword] = useState(config.password || '');
  const [useSSL, setUseSSL] = useState(config.useSSL);

  const handleSave = () => {
    onSave({
      host: host.trim(),
      port: parseInt(port.trim(), 10) || 9001,
      path: path.trim() || '/mqtt',
      clientId: clientId.trim() || `smart_home_${Date.now()}`,
      username: username.trim(),
      password: password.trim(),
      useSSL,
    });
    onClose();
  };

  const applyPreset = (presetHost: string, presetPort: number, ssl: boolean) => {
    setHost(presetHost);
    setPort(presetPort.toString());
    setUseSSL(ssl);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>MQTT Broker Settings</Text>
              <Text style={styles.subtitle}>Configure Raspberry Pi / Broker Connection</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Quick Presets */}
            <Text style={styles.sectionTitle}>Quick Presets</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset('broker.emqx.io', 8083, false)}
              >
                <Text style={styles.presetText}>Public EMQX</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset('192.168.1.100', 9001, false)}
              >
                <Text style={styles.presetText}>Raspberry Pi (LAN)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset('10.0.2.2', 9001, false)}
              >
                <Text style={styles.presetText}>Android Emulator</Text>
              </TouchableOpacity>
            </View>

            {/* Inputs */}
            <Text style={styles.inputLabel}>Broker Host / IP</Text>
            <TextInput
              style={styles.input}
              value={host}
              onChangeText={setHost}
              placeholder="e.g. 192.168.1.100 or broker.emqx.io"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>WebSocket Port</Text>
                <TextInput
                  style={styles.input}
                  value={port}
                  onChangeText={setPort}
                  placeholder="9001 or 8083"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.inputLabel}>WS Path</Text>
                <TextInput
                  style={styles.input}
                  value={path}
                  onChangeText={setPath}
                  placeholder="/mqtt"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Enable SSL / TLS (WSS)</Text>
                <Text style={styles.switchSub}>Use for secure encrypted connections</Text>
              </View>
              <Switch
                value={useSSL}
                onValueChange={setUseSSL}
                trackColor={{ false: '#334155', true: '#38BDF880' }}
                thumbColor={useSSL ? '#38BDF8' : '#94A3B8'}
              />
            </View>

            <Text style={styles.inputLabel}>Client ID</Text>
            <TextInput
              style={styles.input}
              value={clientId}
              onChangeText={setClientId}
              placeholder="Client Identifier"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Username (Optional)</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="MQTT Username"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Password (Optional)</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="MQTT Password"
              placeholderTextColor="#64748B"
              secureTextEntry
              autoCapitalize="none"
            />
          </ScrollView>

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Ionicons name="cloud-upload-outline" size={20} color="#0F172A" />
              <Text style={styles.saveBtnText}>Save & Reconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    maxHeight: 460,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  presetChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  switchSub: {
    fontSize: 11,
    color: '#64748B',
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
  },
  saveBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
});
