/**
 * Auth Service - Tách business logic xác thực khỏi screens
 * 
 * Flow:
 * Signup → createUser → sendEmailVerification → signOut (chờ verify)
 * Login → signIn → check emailVerified → cho vào app
 * Logout → removePushToken → clearNotifications → signOut
 */

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGIN_STATE_KEY = '@login_state';

// ============================================================
// VALIDATION
// ============================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 * @param {string} email 
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Vui lòng nhập email' };
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return { valid: false, error: 'Email không hợp lệ' };
  }
  return { valid: true };
};

/**
 * Validate password
 * @param {string} password 
 * @returns {{ valid: boolean, error?: string }}
 */
export const validatePassword = (password) => {
  if (!password) {
    return { valid: false, error: 'Vui lòng nhập mật khẩu' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Mật khẩu phải chứa ít nhất 1 số' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Mật khẩu phải chứa ít nhất 1 chữ cái' };
  }
  return { valid: true };
};

// ============================================================
// AUTH OPERATIONS
// ============================================================

/**
 * Đăng nhập
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: object, userData: object}>}
 */
export const login = async (email, password) => {
  const auth = getAuth();
  const db = getFirestore();

  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Reload để lấy emailVerified mới nhất
  await user.reload();

  if (!user.emailVerified) {
    await signOut(auth);
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  // Lấy user data từ Firestore
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.exists() ? userDoc.data() : null;

  // Lưu trạng thái đăng nhập
  await AsyncStorage.setItem(LOGIN_STATE_KEY, 'true');

  return { user, userData };
};

/**
 * Đăng ký tài khoản mới
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.name
 * @param {string} params.gender - 'male' | 'female'
 * @param {string} params.birthdate
 * @returns {Promise<object>} user
 */
export const signup = async ({ email, password, name, gender, birthdate }) => {
  const auth = getAuth();
  const db = getFirestore();

  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Default avatar theo giới tính
  const defaultAvatar = gender === 'male'
    ? 'https://firebasestorage.googleapis.com/v0/b/chatlofi-9c2c8.appspot.com/o/default_avatar_male.png?alt=media'
    : 'https://firebasestorage.googleapis.com/v0/b/chatlofi-9c2c8.appspot.com/o/default_avatar_female.png?alt=media';

  // Update Firebase Auth profile
  await updateProfile(user, { displayName: name, photoURL: defaultAvatar });

  // Tạo user document trong Firestore
  await setDoc(doc(db, 'users', user.uid), {
    UID: user.uid,
    name: name,
    email: email.trim(),
    gender: gender,
    birthdate: birthdate,
    photoURL: defaultAvatar,
    emailVerified: false,
    createdAt: new Date(),
  });

  // Gửi email xác thực
  await sendEmailVerification(user);

  // Sign out ngay — phải verify email trước khi đăng nhập
  await signOut(auth);

  return user;
};

/**
 * Đăng xuất
 * @param {string} userId - để xóa FCM token
 * @param {object} notificationContext - { removePushToken, clearAllNotifications }
 */
export const logout = async (userId, notificationContext) => {
  const auth = getAuth();

  try {
    // Xóa FCM token
    if (notificationContext?.removePushToken && userId) {
      await notificationContext.removePushToken(userId);
    }

    // Xóa tất cả notifications
    if (notificationContext?.clearAllNotifications) {
      await notificationContext.clearAllNotifications();
    }
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
  }

  // Sign out Firebase Auth
  await signOut(auth);

  // Sign out Native Firebase Auth (for Realtime Database)
  try {
    const nativeAuth = require('@react-native-firebase/auth').default;
    await nativeAuth().signOut();
  } catch (error) {
    // Native auth may not be available
  }

  // Xóa login state
  await AsyncStorage.removeItem(LOGIN_STATE_KEY);
};

/**
 * Gửi lại email xác thực
 * @returns {Promise<void>}
 */
export const resendVerificationEmail = async () => {
  const auth = getAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
};

/**
 * Gửi email reset mật khẩu
 * @param {string} email 
 */
export const resetPassword = async (email) => {
  const auth = getAuth();
  await sendPasswordResetEmail(auth, email.trim());
};
