# Matcha API Documentation

**Base URL（本機）：** `http://localhost:3000`  
**Mock URL（開發用）：** `http://localhost:3001`  
**WebSocket：** `ws://localhost:3000/ws`

除 `/auth/verify` 外，所有 REST 請求需帶：
```
Authorization: Bearer <firebase_id_token>
```

---

## 目錄

1. [認證](#1-認證)
2. [市民 — Persona Chat](#2-市民--persona-chat)
3. [市民 — Match Inbox（Polling）](#3-市民--match-inboxpolling)
4. [市民 — Peer Threads（Coffee Chat）](#4-市民--peer-threadscoffee-chat)
5. [市民 — Human Threads](#5-市民--human-threads)
6. [政府 — Channel Replies & Dashboard](#6-政府--channel-replies--dashboard)
7. [政府 — Human Threads](#7-政府--human-threads)
8. [政府 — 資源管理](#8-政府--資源管理)
9. [WebSocket 事件](#9-websocket-事件)
10. [錯誤格式](#10-錯誤格式)

---

## 1. 認證

### 流程

所有使用者（市民 + 政府）均使用 **Firebase Anonymous Auth**。

```
Client                       Firebase              Backend
  │── signInAnonymously() ──────>│
  │<── idToken ──────────────────│
  │── POST /auth/verify { idToken } ────────────────>│
  │                                     verify token │──> Firebase Admin SDK
  │<─────────────── { uid, role, govId? } ───────────│
```

後端 role 判斷：檢查 Firestore `/gov_staff/{uid}` 是否存在。存在則 `role = "gov_staff"`，`govId` 取自文件欄位；否則 `role = "citizen"`。

---

### `POST /auth/verify`

**Request body**
```json
{ "idToken": "eyJhbGci..." }
```

**Response `200` — 市民**
```json
{
  "success": true,
  "data": { "uid": "abc123", "role": "citizen" }
}
```

**Response `200` — 政府**
```json
{
  "success": true,
  "data": { "uid": "gov456", "role": "gov_staff", "govId": "rid-001" }
}
```

---

## 2. 市民 — Persona Chat

Persona Chat 完全透過 WebSocket 進行（見 §9）。
此 REST 端點僅供讀取目前的 persona 快照。

---

### `GET /me/persona`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "displayName": "陳小明",
    "photoURL": "https://...",
    "summary": "正在尋找就業輔導和職業培訓資源的年輕人",
    "needs": ["就業輔導", "職業培訓"],
    "offers": ["軟體開發經驗", "社區志工"],
    "updatedAt": 1714000000000
  }
}
```

**Response `200` — 尚未建立**
```json
{ "success": true, "data": null }
```

---

## 3. 市民 — Match Inbox（Polling）

GovAgent 回覆廣播後，市民定期呼叫此端點查看新增的媒合回覆。
**不使用 WebSocket push；由客戶端自行決定 polling 頻率（建議 10–30 秒）。**

---

### `GET /me/channel-replies`

列出所有 GovAgent 對我廣播的回覆。後端做兩步查詢：
1. 取得我的所有 `channel_messages` msgId
2. 查詢 `channel_replies` 中 `messageId in [msgIds]`

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `since` | number (unix ms) | 只回傳此時間之後的回覆（選填，用於增量 polling） |
| `limit` | number | 預設 20 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "replyId": "r-001",
        "messageId": "m-001",
        "govId": "rid-001",
        "govName": "青年就業促進計畫",
        "content": "你的背景非常符合本計畫的資格：年齡符合、有就業需求。建議申請。",
        "matchScore": 87,
        "createdAt": 1714001000000
      }
    ],
    "hasMore": false
  }
}
```

---

## 4. 市民 — Peer Threads（Coffee Chat）

CoffeeAgent 配對後建立 PeerThread，雙方定期 polling 發現；進入對話後透過 WebSocket 即時傳訊。

---

### `GET /me/peer-threads`

列出我參與的所有 peer threads。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `since` | number (unix ms) | 增量 polling 用（選填） |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tid": "pt-001",
        "type": "user_user",
        "peer": {
          "uid": "uid-xyz",
          "displayName": "林小華",
          "summary": "對社會企業有興趣的青年，正在尋找同伴"
        },
        "matchRationale": "兩人都對青年創業有興趣，且都缺乏資金與資源連結",
        "status": "active",
        "createdAt": 1714002000000,
        "updatedAt": 1714002000000
      }
    ],
    "hasMore": false
  }
}
```

---

### `GET /peer-threads/:tid/messages`

取得 peer thread 歷史訊息（時間正序）。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `before` | number (unix ms) | 向前翻頁（選填） |
| `limit` | number | 預設 50 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "mid": "pm-001",
        "from": "coffee_agent",
        "content": "你們兩位都對青年創業感興趣，我來介紹一下彼此！林小華目前在尋找共同創業夥伴。",
        "createdAt": 1714002000000
      },
      {
        "mid": "pm-002",
        "from": "user:uid-xyz",
        "content": "你好！我也在找有軟體背景的夥伴",
        "createdAt": 1714002060000
      }
    ],
    "hasMore": false
  }
}
```

> 發送訊息透過 WS `peer_message` 事件（見 §9）；CoffeeAgent 代理後會以 WS push 回傳。

---

## 5. 市民 — Human Threads

Gov 主動開啟後建立，市民定期 polling 發現；進入後透過 WebSocket 即時對話。

---

### `GET /me/human-threads`

列出 gov 為我開啟的所有 human threads。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `since` | number (unix ms) | 增量 polling 用（選填） |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tid": "ht-001",
        "type": "gov_user",
        "govId": "rid-001",
        "govName": "青年就業促進計畫",
        "channelReplyId": "r-001",
        "matchScore": 87,
        "status": "open",
        "createdAt": 1714003000000,
        "updatedAt": 1714003000000
      }
    ],
    "hasMore": false
  }
}
```

---

### `GET /human-threads/:tid/messages`

取得 human thread 歷史訊息。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "mid": "hm-001",
        "from": "gov_staff:gov456",
        "content": "你好！我是勞動部的承辦人，看到你的申請需求，想進一步了解你的狀況。",
        "createdAt": 1714003000000
      }
    ],
    "hasMore": false
  }
}
```

