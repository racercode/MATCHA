# Matcha API Documentation

**Base URL（本機）：** `http://localhost:3000`  
**Mock URL（開發用）：** `http://localhost:3001`  
**WebSocket：** `ws://localhost:3000/ws`

所有 REST 請求除 `/auth/verify` 外，皆需帶 `Authorization: Bearer <firebase_id_token>`。

---

## 目錄

1. [認證](#1-認證)
2. [市民 — Persona](#2-市民--persona)
3. [市民 — Swipe](#3-市民--swipe)
4. [Threads（雙側共用）](#4-threads雙側共用)
5. [政府 — 資源管理](#5-政府--資源管理)
6. [政府 — Dashboard](#6-政府--dashboard)
7. [WebSocket 事件](#7-websocket-事件)
8. [錯誤碼](#8-錯誤碼)

---

## 1. 認證

### 流程概述

所有使用者（市民 + 政府）均使用 **Firebase Anonymous Auth**，不需要 email / 密碼。

```
Client                       Firebase              Backend
  │                              │                    │
  │── signInAnonymously() ──────>│                    │
  │<── { uid, isAnonymous } ─────│                    │
  │── getIdToken() ─────────────>│                    │
  │<── idToken ──────────────────│                    │
  │── POST /auth/verify ─────────────────────────────>│
  │                              │         verify token│──> Firebase Admin
  │<─────────────────── { uid, role, agencyId } ──────│
  │                              │                    │
  │ (後續所有請求帶 Authorization: Bearer <idToken>)   │
```

**Role 判斷邏輯（後端）：**

```
Firestore /gov_staff/{uid} 存在？
  ├── Yes → role = "gov_staff"，agencyId 取自該文件
  └── No  → role = "citizen"
```

> 黑客松期間：政府帳號只需在 Firebase Console 手動建一筆 `/gov_staff/{uid}` 文件即可，不需要另設登入頁。

---

### `POST /auth/verify`

驗證 Firebase ID Token，回傳 app-level user 資料（含 role）。每次取得新 token 或 session 過期時呼叫。

**Request**
```json
{
  "idToken": "eyJhbGci..."
}
```

**Response `200` — 市民**
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "role": "citizen"
  }
}
```

**Response `200` — 政府承辦人**
```json
{
  "success": true,
  "data": {
    "uid": "gov456",
    "role": "gov_staff",
    "agencyId": "labor-dept"
  }
}
```

> `email` 和 `displayName` 在 anonymous auth 下不存在，後端不回傳。若未來要支援具名帳號，可擴充此欄位。

---

## 2. 市民 — Persona

### `GET /me/persona`

取得目前登入市民的 persona。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "displayName": "陳小明",
    "photoURL": "https://...",
    "summary": "正在尋找就業輔導和職業培訓資源的年輕人",
    "tags": ["就業", "職訓", "青年"],
    "needs": ["就業輔導", "職業培訓"],
    "offers": ["軟體開發經驗", "社區志工"],
    "updatedAt": 1714000000000
  }
}
```

---

### `POST /me/chat`

向 Persona Agent 發送訊息，以 **SSE streaming** 回傳 agent 回應。

**Request**
```json
{
  "content": "我最近在找工作，但不知道有哪些政府補助"
}
```

**Response** — `Content-Type: text/event-stream`

每個 chunk 為一個 SSE data 行，payload 為 `ServerEvent` JSON：

```
data: {"type":"agent_reply","content":"我來幫你","done":false}

data: {"type":"agent_reply","content":"了解你的情況。","done":false}

data: {"type":"agent_reply","content":"","done":true}
```

> `done: true` 表示這次回應結束，content 為空字串。  
> Agent 可能在 streaming 中插入 `swipe_card` 事件（見 §7）。

---

## 3. 市民 — Swipe

### `POST /me/swipe`

提交 swipe 選擇，Agent 更新 persona 並可能回傳下一張卡。

**Request**
```json
{
  "cardId": "card-001",
  "direction": "right",
  "value": "has_stable_housing"
}
```

**Response `200`** — 回傳下一張卡（或 `null` 表示本輪結束）
```json
{
  "success": true,
  "data": {
    "cardId": "card-002",
    "question": "你目前是否有穩定收入？",
    "leftLabel": "沒有",
    "rightLabel": "有",
    "leftValue": "no_income",
    "rightValue": "has_income"
  }
}
```

---

## 4. Threads（雙側共用）

`gov_user` 類型的 thread 由 Gov Agent 發起；`user_user` 類型由 Coffee Agent 發起。  
市民端和政府端使用相同端點，後端依 token 的 role 決定可視範圍。

---

### `GET /threads`

列出當前使用者相關的所有 threads。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `type` | `"gov_user" \| "user_user"` | 篩選 thread 類型（選填） |
| `status` | `ThreadStatus` | 篩選狀態（選填） |
| `limit` | number | 每頁筆數，預設 20 |
| `offset` | number | 分頁偏移，預設 0 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tid": "tid-001",
        "type": "gov_user",
        "initiatorId": "gov:rid-001",
        "responderId": "user:abc123",
        "status": "negotiating",
        "matchScore": 82,
        "userPresence": "agent",
        "govPresence": "agent",
        "createdAt": 1714000000000,
        "updatedAt": 1714003600000
      }
    ],
    "total": 1,
    "hasMore": false
  }
}
```

---

### `GET /threads/:tid`

取得單一 thread 詳情。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "tid": "tid-001",
    "type": "gov_user",
    "initiatorId": "gov:rid-001",
    "responderId": "user:abc123",
    "status": "negotiating",
    "matchScore": 82,
    "summary": null,
    "userPresence": "agent",
    "govPresence": "agent",
    "createdAt": 1714000000000,
    "updatedAt": 1714003600000
  }
}
```

---

### `GET /threads/:tid/messages`

取得 thread 的訊息列表（時間正序）。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `limit` | number | 每頁筆數，預設 50 |
| `before` | number | unix ms，取此時間點之前的訊息 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "mid": "msg-001",
        "tid": "tid-001",
        "from": "gov_agent:rid-001",
        "type": "query",
        "content": {
          "text": "根據你的 persona，你是否目前正在求職中？"
        },
        "createdAt": 1714000000000
      },
      {
        "mid": "msg-002",
        "tid": "tid-001",
        "from": "persona_agent:abc123",
        "type": "answer",
        "content": {
          "text": "是的，我正在積極找工作。"
        },
        "createdAt": 1714000060000
      }
    ],
    "total": 2,
    "hasMore": false
  }
}
```

---

### `POST /threads/:tid/message`

真人在 thread 中發送訊息（需先 join）。

**Request**
```json
{
  "content": "你好，我有幾個問題想直接問承辦人"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "mid": "msg-003",
    "tid": "tid-001",
    "from": "human:abc123",
    "type": "human_note",
    "content": { "text": "你好，我有幾個問題想直接問承辦人" },
    "createdAt": 1714003700000
  }
}
```

---

### `POST /threads/:tid/join`

真人加入 thread，對應側的 presence 切換為 `"human"`，Agent 進入被動模式。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "tid": "tid-001",
    "userPresence": "human",
    "govPresence": "agent"
  }
}
```

