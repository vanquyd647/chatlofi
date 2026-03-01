import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const PERMISSIONS_KEY = '@permissions_requested';

const PermissionsScreen = ({ navigation }) => {
  const [permissions, setPermissions] = useState({
    notifications: null,
    camera: null,
    mediaLibrary: null,
    location: null,
    microphone: null,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [allGranted, setAllGranted] = useState(false);

  const permissionItems = [
    {
      key: 'notifications',
      title: 'Thông báo',
      description: 'Nhận thông báo tin nhắn mới, lời mời kết bạn và cập nhật từ bạn bè.',
      icon: <Ionicons name="notifications" size={40} color="#006AF5" />,
      required: true,
    },
    {
      key: 'camera',
      title: 'Máy ảnh',
      description: 'Chụp ảnh và quay video để chia sẻ với bạn bè.',
      icon: <Ionicons name="camera" size={40} color="#006AF5" />,
      required: true,
    },
    {
      key: 'mediaLibrary',
      title: 'Thư viện ảnh',
      description: 'Truy cập ảnh và video để chia sẻ trong tin nhắn và bài đăng.',
      icon: <MaterialIcons name="photo-library" size={40} color="#006AF5" />,
      required: true,
    },
    {
      key: 'microphone',
      title: 'Microphone',
      description: 'Ghi âm giọng nói cho tin nhắn thoại và cuộc gọi video.',
      icon: <FontAwesome5 name="microphone" size={36} color="#006AF5" />,
      required: true,
    },
    {
      key: 'location',
      title: 'Vị trí',
      description: 'Chia sẻ vị trí của bạn với bạn bè trong tin nhắn.',
      icon: <Ionicons name="location" size={40} color="#006AF5" />,
      required: false,
    },
  ];

  useEffect(() => {
    checkExistingPermissions();
  }, []);

  useEffect(() => {
    // Check if all required permissions are granted
    const requiredPermissions = permissionItems.filter(p => p.required);
    const allRequiredGranted = requiredPermissions.every(
      p => permissions[p.key] === 'granted'
    );
    setAllGranted(allRequiredGranted);
  }, [permissions]);

  const checkExistingPermissions = async () => {
    try {
      // Check notification permission
      const notifStatus = await Notifications.getPermissionsAsync();

      // Check camera permission (using ImagePicker)
      const cameraStatus = await ImagePicker.getCameraPermissionsAsync();

      // Check media library permission
      const mediaStatus = await MediaLibrary.getPermissionsAsync();

      // Check location permission
      const locationStatus = await Location.getForegroundPermissionsAsync();

      // Check microphone permission
      const micStatus = await Audio.getPermissionsAsync();

      setPermissions({
        notifications: notifStatus.status,
        camera: cameraStatus.status,
        mediaLibrary: mediaStatus.status,
        location: locationStatus.status,
        microphone: micStatus.status,
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestPermission = async (permissionKey) => {
    try {
      let result;

      switch (permissionKey) {
        case 'notifications':
          result = await Notifications.requestPermissionsAsync();
          break;
        case 'camera':
          result = await ImagePicker.requestCameraPermissionsAsync();
          break;
        case 'mediaLibrary':
          result = await MediaLibrary.requestPermissionsAsync();
          break;
        case 'location':
          result = await Location.requestForegroundPermissionsAsync();
          break;
        case 'microphone':
          result = await Audio.requestPermissionsAsync();
          break;
        default:
          return;
      }

      setPermissions(prev => ({
        ...prev,
        [permissionKey]: result.status,
      }));

      // If permission denied, show alert to open settings
      if (result.status === 'denied') {
        Alert.alert(
          'Quyền bị từ chối',
          'Bạn có thể cấp quyền này trong Cài đặt của điện thoại.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error(`Error requesting ${permissionKey} permission:`, error);
    }
  };

  const requestAllPermissions = async () => {
    for (const item of permissionItems) {
      if (permissions[item.key] !== 'granted') {
        await requestPermission(item.key);
      }
    }
  };

  const handleContinue = async () => {
    // Save that permissions have been requested
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');

    // Navigate to main app
    navigation.replace('Login');
  };

  const handleSkip = async () => {
    Alert.alert(
      'Bỏ qua cấp quyền?',
      'Một số tính năng của ứng dụng có thể không hoạt động đúng nếu không được cấp quyền.',
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Bỏ qua',
          onPress: async () => {
            await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'granted':
        return '#4CAF50';
      case 'denied':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'granted':
        return 'Đã cấp';
      case 'denied':
        return 'Bị từ chối';
      default:
        return 'Chưa cấp';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="chatbubbles" size={60} color="#006AF5" />
          </View>
          <Text style={styles.title}>Cấp quyền cho ChatLofi</Text>
          <Text style={styles.subtitle}>
            Để sử dụng đầy đủ tính năng, vui lòng cấp các quyền sau
          </Text>
        </View>

        {/* Permission List */}
        <View style={styles.permissionList}>
          {permissionItems.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={styles.permissionItem}
              onPress={() => requestPermission(item.key)}
              activeOpacity={0.7}
            >
              <View style={styles.permissionIcon}>{item.icon}</View>
              <View style={styles.permissionInfo}>
                <View style={styles.permissionHeader}>
                  <Text style={styles.permissionTitle}>
                    {item.title}
                    {item.required && <Text style={styles.required}> *</Text>}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(permissions[item.key]) },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusText(permissions[item.key])}
                    </Text>
                  </View>
                </View>
                <Text style={styles.permissionDescription}>
                  {item.description}
                </Text>
              </View>
              <MaterialIcons
                name={
                  permissions[item.key] === 'granted'
                    ? 'check-circle'
                    : 'chevron-right'
                }
                size={24}
                color={
                  permissions[item.key] === 'granted' ? '#4CAF50' : '#BDBDBD'
                }
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.requiredNote}>
          * Quyền bắt buộc để sử dụng ứng dụng
        </Text>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.requestAllButton}
          onPress={requestAllPermissions}
        >
          <Text style={styles.requestAllText}>Cấp tất cả quyền</Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Bỏ qua</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.continueButton,
              !allGranted && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!allGranted}
          >
            <Text
              style={[
                styles.continueText,
                !allGranted && styles.continueTextDisabled,
              ]}
            >
              Tiếp tục
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#E3F2FD',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionList: {
    marginTop: 10,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  permissionIcon: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 25,
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  required: {
    color: '#F44336',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  requiredNote: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 10,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  requestAllButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  requestAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#006AF5',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  continueButton: {
    flex: 2,
    backgroundColor: '#006AF5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  continueTextDisabled: {
    color: '#FFFFFF',
  },
});

export default PermissionsScreen;
