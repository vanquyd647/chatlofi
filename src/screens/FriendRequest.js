import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import Friend_received from './Friend_received';
import Friend_sent from './Friend_sent';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import AppHeader from '../components/AppHeader';

const Tab = createMaterialTopTabNavigator();

const FriendRequest = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <AppHeader
          title="Lời mời kết bạn"
          onBack={() => navigation.navigate("Main")}
          rightContent={<MaterialIcons name="settings" size={24} color="white" />}
        />
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#006AF5', // Màu của viền dưới khi tab được chọn
            tabBarInactiveTintColor: 'black', // Màu của tab khi không được chọn
            tabBarIndicatorStyle: { backgroundColor: '#006AF5' }, // Màu nền của viền dưới khi tab được chọn
            tabBarLabelStyle: { fontSize: 14, fontWeight: 'bold' }, // Kiểu chữ của label
            tabBarStyle: { backgroundColor: 'white' }, // Màu nền của thanh tab
          }}
        >
          <Tab.Screen name="Đã Nhận" component={Friend_received} />
          <Tab.Screen name="Đã gửi" component={Friend_sent} />
        </Tab.Navigator>
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
    flex: 1,
    color: "white",
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
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
});

export default FriendRequest;