> 發送訊息透過 WS `human_message` 事件（見 §9）。

---

## 6. 政府 — Channel Replies & Dashboard

---

### `POST /gov/agent/run`

開發 / demo 用 endpoint，用來模擬「Persona Agent 發布新的 channel message 後，觸發 Gov Agent 判斷媒合」。

正式接 Firebase listener 後，後端可以直接呼叫同一段 Gov Agent pipeline，不一定要透過 HTTP 呼叫這支 API。

**Request body — 單一 channel message**
```json
{
  "resourceId": "rid-design-intern-002",
  "message": {
    "msgId": "msg-001",
    "uid": "user-xiaoya-001",
    "summary": "中文系大三，對品牌設計、排版和文組轉職有興趣，目前想找實習或職涯探索資源。",
    "publishedAt": 1714000000000
  }
}
```

Persona Agent 應傳 channel 實際資料形狀，也就是：

```ts
interface ChannelMessage {
  msgId: string
  uid: string
  summary: string
  publishedAt: number
}
```

後端會直接把這筆 channel message 交給 Gov Agent pipeline。Phase 2 不再額外建立 broadcast 正規化層。

**Request body — smoke test**

不傳 `message` 時，後端會跑全部 fake channel messages：

```json
{
  "resourceId": "rid-design-intern-002"
}
```

`broadcast` 欄位仍暫時相容舊版 Phase 2 文件，但 demo / Persona Agent 應改傳 `message`。

不傳 `resourceId` 時，後端會跑該 agency 的全部 fake resources。

