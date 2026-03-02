import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  toggleNotificationReadStatus
} from '../services/notificationService';
import { getUserById } from '../services/userService';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'

  // Load notifications from Firestore
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToNotifications(
      currentUser.uid,
      (notificationsList) => {
        setNotifications(notificationsList);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        Alert.alert('Lỗi tải thông báo', error.message);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
    } catch (error) {
      // Error marking notification as read
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await markAllNotificationsRead(unreadNotifications);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể đánh dấu tất cả là đã đọc');
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await removeNotification(notificationId);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa thông báo');
    }
  };

  // Handle notification press - navigate to correct screen
  const handleNotificationPress = async (notification) => {
    // Mark as read first
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    const { type, data } = notification;

    switch (type) {
      case 'new_message':
      case 'message':
        // Navigate to chat
        if (data?.roomId) {
          try {
            let senderName = data.senderName || notification.title;
            let senderPhoto = data.senderPhoto;

            // If no sender photo, try to get from users collection
            if (!senderPhoto && data.senderId) {
              try {
                const senderData = await getUserById(data.senderId);
                if (senderData) {
                  senderName = senderData.name || senderName;
                  senderPhoto = senderData.profileImageUrl || senderData.photoURL;
                }
              } catch (e) {
                // Error getting user info
              }
            }

            navigation.navigate('Chat_fr', {
              friendId: data.senderId,
              friendName: senderName,
              friendPhoto: senderPhoto,
              roomId: data.roomId,
              RoomID: data.roomId,
            });
          } catch (error) {
            console.error('Error navigating to chat:', error);
            navigation.navigate('Chat_fr', {
              friendId: data.senderId,
              friendName: data.senderName || notification.title,
              roomId: data.roomId,
              RoomID: data.roomId,
            });
          }
        }
        break;

      case 'friend_request':
        // Navigate to friend requests
        navigation.navigate('Friend_received');
        break;

      case 'friend_accept':
      case 'friend_accepted':
        // Navigate to friends list or user profile
        if (data?.senderId) {
          navigation.navigate('Personal_page', { friendId: data.senderId });
        } else {
          navigation.navigate('Friends');
        }
        break;

      case 'post_reaction':
      case 'post_like':
        // Navigate to the post
        if (data?.postId) {
          navigation.navigate('PostDetail', { postId: data.postId });
        }
        break;

      case 'post_comment':
      case 'comment':
        // Navigate to post with comment highlighted
        if (data?.postId) {
          navigation.navigate('PostDetail', {
            postId: data.postId,
            focusComment: true,
            commentId: data.commentId
          });
        }
        break;

      case 'comment_reply':
        // Navigate to post with reply highlighted
        if (data?.postId) {
          navigation.navigate('PostDetail', {
            postId: data.postId,
            focusComment: true,
            commentId: data.commentId
          });
        }
        break;

      case 'comment_like':
        // Navigate to post with comment
        if (data?.postId) {
          navigation.navigate('PostDetail', {
            postId: data.postId,
            focusComment: true,
            commentId: data.commentId
          });
        }
        break;

      case 'post_share':
      case 'share':
        // Navigate to the shared post
        if (data?.postId) {
          navigation.navigate('PostDetail', { postId: data.postId });
        }
        break;

      case 'group_invite':
        // Navigate to group chat
        if (data?.groupId) {
          navigation.navigate('Chat_fr', {
            roomId: data.groupId,
            RoomID: data.groupId,
            isGroup: true,
          });
        }
        break;

      case 'mention':
        // Navigate to post or comment where mentioned
        if (data?.postId) {
          navigation.navigate('PostDetail', {
            postId: data.postId,
            focusComment: data.commentId ? true : false,
            commentId: data.commentId
          });
        }
        break;

      default:
        if (data?.postId) {
          navigation.navigate('PostDetail', { postId: data.postId });
        } else if (data?.roomId) {
          navigation.navigate('Chat_fr', {
            roomId: data.roomId,
            RoomID: data.roomId,
          });
        } else if (data?.senderId) {
          navigation.navigate('Personal_page', { friendId: data.senderId });
        }
        break;
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_message':
      case 'message':
        return { name: 'chatbubble', color: '#006AF5' };
      case 'friend_request':
        return { name: 'person-add', color: '#FF9500' };
      case 'friend_accept':
      case 'friend_accepted':
        return { name: 'people', color: '#34C759' };
      case 'post_reaction':
      case 'post_like':
        return { name: 'heart', color: '#FF3B30' };
      case 'post_comment':
      case 'comment':
      case 'comment_reply':
        return { name: 'chatbubble-ellipses', color: '#5856D6' };
      case 'comment_like':
        return { name: 'thumbs-up', color: '#007AFF' };
      case 'post_share':
      case 'share':
        return { name: 'share-social', color: '#FF2D55' };
      case 'group_invite':
        return { name: 'people-circle', color: '#AF52DE' };
      case 'mention':
        return { name: 'at', color: '#5AC8FA' };
      default:
        return { name: 'notifications', color: '#8E8E93' };
    }
  };

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffSec < 60) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;
    if (diffWeek < 4) return `${diffWeek} tuần trước`;
    if (diffMonth < 12) return `${diffMonth} tháng trước`;
    return date.toLocaleDateString('vi-VN');
  };

  // Render notification item
  const renderNotificationItem = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          isUnread && styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => {
          Alert.alert(
            'Tùy chọn',
            'Bạn muốn làm gì với thông báo này?',
            [
              { text: 'Hủy', style: 'cancel' },
              {
                text: isUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc',
                onPress: () => toggleNotificationReadStatus(item.id, !isUnread)
              },
              {
                text: 'Xóa',
                style: 'destructive',
                onPress: () => deleteNotification(item.id)
              },
            ]
          );
        }}
      >
        <View style={styles.notificationContent}>
          {/* Avatar or Icon */}
          <View style={styles.avatarContainer}>
            {item.data?.senderPhoto ? (
              <Image
                source={{ uri: item.data.senderPhoto }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
                <Ionicons name={icon.name} size={24} color={icon.color} />
              </View>
            )}
            {/* Type badge */}
            <View style={[styles.typeBadge, { backgroundColor: icon.color }]}>
              <Ionicons name={icon.name} size={12} color="#FFF" />
            </View>
          </View>

          {/* Text content */}
          <View style={styles.textContainer}>
            <Text
              style={[styles.notificationTitle, isUnread && styles.unreadText]}
              numberOfLines={1}
            >
              {item.title || 'Thông báo'}
            </Text>
            <Text
              style={[styles.notificationBody, isUnread && styles.unreadText]}
              numberOfLines={2}
            >
              {item.body || ''}
            </Text>
            <Text style={styles.timeText}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>

          {/* Unread indicator */}
          {isUnread && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  // Unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#006AF5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
          >
            <Ionicons name="checkmark-done" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.activeFilter]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
            Tất cả
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.activeFilter]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.activeFilterText]}>
            Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'read' && styles.activeFilter]}
          onPress={() => setFilter('read')}
        >
          <Text style={[styles.filterText, filter === 'read' && styles.activeFilterText]}>
            Đã đọc
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications list */}
      {filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>
            {filter === 'unread'
              ? 'Không có thông báo chưa đọc'
              : filter === 'read'
                ? 'Không có thông báo đã đọc'
                : 'Chưa có thông báo nào'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotificationItem}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              colors={['#006AF5']}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#006AF5',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  markAllButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F0F0F0',
  },
  activeFilter: {
    backgroundColor: '#006AF5',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: '#FFF',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  notificationItem: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
  },
  unreadNotification: {
    backgroundColor: '#E8F4FF',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  textContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  unreadText: {
    fontWeight: '600',
    color: '#000',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#006AF5',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default NotificationsScreen;
