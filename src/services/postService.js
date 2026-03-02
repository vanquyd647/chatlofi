/**
 * Post Service - Tách business logic bài viết/mạng xã hội khỏi screens
 * 
 * Firestore collections:
 * - posts/{postId}
 * - posts/{postId}/comments/{commentId}
 */

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  arrayUnion,
  arrayRemove,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

const db = getFirestore();

/** Số bài viết mỗi trang */
export const POSTS_PER_PAGE = 10;

/** 6 loại reaction */
export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

// ============================================================
// POST CRUD
// ============================================================

/**
 * Tạo bài viết mới
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.text
 * @param {string|null} params.mediaUrl - Single media URL
 * @param {string[]|null} params.mediaUrls - Multiple media URLs
 * @param {string|null} params.mediaType - 'image' | 'video' | 'audio' | 'images'
 * @param {object} params.userInfo - { name, displayName, photoURL, email }
 * @returns {Promise<string>} postId
 */
export const createPost = async ({ userId, text, mediaUrl = null, mediaUrls = null, mediaType = null, userInfo }) => {
  const postData = {
    userId,
    text: text || '',
    mediaUrl,
    mediaUrls,
    mediaType,
    reactions: {},
    shares: 0,
    createdAt: serverTimestamp(),
    userInfo,
  };

  const docRef = await addDoc(collection(db, 'posts'), postData);
  return docRef.id;
};

/**
 * Lấy bài viết theo ID
 * @param {string} postId 
 * @returns {Promise<object|null>}
 */
export const getPost = async (postId) => {
  const postDoc = await getDoc(doc(db, 'posts', postId));
  if (postDoc.exists()) {
    return { id: postDoc.id, ...postDoc.data() };
  }
  return null;
};

/**
 * Lắng nghe bài viết real-time
 * @param {string} postId 
 * @param {function} callback 
 * @returns {function} unsubscribe
 */
export const subscribeToPost = (postId, callback) => {
  return onSnapshot(doc(db, 'posts', postId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    }
  });
};

/**
 * Lấy danh sách bài viết (paginated)
 * @param {object} [lastDoc] - Cursor cho pagination
 * @param {number} [pageSize=10]
 * @returns {Promise<{posts: object[], lastDoc: object}>}
 */
export const getPosts = async (lastDoc = null, pageSize = POSTS_PER_PAGE) => {
  let q;
  if (lastDoc) {
    q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(pageSize)
    );
  } else {
    q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
  }

  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  return { posts, lastDoc: newLastDoc };
};

/**
 * Lấy bài viết của user cụ thể
 * @param {string} userId 
 * @returns {Promise<object[]>}
 */
export const getUserPosts = async (userId) => {
  const q = query(
    collection(db, 'posts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Xóa bài viết
 * @param {string} postId 
 */
export const deletePost = async (postId) => {
  await deleteDoc(doc(db, 'posts', postId));
};

/**
 * Cập nhật bài viết
 * @param {string} postId
 * @param {object} updatedData - Fields to update (text, mediaUrl, mediaType, etc.)
 */
export const updatePost = async (postId, updatedData) => {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, updatedData);
};

/**
 * Chia sẻ bài viết
 * @param {object} params
 * @param {string} params.userId - ID người chia sẻ
 * @param {string} params.sourcePostId - ID bài viết gốc (để tăng share count)
 * @param {string} params.text - Nội dung kèm theo
 * @param {object} params.originalPost - Dữ liệu bài gốc
 * @param {object} params.userInfo - Thông tin người chia sẻ
 * @returns {Promise<string>} postId mới
 */
export const sharePost = async ({ userId, sourcePostId, text, originalPost, userInfo }) => {
  const sharedPostData = {
    userId,
    text: text || '',
    isSharedPost: true,
    originalPost,
    reactions: {},
    shares: 0,
    createdAt: serverTimestamp(),
    userInfo,
  };

  const docRef = await addDoc(collection(db, 'posts'), sharedPostData);

  // Tăng share count trên bài nguồn
  const sourceRef = doc(db, 'posts', sourcePostId);
  const sourceSnap = await getDoc(sourceRef);
  if (sourceSnap.exists()) {
    await updateDoc(sourceRef, { shares: (sourceSnap.data().shares || 0) + 1 });
  }

  return docRef.id;
};

// ============================================================
// REACTIONS
// ============================================================

/**
 * Toggle reaction cho bài viết
 * @param {string} postId 
 * @param {string} userId 
 * @param {string} reactionType - 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
 * @returns {Promise<{added: boolean, type: string}>}
 */
export const togglePostReaction = async (postId, userId, reactionType) => {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);

  if (!postSnap.exists()) throw new Error('Post not found');

  const data = postSnap.data();
  const reactions = data.reactions || {};
  const existingReaction = reactions[userId];

  if (existingReaction && existingReaction.type === reactionType) {
    // Remove reaction
    const updatedReactions = { ...reactions };
    delete updatedReactions[userId];
    await updateDoc(postRef, { reactions: updatedReactions });
    return { added: false, type: reactionType };
  } else {
    // Add or change reaction
    await updateDoc(postRef, {
      [`reactions.${userId}`]: { type: reactionType, timestamp: new Date() },
    });
    return { added: true, type: reactionType };
  }
};

// ============================================================
// COMMENTS
// ============================================================

/**
 * Thêm bình luận
 * @param {string} postId 
 * @param {object} commentData - { userId, text, userInfo, replyTo? }
 * @returns {Promise<string>} commentId
 */
export const addComment = async (postId, commentData) => {
  const commentsRef = collection(db, 'posts', postId, 'comments');
  const data = {
    likes: [],
    replies: [],
    createdAt: serverTimestamp(),
    ...commentData,
  };
  const docRef = await addDoc(commentsRef, data);
  return docRef.id;
};

/**
 * Xóa bình luận
 * @param {string} postId 
 * @param {string} commentId 
 */
export const deleteComment = async (postId, commentId) => {
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
};

/**
 * Lắng nghe bình luận real-time
 * @param {string} postId 
 * @param {function} callback - (comments[]) => void
 * @returns {function} unsubscribe
 */
export const subscribeToComments = (postId, callback) => {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(comments);
  });
};

/**
 * Toggle like bình luận
 * @param {string} postId 
 * @param {string} commentId 
 * @param {string} userId 
 */
export const toggleCommentLike = async (postId, commentId, userId) => {
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);

  if (!commentSnap.exists()) return;

  const data = commentSnap.data();
  const likes = data.likes || [];

  if (likes.includes(userId)) {
    await updateDoc(commentRef, { likes: arrayRemove(userId) });
  } else {
    await updateDoc(commentRef, { likes: arrayUnion(userId) });
  }
};
