/**
 * Chat Service - Tách business logic chat khỏi screens
 * 
 * Tập trung toàn bộ thao tác CRUD với Firestore collections:
 * - Chats/{roomId}
 * - Chats/{roomId}/chat_mess/{msgId}
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
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();
const auth = getAuth();

// ============================================================
// CONSTANTS
// ============================================================

/** Thời gian cho phép thu hồi tin nhắn (10 phút) */
export const RECALL_TIME_LIMIT = 10 * 60 * 1000;

// ============================================================
// CHAT ROOM OPERATIONS
// ============================================================

/**
 * Lấy thông tin phòng chat theo roomId
 * @param {string} roomId 
 * @returns {Promise<object|null>}
 */
export const getChatRoom = async (roomId) => {
  try {
    const chatDocRef = doc(db, 'Chats', roomId);
    const chatDocSnap = await getDoc(chatDocRef);
    if (chatDocSnap.exists()) {
      return { id: chatDocSnap.id, ...chatDocSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching chat room:', error);
    throw error;
  }
};

/**
 * Lắng nghe danh sách phòng chat real-time
 * @param {string} userId 
 * @param {function} callback - (chats[]) => void
 * @returns {function} unsubscribe
 */
export const subscribeToChatList = (userId, callback) => {
  const chatsRef = collection(db, 'Chats');
  const q = query(chatsRef, where('UID', 'array-contains', userId));

  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    callback(rooms);
  });
};

/**
 * Tìm hoặc tạo phòng chat 1-1
 * @param {string} myUid 
 * @param {string} friendUid 
 * @returns {Promise<string>} roomId
 */
export const findOrCreateChatRoom = async (myUid, friendUid) => {
  const sortedUids = [myUid, friendUid].sort();
  const chatKey = sortedUids.join('_');

  // Tìm phòng chat đã tồn tại
  const chatsRef = collection(db, 'Chats');
  const q = query(chatsRef, where('UID_Chats', '==', chatKey));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].data().ID_roomChat;
  }

  // Tạo phòng chat mới
  const roomId = '0x' + Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  const chatData = {
    ID_roomChat: roomId,
    UID: sortedUids,
    UID_Chats: chatKey,
    detailDelete: [],
    pinnedBy: [],
    mutedUsers: [],
  };

  await addDoc(chatsRef, chatData);
  return roomId;
};

// ============================================================
// PIN / MUTE OPERATIONS
// ============================================================

/**
 * Toggle ghim phòng chat
 * @param {string} roomId 
 * @param {string} userId 
 * @param {boolean} isPinned - trạng thái hiện tại
 * @returns {Promise<boolean>} trạng thái mới
 */
export const togglePinChat = async (roomId, userId, isPinned) => {
  const chatDocRef = doc(db, 'Chats', roomId);
  if (isPinned) {
    await updateDoc(chatDocRef, { pinnedBy: arrayRemove(userId) });
  } else {
    await updateDoc(chatDocRef, { pinnedBy: arrayUnion(userId) });
  }
  return !isPinned;
};

/**
 * Toggle tắt thông báo phòng chat
 * @param {string} roomId 
 * @param {string} userId 
 * @param {boolean} isMuted - trạng thái hiện tại
 * @returns {Promise<boolean>} trạng thái mới
 */
export const toggleMuteChat = async (roomId, userId, isMuted) => {
  const chatDocRef = doc(db, 'Chats', roomId);
  if (isMuted) {
    await updateDoc(chatDocRef, { mutedUsers: arrayRemove(userId) });
  } else {
    await updateDoc(chatDocRef, { mutedUsers: arrayUnion(userId) });
  }
  return !isMuted;
};

// ============================================================
// SOFT DELETE CHAT
// ============================================================

/**
 * Xóa lịch sử chat (soft delete - ẩn tin nhắn trước thời điểm xóa)
 * @param {string} roomId 
 * @param {string} userId 
 */
export const softDeleteChat = async (roomId, userId) => {
  const chatDocRef = doc(db, 'Chats', roomId);
  const chatDocSnap = await getDoc(chatDocRef);

  if (chatDocSnap.exists()) {
    const data = chatDocSnap.data();
    const detailDeleteArray = data.detailDelete || [];
    detailDeleteArray.push({
      timeDelete: new Date(),
      uidDelete: userId,
    });
    await updateDoc(chatDocRef, { detailDelete: detailDeleteArray });
  }
};

// ============================================================
// MESSAGE OPERATIONS
// ============================================================

/**
 * Lắng nghe tin nhắn real-time trong phòng chat
 * @param {string} roomId 
 * @param {string} userId - để filter tin nhắn đã xóa
 * @param {Date|null} deleteAfterTime - thời điểm soft-delete chat
 * @param {function} callback - (messages[]) => void
 * @returns {function} unsubscribe
 */
export const subscribeToMessages = (roomId, userId, deleteAfterTime, callback) => {
  const messRef = collection(db, 'Chats', roomId, 'chat_mess');
  const q = query(messRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          _id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      })
      .filter((msg) => {
        // Filter tin nhắn trước thời điểm soft-delete
        if (deleteAfterTime && msg.createdAt < deleteAfterTime) {
          return false;
        }
        // Filter tin nhắn đã xóa bởi user hiện tại
        if (msg.deleteDetail_mess) {
          return !msg.deleteDetail_mess.some(
            (detail) => detail.uidDelete === userId
          );
        }
        return true;
      });

    callback(messages);
  });
};

