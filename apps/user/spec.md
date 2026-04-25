# Spec: Expo 專案建立 + Firebase Auth 登入頁

> Milestone 1 / Group A — Day 1 AM

---

## 目標

建立 React Native + Expo Go 的專案骨架，並實作 Firebase Email/Password 登入，取得 `user.uid` 供後續所有 API 呼叫使用。

---

## 技術決策

| 項目 | 選擇 | 原因 |
|------|------|------|
| Auth SDK | Firebase Web SDK (`firebase` npm) | Expo Go 不支援原生模組，**絕對不能裝 `@react-native-firebase`** |
| Auth 方式 | Email / Password (`signInWithEmailAndPassword`) | 黑客松最快，無需 OAuth redirect 設定 |
| Auth 持久化 | `getReactNativePersistence(AsyncStorage)` | Web SDK 預設用 localStorage，RN 環境需換成 AsyncStorage |
| 樣式 | NativeWind v4 (TailwindCSS) | 參考 wvs_project50 同一套 |
| 路由 | Expo Router v4（file-based） | 參考 wvs_project50 同一套 |

---

## 套件安裝

```bash
# Firebase Web SDK（唯一正確選擇）
npx expo install firebase

# 持久化 Auth 狀態
npx expo install @react-native-async-storage/async-storage

# 其餘 UI 相關（wvs_project50 已有，確認即可）
npx expo install expo-linear-gradient
npx expo install expo-splash-screen
npx expo install expo-font
npx expo install nativewind tailwindcss
```

---

## Firebase 設定

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAtFQJAat8HBmvnSxu6KbMkmLbs0Es15Ss
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=matcha-4cd9d.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://matcha-4cd9d-default-rtdb.asia-southeast1.firebasedatabase.app/
EXPO_PUBLIC_FIREBASE_PROJECT_ID=matcha-4cd9d
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=matcha-4cd9d.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=208475695905
EXPO_PUBLIC_FIREBASE_APP_ID=1:208475695905:web:fd6447019b5eb0d35dec60
```

儲存為 `apps/user/.env.local`（已加入 `.gitignore`）。

---

## 目錄結構

```
apps/user/
├── .env.local
├── app.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css
├── app/
│   ├── _layout.tsx          ← Root layout：包 AuthProvider，處理 splash + 字型
│   ├── +not-found.tsx
│   ├── signin.tsx           ← 登入頁 entry point
│   └── (tabs)/
│       ├── _layout.tsx      ← Tab bar（Milestone 1 只要一個 tab 佔位）
│       └── index.tsx        ← 登入後首頁（佔位，Milestone 2 再實作）
├── components/
│   └── LoginScreen.tsx      ← 登入 UI（漸層背景 + email/password 輸入框 + 按鈕）
├── containers/
│   └── hooks/
│       └── useAuth.tsx      ← Firebase Auth context（核心）
├── lib/
│   └── firebase.ts          ← Firebase 初始化（app / auth / db / rtdb）
└── constants/
    └── Colors.ts            ← 同 wvs_project50 色票
```

---

## 檔案規格

### `lib/firebase.ts`

初始化 Firebase app，並匯出 `auth`、`db`（Firestore）、`rtdb`（Realtime DB）。

**關鍵細節：**
- 使用 `initializeAuth` + `getReactNativePersistence(AsyncStorage)` 取代 `getAuth()`，否則 App 重啟後登入狀態會消失。
- 以 `process.env.EXPO_PUBLIC_*` 讀取金鑰，不寫死在程式碼裡。
- 用 `getApp` guard 防止 HMR 造成重複初始化（`if (getApps().length === 0)`）。

```typescript
// lib/firebase.ts
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

### `containers/hooks/useAuth.tsx`

Firebase Auth 的 Context，對標 wvs_project50 的 `useSocial.tsx`，但更精簡。

**狀態：**

| 狀態 | 型別 | 說明 |
|------|------|------|
| `user` | `User \| null` | Firebase User 物件（含 `.uid`） |
| `isInitialized` | `boolean` | `onAuthStateChanged` 首次回呼完成 |
| `loadingMessage` | `string \| undefined` | 給 Loading overlay 使用 |

**方法：**

| 方法 | 說明 |
|------|------|
| `signIn(email, password)` | 呼叫 `signInWithEmailAndPassword`，設 loadingMessage |
| `signOut()` | 呼叫 `signOut(auth)`，清狀態 |

