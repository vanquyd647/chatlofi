import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { getAuth } from "firebase/auth";
import { useToast } from '../contextApi/ToastContext';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import { subscribeToSentRequests, cancelFriendRequest } from '../services/friendService';

const Friend_sents = () => {

  const [userFriendsList, setUserFriendsList] = useState([]);
  const [loadingIds, setLoadingIds] = useState([]);
  const { showToast } = useToast();
  const auth = getAuth();
  const user = auth.currentUser;

  // Lắng nghe danh sách lời mời đã gửi real-time
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToSentRequests(user.uid, (requests) => {
      const mapped = requests.map((req) => ({
        id: req.id,
        name: req.name_fr,
        photoUrl: req.photoURL_fr,
        email: req.email_fr,
        UID: req.UID_fr,
        ID_roomChat: req.ID_roomChat,
      }));
      setUserFriendsList(mapped);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Hủy lời mời kết bạn — dùng friendService (atomic batch)
  const handleCancel = async (friend) => {
    if (loadingIds.includes(friend.UID)) return;
    setLoadingIds((prev) => [...prev, friend.UID]);
    try {
      await cancelFriendRequest(user.uid, friend.UID);
      showToast(`Đã hủy lời mời kết bạn với ${friend.name}`, 'success');
    } catch (error) {
      console.error("Error canceling friend request:", error);
      showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== friend.UID));
    }
  };

  // Hàm render mỗi item trong danh sách
  const renderUserFriendItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.containerProfile}>
        <Avatar uri={item.photoUrl} name={item.name} size="medium" />
        <View style={styles.infoContainer}>
          <Text style={styles.text}>{item.name}</Text>
        </View>
        <TouchableOpacity
          style={[styles.cancelButton, loadingIds.includes(item.UID) && styles.cancelButtonDisabled]}
          onPress={() => handleCancel(item)}
          disabled={loadingIds.includes(item.UID)}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>
            {loadingIds.includes(item.UID) ? 'Đang hủy...' : 'Hủy lời mời'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {userFriendsList.length === 0 ? (
        <EmptyState
          icon="paper-plane-outline"
          title="Không có lời mời đã gửi"
          subtitle="Các lời mời kết bạn bạn đã gửi sẽ hiển thị ở đây"
        />
      ) : (
        <FlatList
          data={userFriendsList}
          renderItem={renderUserFriendItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  itemContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  containerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    backgroundColor: '#006AF5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonDisabled: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default Friend_sents;
