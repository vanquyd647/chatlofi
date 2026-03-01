import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TextInput, Image, FlatList, ActivityIndicator, TouchableOpacity, Animated, Alert } from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useToast } from '../contextApi/ToastContext';
import { useNotifications } from '../contextApi/NotificationContext';

const SearchFriend = () => {
  const navigation = useNavigation();
  const [input, setInput] = useState("");
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;
  const [ID_roomChat, setID_roomChat] = useState("");
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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        console.log("User not logged in.");
        // You might want to navigate to the login screen here if not logged in
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleSearch = async () => {
      try {
        setLoading(true); // Set loading state to true while fetching data
        const db = getFirestore();
        const userQuery = query(collection(db, "users"), where("name", "==", input));
        const userSnapshot = await getDocs(userQuery);
        const foundFriends = [];
        const currentUser = auth.currentUser;
        let index = 0; // Bắt đầu với index = 0
        userSnapshot.forEach(doc => {
          const userData = doc.data();
          console.log(userData)
          if (userData.UID !== currentUser.uid) {
            foundFriends.push({
              id: index++,
              name: userData.name,
              photoUrl: userData.photoURL,
              email: userData.email,
              UID: userData.UID,
              ID_roomChat: ID_roomChat
            });
          }
        });
        const updatedFriendsList = [];
        for (const friend of foundFriends) {
          const isFriend = await checkFriendshipStatus(friend.UID);
          const pendingStatus = await checkPendingFriendRequest(friend.UID);
          updatedFriendsList.push({ ...friend, isFriend, ...pendingStatus });
        }
        setFriendsList(updatedFriendsList);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false); // Set loading state back to false
      }
    };
    handleSearch();
  }, [input, user.uid]);

  const checkFriendshipStatus = async (UID) => {
    console.log(UID);
    try {
      const db = getFirestore();
      const currentUser = auth.currentUser;
      console.log(currentUser);
      const currentUserDocRef = doc(db, "users", currentUser.uid);
      const friendDataQuery = query(collection(currentUserDocRef, "friendData"), where("UID_fr", "==", UID));
      const friendDataSnapshot = await getDocs(friendDataQuery);
      return !friendDataSnapshot.empty; // Trả về true nếu có dữ liệu, ngược lại trả về false
    } catch (error) {
      console.error("Error checking friendship status:", error);
      return false; // Trả về false nếu có lỗi xảy ra
    }
  };

  // Kiểm tra xem đã gửi lời mời kết bạn chưa hoặc đã nhận lời mời chưa
  const checkPendingFriendRequest = async (UID) => {
    try {
      const db = getFirestore();
      const currentUser = auth.currentUser;
      const currentUserDocRef = doc(db, "users", currentUser.uid);

      // Kiểm tra đã gửi lời mời chưa
      const friendSentsQuery = query(collection(currentUserDocRef, "friend_Sents"), where("UID_fr", "==", UID));
      const friendSentsSnapshot = await getDocs(friendSentsQuery);

      if (!friendSentsSnapshot.empty) {
        const sentDoc = friendSentsSnapshot.docs[0];
        return {
          hasSentRequest: true,
          hasReceivedRequest: false,
          sentRequestId: sentDoc.id,
          sentRequestData: sentDoc.data()
        };
      }

      // Kiểm tra đã nhận lời mời chưa
      const friendReceivedsQuery = query(collection(currentUserDocRef, "friend_Receiveds"), where("UID_fr", "==", UID));
      const friendReceivedsSnapshot = await getDocs(friendReceivedsQuery);

      if (!friendReceivedsSnapshot.empty) {
        const receivedDoc = friendReceivedsSnapshot.docs[0];
        return {
          hasSentRequest: false,
          hasReceivedRequest: true,
          receivedRequestId: receivedDoc.id,
          receivedRequestData: receivedDoc.data()
        };
      }

      return { hasSentRequest: false, hasReceivedRequest: false };
    } catch (error) {
      console.error("Error checking pending friend request:", error);
      return { hasSentRequest: false, hasReceivedRequest: false };
    }
  };

  // Tìm hoặc tạo chat room - KHÔNG tạo mới nếu đã có

  // Tìm hoặc tạo chat room - KHÔNG tạo mới nếu đã có
  const findOrCreateChatRoom = async (friendData) => {
    const generateRandomId = () => {
      const characters = 'abcdef0123456789';
      let result = '0x';
      const charactersLength = characters.length;
      for (let i = 0; i < 12; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      return result;
    };
    console.log("Finding or creating chat room with:", friendData)
    try {
      const db = getFirestore();
      const currentUser = auth.currentUser;

      // Sắp xếp UID của hai người dùng theo thứ tự từ điển
      const sortedUIDs = [currentUser.uid, friendData.UID].sort();
      const UID_Chats = sortedUIDs.join("_");

      // Kiểm tra xem đã có chat room giữa 2 user chưa
      const chatsRef = collection(db, "Chats");
      const existingChatQuery = query(chatsRef, where("UID_Chats", "==", UID_Chats));
      const existingChatSnapshot = await getDocs(existingChatQuery);

      if (!existingChatSnapshot.empty) {
        // Đã có chat room, trả về ID của room hiện có
        const existingChatDoc = existingChatSnapshot.docs[0];
        console.log("Found existing chat room:", existingChatDoc.id);
        return existingChatDoc.id;
      }

      // Chưa có chat room, tạo mới
      const chatRoomId = generateRandomId();
      setID_roomChat(chatRoomId);

      const chatRoomRef = doc(db, "Chats", chatRoomId);
      await setDoc(chatRoomRef, {
        ID_roomChat: chatRoomId,
        UID: sortedUIDs,
        UID_Chats: UID_Chats
      });
      console.log("New chat room created:", chatRoomId);
      return chatRoomId;
    } catch (error) {
      console.error("Error finding or creating chat room:", error);
      return null;
    }
  };


  // nút thêm bạn
  const handleAddFriend = async (friend) => {
    try {
      // Find or create chat room (không tạo mới nếu đã có)
      const chatRoomId = await findOrCreateChatRoom(friend);
      if (chatRoomId) {
        const db = getFirestore();
        const currentUser = auth.currentUser;
        if (currentUser) {
          const currentUserDocRef = doc(db, "users", currentUser.uid);
          const currentUserDocSnapshot = await getDoc(currentUserDocRef);
          if (currentUserDocSnapshot.exists()) {
            const currentUserData = currentUserDocSnapshot.data();
            const friendSentsQuery = query(collection(currentUserDocRef, "friend_Sents"), where("email_fr", "==", friend.email));
            const friendSentsSnapshot = await getDocs(friendSentsQuery);
            if (friendSentsSnapshot.empty) {
              const friend_Sents = {
                name_fr: friend.name,
                photoURL_fr: friend.photoUrl,
                email_fr: friend.email,
                UID_fr: friend.UID,
                ID_roomChat: chatRoomId
              };

              await addDoc(collection(currentUserDocRef, "friend_Sents"), friend_Sents);
              console.log("Added friend request sent");
              const friendDocRef = doc(db, "users", friend.UID);
              const friendDocSnapshot = await getDoc(friendDocRef);
              if (friendDocSnapshot.exists()) {
                const friend_Receiveds = {
                  name_fr: currentUserData.name,
                  photoURL_fr: currentUserData.photoURL,
                  email_fr: currentUserData.email,
                  UID_fr: currentUserData.UID,
                  ID_roomChat: chatRoomId
                };
                await addDoc(collection(friendDocRef, "friend_Receiveds"), friend_Receiveds);
                showToast(`Đã gửi lời mời kết bạn tới ${friend.name}`, 'success');
                console.log("Friend request sent successfully");

                // Cập nhật trạng thái trong list
                setFriendsList(prev => prev.map(f =>
                  f.UID === friend.UID
                    ? { ...f, hasSentRequest: true }
                    : f
                ));

                // Send push notification to friend
                await sendFriendRequestNotification(
                  friend.UID,
                  currentUser.uid,
                  currentUserData.name
                );
              } else {
                showToast('Không tìm thấy người dùng', 'error');
                console.error("Friend document does not exist!");
              }
            } else {
              showToast('Đã gửi lời mời kết bạn trước đó', 'warning');
              console.log("Friend request already sent");
            }
          } else {
            showToast('Lỗi tài khoản người dùng', 'error');
            console.error("User document does not exist!");
          }
        } else {
          showToast('Vui lòng đăng nhập lại', 'error');
          console.error("No user signed in!");
        }
      } else {
        showToast('Không thể tạo phòng chat', 'error');
        console.error("Chat room creation failed");
      }
    } catch (error) {
      showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
      console.error("Error adding friend:", error);
    }
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
          onPress: async () => {
            try {
              const db = getFirestore();
              const currentUser = auth.currentUser;

              if (currentUser) {
                // Xóa từ friend_Sents của current user
                if (friend.sentRequestId) {
                  const friendSentRef = doc(db, "users", currentUser.uid, "friend_Sents", friend.sentRequestId);
                  await deleteDoc(friendSentRef);
                }

                // Xóa từ friend_Receiveds của người kia
                const friendReceivedCollectionRef = collection(db, "users", friend.UID, "friend_Receiveds");
                const q = query(friendReceivedCollectionRef, where("UID_fr", "==", currentUser.uid));
                const querySnapshot = await getDocs(q);

                const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
                await Promise.all(deletePromises);

                showToast(`Đã hủy lời mời kết bạn với ${friend.name}`, 'success');

                // Cập nhật trạng thái trong list
                setFriendsList(prev => prev.map(f =>
                  f.UID === friend.UID
                    ? { ...f, hasSentRequest: false, sentRequestId: null }
                    : f
                ));
              }
            } catch (error) {
              showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
              console.error("Error canceling friend request:", error);
            }
          }
        }
      ]
    );
  };

  // Chấp nhận lời mời kết bạn từ người khác
  const handleAcceptFriendRequest = async (friend) => {
    try {
      const db = getFirestore();
      const currentUser = auth.currentUser;

      if (currentUser && friend.receivedRequestData) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnapshot = await getDoc(userDocRef);

        if (userDocSnapshot.exists()) {
          const userData = userDocSnapshot.data();

          // Thêm vào friendData của current user
          const friendData = {
            name_fr: friend.name,
            photoURL_fr: friend.photoUrl,
            email_fr: friend.email,
            UID_fr: friend.UID,
            ID_roomChat: friend.receivedRequestData.ID_roomChat
          };
          await addDoc(collection(userDocRef, "friendData"), friendData);

          // Xóa từ friend_Receiveds
          const friendReceivedDocRef = doc(userDocRef, "friend_Receiveds", friend.receivedRequestId);
          await deleteDoc(friendReceivedDocRef);

          // Thêm vào friendData của người gửi
          const friendDocRef = doc(db, "users", friend.UID);
          const senderFriendData = {
            name_fr: userData.name,
            photoURL_fr: userData.photoURL,
            email_fr: userData.email,
            UID_fr: userData.UID,
            ID_roomChat: friend.receivedRequestData.ID_roomChat
          };
          await addDoc(collection(friendDocRef, "friendData"), senderFriendData);

          // Xóa từ friend_Sents của người gửi
          const friendSentCollectionRef = collection(friendDocRef, "friend_Sents");
          const friendSentQuery = query(friendSentCollectionRef, where("UID_fr", "==", currentUser.uid));
          const friendSentQuerySnapshot = await getDocs(friendSentQuery);
          const deletePromises = friendSentQuerySnapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);

          showToast(`Đã chấp nhận kết bạn với ${friend.name}`, 'success');

          // Cập nhật trạng thái trong list
          setFriendsList(prev => prev.map(f =>
            f.UID === friend.UID
              ? { ...f, isFriend: true, hasReceivedRequest: false }
              : f
          ));
        }
      }
    } catch (error) {
      showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
      console.error("Error accepting friend request:", error);
    }
  };

  // Function to generate a random 6-digit ID


  const handleFriendAction = async (friendData) => {
    // Call both functions here
    await handleAddFriend(friendData);
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
          onPress={() => handleFriendAction(item)}
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
