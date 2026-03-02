/**
 * Friend Service - Tách business logic bạn bè khỏi screens
 * 
 * Quản lý vòng đời bạn bè:
 * Stranger → Sent/Received Request → Friend → Unfriend
 * 
 * Firestore subcollections:
 * - users/{uid}/friendData/{docId}
 * - users/{uid}/friend_Sents/{docId}
 * - users/{uid}/friend_Receiveds/{docId}
 */

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();

// ============================================================
// HELPERS
// ============================================================

/** Tạo random hex ID cho phòng chat */
const generateRoomId = () => {
  return '0x' + Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
};

// ============================================================
// FRIEND STATUS CHECK
// ============================================================

/**
 * Kiểm tra trạng thái bạn bè giữa 2 user
 * @param {string} myUid 
 * @param {string} otherUid 
 * @returns {Promise<{status: string, docId?: string, data?: object}>}
 *   status: 'friend' | 'sent' | 'received' | 'stranger'
 */
export const checkFriendStatus = async (myUid, otherUid) => {
  // Check if already friends
  const friendQuery = query(
    collection(db, 'users', myUid, 'friendData'),
    where('UID_fr', '==', otherUid)
  );
  const friendSnap = await getDocs(friendQuery);
  if (!friendSnap.empty) {
    return { status: 'friend', docId: friendSnap.docs[0].id, data: friendSnap.docs[0].data() };
  }

  // Check if request sent
  const sentQuery = query(
    collection(db, 'users', myUid, 'friend_Sents'),
    where('UID_fr', '==', otherUid)
  );
  const sentSnap = await getDocs(sentQuery);
  if (!sentSnap.empty) {
    return { status: 'sent', docId: sentSnap.docs[0].id, data: sentSnap.docs[0].data() };
  }

  // Check if request received
  const receivedQuery = query(
    collection(db, 'users', myUid, 'friend_Receiveds'),
    where('UID_fr', '==', otherUid)
  );
  const receivedSnap = await getDocs(receivedQuery);
  if (!receivedSnap.empty) {
    return { status: 'received', docId: receivedSnap.docs[0].id, data: receivedSnap.docs[0].data() };
  }

  return { status: 'stranger' };
};

// ============================================================
// CHAT ROOM (helper for friend request flow)
// ============================================================

/**
 * Tìm hoặc tạo phòng chat 1-1 giữa 2 user
 * @param {string} uid1 
 * @param {string} uid2 
 * @returns {Promise<string>} roomId
 */
export const findOrCreateChatRoom = async (uid1, uid2) => {
  const sortedUids = [uid1, uid2].sort();
  const chatKey = sortedUids.join('_');

  // Tìm phòng chat đã tồn tại
  const chatsRef = collection(db, 'Chats');
  const q = query(chatsRef, where('UID_Chats', '==', chatKey));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].data().ID_roomChat || snapshot.docs[0].id;
  }

  // Tạo phòng chat mới
  const roomId = generateRoomId();
  const chatRoomRef = doc(db, 'Chats', roomId);
  await setDoc(chatRoomRef, {
    ID_roomChat: roomId,
    UID: sortedUids,
    UID_Chats: chatKey,
    detailDelete: [],
    pinnedBy: [],
    mutedUsers: [],
  });
  return roomId;
};

// ============================================================
// FRIEND REQUEST LIFECYCLE
// ============================================================

/**
 * Gửi lời mời kết bạn (atomic batch)
 * Tự động tìm/tạo chat room
 * @param {object} myInfo - { uid, name, email, photoURL }
 * @param {object} friendInfo - { uid, name, email, photoURL }
 * @returns {Promise<string>} chatRoomId
 */
export const sendFriendRequest = async (myInfo, friendInfo) => {
  // Tìm hoặc tạo chat room trước
  const chatRoomId = await findOrCreateChatRoom(myInfo.uid, friendInfo.uid);

  const batch = writeBatch(db);
  const mySentRef = doc(collection(db, 'users', myInfo.uid, 'friend_Sents'));
  const theirReceivedRef = doc(collection(db, 'users', friendInfo.uid, 'friend_Receiveds'));

  batch.set(mySentRef, {
    UID_fr: friendInfo.uid,
    name_fr: friendInfo.name,
    email_fr: friendInfo.email || '',
    photoURL_fr: friendInfo.photoURL || '',
    ID_roomChat: chatRoomId,
    createdAt: new Date(),
  });

  batch.set(theirReceivedRef, {
    UID_fr: myInfo.uid,
    name_fr: myInfo.name,
    email_fr: myInfo.email || '',
    photoURL_fr: myInfo.photoURL || '',
    ID_roomChat: chatRoomId,
    createdAt: new Date(),
  });

  await batch.commit();
  return chatRoomId;
};

/**
 * Hủy lời mời đã gửi (atomic batch)
 * @param {string} myUid 
 * @param {string} friendUid 
 */