**Optional fields**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `resourceId` | string | 指定要測試哪一個 Resource Agent；省略時跑該 agency 的 fake resources |
| `agencyId` | string | 當 authenticated gov staff 沒有 agencyId 時使用；預設 `taipei-youth-dept` |
| `threshold` | number | 媒合分數門檻，0–100，預設 70 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "trigger": "channel_message",
    "agencyId": "taipei-youth-dept",
    "resourceIds": ["rid-design-intern-002"],
    "threshold": 70,
    "matches": [
      {
        "thread": {
          "tid": "tid-gov-rid-design-intern-002-user-xiaoya-001",
          "type": "gov_user",
          "matchScore": 90
        },
        "initialMessage": {
          "mid": "msg-gov-rid-design-intern-002-user-xiaoya-001",
          "type": "decision",
          "from": "gov_agent:rid-design-intern-002"
        },
        "reason": "使用者明確提到品牌設計、排版與實習需求，符合創意產業實習媒合計畫的服務對象。",
        "missingInfo": ["是否可投入至少兩個月實習"]
      }
    ]
  }
}
```

**Errors**

| 狀態碼 | 情境 |
|------|------|
| `400` | `message` 缺少 `msgId`、`uid` 或 `summary`，或 `threshold` 不是 0–100 整數 |
| `404` | 找不到指定 `resourceId`，或該 agency 沒有 fake resources |
| `500` | Gov Agent session 初始化或 pipeline 執行失敗 |

---

### `GET /gov/channel-replies`

列出 GovAgent 發出的所有媒合回覆，並 join 市民 summary 供 Dashboard 顯示。
**[POLL]** — 政府端定期呼叫更新 Dashboard。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `since` | number (unix ms) | 增量 polling（選填） |
| `minScore` | number | 最低 matchScore 篩選（選填） |
| `limit` | number | 預設 20 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "replyId": "r-001",
        "messageId": "m-001",
        "govId": "rid-001",
        "content": "你的背景非常符合本計畫的資格...",
        "matchScore": 87,
        "createdAt": 1714001000000,
        "citizen": {
          "uid": "abc123",
          "summary": "正在尋找就業輔導和職業培訓資源的年輕人",
          "displayName": "陳小明"
        },
        "humanThreadOpened": false
      }
    ],
    "hasMore": false
  }
}
```

---

### `POST /gov/channel-replies/:replyId/open`

政府承辦人決定對某筆媒合開啟真人對話，建立 HumanThread。
同一筆 `replyId` 只能 open 一次（重複呼叫回傳既有 thread）。

**Response `201`**
```json
{
  "success": true,
  "data": {
    "tid": "ht-001",
    "type": "gov_user",
    "userId": "abc123",
    "govId": "rid-001",
    "channelReplyId": "r-001",
    "matchScore": 87,
    "status": "open",
    "createdAt": 1714003000000,
    "updatedAt": 1714003000000
  }
}
```

---

### `GET /gov/dashboard`

媒合統計。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `since` | number (unix ms) | 統計起始，預設最近 7 天 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "totalReplies": 47,
    "avgMatchScore": 72.4,
    "openedConversations": 11,
    "openRate": 0.23,
    "scoreDistribution": {
      "90-100": 5,
      "70-89": 22,
      "50-69": 15,
      "0-49": 5
    }
  }
}
```

---

## 7. 政府 — Human Threads

---

### `GET /gov/human-threads`

列出我（gov_staff）開啟的所有 human threads。

**Response `200`** — 結構同 `GET /me/human-threads`，但 citizen 欄位換為 gov 側視角：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tid": "ht-001",
        "type": "gov_user",
        "govId": "rid-001",
        "channelReplyId": "r-001",
        "matchScore": 87,
        "status": "open",
        "createdAt": 1714003000000,
        "updatedAt": 1714003600000,
        "citizen": {
          "uid": "abc123",
          "displayName": "陳小明",
          "summary": "正在尋找就業輔導..."
        }
      }
    ],
    "hasMore": false
  }
}
```

---

### `GET /human-threads/:tid/messages`

同市民側，端點共用。後端驗證呼叫者是 thread 的 userId 或對應 govId。

---

## 8. 政府 — 資源管理

---

### `GET /gov/resources`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "rid": "rid-001",
        "name": "青年就業促進計畫",
        "description": "提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢",
        "eligibilityCriteria": ["年齡 18–29 歲", "具中華民國國籍", "非在學中"],
        "contactUrl": "https://www.mol.gov.tw",
        "pdfStoragePath": "gov-resources/rid-001.pdf",
        "createdAt": 1714000000000
      }
    ]
  }
}
```

---

### `POST /gov/resources`

**Request body**
```json
{
  "name": "青年就業促進計畫",
  "description": "提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢",
  "eligibilityCriteria": ["年齡 18–29 歲", "具中華民國國籍", "非在學中"],
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
    "contactUrl": "https://www.mol.gov.tw",
    "createdAt": 1714010000000
  }
}
```

---

### `POST /gov/resources/:rid/pdf`

上傳資源相關 PDF 文件。
後端自動解析文字，存入 `gov_resources/{rid}.pdfText`，供 GovAgent 的 `query_resource_pdf` 工具讀取。

**Request** — `multipart/form-data`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `pdf` | File | PDF 檔案，最大 10 MB |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "totalMatches": 47,
    "humanTakeoverCount": 11,
    "activeThreads": 8,
    "matchedToday": 6,
    "needsDistribution": {
      "就業輔導": 18,
      "職業培訓": 14,
      "法律協助": 7
    }
  }
}
```

