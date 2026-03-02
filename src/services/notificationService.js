/**
 * Notification Service - Refactored: 1 hàm generic thay vì 12 hàm trùng lặp
 * 
 * Tất cả notification types dùng chung pattern:
 * POST /api/notify/{type} → Notification Server → FCM
 * 
 * Firestore collection: notifications/{notificationId}
 */

import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  writeBatch,
} from 'firebase/firestore';

// Notification Server URL (deployed on Render)
const NOTIFICATION_SERVER_URL = 'https://chatlofi-notification.onrender.com';

// ============================================================
// GENERIC NOTIFICATION SENDER
// ============================================================

/**
 * Gửi notification qua Notification Server
 * @param {string} endpoint - API endpoint (e.g. '/api/notify/message')
 * @param {object} payload - Request body
 * @returns {Promise<object|null>} Server response
 */
const sendNotification = async (endpoint, payload) => {
  try {
    const response = await fetch(`${NOTIFICATION_SERVER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    console.error(`Error sending notification (${endpoint}):`, error);
    return null;
  }
};

// ============================================================
// TYPED NOTIFICATION HELPERS
// ============================================================

/** Notification types enum */
export const NotificationType = {
  MESSAGE: 'message',
  FRIEND_REQUEST: 'friend-request',
  FRIEND_ACCEPT: 'friend-request-accepted',
  NEW_POST: 'new-post',
  POST_COMMENT: 'post-comment',
  POST_REACTION: 'post-reaction',
  POST_SHARE: 'post-share',
  COMMENT_REPLY: 'comment-reply',
  COMMENT_LIKE: 'comment-like',
  GROUP_INVITE: 'group-invite',
  MENTION: 'mention',
  VIDEO_CALL: 'video-call',
};

/**
 * Gửi thông báo tin nhắn mới
 */
export const notifyMessage = (chatId, senderId, senderName, text) =>
  sendNotification('/api/notify/message', { chatId, senderId, senderName, text });

/**
 * Gửi thông báo lời mời kết bạn
 */
export const notifyFriendRequest = (recipientId, senderId, senderName) =>
  sendNotification('/api/notify/friend-request', { recipientId, senderId, senderName });

/**
 * Gửi thông báo chấp nhận kết bạn
 */
export const notifyFriendAccepted = (recipientId, acceptorId, acceptorName) =>
  sendNotification('/api/notify/friend-request-accepted', { recipientId, acceptorId, acceptorName });

/**
 * Gửi thông báo bài viết mới
 */
export const notifyNewPost = (postId, userId, userName) =>
  sendNotification('/api/notify/new-post', { postId, userId, userName });

/**
 * Gửi thông báo bình luận bài viết
 */
export const notifyPostComment = (postId, postOwnerId, commenterId, commenterName, commentText) =>
  sendNotification('/api/notify/post-comment', { postId, postOwnerId, commenterId, commenterName, commentText });

/**
 * Gửi thông báo reaction bài viết
 */
export const notifyPostReaction = (postId, postOwnerId, reactorId, reactorName, reactionType = 'like') =>
  sendNotification('/api/notify/post-reaction', { postId, postOwnerId, reactorId, reactorName, reactionType });

/**
 * Gửi thông báo chia sẻ bài viết
 */
export const notifyPostShare = (postId, postOwnerId, sharerId, sharerName) =>
  sendNotification('/api/notify/post-share', { postId, postOwnerId, sharerId, sharerName });

/**
 * Gửi thông báo trả lời bình luận
 */
export const notifyCommentReply = (postId, commentOwnerId, replierId, replierName, replyText) =>
  sendNotification('/api/notify/comment-reply', { postId, commentOwnerId, replierId, replierName, replyText });

/**
 * Gửi thông báo like bình luận
 */
export const notifyCommentLike = (postId, commentId, commentOwnerId, likerId, likerName) =>
  sendNotification('/api/notify/comment-like', { postId, commentId, commentOwnerId, likerId, likerName });

/**
 * Gửi thông báo mời vào nhóm
 */
export const notifyGroupInvite = (recipientId, groupId, groupName, inviterId, inviterName) =>
  sendNotification('/api/notify/group-invite', { recipientId, groupId, groupName, inviterId, inviterName });

/**
 * Gửi thông báo mention
 */
export const notifyMention = (recipientId, mentionerId, mentionerName, postId, commentId, type = 'post') =>
  sendNotification('/api/notify/mention', { recipientId, mentionerId, mentionerName, postId, commentId, type });

/**
 * Gửi thông báo cuộc gọi video
 */
export const notifyVideoCall = (recipientId, callerId, callerName, roomId) =>
  sendNotification('/api/notify/video-call', { recipientId, callerId, callerName, roomId });

/**
 * Gửi notification custom (dùng cho trường hợp đặc biệt)
 */
export const notifyCustom = (recipientUserId, title, body, data = {}) =>
  sendNotification('/api/send-notification', { recipientId: recipientUserId, title, body, data });

// ============================================================
// FIRESTORE NOTIFICATION CRUD
// ============================================================

const db = getFirestore();

/**
 * Lắng nghe thông báo real-time của user
 * @param {string} userId - ID người nhận
 * @param {function} callback - (notifications[]) => void
 * @param {function} [onError] - (error) => void
 * @returns {function} unsubscribe
 */
export const subscribeToNotifications = (userId, callback, onError) => {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    }));
    notifications.sort((a, b) => b.createdAt - a.createdAt);
    callback(notifications);
  }, (error) => {
    if (onError) onError(error);
  });
};

/**
 * Đánh dấu thông báo đã đọc
 * @param {string} notificationId
 */
export const markNotificationRead = async (notificationId) => {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
};

/**
 * Toggle trạng thái read/unread
 * @param {string} notificationId
 * @param {boolean} read
 */
export const toggleNotificationReadStatus = async (notificationId, read) => {
  await updateDoc(doc(db, 'notifications', notificationId), { read });
};

/**
 * Đánh dấu tất cả thông báo chưa đọc là đã đọc (batch)
 * @param {object[]} unreadNotifications - Danh sách thông báo chưa đọc
 */
export const markAllNotificationsRead = async (unreadNotifications) => {
  const batch = writeBatch(db);
  unreadNotifications.forEach(n => {
    batch.update(doc(db, 'notifications', n.id), { read: true });
  });
  await batch.commit();
};

/**
 * Xóa thông báo
 * @param {string} notificationId
 */
export const removeNotification = async (notificationId) => {
  await deleteDoc(doc(db, 'notifications', notificationId));
};
