import React, { useState, createContext, useContext, useEffect, useRef } from 'react';
import { StatusBar, SafeAreaView, View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { FontAwesome, FontAwesome5, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../config/firebase';
import { useNotifications } from '../contextApi/NotificationContext';
// Native Firebase Auth for syncing with Realtime Database
import nativeAuth from '@react-native-firebase/auth';
// Import screens
import Chat from '../screens/Chat';
import Diary from '../screens/TimeLine';
import Explore from '../screens/Discovery';
import Phonebook from '../screens/Phonebook';
import Profile from '../screens/Profile';
import Login from '../screens/Login';
import Signup from '../screens/Signup';
import SearchFriend from '../screens/SearchFriend';
import FriendRequest from '../screens/FriendRequest';
import Chat_fr from '../screens/Chat_fr';
import PlayVideo from '../screens/PlayVideo';
import Personal_page from '../screens/Personal_page';
import Forward_message from '../screens/Forward_message';
import Add_group from '../screens/Add_group';
import Option_chat from '../screens/Option_chat';
import Setting_group from '../screens/Setting_group';
import Setting_app from '../screens/Setting_app';
import Edit_in4Personal from '../screens/Edit_in4Personal';
import Manager_group from '../screens/Manager_group';
import Add_mem_gr from '../screens/Add_mem_gr';
import Select_Ad from '../screens/Select_Ad';
import VideoCall from '../screens/VideoCall';
import PostDetail from '../screens/PostDetail';
import MyPosts from '../screens/MyPosts';
import PermissionsScreen from '../screens/PermissionsScreen';
import Notifications from '../screens/Notifications';
import Friend_received from '../screens/Friend_received';
import Friends from '../screens/Friends';

const PERMISSIONS_KEY = '@permissions_requested';
const LOGIN_STATE_KEY = '@login_state';

const AuthenticatedUserContext = createContext({});

const AuthenticatedUserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <AuthenticatedUserContext.Provider value={{ user, setUser, isLoggedIn, setIsLoggedIn }}>
      {children}
    </AuthenticatedUserContext.Provider>
  );
};

const Tab = createBottomTabNavigator();
function BottomTabs({ setIsLoggedIn }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={{
        tabBarStyle: {
          backgroundColor: "white",
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          borderTopWidth: 0
        }
      }}>
        <Tab.Screen
          name="Tin nhắn"
          component={Chat}
          options={{
            headerShown: false,
            tabBarIcon: ({ focused }) =>
              focused ? (
                <FontAwesome name="comment" size={24} color="#006AF5" />
              ) : (
                <FontAwesome name="comment-o" size={24} color="black" />
              ),
          }}
        />
        <Tab.Screen
          name="Danh bạ"
          component={Phonebook}
          options={{
            headerShown: false,
            tabBarIcon: ({ focused }) =>
              focused ? (
                <FontAwesome name="address-book" size={24} color="#006AF5" />
              ) : (
                <FontAwesome name="address-book-o" size={24} color="black" />
              ),
          }}
        />
        <Tab.Screen
          name="Khám phá"
          component={Explore}
          options={{
            headerShown: false,
            tabBarIcon: ({ focused }) =>
              focused ? (
                <Feather name="more-horizontal" size={24} color="#006AF5" />
              ) : (
                <Feather name="more-horizontal" size={24} color="black" />
              ),
          }}
        />
        <Tab.Screen
          name="Nhật ký"
          component={Diary}
          options={{
            headerShown: false,
            tabBarIcon: ({ focused }) =>
              focused ? (
                <MaterialCommunityIcons name="clock" size={24} color="#006AF5" />
              ) : (
                <FontAwesome5 name="clock" size={24} color="black" />
              ),
          }}
        />
        <Tab.Screen
          name="Cá nhân"
          options={{
            headerShown: false,
            tabBarIcon: ({ focused }) =>
              focused ? (
                <FontAwesome name="user" size={24} color="#006AF5" />
              ) : (
                <FontAwesome name="user-o" size={24} color="black" />
              ),
          }}
        >
          {props => <Profile {...props} setIsLoggedIn={setIsLoggedIn} />}
        </Tab.Screen>
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const Stack = createNativeStackNavigator();

const ChatStack = ({ setIsLoggedIn }) => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" options={{ headerShown: false }}>
        {props => <BottomTabs {...props} setIsLoggedIn={setIsLoggedIn} />}
      </Stack.Screen>
      <Stack.Screen name="SearchFriend" component={SearchFriend} options={{ headerShown: false }} />
      <Stack.Screen name="FriendRequest" component={FriendRequest} options={{ headerShown: false }} />
      <Stack.Screen name="Add_group" component={Add_group} options={{ headerShown: false }} />
      <Stack.Screen name="Chat_fr" component={Chat_fr} options={{ headerShown: false }} />
      <Stack.Screen name="PlayVideo" component={PlayVideo} options={{ headerShown: false }} />
      <Stack.Screen name="Personal_page" component={Personal_page} options={{ headerShown: false }} />
      <Stack.Screen name="Forward_message" component={Forward_message} options={{ headerShown: false }} />
      <Stack.Screen name="Option_chat" component={Option_chat} options={{ headerShown: false }} />
      <Stack.Screen name="Setting_group" component={Setting_group} options={{ headerShown: false }} />
      <Stack.Screen name="Setting_app" component={Setting_app} options={{ headerShown: false }} />
      <Stack.Screen name="Edit_in4Personal" component={Edit_in4Personal} options={{ headerShown: false }} />
      <Stack.Screen name="Manager_group" component={Manager_group} options={{ headerShown: false }} />
      <Stack.Screen name="Add_mem_gr" component={Add_mem_gr} options={{ headerShown: false }} />
      <Stack.Screen name="Select_Ad" component={Select_Ad} options={{ headerShown: false }} />
      <Stack.Screen name="VideoCall" component={VideoCall} options={{ headerShown: false }} />
      <Stack.Screen name="PostDetail" component={PostDetail} options={{ headerShown: false }} />
      <Stack.Screen name="MyPosts" component={MyPosts} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false }} />
      <Stack.Screen name="Friend_received" component={Friend_received} options={{ headerShown: false }} />
      <Stack.Screen name="Friends" component={Friends} options={{ headerShown: false }} />
      
    </Stack.Navigator>
  );
};

