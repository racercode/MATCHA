# Plan: Expo 專案建立 + Firebase Auth 登入頁

> 對應 spec.md Milestone 1

---

## Step 1 — 建立 Expo 專案骨架

```bash
cd apps/user
npx create-expo-app . --template blank-typescript
```

完成後確認以下檔案存在：
- `app.json`
- `package.json`
- `tsconfig.json`
- `babel.config.js`
- `app/_layout.tsx`
- `app/index.tsx`

---

## Step 2 — 安裝套件

```bash
# Firebase Web SDK
npx expo install firebase

# Auth 持久化
npx expo install @react-native-async-storage/async-storage

# UI
npx expo install expo-linear-gradient
npx expo install nativewind tailwindcss
npx expo install expo-font expo-splash-screen expo-status-bar
npx expo install expo-constants react-native-safe-area-context
```

---

## Step 3 — 設定 NativeWind（對照 wvs_project50）

**`tailwind.config.js`**
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
```

**`global.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`babel.config.js`**
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

**`metro.config.js`**
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

---

## Step 4 — 建立 `.env.local`

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAtFQJAat8HBmvnSxu6KbMkmLbs0Es15Ss
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=matcha-4cd9d.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://matcha-4cd9d-default-rtdb.asia-southeast1.firebasedatabase.app/
EXPO_PUBLIC_FIREBASE_PROJECT_ID=matcha-4cd9d
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=matcha-4cd9d.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=208475695905
EXPO_PUBLIC_FIREBASE_APP_ID=1:208475695905:web:fd6447019b5eb0d35dec60
```

確認 `.gitignore` 有 `.env.local`。

---

## Step 5 — `lib/firebase.ts`

建立 `lib/firebase.ts`，初始化 Firebase app、auth、db、rtdb。

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
```

---

## Step 6 — `containers/hooks/useAuth.tsx`

建立 Auth Context，對標 wvs_project50 的 `useSocial.tsx`。

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthContextType = {
  user: User | null;
  isInitialized: boolean;
  loadingMessage: string | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsInitialized(true);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoadingMessage('登入中...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setLoadingMessage(undefined);
    }
  };

  const signOut = async () => {
    setLoadingMessage('登出中...');
    try {
      await firebaseSignOut(auth);
    } finally {
      setLoadingMessage(undefined);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isInitialized, loadingMessage, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

---

## Step 7 — `components/Loading.tsx`

從 wvs_project50 複製 `Loading.tsx`，或自行建立最簡版：

```typescript
import { View, ActivityIndicator, Text } from 'react-native';

const Loading = ({ text = '載入中...' }: { text?: string }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" />
    {text ? <Text style={{ marginTop: 8 }}>{text}</Text> : null}
  </View>
);

export default Loading;
```

---

## Step 8 — `components/LoginScreen.tsx`

登入 UI，漸層背景 + email / password 輸入 + 登入按鈕，對標 wvs_project50 的 `Login.tsx` 風格。

```typescript
import { useState, useEffect } from 'react';
import { View, TextInput, Alert, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/containers/hooks/useAuth';
import Loading from '@/components/Loading';

const LoginScreen = () => {
  const { user, isInitialized, loadingMessage, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isInitialized && user) {
      router.replace('/');
    }
  }, [isInitialized, user]);

  if (!isInitialized) return <Loading />;

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('請輸入 Email 和密碼');
      return;
    }
    try {
      await signIn(email, password);
    } catch (e: any) {
      Alert.alert('登入失敗', e.message);
    }
  };

  return (
    <>
      {loadingMessage && <Loading text={loadingMessage} />}
      <LinearGradient colors={['#65A1FB', '#F9FBFF']} style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Matcha</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="密碼"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {/* 對標 wvs_project50 CustomButton 風格 */}
          <View style={styles.button}>
            <Text style={styles.buttonText} onPress={handleSignIn}>登入</Text>
          </View>
        </View>
      </LinearGradient>
    </>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  input: {
    width: 280, height: 48, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 16, fontSize: 15,
  },
  button: {
    marginTop: 8, width: 120, height: 48, backgroundColor: '#2563EB',
    borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

---

## Step 9 — `app/signin.tsx`

```typescript
import LoginScreen from '@/components/LoginScreen';

export default function SignInPage() {
  return <LoginScreen />;
}
```

---

## Step 10 — `app/_layout.tsx`

```typescript
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/containers/hooks/useAuth';
import '@/global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="signin" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

---

## Step 11 — `app/(tabs)/_layout.tsx`

Milestone 1 只需一個 tab 佔位：

```typescript
import { Tabs } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          tabBarIcon: ({ color }) => (
            <IconSymbol name="house.fill" color={color} size={28} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## Step 12 — `app/(tabs)/index.tsx`

登入後首頁，顯示 uid 確認成功，並提供登出按鈕：

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/containers/hooks/useAuth';

export default function HomeScreen() {
  const { user, isInitialized, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !user) {
      router.replace('/signin');
    }
  }, [isInitialized, user]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>登入成功</Text>
      <Text style={styles.uid}>uid: {user?.uid}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>登出</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16 },
  label: { fontSize: 24, fontWeight: 'bold' },
  uid: { fontSize: 12, color: '#666' },
  email: { fontSize: 16 },
  button: {
    marginTop: 24, paddingHorizontal: 32, paddingVertical: 12,
    backgroundColor: '#EF4444', borderRadius: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
```

---

## Step 13 — 驗收測試

按順序手動測試：

1. `npx expo start` → Expo Go 掃碼 → 無紅畫面
2. 冷啟動 → 未登入 → 自動到 `/signin`
3. 輸入正確帳密 → 成功 → 首頁顯示 uid
4. 點登出 → 回 `/signin`
5. 重啟 App → 已登入 → 直接到首頁（持久化）
6. 輸入錯誤密碼 → Alert 顯示錯誤，不 crash

全部通過 → Milestone 1 完成，可以開始 Milestone 2（Persona Chat UI）。
