import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TextInput, Image, FlatList, Modal, TouchableOpacity, ActivityIndicator, Animated, Alert } from 'react-native';
import { AntDesign, MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, getDoc, getDocs, deleteDoc, query, where, updateDoc } from "firebase/firestore";
import { useToast } from '../contextApi/ToastContext';

const Friends = () => {
    const navigation = useNavigation();
    const { showToast } = useToast();
    const auth = getAuth();
    const [userFriendsList, setUserFriendsList] = useState([]);
    const [listFriend, setListFriend] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalData, setModalData] = useState(null);
    const [loading, setLoading] = useState(true);

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
                <Animated.View style={[styles.skeletonName, { opacity }]} />
            </View>
        );
    };

    const fetchUserFriends = async () => {
        try {
            const db = getFirestore();
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnapshot = await getDoc(userDocRef);
                if (userDocSnapshot.exists()) {
                    const userData = userDocSnapshot.data();
                    const friendsCollectionRef = collection(userDocRef, "friendData");
                    const friendsSnapshot = await getDocs(friendsCollectionRef);
                    const userFriends = [];
                    friendsSnapshot.forEach((doc) => {
                        const friendData = doc.data();
                        userFriends.push({
                            id: doc.id,
                            name: friendData.name_fr,
                            photoUrl: friendData.photoURL_fr,
                            userId: friendData.email_fr,
                            UID_fr: friendData.UID_fr,
                            ID_roomChat: friendData.ID_roomChat
                        });
                    });
                    setUserFriendsList(userFriends);
                } else {
                    console.error("User document does not exist!");
                }
            } else {
                console.error("No user signed in!");
            }
        } catch (error) {
            console.error("Error fetching user friends:", error);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                console.log(user);
                fetchUserFriends(); // Fetch friends when user is authenticated
                const db = getFirestore();
                const userDocRef = doc(db, "users", user.uid);
                const friendsCollectionRef = collection(userDocRef, "friendData");
                const unsubscribe = onSnapshot(friendsCollectionRef, (snapshot) => {
                    const userFriends = [];
                    let index = 0; // Bắt đầu với index = 0
                    snapshot.forEach((doc) => {
                        const friendData = doc.data();
                        userFriends.push({
                            id: index++, // Gán ID bằng index và tăng index sau mỗi lần sử dụng
                            name: friendData.name_fr,
                            photoUrl: friendData.photoURL_fr,
                            userId: friendData.email_fr,
                            UID_fr: friendData.UID_fr,
                            ID_roomChat: friendData.ID_roomChat
                        });
                    });
                    console.log(userFriends);
                    setUserFriendsList(userFriends); // Update friends list
                });

                return () => unsubscribe(); // Unsubscribe when component unmounts
            } else {
                console.log("No user signed in!");
            }
        });
        return unsubscribe;
    }, []);

    // Tạo hàm để truy vấn dữ liệu từ collection "users" dựa trên UID
    const fetchUserDataByUID = async (UID) => {
        try {
            const db = getFirestore();
            const userDocRef = doc(db, "users", UID);
            const userDocSnapshot = await getDoc(userDocRef);

            if (userDocSnapshot.exists()) {
                const userData = userDocSnapshot.data();
                return { photoURL: userData.photoURL, name: userData.name };
            } else {
                console.error(`User document does not exist for UID ${UID}`);
                return null;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            return null;
        }
    };

    // Hàm để lấy dữ liệu từ collection "users" cho tất cả các UID trong mảng userFriendsList
    const fetchUserDataForFriends = async () => {
        console.log('fetchUserDataForFriends called, userFriendsList:', userFriendsList);
        setLoading(true);
        const updatedUserFriendsList = [];
        for (const friend of userFriendsList) {
            console.log('Fetching data for friend:', friend);
            const userData = await fetchUserDataByUID(friend.UID_fr);
            if (userData) {
                // Tạo một đối tượng mới với dữ liệu photoURL, name, UID_fr và ID_roomChat
                const updatedFriend = {
                    id: friend.id,
                    UID_fr: friend.UID_fr,
                    ID_roomChat: friend.ID_roomChat,
                    photoUrl: userData.photoURL,
                    name: userData.name
                };

                updatedUserFriendsList.push(updatedFriend);
            }
        }
        console.log('Fetched friends data:', updatedUserFriendsList);
        setLoading(false);
        return updatedUserFriendsList;
    };

    useEffect(() => {
        // Gọi hàm fetchUserDataForFriends để lấy thông tin của bạn bè từ collection "users"
        if (userFriendsList.length > 0) {
            fetchUserDataForFriends().then(updatedFriendsData => {
                // Cập nhật danh sách bạn bè đã được cập nhật vào state listFriend
                console.log('Updated friends data:', updatedFriendsData);
                setListFriend(updatedFriendsData);
            });
        } else {
            setLoading(false);
            setListFriend([]);
        }
    }, [userFriendsList]); // Thêm userFriendsList vào dependency array

    console.log('listFriend', listFriend)
    console.log('userFriendsList', userFriendsList)

    // Sort userFriendsList alphabetically by name
    const sortedUserFriendsList = listFriend && listFriend.length > 0
        ? listFriend.slice().sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        })
        : [];

    console.log('sortedUserFriendsList count:', sortedUserFriendsList.length)

    const renderUserFriendItem = ({ item }) => {
        console.log('Rendering friend item:', item);
        return (
            <TouchableOpacity
                style={styles.friendItem}
                onPress={() => navigation.navigate("Chat_fr", { friendData2: item })}
                onLongPress={() => setModalVisibility(true, item)}
                activeOpacity={0.7}
            >
                <Image
                    style={styles.avatar}
                    source={{ uri: item.photoUrl || 'https://via.placeholder.com/50' }}
                />
                <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{item.name || 'Unknown'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
        );
    };

    const setModalVisibility = (isVisible, chats) => {
        console.log(chats)
        setModalData(chats);
        setModalVisible(isVisible);
    };

    const handleCancel_friend = async (friend) => {
        console.log('friend', friend);
        Alert.alert(
            'Hủy kết bạn',
            `Bạn có chắc muốn hủy kết bạn với ${friend.name}? \n\nCuộc trò chuyện sẽ vẫn được giữ lại.`,
            [
                { text: 'Không', style: 'cancel' },
                {
                    text: 'Hủy kết bạn',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const db = getFirestore();
                            const auth = getAuth();
                            const user = auth.currentUser;
                            if (user) {
                                const userDocRef = doc(db, "users", user.uid);
                                const userDocSnapshot = await getDoc(userDocRef);
                                if (userDocSnapshot.exists()) {
                                    // Xóa bạn bè ở người dùng hiện tại 
                                    const friendDataCollectionRef = collection(db, "users", user.uid, "friendData");
                                    const friendQuery = query(friendDataCollectionRef, where("UID_fr", "==", friend.UID_fr));
                                    const friendQuerySnapshot = await getDocs(friendQuery);

                                    const deleteCurrentUserPromises = friendQuerySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
                                    await Promise.all(deleteCurrentUserPromises);

                                    // Xóa bạn bè ở người bạn bè
                                    const friendReceivedCollectionRef = collection(db, "users", friend.UID_fr, "friendData");
                                    const q = query(friendReceivedCollectionRef, where("UID_fr", "==", user.uid));
                                    const querySnapshot = await getDocs(q);

                                    const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
                                    await Promise.all(deletePromises);
                                    showToast(`Đã hủy kết bạn với ${friend.name}`, 'success');
                                    setModalVisible(false);
                                    console.log("Friend request canceled successfully!");
                                } else {
                                    showToast('Lỗi tài khoản người dùng', 'error');
                                    console.error("User document does not exist!");
                                }
                            } else {
                                showToast('Vui lòng đăng nhập lại', 'error');
                                console.error("No user signed in!");
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

    // Xem trang cá nhân
    const handleViewProfile = (friend) => {
        setModalVisible(false);
        navigation.navigate("Personal_page", { friendId: friend.UID_fr });
    };

    // Nhắn tin
    const handleSendMessage = (friend) => {
        setModalVisible(false);
        navigation.navigate("Chat_fr", { friendData2: friend });
    };


    return (
        <View style={styles.container}>
            <View style={styles.menuSection}>
                <TouchableOpacity
                    onPress={() => navigation.navigate("FriendRequest")}
                    style={styles.menuItem}
                    activeOpacity={0.7}
                >
                    <View style={styles.menuIconContainer}>
                        <FontAwesome5 name="user-friends" size={20} color="#006AF5" />
                    </View>
                    <Text style={styles.menuText}>Lời mời kết bạn</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                >
                    <View style={styles.menuIconContainer}>
                        <FontAwesome6 name="contact-book" size={22} color="#006AF5" />
                    </View>
                    <Text style={styles.menuText}>Danh bạ máy</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
            </View>

            <View style={styles.separator}></View>

            <View style={styles.friendsSection}>
                <Text style={styles.sectionTitle}>
                    Bạn bè ({sortedUserFriendsList.length})
                </Text>

                {loading ? (
                    <View style={styles.skeletonWrapper}>
                        <SkeletonItem />
                        <SkeletonItem />
                        <SkeletonItem />
                        <SkeletonItem />
                        <SkeletonItem />
                    </View>
                ) : sortedUserFriendsList.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={80} color="#ccc" />
                        <Text style={styles.emptyText}>Chưa có bạn bè</Text>
                        <Text style={styles.emptySubText}>Kết nối với mọi người</Text>
                    </View>
                ) : (
                    <FlatList
                        contentContainerStyle={{ paddingBottom: 220 }}
                        data={sortedUserFriendsList}
                        renderItem={renderUserFriendItem}
                        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                    />
                )}
            </View>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisibility(false)}
            >
                <View style={styles.centeredView}>
                    <Pressable
                        onPress={() => setModalVisible(false)}
                        style={styles.modalBackdrop}
                    >
                        <View style={styles.modalView}>
                            {modalData && (
                                <>
                                    <View style={styles.modalHeader}>
                                        <Image
                                            style={styles.modalAvatar}
                                            source={{ uri: modalData.photoUrl || 'https://via.placeholder.com/60' }}
                                        />
                                        <Text style={styles.modalName}>{modalData.name}</Text>
                                    </View>

                                    <View style={styles.modalDivider} />

                                    <TouchableOpacity
                                        style={styles.modalButton}
                                        onPress={() => handleSendMessage(modalData)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="chatbubble-outline" size={22} color="#006AF5" />
                                        <Text style={[styles.modalText, { color: '#006AF5' }]}>Nhắn tin</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.modalButton}
                                        onPress={() => handleViewProfile(modalData)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="person-outline" size={22} color="#333" />
                                        <Text style={styles.modalText}>Xem trang cá nhân</Text>
                                    </TouchableOpacity>

                                    <View style={styles.modalDivider} />

                                    <TouchableOpacity
                                        style={styles.modalButton}
                                        onPress={() => handleCancel_friend(modalData)}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons name="account-remove-outline" size={22} color="#F44336" />
                                        <Text style={[styles.modalText, { color: '#F44336' }]}>Hủy kết bạn</Text>
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

    // Menu Section
    menuSection: {
        backgroundColor: '#fff',
        marginBottom: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
        fontWeight: '500',
    },

    separator: {
        height: 8,
        backgroundColor: '#f0f0f0',
    },

    // Friends Section
    friendsSection: {
        flex: 1,
        backgroundColor: '#fff',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8f8f8',
    },

    // Skeleton Loader
    skeletonWrapper: {
        backgroundColor: '#fff',
    },
    skeletonContainer: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    skeletonAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#e0e0e0',
        marginRight: 12,
    },
    skeletonName: {
        height: 16,
        width: '50%',
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
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
        backgroundColor: '#e0e0e0',
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        backgroundColor: '#fff',
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

    // Modal
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    modalBackdrop: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
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
    },
    modalHeader: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    modalAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 8,
    },
    modalName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    modalDivider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 8,
    },
    modalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    modalText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginLeft: 12,
    },
});

export default Friends;
