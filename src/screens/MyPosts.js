import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, AntDesign, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { formatDistanceToNowStrict } from 'date-fns';
import { vi } from 'date-fns/locale';

const MyPosts = () => {
  const navigation = useNavigation();
  const [userData, setUserData] = useState(null);
  const [myPosts, setMyPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const db = getFirestore();

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          setUserData(JSON.parse(userDataString));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
  }, []);

  // Load my posts
  useEffect(() => {
    if (!userData) return;

    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('userId', '==', userData.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData = [];

      querySnapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() });
      });

      // Sort posts by createdAt in client-side (no index needed)
      postsData.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setMyPosts(postsData);
      setIsLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
  };

  // Delete post
  const handleDeletePost = (postId) => {
    Alert.alert(
      'Xóa bài viết',
      'Bạn có chắc chắn muốn xóa bài viết này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'posts', postId));
              Alert.alert('Thành công', 'Đã xóa bài viết');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Lỗi', 'Không thể xóa bài viết');
            }
          }
        }
      ]
    );
  };

  // View post detail
  const viewPostDetail = (postId) => {
    navigation.navigate('PostDetail', { postId });
  };

  // Get reaction summary
  const getReactionSummary = (reactions) => {
    if (!reactions) return { count: 0, types: [] };

    const reactionCounts = {};
    Object.values(reactions).forEach(reaction => {
      if (reaction && reaction.type) {
        reactionCounts[reaction.type] = (reactionCounts[reaction.type] || 0) + 1;
      }
    });

    const count = Object.keys(reactions).filter(key => reactions[key]).length;
    return { count };
  };

  // Render reaction icon
  const renderReactionIcon = (type, size = 16) => {
    const icons = {
      like: '👍',
      love: '❤️',
      haha: '😆',
      wow: '😮',
      sad: '😢',
      angry: '😠'
    };
    return <Text style={{ fontSize: size }}>{icons[type] || '👍'}</Text>;
  };

  // Render post item
  const renderPostItem = ({ item }) => {
    const reactionSummary = getReactionSummary(item.reactions);
    const hasMedia = item.mediaUrl || (item.mediaUrls && item.mediaUrls.length > 0);
    const firstImage = item.mediaUrls && item.mediaUrls.length > 0 ? item.mediaUrls[0] : item.mediaUrl;

    return (
      <TouchableOpacity
        style={styles.postItem}
        onPress={() => viewPostDetail(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.postContent}>
          <View style={styles.postHeader}>
            <View style={styles.postInfo}>
              <Text style={styles.postTime}>
                {item.createdAt ? formatDistanceToNowStrict(item.createdAt.toDate(), {
                  addSuffix: true,
                  locale: vi
                }) : 'Vừa xong'}
              </Text>
              {item.isSharedPost && (
                <View style={styles.sharedBadge}>
                  <Ionicons name="repeat" size={14} color="#1877f2" />
                  <Text style={styles.sharedText}>Đã chia sẻ</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#e74c3c" />
            </TouchableOpacity>
          </View>

          {item.text ? (
            <Text style={styles.postText} numberOfLines={3}>
              {item.text}
            </Text>
          ) : null}

          {hasMedia && item.mediaType !== 'video' && (
            <Image
              source={{ uri: firstImage }}
              style={styles.postImage}
            />
          )}

          {item.mediaType === 'video' && (
            <View style={styles.videoThumbnail}>
              <Ionicons name="play-circle" size={50} color="#fff" />
            </View>
          )}

          {item.mediaUrls && item.mediaUrls.length > 1 && (
            <View style={styles.multipleImagesBadge}>
              <Ionicons name="images" size={16} color="#fff" />
              <Text style={styles.multipleImagesText}>{item.mediaUrls.length}</Text>
            </View>
          )}

          <View style={styles.postStats}>
            <View style={styles.statItem}>
              <AntDesign name="like2" size={16} color="#65676b" />
              <Text style={styles.statText}>{reactionSummary.count || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <FontAwesome5 name="comment" size={14} color="#65676b" />
              <Text style={styles.statText}>{item.commentCount || 0}</Text>
            </View>
            {item.shares > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="repeat" size={16} color="#65676b" />
                <Text style={styles.statText}>{item.shares}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1877f2" />
        <Text style={styles.loadingText}>Đang tải bài viết...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bài viết của tôi</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Posts List */}
      {myPosts.length > 0 ? (
        <FlatList
          data={myPosts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#1877f2']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Bạn chưa có bài viết nào</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.createButtonText}>Tạo bài viết</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary */}
      {myPosts.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            Tổng cộng: <Text style={styles.summaryCount}>{myPosts.length}</Text> bài viết
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  postItem: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  postContent: {
    padding: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  postTime: {
    fontSize: 13,
    color: '#65676b',
    marginRight: 10,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f3ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sharedText: {
    fontSize: 12,
    color: '#1877f2',
    marginLeft: 4,
    fontWeight: '600',
  },
  postText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  multipleImagesBadge: {
    position: 'absolute',
    top: 220,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  multipleImagesText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    color: '#65676b',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#65676b',
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#1877f2',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summary: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    color: '#65676b',
  },
  summaryCount: {
    fontWeight: 'bold',
    color: '#1877f2',
    fontSize: 16,
  },
});

export default MyPosts;