/**
 * Gửi tin nhắn text
 * @param {string} roomId 
 * @param {object} messageData - { text, image?, video?, document?, audio?, contentType?, user }
 * @returns {Promise<string>} messageId
 */
export const sendMessage = async (roomId, messageData) => {
  const messRef = collection(db, 'Chats', roomId, 'chat_mess');
  const docRef = await addDoc(messRef, {
    ...messageData,
    createdAt: new Date(),
    deleteDetail_mess: [],
  });
  return docRef.id;
};

/**
 * Thu hồi tin nhắn (trong 10 phút)
 * @param {string} roomId 
 * @param {string} messageId 
 * @param {string} userId 
 * @param {Date} messageCreatedAt - thời điểm gửi tin nhắn
 * @returns {Promise<boolean>} true nếu thu hồi thành công
 */
export const recallMessage = async (roomId, messageId, userId, messageCreatedAt) => {
  const now = new Date();
  const messageTime = messageCreatedAt instanceof Date ? messageCreatedAt : messageCreatedAt.toDate();
  const timeDiff = now.getTime() - messageTime.getTime();

  if (timeDiff > RECALL_TIME_LIMIT) {
    throw new Error('Đã quá thời gian cho phép thu hồi (10 phút)');
  }

  const msgRef = doc(db, 'Chats', roomId, 'chat_mess', messageId);
  await updateDoc(msgRef, {
    text: 'Tin nhắn đã được thu hồi!',
    image: null,
    video: null,
    document: null,
    audio: null,
    contentType: null,
    isRecalled: true,
    recalledAt: new Date(),
    recalledBy: userId,
  });

  return true;
};

/**
 * Xóa tin nhắn (chỉ ẩn với user hiện tại)
 * @param {string} roomId 
 * @param {string} messageId 
 * @param {string} userId 
 */
export const deleteMessageForSelf = async (roomId, messageId, userId) => {
  const msgRef = doc(db, 'Chats', roomId, 'chat_mess', messageId);
  await updateDoc(msgRef, {
    deleteDetail_mess: arrayUnion({
      timeDelete: new Date(),
      uidDelete: userId,
    }),
  });
};

/**
 * Thêm/bỏ reaction cho tin nhắn
 * @param {string} roomId 
 * @param {string} messageId 
 * @param {string} userId 
 * @param {string} emoji - '👍' | '❤️' | '😂' | '😮' | '😢' | '😠'
 */
export const toggleReaction = async (roomId, messageId, userId, emoji) => {
  const msgRef = doc(db, 'Chats', roomId, 'chat_mess', messageId);
  const msgSnap = await getDoc(msgRef);

  if (!msgSnap.exists()) return;

  const data = msgSnap.data();
  const reactions = data.reactions || {};
  const emojiUsers = reactions[emoji] || [];

  if (emojiUsers.includes(userId)) {
    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: arrayRemove(userId),
    });
  } else {
    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: arrayUnion(userId),
    });
  }
};

/**
 * Forward tin nhắn vào phòng chat khác
 * @param {string} targetRoomId 
 * @param {object} messageData - { text, image, video, document, user }
 * @returns {Promise<string>} messageId
 */
export const forwardMessage = async (targetRoomId, messageData) => {
  return sendMessage(targetRoomId, messageData);
};

// ============================================================
// CHAT ROOM SUBSCRIPTION & QUERIES
// ============================================================

/**
 * Lắng nghe thay đổi real-time của 1 phòng chat
 * @param {string} roomId 
 * @param {function} callback - (chatData) => void
 * @returns {function} unsubscribe
 */
export const subscribeToChatRoom = (roomId, callback) => {
  const chatDocRef = doc(db, 'Chats', roomId);
  return onSnapshot(chatDocRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    }
  });
};

/**
 * Đếm số ảnh, video, file trong phòng chat
 * @param {string} roomId 
 * @returns {Promise<{images: number, videos: number, files: number}>}
 */
export const getMediaCount = async (roomId) => {
  const messagesRef = collection(db, 'Chats', roomId, 'chat_mess');
  const messagesSnap = await getDocs(messagesRef);
  let images = 0, videos = 0, files = 0;
  messagesSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.image) images++;
    if (data.video) videos++;
    if (data.document) files++;
  });
  return { images, videos, files };
};

/**
 * Tìm kiếm tin nhắn trong phòng chat (client-side full-text search)
 * @param {string} roomId 
 * @param {string} searchText 
 * @returns {Promise<Array>}
 */
export const searchMessages = async (roomId, searchText) => {
  const messagesRef = collection(db, 'Chats', roomId, 'chat_mess');
  const messagesSnap = await getDocs(messagesRef);
  const results = [];
  const queryLower = searchText.toLowerCase();

  messagesSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.text && data.text.toLowerCase().includes(queryLower)) {
      results.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      });
    }
  });

  results.sort((a, b) => b.createdAt - a.createdAt);
  return results;
};

/**
 * Xóa toàn bộ lịch sử chat (destructive - xóa cho tất cả users)
 * @param {string} roomId 
 */
export const clearChatHistory = async (roomId) => {
  const messagesRef = collection(db, 'Chats', roomId, 'chat_mess');
  const messagesSnap = await getDocs(messagesRef);
  const deletePromises = [];
  messagesSnap.forEach((docSnap) => {
    deletePromises.push(deleteDoc(docSnap.ref));
  });
  await Promise.all(deletePromises);
};