const AuthStack = ({ setIsLoggedIn }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name='Permissions' component={PermissionsScreen} />
      <Stack.Screen name='Login'>
        {props => <Login {...props} setIsLoggedIn={setIsLoggedIn} />}
      </Stack.Screen>
      <Stack.Screen name='Signup'>
        {props => <Signup {...props} setIsLoggedIn={setIsLoggedIn} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

function RootNavigator() {
  const { user, setUser, setIsLoggedIn } = useContext(AuthenticatedUserContext);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const navigationRef = useNavigationContainerRef();
  const { setNavigation, startListeningForCalls, stopListeningForCalls, incomingCall, setIncomingCall } = useNotifications();

  // Set navigation ref cho NotificationContext khi sẵn sàng
  useEffect(() => {
    if (navigationRef.current) {
      setNavigation(navigationRef.current);
    }
  }, [navigationRef.current]);

  // Xử lý pending video call khi app được mở từ notification
  useEffect(() => {
    if (user && navigationRef.current && global.pendingVideoCall) {
      const pendingCall = global.pendingVideoCall;
      console.log('📞 Xử lý pending video call:', pendingCall);
      
      // Clear pending call
      global.pendingVideoCall = null;
      
      // Navigate đến VideoCall
      setTimeout(() => {
        navigationRef.current.navigate('VideoCall', {
          callerUid: pendingCall.callerId,
          recipientUid: pendingCall.recipientId,
          callerName: pendingCall.callerName,
          recipientName: null,
          recipientAvatar: null,
          isInitiator: false,
          roomId: pendingCall.roomId,
        });
      }, 500);
    }
  }, [user]);

  // Lắng nghe cuộc gọi đến khi user đăng nhập
  useEffect(() => {
    if (user && user.uid) {
      console.log('🎧 Bắt đầu lắng nghe cuộc gọi cho user:', user.uid);
      startListeningForCalls(user.uid);
    } else {
      stopListeningForCalls();
    }

    return () => {
      stopListeningForCalls();
    };
  }, [user]);

  // Xử lý khi có cuộc gọi đến - điều hướng đến màn hình VideoCall
  useEffect(() => {
    if (incomingCall && navigationRef.current && user) {
      console.log('📞 Nhận được cuộc gọi đến, điều hướng đến VideoCall:', incomingCall);
      
      // Check if VideoCall screen is already open to prevent duplicates
      const currentRoute = navigationRef.current.getCurrentRoute();
      if (currentRoute && currentRoute.name === 'VideoCall') {
        console.log('⚠️ VideoCall screen already open, skipping navigation');
        setIncomingCall(null);
        return;
      }
      
      // Navigate với đúng params theo VideoCall.js
      navigationRef.current.navigate('VideoCall', {
        callerUid: incomingCall.callerId,
        recipientUid: incomingCall.recipientId,
        callerName: incomingCall.callerName,
        recipientName: null, // Sẽ lấy từ fetchPartnerInfo
        recipientAvatar: null,
        isInitiator: false, // Người nhận cuộc gọi
        roomId: incomingCall.roomId,
      });
      
      // Reset trạng thái sau khi điều hướng
      setIncomingCall(null);
    }
  }, [incomingCall, user]);

  useEffect(() => {
    // Check if permissions have been requested before
    const checkPermissions = async () => {
      try {
        const permissionsRequested = await AsyncStorage.getItem(PERMISSIONS_KEY);
        setShowPermissions(permissionsRequested !== 'true');
        setPermissionsChecked(true);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setPermissionsChecked(true);
      }
    };
    
    checkPermissions();
  }, []);

  useEffect(() => {
    // Check saved login state first
    const checkSavedLoginState = async () => {
      try {
        const savedLoginState = await AsyncStorage.getItem(LOGIN_STATE_KEY);
        if (savedLoginState === 'true') {
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Error checking saved login state:', error);
      }
    };
    
    checkSavedLoginState();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (authenticatedUser) => {
        if (authenticatedUser) {
          // Reload user để lấy trạng thái emailVerified mới nhất
          await authenticatedUser.reload();
          
          // Kiểm tra email đã xác thực chưa
          if (authenticatedUser.emailVerified) {
            // Email đã xác thực - cho phép vào app
            setUser(authenticatedUser);
            setIsLoggedIn(true);
            await AsyncStorage.setItem(LOGIN_STATE_KEY, 'true');
            
            // SYNC: Ensure Native Firebase Auth is signed in for Realtime Database
            try {
              const nativeUser = nativeAuth().currentUser;
              if (!nativeUser) {
                // Native Auth not signed in, try to sync with ID token
                const idToken = await authenticatedUser.getIdToken();
                if (idToken) {
                  // Use custom token approach - sign in with credential
                  console.log('🔄 Syncing Native Firebase Auth...');
                  // Note: For full sync, we need stored credentials
                  // This is a best-effort sync
                }
              } else {
                console.log('✅ Native Firebase Auth already signed in:', nativeUser.uid);
              }
            } catch (syncError) {
              console.log('⚠️ Failed to check/sync Native Auth:', syncError.message);
            }
          } else {
            // Email chưa xác thực - không cho vào app
            console.log('Email chưa được xác thực, giữ ở màn hình đăng nhập');
            setUser(null);
            setIsLoggedIn(false);
            await AsyncStorage.removeItem(LOGIN_STATE_KEY);
          }
        } else {
          // User is signed out
          setUser(null);
          setIsLoggedIn(false);
          await AsyncStorage.removeItem(LOGIN_STATE_KEY);
        }
        setIsLoading(false);
      }
    );

    return unsubscribeAuth;
  }, [setUser, setIsLoggedIn]);

  if (isLoading || !permissionsChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size='large' />
      </View>
    );
  }

  // Custom setIsLoggedIn that also saves to AsyncStorage
  const handleSetIsLoggedIn = async (value) => {
    setIsLoggedIn(value);
    if (value) {
      await AsyncStorage.setItem(LOGIN_STATE_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(LOGIN_STATE_KEY);
    }
  };

  return (
    <NavigationContainer ref={navigationRef}>
      {user ? <ChatStack setIsLoggedIn={handleSetIsLoggedIn} /> : <AuthStack setIsLoggedIn={handleSetIsLoggedIn} />}
    </NavigationContainer>
  );
}

const StackNavigator = () => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <AuthenticatedUserProvider>
        <RootNavigator />
      </AuthenticatedUserProvider>
    </SafeAreaView>
  );
};

export default StackNavigator;
