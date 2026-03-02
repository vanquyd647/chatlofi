import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Image, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { getAuth } from 'firebase/auth';
import EmptyState from '../components/EmptyState';
import { subscribeToUserGroups } from '../services/groupService';

const Groups = () => {
    const navigation = useNavigation();
    const auth = getAuth();
    const user = auth.currentUser;
    const [userGroups, setUserGroups] = useState([]);

  // Subscribe to user's groups via service
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToUserGroups(user.uid, (groups) => {
      setUserGroups(groups);
    });
    return () => unsubscribe();
  }, [user?.uid]);



  const renderItem = ({ item }) => (
    <View style={styles.itemContainer2}>
        <TouchableOpacity onPress={() => navigation.navigate("Chat_fr", {GroupData:item})} activeOpacity={0.7}>
        <View style={styles.containerProfile}>
            <Image source={{ uri: item.Photo_group }} style={styles.avatar} />
            <Text style={styles.text1}>{item.Name_group}</Text>
        </View>
        </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => navigation.navigate("Add_group")} activeOpacity={0.7}>
                    <View style={styles.view1}>
                        <View style={styles.iconAddgroup}>
                        <MaterialIcons name="group-add" size={24} color="#006AF5" />
                        </View>
                        <Text style={styles.text1}>Tạo nhóm mới</Text>
                    </View>
                </TouchableOpacity>
                <View style={{backgroundColor:'#f0f0f0', height:1}}></View>
                {userGroups.length === 0 ? (
                  <EmptyState
                    icon="people-outline"
                    title="Chưa có nhóm nào"
                    subtitle="Tạo nhóm mới để bắt đầu trò chuyện cùng bạn bè"
                    buttonText="Tạo nhóm"
                    onButtonPress={() => navigation.navigate("Add_group")}
                  />
                ) : (
                  <FlatList
                      data={userGroups}
                      renderItem={renderItem}
                      keyExtractor={item => item.ID_roomChat.toString()}
                      contentContainerStyle={{ paddingBottom: 80 }}
                  />
                )}
            </SafeAreaView>
        </View>
  )
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
      padding: 9,
      height: 48,
      width: '100%',
  },
  searchInput: {
      flex: 1,
      justifyContent: "center",
      height: 48,
      marginLeft: 10,
  },
  textSearch: {
      color: "white",
      fontWeight: '500'
  },
  itemContainer: {
      marginTop: 20,
      flex: 1,
      margin: 20,
  },
  image: {
      width: 100,
      height: 100,
      resizeMode: 'cover',
  },
  text: {
      marginTop: 10,
  },
  view1: {
      alignItems: "center",
      flexDirection: 'row',
      margin: 10,
  },
  text1: {
      fontSize: 15,
      justifyContent: "center",
      marginLeft: 10
  },
  iconAddgroup: {
      backgroundColor: "#f0f8ff",
      width: 55,
      height: 55,
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
  },
  itemContainer2: {
    marginTop: 5,
    flex: 1,
    margin: 5,
  },
  containerProfile: {
    marginTop:10,
    flexDirection: 'row',
    alignItems:'center',
    width: '100%',
    height:60,
  },
  avatar: {
    marginLeft: 15,
    width: 55,
    height: 55,
    borderRadius: 35,
    borderWidth: 2,  // Độ rộng của khung viền
    borderColor: '#006AF5',  // Màu sắc của khung viền, bạn có thể thay đổi màu tùy ý
  },
});

export default Groups