import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, SafeAreaView, Pressable, ImageBackground, TouchableOpacity, ScrollView } from 'react-native'
import { useNavigation, useRoute } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import * as ImagePicker from 'expo-image-picker';
import { AntDesign } from '@expo/vector-icons';
import { subscribeToUser, updateUserPhoto, cascadeUpdatePhoto } from '../services/userService';
import { uploadProfilePhoto, deleteOldProfilePhotos } from '../services/storageService';
import Avatar from '../components/Avatar';
const Personal_page = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState(null);
  const [gender, setGender] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [email, setEmail] = useState('');
  const auth = getAuth();
  const user = auth.currentUser;
  const [userData, setUserData] = useState(null);
  // Hỗ trợ cả userId (cách cũ), friendData.UID (từ Option_chat), và friendId (từ Friends.js)
  const { userId, friendData, friendId } = route.params || {};
  const viewedUserId = friendData?.UID || friendId || userId || user.uid; // Ưu tiên friendData.UID, sau đó friendId
  const isOwnProfile = viewedUserId === user.uid; // Kiểm tra xem có phải profile của mình không

  useEffect(() => {
    const unsubscribe = subscribeToUser(viewedUserId, (data) => {
      setUserData(data);
      setDisplayName(data.name);
      setPhotoURL(data.photoURL);
      setBirthdate(data.birthdate);
      setEmail(data.email);
      setGender(data.gender);
    });
    return () => unsubscribe();
  }, [viewedUserId]);

  // Cập nhật ảnh đại diện
  const handleUpdatePhoto = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (!result.cancelled) {
        const uri = result.assets[0].uri;
        const userId = auth.currentUser.uid;

        // Xóa ảnh cũ
        await deleteOldProfilePhotos(userId);

        // Tải ảnh mới lên và cập nhật URL
        const newPhotoURL = await uploadProfilePhoto(userId, uri);
        if (newPhotoURL) {
          await updateUserPhoto(userId, newPhotoURL);
          await cascadeUpdatePhoto(userId, newPhotoURL);
          setPhotoURL(newPhotoURL);
        }
      }
    } catch (error) {
      console.error('Error updating photo:', error);
    }
  };


  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} bounces={false}>
        <View style={styles.PersonalContainer}>
          <ImageBackground source={require('../../assets/img/per1.png')} style={styles.background}>
            <Pressable onPress={() => navigation.goBack()} style={{ margin: 20 }}>
              <AntDesign name="arrowleft" size={20} color="white" />
            </Pressable>
            <View style={styles.containerProfile}>
              <TouchableOpacity onPress={isOwnProfile ? handleUpdatePhoto : null} disabled={!isOwnProfile} style={{ marginLeft: 15 }}>
                <Avatar uri={photoURL} name={displayName} size="large" bordered borderColor="white" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>{displayName}</Text>
              </View>
            </View>
          </ImageBackground>
        </View>
        <View>
          <View style={{ margin: 20, marginBottom: 12 }}>
            <Text style={{ fontWeight: "bold", fontSize: 16 }}>Thông tin cá nhân</Text>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginBottom: 16, alignItems: 'center' }}>
            <View style={{ width: 120 }}>
              <Text style={{ color: '#666', fontSize: 15 }}>Giới tính</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500' }}>{gender}</Text>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginBottom: 16, alignItems: 'center' }}>
            <View style={{ width: 120 }}>
              <Text style={{ color: '#666', fontSize: 15 }}>Ngày sinh</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500' }}>{birthdate}</Text>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginBottom: 16, alignItems: 'center' }}>
            <View style={{ width: 120 }}>
              <Text style={{ color: '#666', fontSize: 15 }}>Email</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500' }}>{email}</Text>
          </View>
        </View>
        {isOwnProfile && (
          <View style={{ margin: 20 }}>
            <TouchableOpacity onPress={() => navigation.navigate("Edit_in4Personal")} activeOpacity={0.7}>
              <View style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: "#006AF5", height: 50, borderRadius: 12 }}>
                <Text style={{ fontWeight: '600', color: '#fff', fontSize: 16 }}>Chỉnh sửa</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  PersonalContainer: {
    height: 200,
    width: '100%',
  },
  background: {
    flex: 1,
    resizeMode: 'cover', // hoặc 'contain' tùy thuộc vào yêu cầu của bạn
  },
  containerProfile: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 5,
    paddingBottom: 15,
  },
  avatar: {
    marginLeft: 15,
    width: 75,
    height: 75,
    borderRadius: 35,
    borderWidth: 2,  // Độ rộng của khung viền
    borderColor: 'white',  // Màu sắc của khung viền, bạn có thể thay đổi màu tùy ý
  },
  avatarPlaceholder: {
    marginLeft: 15,
    backgroundColor: "#E1E2E6",
    width: 75,
    height: 75,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 8,
    color: "#8E8E93",
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
export default Personal_page