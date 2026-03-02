import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  RefreshControl
} from 'react-native';
import { Video, Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import ImageViewer from 'react-native-image-zoom-viewer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign, Ionicons, Feather, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { createPost, getPost, getPosts, deletePost, updatePost, sharePost, togglePostReaction, addComment, toggleCommentLike, subscribeToComments, POSTS_PER_PAGE } from '../services/postService';
import { getUserById, subscribeToUser } from '../services/userService';
import { uploadPostMedia } from '../services/storageService';
import { formatDistanceToNowStrict } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNotifications } from '../contextApi/NotificationContext';

const { width, height } = Dimensions.get('window');

const TimeLine = () => {
  const navigation = useNavigation();
  const [userData, setUserData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPostText, setNewPostText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const videoRef = useRef(null);
  const soundRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const db = getFirestore();
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [fullscreenModalVisible, setFullscreenModalVisible] = useState(false);
  const fullscreenVideoRef = useRef(null);
  
  // Notifications
  const { 
    sendPostReactionNotification, 
    sendPostCommentNotification, 
    sendPostShareNotification,
    sendCommentReplyNotification,
    sendCommentLikeNotification,
    sendNewPostNotification 
  } = useNotifications();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPostId, setEditPostId] = useState(null);
  const [editPostText, setEditPostText] = useState('');
  const [showPostOptions, setShowPostOptions] = useState(null);
  const [editSelectedMedia, setEditSelectedMedia] = useState(null);
  const [editMediaType, setEditMediaType] = useState(null);
  const [editMediaChanged, setEditMediaChanged] = useState(false);
  
  // New states for improvements
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const likeAnimations = useRef({}).current; // Changed to object for multiple posts
  const [activeVideo, setActiveVideo] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = useRef(null);
  
  // Share states
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePostData, setSharePostData] = useState(null);
  const [shareText, setShareText] = useState('');
  
  // Advanced features states
  const [showReactions, setShowReactions] = useState(null);
  const [replyToComment, setReplyToComment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [viewMode, setViewMode] = useState('feed'); // 'feed' or 'stories'
  const [stories, setStories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Lấy thông tin người dùng từ AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          const parsedUserData = JSON.parse(userDataString);
          setUserData(parsedUserData);
          
          // Lắng nghe thay đổi real-time từ Firestore để cập nhật thông tin user
          if (parsedUserData.uid) {
            const unsubscribe = subscribeToUser(parsedUserData.uid, (updatedData) => {
              const merged = { ...parsedUserData, ...updatedData };
              setUserData(merged);
              AsyncStorage.setItem('userData', JSON.stringify(merged));
            });
            
            // Cleanup listener khi component unmount
            return () => unsubscribe();
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  useEffect(() => {
    if (!userData) return;

    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'), limit(POSTS_PER_PAGE));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const postsData = [];
      
      if (!querySnapshot.empty) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      for (const docSnap of querySnapshot.docs) {
        const postData = { id: docSnap.id, ...docSnap.data() };

        // Ưu tiên sử dụng userInfo đã lưu trong post (đã được đồng bộ khi user cập nhật profile)
        // Chỉ fetch từ users collection nếu chưa có userInfo
        if (!postData.userInfo && postData.userId) {
          try {
            const userInfo = await getUserById(postData.userId);
            if (userInfo) postData.userInfo = userInfo;
          } catch (error) {
            console.error('Error fetching user info:', error);
          }
        }

        postData.commentCount = 0;
        postsData.push(postData);
      }

      setPosts(postsData);
      setIsLoading(false);
      setRefreshing(false);

      postsData.forEach(post => {
        const commentsRef = collection(db, `posts/${post.id}/comments`);
        onSnapshot(commentsRef, (snapshot) => {
          setPosts(prevPosts =>
            prevPosts.map(p =>
              p.id === post.id
                ? { ...p, commentCount: snapshot.size }
                : p
            )
          );
        });
      });
    });

    return () => unsubscribe();
  }, [userData, refreshing]);

  // Sửa trong useEffect lấy comments
  useEffect(() => {
    if (currentPostId) {
      const unsubscribe = subscribeToComments(currentPostId, async (rawComments) => {
        // Enrich with user info if missing
        const enriched = await Promise.all(
          rawComments.map(async (comment) => {
            if (!comment.userInfo && comment.userId) {
              try {
                const userInfo = await getUserById(comment.userId);
                if (userInfo) return { ...comment, userInfo };
              } catch (error) {
                console.error('Error fetching commenter info:', error);
              }
            }
            return comment;
          })
        );
        setComments(enriched);
      });

      return () => unsubscribe();
    }
  }, [currentPostId]);


  // Chọn nhiều hình ảnh (Multiple images like Facebook)
  const pickMultipleImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets) {
      setSelectedImages(result.assets.map(asset => asset.uri));
      setMediaType('images');
      setSelectedMedia(null);
    }
  };

  // Chọn hình ảnh từ thư viện (single)
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedMedia(result.assets[0].uri);
      setMediaType('image');
      setSelectedImages([]);
    }
  };

  // Chọn video từ thư viện
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedMedia(result.assets[0].uri);
      setMediaType('video');
    }
  };

  // Chọn audio từ thư viện
  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled === false) {
        setSelectedMedia(result.assets[0].uri);
        setMediaType('audio');
      }
    } catch (error) {
      console.error('Error picking audio:', error);
    }
  };

  // Enhanced media upload with progress
  const uploadMedia = async (uri) => {
    try {
      // Simulate progress (uploadPostMedia doesn't provide progress)
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(Math.min(progress, 90));
        if (progress >= 90) clearInterval(interval);
      }, 200);

      const downloadURL = await uploadPostMedia(userData.uid, uri);
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 500);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading media:', error);
      setUploadProgress(0);
      return null;
    }
  };

  // Đăng bài viết mới với multiple images
  const handlePost = async () => {
    if ((!newPostText.trim() && !selectedMedia && selectedImages.length === 0) || !userData) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung hoặc chọn media để đăng bài');
      return;
    }

    setIsLoading(true);

    try {
      let mediaUrl = null;
      let mediaUrls = [];

      if (selectedMedia) {
        mediaUrl = await uploadMedia(selectedMedia);
      } else if (selectedImages.length > 0) {
        // Upload multiple images
        for (const imageUri of selectedImages) {
          const url = await uploadMedia(imageUri);
          if (url) mediaUrls.push(url);
        }
      }

      // Lấy thông tin user mới nhất
      const currentUserInfo = await getUserById(userData.uid) || {
        name: userData.displayName || userData.email,
        photoURL: userData.photoURL || null,
        email: userData.email
      };

      await createPost({
        userId: userData.uid,
        text: newPostText.trim(),
        mediaUrl,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
        mediaType: selectedImages.length > 0 ? 'images' : mediaType,
        userInfo: {
          name: currentUserInfo.name,
          displayName: currentUserInfo.name,
          photoURL: currentUserInfo.photoURL,
          email: currentUserInfo.email
        }
      });

      setNewPostText('');
      setSelectedMedia(null);
      setSelectedImages([]);
      setMediaType(null);
      setModalVisible(false);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Lỗi', 'Không thể đăng bài. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load more posts
  const loadMorePosts = async () => {
    if (!hasMore || loadingMore || !lastVisible) return;

    setLoadingMore(true);
    try {
      const { posts: newPosts, lastDoc: newLastDoc } = await getPosts(lastVisible, POSTS_PER_PAGE);
      
      if (newPosts.length === 0) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      setLastVisible(newLastDoc);
      
      // Enrich with user info if missing
      const enrichedPosts = await Promise.all(
        newPosts.map(async (postData) => {
          if (!postData.userInfo && postData.userId) {
            try {
              const userInfo = await getUserById(postData.userId);
              if (userInfo) postData.userInfo = userInfo;
            } catch (error) {
              console.error('Error fetching user info:', error);
            }
          }
          postData.commentCount = 0;
          return postData;
        })
      );

      setPosts(prevPosts => [...prevPosts, ...enrichedPosts]);
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Enhanced like with reactions (like Facebook)
  const REACTIONS = [
    { type: 'like', icon: '👍', color: '#2196F3', label: 'Thích' },
    { type: 'love', icon: '❤️', color: '#e74c3c', label: 'Yêu thích' },
    { type: 'haha', icon: '😆', color: '#f39c12', label: 'Haha' },
    { type: 'wow', icon: '😮', color: '#f39c12', label: 'Wow' },
    { type: 'sad', icon: '😢', color: '#f39c12', label: 'Buồn' },
    { type: 'angry', icon: '😠', color: '#e67e22', label: 'Phẫn nộ' },
  ];

  const handleReaction = async (postId, reactionType) => {
    if (!userData) return;

    setShowReactions(null);

    try {
      const result = await togglePostReaction(postId, userData.uid, reactionType);
      
      // Send notification to post owner (only for new reactions, not toggles)
      if (result.added) {
        const postData = await getPost(postId);
        if (postData) {
          const postOwnerId = postData.userId;
          if (postOwnerId && postOwnerId !== userData.uid) {
            sendPostReactionNotification(
              postId,
              postOwnerId,
              userData.uid,
              userData.name || userData.displayName,
              reactionType
            ).catch(err => console.error('Reaction notification error:', err));
          }
        }
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleLike = async (postId) => {
    if (!userData) return;

    // Create animation for this specific post if it doesn't exist
    if (!likeAnimations[postId]) {
      likeAnimations[postId] = new Animated.Value(1);
    }

    // Animate like button for this specific post
    Animated.sequence([
      Animated.timing(likeAnimations[postId], {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(likeAnimations[postId], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Quick like = thumb up
    handleReaction(postId, 'like');
  };

  // Long press for reaction menu
  const handleLongPress = (postId) => {
    setShowReactions(postId);
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

    const types = Object.keys(reactionCounts).sort((a, b) => reactionCounts[b] - reactionCounts[a]);
    const count = Object.keys(reactions).length;

    return { count, types, reactionCounts };
  };

  // Enhanced comment with replies
  const handleComment = async () => {
    if (!commentText.trim() || !userData || !currentPostId) {
      return;
    }

    try {
      // Lấy thông tin user mới nhất
      const currentUserInfo = await getUserById(userData.uid) || {
        name: userData.displayName || userData.email,
        photoURL: userData.photoURL || null,
        email: userData.email
      };

      await addComment(currentPostId, {
        userId: userData.uid,
        text: commentText.trim(),
        replyTo: replyToComment || null,
        userInfo: {
          name: currentUserInfo.name,
          displayName: currentUserInfo.name,
          photoURL: currentUserInfo.photoURL,
          email: currentUserInfo.email
        }
      });

      // Get post data to send notification to post owner
      const postData = await getPost(currentPostId);
      if (postData) {
        const postOwnerId = postData.userId;
        
        // Send notification based on whether it's a reply or a comment
        if (replyToComment && replyToComment.userId !== userData.uid) {
          sendCommentReplyNotification(
            currentPostId,
            replyToComment.userId,
            userData.uid,
            currentUserInfo.name,
            commentText.trim().substring(0, 100)
          ).catch(err => console.error('Comment reply notification error:', err));
        } else if (postOwnerId && postOwnerId !== userData.uid) {
          sendPostCommentNotification(
            currentPostId,
            postOwnerId,
            userData.uid,
            currentUserInfo.name,
            commentText.trim().substring(0, 100)
          ).catch(err => console.error('Comment notification error:', err));
        }
      }

      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === currentPostId
            ? { ...post, commentCount: (post.commentCount || 0) + 1 }
            : post
        )
      );

      setCommentText('');
      setReplyToComment(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Lỗi', 'Không thể đăng bình luận. Vui lòng thử lại sau.');
    }
  };

  // Like comment
  const handleLikeComment = async (commentId) => {
    if (!userData || !currentPostId) return;

    try {
      await toggleCommentLike(currentPostId, commentId, userData.uid);
      
      // Find comment to check if we need to send notification
      const comment = comments.find(c => c.id === commentId);
      if (comment) {
        const commentOwnerId = comment.userId;
        const isLiked = comment.likes?.includes(userData.uid);
        if (!isLiked && commentOwnerId && commentOwnerId !== userData.uid) {
          sendCommentLikeNotification(
            currentPostId,
            commentId,
            commentOwnerId,
            userData.uid,
            userData.displayName || userData.name || 'Người dùng'
          );
        }
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  // Reply to comment
  const handleReplyComment = (comment) => {
    setReplyToComment(comment);
    setCommentText(`@${comment.userInfo?.name || 'Người dùng'} `);
  };

  // Chia sẻ bài viết
  const handleShare = async (postId) => {
    try {
      const postData = await getPost(postId);

      if (postData) {
        // Enrich with user info if missing
        if (!postData.userInfo && postData.userId) {
          const userInfo = await getUserById(postData.userId);
          if (userInfo) postData.userInfo = userInfo;
        }
        
        setSharePostData(postData);
        setShareModalVisible(true);
      }
    } catch (error) {
      console.error('Error loading post for sharing:', error);
      Alert.alert('Lỗi', 'Không thể tải bài viết. Vui lòng thử lại sau.');
    }
  };

  const confirmShare = async () => {
    if (!sharePostData || !userData) return;
    
    setIsLoading(true);
    try {
      // Lấy thông tin user mới nhất
      const currentUserInfo = await getUserById(userData.uid) || {
        name: userData.displayName || userData.email,
        photoURL: userData.photoURL || null,
        email: userData.email
      };

      // Nếu đang share một bài đã được share, lấy originalPost từ bài đó
      const originalPostData = sharePostData.isSharedPost && sharePostData.originalPost 
        ? sharePostData.originalPost 
        : {
            id: sharePostData.id,
            userId: sharePostData.userId,
            userName: sharePostData.userInfo?.name || 'Người dùng',
            userPhoto: sharePostData.userInfo?.photoURL || '',
            text: sharePostData.text || '',
            mediaUrl: sharePostData.mediaUrl || null,
            mediaUrls: sharePostData.mediaUrls || null,
            mediaType: sharePostData.mediaType || null,
            createdAt: sharePostData.createdAt
          };

      await sharePost({
        userId: userData.uid,
        sourcePostId: sharePostData.id,
        text: shareText.trim(),
        originalPost: originalPostData,
        userInfo: {
          name: currentUserInfo.name,
          displayName: currentUserInfo.name,
          photoURL: currentUserInfo.photoURL,
          email: currentUserInfo.email
        }
      });

      // Send notification to original post owner
      const originalPostOwnerId = originalPostData.userId;
      if (originalPostOwnerId && originalPostOwnerId !== userData.uid) {
        sendPostShareNotification(
          originalPostData.id,
          originalPostOwnerId,
          userData.uid,
          currentUserInfo.name
        );
      }

      setShareModalVisible(false);
      setSharePostData(null);
      setShareText('');
      Alert.alert('Thành công', 'Bài viết đã được chia sẻ');
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ bài viết. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý khi nhấn nút play/pause cho audio
  const handlePlayPause = async (audioUrl) => {
    try {
      if (soundRef.current === null) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        setIsPlaying(true);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            soundRef.current = null;
          }
        });
      } else {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          await soundRef.current.playAsync();
        }
        setIsPlaying(!isPlaying);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  // Scroll to top
  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Handle scroll
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 500);
  };

  // Enhanced refresh
  const onRefresh = () => {
    setRefreshing(true);
    setLastVisible(null);
    setHasMore(true);
  };

  const handleOpenFullscreen = (mediaUrl, mediaType) => {
    setFullscreenMedia({ url: mediaUrl, type: mediaType });
    setFullscreenModalVisible(true);
  };

  // Thêm các hàm này vào component
  const handleDeletePost = async (postId) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa bài viết này?",
      [
        {
          text: "Hủy",
          style: "cancel"
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await deletePost(postId);
              setShowPostOptions(null);
              Alert.alert("Thành công", "Đã xóa bài viết");
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Lỗi", "Không thể xóa bài viết. Vui lòng thử lại sau.");
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEditPost = (post) => {
    setEditPostId(post.id);
    setEditPostText(post.text);
    setEditSelectedMedia(post.mediaUrl);
    setEditMediaType(post.mediaType);
    setEditMediaChanged(false);
    setEditModalVisible(true);
    setShowPostOptions(null);
  };

  const saveEditedPost = async () => {
    if (!editPostText.trim() && !editSelectedMedia) {
      Alert.alert("Lỗi", "Vui lòng nhập nội dung hoặc chọn media");
      return;
    }

    try {
      setIsLoading(true);

      let updatedData = {
        text: editPostText.trim(),
        lastEdited: serverTimestamp()
      };

      // Nếu media đã thay đổi
      if (editMediaChanged) {
        // Nếu có media mới
        if (editSelectedMedia) {
          const mediaUrl = await uploadMedia(editSelectedMedia);
          updatedData.mediaUrl = mediaUrl;
          updatedData.mediaType = editMediaType;
        } else {
          // Nếu xóa media
          updatedData.mediaUrl = null;
          updatedData.mediaType = null;
        }
      }

      await updatePost(editPostId, updatedData);

      setEditModalVisible(false);
      setEditPostId(null);
      setEditPostText('');
      setEditSelectedMedia(null);
      setEditMediaType(null);
      setEditMediaChanged(false);

      Alert.alert("Thành công", "Đã cập nhật bài viết");
    } catch (error) {
      console.error("Error updating post:", error);
      Alert.alert("Lỗi", "Không thể cập nhật bài viết. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  // Chọn hình ảnh khi chỉnh sửa
  const pickEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setEditSelectedMedia(result.assets[0].uri);
      setEditMediaType('image');
      setEditMediaChanged(true);
    }
  };

  // Chọn video khi chỉnh sửa
  const pickEditVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setEditSelectedMedia(result.assets[0].uri);
      setEditMediaType('video');
      setEditMediaChanged(true);
    }
  };

  // Chọn audio khi chỉnh sửa
  const pickEditAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled === false) {
        setEditSelectedMedia(result.assets[0].uri);
        setEditMediaType('audio');
        setEditMediaChanged(true);
      }
    } catch (error) {
      console.error('Error picking audio:', error);
    }
  };


  // Hiển thị thời gian đăng bài
  const formatPostTime = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate();
    return formatDistanceToNowStrict(date, { addSuffix: true, locale: vi });
  };

  // Enhanced media rendering with multiple images support
  const renderMedia = (item, isEditing = false, index = 0) => {
    const mediaUrl = item.mediaUrl;
    const mediaUrls = item.mediaUrls;

    // Multiple images layout
    if (mediaUrls && mediaUrls.length > 0) {
      const imageCount = mediaUrls.length;
      
      return (
        <View style={styles.multipleImagesContainer}>
          {imageCount === 1 && (
            <TouchableOpacity
              onPress={() => !isEditing && handleOpenFullscreen(mediaUrls[0], 'image')}
              activeOpacity={0.95}
            >
              <Image source={{ uri: mediaUrls[0] }} style={styles.postImage} resizeMode="cover" />
            </TouchableOpacity>
          )}
          
          {imageCount === 2 && (
            <View style={styles.twoImagesLayout}>
              {mediaUrls.slice(0, 2).map((url, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => !isEditing && handleOpenFullscreen(url, 'image')}
                  activeOpacity={0.95}
                  style={styles.halfImage}
                >
                  <Image source={{ uri: url }} style={styles.gridImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {imageCount === 3 && (
            <View style={styles.threeImagesLayout}>
              <TouchableOpacity
                onPress={() => !isEditing && handleOpenFullscreen(mediaUrls[0], 'image')}
                activeOpacity={0.95}
                style={styles.mainImage}
              >
                <Image source={{ uri: mediaUrls[0] }} style={styles.gridImage} resizeMode="cover" />
              </TouchableOpacity>
              <View style={styles.sideImages}>
                {mediaUrls.slice(1, 3).map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => !isEditing && handleOpenFullscreen(url, 'image')}
                    activeOpacity={0.95}
                    style={styles.sideImage}
                  >
                    <Image source={{ uri: url }} style={styles.gridImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          {imageCount >= 4 && (
            <View style={styles.fourImagesLayout}>
              {mediaUrls.slice(0, 4).map((url, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => !isEditing && handleOpenFullscreen(url, 'image')}
                  activeOpacity={0.95}
                  style={styles.quarterImage}
                >
                  <Image source={{ uri: url }} style={styles.gridImage} resizeMode="cover" />
                  {idx === 3 && imageCount > 4 && (
                    <View style={styles.moreImagesOverlay}>
                      <Text style={styles.moreImagesText}>+{imageCount - 4}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      );
    }

    if (!mediaUrl) return null;

    switch (item.mediaType) {
      case 'image':
        return (
          <TouchableOpacity
            onPress={() => !isEditing && handleOpenFullscreen(mediaUrl, 'image')}
            activeOpacity={0.95}
            style={styles.mediaContainer}
          >
            <Image
              source={{ uri: mediaUrl }}
              style={styles.postImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      case 'video':
        return (
          <TouchableOpacity
            onPress={() => !isEditing && handleOpenFullscreen(mediaUrl, 'video')}
            activeOpacity={0.95}
            style={styles.mediaContainer}
          >
            <Video
              source={{ uri: mediaUrl }}
              style={styles.postVideo}
              useNativeControls
              resizeMode="contain"
              shouldPlay={activeVideo === index}
              onPlaybackStatusUpdate={(status) => {
                if (status.isPlaying) {
                  setActiveVideo(index);
                }
              }}
            />
            <View style={styles.videoOverlay}>
              <MaterialIcons name="play-circle-outline" size={60} color="rgba(255,255,255,0.8)" />
            </View>
          </TouchableOpacity>
        );
      case 'audio':
        return (
          <View style={styles.audioContainer}>
            <TouchableOpacity
              style={styles.audioButton}
              onPress={() => !isEditing && handlePlayPause(mediaUrl)}
            >
              <FontAwesome5
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            <View style={styles.audioInfo}>
              <Text style={styles.audioText}>Tệp âm thanh</Text>
              <Text style={styles.audioSubtext}>Nhấn để phát</Text>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  // Hiển thị bài đăng gốc trong bài chia sẻ
  const renderSharedPost = (originalPost) => {
    if (!originalPost) return null;

    return (
      <View style={styles.sharedPostContainer}>
        <TouchableOpacity 
          onPress={() => {
            // Nếu có originalPost.id, navigate đến bài gốc
            if (originalPost.id) {
              navigation.navigate('PostDetail', { postId: originalPost.id });
            }
          }}
          activeOpacity={0.9}
        >
          <View style={styles.sharedPostHeader}>
            <Image
              source={{ uri: originalPost.userPhoto || 'https://via.placeholder.com/150' }}
              style={styles.sharedPostAvatar}
            />
            <View style={styles.sharedPostHeaderInfo}>
              <Text style={styles.sharedPostUserName}>{originalPost.userName || 'Người dùng'}</Text>
              <Text style={styles.sharedPostTime}>
                {originalPost.createdAt ? formatPostTime(originalPost.createdAt) : ''}
              </Text>
            </View>
          </View>
          
          {originalPost.text && (
            <Text style={styles.sharedPostText} numberOfLines={3}>
              {originalPost.text}
            </Text>
          )}
          
          {originalPost.mediaUrl && (
            <View style={styles.sharedMediaContainer}>
              {originalPost.mediaType === 'image' && (
                <Image
                  source={{ uri: originalPost.mediaUrl }}
                  style={styles.sharedPostImage}
                  resizeMode="cover"
                />
              )}
              {originalPost.mediaType === 'video' && (
                <View style={styles.sharedVideoPreview}>
                  <Image
                    source={{ uri: originalPost.mediaUrl }}
                    style={styles.sharedPostImage}
                    resizeMode="cover"
                  />
                  <View style={styles.sharedVideoOverlay}>
                    <MaterialIcons name="play-circle-outline" size={50} color="rgba(255,255,255,0.9)" />
                  </View>
                </View>
              )}
              {originalPost.mediaType === 'audio' && (
                <View style={styles.sharedAudioContainer}>
                  <FontAwesome5 name="music" size={20} color="#1877f2" />
                  <Text style={styles.sharedMediaText}>Tệp âm thanh</Text>
                </View>
              )}
            </View>
          )}
          
          {originalPost.mediaUrls && originalPost.mediaUrls.length > 0 && (
            <View style={styles.sharedMediaContainer}>
              <Image
                source={{ uri: originalPost.mediaUrls[0] }}
                style={styles.sharedPostImage}
                resizeMode="cover"
              />
              {originalPost.mediaUrls.length > 1 && (
                <View style={styles.sharedMultipleImagesBadge}>
                  <Ionicons name="images" size={16} color="#fff" />
                  <Text style={styles.sharedMultipleImagesText}>{originalPost.mediaUrls.length}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Enhanced post rendering with reactions
  const renderPost = ({ item, index }) => {
    const reactions = item.reactions || {};
    const userReaction = reactions[userData?.uid];
    const reactionSummary = getReactionSummary(reactions);
    const isOwnPost = userData?.uid === item.userId;

    return (
      <Animated.View style={[styles.postContainer, { opacity: 1 }]}>
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.postHeaderLeft}
            onPress={() => {
              if (isOwnPost) {
                navigation.navigate('Cá nhân');
              } else {
                navigation.navigate('Personal_page', { userId: item.userId });
              }
            }}
          >
            <Image
              source={{ uri: item.userInfo?.photoURL || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
            />
            <View style={styles.postHeaderInfo}>
              <Text style={styles.userName}>{item.userInfo?.name || 'Người dùng'}</Text>
              <View style={styles.postMetaContainer}>
                <Text style={styles.postTime}>{formatPostTime(item.createdAt)}</Text>
                {item.lastEdited && (
                  <>
                    <Text style={styles.dotSeparator}> • </Text>
                    <Text style={styles.editedText}>Đã chỉnh sửa</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {isOwnPost && (
            <TouchableOpacity
              style={styles.postOptionsButton}
              onPress={() => setShowPostOptions(showPostOptions === item.id ? null : item.id)}
            >
              <MaterialCommunityIcons name="dots-vertical" size={24} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {showPostOptions === item.id && (
          <View style={styles.postOptionsMenu}>
            <TouchableOpacity
              style={styles.postOptionItem}
              onPress={() => handleEditPost(item)}
            >
              <Feather name="edit" size={18} color="#333" />
              <Text style={styles.postOptionText}>Chỉnh sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.postOptionItem, styles.postOptionItemDelete]}
              onPress={() => handleDeletePost(item.id)}
            >
              <Feather name="trash-2" size={18} color="#e74c3c" />
              <Text style={styles.postOptionTextDelete}>Xóa</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          activeOpacity={0.95}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        >
          {item.text && <Text style={styles.postText}>{item.text}</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          activeOpacity={0.95}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        >
          {renderMedia(item, false, index)}
        </TouchableOpacity>

        {item.originalPost && renderSharedPost(item.originalPost)}

        {/* Enhanced Stats with Reactions */}
        <View style={styles.postStats}>
          <View style={styles.statsLeft}>
            {reactionSummary.count > 0 && (
              <TouchableOpacity style={styles.reactionSummary}>
                <View style={styles.reactionIcons}>
                  {reactionSummary.types.slice(0, 3).map((type, idx) => {
                    const reaction = REACTIONS.find(r => r.type === type);
                    return (
                      <Text key={type} style={[styles.reactionIcon, { marginLeft: idx > 0 ? -4 : 0 }]}>
                        {reaction?.icon}
                      </Text>
                    );
                  })}
                </View>
                <Text style={styles.statsText}>{reactionSummary.count}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.statsRight}>
            {item.commentCount > 0 && (
              <Text style={styles.statsText}>{item.commentCount} bình luận</Text>
            )}
            {item.shares > 0 && (
              <>
                <Text style={styles.dotSeparator}> • </Text>
                <Text style={styles.statsText}>{item.shares} chia sẻ</Text>
              </>
            )}
          </View>
        </View>

        {/* Reactions Popup */}
        {showReactions === item.id && (
          <View style={styles.reactionsContainer}>
            {REACTIONS.map((reaction) => (
              <TouchableOpacity
                key={reaction.type}
                style={styles.reactionButton}
                onPress={() => handleReaction(item.id, reaction.type)}
              >
                <Animated.Text style={styles.reactionEmoji}>
                  {reaction.icon}
                </Animated.Text>
                <Text style={styles.reactionLabel}>{reaction.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Enhanced Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
            onLongPress={() => handleLongPress(item.id)}
            delayLongPress={500}
          >
            <Animated.View style={{ transform: [{ scale: likeAnimations[item.id] || 1 }] }}>
              {userReaction ? (
                <Text style={styles.reactionEmojiSmall}>
                  {REACTIONS.find(r => r.type === userReaction.type)?.icon}
                </Text>
              ) : (
                <AntDesign name="hearto" size={22} color="#65676b" />
              )}
            </Animated.View>
            <Text style={[
              styles.actionText,
              userReaction && { color: REACTIONS.find(r => r.type === userReaction.type)?.color }
            ]}>
              {userReaction ? REACTIONS.find(r => r.type === userReaction.type)?.label : 'Thích'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setCurrentPostId(item.id);
              setCommentModalVisible(true);
            }}
          >
            <Ionicons name="chatbubble-outline" size={22} color="#65676b" />
            <Text style={styles.actionText}>Bình luận</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShare(item.id)}
          >
            <Feather name="share" size={22} color="#65676b" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // Render màn hình chính
  return (
    <SafeAreaView style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="newspaper-variant" size={28} color="#1877f2" />
          <Text style={styles.headerTitle}>Nhật ký</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('MyPosts')}
          >
            <Ionicons name="list" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createPostButton}
            onPress={() => setModalVisible(true)}
          >
            <AntDesign name="plus" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Post */}
      <TouchableOpacity 
        style={styles.quickPostContainer}
        onPress={() => setModalVisible(true)}
      >
        <Image
          source={{ uri: userData?.photoURL || 'https://via.placeholder.com/150' }}
          style={styles.quickPostAvatar}
        />
        <View style={styles.quickPostInput}>
          <Text style={styles.quickPostPlaceholder}>Bạn đang nghĩ gì?</Text>
        </View>
        <TouchableOpacity style={styles.quickPostImageButton}>
          <MaterialIcons name="photo-library" size={24} color="#45bd62" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Posts List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1877f2" />
          <Text style={styles.loadingText}>Đang tải bài viết...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.postsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="post-outline" size={80} color="#ccc" />
              <Text style={styles.emptyText}>Chưa có bài đăng nào</Text>
              <Text style={styles.emptySubtext}>Hãy là người đầu tiên chia sẻ!</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1877f2']}
              tintColor="#1877f2"
            />
          }
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.5}
          onScroll={handleScroll}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#1877f2" />
              </View>
            ) : null
          }
        />
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopButton}
          onPress={scrollToTop}
        >
          <Ionicons name="arrow-up" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Enhanced Create Post Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedMedia(null);
          setMediaType(null);
          setUploadProgress(0);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCenter}>
              <Text style={styles.modalTitle}>Tạo bài viết</Text>
            </View>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setModalVisible(false);
                setSelectedMedia(null);
                setMediaType(null);
                setUploadProgress(0);
              }}
            >
              <AntDesign name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.userInfo}>
                <Image
                  source={{ uri: userData?.photoURL || 'https://via.placeholder.com/150' }}
                  style={styles.modalAvatar}
                />
                <Text style={styles.modalUserName}>{userData?.name || 'Người dùng'}</Text>
              </View>

              <TextInput
                style={styles.postInput}
                multiline
                placeholder="Bạn đang nghĩ gì?"
                placeholderTextColor="#999"
                value={newPostText}
                onChangeText={setNewPostText}
                autoFocus
              />

              {/* Multiple Images Preview */}
              {selectedImages.length > 0 && (
                <View style={styles.selectedMediaContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.multipleImagesPreview}
                  >
                    {selectedImages.map((uri, index) => (
                      <View key={index} style={styles.selectedImageItem}>
                        <Image
                          source={{ uri }}
                          style={styles.selectedImageThumb}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => {
                            setSelectedImages(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <AntDesign name="closecircle" size={24} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.clearAllButton}
                    onPress={() => setSelectedImages([])}
                  >
                    <Text style={styles.clearAllText}>Xóa tất cả</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedMedia && (
                <View style={styles.selectedMediaContainer}>
                  {mediaType === 'image' && (
                    <Image
                      source={{ uri: selectedMedia }}
                      style={styles.selectedImage}
                      resizeMode="cover"
                    />
                  )}

                  {mediaType === 'video' && (
                    <Video
                      source={{ uri: selectedMedia }}
                      style={styles.selectedVideo}
                      useNativeControls
                      resizeMode="contain"
                    />
                  )}

                  {mediaType === 'audio' && (
                    <View style={styles.selectedAudio}>
                      <FontAwesome5 name="file-audio" size={40} color="#1877f2" />
                      <Text style={styles.audioFileName}>Tệp âm thanh</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.removeMediaButton}
                    onPress={() => {
                      setSelectedMedia(null);
                      setMediaType(null);
                    }}
                  >
                    <AntDesign name="closecircle" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {uploadProgress > 0 && uploadProgress < 100 && (
                <View style={styles.uploadProgressContainer}>
                  <View style={styles.uploadProgressBar}>
                    <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.uploadProgressText}>{uploadProgress}%</Text>
                </View>
              )}

              <View style={styles.addToPostContainer}>
                <Text style={styles.addToPostTitle}>Thêm vào bài viết</Text>
                <View style={styles.mediaButtons}>
                  <TouchableOpacity style={styles.mediaButton} onPress={pickMultipleImages}>
                    <MaterialIcons name="collections" size={26} color="#45bd62" />
                    <Text style={styles.mediaButtonLabel}>Nhiều ảnh</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                    <MaterialIcons name="photo-library" size={26} color="#45bd62" />
                    <Text style={styles.mediaButtonLabel}>Ảnh</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaButton} onPress={pickVideo}>
                    <MaterialIcons name="videocam" size={26} color="#f3425f" />
                    <Text style={styles.mediaButtonLabel}>Video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaButton} onPress={pickAudio}>
                    <FontAwesome5 name="music" size={24} color="#f7b928" />
                    <Text style={styles.mediaButtonLabel}>Âm thanh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.postButton,
                (!newPostText.trim() && !selectedMedia && selectedImages.length === 0) && styles.disabledButton
              ]}
              onPress={handlePost}
              disabled={(!newPostText.trim() && !selectedMedia && selectedImages.length === 0) || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.postButtonText}>Đăng</Text>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Enhanced Comment Modal with Reply & Like */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={commentModalVisible}
        onRequestClose={() => {
          setCommentModalVisible(false);
          setCurrentPostId(null);
          setComments([]);
          setReplyToComment(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalBackButton}
              onPress={() => {
                setCommentModalVisible(false);
                setCurrentPostId(null);
                setComments([]);
                setReplyToComment(null);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.modalHeaderCenter}>
              <Text style={styles.modalTitle}>Bình luận</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            data={comments}
            renderItem={({ item }) => (
              <View style={styles.commentItemContainer}>
                <View style={styles.commentItem}>
                  <Image
                    source={{ uri: item.userInfo?.photoURL || 'https://via.placeholder.com/150' }}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentContent}>
                    <View style={styles.commentBubble}>
                      <Text style={styles.commentUserName}>{item.userInfo?.name || 'Người dùng'}</Text>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                    <View style={styles.commentActions}>
                      <TouchableOpacity 
                        style={styles.commentActionButton}
                        onPress={() => handleLikeComment(item.id)}
                      >
                        <Text style={[
                          styles.commentActionText,
                          item.likes?.includes(userData?.uid) && styles.commentActionActive
                        ]}>
                          {item.likes?.includes(userData?.uid) ? 'Đã thích' : 'Thích'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.commentActionDot}>•</Text>
                      <TouchableOpacity 
                        style={styles.commentActionButton}
                        onPress={() => handleReplyComment(item)}
                      >
                        <Text style={styles.commentActionText}>Trả lời</Text>
                      </TouchableOpacity>
                      <Text style={styles.commentActionDot}>•</Text>
                      <Text style={styles.commentTime}>
                        {item.createdAt ? formatPostTime(item.createdAt) : ''}
                      </Text>
                      {item.likes?.length > 0 && (
                        <>
                          <Text style={styles.commentActionDot}>•</Text>
                          <View style={styles.commentLikeCount}>
                            <AntDesign name="heart" size={10} color="#e74c3c" />
                            <Text style={styles.commentLikeText}>{item.likes.length}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
                <Text style={styles.emptyText}>Chưa có bình luận</Text>
                <Text style={styles.emptySubtext}>Hãy là người đầu tiên bình luận</Text>
              </View>
            }
            contentContainerStyle={styles.commentsList}
          />

          {replyToComment && (
            <View style={styles.replyingToContainer}>
              <Text style={styles.replyingToText}>
                Đang trả lời {replyToComment.userInfo?.name}
              </Text>
              <TouchableOpacity onPress={() => {
                setReplyToComment(null);
                setCommentText('');
              }}>
                <AntDesign name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.commentInputContainer}>
            <Image
              source={{ uri: userData?.photoURL || 'https://via.placeholder.com/150' }}
              style={styles.commentInputAvatar}
            />
            <TextInput
              style={styles.commentInput}
              placeholder="Viết bình luận..."
              placeholderTextColor="#999"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !commentText.trim() && styles.disabledSendButton
              ]}
              onPress={handleComment}
              disabled={!commentText.trim()}
            >
              <Ionicons
                name="send"
                size={24}
                color={commentText.trim() ? "#1877f2" : "#ccc"}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      {/* Modal xem media toàn màn hình */}
      {/* Modal xem media toàn màn hình */}
      <Modal
        visible={fullscreenModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setFullscreenModalVisible(false);
          setFullscreenMedia(null);
        }}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.fullscreenCloseButton}
            onPress={() => {
              setFullscreenModalVisible(false);
              setFullscreenMedia(null);
            }}
          >
            <AntDesign name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {fullscreenMedia?.type === 'image' && (
            <ImageViewer
              imageUrls={[{ url: fullscreenMedia.url }]}
              enableSwipeDown={true}
              onSwipeDown={() => {
                setFullscreenModalVisible(false);
                setFullscreenMedia(null);
              }}
              backgroundColor="rgba(0,0,0,0.9)"
              renderIndicator={() => null}
            />
          )}

          {fullscreenMedia?.type === 'video' && (
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: fullscreenMedia.url }}
              style={styles.fullscreenVideo}
              useNativeControls
              resizeMode="contain"
              shouldPlay
            />
          )}
        </View>
      </Modal>

      {/* Share Post Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={shareModalVisible}
        onRequestClose={() => {
          setShareModalVisible(false);
          setSharePostData(null);
          setShareText('');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalBackButton}
              onPress={() => {
                setShareModalVisible(false);
                setSharePostData(null);
                setShareText('');
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.modalHeaderCenter}>
              <Text style={styles.modalTitle}>Chia sẻ bài viết</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.userInfo}>
                <Image
                  source={{ uri: userData?.photoURL || 'https://via.placeholder.com/150' }}
                  style={styles.modalAvatar}
                />
                <Text style={styles.modalUserName}>{userData?.name || 'Người dùng'}</Text>
              </View>

              <TextInput
                style={styles.shareInput}
                multiline
                placeholder="Nói gì đó về bài viết này..."
                placeholderTextColor="#999"
                value={shareText}
                onChangeText={setShareText}
                maxLength={500}
              />

              {sharePostData && renderSharedPost(sharePostData.originalPost || {
                id: sharePostData.id,
                userId: sharePostData.userId,
                userName: sharePostData.userInfo?.name,
                userPhoto: sharePostData.userInfo?.photoURL,
                text: sharePostData.text,
                mediaUrl: sharePostData.mediaUrl,
                mediaType: sharePostData.mediaType,
                createdAt: sharePostData.createdAt
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.shareButton, isLoading && styles.disabledButton]}
              onPress={confirmShare}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.shareButtonText}>Chia sẻ ngay</Text>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal chỉnh sửa bài viết */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={editModalVisible}
        onRequestClose={() => {
          setEditModalVisible(false);
          setEditPostId(null);
          setEditPostText('');
          setEditSelectedMedia(null);
          setEditMediaType(null);
          setEditMediaChanged(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chỉnh sửa bài viết</Text>
            <TouchableOpacity onPress={() => {
              setEditModalVisible(false);
              setEditPostId(null);
              setEditPostText('');
              setEditSelectedMedia(null);
              setEditMediaType(null);
              setEditMediaChanged(false);
            }}>
              <AntDesign name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <ScrollView>
              <TextInput
                style={styles.postInput}
                multiline
                placeholder="Nội dung bài viết"
                value={editPostText}
                onChangeText={setEditPostText}
              />

              {editSelectedMedia && (
                <View style={styles.selectedMediaContainer}>
                  {editMediaType === 'image' && (
                    <Image
                      source={{ uri: editSelectedMedia }}
                      style={styles.selectedImage}
                      resizeMode="cover"
                    />
                  )}

                  {editMediaType === 'video' && (
                    <Video
                      source={{ uri: editSelectedMedia }}
                      style={styles.selectedVideo}
                      useNativeControls
                      resizeMode="contain"
                    />
                  )}

                  {editMediaType === 'audio' && (
                    <View style={styles.selectedAudio}>
                      <FontAwesome5 name="file-audio" size={40} color="#4CAF50" />
                      <Text style={styles.audioFileName}>Audio File</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.removeMediaButton}
                    onPress={() => {
                      setEditSelectedMedia(null);
                      setEditMediaType(null);
                      setEditMediaChanged(true);
                    }}
                  >
                    <AntDesign name="closecircle" size={24} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              )}

              {!editSelectedMedia && (
                <View style={styles.mediaButtons}>
                  <TouchableOpacity style={styles.mediaButton} onPress={pickEditImage}>
                    <MaterialIcons name="photo" size={24} color="#4CAF50" />
                    <Text style={styles.mediaButtonText}>Ảnh</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaButton} onPress={pickEditVideo}>
                    <MaterialIcons name="videocam" size={24} color="#2196F3" />
                    <Text style={styles.mediaButtonText}>Video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mediaButton} onPress={pickEditAudio}>
                    <FontAwesome5 name="headphones" size={24} color="#9C27B0" />
                    <Text style={styles.mediaButtonText}>Âm thanh</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.editButtonsContainer}>
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditPostId(null);
                  setEditPostText('');
                  setEditSelectedMedia(null);
                  setEditMediaType(null);
                  setEditMediaChanged(false);
                }}
              >
                <Text style={styles.cancelEditButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveEditButton,
                  (!editPostText.trim() && !editSelectedMedia) && styles.disabledButton
                ]}
                onPress={saveEditedPost}
                disabled={(!editPostText.trim() && !editSelectedMedia) || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveEditButtonText}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e6eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#050505',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostButton: {
    backgroundColor: '#1877f2',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickPostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderBottomWidth: 6,
    borderBottomColor: '#f0f2f5',
  },
  quickPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  quickPostInput: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
  },
  quickPostPlaceholder: {
    color: '#65676b',
    fontSize: 16,
  },
  quickPostImageButton: {
    marginLeft: 8,
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  postsList: {
    paddingBottom: 100,
  },
  postContainer: {
    backgroundColor: '#fff',
    marginBottom: 8,
    paddingVertical: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postHeaderInfo: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
  },
  postMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  postTime: {
    fontSize: 13,
    color: '#65676b',
  },
  dotSeparator: {
    fontSize: 13,
    color: '#65676b',
  },
  editedText: {
    fontSize: 13,
    color: '#65676b',
    fontStyle: 'italic',
  },
  postText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#050505',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  mediaContainer: {
    marginBottom: 8,
  },
  postImage: {
    width: width,
    height: width * 0.75,
    backgroundColor: '#f0f2f5',
  },
  multipleImagesContainer: {
    marginBottom: 8,
  },
  twoImagesLayout: {
    flexDirection: 'row',
    gap: 2,
  },
  halfImage: {
    flex: 1,
    height: width * 0.5,
  },
  threeImagesLayout: {
    flexDirection: 'row',
    gap: 2,
    height: width * 0.66,
  },
  mainImage: {
    flex: 1,
  },
  sideImages: {
    flex: 1,
    gap: 2,
  },
  sideImage: {
    flex: 1,
  },
  fourImagesLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  quarterImage: {
    width: (width - 2) / 2,
    height: width * 0.33,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  postVideo: {
    width: width,
    height: width * 0.75,
    backgroundColor: '#000',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  audioButton: {
    backgroundColor: '#1877f2',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioInfo: {
    marginLeft: 16,
    flex: 1,
  },
  audioText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
  },
  audioSubtext: {
    fontSize: 13,
    color: '#65676b',
    marginTop: 2,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionIcons: {
    flexDirection: 'row',
    marginRight: 6,
  },
  reactionIcon: {
    fontSize: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  likeCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: '#65676b',
  },
  reactionsContainer: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  reactionButton: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 28,
    marginBottom: 2,
  },
  reactionEmojiSmall: {
    fontSize: 20,
  },
  reactionLabel: {
    fontSize: 10,
    color: '#65676b',
    fontWeight: '500',
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e4e6eb',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 4,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#65676b',
  },
  likedText: {
    color: '#e74c3c',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#65676b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8a8d91',
    marginTop: 4,
  },
  scrollTopButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#1877f2',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e6eb',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#050505',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBackButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  modalUserName: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
  },
  postInput: {
    fontSize: 16,
    minHeight: 100,
    paddingHorizontal: 16,
    textAlignVertical: 'top',
    color: '#050505',
  },
  selectedMediaContainer: {
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  multipleImagesPreview: {
    marginBottom: 8,
  },
  selectedImageItem: {
    position: 'relative',
    marginRight: 8,
  },
  selectedImageThumb: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 2,
  },
  clearAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e4e6eb',
    borderRadius: 6,
  },
  clearAllText: {
    fontSize: 13,
    color: '#050505',
    fontWeight: '600',
  },
  selectedImage: {
    width: '100%',
    height: 300,
  },
  selectedVideo: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  selectedAudio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 12,
    padding: 24,
    justifyContent: 'center',
  },
  audioFileName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#050505',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 6,
  },
  uploadProgressContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  uploadProgressBar: {
    height: 4,
    backgroundColor: '#e4e6eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: '#1877f2',
  },
  uploadProgressText: {
    fontSize: 12,
    color: '#65676b',
    marginTop: 4,
    textAlign: 'center',
  },
  addToPostContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e4e6eb',
    borderRadius: 8,
  },
  addToPostTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
    marginBottom: 12,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  mediaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f2f5',
    marginBottom: 8,
  },
  mediaButtonLabel: {
    fontSize: 11,
    color: '#050505',
    marginTop: 4,
    fontWeight: '500',
  },
  postButton: {
    backgroundColor: '#1877f2',
    margin: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#e4e6eb',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentsList: {
    padding: 16,
  },
  commentItemContainer: {
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: 'row',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentContent: {
    marginLeft: 10,
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#f0f2f5',
    padding: 12,
    borderRadius: 18,
    maxWidth: '90%',
  },
  commentUserName: {
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 14,
    color: '#050505',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#050505',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 12,
  },
  commentActionButton: {
    marginRight: 8,
  },
  commentActionText: {
    fontSize: 12,
    color: '#65676b',
    fontWeight: '600',
  },
  commentActionActive: {
    color: '#1877f2',
  },
  commentActionDot: {
    fontSize: 12,
    color: '#65676b',
    marginHorizontal: 4,
  },
  commentLikeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  commentLikeText: {
    fontSize: 11,
    color: '#e74c3c',
    marginLeft: 3,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
    color: '#65676b',
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f2f5',
    borderTopWidth: 1,
    borderTopColor: '#e4e6eb',
  },
  replyingToText: {
    fontSize: 13,
    color: '#1877f2',
    fontWeight: '600',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e4e6eb',
    backgroundColor: '#fff',
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 15,
    color: '#050505',
  },
  sendButton: {
    padding: 8,
    marginBottom: 8,
  },
  disabledSendButton: {
    opacity: 0.5,
  },
  sharedPostContainer: {
    backgroundColor: '#f0f2f5',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e4e6eb',
  },
  sharedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sharedPostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sharedPostHeaderInfo: {
    marginLeft: 8,
    flex: 1,
  },
  sharedPostUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
  },
  sharedPostTime: {
    fontSize: 12,
    color: '#65676b',
    marginTop: 2,
  },
  sharedPostText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#050505',
    marginBottom: 8,
  },
  sharedPostTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#65676b',
  },
  sharedMediaContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sharedPostImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f2f5',
  },
  sharedVideoPreview: {
    position: 'relative',
  },
  sharedVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sharedVideoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e4e6eb',
    borderRadius: 8,
  },
  sharedAudioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#e4e6eb',
    borderRadius: 8,
  },
  sharedMediaText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#65676b',
    fontWeight: '500',
  },
  sharedMultipleImagesBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sharedMultipleImagesText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  shareInput: {
    fontSize: 16,
    minHeight: 80,
    paddingHorizontal: 16,
    paddingTop: 12,
    textAlignVertical: 'top',
    color: '#050505',
    marginBottom: 16,
  },
  shareButton: {
    backgroundColor: '#1877f2',
    margin: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullscreenImage: {
    width: width,
    height: height,
  },
  fullscreenVideo: {
    width: width,
    height: height * 0.7,
  },
  postOptionsButton: {
    padding: 8,
  },
  postOptionsMenu: {
    position: 'absolute',
    right: 16,
    top: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  postOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  postOptionItemDelete: {
    borderTopWidth: 1,
    borderTopColor: '#f0f2f5',
  },
  postOptionText: {
    fontSize: 15,
    marginLeft: 12,
    color: '#050505',
  },
  postOptionTextDelete: {
    fontSize: 15,
    marginLeft: 12,
    color: '#e74c3c',
  },
  editButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelEditButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  cancelEditButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveEditButton: {
    flex: 1,
    backgroundColor: '#1877f2',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 8,
  },
  saveEditButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default TimeLine;
