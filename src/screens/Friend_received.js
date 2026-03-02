import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { getAuth } from "firebase/auth";
import { useNotifications } from '../contextApi/NotificationContext';
import { useToast } from '../contextApi/ToastContext';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import { subscribeToReceivedRequests, acceptFriendRequest, declineFriendRequest } from '../services/friendService';
import { getUserById } from '../services/userService';

const Friend_received = () => {

  const [userFriendsList, setUserFriendsList] = useState([]);
  const [loadingIds, setLoadingIds] = useState([]);
  const { sendFriendRequestAcceptedNotification } = useNotifications();
  const { showToast } = useToast();
  const auth = getAuth();
  const user = auth.currentUser;

  // Lắng nghe danh sách lời mời đã nhận real-time
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToReceivedRequests(user.uid, (requests) => {
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

  // Chấp nhận kết bạn — dùng friendService (atomic batch)
  const handleAddFriend = async (friend) => {
    if (loadingIds.includes(friend.UID)) return;
    setLoadingIds((prev) => [...prev, friend.UID]);
    try {
      const myData = await getUserById(user.uid);
      if (!myData) throw new Error('User data not found');

      await acceptFriendRequest(
        { uid: user.uid, name: myData.name, email: myData.email, photoURL: myData.photoURL },
        { uid: friend.UID, name: friend.name, email: friend.email, photoURL: friend.photoUrl, ID_roomChat: friend.ID_roomChat }
      );

      // Gửi notification cho người gửi lời mời
      await sendFriendRequestAcceptedNotification(friend.UID, user.uid, myData.name);
      showToast(`Đã chấp nhận kết bạn với ${friend.name}`, 'success');
    } catch (error) {
      console.error("Error accepting friend:", error);
      showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== friend.UID));
    }
  };

  // Từ chối kết bạn — dùng friendService (atomic batch)
  const handleCancel = async (friend) => {
    if (loadingIds.includes(friend.UID)) return;
    setLoadingIds((prev) => [...prev, friend.UID]);
    try {
      await declineFriendRequest(user.uid, friend.UID);
      showToast(`Đã từ chối lời mời của ${friend.name}`, 'success');
    } catch (error) {
      console.error("Error declining friend request:", error);
      showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== friend.UID));
    }
  };

  const renderUserFriendItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.containerProfile}>
        <Avatar uri={item.photoUrl} name={item.name} size="medium" />
        <View style={styles.infoContainer}>
          <Text style={styles.text}>{item.name}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.acceptButton} onPress={() => handleAddFriend(item)} activeOpacity={0.7}>
              <Text style={styles.acceptButtonText}>Chấp nhận</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineButton} onPress={() => handleCancel(item)} activeOpacity={0.7}>
              <Text style={styles.declineButtonText}>Từ chối</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {userFriendsList.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Không có lời mời kết bạn"
          subtitle="Các lời mời kết bạn mới sẽ hiển thị ở đây"
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
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#006AF5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  declineButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  declineButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default Friend_received;
