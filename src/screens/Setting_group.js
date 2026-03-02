import React from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation, useRoute } from "@react-navigation/native";
import { getAuth } from 'firebase/auth';
import { dissolveGroup as dissolveGroupService } from '../services/groupService';

const Setting_group = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { RoomID1 } = route.params;
  const { Admin_group1 } = route.params;
  const auth = getAuth();
  const user = auth.currentUser;

  const handleDissolveGroup = async () => {
    try {
      await dissolveGroupService(RoomID1, user.uid, Admin_group1);
      navigation.navigate("Main");
    } catch (error) {
      console.error("Error dissolving group:", error);
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
            <Text style={styles.textSearch}>Tùy chọn</Text>
          </View>
        </View>
        <View style={{ backgroundColor: '#f5f5f5', height: 8 }}></View>
        <TouchableOpacity style={{ height: 60, justifyContent: 'center' }} onPress={handleDissolveGroup} activeOpacity={0.7}>
          <View style={{ marginLeft: 20, flexDirection: 'row' }}>
            <Text style={{ marginLeft: 20, fontSize: 20, color: 'red' }}>Giải tán nhóm</Text>
          </View>
        </TouchableOpacity>
        <View style={{ backgroundColor: '#f5f5f5', height: 8 }}></View>
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
  containerProfile: {
    marginTop: 20,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'white',
    width: '100%',
    height: 120,
  },
  title: {
    fontSize: 24,
  },
  avatar: {
    width: 75,
    height: 75,
    borderRadius: 35,
    borderWidth: 2,  // Độ rộng của khung viền
    borderColor: '#006AF5',  // Màu sắc của khung viền, bạn có thể thay đổi màu tùy ý
  },
  h1: {
    margin: 20,
    flexDirection: "column",
    alignItems: "center",
  },

});

export default Setting_group;
