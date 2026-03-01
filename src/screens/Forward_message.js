import { StyleSheet, Text, View, FlatList, Pressable, Image, TouchableOpacity, TextInput, SafeAreaView } from 'react-native'
import React, { useEffect, useState, useMemo } from 'react'
import { Ionicons, AntDesign, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from "@react-navigation/native";
import { getFirestore, collection, onSnapshot, doc, addDoc, query, orderBy, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { useToast } from '../contextApi/ToastContext';

const Forward_message = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { messageData } = route.params;
    const { chats } = route.params;
    const db = getFirestore();
    const auth = getAuth();
    const user = auth.currentUser;
    const [userData, setUserData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChats, setSelectedChats] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        setUserData(user);
    }, [user]);

    // Lọc danh sách chat theo search query
    const filteredChats = useMemo(() => {
        if (!searchQuery.trim()) return chats;
        const query = searchQuery.toLowerCase();
        return chats.filter(item => {
            const name = item.Name_group || item.otherUser?.name || '';
            return name.toLowerCase().includes(query);
        });
    }, [chats, searchQuery]);

    // Toggle chọn chat
    const toggleSelectChat = (item) => {
        setSelectedChats(prev => {
            const isSelected = prev.find(c => c.ID_room === item.ID_room);
            if (isSelected) {
                return prev.filter(c => c.ID_room !== item.ID_room);
            } else {
                return [...prev, item];
            }
        });
    };

    // Gửi tin nhắn đến 1 chat
    const handleSend_ForwardMessage = async (item) => {
        const chatRoomId = item.ID_room;
        const { _id, createdAt, text, user, image, video, document } = messageData;
        try {
            const chatMessRef = collection(db, 'Chats', chatRoomId, 'chat_mess');
            await addDoc(chatMessRef, {
                _id: Math.random().toString(),
                createdAt: new Date(),
                text: text || '',
                user,
                image,
                video,
                document
            });
            return true;
        } catch (error) {
            console.error('Error forwarding message:', error);
            return false;
        }
    };

    // Gửi đến nhiều người đã chọn
    const handleSendToMultiple = async () => {
        if (selectedChats.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 người nhận', 'error');
            return;
        }

        setIsSending(true);
        try {
            let successCount = 0;
            for (const item of selectedChats) {
                const success = await handleSend_ForwardMessage(item);
                if (success) successCount++;
            }

            if (successCount === selectedChats.length) {
                showToast(`Đã chuyển tiếp đến ${successCount} người`, 'success');
            } else {
                showToast(`Đã gửi ${successCount}/${selectedChats.length}`, 'warning');
            }
            navigation.goBack();
        } catch (error) {
            showToast('Có lỗi xảy ra', 'error');
        } finally {
            setIsSending(false);
        }
    };

    // Gửi nhanh đến 1 người
    const handleQuickSend = async (item) => {
        setIsSending(true);
        const success = await handleSend_ForwardMessage(item);
        setIsSending(false);
        if (success) {
            showToast('Đã chuyển tiếp tin nhắn', 'success');
            navigation.goBack();
        } else {
            showToast('Không thể chuyển tiếp', 'error');
        }
    };

    // Render preview tin nhắn
    const renderMessagePreview = () => {
        if (!messageData) return null;
        return (
            <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Tin nhắn chuyển tiếp:</Text>
                <View style={styles.previewContent}>
                    {messageData.image && (
                        <Image source={{ uri: messageData.image }} style={styles.previewImage} />
                    )}
                    {messageData.video && (
                        <View style={styles.previewVideo}>
                            <Feather name="video" size={24} color="#666" />
                            <Text style={styles.previewText}>Video</Text>
                        </View>
                    )}
                    {messageData.document && (
                        <View style={styles.previewDocument}>
                            <Ionicons name="document" size={24} color="#666" />
                            <Text style={styles.previewText} numberOfLines={1}>{messageData.text || 'Tài liệu'}</Text>
                        </View>
                    )}
                    {!messageData.image && !messageData.video && !messageData.document && messageData.text && (
                        <Text style={styles.previewText} numberOfLines={2}>{messageData.text}</Text>
                    )}
                </View>
            </View>
        );
    };

    // Render selected chips
    const renderSelectedChips = () => {
        if (selectedChats.length === 0) return null;
        return (
            <View style={styles.selectedContainer}>
                <FlatList
                    horizontal
                    data={selectedChats}
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.ID_room}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.selectedChip}
                            onPress={() => toggleSelectChat(item)}
                        >
                            <Image
                                source={{ uri: item.Photo_group || item.otherUser?.photoURL || 'https://i.stack.imgur.com/l60Hf.png' }}
                                style={styles.chipAvatar}
                            />
                            <Text style={styles.chipName} numberOfLines={1}>
                                {item.Name_group || item.otherUser?.name}
                            </Text>
                            <AntDesign name="close" size={14} color="#666" />
                        </TouchableOpacity>
                    )}
                />
            </View>
        );
    };

    // Render each chat item
    const renderItem = ({ item }) => {
        const isSelected = selectedChats.find(c => c.ID_room === item.ID_room);
        const avatarUri = item.Photo_group || item.otherUser?.photoURL || 'https://i.stack.imgur.com/l60Hf.png';
        const displayName = item.Name_group || item.otherUser?.name || 'Unknown';

        return (
            <Pressable
                style={[styles.itemContainer, isSelected && styles.itemSelected]}
                onPress={() => toggleSelectChat(item)}
            >
                <View style={styles.contentContainer}>
                    {/* Checkbox */}
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <AntDesign name="check" size={14} color="white" />}
                    </View>

                    <Image source={{ uri: avatarUri }} style={styles.avatar} />

                    <View style={styles.messageContainer}>
                        <Text style={styles.userName}>{displayName}</Text>
                        {item.Name_group && (
                            <Text style={styles.memberCount}>
                                <Ionicons name="people" size={12} color="#888" /> Nhóm
                            </Text>
                        )}
                    </View>

                    {/* Nút gửi nhanh */}
                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={() => handleQuickSend(item)}
                        disabled={isSending}
                    >
                        <Text style={styles.sendButtonText}>Gửi</Text>
                    </TouchableOpacity>
                </View>
            </Pressable>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <AntDesign name="arrowleft" size={22} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chuyển tiếp tin nhắn</Text>
                {selectedChats.length > 0 && (
                    <TouchableOpacity
                        style={styles.sendMultipleButton}
                        onPress={handleSendToMultiple}
                        disabled={isSending}
                    >
                        <Text style={styles.sendMultipleText}>
                            Gửi ({selectedChats.length})
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Preview tin nhắn */}
            {renderMessagePreview()}

            {/* Search */}
            <View style={styles.searchWrapper}>
                <View style={styles.searchBox}>
                    <AntDesign name="search1" size={18} color="#888" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm kiếm người nhận..."
                        placeholderTextColor="#888"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <AntDesign name="closecircle" size={16} color="#888" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Selected chips */}
            {renderSelectedChips()}

            {/* Danh sách chat */}
            <FlatList
                contentContainerStyle={{ paddingBottom: 100 }}
                data={filteredChats}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.ID_room.toString() + '_' + index}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Feather name="inbox" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>Không tìm thấy cuộc trò chuyện</Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
};

