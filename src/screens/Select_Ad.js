import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, Image, FlatList, TouchableOpacity } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation, useRoute } from "@react-navigation/native";
import { getAuth } from 'firebase/auth';
import { subscribeToGroupInfo, transferAdminAndLeave } from '../services/groupService';
import { getUserById } from '../services/userService';

const Select_Ad = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const auth = getAuth();
    const user = auth.currentUser;
    const { RoomID1 } = route.params;
    const [memberDetails, setMemberDetails] = useState([]);
    const [adminCheck, setAdminCheck] = useState('');
    const [subAdmin, setSubAdmin] = useState([]);

    // Subscribe to group info + fetch member details via services
    useEffect(() => {
        const unsubscribe = subscribeToGroupInfo(RoomID1, async (groupData) => {
            if (!groupData) return;
            setAdminCheck(groupData.Admin_group);
            setSubAdmin(groupData.Sub_Admin || []);
            const UIDArray = groupData.UID || [];
            const memberDetailsArray = await Promise.all(
                UIDArray.map(uid => getUserById(uid))
            );
            setMemberDetails(memberDetailsArray.filter(Boolean));
        });
        return () => unsubscribe();
    }, [RoomID1, user.uid]);

    const renderItem = ({ item }) => (
        <View style={styles.itemContainer}>
            <Pressable onPress={() => select_Admin(item)}>
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

    const select_Admin = async (item) => {
        try {
            await transferAdminAndLeave(RoomID1, adminCheck, item.UID);
            navigation.navigate('Main');
        } catch (error) {
            console.error('Error transferring admin:', error);
        }
    };


    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.searchContainer}>
                    <Pressable onPress={() => navigation.goBack()}>
                        <AntDesign name="arrowleft" size={20} color="white" />
                    </Pressable>
                    <View style={styles.searchInput}>
                        <Text style={styles.textSearch}>Chọn trưởng nhóm trước khi rời</Text>
                    </View>
                </View>
                <View>
                    <FlatList
                        contentContainerStyle={{ paddingBottom: 300 }}
                        data={memberDetails}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => index.toString()} />
                </View>
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
export default Select_Ad