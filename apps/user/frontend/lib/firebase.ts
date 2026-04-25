import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  setPersistence,
  // @ts-ignore – getReactNativePersistence exists at runtime but missing from v11 types
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// isNew 必須在 initializeApp 前捕捉，否則呼叫後 getApps().length 永遠是 1
const isNew = getApps().length === 0;
const app = isNew ? initializeApp(firebaseConfig) : getApp();

export const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Auth may already be initialized; fallback to current instance.
    return getAuth(app);
  }
})();

if (Platform.OS === 'web') {
  // Keep web auth state across refreshes.
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('[Firebase] setPersistence 失敗', error?.code, error?.message);
  });
}

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