> 所有連線到此 thread 的 WebSocket client 會收到 `presence_update` 事件。

---

### `POST /threads/:tid/leave`

真人離開 thread，presence 切回 `"agent"`，Agent 恢復主動。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "tid": "tid-001",
    "userPresence": "agent",
    "govPresence": "agent"
  }
}
```

---

## 5. 政府 — 資源管理

### `GET /gov/resources`

列出本機關的所有資源（需 `gov_staff` role）。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "rid": "rid-001",
        "agencyId": "labor-dept",
        "agencyName": "勞動部",
        "name": "青年就業促進計畫",
        "description": "提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢",
        "eligibilityCriteria": ["年齡 18–29 歲", "具中華民國國籍", "非在學中"],
        "tags": ["就業", "青年", "補助"],
        "contactUrl": "https://www.mol.gov.tw",
        "createdAt": 1714000000000
      }
    ],
    "total": 1,
    "hasMore": false
  }
}
```

---

### `POST /gov/resources`

新增政府資源（需 `gov_staff` role）。  
後端會以此資源的 `description` 和 `eligibilityCriteria` 初始化對應的 Gov Agent。

**Request**
```json
{
  "name": "青年就業促進計畫",
  "description": "提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢",
  "eligibilityCriteria": ["年齡 18–29 歲", "具中華民國國籍", "非在學中"],
  "tags": ["就業", "青年", "補助"],
  "contactUrl": "https://www.mol.gov.tw"
}
```

**Response `201`**
```json
{
  "success": true,
  "data": {
    "rid": "rid-002",
    "agencyId": "labor-dept",
    "agencyName": "勞動部",
    "name": "青年就業促進計畫",
    "description": "...",
    "eligibilityCriteria": ["..."],
    "tags": ["就業", "青年", "補助"],
    "contactUrl": "https://www.mol.gov.tw",
    "createdAt": 1714010000000
  }
}
```

---

## 6. 政府 — Dashboard

### `GET /gov/threads`

列出本機關所有 threads（需 `gov_staff` role）。  
Query params 同 `GET /threads`。

---

### `GET /gov/dashboard`

