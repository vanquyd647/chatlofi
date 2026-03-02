import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, Image, FlatList, Modal, TouchableOpacity } from 'react-native';
import { AntDesign, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from "@react-navigation/native";
import { getAuth } from 'firebase/auth';
import { subscribeToGroupInfo, removeMember, toggleSubAdmin } from '../services/groupService';
import { getUserById } from '../services/userService';

const Manager_group = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const auth = getAuth();
    const user = auth.currentUser;
    const { RoomID1 } = route.params;
    const [selectedTab, setSelectedTab] = useState('Tất cả');
    const [memberDetails, setMemberDetails] = useState([]);
    const [manager_group, setManager_group] = useState([]);
    const [memberCount, setMemberCount] = useState(0);
    const [admin, setAdmin] = useState('');
    const [adminCheck, setAdminCheck] = useState('');
    const [subAdmin, setSubAdmin] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalData, setModalData] = useState(null);
    const [showApproveSection, setShowApproveSection] = useState(true);
    const [subAdminCheck, setSubAdminCheck] = useState('');
    const [mergedUIDs, setMergedUIDs] = useState([]);



    useEffect(() => {
        const mergedUIDs = [];
        if (adminCheck) {
            mergedUIDs.push(adminCheck);
        }
        mergedUIDs.push(...subAdmin);
        setMergedUIDs(mergedUIDs);
    }, [adminCheck, subAdmin]);

    // Subscribe to group info + fetch member details via services
    useEffect(() => {
        const unsubscribe = subscribeToGroupInfo(RoomID1, async (groupData) => {
            if (!groupData) return;
            const groupAdmin = groupData.Admin_group;
            setAdminCheck(groupAdmin);
            setAdmin(groupAdmin === user.uid ? groupAdmin : null);
            setSubAdmin(groupData.Sub_Admin || []);
            setSubAdminCheck(groupData.Sub_Admin && groupData.Sub_Admin.includes(user.uid) ? user.uid : '');
            const UIDArray = groupData.UID || [];
            const memberDetailsArray = await Promise.all(
                UIDArray.map(uid => getUserById(uid))
            );
            setMemberDetails(memberDetailsArray.filter(Boolean));
            setMemberCount(memberDetailsArray.length);
        });
        return () => unsubscribe();
    }, [RoomID1, user.uid]);

    const renderItem = ({ item }) => (
        <View style={styles.itemContainer}>
            <Pressable onLongPress={() => setModalVisibility(true, [item])}>
                <View style={styles.containerProfile}>
                    <Image source={{ uri: item.photoURL }} style={styles.avatar} />
                    <View style={{ flexDirection: 'column' }}>
                        <Text style={styles.textName}>{item.name}</Text>
                        {item.UID === adminCheck && <Text style={styles.textAdmin}>Trưởng nhóm</Text>}
                        {subAdmin.includes(item.UID) && <Text style={styles.textAdmin}>Phó nhóm</Text>}
                    </View>
                </View>
            </Pressable>
        </View>
    );

    // Fetch manager details from mergedUIDs
    useEffect(() => {
        const fetchUserManager = async () => {
            try {
                const userDetails = await Promise.all(
                    mergedUIDs.map(uid => getUserById(uid))
                );
                setManager_group(userDetails.filter(Boolean));
            } catch (error) {
                console.error('Error fetching manager details:', error);
            }
        };
        if (mergedUIDs.length > 0) fetchUserManager();
    }, [mergedUIDs]);

    const setModalVisibility = (isVisible, item) => {
        if (item) {
            setModalData(item);
            setModalVisible(isVisible);
        }
    };

    const delete_Member = async (uid) => {
        try {
            await removeMember(RoomID1, uid);
        } catch (error) {
            console.error("Error removing member:", error);
        }
    };

    const add_sub_admin = async (uid) => {
        try {
            await toggleSubAdmin(RoomID1, uid, false);
            setModalVisible(false);
        } catch (error) {
            console.error("Error appointing sub-admin:", error);
        }
    };

    const remove_sub_admin = async (uid) => {
        try {
            await toggleSubAdmin(RoomID1, uid, true);
            setModalVisible(false);
        } catch (error) {
            console.error("Error removing sub-admin:", error);
        }
    };

    useEffect(() => {
        if (selectedTab !== 'Tất cả') {
            setShowApproveSection(false); // Hide the section when any tab other than 'Tất cả' is selected
        } else {
            setShowApproveSection(true); // Show the section when 'Tất cả' tab is selected
        }
    }, [selectedTab]);

    return (
        <><SafeAreaView style={styles.container}>
            <View style={styles.searchContainer}>
                <Pressable onPress={() => navigation.goBack()}>
                    <AntDesign name="arrowleft" size={20} color="white" />
                </Pressable>
                <View style={styles.searchInput}>
                    <Text style={styles.textSearch}>Quản lý thành viên</Text>
                </View>
            </View>
            <View style={styles.tab1}>
                {(admin === null && !subAdmin.includes(user.uid)) && (
                    <Pressable onPress={() => setSelectedTab('Tất cả')}>
                        <Text style={{ color: selectedTab === 'Tất cả' ? '#006AF5' : 'black' }}>Tất cả</Text>
                    </Pressable>
                )}
                {(admin !== null || subAdmin.includes(user.uid)) && (
                    <>
                        <Pressable onPress={() => setSelectedTab('Tất cả')}>
                            <Text style={{ color: selectedTab === 'Tất cả' ? '#006AF5' : 'black' }}>Tất cả</Text>
                        </Pressable>
                        <Pressable onPress={() => setSelectedTab('Trưởng nhóm')}>
                            <Text style={{ color: selectedTab === 'Trưởng nhóm' ? '#006AF5' : 'black' }}>Quản trị nhóm</Text>
                        </Pressable>
                        <Pressable onPress={() => setSelectedTab('Đã mời')}>
                            <Text style={{ color: selectedTab === 'Đã mời' ? '#006AF5' : 'black' }}>Đã mời</Text>
                        </Pressable>
                        <Pressable onPress={() => setSelectedTab('Đã chặn')}>
                            <Text style={{ color: selectedTab === 'Đã chặn' ? '#006AF5' : 'black' }}>Đã chặn</Text>
                        </Pressable>
                    </>
                )}
            </View>
            <View style={{ backgroundColor: '#f0f0f0', height: 1 }}></View>
            {showApproveSection && (admin !== null || subAdmin.includes(user.uid)) && (
                <View>
                    <Pressable>
                        <View style={styles.view1}>
                            <View style={styles.iconAddgroup}>
                                <MaterialIcons name="group-add" size={24} color="black" />
                            </View>
                            <Text style={styles.text1}>Duyệt thành viên</Text>
                        </View>
                    </Pressable>
                    <View style={{ backgroundColor: '#f0f0f0', height: 1 }}></View>
                </View>
            )}
            <View>
                {selectedTab === 'Tất cả' && (
                    <View>
                        <Text style={{ padding: 2, color: '#006AF5' }}>Thành viên ({memberCount})</Text>
                        <FlatList
                            contentContainerStyle={{ paddingBottom: 80 }}
                            data={memberDetails}
                            renderItem={renderItem}
                            keyExtractor={(item, index) => index.toString()} />
                    </View>
                )}
                {selectedTab === 'Trưởng nhóm' && (
                    <View>
                        <FlatList
                            data={manager_group}
                            renderItem={renderItem}
                            keyExtractor={(item, index) => index.toString()}
                        />
                    </View>
                )}
                {selectedTab === 'Đã mời' && (
                    <View>
                        <Text>Nội dung cho tab Đã mời</Text>
                    </View>
                )}
                {selectedTab === 'Đã chặn' && (
                    <View>
                        <Text>Nội dung cho tab Đã chặn</Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
            <View>
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={modalVisible}
                    onRequestClose={() => setModalVisibility(false)}
                >
                    <View style={styles.centeredView}>
                        <Pressable
                            onPress={() => setModalVisible(false)}
                            style={{ flex: 1, width: '100%' }}
                        />
                        <View style={styles.modalView}>
                            <View>
                                <Text style={styles.modalText1}>Thông tin thành viên</Text>
                            </View>
                            <View style={styles.modalOverlay}></View>
                            <View style={styles.containerProfile}>
                                {modalData && modalData.map((data, index) => (
                                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {data && data.photoURL && (
                                            <Image style={styles.image} source={{ uri: data.photoURL }} />
                                        )}
                                        {data && data.name && (
                                            <Text style={styles.modalText2}>{data.name}</Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                            <View style={styles.modalOverlay}></View>
                            <View>
                                <TouchableOpacity style={{ padding: 10 }}>
                                    <Text style={{ fontSize: 18 }}>Xem trang cá nhân</Text>
                                </TouchableOpacity>
                                {(admin !== null || subAdmin.includes(user.uid)) && modalData && (modalData[0].UID !== admin) && (modalData[0].UID !== adminCheck) && ((!subAdmin.includes(user.uid) && modalData[0].UID !== subAdminCheck) || (subAdmin.includes(user.uid) && !subAdmin.includes(modalData[0].UID))) ? (
                                    <View>
                                        <View>
                                            {!subAdminCheck && (
                                                <View>
                                                    {subAdmin.includes(modalData[0].UID) ? (
                                                        <TouchableOpacity style={{ padding: 10 }} onPress={() => remove_sub_admin(modalData[0].UID)}>
                                                            <Text style={{ fontSize: 18 }}>Xóa làm phó nhóm</Text>
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <TouchableOpacity style={{ padding: 10 }} onPress={() => add_sub_admin(modalData[0].UID)}>
                                                            <Text style={{ fontSize: 18 }}>Bổ nhiệm làm phó nhóm</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                        <TouchableOpacity style={{ padding: 10 }}>
                                            <Text style={{ fontSize: 18 }}>chặn</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={{ padding: 10 }} onPress={() => delete_Member(modalData[0].UID)}>
                                            <Text style={{ fontSize: 18, color: 'red' }}>Xóa khỏi nhóm</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View></View>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </>
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
    searchInput: {
        flex: 1,
        justifyContent: "center",
        marginLeft: 4,
    },
    textSearch: {
        color: "white",
        fontWeight: '600',
        fontSize: 16,
    },
    itemContainer: {
        marginTop: 20,
        marginHorizontal: 20,
    },
    avatar: {
        width: 55,
        height: 55,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: '#006AF5',
    },
    containerProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 10,
    },
    text1: {
        fontSize: 15,
        marginLeft: 10,
    },
    tab1: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        height: 50,
        alignItems: 'center',
    },
    view1: {
        alignItems: "center",
        flexDirection: 'row',
        margin: 10,
    },
    iconAddgroup: {
        backgroundColor: "#f0f8ff",
        width: 55,
        height: 55,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 22,
    },
    modalView: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: 300,
        backgroundColor: "#fff",
        borderTopRightRadius: 20,
        borderTopLeftRadius: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
    },
    modalText1: {
        padding: 10,
        textAlign: "center",
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalText2: {
        padding: 10,
        textAlign: "center",
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalOverlay: {
        backgroundColor: 'white',
        height: 1,
    },
    image: {
        marginLeft: 15,
        width: 55,
        height: 55,
        borderRadius: 35,
        borderWidth: 2,  // Độ rộng của khung viền
        borderColor: '#006AF5',  // Màu sắc của khung viền, bạn có thể thay đổi màu tùy ý
    },
    text: {
        marginLeft: 20,
        fontSize: 20,
        flex: 1,
    },
    textName: {
        marginLeft: 10,

    },
    textAdmin: {
        marginLeft: 10,
        color: '#808080',
    }
});

export default Manager_group;
