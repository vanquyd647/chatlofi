import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { getAuth, signOut } from "firebase/auth";
import { subscribeToUser } from '../services/userService';
import { useNotifications } from '../contextApi/NotificationContext';
import AppHeader from '../components/AppHeader';
import Avatar from '../components/Avatar';
// Native Firebase Auth for syncing with Realtime Database
import nativeAuth from '@react-native-firebase/auth';

const Setting_app = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  const user = auth.currentUser;
  const { removePushToken, clearAllNotifications } = useNotifications();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUser(user.uid, setUserData);
    return () => unsubscribe();
  }, [user]);

  const onHandleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              if (user) {
                await removePushToken(user.uid);
                await clearAllNotifications();
              }
              await signOut(auth);
              try {
                await nativeAuth().signOut();
              } catch (nativeError) {
                // Native Auth signout failed silently
              }
            } catch (err) {
              Alert.alert("Lỗi", err.message);
            }
          },
        },
      ]
    );
  };

  const SettingItem = ({ icon, iconColor, title, subtitle, onPress, showDivider = true, danger = false }) => (
    <>
      <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.settingIcon, { backgroundColor: (iconColor || '#006AF5') + '15' }]}>
          <Ionicons name={icon} size={22} color={danger ? '#F44336' : (iconColor || '#006AF5')} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, danger && { color: '#F44336' }]}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
      {showDivider && <View style={styles.divider} />}
    </>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <AppHeader title="Cài đặt" onBack={() => navigation.goBack()} />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* User Profile Card */}
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => navigation.navigate("Personal_page", { userId: user?.uid })}
            activeOpacity={0.7}
          >
            <Avatar uri={userData?.photoURL} name={userData?.name} size="large" />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userData?.name || 'Người dùng'}</Text>
              <Text style={styles.profileEmail}>{userData?.email || ''}</Text>
              <Text style={styles.profileLink}>Xem trang cá nhân</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          {/* Account Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tài khoản</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="person-outline"
                title="Thông tin cá nhân"
                subtitle="Chỉnh sửa tên, ảnh đại diện"
                onPress={() => navigation.navigate("Edit_in4Personal")}
              />
              <SettingItem
                icon="shield-checkmark-outline"
                title="Quyền riêng tư"
                subtitle="Quản lý quyền riêng tư"
                showDivider={false}
              />
            </View>
          </View>

          {/* General Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chung</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="notifications-outline"
                iconColor="#FF9800"
                title="Thông báo"
                subtitle="Âm thanh, rung, hiển thị"
              />
              <SettingItem
                icon="chatbubbles-outline"
                iconColor="#4CAF50"
                title="Tin nhắn"
                subtitle="Cỡ chữ, hình nền chat"
                showDivider={false}
              />
            </View>
          </View>

          {/* App Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="information-circle-outline"
                iconColor="#2196F3"
                title="Phiên bản ứng dụng"
                subtitle="1.0.0"
                showDivider={false}
              />
            </View>
          </View>

          {/* Logout */}
          <View style={styles.section}>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="log-out-outline"
                iconColor="#F44336"
                title="Đăng xuất"
                onPress={onHandleLogout}
                showDivider={false}
                danger
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profileLink: {
    fontSize: 13,
    color: '#006AF5',
    fontWeight: '500',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 24,
    marginBottom: 6,
    marginTop: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 68,
  },
});

export default Setting_app;