取得媒合統計數據（需 `gov_staff` role）。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `since` | number | unix ms，統計起始時間，預設最近 7 天 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "totalMatches": 47,
    "humanTakeoverCount": 11,
    "activeThreads": 8,
    "matchedToday": 6,
    "tagDistribution": {
      "就業": 20,
      "青年": 15,
      "補助": 10,
      "住宅": 5
    },
    "needsDistribution": {
      "就業輔導": 18,
      "職業培訓": 14,
      "法律協助": 7
    }
  }
}
```

---

## 7. WebSocket 事件

連線端點：`ws://localhost:3000/ws`  
Header 需帶 `Authorization: Bearer <firebase_id_token>`（或 query param `?token=...`）。

---

### Client → Server

| `type` | 說明 |
|--------|------|
| `chat_message` | 向 Persona Agent 發送訊息 |
| `swipe` | 提交 swipe 選擇 |
| `human_join` | 真人加入指定 thread |
| `human_leave` | 真人離開指定 thread |
| `thread_message` | 在 thread 中發送真人訊息 |

```jsonc
// chat_message
{ "type": "chat_message", "content": "我需要幫助" }

// swipe
{ "type": "swipe", "cardId": "card-001", "direction": "right", "value": "has_income" }

// human_join / human_leave
{ "type": "human_join", "threadId": "tid-001" }
{ "type": "human_leave", "threadId": "tid-001" }

// thread_message
{ "type": "thread_message", "threadId": "tid-001", "content": "請問申請期限是什麼時候？" }
```

---

### Server → Client

| `type` | 觸發時機 |
|--------|----------|
| `agent_reply` | Persona Agent streaming 回應（每個 chunk 一次） |
| `swipe_card` | Agent 決定要問 swipe 問題時 |
| `match_notify` | Gov Agent 發起媒合，通知市民 |
| `peer_notify` | Coffee Agent 找到配對，通知雙方市民 |
| `thread_update` | Thread 狀態變更（status / matchScore） |
| `thread_message` | Thread 中有新訊息 |
| `presence_update` | 任一側 presence 狀態改變 |
| `persona_updated` | Persona Agent 更新了 persona |
| `error` | 任何錯誤 |

```jsonc
// agent_reply（streaming chunk）
{ "type": "agent_reply", "content": "根據你的情況", "done": false }
{ "type": "agent_reply", "content": "", "done": true }

// swipe_card
{
  "type": "swipe_card",
  "card": {
    "cardId": "card-001",
    "question": "你目前是否有穩定收入？",
    "leftLabel": "沒有",
    "rightLabel": "有",
    "leftValue": "no_income",
    "rightValue": "has_income"
  }
}

// match_notify（Gov Agent 媒合）
{
  "type": "match_notify",
  "thread": { "tid": "tid-001", "type": "gov_user", "status": "negotiating", "matchScore": 85, ... },
  "resource": { "rid": "rid-001", "name": "青年就業促進計畫", "agencyName": "勞動部", ... }
}

// peer_notify（Coffee Chat 配對）
{
  "type": "peer_notify",
  "thread": { "tid": "tid-002", "type": "user_user", "status": "negotiating", ... },
  "peer": {
    "uid": "uid-002",
    "displayName": "林小華",
    "summary": "對社會企業有興趣的青年",
    "tags": ["社會企業", "青年"],
    "commonTags": ["青年"]
  }
}

// presence_update
{ "type": "presence_update", "threadId": "tid-001", "side": "user", "state": "human" }

// persona_updated
{ "type": "persona_updated", "persona": { "uid": "abc123", "tags": [...], ... } }

// error
{ "type": "error", "code": "SESSION_EXPIRED", "message": "請重新登入" }
```

---

## 8. 錯誤碼

所有錯誤回傳統一格式：

```json
{
  "success": false,
  "error": "說明文字",
  "data": null
}
```

| HTTP 狀態 | 說明 |
|-----------|------|
| `400` | 請求格式錯誤、缺少必要欄位 |
| `401` | 未帶 token 或 token 無效 / 過期 |
| `403` | 權限不足（如市民存取 `/gov/*`） |
| `404` | 資源不存在（thread、resource） |
| `429` | 呼叫 Claude API 頻率過高 |
| `500` | 伺服器內部錯誤 |

| WebSocket 錯誤碼 | 說明 |
|------------------|------|
| `AUTH_FAILED` | WebSocket 連線認證失敗 |
| `SESSION_EXPIRED` | Claude session 過期，需重建 |
| `AGENT_BUSY` | Agent 正在處理其他請求 |
| `THREAD_NOT_FOUND` | 指定的 thread 不存在 |

---

## 附錄：Presence 狀態矩陣

| userPresence | govPresence / peerPresence | 行為 |
|---|---|---|
| `agent` | `agent` | 雙方 Agent 自主協商 |
| `human` | `agent` | 市民直接打字，對側 Agent 回應 |
| `agent` | `human` | Persona Agent 回應，對側真人打字 |
| `human` | `human` | 雙方靜音，Agent 不主動發言（除非被 @ 標記） |
