import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TextInput, Image, FlatList, ActivityIndicator, TouchableOpacity, Animated, Alert } from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import { useToast } from '../contextApi/ToastContext';
import { useNotifications } from '../contextApi/NotificationContext';
import {
  searchUsersWithStatus,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
} from '../services/friendService';

const SearchFriend = () => {
  const navigation = useNavigation();
  const [input, setInput] = useState("");
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingIds, setLoadingIds] = useState({});
  const auth = getAuth();
  const user = auth.currentUser;
  const { showToast } = useToast();
  const { sendFriendRequestNotification } = useNotifications();

  // Skeleton Loader Component
  const SkeletonItem = () => {
    const shimmerAnim = new Animated.Value(0);

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, []);

    const opacity = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <View style={styles.skeletonContainer}>
        <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
        <View style={styles.skeletonContent}>
          <Animated.View style={[styles.skeletonName, { opacity }]} />
          <Animated.View style={[styles.skeletonEmail, { opacity }]} />
        </View>
      </View>
    );
  };

  const handleInputChange = (text) => {
    setInput(text);
  };

  // Search users with friendship status via service
  useEffect(() => {
    if (!input || !user?.uid) {
      setFriendsList([]);
      return;
    }

    const handleSearch = async () => {
      try {
        setLoading(true);
        const results = await searchUsersWithStatus(input, user.uid);
        const mapped = results.map((u, idx) => ({
          id: idx,
          name: u.name,
          photoUrl: u.photoURL,
          email: u.email,
          UID: u.UID,
          isFriend: u.friendStatus.status === 'friend',
          hasSentRequest: u.friendStatus.status === 'sent',
          hasReceivedRequest: u.friendStatus.status === 'received',
          sentRequestId: u.friendStatus.status === 'sent' ? u.friendStatus.docId : null,
          receivedRequestId: u.friendStatus.status === 'received' ? u.friendStatus.docId : null,
          receivedRequestData: u.friendStatus.status === 'received' ? u.friendStatus.data : null,
        }));
        setFriendsList(mapped);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setLoading(false);
      }
    };
    handleSearch();
  }, [input, user?.uid]);

  // Guard helper for preventing double-taps
  const withLoading = async (uid, fn) => {
    if (loadingIds[uid]) return;
    setLoadingIds(prev => ({ ...prev, [uid]: true }));
    try {
      await fn();
    } finally {
      setLoadingIds(prev => ({ ...prev, [uid]: false }));
    }
  };

  // Gửi lời mời kết bạn
  const handleAddFriend = async (friend) => {
    withLoading(friend.UID, async () => {
      try {
        const userDoc = { uid: user.uid, name: user.displayName, email: user.email, photoURL: user.photoURL };
        const friendDoc = { uid: friend.UID, name: friend.name, email: friend.email, photoURL: friend.photoUrl };
        await sendFriendRequest(userDoc, friendDoc);
        showToast(`Đã gửi lời mời kết bạn tới ${friend.name}`, 'success');
        setFriendsList(prev => prev.map(f =>
          f.UID === friend.UID ? { ...f, hasSentRequest: true } : f
        ));
        // Push notification
        await sendFriendRequestNotification(friend.UID, user.uid, user.displayName);
      } catch (error) {
        showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
        console.error("Error adding friend:", error);
      }
    });
  };

  // Hủy lời mời kết bạn đã gửi
  const handleCancelFriendRequest = async (friend) => {
    Alert.alert(
      'Hủy lời mời kết bạn',
      `Bạn có chắc muốn hủy lời mời kết bạn với ${friend.name}?`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy lời mời',
          style: 'destructive',
          onPress: () => withLoading(friend.UID, async () => {
            try {
              await cancelFriendRequest(user.uid, friend.UID);
              showToast(`Đã hủy lời mời kết bạn với ${friend.name}`, 'success');
              setFriendsList(prev => prev.map(f =>
                f.UID === friend.UID ? { ...f, hasSentRequest: false, sentRequestId: null } : f
              ));
            } catch (error) {
              showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
              console.error("Error canceling friend request:", error);
            }
          })
        }
      ]
    );
  };

  // Chấp nhận lời mời kết bạn
  const handleAcceptFriendRequest = async (friend) => {
    withLoading(friend.UID, async () => {
      try {
        const myInfo = { uid: user.uid, name: user.displayName, email: user.email, photoURL: user.photoURL };
        const friendInfo = {
          uid: friend.UID,
          name: friend.name,
          email: friend.email,
          photoURL: friend.photoUrl,
          ID_roomChat: friend.receivedRequestData?.ID_roomChat || '',
        };
        await acceptFriendRequest(myInfo, friendInfo);
        showToast(`Đã chấp nhận kết bạn với ${friend.name}`, 'success');
        setFriendsList(prev => prev.map(f =>
          f.UID === friend.UID ? { ...f, isFriend: true, hasReceivedRequest: false } : f
        ));
      } catch (error) {
        showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
        console.error("Error accepting friend request:", error);
      }
    });
  };

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      style={styles.friendItem}
      activeOpacity={0.7}
    >
      <Image
        style={styles.avatar}
        source={{ uri: item.photoUrl || 'https://via.placeholder.com/60' }}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>

      {/* Đã là bạn bè */}
      {item.isFriend && (
        <View style={styles.friendBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#4caf50" />
          <Text style={styles.friendBadgeText}>Bạn bè</Text>
        </View>
      )}

      {/* Đã gửi lời mời - hiện nút Hủy */}
      {!item.isFriend && item.hasSentRequest && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancelFriendRequest(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle-outline" size={18} color="#fff" />
          <Text style={styles.cancelButtonText}>Hủy lời mời</Text>
        </TouchableOpacity>
      )}

      {/* Đã nhận lời mời từ người này */}
      {!item.isFriend && item.hasReceivedRequest && (
        <View style={styles.receivedRequestContainer}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptFriendRequest(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.acceptButtonText}>Chấp nhận</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chưa có quan hệ - hiện nút Kết bạn */}
      {!item.isFriend && !item.hasSentRequest && !item.hasReceivedRequest && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddFriend(item)}
          disabled={loadingIds[item.UID]}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Kết bạn</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.searchContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.searchInputContainer}>
            <AntDesign name="search1" size={18} color="#666" />
            <TextInput
              style={styles.searchInput}
              value={input}
              onChangeText={handleInputChange}
              placeholder="Tìm kiếm bạn bè..."
              placeholderTextColor="#999"
              autoFocus={true}
            />
            {input.length > 0 && (
              <TouchableOpacity onPress={() => setInput("")} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {input.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Tìm kiếm bạn bè</Text>
            <Text style={styles.emptySubText}>Nhập tên để tìm kiếm</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </View>
        ) : friendsList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Không tìm thấy</Text>
            <Text style={styles.emptySubText}>Không có kết quả cho "{input}"</Text>
          </View>
        ) : (
          <FlatList
            data={friendsList}
            renderItem={renderFriendItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#006AF5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },

  // Skeleton Loaders
  loadingContainer: {
    backgroundColor: '#fff',
  },
  skeletonContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonName: {
    height: 16,
    width: '60%',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonEmail: {
    height: 14,
    width: '80%',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },

  // Friend Item
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    backgroundColor: '#e0e0e0',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 13,
    color: '#666',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#006AF5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    gap: 6,
    elevation: 2,
    shadowColor: '#006AF5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    flexDirection: 'row',
    backgroundColor: '#ff6b6b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
    elevation: 2,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  receivedRequestContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    elevation: 2,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 16,
  },
  friendBadgeText: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },

  // List
  listContent: {
    backgroundColor: '#fff',
  },
});

export default SearchFriend;
