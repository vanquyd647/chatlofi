/**
 * Group Service - Tách business logic quản lý nhóm khỏi screens
 * 
 * Tất cả thao tác nhóm đều DUAL-WRITE vào cả Group + Chats collections
 * sử dụng writeBatch để đảm bảo tính nhất quán (atomicity).
 * 
 * Firestore collections:
 * - Group/{roomId}
 * - Chats/{roomId}
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

const db = getFirestore();

// ============================================================
// HELPERS
// ============================================================

/**
 * Tạo random hex ID cho phòng chat nhóm
 * @returns {string} e.g. "0x1a2b3c4d5e6f"
 */
const generateRoomId = () => {
  return '0x' + Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
};

// ============================================================
// GROUP CRUD
// ============================================================

/**
 * Tạo nhóm mới - atomic dual-write vào Group + Chats
 * @param {object} params
 * @param {string} params.groupName - Tên nhóm
 * @param {string[]} params.memberUids - UID của tất cả thành viên (bao gồm admin)
 * @param {string} params.adminUid - UID của admin (người tạo)
 * @param {string} [params.photoUrl] - Ảnh nhóm (optional)
 * @returns {Promise<string>} roomId
 */
export const createGroup = async ({ groupName, memberUids, adminUid, photoUrl = '' }) => {
  if (memberUids.length < 3) {
    throw new Error('Nhóm cần ít nhất 3 thành viên (bao gồm admin)');
  }

  const roomId = generateRoomId();

  const groupData = {
    ID_roomChat: roomId,
    Name_group: groupName,
    Photo_group: photoUrl,
    UID: memberUids,
    Admin_group: adminUid,
    Sub_Admin: [],
  };

  const chatData = {
    ID_roomChat: roomId,
    Name_group: groupName,
    Photo_group: photoUrl,
    UID: memberUids,
    Admin_group: adminUid,
    Sub_Admin: [],
    detailDelete: [],
    pinnedBy: [],
    mutedUsers: [],
  };

  // Atomic dual-write
  const batch = writeBatch(db);
  batch.set(doc(db, 'Group', roomId), groupData);
  batch.set(doc(db, 'Chats', roomId), chatData);
  await batch.commit();

  return roomId;
};

/**
 * Thêm thành viên vào nhóm - atomic dual-write
 * @param {string} roomId 
 * @param {string[]} newMemberUids - UIDs cần thêm
 */
export const addMembers = async (roomId, newMemberUids) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'Group', roomId);
  const chatRef = doc(db, 'Chats', roomId);

  for (const uid of newMemberUids) {
    batch.update(groupRef, { UID: arrayUnion(uid) });
    batch.update(chatRef, { UID: arrayUnion(uid) });
  }

  await batch.commit();
};

/**
 * Xóa thành viên khỏi nhóm - atomic dual-write
 * Cũng xóa khỏi Sub_Admin nếu đang là phó nhóm
 * @param {string} roomId 
 * @param {string} memberUid 
 */
export const removeMember = async (roomId, memberUid) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'Group', roomId);
  const chatRef = doc(db, 'Chats', roomId);

  batch.update(groupRef, {
    UID: arrayRemove(memberUid),
    Sub_Admin: arrayRemove(memberUid),
  });
  batch.update(chatRef, {
    UID: arrayRemove(memberUid),
    Sub_Admin: arrayRemove(memberUid),
  });

  await batch.commit();
};

/**
 * Rời nhóm (tự rời)
 * - Nếu là admin → phải chuyển admin trước (gọi transferAdmin)
 * - Nếu là member/sub-admin → xóa UID khỏi cả hai collections
 * @param {string} roomId 
 * @param {string} userId 
 * @param {string} adminUid - admin hiện tại để check
 * @returns {Promise<{needsAdminTransfer: boolean}>}
 */
export const leaveGroup = async (roomId, userId, adminUid) => {
  if (userId === adminUid) {
    return { needsAdminTransfer: true };
  }

  await removeMember(roomId, userId);
  return { needsAdminTransfer: false };
};

/**
 * Chuyển quyền admin và rời nhóm - atomic dual-write
 * @param {string} roomId 
 * @param {string} oldAdminUid - admin cũ (sẽ rời nhóm)
 * @param {string} newAdminUid - admin mới
 */
export const transferAdminAndLeave = async (roomId, oldAdminUid, newAdminUid) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'Group', roomId);
  const chatRef = doc(db, 'Chats', roomId);

  // Chuyển admin
  batch.update(groupRef, {
    Admin_group: newAdminUid,
    UID: arrayRemove(oldAdminUid),
    Sub_Admin: arrayRemove(newAdminUid), // Nếu admin mới đang là sub-admin
  });
  batch.update(chatRef, {
    Admin_group: newAdminUid,
    UID: arrayRemove(oldAdminUid),
    Sub_Admin: arrayRemove(newAdminUid),
  });

  await batch.commit();
};

/**
 * Toggle phó nhóm (Sub_Admin) - atomic dual-write
 * @param {string} roomId 
 * @param {string} memberUid 
 * @param {boolean} isSubAdmin - trạng thái hiện tại
 * @returns {Promise<boolean>} trạng thái mới
 */
export const toggleSubAdmin = async (roomId, memberUid, isSubAdmin) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'Group', roomId);
  const chatRef = doc(db, 'Chats', roomId);

  if (isSubAdmin) {
    batch.update(groupRef, { Sub_Admin: arrayRemove(memberUid) });
    batch.update(chatRef, { Sub_Admin: arrayRemove(memberUid) });
  } else {
    batch.update(groupRef, { Sub_Admin: arrayUnion(memberUid) });
    batch.update(chatRef, { Sub_Admin: arrayUnion(memberUid) });
  }

  await batch.commit();
  return !isSubAdmin;
};

/**
 * Giải tán nhóm - atomic dual-delete (HARD DELETE)
 * @param {string} roomId 
 * @param {string} userId - phải là admin
 * @param {string} adminUid - admin hiện tại để verify
 */
export const dissolveGroup = async (roomId, userId, adminUid) => {
  if (userId !== adminUid) {
    throw new Error('Chỉ admin mới có thể giải tán nhóm');
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, 'Group', roomId));
  batch.delete(doc(db, 'Chats', roomId));
  await batch.commit();
};

/**
 * Lấy thông tin nhóm
 * @param {string} roomId 
 * @returns {Promise<object|null>}
 */
export const getGroupInfo = async (roomId) => {
  try {
    const groupDoc = await getDoc(doc(db, 'Group', roomId));
    if (groupDoc.exists()) {
      return { id: groupDoc.id, ...groupDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching group info:', error);
    throw error;
  }
};

// ============================================================
// SUBSCRIPTIONS (Real-time listeners)
// ============================================================

/**
 * Lắng nghe danh sách nhóm của user real-time
 * @param {string} userId 
 * @param {function} callback - (groups[]) => void
 * @returns {function} unsubscribe
 */
export const subscribeToUserGroups = (userId, callback) => {
  const groupRef = collection(db, 'Group');
  const q = query(groupRef, where('UID', 'array-contains', userId));
  return onSnapshot(q, (snapshot) => {
    const groups = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    groups.sort((a, b) => (a.Name_group || '').localeCompare(b.Name_group || ''));
    callback(groups);
  });
};

/**
 * Lắng nghe thông tin nhóm real-time
 * @param {string} roomId 
 * @param {function} callback - (groupData) => void
 * @returns {function} unsubscribe
 */
export const subscribeToGroupInfo = (roomId, callback) => {
  const groupRef = doc(db, 'Group', roomId);
  return onSnapshot(groupRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
};