---

## 9. WebSocket 事件

**連線：** `ws://localhost:3000/ws?token=<firebase_id_token>`

連線成功後維持長連線，三種對話型態共用同一條 WS。

---

### Client → Server

```typescript
type ClientEvent =
  // ── Persona Chat ──────────────────────────────────────
  // 進入 Swipe 介面時客戶端自動送：
  //   content = "請忽略上面的訊息，給我一個二選一的選擇題"
  // 離開 Swipe 介面時送：
  //   content = "謝謝，繼續幫我完善 persona"
  | { type: "persona_message"; content: string }

  // ── Coffee Chat ───────────────────────────────────────
  // 發訊息到 peer thread；CoffeeAgent 代理後 push 給雙方
  | { type: "peer_message"; threadId: string; content: string }

  // ── Human Thread ─────────────────────────────────────
  // 市民或 gov_staff 在 human thread 發訊息
  | { type: "human_message"; threadId: string; content: string }
```

---

### Server → Client

```typescript
type ServerEvent =
  // ── Persona Chat ──────────────────────────────────────
  // PersonaAgent streaming 回應（每 token 一次，done=true 時為結束）
  | { type: "agent_reply"; content: string; done: boolean }

  // ── Coffee Chat ───────────────────────────────────────
  // CoffeeAgent relay_message 後推給 thread 雙方
  | { type: "peer_message"; message: PeerMessage }

  // ── Human Thread ─────────────────────────────────────
  // 對方（市民或 gov_staff）發訊息後推給另一方
  | { type: "human_message"; message: HumanMessage }

  // ── 全域 ─────────────────────────────────────────────
  | { type: "error"; code: string; message: string }
```

> 配對通知（GovAgent 回覆、新 peer thread、新 human thread）**不走 WS**，由客戶端 polling REST 端點發現。

---

### WS 訊息範例

```jsonc
// 進入 swipe 介面
{ "type": "persona_message", "content": "請忽略上面的訊息，給我一個二選一的選擇題" }

// PersonaAgent 回應（streaming）
{ "type": "agent_reply", "content": "好的！請問：", "done": false }
{ "type": "agent_reply", "content": "你目前是否有穩定工作？\nA. 有  B. 沒有", "done": false }
{ "type": "agent_reply", "content": "", "done": true }

// Coffee Chat 發訊息
{ "type": "peer_message", "threadId": "pt-001", "content": "你好！你是做什麼的？" }

// CoffeeAgent relay 後 push 給雙方
{
  "type": "peer_message",
  "message": {
    "mid": "pm-010",
    "from": "user:abc123",
    "content": "你好！你是做什麼的？",
    "createdAt": 1714005000000
  }
}

// Human Thread 發訊息
{ "type": "human_message", "threadId": "ht-001", "content": "請問申請期限是何時？" }

// 對方收到
{
  "type": "peer_notify",
  "thread": { "tid": "tid-002", "type": "user_user", "status": "negotiating", ... },
  "peer": {
    "uid": "uid-002",
    "displayName": "林小華",
    "summary": "對社會企業有興趣的青年"
  }
}

// presence_update
{ "type": "presence_update", "threadId": "tid-001", "side": "user", "state": "human" }

// persona_updated
{ "type": "persona_updated", "persona": { "uid": "abc123", ... } }

// error
{ "type": "error", "code": "SESSION_EXPIRED", "message": "請重新登入" }
```

---

## 10. 錯誤格式

所有 REST 錯誤統一格式：

```json
{
  "success": false,
  "error": "說明文字",
  "data": null
}
```

| HTTP | 說明 |
|------|------|
| `400` | 請求格式錯誤或缺必要欄位 |
| `401` | 未帶 token 或 token 無效/過期 |
| `403` | 權限不足（市民呼叫 `/gov/*`，或存取他人 thread） |
| `404` | 資源不存在 |
| `409` | 衝突（如 replyId 已 open） |
| `413` | PDF 超過 10 MB |
| `429` | Claude API rate limit |
| `500` | 伺服器錯誤 |

| WS `code` | 說明 |
|-----------|------|
| `AUTH_FAILED` | WS 連線認證失敗 |
| `THREAD_NOT_FOUND` | 指定 thread 不存在或無存取權 |
| `AGENT_ERROR` | Claude Sessions API 呼叫失敗 |
