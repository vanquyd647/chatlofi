import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Image, FlatList, Modal, TouchableOpacity, Animated, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import { useToast } from '../contextApi/ToastContext';
import { subscribeToFriends, unfriend } from '../services/friendService';
import { getUserById } from '../services/userService';

const Friends = () => {
    const navigation = useNavigation();
    const { showToast } = useToast();
    const auth = getAuth();
    const user = auth.currentUser;
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

    const fetchUserFriends = async (rawFriends) => {
        setLoading(true);
        try {
            const enriched = await Promise.all(
                rawFriends.map(async (friend) => {
                    const userData = await getUserById(friend.UID_fr);
                    return {
                        id: friend.id,
                        UID_fr: friend.UID_fr,
                        ID_roomChat: friend.ID_roomChat,
                        photoUrl: userData?.photoURL || friend.photoURL_fr,
                        name: userData?.name || friend.name_fr,
                    };
                })
            );
            setListFriend(enriched);
        } catch (error) {
            console.error("Error fetching friend details:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToFriends(user.uid, (friends) => {
            if (friends.length > 0) {
                fetchUserFriends(friends);
            } else {
                setLoading(false);
                setListFriend([]);
            }
        });
        return () => unsubscribe();
    }, [user?.uid]);

    // Sort friends alphabetically by name
    const sortedUserFriendsList = listFriend && listFriend.length > 0
        ? listFriend.slice().sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        })
        : [];

    const renderUserFriendItem = ({ item }) => {
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
        setModalData(chats);
        setModalVisible(isVisible);
    };

    const handleCancel_friend = async (friend) => {
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
                            await unfriend(user.uid, friend.UID_fr);
                            showToast(`Đã hủy kết bạn với ${friend.name}`, 'success');
                            setModalVisible(false);
                        } catch (error) {
                            showToast('Có lỗi xảy ra, vui lòng thử lại', 'error');
                            console.error("Error canceling friend:", error);
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
