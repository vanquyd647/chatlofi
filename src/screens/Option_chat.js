import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TextInput, Image, FlatList, TouchableOpacity, ScrollView, Modal, Alert, Switch } from 'react-native';
import { AntDesign, MaterialCommunityIcons, Feather, Ionicons, SimpleLineIcons, Entypo, FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRoute } from "@react-navigation/native";
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, getDocs, query, orderBy, where, updateDoc, arrayRemove, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useToast } from '../contextApi/ToastContext';

const Option_chat = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { RoomID, name, avatar, Admin_group, UID, ChatData_props, friendUID } = route.params;
  const Admin_group1 = Admin_group ? Admin_group : null;

  const RoomID1 = RoomID;
  const UID1 = UID;
  const ChatData_props1 = ChatData_props;
  const auth = getAuth();
  const user = auth.currentUser;
  const db = getFirestore();
  const { showToast } = useToast();

  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [mediaCount, setMediaCount] = useState({ images: 0, videos: 0, files: 0 });
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendUserData, setFriendUserData] = useState(null);

  // Tính toán friendUID từ UID array nếu không được truyền trực tiếp
  const calculatedFriendUID = React.useMemo(() => {
    console.log('Option_chat - friendUID from params:', friendUID);
    console.log('Option_chat - UID from params:', UID);
    console.log('Option_chat - Admin_group1:', Admin_group1);
    console.log('Option_chat - user.uid:', user?.uid);

    if (friendUID && friendUID !== user?.uid) return friendUID;
    // Nếu là chat 1-1 (không phải group) và có UID array
    if (!Admin_group1 && UID && Array.isArray(UID) && UID.length === 2) {
      const otherUID = UID.find(uid => uid !== user?.uid);
      console.log('Option_chat - calculated otherUID from UID array:', otherUID);
      return otherUID;
    }
    return null;
  }, [friendUID, Admin_group1, UID, user?.uid]);

  // Fetch thông tin user nếu đây là chat 1-1 (không phải group)
  useEffect(() => {
    const fetchFriendData = async () => {
      if (!Admin_group1 && calculatedFriendUID) {
        try {
          const userDocRef = doc(db, 'users', calculatedFriendUID);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setFriendUserData({ UID: calculatedFriendUID, ...userDocSnap.data() });
          }
        } catch (error) {
          console.error('Error fetching friend data:', error);
        }
      }
    };
    fetchFriendData();
  }, [calculatedFriendUID, Admin_group1]);

  // Load trạng thái mute/pin real-time với onSnapshot
  useEffect(() => {
    const chatDocRef = doc(db, 'Chats', RoomID1);

    // Sử dụng onSnapshot để sync real-time với Chat.js
    const unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const chatData = docSnap.data();
        // Kiểm tra user có trong danh sách muted không
        const muted = chatData.mutedUsers?.includes(user.uid) || false;
        const pinned = chatData.pinnedBy?.includes(user.uid) || false;

        setIsMuted(muted);
        setIsPinned(pinned);
      }
    }, (error) => {
      console.error('Error listening to chat settings:', error);
    });

    const loadMediaCount = async () => {
      try {
        const messagesRef = collection(db, 'Chats', RoomID1, 'chat_mess');
        const messagesSnap = await getDocs(messagesRef);
        let images = 0, videos = 0, files = 0;
        messagesSnap.forEach((doc) => {
          const data = doc.data();
          if (data.image) images++;
          if (data.video) videos++;
          if (data.document) files++;
        });
        setMediaCount({ images, videos, files });
      } catch (error) {
        console.error('Error loading media count:', error);
      }
    };

    loadMediaCount();

    // Cleanup listener khi unmount
    return () => unsubscribe();
  }, [RoomID1, user.uid]);

  // Toggle mute - optimistic update + Firestore sync
  const toggleMute = async () => {
    const newMutedState = !isMuted;
    // Optimistic update - UI phản hồi ngay lập tức
    setIsMuted(newMutedState);

    try {
      const chatDocRef = doc(db, 'Chats', RoomID1);
      if (!newMutedState) {
        // Đang bật thông báo (unmute)
        await updateDoc(chatDocRef, {
          mutedUsers: arrayRemove(user.uid)
        });
        showToast('Đã bật thông báo', 'success');
      } else {
        // Đang tắt thông báo (mute)
        await updateDoc(chatDocRef, {
          mutedUsers: arrayUnion(user.uid)
        });
        showToast('Đã tắt thông báo', 'success');
      }
    } catch (error) {
      // Rollback nếu lỗi
      setIsMuted(isMuted);
      console.error('Error toggling mute:', error);
      showToast('Có lỗi xảy ra', 'error');
    }
  };

  // Toggle pin - optimistic update + Firestore sync
  const togglePin = async () => {
    const newPinnedState = !isPinned;
    // Optimistic update - UI phản hồi ngay lập tức
    setIsPinned(newPinnedState);

    try {
      const chatDocRef = doc(db, 'Chats', RoomID1);
      if (!newPinnedState) {
        // Đang bỏ ghim
        await updateDoc(chatDocRef, {
          pinnedBy: arrayRemove(user.uid)
        });
        showToast('Đã bỏ ghim', 'success');
      } else {
        // Đang ghim
        await updateDoc(chatDocRef, {
          pinnedBy: arrayUnion(user.uid)
        });
        showToast('Đã ghim cuộc trò chuyện', 'success');
      }
    } catch (error) {
      // Rollback nếu lỗi
      setIsPinned(isPinned);
      console.error('Error toggling pin:', error);
      showToast('Có lỗi xảy ra', 'error');
    }
  };

  // Xem trang cá nhân bạn bè
  const handleViewProfile = () => {
    // Sử dụng calculatedFriendUID đã được tính toán
    const targetUID = calculatedFriendUID;

    console.log('handleViewProfile - targetUID:', targetUID);
    console.log('handleViewProfile - user.uid:', user?.uid);
    console.log('handleViewProfile - friendUserData:', friendUserData);

    // Kiểm tra targetUID có phải là UID của chính mình không
    if (!targetUID || targetUID === user?.uid) {
      console.log('handleViewProfile - navigating to own Profile');
      // Nếu là chính mình hoặc không tìm được, navigate tới Profile
      navigation.navigate('Profile');
      return;
    }

    if (friendUserData) {
      console.log('handleViewProfile - navigating to Personal_page with friendUserData');
      navigation.navigate('Personal_page', { friendData: friendUserData });
    } else if (targetUID) {
      console.log('handleViewProfile - navigating to Personal_page with targetUID');
      // Nếu chưa có data, navigate với UID và để Personal_page tự fetch
      navigation.navigate('Personal_page', { friendData: { UID: targetUID } });
    } else {
      showToast('Không thể xem trang cá nhân', 'error');
    }
  };

  // Tìm kiếm tin nhắn
  const handleSearchMessages = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const messagesRef = collection(db, 'Chats', RoomID1, 'chat_mess');
      const messagesSnap = await getDocs(messagesRef);
      const results = [];
      const queryLower = searchQuery.toLowerCase();

      messagesSnap.forEach((doc) => {
        const data = doc.data();
        if (data.text && data.text.toLowerCase().includes(queryLower)) {
          results.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
          });
        }
      });

      // Sắp xếp theo thời gian mới nhất
      results.sort((a, b) => b.createdAt - a.createdAt);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching messages:', error);
      showToast('Lỗi tìm kiếm', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Xóa lịch sử chat
  const handleClearHistory = () => {
    Alert.alert(
      'Xóa lịch sử trò chuyện',
      'Bạn có chắc muốn xóa tất cả tin nhắn? Hành động này không thể hoàn tác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const messagesRef = collection(db, 'Chats', RoomID1, 'chat_mess');
              const messagesSnap = await getDocs(messagesRef);
              const deletePromises = [];
              messagesSnap.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
              });
              await Promise.all(deletePromises);
              showToast('Đã xóa lịch sử trò chuyện', 'success');
            } catch (error) {
              console.error('Error clearing history:', error);
              showToast('Không thể xóa lịch sử', 'error');
            }
          }
        }
      ]
    );
  };

  const handleLeaveGroup = async () => {
    Alert.alert(
      'Rời nhóm',
      'Bạn có chắc chắn muốn rời khỏi nhóm này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Admin_group1 === user.uid) {
                navigation.navigate("Select_Ad", { RoomID1 });
              } else {
                const groupDocRef = doc(collection(db, 'Group'), RoomID1);
                const groupDocSnapshot = await getDoc(groupDocRef);
                const subAdminArray = groupDocSnapshot.data().Sub_Admin;

                if (subAdminArray && subAdminArray.includes(user.uid)) {
                  await updateDoc(groupDocRef, {
                    Sub_Admin: arrayRemove(user.uid)
                  });
                }

                await updateDoc(groupDocRef, {
                  UID: arrayRemove(user.uid)
                });

                const groupChatDocRef = doc(collection(db, 'Chats'), RoomID1);
                const groupChatDocSnapshot = await getDoc(groupChatDocRef);
                const subChatAdminArray = groupChatDocSnapshot.data().Sub_Admin;

                if (subChatAdminArray && subChatAdminArray.includes(user.uid)) {
                  await updateDoc(groupChatDocRef, {
                    Sub_Admin: arrayRemove(user.uid)
                  });
                }

                await updateDoc(groupChatDocRef, {
                  UID: arrayRemove(user.uid)
                });

                showToast('Đã rời khỏi nhóm', 'success');
                navigation.navigate("Main");
              }
            } catch (error) {
              console.error("Error leaving group: ", error);
              showToast('Có lỗi xảy ra', 'error');
            }
          }
        }
      ]
    );
  };

  // Render một kết quả tìm kiếm
  const renderSearchResult = ({ item }) => (
    <TouchableOpacity style={styles.searchResultItem}>
      <Image
        source={{ uri: item.user?.avatar || 'https://i.stack.imgur.com/l60Hf.png' }}
        style={styles.searchResultAvatar}
      />
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultName}>{item.user?.name || 'Unknown'}</Text>
        <Text style={styles.searchResultText} numberOfLines={2}>{item.text}</Text>
        <Text style={styles.searchResultTime}>
          {item.createdAt.toLocaleDateString()} {item.createdAt.toLocaleTimeString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.searchContainer}>
          <Pressable onPress={() => navigation.goBack()}>
            <AntDesign name="arrowleft" size={22} color="white" />
          </Pressable>
          <View style={styles.searchInput}>
            <Text style={styles.textSearch}>Tùy chọn</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <TouchableOpacity>
              <Image source={{ uri: avatar || 'https://i.stack.imgur.com/l60Hf.png' }} style={styles.avatar} />
            </TouchableOpacity>
            <Text style={styles.profileName}>{name}</Text>
            {Admin_group1 && (
              <Text style={styles.groupLabel}>
                <Ionicons name="people" size={14} color="#888" /> Nhóm
              </Text>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={styles.quickAction} onPress={() => setShowSearchModal(true)}>
              <View style={styles.quickActionIcon}>
                <AntDesign name="search1" size={22} color="#006AF5" />
              </View>
              <Text style={styles.quickActionText}>Tìm tin nhắn</Text>
            </TouchableOpacity>

            {Admin_group1 ? (
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => navigation.navigate('Add_mem_gr', { ChatData_props1, RoomID1 })}
              >
                <View style={styles.quickActionIcon}>
                  <AntDesign name="addusergroup" size={22} color="#006AF5" />
                </View>
                <Text style={styles.quickActionText}>Thêm thành viên</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.quickAction} onPress={handleViewProfile}>
                <View style={styles.quickActionIcon}>
                  <AntDesign name="user" size={22} color="#006AF5" />
                </View>
                <Text style={styles.quickActionText}>Trang cá nhân</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.quickAction} onPress={toggleMute}>
              <View style={[styles.quickActionIcon, isMuted && styles.quickActionIconActive]}>
                <Ionicons
                  name={isMuted ? "notifications-off" : "notifications-outline"}
                  size={22}
                  color={isMuted ? "white" : "#006AF5"}
                />
              </View>
              <Text style={styles.quickActionText}>{isMuted ? 'Đã tắt TB' : 'Tắt thông báo'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={togglePin}>
              <View style={[styles.quickActionIcon, isPinned && styles.quickActionIconActive]}>
                <AntDesign
                  name="pushpin"
                  size={22}
                  color={isPinned ? "white" : "#006AF5"}
                />
              </View>
              <Text style={styles.quickActionText}>{isPinned ? 'Đã ghim' : 'Ghim trò chuyện'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Media & Files Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Ảnh/Video, File</Text>
            <View style={styles.mediaStatsRow}>
              <TouchableOpacity style={styles.mediaStat}>
                <View style={[styles.mediaStatIcon, { backgroundColor: '#e8f4ff' }]}>
                  <Feather name="image" size={20} color="#006AF5" />
                </View>
                <Text style={styles.mediaStatCount}>{mediaCount.images}</Text>
                <Text style={styles.mediaStatLabel}>Ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mediaStat}>
                <View style={[styles.mediaStatIcon, { backgroundColor: '#fff0f0' }]}>
                  <Feather name="video" size={20} color="#ff4444" />
                </View>
                <Text style={styles.mediaStatCount}>{mediaCount.videos}</Text>
                <Text style={styles.mediaStatLabel}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mediaStat}>
                <View style={[styles.mediaStatIcon, { backgroundColor: '#f0fff0' }]}>
                  <Ionicons name="document-outline" size={20} color="#44aa44" />
                </View>
                <Text style={styles.mediaStatCount}>{mediaCount.files}</Text>
                <Text style={styles.mediaStatLabel}>File</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Settings Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Cài đặt</Text>

            {Admin_group1 && Admin_group1 === user.uid && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("Setting_group", { RoomID1, Admin_group1 })}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#f0f0ff' }]}>
                  <SimpleLineIcons name="settings" size={20} color="#6666ff" />
                </View>
                <Text style={styles.menuText}>Cài đặt nhóm</Text>
                <AntDesign name="right" size={16} color="#ccc" />
              </TouchableOpacity>
            )}

            {Admin_group1 && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("Manager_group", { RoomID1, UID1 })}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#e8f4ff' }]}>
                  <MaterialCommunityIcons name="account-group" size={20} color="#006AF5" />
                </View>
                <Text style={styles.menuText}>Thành viên nhóm</Text>
                <AntDesign name="right" size={16} color="#ccc" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={handleClearHistory}>
              <View style={[styles.menuIcon, { backgroundColor: '#fff5e6' }]}>
                <MaterialCommunityIcons name="broom" size={20} color="#ff9900" />
              </View>
              <Text style={styles.menuText}>Xóa lịch sử trò chuyện</Text>
              <AntDesign name="right" size={16} color="#ccc" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Danger Zone */}
          {Admin_group1 && (
            <View style={styles.sectionContainer}>
              <TouchableOpacity style={styles.dangerItem} onPress={handleLeaveGroup}>
                <View style={[styles.menuIcon, { backgroundColor: '#ffecec' }]}>
                  <Feather name="log-out" size={20} color="#ff4444" />
                </View>
                <Text style={styles.dangerText}>Rời nhóm</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 50 }} />
        </ScrollView>

        {/* Search Modal */}
        <Modal
          visible={showSearchModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowSearchModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <AntDesign name="arrowleft" size={22} color="#333" />
              </TouchableOpacity>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Tìm kiếm tin nhắn..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                onSubmitEditing={handleSearchMessages}
              />
              <TouchableOpacity onPress={handleSearchMessages}>
                <AntDesign name="search1" size={22} color="#006AF5" />
              </TouchableOpacity>
            </View>

            {isSearching ? (
              <View style={styles.loadingContainer}>
                <Text>Đang tìm kiếm...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
              />
            ) : searchQuery.trim() ? (
              <View style={styles.emptyContainer}>
                <Feather name="inbox" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Không tìm thấy tin nhắn</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Feather name="search" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Nhập từ khóa để tìm kiếm</Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
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
    padding: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 15,
  },
  textSearch: {
    color: "white",
    fontWeight: '600',
    fontSize: 18,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 25,
    backgroundColor: 'white',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#006AF5',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
    color: '#333',
  },
  groupLabel: {
    color: '#888',
    marginTop: 5,
    fontSize: 14,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIconActive: {
    backgroundColor: '#006AF5',
  },
  quickActionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  divider: {
    height: 8,
    backgroundColor: '#f0f0f0',
  },
  sectionContainer: {
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 15,
  },
  mediaStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mediaStat: {
    alignItems: 'center',
  },
  mediaStatIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaStatCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  mediaStatLabel: {
    fontSize: 12,
    color: '#888',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dangerText: {
    flex: 1,
    fontSize: 16,
    color: '#ff4444',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalSearchInput: {
    flex: 1,
    marginHorizontal: 15,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: 15,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  searchResultText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  searchResultTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  resultSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 67,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#888',
  },
});

export default Option_chat;
