/**
 * User Service - Tách business logic user profile khỏi screens
 * 
 * Quản lý:
 * - Đọc/cập nhật profile
 * - Cascade update tên/ảnh sang posts & comments
 * 
 * Firestore collections:
 * - users/{uid}
 * - posts (batch update userInfo)
 * - posts/{postId}/comments (batch update commenter info)
 */

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getAuth, updateProfile } from 'firebase/auth';

const db = getFirestore();

// ============================================================
// PROFILE CRUD
// ============================================================

/**
 * Lấy thông tin user theo UID
 * @param {string} uid 
 * @returns {Promise<object|null>}
 */
export const getUserById = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

/**
 * Lắng nghe profile user real-time
 * @param {string} uid 
 * @param {function} callback - (userData) => void
 * @returns {function} unsubscribe
 */
export const subscribeToUser = (uid, callback) => {
  return onSnapshot(doc(db, 'users', uid), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    }
  });
};

/**
 * Cập nhật thông tin cá nhân
 * @param {string} uid 
 * @param {object} updates - { name?, gender?, birthdate? }
 */
export const updateUserProfile = async (uid, updates) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates);

  // Cập nhật Firebase Auth displayName nếu có thay đổi tên
  if (updates.name) {
    const auth = getAuth();
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: updates.name });
    }
  }
};

/**
 * Cập nhật ảnh đại diện
 * @param {string} uid 
 * @param {string} photoURL 
 */
export const updateUserPhoto = async (uid, photoURL) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { photoURL });

  const auth = getAuth();
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL });
  }
};

// ============================================================
// CASCADE UPDATES (Denormalized data sync)
// ============================================================

/**
 * Cascade cập nhật tên user trong tất cả bài viết và bình luận
 * Dùng khi user đổi tên → phải sync sang posts.userInfo.name + comments.commenterName
 * @param {string} uid 
 * @param {string} newName 
 */
export const cascadeUpdateName = async (uid, newName) => {
  const batch = writeBatch(db);
  let operationCount = 0;

  // Update posts
  const postsQuery = query(collection(db, 'posts'), where('userId', '==', uid));
  const postsSnap = await getDocs(postsQuery);
  postsSnap.docs.forEach((postDoc) => {
    batch.update(postDoc.ref, { 'userInfo.name': newName });
    operationCount++;
  });

  // Update comments (across all posts)
  // Note: Firestore batches have a limit of 500 operations
  if (operationCount < 450) {
    const allPostsSnap = await getDocs(collection(db, 'posts'));
    for (const postDoc of allPostsSnap.docs) {
      if (operationCount >= 450) break;
      const commentsQuery = query(
        collection(db, 'posts', postDoc.id, 'comments'),
        where('userId', '==', uid)
      );
      const commentsSnap = await getDocs(commentsQuery);
      commentsSnap.docs.forEach((commentDoc) => {
        if (operationCount < 450) {
          batch.update(commentDoc.ref, { commenterName: newName });
          operationCount++;
        }
      });
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
};

/**
 * Cascade cập nhật ảnh user trong tất cả bài viết và bình luận
 * @param {string} uid 
 * @param {string} newPhotoURL 
 */
export const cascadeUpdatePhoto = async (uid, newPhotoURL) => {
  const batch = writeBatch(db);
  let operationCount = 0;

  // Update posts
  const postsQuery = query(collection(db, 'posts'), where('userId', '==', uid));
  const postsSnap = await getDocs(postsQuery);
  postsSnap.docs.forEach((postDoc) => {
    batch.update(postDoc.ref, { 'userInfo.photoURL': newPhotoURL });
    operationCount++;
  });

  // Update comments
  if (operationCount < 450) {
    const allPostsSnap = await getDocs(collection(db, 'posts'));
    for (const postDoc of allPostsSnap.docs) {
      if (operationCount >= 450) break;
      const commentsQuery = query(
        collection(db, 'posts', postDoc.id, 'comments'),
        where('userId', '==', uid)
      );
      const commentsSnap = await getDocs(commentsQuery);
      commentsSnap.docs.forEach((commentDoc) => {
        if (operationCount < 450) {
          batch.update(commentDoc.ref, { commenterPhoto: newPhotoURL });
          operationCount++;
        }
      });
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
};

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate thông tin profile
 * @param {object} data - { name?, birthdate? }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateProfileData = (data) => {
  const errors = [];

  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Tên phải có ít nhất 2 ký tự');
    }
    if (data.name && data.name.trim().length > 50) {
      errors.push('Tên không được quá 50 ký tự');
    }
  }

  if (data.birthdate !== undefined) {
    const birth = new Date(data.birthdate);
    const now = new Date();
    if (birth > now) {
      errors.push('Ngày sinh không thể là ngày trong tương lai');
    }
    const age = (now - birth) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 13) {
      errors.push('Bạn phải ít nhất 13 tuổi');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
