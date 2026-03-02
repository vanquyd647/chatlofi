/**
 * Storage Service - Tập trung tất cả thao tác upload/download Firebase Storage
 * 
 * Cấu trúc Storage:
 * - images/{uid}/{timestamp}_{filename}
 * - videos/{uid}/{timestamp}_{filename}
 * - documents/{uid}/{timestamp}_{filename}
 * - audios/{uid}/{timestamp}_{filename}
 * - posts/{uid}/{timestamp}_{filename}
 * - photos/{uid}/{timestamp}_{filename}     (ảnh đại diện)
 */

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';

const storage = getStorage();

// ============================================================
// UPLOAD HELPERS
// ============================================================

/**
 * Upload file lên Firebase Storage
 * @param {string} path - Đường dẫn lưu trữ (e.g. "images/uid123/photo.jpg")
 * @param {string} uri - Local URI của file
 * @returns {Promise<string>} Download URL
 */
export const uploadFile = async (path, uri) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
};

/**
 * Upload ảnh chat
 * @param {string} uid - User ID
 * @param {string} uri - Local image URI
 * @returns {Promise<string>} Download URL
 */
export const uploadChatImage = async (uid, uri) => {
  const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return uploadFile(`images/${uid}/${filename}`, uri);
};

/**
 * Upload video chat
 * @param {string} uid 
 * @param {string} uri 
 * @returns {Promise<string>} Download URL
 */
export const uploadChatVideo = async (uid, uri) => {
  const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return uploadFile(`videos/${uid}/${filename}`, uri);
};

/**
 * Upload tài liệu chat
 * @param {string} uid 
 * @param {string} uri 
 * @param {string} originalName - Tên file gốc
 * @returns {Promise<string>} Download URL
 */
export const uploadChatDocument = async (uid, uri, originalName = 'document') => {
  const filename = `${Date.now()}_${originalName}`;
  return uploadFile(`documents/${uid}/${filename}`, uri);
};

/**
 * Upload audio chat (tin nhắn thoại)
 * @param {string} uid 
 * @param {string} uri 
 * @returns {Promise<string>} Download URL
 */
export const uploadChatAudio = async (uid, uri) => {
  const filename = `${Date.now()}_voice.m4a`;
  return uploadFile(`audios/${uid}/${filename}`, uri);
};

/**
 * Upload ảnh bài viết
 * @param {string} uid 
 * @param {string} uri 
 * @returns {Promise<string>} Download URL
 */
export const uploadPostMedia = async (uid, uri) => {
  const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return uploadFile(`posts/${uid}/${filename}`, uri);
};

/**
 * Upload ảnh đại diện
 * @param {string} uid 
 * @param {string} uri 
 * @returns {Promise<string>} Download URL
 */
export const uploadProfilePhoto = async (uid, uri) => {
  const filename = `${Date.now()}_profile`;
  return uploadFile(`photos/${uid}/${filename}`, uri);
};

// ============================================================
// DELETE HELPERS
// ============================================================

/**
 * Xóa file theo path
 * @param {string} path 
 */
export const deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    // File có thể đã bị xóa
    if (error.code !== 'storage/object-not-found') {
      console.error('Error deleting file:', error);
    }
  }
};

/**
 * Xóa tất cả ảnh đại diện cũ của user
 * @param {string} uid 
 */
export const deleteOldProfilePhotos = async (uid) => {
  try {
    const folderRef = ref(storage, `photos/${uid}/`);
    const result = await listAll(folderRef);
    await Promise.all(result.items.map((item) => deleteObject(item)));
  } catch (error) {
    console.error('Error deleting old photos:', error);
  }
};

// ============================================================
// UTILITY
// ============================================================

/**
 * Detect content type từ URL (cho PlayVideo screen)
 * @param {string} url 
 * @returns {Promise<string>} 'video' | 'image' | 'unknown'
 */
export const detectContentType = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('image/')) return 'image';
    return 'unknown';
  } catch {
    return 'unknown';
  }
};