**Auth 狀態同步：**
- `useEffect` 內呼叫 `onAuthStateChanged(auth, callback)` 監聽。
- 首次回呼觸發時設 `isInitialized = true`。
- cleanup 時呼叫 unsubscribe。

```typescript
// 介面定義（不是完整實作）
type AuthContextType = {
  user: User | null;
  isInitialized: boolean;
  loadingMessage: string | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
```

---

### `app/_layout.tsx`

Root layout，對標 wvs_project50 的 `_layout.tsx`。

**職責：**
1. 載入字型（SpaceMono）+ Splash Screen 控制（同 wvs_project50）。
2. 包裹 `<AuthProvider>`。
3. 包裹 `<SafeAreaProvider>` + `<ThemeProvider>`。
4. 定義 Stack screens：`(tabs)` / `signin`（`headerShown: false`）。

---

### `app/signin.tsx`

Entry point，只 render `<LoginScreen />`（對標 wvs_project50 的 `signin.tsx`）。

**導航邏輯在 `LoginScreen` 內：**
- `isInitialized && user != null` → `router.replace('/')`。

---

### `components/LoginScreen.tsx`

登入 UI，對標 wvs_project50 的 `SingIn.tsx` + `Login.tsx` 合體版，但改用 Firebase。

**UI 規格（模仿 wvs_project50 風格）：**

```
┌─────────────────────────────────┐
│  LinearGradient (#65A1FB → white)│
│                                 │
│         [MATCHA LOGO / 文字]     │
│                                 │
│   ┌─────────────────────────┐   │
│   │  Email input             │   │
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │  Password input          │   │
│   └─────────────────────────┘   │
│                                 │
│         [  登入  ] (Button)      │
│                                 │
│    (若 loadingMessage) overlay   │
└─────────────────────────────────┘
```

**行為：**
- `signIn(email, password)` 呼叫 `useAuth` 的 `signIn`。
- 錯誤用 `Alert.alert` 顯示（黑客松夠用）。
- `isInitialized && user` → `router.replace('/')`（useEffect）。
- `!isInitialized` → 顯示 Loading（同 wvs_project50 `<Loading />`）。

**輸入框：**
- 用 `ThemedTextInput`（同 wvs_project50 `components/ThemedTextInput.tsx` 複製過來）。
- Password input：`secureTextEntry`。

---

### `app/(tabs)/_layout.tsx`

Milestone 1 只需一個 tab（佔位），之後 Milestone 2/3 再加。

```
Tabs:
  - index  →  "首頁" icon: house.fill （Milestone 1 佔位）
```

---

### `app/(tabs)/index.tsx`

登入後的首頁佔位頁，顯示 `user.email` 和 `user.uid` 確認登入成功，以及一個「登出」按鈕。

---

## Auth 流程圖

```
App 啟動
  │
  ▼
onAuthStateChanged 監聽啟動
  │
  ├── isInitialized = false → 顯示 Splash / Loading
  │
  ▼
首次 callback 觸發 → isInitialized = true
  │
  ├── user != null → router.replace('/')  → (tabs)
  │
  └── user == null → router.replace('/signin')
                          │
                    使用者輸入 email + password
                          │
                    signInWithEmailAndPassword
                          │
                    成功 → onAuthStateChanged 觸發
                          → user 更新 → router.replace('/')
                          │
                    失敗 → Alert.alert 顯示錯誤
```

---

## 驗收標準

- [ ] `npx expo start` 後 Expo Go 掃碼可正常開啟，無紅畫面
- [ ] 冷啟動時顯示 Splash，`onAuthStateChanged` 完成後才隱藏
- [ ] 未登入時自動導向 `/signin`
- [ ] 輸入正確 email / password → 登入成功 → 進入首頁 tab
- [ ] 首頁顯示 `user.uid`（確認 uid 可被後端使用）
- [ ] 點「登出」→ 回到 `/signin`
- [ ] App 重啟後若已登入，直接進首頁（AsyncStorage 持久化正常）
- [ ] 輸入錯誤密碼 → Alert 顯示錯誤訊息，不 crash

---

## 常見地雷

| 地雷 | 正確做法 |
|------|----------|
| 裝了 `@react-native-firebase` | 只裝 `firebase`（Web SDK） |
| `getAuth(app)` 在 RN 環境 | 改用 `initializeAuth` + `getReactNativePersistence` |
| 金鑰直接寫在程式碼 | 放 `.env.local`，用 `EXPO_PUBLIC_` prefix |
| 重複呼叫 `initializeApp` | 用 `getApps().length === 0` guard |
| HMR 時 auth 重新初始化 | 同上 guard |
