import React, { useState, useEffect, useCallback, memo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, Pressable, StyleSheet, Text, View, Image, FlatList, Modal, RefreshControl, ActivityIndicator, TouchableOpacity, Animated, Alert } from 'react-native';
import { AntDesign, Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { formatDistanceToNowStrict } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, query, orderBy, where, updateDoc, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useChats } from '../contextApi/ChatContext';
import { useToast } from '../contextApi/ToastContext';

// Memoized ChatItem component để tránh re-render không cần thiết
const ChatItem = memo(({ item, pinnedChats, mutedChats, onPress, onLongPress }) => {
  // Chỉ dùng local state arrays để xác định pin/mute
  const isPinned = pinnedChats.includes(item.ID_room);
  const isMuted = mutedChats.includes(item.ID_room);

  return (
    <TouchableOpacity
      style={[styles.chatItem, isPinned && styles.pinnedChatItem]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {item.Photo_group ? (
          <Image source={{ uri: item.Photo_group }} style={styles.avatar} />
        ) : (
          item.otherUser.photoURL && (
            <Image source={{ uri: item.otherUser.photoURL }} style={styles.avatar} />
          )
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.Name_group || item.otherUser.name}
            </Text>
            {isPinned && (
              <AntDesign name="pushpin" size={14} color="#006AF5" style={{ marginLeft: 4 }} />
            )}
            {isMuted && (
              <Ionicons name="notifications-off" size={14} color="#999" style={{ marginLeft: 4 }} />
            )}
          </View>
          {item.latestMessage && (
            <Text style={styles.timestamp}>
              {formatDistanceToNowStrict(item.latestMessage.createdAt.toDate(), { addSuffix: false, locale: vi })}
            </Text>
          )}
        </View>

        {item.latestMessage && (
          <View style={styles.messagePreview}>
            <Text style={styles.latestMessageText} numberOfLines={1}>
              {item.latestMessage.text || '📷 Hình ảnh'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - chỉ re-render khi tin nhắn thay đổi hoặc trạng thái pin/mute của CHÍNH item này thay đổi
  const prevIsPinned = prevProps.pinnedChats.includes(prevProps.item.ID_room);
  const nextIsPinned = nextProps.pinnedChats.includes(nextProps.item.ID_room);
  const prevIsMuted = prevProps.mutedChats.includes(prevProps.item.ID_room);
  const nextIsMuted = nextProps.mutedChats.includes(nextProps.item.ID_room);

  return (
    prevProps.item.ID_room === nextProps.item.ID_room &&
    prevProps.item.latestMessage?.createdAt?.seconds === nextProps.item.latestMessage?.createdAt?.seconds &&
    prevProps.item.latestMessage?.text === nextProps.item.latestMessage?.text &&
    prevIsPinned === nextIsPinned &&
    prevIsMuted === nextIsMuted
  );
});

const Chat = () => {
  const navigation = useNavigation();
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  const [userData, setUserData] = useState(null);
  const { chats, setChats } = useChats();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [ID_room1, setID_room1] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pinnedChats, setPinnedChats] = useState([]);
  const [mutedChats, setMutedChats] = useState([]);
  const { showToast } = useToast();

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
          <Animated.View style={[styles.skeletonMessage, { opacity }]} />
        </View>
      </View>
    );
  };
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Listen for unread notifications count
  useEffect(() => {
    if (!user) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifications(snapshot.docs.length);
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });

    return () => unsubscribe();
  }, [user, db]);

  // truy xuất dữ liệu người dùng từ firestore
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log('User data:', userData);
          setUserData(userData);
        } else {
          console.log('User not found');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    if (user) {
      fetchUserData();
    }
  }, [db, user]);

  // truy xuất dữ liệu cuộc trò chuyện từ firestore
  // Ref để lưu trữ các unsubscribe functions
  const messageListenersRef = React.useRef(new Map());

  useEffect(() => {
    const fetchChats = () => {
      setLoading(true);
      const chatsCollectionRef = collection(db, 'Chats');
      const chatsQuery = query(chatsCollectionRef, where('UID', 'array-contains', user.uid));

      const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
        // Nếu không có chat nào, set loading = false ngay
        if (snapshot.empty) {
          setLoading(false);
          setChats([]);
          return;
        }

        // Cập nhật local state cho pinnedChats và mutedChats
        const newPinnedChats = [];
        const newMutedChats = [];

        snapshot.docs.forEach((chatDoc) => {
          const chatData = chatDoc.data();

          if (chatData.pinnedBy?.includes(user.uid)) {
            newPinnedChats.push(chatData.ID_roomChat);
          }
          if (chatData.mutedUsers?.includes(user.uid)) {
            newMutedChats.push(chatData.ID_roomChat);
          }
        });

        // Cập nhật local state (chỉ khi thay đổi thực sự)
        setPinnedChats(prev => {
          const prevStr = JSON.stringify([...prev].sort());
          const newStr = JSON.stringify([...newPinnedChats].sort());
          return prevStr === newStr ? prev : newPinnedChats;
        });
        setMutedChats(prev => {
          const prevStr = JSON.stringify([...prev].sort());
          const newStr = JSON.stringify([...newMutedChats].sort());
          return prevStr === newStr ? prev : newMutedChats;
        });

        // Kiểm tra docChanges để xem có phải chỉ thay đổi pin/mute hay không
        const changes = snapshot.docChanges();
        const hasNonMetadataChange = changes.some(change => {
          if (change.type === 'added' || change.type === 'removed') return true;
          // Với 'modified', kiểm tra xem có phải chỉ thay đổi pinnedBy hoặc mutedUsers
          const oldDoc = change.doc;
          // Không thể so sánh trực tiếp, nhưng nếu chỉ có modified thì có thể là pin/mute
          return false; // Giả sử modified chỉ là pin/mute nếu không có added/removed
        });

        // Nếu chỉ có thay đổi modified (pin/mute), không cần re-fetch messages
        if (changes.length > 0 && changes.every(change => change.type === 'modified')) {
          setLoading(false);
          return; // Skip re-fetching messages
        }

        // Xử lý các documents
        snapshot.docs.forEach(async (chatDoc) => {
          const chatData = chatDoc.data();
          const chatRoomId = chatData.ID_roomChat;

          // Nếu đã có listener cho chat này, skip
          if (messageListenersRef.current.has(chatRoomId)) {
            return;
          }

          setID_room1(chatData.ID_roomChat);
          const chatUIDs = chatData.UID.filter((uid) => uid !== user.uid);
          const otherUID = chatUIDs[0];
          const userDocRef = doc(db, 'users', otherUID);

          const unsubscribeUser = onSnapshot(userDocRef, (userDocSnap) => {
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              const messQuery = query(
                collection(db, 'Chats', chatData.ID_roomChat, 'chat_mess'),
                orderBy('createdAt', 'desc')
              );
              const unsubscribeMessages = onSnapshot(messQuery, (messSnapshot) => {
                let latestMessage = null;
                let secondLatestMessage = null;
                if (!messSnapshot.empty) {
                  for (let doc of messSnapshot.docs) {
                    const message = doc.data();
                    const deleteDetailMess = message.deleteDetail_mess || [];
                    const hasUserDelete = deleteDetailMess.some(detail => detail.uidDelete === user.uid);

                    if (!hasUserDelete) {
                      latestMessage = message;
                      break;
                    } else if (!secondLatestMessage) {
                      secondLatestMessage = message;
                    }
                  }
                }
                const detailDeleteArray = chatData.detailDelete || [];
                const latestDeleteTime = detailDeleteArray.reduce((latest, detail) => {
                  if (detail.uidDelete === user.uid && detail.timeDelete.toDate() > latest) {
                    return detail.timeDelete.toDate();
                  }
                  return latest;
                }, 0);

                const validMessage = (!latestDeleteTime || (latestMessage && latestMessage.createdAt && latestMessage.createdAt.toDate() > latestDeleteTime)) ? latestMessage : secondLatestMessage;

                if (validMessage) {
                  const chatItem = {
                    ID_room: chatData.ID_roomChat,
                    Admin_group: chatData.Admin_group,
                    Name_group: chatData.Name_group,
                    Photo_group: chatData.Photo_group,
                    UID: chatData.UID,
                    otherUser: {
                      UID: userData.UID,
                      name: userData.name,
                      photoURL: userData.photoURL,
                      userId: userData.userId
                    },
                    latestMessage: validMessage,
                  };
                  if (validMessage && validMessage.createdAt) {
                    // Chỉ update nếu tin nhắn thực sự thay đổi
                    setChats(prevChats => {
                      const existingIndex = prevChats.findIndex(c => c.ID_room === chatItem.ID_room);
                      const existingChat = existingIndex >= 0 ? prevChats[existingIndex] : null;

                      // So sánh tin nhắn mới với tin nhắn cũ
                      const hasMessageChanged = !existingChat ||
                        existingChat.latestMessage?.createdAt?.seconds !== validMessage.createdAt?.seconds ||
                        existingChat.latestMessage?.text !== validMessage.text;

                      if (!hasMessageChanged) {
                        return prevChats; // Không thay đổi state
                      }

                      // Cập nhật hoặc thêm chat mới
                      let newChats;
                      if (existingIndex >= 0) {
                        newChats = [...prevChats];
                        newChats[existingIndex] = chatItem;
                      } else {
                        newChats = [...prevChats, chatItem];
                      }

                      // Sort theo pinnedChats local state hiện tại
                      return newChats.sort((a, b) => {
                        const aPinned = newPinnedChats.includes(a.ID_room);
                        const bPinned = newPinnedChats.includes(b.ID_room);
                        if (aPinned && !bPinned) return -1;
                        if (!aPinned && bPinned) return 1;
                        if (a.latestMessage && b.latestMessage) {
                          return b.latestMessage.createdAt - a.latestMessage.createdAt;
                        }
                        return 0;
                      });
                    });
                  }
                }
                setLoading(false);
              });

              // Lưu unsubscribe function
              messageListenersRef.current.set(chatRoomId, { unsubscribeUser, unsubscribeMessages });
            }
          });
        });
      });

      return () => {
        unsubscribeChats();
        // Cleanup tất cả message listeners
        messageListenersRef.current.forEach(({ unsubscribeUser, unsubscribeMessages }) => {
          unsubscribeUser && unsubscribeUser();
          unsubscribeMessages && unsubscribeMessages();
        });
        messageListenersRef.current.clear();
      };
    };

    const cleanup = fetchChats();
    return cleanup;
  }, [db, user]);

  const onRefresh = () => {
    setRefreshing(true);
    // truy xuất dữ liệu cuộc trò chuyện từ firestore khi refresh
    const fetchChats = async () => {
      try {
        const chatsCollectionRef = collection(db, 'Chats');
        const chatsQuery = query(chatsCollectionRef, where('UID', 'array-contains', user.uid));
        const snapshot = await getDocs(chatsQuery);
        const chatsMap = new Map();

        // Cập nhật local state cho pinnedChats và mutedChats
        const newPinnedChats = [];
        const newMutedChats = [];

        snapshot.docs.forEach((chatDoc) => {
          const chatData = chatDoc.data();
          if (chatData.pinnedBy?.includes(user.uid)) {
            newPinnedChats.push(chatData.ID_roomChat);
          }
          if (chatData.mutedUsers?.includes(user.uid)) {
            newMutedChats.push(chatData.ID_roomChat);
          }
        });

        setPinnedChats(newPinnedChats);
        setMutedChats(newMutedChats);

        const fetchMessagesPromises = snapshot.docs.map(async (chatDoc) => {
          const chatData = chatDoc.data();
          setID_room1(chatData.ID_roomChat);
          const chatUIDs = chatData.UID.filter((uid) => uid !== user.uid);
          const otherUID = chatUIDs[0];
          const userDocRef = doc(db, 'users', otherUID);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const messQuery = query(
              collection(db, 'Chats', chatData.ID_roomChat, 'chat_mess'),
              orderBy('createdAt', 'desc')
            );
            const messSnapshot = await getDocs(messQuery);
            let latestMessage = null;
            let secondLatestMessage = null;
            if (!messSnapshot.empty) {
              for (let doc of messSnapshot.docs) {
                const message = doc.data();
                const deleteDetailMess = message.deleteDetail_mess || [];
                const hasUserDelete = deleteDetailMess.some(detail => detail.uidDelete === user.uid);

                if (!hasUserDelete) {
                  latestMessage = message;
                  break;
                } else if (!secondLatestMessage) {
                  secondLatestMessage = message;
                }
              }
            }
            const detailDeleteArray = chatData.detailDelete || [];
            const latestDeleteTime = detailDeleteArray.reduce((latest, detail) => {
              if (detail.uidDelete === user.uid && detail.timeDelete.toDate() > latest) {
                return detail.timeDelete.toDate();
              }
              return latest;
            }, 0);

            const validMessage = (!latestDeleteTime || (latestMessage && latestMessage.createdAt && latestMessage.createdAt.toDate() > latestDeleteTime)) ? latestMessage : secondLatestMessage;

            if (validMessage) {
              const chatItem = {
                ID_room: chatData.ID_roomChat,
                Admin_group: chatData.Admin_group,
                Name_group: chatData.Name_group,
                Photo_group: chatData.Photo_group,
                UID: chatData.UID,
                otherUser: {
                  UID: userData.UID,
                  name: userData.name,
                  photoURL: userData.photoURL,
                  userId: userData.userId
                },
                latestMessage: validMessage,
                // KHÔNG lưu isPinned/isMuted - dùng local state
              };
              if (validMessage && validMessage.createdAt) {
                chatsMap.set(chatItem.ID_room, chatItem);
              }
            }
          }
        });
        await Promise.all(fetchMessagesPromises);
        const sortedChats = Array.from(chatsMap.values()).sort((a, b) => {
          // Sử dụng local state để sort
          const aPinned = newPinnedChats.includes(a.ID_room);
          const bPinned = newPinnedChats.includes(b.ID_room);
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          if (a.latestMessage && b.latestMessage) {
            return b.latestMessage.createdAt - a.latestMessage.createdAt;
          }
          return 0;
        });
        setChats([...sortedChats]);
      } catch (error) {
        console.error('Error fetching chats:', error);
      } finally {
        setRefreshing(false);
      }
    };

    fetchChats();
  };

  useFocusEffect(
    useCallback(() => {
      onRefresh();
    }, [])
  );

  const setModalVisibility = (isVisible, chats) => {
    console.log(chats)
    setModalData(chats);
    setModalVisible(isVisible);
  };

  const handleDeleteChat = async (chats) => {
    Alert.alert(
      'Xóa cuộc trò chuyện',
      'Bạn có chắc muốn xóa cuộc trò chuyện này? Tin nhắn sẽ bị ẩn nhưng có thể khôi phục khi có tin nhắn mới.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            for (const chat of chats) {
              try {
                const chatRoomId = chat.ID_room;
                const timeDelete = new Date();
                const uidDelete = userData.UID;
                const chatRoomRef = doc(db, "Chats", chatRoomId);
                const deleteDetail = {
                  timeDelete: timeDelete,
                  uidDelete: uidDelete
                };
                const chatRoomSnapshot = await getDoc(chatRoomRef);
                if (chatRoomSnapshot.exists()) {
                  const chatRoomData = chatRoomSnapshot.data();
                  const detailDeleteArray = chatRoomData.detailDelete || [];
                  detailDeleteArray.push(deleteDetail);
                  await updateDoc(chatRoomRef, {
                    detailDelete: detailDeleteArray
                  });
                  setModalVisible(false);
                  showToast('Đã xóa cuộc trò chuyện', 'success');
                }
              } catch (error) {
                console.error("Error deleting chat:", error);
                showToast('Có lỗi xảy ra', 'error');
              }
            }
          }
        }
      ]
    );
  };

  // Ghim cuộc trò chuyện - optimistic update + Firestore sync
  const handlePinChat = async (chat) => {
    const chatId = chat.ID_room;
    const isPinned = pinnedChats.includes(chatId);

    // Optimistic update - đóng modal và update UI ngay
    setModalVisible(false);

    if (isPinned) {
      // Bỏ ghim
      setPinnedChats(prev => prev.filter(id => id !== chatId));
    } else {
      // Ghim mới
      if (pinnedChats.length >= 5) {
        showToast('Chỉ có thể ghim tối đa 5 cuộc trò chuyện', 'warning');
        return;
      }
      setPinnedChats(prev => [...prev, chatId]);
    }

    try {
      const chatDocRef = doc(db, 'Chats', chatId);
      if (isPinned) {
        await updateDoc(chatDocRef, {
          pinnedBy: arrayRemove(user.uid)
        });
        showToast('Đã bỏ ghim cuộc trò chuyện', 'success');
      } else {
        await updateDoc(chatDocRef, {
          pinnedBy: arrayUnion(user.uid)
        });
        showToast('Đã ghim cuộc trò chuyện', 'success');
      }
    } catch (error) {
      // Rollback nếu lỗi
      if (isPinned) {
        setPinnedChats(prev => [...prev, chatId]);
      } else {
        setPinnedChats(prev => prev.filter(id => id !== chatId));
      }
      console.error("Error pinning chat:", error);
      showToast('Có lỗi xảy ra', 'error');
    }
  };

  // Tắt thông báo cuộc trò chuyện - optimistic update + Firestore sync
  const handleMuteChat = async (chat) => {
    const chatId = chat.ID_room;
    const isMuted = mutedChats.includes(chatId);

    // Optimistic update - đóng modal và update UI ngay
    setModalVisible(false);

    if (isMuted) {
      // Bật thông báo
      setMutedChats(prev => prev.filter(id => id !== chatId));
    } else {
      // Tắt thông báo
      setMutedChats(prev => [...prev, chatId]);
    }

    try {
      const chatDocRef = doc(db, 'Chats', chatId);
      if (isMuted) {
        await updateDoc(chatDocRef, {
          mutedUsers: arrayRemove(user.uid)
        });
        showToast('Đã bật thông báo', 'success');
      } else {
        await updateDoc(chatDocRef, {
          mutedUsers: arrayUnion(user.uid)
        });
        showToast('Đã tắt thông báo', 'success');
      }
    } catch (error) {
      // Rollback nếu lỗi
      if (isMuted) {
        setMutedChats(prev => [...prev, chatId]);
      } else {
        setMutedChats(prev => prev.filter(id => id !== chatId));
      }
      console.error("Error muting chat:", error);
      showToast('Có lỗi xảy ra', 'error');
    }
  };

  // Đánh dấu đã đọc
  const handleMarkAsRead = async (chat) => {
    // TODO: Implement mark as read functionality
    showToast('Đã đánh dấu là đã đọc', 'success');
    setModalVisible(false);
  };

  const renderItem = useCallback(({ item }) => {
    return (
      <ChatItem
        item={item}
        pinnedChats={pinnedChats}
        mutedChats={mutedChats}
        onPress={() => navigation.navigate("Chat_fr", { friendData: item.otherUser, ID_room1: item.ID_room, chatData: item })}
        onLongPress={() => setModalVisibility(true, [item])}
      />
    );
  }, [pinnedChats, mutedChats, navigation]);

  // Sort chats: pinned first, then by latest message - CHỈ dùng local state
  // Sử dụng useMemo để chỉ tính toán lại khi chats hoặc pinnedChats thay đổi
  const sortedChats = React.useMemo(() => {
    return [...chats].sort((a, b) => {
      const aPinned = pinnedChats.includes(a.ID_room);
      const bPinned = pinnedChats.includes(b.ID_room);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Both pinned or both not pinned - sort by latest message
      if (a.latestMessage && b.latestMessage) {
        return b.latestMessage.createdAt - a.latestMessage.createdAt;
      }
      return 0;
    });
  }, [chats, pinnedChats]);

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.searchContainer}>
          <AntDesign name="search1" size={20} color="white" />
          <Pressable style={styles.searchInput} onPress={() => navigation.navigate("SearchFriend")}>
            <Text style={styles.textSearch}>Tìm kiếm</Text>
          </Pressable>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")} style={styles.headerIconBtn}>
            <View style={styles.notificationIconContainer}>
              <Ionicons name="notifications-outline" size={26} color="white" />
              {unreadNotifications > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <MaterialCommunityIcons name="qrcode-scan" size={24} color="white" />
          <Feather name="plus" size={30} color="white" />
        </View>

        {loading ? (
          <View style={styles.skeletonWrapper}>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </View>
        ) : chats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào</Text>
            <Text style={styles.emptySubText}>Tìm bạn bè và bắt đầu trò chuyện</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: 200 }}
            data={sortedChats}
            renderItem={renderItem}
            keyExtractor={(item, index) => item.ID_room.toString() + '_' + item.otherUser.UID}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#006AF5']}
                tintColor="#006AF5"
              />
            }
            getItemLayout={(data, index) => ({
              length: 80,
              offset: 80 * index,
              index,
            })}
          />
        )}
      </SafeAreaView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisibility(false)}
      >
        <View style={styles.centeredView}>
          <Pressable
            onPress={() => setModalVisible(false)}
            style={{ flex: 1, width: '100%', justifyContent: 'center' }}
          >
            <View style={styles.modalView}>
              {modalData && modalData[0] && (
                <>
                  <View style={styles.modalHeader}>
                    <Image
                      style={styles.modalAvatar}
                      source={{ uri: modalData[0].Photo_group || modalData[0].otherUser?.photoURL || 'https://via.placeholder.com/50' }}
                    />
                    <Text style={styles.modalTitle} numberOfLines={1}>
                      {modalData[0].Name_group || modalData[0].otherUser?.name}
                    </Text>
                  </View>

                  <View style={styles.modalDivider} />

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => handlePinChat(modalData[0])}
                    activeOpacity={0.7}
                  >
                    <AntDesign
                      name="pushpin"
                      size={22}
                      color={pinnedChats.includes(modalData[0].ID_room) ? "#006AF5" : "#333"}
                    />
                    <Text style={styles.modalOptionText}>
                      {pinnedChats.includes(modalData[0].ID_room) ? 'Bỏ ghim' : 'Ghim cuộc trò chuyện'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => handleMuteChat(modalData[0])}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={mutedChats.includes(modalData[0].ID_room) ? "notifications" : "notifications-off"}
                      size={22}
                      color={mutedChats.includes(modalData[0].ID_room) ? "#006AF5" : "#333"}
                    />
                    <Text style={styles.modalOptionText}>
                      {mutedChats.includes(modalData[0].ID_room) ? 'Bật thông báo' : 'Tắt thông báo'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => handleMarkAsRead(modalData[0])}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-done" size={22} color="#333" />
                    <Text style={styles.modalOptionText}>Đánh dấu đã đọc</Text>
                  </TouchableOpacity>

                  <View style={styles.modalDivider} />

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => handleDeleteChat(modalData)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={22} color="#F44336" />
                    <Text style={[styles.modalOptionText, { color: '#F44336' }]}>Xóa cuộc trò chuyện</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  textSearch: {
    color: "white",
    fontWeight: '500',
    fontSize: 15,
  },
  headerIconBtn: {
    padding: 4,
  },

  // Skeleton Loader Styles
  skeletonWrapper: {
    backgroundColor: '#fff',
  },
  skeletonContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonName: {
    height: 16,
    width: '60%',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonMessage: {
    height: 14,
    width: '90%',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },

  // Modern Chat Item Styles
  chatItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  pinnedChatItem: {
    backgroundColor: '#f0f8ff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0e0e0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4caf50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flexShrink: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  latestMessageText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#006AF5',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    backgroundColor: '#fff',
    height: '100%',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },

  // Modal Styles  
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    alignItems: "stretch",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 280,
    marginHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 14,
  },
  modalText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  modalOverlay: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconchat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  notificationIconContainer: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#006AF5',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default Chat;
