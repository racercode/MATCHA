# Firebase Setup Checklist

---

## 1. 建立專案

1. 前往 [Firebase Console](https://console.firebase.google.com/) → 新增專案
2. 專案名稱：`matcha-hackathon`（或任意）
3. 關閉 Google Analytics（黑客松不需要）
4. 進入專案後，依序開啟以下服務：

---

## 2. Authentication

**Console → Build → Authentication → Sign-in method**

1. 啟用 **Anonymous**（市民與政府都用匿名登入，最快）

**建立政府帳號（手動，每個機關/資源一個）：**

政府帳號的 role 判斷靠 Firestore `/gov_staff/{uid}` 文件。
做法：
1. 讓政府端 app 匿名登入一次 → 拿到 `uid`（印出或用 Firebase Console 查）
2. 在 Firebase Console → Firestore → `/gov_staff/{uid}` → 新增文件：
   ```
   govId: "rid-001"   ← 對應到 gov_resources 的 rid
   ```
3. 以後同一個裝置 / 帳號登入都會被識別為 gov_staff

> 黑客松快速做法：直接在 Firebase Console 手動建文件，不需要後台管理頁。

---

## 3. Firestore

**Console → Build → Firestore Database → 建立資料庫 → Native mode → 選擇區域**

### Collections（無需手動建，第一次寫入時自動建立）

| Collection | 說明 |
|-----------|------|
| `personas/{uid}` | 市民 persona |
| `channel_messages/{msgId}` | PersonaAgent 廣播（觸發媒合） |
| `channel_replies/{replyId}` | GovAgent 媒合回覆 |
| `human_threads/{tid}` | Gov 開啟的真人對話 |
| `human_threads/{tid}/messages/{mid}` | 訊息子集合 |
| `peer_threads/{tid}` | CoffeeAgent 配對的 peer 對話 |
| `peer_threads/{tid}/messages/{mid}` | 訊息子集合 |
| `gov_resources/{rid}` | 政府資源（含 PDF 文字） |
| `gov_staff/{uid}` | 政府帳號，值 = `{ govId }` |

### Composite Indexes（需手動建立）

**Console → Firestore → Indexes → 複合索引 → 新增**

| Collection | 欄位 1 | 欄位 2 | Query Scope |
|-----------|--------|--------|-------------|
| `channel_messages` | `uid` ↑ | `createdAt` ↓ | Collection |
| `channel_replies` | `messageId` ↑ | `createdAt` ↓ | Collection |
| `channel_replies` | `govId` ↑ | `createdAt` ↓ | Collection |
| `human_threads` | `userId` ↑ | `createdAt` ↓ | Collection |
| `human_threads` | `govId` ↑ | `createdAt` ↓ | Collection |
| `peer_threads` | `userAId` ↑ | `createdAt` ↓ | Collection |
| `peer_threads` | `userBId` ↑ | `createdAt` ↓ | Collection |

> 也可以直接跑 query，Firebase 會在 Console 報錯並提供一鍵建立 index 的連結。

### Security Rules

**Console → Firestore → Rules → 貼入以下規則**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 全部鎖死；所有讀寫透過後端 Admin SDK（繞過 rules）
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> 後端使用 Firebase Admin SDK，自動繞過 Security Rules。前端不直接讀寫 Firestore。

---

## 4. Storage

**Console → Build → Storage → 開始使用 → 選擇區域（與 Firestore 同區）**

### 資料夾結構（自動建立）

```
gs://<bucket>/
└── gov-resources/
    └── {rid}.pdf      ← 上傳時由後端寫入
```

### Storage Rules

**Console → Storage → Rules → 貼入**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 全部鎖死；後端用 Admin SDK 上傳
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. 取得後端環境變數

**Console → 專案設定（齒輪）→ 服務帳戶 → 產生新的私密金鑰 → 下載 JSON**

將 JSON 內容轉換為以下 `.env` 格式，貼入 `services/api/.env`：

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=matcha-hackathon
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@matcha-hackathon.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=matcha-hackathon.appspot.com
```

> `FIREBASE_PRIVATE_KEY` 的換行需保留為 `\n`（不要真的換行）。

---

## 6. 取得前端環境變數

**Console → 專案設定 → 一般 → 你的應用程式 → 加入應用程式（Web / iOS / Android）→ 複製 config**

```typescript
// apps/user 和 apps/gov 共用（貼入各自的 .env）
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=matcha-hackathon.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=matcha-hackathon
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=matcha-hackathon.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## 7. 快速驗證清單

完成上述設定後，以下指令應全數通過：

```bash
# 後端啟動不報 Firebase 錯誤
pnpm --filter api dev

# POST /auth/verify 用 anonymous idToken 應回傳 role: "citizen"
curl -X POST http://localhost:3000/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<token>"}'

# Firestore 讀寫（透過後端）：POST /gov/resources 應回傳 201
```
