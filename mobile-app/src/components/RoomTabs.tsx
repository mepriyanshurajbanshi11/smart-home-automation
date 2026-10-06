import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ROOMS } from '../constants/config';
import { RoomId } from '../types';

interface RoomTabsProps {
  selectedRoom: RoomId;
  onSelectRoom: (room: RoomId) => void;
}

export const RoomTabs: React.FC<RoomTabsProps> = ({ selectedRoom, onSelectRoom }) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ROOMS.map((room) => {
          const isSelected = selectedRoom === room.id;
          return (
            <TouchableOpacity
              key={room.id}
              style={[
                styles.tab,
                isSelected && styles.tabSelected,
              ]}
              onPress={() => onSelectRoom(room.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={room.icon as any}
                size={16}
                color={isSelected ? '#0F172A' : '#94A3B8'}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabText,
                  isSelected && styles.tabTextSelected,
                ]}
              >
                {room.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabSelected: {
    backgroundColor: '#38BDF8', // Cyan/Sky accent
    borderColor: '#38BDF8',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextSelected: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
