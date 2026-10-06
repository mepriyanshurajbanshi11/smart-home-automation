import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface TorchControllerProps {
  torchOn: boolean;
  onPermissionDenied?: () => void;
}

export const TorchController: React.FC<TorchControllerProps> = ({
  torchOn,
  onPermissionDenied,
}) => {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (torchOn && Platform.OS !== 'web') {
      if (!permission) {
        // Permission loading
        return;
      }
      if (!permission.granted) {
        requestPermission().then((res) => {
          if (!res.granted) {
            Alert.alert(
              'Flashlight Permission Required',
              'Android and iOS require Camera/Torch permission strictly to control your physical flashlight LED.',
              [{ text: 'OK' }]
            );
            onPermissionDenied?.();
          }
        });
      }
    }
  }, [torchOn, permission]);

  // Web does not support physical camera torch
  if (Platform.OS === 'web' || !permission?.granted) {
    return null;
  }

  return (
    <View style={styles.hiddenCamera}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    bottom: -100,
    right: -100,
  },
  camera: {
    width: 1,
    height: 1,
  },
});
