import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB56q0rIYvt9KbDVFkqysdDKeq6HunrBkA",
  authDomain: "chatlofi-9c2c8.firebaseapp.com",
  projectId: "chatlofi-9c2c8",
  storageBucket: "chatlofi-9c2c8.appspot.com",
  messagingSenderId: "901109384021",
  appId: "1:901109384021:web:e8c72a03840424509625dc",
  measurementId: "G-L0TG3RV89H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth với AsyncStorage persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const firestore = getFirestore(app);
export const storage = getStorage(app);
