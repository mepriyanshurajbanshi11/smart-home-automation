import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuickScenesProps {
  onTriggerScene: (sceneId: string) => void;
}

export const QuickScenes: React.FC<QuickScenesProps> = ({ onTriggerScene }) => {
  const scenes = [
    { id: 'all_off', name: 'All Off', icon: 'power', color: '#EF4444' },
    { id: 'movie_mode', name: 'Movie', icon: 'film-outline', color: '#8B5CF6' },
    { id: 'night_mode', name: 'Night', icon: 'moon-outline', color: '#3B82F6' },
    { id: 'leaving', name: 'Leaving', icon: 'exit-outline', color: '#F59E0B' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Scenes</Text>
      <View style={styles.row}>
        {scenes.map((scene) => (
          <TouchableOpacity
            key={scene.id}
            style={styles.sceneButton}
            onPress={() => onTriggerScene(scene.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${scene.color}20` }]}>
              <Ionicons name={scene.icon as any} size={20} color={scene.color} />
            </View>
            <Text style={styles.sceneName}>{scene.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sceneButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sceneName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
});
