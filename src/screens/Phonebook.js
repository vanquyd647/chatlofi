import React, { useState } from 'react';
import { SafeAreaView, Pressable, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { AntDesign, MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import dataApp from "../../data/Nameapp.js";
import { useNavigation } from "@react-navigation/native";
import Friends from '../screens/Friends';
import Groups from '../screens/Groups';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

const Phonebook = () => {
  const navigation = useNavigation();
  const [input, setInput] = useState("");
  const TabTop = createMaterialTopTabNavigator();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.searchContainer}>
          <AntDesign name="search1" size={20} color="white" />
          <TouchableOpacity
            style={styles.searchInput}
            onPress={() => navigation.navigate("SearchFriend")}
            activeOpacity={0.7}
          >
            <Text style={styles.textSearch}>Tìm kiếm bạn bè...</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}>
            <MaterialCommunityIcons name="qrcode-scan" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}>
            <Feather name="plus" size={30} color="white" />
          </TouchableOpacity>
        </View>
        <TabTop.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#006AF5',
            tabBarInactiveTintColor: '#666',
            tabBarIndicatorStyle: {
              backgroundColor: '#006AF5',
              height: 3,
            },
            tabBarLabelStyle: {
              fontSize: 15,
              fontWeight: '600',
              textTransform: 'none',
            },
            tabBarStyle: {
              backgroundColor: 'white',
              elevation: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            },
          }}
        >
          <TabTop.Screen name="Bạn bè" component={Friends} />
          <TabTop.Screen name="Nhóm" component={Groups} />
        </TabTop.Navigator>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  textSearch: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: '500',
    fontSize: 15,
  },
});

export default Phonebook;
