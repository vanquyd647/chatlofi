import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Image,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    Dimensions,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal
} from 'react-native';
import { Video } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign, Ionicons, Feather, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDoc,
    getDocs,
    where,
    writeBatch
} from 'firebase/firestore';
import { formatDistanceToNowStrict } from 'date-fns';
import { vi } from 'date-fns/locale';
import ImageViewer from 'react-native-image-zoom-viewer';

const { width, height } = Dimensions.get('window');

const PostDetail = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { postId } = route.params;

    const [userData, setUserData] = useState(null);
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [replyToComment, setReplyToComment] = useState(null);
    const [showReactions, setShowReactions] = useState(false);
    const [fullscreenImages, setFullscreenImages] = useState([]);
    const [fullscreenVisible, setFullscreenVisible] = useState(false);
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

    // Load post details
    useEffect(() => {
        if (!postId) return;

        const postRef = doc(db, 'posts', postId);
        const unsubscribe = onSnapshot(postRef, async (docSnap) => {
            if (docSnap.exists()) {
                const postData = { id: docSnap.id, ...docSnap.data() };

                // Fetch user info if not exists
                if (!postData.userInfo && postData.userId) {
                    const userDocRef = doc(db, 'users', postData.userId);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        postData.userInfo = userDocSnap.data();
                    }
                }

                setPost(postData);
                setIsLoading(false);
            } else {
                Alert.alert('Lỗi', 'Bài viết không tồn tại');
                navigation.goBack();
            }
        });

        return () => unsubscribe();
    }, [postId]);

    // Load comments
    useEffect(() => {
        if (!postId) return;

        const commentsRef = collection(db, `posts/${postId}/comments`);
        const q = query(commentsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const commentsData = [];

            for (const docSnap of querySnapshot.docs) {
                const commentData = { id: docSnap.id, ...docSnap.data() };

                if (!commentData.userInfo && commentData.userId) {
                    try {
                        const userDocRef = doc(db, 'users', commentData.userId);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            commentData.userInfo = userDocSnap.data();
                        }
                    } catch (error) {
                        console.error('Error fetching commenter info:', error);
                    }
                }

                commentsData.push(commentData);
            }

            setComments(commentsData);
        });

        return () => unsubscribe();
    }, [postId]);

    // Handle reaction
    const handleReaction = async (type) => {
        if (!userData || !post) return;

        try {
            const postRef = doc(db, 'posts', post.id);
            const currentReaction = post.reactions?.[userData.uid];

            if (currentReaction?.type === type) {
                // Remove reaction
                await updateDoc(postRef, {
                    [`reactions.${userData.uid}`]: null
                });
            } else {
                // Add/update reaction
                await updateDoc(postRef, {
                    [`reactions.${userData.uid}`]: {
                        type,
                        createdAt: serverTimestamp()
                    }
                });
            }
            setShowReactions(false);
        } catch (error) {
            console.error('Error updating reaction:', error);
        }
    };

    // Handle comment
    const handleComment = async () => {
        if (!commentText.trim() || !userData || !post) return;

        try {
            const userDocRef = doc(db, 'users', userData.uid);
            const userDocSnap = await getDoc(userDocRef);
            const currentUserInfo = userDocSnap.exists() ? userDocSnap.data() : {
                name: userData.displayName || userData.email,
                photoURL: userData.photoURL || null,
                email: userData.email
            };

            const commentData = {
                userId: userData.uid,
                text: commentText.trim(),
                createdAt: serverTimestamp(),
                likes: [],
                replyTo: replyToComment || null,
                replies: [],
                userInfo: {
                    name: currentUserInfo.name,
                    displayName: currentUserInfo.name,
                    photoURL: currentUserInfo.photoURL,
                    email: currentUserInfo.email
                }
            };

            await addDoc(collection(db, `posts/${post.id}/comments`), commentData);
            setCommentText('');
            setReplyToComment(null);
        } catch (error) {
            console.error('Error posting comment:', error);
            Alert.alert('Lỗi', 'Không thể đăng bình luận');
        }
    };

    // Like comment
    const handleLikeComment = async (commentId) => {
        if (!userData) return;

        try {
            const commentRef = doc(db, `posts/${post.id}/comments`, commentId);
            const commentDoc = await getDoc(commentRef);

            if (commentDoc.exists()) {
                const commentData = commentDoc.data();
                const likes = commentData.likes || [];

                if (likes.includes(userData.uid)) {
                    await updateDoc(commentRef, {
                        likes: likes.filter(id => id !== userData.uid)
                    });
                } else {
                    await updateDoc(commentRef, {
                        likes: [...likes, userData.uid]
                    });
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

    // Delete post
    const handleDeletePost = async () => {
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
                            await deleteDoc(doc(db, 'posts', post.id));
                            Alert.alert('Thành công', 'Đã xóa bài viết');
                            navigation.goBack();
                        } catch (error) {
                            console.error('Error deleting post:', error);
                            Alert.alert('Lỗi', 'Không thể xóa bài viết');
                        }
                    }
                }
            ]
        );
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
        const count = Object.keys(reactions).filter(key => reactions[key]).length;

        return { count, types, reactionCounts };
    };

    // Render reaction icons
    const renderReactionIcon = (type, size = 20) => {
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

    // Render multiple images
    const renderMultipleImages = (mediaUrls) => {
        if (!mediaUrls || mediaUrls.length === 0) return null;

        const imageCount = mediaUrls.length;

        if (imageCount === 1) {
            return (
                <TouchableOpacity onPress={() => {
                    setFullscreenImages(mediaUrls.map(url => ({ url })));
                    setFullscreenVisible(true);
                }}>
                    <Image source={{ uri: mediaUrls[0] }} style={styles.singleImage} />
                </TouchableOpacity>
            );
        }

        if (imageCount === 2) {
            return (
                <View style={styles.twoImagesContainer}>
                    {mediaUrls.map((url, index) => (
                        <TouchableOpacity key={index} style={styles.twoImageItem} onPress={() => {
                            setFullscreenImages(mediaUrls.map(u => ({ url: u })));
                            setFullscreenVisible(true);
                        }}>
                            <Image source={{ uri: url }} style={styles.twoImage} />
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        if (imageCount === 3) {
            return (
                <View style={styles.threeImagesContainer}>
                    <TouchableOpacity style={styles.threeImageMain} onPress={() => {
                        setFullscreenImages(mediaUrls.map(u => ({ url: u })));
                        setFullscreenVisible(true);
                    }}>
                        <Image source={{ uri: mediaUrls[0] }} style={styles.threeMainImage} />
                    </TouchableOpacity>
                    <View style={styles.threeImageSide}>
                        {mediaUrls.slice(1).map((url, index) => (
                            <TouchableOpacity key={index} style={styles.threeSideItem} onPress={() => {
                                setFullscreenImages(mediaUrls.map(u => ({ url: u })));
                                setFullscreenVisible(true);
                            }}>
                                <Image source={{ uri: url }} style={styles.threeSideImage} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            );
        }

        // 4+ images
        return (
            <View style={styles.gridContainer}>
                {mediaUrls.slice(0, 4).map((url, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.gridItem}
                        onPress={() => {
                            setFullscreenImages(mediaUrls.map(u => ({ url: u })));
                            setFullscreenVisible(true);
                        }}
                    >
                        <Image source={{ uri: url }} style={styles.gridImage} />
                        {index === 3 && imageCount > 4 && (
                            <View style={styles.moreOverlay}>
                                <Text style={styles.moreText}>+{imageCount - 4}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
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

    if (!post) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Không tìm thấy bài viết</Text>
            </View>
        );
    }

    const reactionSummary = getReactionSummary(post.reactions);
    const userReaction = post.reactions?.[userData?.uid];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chi tiết bài viết</Text>
                {post.userId === userData?.uid && (
                    <TouchableOpacity onPress={handleDeletePost}>
                        <MaterialIcons name="delete" size={24} color="#e74c3c" />
                    </TouchableOpacity>
                )}
                {post.userId !== userData?.uid && <View style={{ width: 24 }} />}
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView style={styles.scrollView}>
                    {/* Post Header */}
                    <View style={styles.postHeader}>
                        <TouchableOpacity
                            style={styles.postHeaderLeft}
                            onPress={() => {
                                if (post.userId === userData?.uid) {
                                    navigation.navigate('Cá nhân');
                                } else {
                                    navigation.navigate('Personal_page', { userId: post.userId });
                                }
                            }}
                        >
                            <Image
                                source={{ uri: post.userInfo?.photoURL || 'https://via.placeholder.com/150' }}
                                style={styles.avatar}
                            />
                            <View style={styles.postHeaderInfo}>
                                <Text style={styles.userName}>{post.userInfo?.name || 'Người dùng'}</Text>
                                <Text style={styles.postTime}>
                                    {post.createdAt ? formatDistanceToNowStrict(post.createdAt.toDate(), {
                                        addSuffix: true,
                                        locale: vi
                                    }) : 'Vừa xong'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Post Content */}
                    {post.text ? (
                        <View style={styles.postContent}>
                            <Text style={styles.postText}>{post.text}</Text>
                        </View>
                    ) : null}

                    {/* Shared Post */}
                    {post.isSharedPost && post.originalPost && (
                        <View style={styles.sharedPostContainer}>
                            <View style={styles.sharedPostHeader}>
                                <Image
                                    source={{ uri: post.originalPost.userPhoto || 'https://via.placeholder.com/150' }}
                                    style={styles.sharedAvatar}
                                />
                                <View>
                                    <Text style={styles.sharedUserName}>{post.originalPost.userName}</Text>
                                    <Text style={styles.sharedPostTime}>
                                        {post.originalPost.createdAt && post.originalPost.createdAt.toDate ?
                                            formatDistanceToNowStrict(post.originalPost.createdAt.toDate(), {
                                                addSuffix: true,
                                                locale: vi
                                            }) : 'Vừa xong'}
                                    </Text>
                                </View>
                            </View>
                            {post.originalPost.text ? (
                                <Text style={styles.sharedPostText}>{post.originalPost.text}</Text>
                            ) : null}
                            {post.originalPost.mediaUrl && (
                                <TouchableOpacity onPress={() => {
                                    setFullscreenImages([{ url: post.originalPost.mediaUrl }]);
                                    setFullscreenVisible(true);
                                }}>
                                    <Image source={{ uri: post.originalPost.mediaUrl }} style={styles.sharedMedia} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Media */}
                    {post.mediaUrls && post.mediaUrls.length > 0 ? (
                        renderMultipleImages(post.mediaUrls)
                    ) : post.mediaUrl ? (
                        post.mediaType === 'image' ? (
                            <TouchableOpacity onPress={() => {
                                setFullscreenImages([{ url: post.mediaUrl }]);
                                setFullscreenVisible(true);
                            }}>
                                <Image source={{ uri: post.mediaUrl }} style={styles.singleImage} />
                            </TouchableOpacity>
                        ) : post.mediaType === 'video' ? (
                            <Video
                                source={{ uri: post.mediaUrl }}
                                style={styles.video}
                                useNativeControls
                                resizeMode="contain"
                            />
                        ) : null
                    ) : null}

                    {/* Reactions & Stats */}
                    <View style={styles.statsContainer}>
                        <View style={styles.reactionsStats}>
                            {reactionSummary.count > 0 && (
                                <>
                                    <View style={styles.reactionIcons}>
                                        {reactionSummary.types.slice(0, 3).map((type, index) => (
                                            <View key={type} style={[styles.reactionIconWrapper, { marginLeft: index > 0 ? -8 : 0 }]}>
                                                {renderReactionIcon(type, 16)}
                                            </View>
                                        ))}
                                    </View>
                                    <Text style={styles.reactionCount}>{reactionSummary.count}</Text>
                                </>
                            )}
                        </View>
                        <Text style={styles.commentCount}>{comments.length} bình luận</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setShowReactions(!showReactions)}
                        >
                            {userReaction ? (
                                <>
                                    {renderReactionIcon(userReaction.type, 20)}
                                    <Text style={[styles.actionText, { color: '#1877f2' }]}>
                                        {userReaction.type === 'like' ? 'Thích' :
                                            userReaction.type === 'love' ? 'Yêu thích' :
                                                userReaction.type === 'haha' ? 'Haha' :
                                                    userReaction.type === 'wow' ? 'Wow' :
                                                        userReaction.type === 'sad' ? 'Buồn' : 'Phẫn nộ'}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <AntDesign name="like2" size={20} color="#666" />
                                    <Text style={styles.actionText}>Thích</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton}>
                            <FontAwesome5 name="comment" size={18} color="#666" />
                            <Text style={styles.actionText}>Bình luận</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Reaction Menu */}
                    {showReactions && (
                        <View style={styles.reactionMenu}>
                            {['like', 'love', 'haha', 'wow', 'sad', 'angry'].map(type => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => handleReaction(type)}
                                    style={styles.reactionMenuItem}
                                >
                                    {renderReactionIcon(type, 28)}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Comments Section */}
                    <View style={styles.commentsSection}>
                        <Text style={styles.commentsSectionTitle}>Bình luận ({comments.length})</Text>

                        {comments.map((comment) => (
                            <View key={comment.id} style={styles.commentItem}>
                                <Image
                                    source={{ uri: comment.userInfo?.photoURL || 'https://via.placeholder.com/150' }}
                                    style={styles.commentAvatar}
                                />
                                <View style={styles.commentContent}>
                                    <View style={styles.commentBubble}>
                                        <Text style={styles.commentUserName}>{comment.userInfo?.name || 'Người dùng'}</Text>
                                        <Text style={styles.commentText}>{comment.text}</Text>
                                    </View>
                                    <View style={styles.commentActions}>
                                        <TouchableOpacity onPress={() => handleLikeComment(comment.id)}>
                                            <Text style={[styles.commentActionText, comment.likes?.includes(userData?.uid) && styles.commentLiked]}>
                                                Thích {comment.likes?.length > 0 && `(${comment.likes.length})`}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleReplyComment(comment)}>
                                            <Text style={styles.commentActionText}>Trả lời</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.commentTime}>
                                            {comment.createdAt ? formatDistanceToNowStrict(comment.createdAt.toDate(), {
                                                addSuffix: true,
                                                locale: vi
                                            }) : 'Vừa xong'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                {/* Comment Input */}
                <View style={styles.commentInputContainer}>
                    {replyToComment && (
                        <View style={styles.replyingTo}>
                            <Text style={styles.replyingToText}>
                                Đang trả lời {replyToComment.userInfo?.name}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setReplyToComment(null);
                                setCommentText('');
                            }}>
                                <Ionicons name="close-circle" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.commentInputRow}>
                        <Image
                            source={{ uri: userData?.photoURL || 'https://via.placeholder.com/150' }}
                            style={styles.commentInputAvatar}
                        />
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Viết bình luận..."
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                        />
                        <TouchableOpacity
                            onPress={handleComment}
                            disabled={!commentText.trim()}
                        >
                            <Ionicons
                                name="send"
                                size={24}
                                color={commentText.trim() ? '#1877f2' : '#ccc'}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Fullscreen Image Viewer */}
            <Modal visible={fullscreenVisible} transparent={true}>
                <ImageViewer
                    imageUrls={fullscreenImages}
                    enableSwipeDown
                    onSwipeDown={() => setFullscreenVisible(false)}
                    onCancel={() => setFullscreenVisible(false)}
                    backgroundColor="rgba(0,0,0,0.9)"
                />
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
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
        borderBottomWidth: 1,
        borderBottomColor: '#e1e8ed',
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
    },
    postHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    postHeaderInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    postTime: {
        fontSize: 13,
        color: '#65676b',
        marginTop: 2,
    },
    postContent: {
        paddingHorizontal: 15,
        paddingBottom: 10,
    },
    postText: {
        fontSize: 15,
        color: '#000',
        lineHeight: 20,
    },
    singleImage: {
        width: '100%',
        height: 400,
        resizeMode: 'cover',
    },
    video: {
        width: '100%',
        height: 300,
        backgroundColor: '#000',
    },
    twoImagesContainer: {
        flexDirection: 'row',
        height: 300,
    },
    twoImageItem: {
        flex: 1,
        padding: 1,
    },
    twoImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    threeImagesContainer: {
        flexDirection: 'row',
        height: 300,
    },
    threeImageMain: {
        flex: 1,
        padding: 1,
    },
    threeMainImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    threeImageSide: {
        flex: 1,
    },
    threeSideItem: {
        flex: 1,
        padding: 1,
    },
    threeSideImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridItem: {
        width: '50%',
        height: 200,
        padding: 1,
    },
    gridImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    moreOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    sharedPostContainer: {
        margin: 15,
        borderWidth: 1,
        borderColor: '#e1e8ed',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#f7f8fa',
    },
    sharedPostHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    sharedAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
    sharedUserName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#000',
    },
    sharedPostTime: {
        fontSize: 12,
        color: '#65676b',
    },
    sharedPostText: {
        fontSize: 14,
        color: '#000',
        marginBottom: 8,
    },
    sharedMedia: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        resizeMode: 'cover',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#e1e8ed',
    },
    reactionsStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    reactionIcons: {
        flexDirection: 'row',
        marginRight: 5,
    },
    reactionIconWrapper: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e1e8ed',
    },
    reactionCount: {
        fontSize: 14,
        color: '#65676b',
    },
    commentCount: {
        fontSize: 14,
        color: '#65676b',
    },
    actionsContainer: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e1e8ed',
        paddingVertical: 4,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    actionText: {
        marginLeft: 6,
        fontSize: 15,
        color: '#65676b',
        fontWeight: '600',
    },
    reactionMenu: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 15,
        justifyContent: 'space-around',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e8ed',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    reactionMenuItem: {
        padding: 8,
    },
    commentsSection: {
        padding: 15,
    },
    commentsSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#000',
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    commentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 10,
    },
    commentContent: {
        flex: 1,
    },
    commentBubble: {
        backgroundColor: '#f0f2f5',
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    commentUserName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 2,
    },
    commentText: {
        fontSize: 14,
        color: '#000',
        lineHeight: 18,
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        paddingLeft: 12,
    },
    commentActionText: {
        fontSize: 13,
        color: '#65676b',
        fontWeight: '600',
        marginRight: 15,
    },
    commentLiked: {
        color: '#1877f2',
    },
    commentTime: {
        fontSize: 12,
        color: '#65676b',
    },
    commentInputContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e1e8ed',
        backgroundColor: '#fff',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    replyingTo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: '#f0f2f5',
    },
    replyingToText: {
        fontSize: 13,
        color: '#65676b',
    },
    commentInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    commentInputAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#f0f2f5',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        fontSize: 15,
        maxHeight: 100,
    },
});

export default PostDetail;
