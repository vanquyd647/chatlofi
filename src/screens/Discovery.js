import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
  FlatList,
  TouchableOpacity,
  Modal,
  SectionList,
  Animated,
  ScrollView
} from 'react-native';
import { AntDesign, MaterialCommunityIcons, Feather, FontAwesome5, Ionicons, MaterialIcons, Entypo } from '@expo/vector-icons';
import dataApp from "../../data/Nameapp.js";
import { useNavigation } from "@react-navigation/native";

const Discovery = () => {
  const navigation = useNavigation();
  const [input, setInput] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  // Skeleton Loader Component
  const SkeletonUtility = () => {
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
      <View style={styles.skeletonUtility}>
        <Animated.View style={[styles.skeletonIcon, { opacity }]} />
        <Animated.View style={[styles.skeletonText, { opacity }]} />
      </View>
    );
  };

  const handleInputChange = (text) => {
    setInput(text);
  };

  const [state, SetState] = useState(dataApp);

  const truncateName = (name, maxLength) => {
    if (name.length > maxLength) {
      return name.substring(0, maxLength) + '...';
    } else {
      return name;
    }
  };

  const miniGames = [
    { id: '1', name: 'Caro', icon: 'grid', color: '#FF6B6B' },
    { id: '2', name: 'Cờ vua', icon: 'chess', color: '#4ECDC4' },
    { id: '3', name: 'Xếp hình', icon: 'puzzle-piece', color: '#FFD166' },
    { id: '4', name: 'Đoán từ', icon: 'text', color: '#6A0572' },
    { id: '5', name: 'Bắn bóng', icon: 'basketball', color: '#F76E11' },
    { id: '6', name: 'Đua xe', icon: 'car-sport', color: '#118AB2' }
  ];

  const utilities = [
    { id: '1', name: 'Lịch', icon: 'calendar-alt', color: '#FF9F1C', screen: 'Calendar' },
    { id: '2', name: 'Tin tức', icon: 'newspaper', color: '#2EC4B6', screen: 'News' },
    { id: '3', name: 'Thời tiết', icon: 'cloud-sun', color: '#E71D36', screen: 'Weather' },
    { id: '4', name: 'Ghi chú', icon: 'sticky-note', color: '#011627', screen: 'Notes' },
    { id: '5', name: 'Bản đồ', icon: 'map-marked-alt', color: '#6A0572', screen: 'Map' },
    { id: '6', name: 'Nhạc', icon: 'music', color: '#7209B7', screen: 'Music' },
    { id: '7', name: 'Máy tính', icon: 'calculator', color: '#4361EE', screen: 'Calculator' },
    { id: '8', name: 'Tài liệu', icon: 'file-alt', color: '#3D5A80', screen: 'Documents' }
  ];

  // Chuẩn bị dữ liệu cho SectionList
  const sections = [
    {
      title: 'Tiện ích',
      data: [utilities],
      renderItem: ({ item }) => (
        loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.utilitiesContainer}>
            <SkeletonUtility />
            <SkeletonUtility />
            <SkeletonUtility />
            <SkeletonUtility />
            <SkeletonUtility />
          </ScrollView>
        ) : (
          <FlatList
            data={item}
            renderItem={renderUtility}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.utilitiesContainer}
          />
        )
      ),
    },
    {
      title: 'Mini Game',
      data: [miniGames],
      renderItem: ({ item }) => (
        loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniGamesContainer}>
            <SkeletonUtility />
            <SkeletonUtility />
            <SkeletonUtility />
          </ScrollView>
        ) : (
          <FlatList
            data={item}
            renderItem={renderMiniGame}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.miniGamesContainer}
          />
        )
      ),
    }
  ];

  const renderUtility = ({ item }) => (
    <TouchableOpacity
      style={styles.utilityItem}
      onPress={() => navigation.navigate(item.screen)}
      activeOpacity={0.7}
    >
      <View style={[styles.utilityIcon, { backgroundColor: item.color }]}>
        <FontAwesome5 name={item.icon} size={22} color="white" />
      </View>
      <Text style={styles.utilityText} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderMiniGame = ({ item }) => (
    <TouchableOpacity
      style={[styles.miniGameItem, { backgroundColor: item.color }]}
      onPress={() => setSelectedGame(item)}
      activeOpacity={0.8}
    >
      {item.icon === 'chess' || item.icon === 'puzzle-piece' ? (
        <FontAwesome5 name={item.icon} size={28} color="white" />
      ) : (
        <Ionicons name={item.icon} size={28} color="white" />
      )}
      <Text style={styles.miniGameText}>{item.name}</Text>
    </TouchableOpacity>
  );

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
            <Text style={styles.textSearch}>Tìm kiếm tiện ích...</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowQRModal(true)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="qrcode-scan" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.plusButton}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={28} color="white" />
          </TouchableOpacity>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item, index) => index.toString()}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.seeMoreText}>Xem thêm</Text>
              </TouchableOpacity>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.sectionListContent}
        />
      </SafeAreaView>

      {/* Modal quét QR */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quét mã QR</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <AntDesign name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <View style={styles.qrContainer}>
              <View style={styles.qrScanner}>
                <MaterialCommunityIcons name="qrcode-scan" size={150} color="#006AF5" />
              </View>
              <Text style={styles.qrText}>Đặt mã QR vào khung hình để quét</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal tạo mới */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo mới</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <AntDesign name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <View style={styles.createOptions}>
              <TouchableOpacity style={styles.createOption}>
                <View style={[styles.createOptionIcon, { backgroundColor: '#FF6B6B' }]}>
                  <Ionicons name="people" size={24} color="white" />
                </View>
                <Text style={styles.createOptionText}>Tạo nhóm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createOption}>
                <View style={[styles.createOptionIcon, { backgroundColor: '#4ECDC4' }]}>
                  <Ionicons name="calendar" size={24} color="white" />
                </View>
                <Text style={styles.createOptionText}>Tạo sự kiện</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createOption}>
                <View style={[styles.createOptionIcon, { backgroundColor: '#FFD166' }]}>
                  <MaterialIcons name="post-add" size={24} color="white" />
                </View>
                <Text style={styles.createOptionText}>Tạo bài viết</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createOption}>
                <View style={[styles.createOptionIcon, { backgroundColor: '#6A0572' }]}>
                  <Entypo name="game-controller" size={24} color="white" />
                </View>
                <Text style={styles.createOptionText}>Tạo phòng game</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal game */}
      <Modal
        visible={selectedGame !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedGame(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedGame?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedGame(null)}>
                <AntDesign name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <View style={styles.gameContainer}>
              <View style={[styles.gameIcon, { backgroundColor: selectedGame?.color }]}>
                {selectedGame?.icon === 'chess' || selectedGame?.icon === 'puzzle-piece' ? (
                  <FontAwesome5 name={selectedGame?.icon} size={50} color="white" />
                ) : (
                  <Ionicons name={selectedGame?.icon} size={50} color="white" />
                )}
              </View>
              <Text style={styles.gameDescription}>
                Chơi {selectedGame?.name} ngay bây giờ hoặc mời bạn bè tham gia!
              </Text>
              <View style={styles.gameButtons}>
                <TouchableOpacity style={styles.gameButton}>
                  <Text style={styles.gameButtonText}>Chơi ngay</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.gameButton, styles.inviteButton]}>
                  <Text style={styles.inviteButtonText}>Mời bạn bè</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  plusButton: {
    marginLeft: 5,
  },

  // Skeleton Loaders
  skeletonUtility: {
    alignItems: 'center',
    marginRight: 15,
  },
  skeletonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
  },
  skeletonText: {
    width: 50,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },

  sectionListContent: {
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  seeMoreText: {
    fontSize: 14,
    color: '#006AF5',
    fontWeight: '500',
  },

  utilitiesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    paddingBottom: 16,
  },
  utilityItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 70,
  },
  utilityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  utilityText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
    color: '#333',
    fontWeight: '500',
  },

  miniGamesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    paddingBottom: 16,
  },
  miniGameItem: {
    width: 130,
    height: 100,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  miniGameText: {
    color: 'white',
    marginTop: 8,
    fontWeight: '600',
    fontSize: 14,
  },

  appsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  itemContainer: {
    alignItems: 'center',
    width: '33%',
    marginBottom: 20,
  },
  image: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
    borderRadius: 15,
  },
  text: {
    marginTop: 5,
    fontSize: 12,
    textAlign: 'center',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  qrScanner: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#006AF5',
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#f8f9fa',
  },
  qrText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  createOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  createOption: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 24,
  },
  createOptionIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  createOptionText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  gameContainer: {
    alignItems: 'center',
    padding: 24,
  },
  gameIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  gameDescription: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
  },
  gameButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  gameButton: {
    backgroundColor: '#006AF5',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '48%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#006AF5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  gameButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  inviteButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#006AF5',
  },
  inviteButtonText: {
    color: '#006AF5',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default Discovery;