export default Forward_message

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    headerContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#006AF5",
        padding: 12,
        paddingTop: 8,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        flex: 1,
        color: "white",
        fontWeight: '600',
        fontSize: 18,
        marginLeft: 15,
    },
    sendMultipleButton: {
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    sendMultipleText: {
        color: '#006AF5',
        fontWeight: '600',
    },
    previewContainer: {
        backgroundColor: 'white',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    previewLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 5,
    },
    previewContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 10,
    },
    previewVideo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewDocument: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
    },
    searchWrapper: {
        padding: 10,
        backgroundColor: 'white',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
    },
    selectedContainer: {
        backgroundColor: 'white',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    selectedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f4ff',
        borderRadius: 20,
        paddingRight: 10,
        paddingLeft: 3,
        paddingVertical: 3,
        marginRight: 8,
    },
    chipAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 6,
    },
    chipName: {
        fontSize: 13,
        color: '#333',
        maxWidth: 80,
        marginRight: 5,
    },
    itemContainer: {
        padding: 12,
        backgroundColor: 'white',
    },
    itemSelected: {
        backgroundColor: '#f0f8ff',
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#ccc',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#006AF5',
        borderColor: '#006AF5',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    messageContainer: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    memberCount: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    sendButton: {
        backgroundColor: '#006AF5',
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 18,
    },
    sendButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    separator: {
        height: 1,
        backgroundColor: '#f0f0f0',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 50,
    },
    emptyText: {
        color: '#888',
        marginTop: 10,
        fontSize: 15,
    },
})