export const cancelFriendRequest = async (myUid, friendUid) => {
  const sentQuery = query(
    collection(db, 'users', myUid, 'friend_Sents'),
    where('UID_fr', '==', friendUid)
  );
  const sentSnap = await getDocs(sentQuery);

  const receivedQuery = query(
    collection(db, 'users', friendUid, 'friend_Receiveds'),
    where('UID_fr', '==', myUid)
  );
  const receivedSnap = await getDocs(receivedQuery);

  const batch = writeBatch(db);
  sentSnap.docs.forEach((d) => batch.delete(d.ref));
  receivedSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

/**
 * Chấp nhận lời mời kết bạn (atomic batch)
 * Đồng thời thêm friendData cho cả 2 bên + xóa request docs
 * @param {object} myInfo - { uid, name, email, photoURL }
 * @param {object} friendInfo - { uid, name, email, photoURL, ID_roomChat }
 */
export const acceptFriendRequest = async (myInfo, friendInfo) => {
  const batch = writeBatch(db);

  // Thêm vào friendData của cả 2 bên
  const myFriendRef = doc(collection(db, 'users', myInfo.uid, 'friendData'));
  const theirFriendRef = doc(collection(db, 'users', friendInfo.uid, 'friendData'));

  batch.set(myFriendRef, {
    UID_fr: friendInfo.uid,
    name_fr: friendInfo.name,
    email_fr: friendInfo.email || '',
    photoURL_fr: friendInfo.photoURL || '',
    ID_roomChat: friendInfo.ID_roomChat || '',
    addedAt: new Date(),
  });

  batch.set(theirFriendRef, {
    UID_fr: myInfo.uid,
    name_fr: myInfo.name,
    email_fr: myInfo.email || '',
    photoURL_fr: myInfo.photoURL || '',
    ID_roomChat: friendInfo.ID_roomChat || '',
    addedAt: new Date(),
  });

  // Xóa request docs từ cả 2 bên
  const myReceivedQuery = query(
    collection(db, 'users', myInfo.uid, 'friend_Receiveds'),
    where('UID_fr', '==', friendInfo.uid)
  );
  const theirSentQuery = query(
    collection(db, 'users', friendInfo.uid, 'friend_Sents'),
    where('UID_fr', '==', myInfo.uid)
  );

  const [myReceivedSnap, theirSentSnap] = await Promise.all([
    getDocs(myReceivedQuery),
    getDocs(theirSentQuery),
  ]);

  myReceivedSnap.docs.forEach((d) => batch.delete(d.ref));
  theirSentSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
};

/**
 * Từ chối lời mời kết bạn (atomic batch)
 * @param {string} myUid 
 * @param {string} friendUid 
 */
export const declineFriendRequest = async (myUid, friendUid) => {
  const receivedQuery = query(
    collection(db, 'users', myUid, 'friend_Receiveds'),
    where('UID_fr', '==', friendUid)
  );
  const receivedSnap = await getDocs(receivedQuery);

  const sentQuery = query(
    collection(db, 'users', friendUid, 'friend_Sents'),
    where('UID_fr', '==', myUid)
  );
  const sentSnap = await getDocs(sentQuery);

  const batch = writeBatch(db);
  receivedSnap.docs.forEach((d) => batch.delete(d.ref));
  sentSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

/**
 * Hủy kết bạn (atomic batch)
 * @param {string} myUid 
 * @param {string} friendUid 
 */
export const unfriend = async (myUid, friendUid) => {
  const myFriendQuery = query(
    collection(db, 'users', myUid, 'friendData'),
    where('UID_fr', '==', friendUid)
  );
  const theirFriendQuery = query(
    collection(db, 'users', friendUid, 'friendData'),
    where('UID_fr', '==', myUid)
  );

  const [mySnap, theirSnap] = await Promise.all([
    getDocs(myFriendQuery),
    getDocs(theirFriendQuery),
  ]);

  const batch = writeBatch(db);
  mySnap.docs.forEach((d) => batch.delete(d.ref));
  theirSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

// ============================================================
// SUBSCRIPTIONS (Real-time listeners)
// ============================================================

/**
 * Lắng nghe danh sách bạn bè real-time
 * @param {string} userId 
 * @param {function} callback - (friends[]) => void
 * @returns {function} unsubscribe
 */
export const subscribeToFriends = (userId, callback) => {
  const friendRef = collection(db, 'users', userId, 'friendData');
  return onSnapshot(friendRef, (snapshot) => {
    const friends = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(friends);
  });
};

/**
 * Lắng nghe lời mời đã nhận real-time
 * @param {string} userId 
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export const subscribeToReceivedRequests = (userId, callback) => {
  const ref = collection(db, 'users', userId, 'friend_Receiveds');
  return onSnapshot(ref, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(requests);
  });
};

/**
 * Lắng nghe lời mời đã gửi real-time
 * @param {string} userId 
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export const subscribeToSentRequests = (userId, callback) => {
  const ref = collection(db, 'users', userId, 'friend_Sents');
  return onSnapshot(ref, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(requests);
  });
};

/**
 * Tìm kiếm người dùng theo tên (exact match)
 * @param {string} searchName 
 * @param {string} [excludeUid] - UID cần loại trừ (thường là current user)
 * @returns {Promise<object[]>}
 */
export const searchUsersByName = async (searchName, excludeUid = null) => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('name', '==', searchName));
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  if (excludeUid) {
    return results.filter((u) => u.UID !== excludeUid);
  }
  return results;
};

/**
 * Tìm kiếm người dùng + trạng thái bạn bè cho từng kết quả
 * @param {string} searchName 
 * @param {string} myUid 
 * @returns {Promise<object[]>} users kèm trạng thái { ...userData, friendStatus }
 */
export const searchUsersWithStatus = async (searchName, myUid) => {
  const users = await searchUsersByName(searchName, myUid);
  const results = await Promise.all(
    users.map(async (user) => {
      const status = await checkFriendStatus(myUid, user.UID);
      return { ...user, friendStatus: status };
    })
  );
  return results;
};
