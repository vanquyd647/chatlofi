import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState, Vibration } from 'react-native';
import { getFirestore, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import messaging from '@react-native-firebase/messaging';
import { getDatabase, ref, onValue, onChildAdded, set, query, orderByChild, equalTo } from '@react-native-firebase/database';

// Note: Notification handler is set in index.js to ensure it runs before app starts

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// Setup notification channels for Android
async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    // Main messages channel
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Tin nhắn',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#006AF5',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    // Friend requests channel
    await Notifications.setNotificationChannelAsync('friend_requests', {
      name: 'Lời mời kết bạn',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF9500',
      sound: 'default',
    });

    // Video call channel
    await Notifications.setNotificationChannelAsync('video_call', {
      name: 'Cuộc gọi video',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#4CAF50',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    // Social interactions channel (likes, comments, shares)
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Tương tác',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#34C759',
      sound: 'default',
    });

    // Default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Thông báo chung',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#006AF5',
      sound: 'default',
    });

    console.log('✅ Notification channels setup complete');
  }
}

export const NotificationProvider = ({ children }) => {
  const [fcmToken, setFcmToken] = useState('');
  const [notification, setNotification] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // Cuộc gọi đến
  const [navigationRef, setNavigationRef] = useState(null); // Reference để điều hướng
  const notificationListener = useRef();
  const responseListener = useRef();
  const callListenerRef = useRef(null);
  const db = getFirestore();
  const auth = getAuth();

  // Đặt navigation reference từ App.js
  const setNavigation = (navRef) => {
    setNavigationRef(navRef);
  };

  // Lắng nghe cuộc gọi đến
  const startListeningForCalls = (userId) => {
    if (!userId) {
      console.log('⚠️ Không có userId để lắng nghe cuộc gọi');
      return;
    }
    
    // Tránh tạo listener trùng lặp
    if (callListenerRef.current) {
      console.log('⚠️ Listener đã tồn tại, bỏ qua');
      return;
    }
    
    console.log('🎧 Bắt đầu lắng nghe cuộc gọi đến cho:', userId);
    const database = getDatabase();

    // Lắng nghe TẤT CẢ cuộc gọi (vì query không work với onChildAdded)
    const callsRef = ref(database, 'calls');

    // Lắng nghe child added để bắt ngay cuộc gọi đến
    const childAddedCb = (snapshot) => {
      const callId = snapshot.key;
      const callData = snapshot.val();
      if (!callData) return;
      
      console.log('📡 ChildAdded call:', callId, 'status:', callData.status, 'recipient:', callData.recipientId, 'myUserId:', userId);
      
      // FIX: Ignore old calls (older than 60 seconds) to prevent stale calls on app restart
      const callAge = Date.now() - (callData.createdAt || 0);
      if (callAge > 60000) {
        console.log('⚠️ Ignoring old call (age:', Math.round(callAge/1000), 'seconds)');
        return;
      }
      
      // Filter: Chỉ xử lý cuộc gọi tới mình
      if (callData.recipientId === userId && callData.status === 'ringing') {
        console.log('📞 📞 📞 CÓ CUỘC GỌI ĐẾN từ:', callData.callerName, 'roomId:', callId);
        setIncomingCall({
          roomId: callId,
          callerId: callData.callerId,
          callerName: callData.callerName,
          recipientId: callData.recipientId,
        });
      }
    };

    // onChildAdded trả về unsubscribe function
    const unsubscribe = onChildAdded(
      callsRef, 
      childAddedCb,
      (error) => {
        console.error('❌ Firebase RTD onChildAdded error:', error.message);
        console.error('❌ Error code:', error.code);
        if (error.code === 'PERMISSION_DENIED') {
          console.error('❌ PERMISSION DENIED - Please check Firebase RTD rules!');
          console.error('❌ Set rules to: { "rules": { "calls": { ".read": true, ".write": true } } }');
        }
      }
    );
    callListenerRef.current = unsubscribe;
  };

  // Dừng lắng nghe cuộc gọi
  const stopListeningForCalls = () => {
    if (callListenerRef.current) {
      console.log('🛑 Dừng lắng nghe cuộc gọi');
      // Gọi unsubscribe function
      if (typeof callListenerRef.current === 'function') {
        callListenerRef.current();
      }
      callListenerRef.current = null;
    }
  };

  // Xóa cuộc gọi đến
  const clearIncomingCall = () => {
    setIncomingCall(null);
  };

  // Register for FCM push notifications
  async function registerForPushNotificationsAsync() {
    let token;

    try {
      // Request permission for notifications
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('Permission not granted for notifications');
        return;
      }

      // Get FCM token
      token = await messaging().getToken();
      console.log('FCM Token:', token);
      
      return token;
    } catch (error) {
      console.error('Error in notification registration:', error);
      return null;
    }
  }

  // Save push token to Firestore
  const savePushToken = async (userId, token) => {
    if (!userId || !token) return;

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        lastTokenUpdate: new Date(),
      });
      console.log('FCM token saved to Firestore');
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  };

  // Remove push token (on logout)
  const removePushToken = async (userId) => {
    if (!userId) return;

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: null,
      });
      console.log('FCM token removed from Firestore');
    } catch (error) {
      console.error('Error removing FCM token:', error);
    }
  };

  // Notification Server URL (deployed on Render)
  // Change this to your Render URL after deployment
  const NOTIFICATION_SERVER_URL = 'https://chatlofi-notification.onrender.com';

  // Send custom notification via Notification Server
  const sendPushNotification = async (recipientUserId, title, body, data = {}) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: recipientUserId,
          title: title,
          body: body,
          data: data
        })
      });

      const result = await response.json();
      console.log('Notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  };

  // Send message notification
  const sendMessageNotification = async (chatId, senderId, senderName, text) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          senderId,
          senderName,
          text
        })
      });

      const result = await response.json();
      console.log('Message notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending message notification:', error);
      return null;
    }
  };

  // Send friend request notification
  const sendFriendRequestNotification = async (recipientId, senderId, senderName) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/friend-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId,
          senderId,
          senderName
        })
      });

      const result = await response.json();
      console.log('Friend request notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending friend request notification:', error);
      return null;
    }
  };

  // Send new post notification
  const sendNewPostNotification = async (postId, userId, userName) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/new-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          userId,
          userName
        })
      });

      const result = await response.json();
      console.log('New post notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending new post notification:', error);
      return null;
    }
  };

  // Send friend request accepted notification
  const sendFriendRequestAcceptedNotification = async (recipientId, acceptorId, acceptorName) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/friend-request-accepted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId,
          acceptorId,
          acceptorName
        })
      });

      const result = await response.json();
      console.log('Friend request accepted notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending friend request accepted notification:', error);
      return null;
    }
  };

  // Send post comment notification
  const sendPostCommentNotification = async (postId, postOwnerId, commenterId, commenterName, commentText) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/post-comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          postOwnerId,
          commenterId,
          commenterName,
          commentText
        })
      });

      const result = await response.json();
      console.log('Post comment notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending post comment notification:', error);
      return null;
    }
  };

  // Send post reaction notification (like, love, haha, wow, sad, angry)
  const sendPostReactionNotification = async (postId, postOwnerId, reactorId, reactorName, reactionType = 'like') => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/post-reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          postOwnerId,
          reactorId,
          reactorName,
          reactionType
        })
      });

      const result = await response.json();
      console.log('Post reaction notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending post reaction notification:', error);
      return null;
    }
  };

  // Send post share notification
  const sendPostShareNotification = async (postId, postOwnerId, sharerId, sharerName) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/post-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          postOwnerId,
          sharerId,
          sharerName
        })
      });

      const result = await response.json();
      console.log('Post share notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending post share notification:', error);
      return null;
    }
  };

  // Send comment reply notification
  const sendCommentReplyNotification = async (postId, commentOwnerId, replierId, replierName, replyText) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/comment-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          commentOwnerId,
          replierId,
          replierName,
          replyText
        })
      });

      const result = await response.json();
      console.log('Comment reply notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending comment reply notification:', error);
      return null;
    }
  };

  // Send comment like notification
  const sendCommentLikeNotification = async (postId, commentId, commentOwnerId, likerId, likerName) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/comment-like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          commentId,
          commentOwnerId,
          likerId,
          likerName
        })
      });

      const result = await response.json();
      console.log('Comment like notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending comment like notification:', error);
      return null;
    }
  };

  // Send group invite notification
  const sendGroupInviteNotification = async (recipientId, groupId, groupName, inviterId, inviterName) => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/group-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId,
          groupId,
          groupName,
          inviterId,
          inviterName
        })
      });

      const result = await response.json();
      console.log('Group invite notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending group invite notification:', error);
      return null;
    }
  };

  // Send mention notification (in post or comment)
  const sendMentionNotification = async (recipientId, mentionerId, mentionerName, postId, commentId, type = 'post') => {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/notify/mention`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId,
          mentionerId,
          mentionerName,
          postId,
          commentId,
          type
        })
      });

      const result = await response.json();
      console.log('Mention notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending mention notification:', error);
      return null;
    }
  };

  // Update badge count
  const updateBadgeCount = async (count) => {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Setup notification channels first (Android)
    setupNotificationChannels();

    // Register for FCM notifications on mount
    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (isMounted && token) {
          setFcmToken(token);
          // Save token if user is logged in
          const currentUser = auth.currentUser;
          if (currentUser) {
            await savePushToken(currentUser.uid, token);
          }
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    // Listen for token refresh (FCM token can change)
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async newToken => {
      console.log('FCM Token refreshed:', newToken);
      if (isMounted) {
        setFcmToken(newToken);
        // Update token in Firestore if user is logged in
        const currentUser = auth.currentUser;
        if (currentUser) {
          await savePushToken(currentUser.uid, newToken);
          console.log('Refreshed FCM token saved to Firestore');
        }
      }
    });

    // Listen for foreground messages - Show local notification like Facebook
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('Foreground notification:', remoteMessage);
      if (isMounted) {
        setNotification(remoteMessage);
        
        const { notification, data } = remoteMessage;
        
        // Xử lý đặc biệt cho video call - navigate trực tiếp đến màn hình VideoCall
        if (data?.type === 'video_call') {
          console.log('📞 VIDEO CALL NOTIFICATION received via FCM');
          
          // NOTE: onChildAdded listener on Firebase RTD also triggers setIncomingCall
          // To avoid duplicate navigation, we rely on onChildAdded listener for real-time detection
          // FCM notification is just a backup for when app is killed
          // So we skip setting incomingCall here if app is in foreground
          console.log('📞 Skipping FCM setIncomingCall - onChildAdded listener will handle it');
          
          // Không hiện notification vì sẽ navigate trực tiếp
          return;
        }
        
        // Show local notification when app is in foreground (like Facebook)
        if (notification) {
          // Determine which channel to use based on notification type
          const channelId = data?.type === 'new_message' || data?.type === 'message' 
            ? 'messages' 
            : data?.type === 'friend_request' || data?.type === 'friend_accept'
            ? 'friend_requests'
            : 'default';
          
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notification.title || 'ChatLofi',
                body: notification.body || '',
                data: data || {},
                sound: 'default',
                badge: 1,
                // Android specific - use channel for sound and vibration
                ...(Platform.OS === 'android' && {
                  channelId: channelId,
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  vibrationPattern: [0, 300, 200, 300],
                  color: '#006AF5',
                }),
              },
              trigger: null, // Show immediately
            });
            console.log('Local notification scheduled successfully');
          } catch (error) {
            console.error('Error scheduling notification:', error);
          }
        }
      }
    });

    // Note: Background message handler is registered in index.js

    // Listen for notification taps when app is in background
    const unsubscribeOnOpen = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app:', remoteMessage);
      // Handle navigation based on notification data
      const data = remoteMessage.data;
      if (data?.screen) {
        // Navigate to specific screen - can be handled by navigation
      }
    });

    // Check if app was opened from a notification (killed state)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification opened app from quit state:', remoteMessage);
        }
      });

    return () => {
      isMounted = false;
      if (unsubscribeTokenRefresh) {
        unsubscribeTokenRefresh();
      }
      if (unsubscribeForeground) {
        unsubscribeForeground();
      }
      if (unsubscribeOnOpen) {
        unsubscribeOnOpen();
      }
    };
  }, []);

  const value = {
    fcmToken,
    notification,
    incomingCall,
    setIncomingCall, // Export để StackNavigator có thể reset sau khi navigate
    registerForPushNotificationsAsync,
    savePushToken,
    removePushToken,
    sendPushNotification,
    sendMessageNotification,
    // Friend notifications
    sendFriendRequestNotification,
    sendFriendRequestAcceptedNotification,
    // Post notifications
    sendNewPostNotification,
    sendPostCommentNotification,
    sendPostReactionNotification,
    sendPostShareNotification,
    sendCommentReplyNotification,
    sendCommentLikeNotification,
    sendMentionNotification,
    // Group notifications
    sendGroupInviteNotification,
    // Badge & clear
    updateBadgeCount,
    clearAllNotifications,
    // Video call
    setNavigation,
    startListeningForCalls,
    stopListeningForCalls,
    clearIncomingCall,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
