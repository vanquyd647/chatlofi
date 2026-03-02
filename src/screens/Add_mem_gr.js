import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TextInput, Image, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation, useRoute } from "@react-navigation/native";
import { RadioButton } from 'react-native-paper';
import { getAuth } from "firebase/auth";
import { subscribeToFriends, searchUsersByName } from '../services/friendService';
import { getUserById } from '../services/userService';
import { addMembers, getGroupInfo } from '../services/groupService';

const Add_mem_gr = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const auth = getAuth();
    const user = auth.currentUser;
    const { ChatData_props1 } = route.params;
    const { RoomID1 } = route.params;
    const [search, setSearch] = useState("");
    const [friendsList, setFriendsList] = useState([]);
    const [listFriend, setListFriend] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showTabs, setShowTabs] = useState(true);
    const [UID_A, setUID_A] = useState([]);

    // Fetch group members to check who is already in group
    useEffect(() => {
        const fetchGroup = async () => {
            try {
                const groupData = await getGroupInfo(RoomID1);
                if (groupData) {
                    setUID_A(groupData.UID || []);
                }
            } catch (error) {
                console.error("Error fetching group:", error);
            }
        };
        fetchGroup();
    }, [RoomID1]);

    // Subscribe to friends list with user data
    useEffect(() => {
        if (!user?.uid) return;
        const unsubscribe = subscribeToFriends(user.uid, async (friends) => {
            const enriched = await Promise.all(
                friends.map(async (f) => {
                    const userData = await getUserById(f.UID_fr);
                    return userData ? {
                        id: f.id,
                        UID: f.UID_fr,
                        photoUrl: userData.photoURL,
                        name: userData.name,
                    } : null;
                })
            );
            setListFriend(enriched.filter(Boolean));
        });
        return () => unsubscribe();
    }, [user?.uid]);

    // Search users
    useEffect(() => {
        if (!search || !user?.uid) {
            setFriendsList([]);
            return;
        }
        const handleSearch = async () => {
            try {
                setLoading(true);
                const results = await searchUsersByName(search, user.uid);
                setFriendsList(results.map(u => ({
                    id: u.id,
                    name: u.name,
                    photoUrl: u.photoURL,
                    email: u.email,
                    UID: u.UID,
                })));
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setLoading(false);
            }
        };
        handleSearch();
    }, [search, user?.uid]);

    const handleInputChange2 = (text) => {
        setSearch(text);
        setShowTabs(text.trim() === "");
    };

    // sắp xếp danh sách bạn bè theo tên
    const sortedUserFriendsList = listFriend.slice().sort((a, b) => {
        return a.name.localeCompare(b.name);
    });

    // chọn bạn bè theo vào nhóm
    const toggleSelection = (UID, name) => {
        const isSelected = selectedFriend.includes(UID);
        if (!isSelected) {
            setSelectedFriend([...selectedFriend, UID]);
        } else {
            setSelectedFriend(selectedFriend.filter(friendUID => friendUID !== UID));
        }
    };

    const isMemberAlready = (friendUID) => {
        return UID_A.includes(friendUID);
    };

    const renderUserFriendItem = ({ item }) => (
        <View style={styles.itemContainer2}>
            <Pressable>
                <View style={styles.containerProfile}>
                    <Image style={styles.avatar} source={{ uri: item.photoUrl }} />
                    <Text style={styles.text1}>{item.name}</Text>
                    {isMemberAlready(item.UID) ? (
                        <Text style={styles.text2}>Đã tham gia</Text>
                    ) : (
                        <RadioButton
                            value={item.UID}
                            status={selectedFriend.includes(item.UID) ? 'checked' : 'unchecked'}
                            onPress={() => toggleSelection(item.UID)}
                            color="#006AF5"
                        />
                    )}
                </View>
            </Pressable>
        </View>
    );

    const renderFriendItem = ({ item }) => (
        <View style={styles.itemContainer2}>
            <Pressable >
                <View style={styles.containerProfile}>
                    <Image style={styles.avatar} source={{ uri: item.photoUrl }} />
                    <Text style={styles.text1}>{item.name}</Text>
                    {isMemberAlready(item.UID) ? (
                        <Text style={styles.text2}>Đã tham gia</Text>
                    ) : (
                        <RadioButton
                            value={item.UID}
                            status={selectedFriend.includes(item.UID) ? 'checked' : 'unchecked'}
                            onPress={() => toggleSelection(item.UID)}
                            color="#006AF5"
                        />
                    )}
                </View>
            </Pressable>
        </View>
    );

    const addMemberToGroup = async () => {
        try {
            await addMembers(RoomID1, selectedFriend);
            setSelectedFriend([]);
            navigation.goBack();
        } catch (error) {
            console.error("Error adding members to group:", error);
        }
    };


    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.searchContainer}>
                    <Pressable onPress={() => navigation.goBack()}>
                        <View style={{ marginLeft: 10 }}>
                            <AntDesign name="arrowleft" size={20} color="white" />
                        </View>
                    </Pressable>
                    <Text style={styles.textSearch}>Thêm thành viên </Text>
                </View>
                <View style={styles.searchContainer3}>
                    <View style={{ marginLeft: 15 }}>
                        <AntDesign name="search1" size={20} color="black" />
                    </View>
                    <TextInput
                        style={styles.searchInput2}
                        value={search}
                        onChangeText={handleInputChange2}
                        placeholder="Tìm tên"
                        placeholderTextColor="black"
                    />
                </View>
                <View style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <FlatList
                        horizontal
                        data={selectedFriend}
                        renderItem={({ item }) => (
                            <View style={{ margin: 5 }}>
                                <Image style={styles.avatar} source={{ uri: (listFriend.find(friend => friend.UID === item) || friendsList.find(friend => friend.UID === item))?.photoUrl }} />
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => toggleSelection(item)}
                                >
                                    <AntDesign name="close" size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}
                        keyExtractor={(item) => item}
                    />
                    {selectedFriend.length > 0 && ( // Check if any friend is selected
                        <TouchableOpacity style={{ width: 55, height: 55, borderRadius: 35, borderWidth: 2, borderColor: '#006AF5', alignItems: 'center', justifyContent: 'center', backgroundColor: "#006AF5" }}
                            onPress={addMemberToGroup}
                        >
                            <AntDesign name="arrowright" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                </View>
                {showTabs ? ( // Hiển thị Tabs nếu showTabs là true
                    <View>
                        <View style={{ marginLeft: 15, marginTop: 10, fontWeight: 'bold' }}>
                            <Text> Gợi ý</Text>
                        </View>
                        {/* <Tab.Navigator>
                            <Tab.Screen name="Gần đây" component={Current_mess} />
                            <Tab.Screen name="Danh bạ" component={Phonebook_2} />
                        </Tab.Navigator> */}
                        <View >
                            <FlatList
                                data={sortedUserFriendsList}
                                renderItem={renderUserFriendItem}
                                keyExtractor={(item) => item.id}
                            />
                        </View>
                    </View>
                ) : ( // Ngược lại, hiển thị nội dung 
                    <View>
                        {loading ? (
                            <ActivityIndicator style={styles.loadingIndicator} size="large" color="#006AF5" />
                        ) : (
                            <FlatList
                                data={friendsList}
                                renderItem={renderFriendItem}
                                keyExtractor={(item) => item.id}
                            />
                        )}
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
    searchContainer2: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        height: 68,
        width: '100%',
    },
    searchContainer3: {
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f0f0f0",
        height: 48,
        borderRadius: 12,
        marginLeft: 10,
        marginRight: 10,
    },
    searchContainer4: {

    },
    searchInput: {
        flex: 1,
        justifyContent: "center",
        height: 48,
        marginLeft: 30,
    },
    searchInput2: {
        flex: 1,
        justifyContent: "center",
        height: 48,
        marginLeft: 10,
    },
    textSearch: {
        flex: 1,
        color: "white",
        fontWeight: 'bold',
        marginLeft: 20
    },
    textSearch1: {
        color: "white",
        fontWeight: 'bold',
        marginRight: 20
    },
    itemContainer: {
        marginTop: 20,
        flex: 1,
        margin: 20,
    },
    itemContainer2: {
        marginTop: 5,
        flex: 1,
        margin: 5,
    },
    image: {
        width: 100,
        height: 100,
        resizeMode: 'cover',
    },
    text: {
        marginTop: 10,
    },
    avatarPlaceholder: {
        marginLeft: 15,
        backgroundColor: "white",
        width: 55,
        height: 55,
        borderRadius: 35,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarPlaceholderText: {
        fontSize: 8,
        color: "#8E8E93",
    },
    loadingIndicator: {
        marginTop: 20,
    },
    containerProfile: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        height: 60,
    },
    avatar: {
        marginLeft: 15,
        width: 55,
        height: 55,
        borderRadius: 35,
        borderWidth: 2,  // Độ rộng của khung viền
        borderColor: '#006AF5',  // Màu sắc của khung viền, bạn có thể thay đổi màu tùy ý
    },
    avatar1: {
        marginLeft: 5,
        width: 55,
        height: 55,
        borderRadius: 35,
        borderWidth: 2,  // Độ rộng của khung viền
        borderColor: '#006AF5',  // Màu sắc của khung viền, bạn có thể thay đổi màu tùy ý
    },
    text1: {
        marginLeft: 20,
        fontSize: 20,
        flex: 1,
    },
    text2: {
        marginRight: 20,
        fontSize: 14,
    },
    vAdd_gr: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        height: 60,
        backgroundColor: '#006AF5',

    },
    cancelButton: {
        position: 'absolute',
        top: 0,
        right: -5,
        backgroundColor: '#e0e0e0',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },

});

export default Add_mem_gr;
