# Matcha API Documentation

**Base URL（本機）：** `http://localhost:3000`  
**Mock URL（開發用）：** `http://localhost:3001`  
**WebSocket：** `ws://localhost:3000/ws`

目前 API server 以 no-Firebase / in-memory 模式運作；`idToken` 與 `Authorization` token 皆先使用 raw uid string（例如 `uid-abc`、`gov001`）。

除 `GET /health`、`POST /auth/verify`、`POST /gov/agent/run-message` 外，所有 REST 請求需帶：
```
Authorization: Bearer <uid>
```

---

## 目錄

0. [健康檢查](#0-健康檢查)
1. [認證](#1-認證)
2. [市民 — Persona Chat](#2-市民--persona-chat)
3. [市民 — Match Inbox（Polling）](#3-市民--match-inboxpolling)
4. [市民 — Peer Threads（Coffee Chat）](#4-市民--peer-threadscoffee-chat)
5. [市民 — Human Threads](#5-市民--human-threads)
5.5. [市民 — 資源追問（Follow-Up）](#55-市民--資源追問follow-up)
6. [政府 — Channel Replies & Dashboard](#6-政府--channel-replies--dashboard)
7. [政府 — Human Threads](#7-政府--human-threads)
8. [政府 — 資源管理](#8-政府--資源管理)
9. [WebSocket 事件](#9-websocket-事件)
10. [目前實作狀態總覽](#10-目前實作狀態總覽)
11. [錯誤格式](#11-錯誤格式)

---

## 0. 健康檢查

### ✅ `GET /health`

確認 API server 是否啟動。

**Response `200`**
```json
{ "ok": true }
```

---

## 1. 認證

### 流程

目前實作用 raw uid 模擬登入；`POST /auth/verify` 會檢查 in-memory `govStaff` seed data。uid 為 `gov001` 或 `gov002` 時回傳 `role = "gov_staff"`，其餘 uid 回傳 `role = "citizen"`。

```
Client                       Backend
  │── POST /auth/verify { idToken: "<uid>" } ───────>│
  │<─────────────── { uid, role, govId? } ───────────│
```

後續 REST API 的 `Authorization: Bearer <uid>` 也使用同一套判斷。

---

### ✅ `POST /auth/verify`

**Request body**
```json
{ "idToken": "uid-abc" }
```

**Response `200` — 市民**
```json
{
  "success": true,
  "data": { "uid": "uid-abc", "role": "citizen" }
}
```

**Response `200` — 政府**
```json
{
  "success": true,
  "data": { "uid": "gov001", "role": "gov_staff", "govId": "rid-001" }
}
```

---

## 2. 市民 — Persona Chat

Persona Chat 完全透過 WebSocket 進行（見 §9）。
此 REST 端點僅供讀取目前的 persona 快照。

---

### ✅ `GET /me/persona`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "uid": "uid-abc",
    "displayName": "陳小明",
    "summary": "正在尋找就業輔導和職業培訓資源的年輕人，目前無穩定收入",
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

### ✅ `GET /me/channel-replies`

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

### ✅ `GET /me/peer-threads`

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

### ✅ `GET /peer-threads/:tid/messages`

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
        "createdAt": { "seconds": 1714002000, "nanoseconds": 0 }
      },
      {
        "mid": "pm-002",
        "from": "user:uid-xyz",
        "content": "你好！我也在找有軟體背景的夥伴",
        "createdAt": { "seconds": 1714002060, "nanoseconds": 0 }
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

### ✅ `GET /me/human-threads`

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

### ✅ `GET /human-threads/:tid/messages`

取得 human thread 歷史訊息。

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
        "mid": "hm-001",
        "from": "gov_staff:gov001",
        "content": "你好！我是勞動部的承辦人，看到你的申請需求，想進一步了解你的狀況。",
        "createdAt": { "seconds": 1714003000, "nanoseconds": 0 }
      }
    ],
    "hasMore": false
  }
}
```

> 發送訊息透過 WS `human_message` 事件（見 §9）。

---

## 5.5. 市民 — 資源追問（Follow-Up）

使用者收到政府資源媒合通知後，可以針對該資源追問問題。後端會開啟專屬的 Resource Agent session（Q&A 模式），agent 可查詢該資源的文件來回答。

同一個 `replyId` 的多次追問會共用同一個 agent session，實現多輪對話。

---

### ✅ `POST /api/resource-followup`

**Auth**: `Authorization: Bearer <uid>`（citizen 即可，不需要 gov_staff）

**Request body**
```json
{
  "resourceId": "rid-youth-career-001",
  "replyId": "reply-gov-rid-youth-career-001-msg-001",
  "question": "請問申請截止日期是什麼時候？"
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `resourceId` | string | 必填，被媒合到的資源 rid |
| `replyId` | string | 必填，原始的 ChannelReply ID（用來關聯通知上下文） |
| `question` | string | 必填，使用者的追問內容 |

**Backend flow**

```txt
POST /api/resource-followup
-> verifyToken (citizen OK)
-> validate resourceId, replyId, question
-> getGovernmentResource(resourceId)
-> read channel_replies/{replyId} (通知內容)
-> read personas/{uid} (使用者 persona)
-> initGovFollowUpSession(sessionKey = followup-{replyId})
-> runGovFollowUpQuestion(session, question)
   -> agent 可呼叫 query_resource_document
-> return answer
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "answer": "根據文件，這個計畫的申請截止日期為 2026 年 6 月 30 日。您可以在截止日前透過線上系統提出申請。",
    "resourceId": "rid-youth-career-001",
    "replyId": "reply-gov-rid-youth-career-001-msg-001"
  }
}
```

**多輪對話**

前端只需重複 POST 同一個 `replyId` + 新的 `question`，後端會自動複用同一個 agent session，agent 保有先前對話的上下文。

**Errors**

| 狀態碼 | 情境 |
|------|------|
| `400` | `resourceId`、`replyId` 或 `question` 缺少或為空字串 |
| `404` | 找不到指定 `resourceId` 的資源 |
| `500` | Agent session 初始化或追問處理失敗 |

---

## 6. 政府 — Channel Replies & Dashboard

---

### ✅ `POST /gov/agent/run`

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

### ✅ `POST /gov/agent/run-message`

Firebase trigger target。當 `channel_messages/{messageId}` 新增後，trigger POST 這支 API，Gov backend 會從 Firestore 讀取該 channel message 與所有 `gov_resources`，再叫所有 Resource Agents 判斷是否 match。

這支 endpoint 第一版不需要 `Authorization` header。

**Request body**

```json
{
  "messageId": "msg-channel-xiaoya-001",
  "threshold": 70
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `messageId` | string | 必填，Firestore `channel_messages/{messageId}` 的 document id |
| `threshold` | number | 選填，媒合分數門檻，0–100，預設 70 |

**Backend flow**

```txt
messageId
-> read Firestore channel_messages/{messageId}
-> read Firestore gov_resources
-> init/reuse one Resource Agent per resource
-> runGovAgentPipeline(resourceAgents, [message])
-> write Firestore channel_replies
```

**Idempotency**

後端會使用：

```txt
gov_agent_runs/{messageId}
```

如果同一個 `messageId` 已經是 `running` 或 `completed`，會直接回傳 skipped，不會重複跑所有 agents。

**Response `200` — processed**

```json
{
  "success": true,
  "data": {
    "messageId": "msg-channel-xiaoya-001",
    "skipped": false,
    "resourceCount": 3,
    "matchCount": 1,
    "threshold": 70,
    "matches": [
      {
        "reply": {
          "replyId": "reply-gov-rid-design-intern-002-msg-channel-xiaoya-001",
          "messageId": "msg-channel-xiaoya-001",
          "govId": "rid-design-intern-002",
          "content": "使用者明確提到品牌設計與實習需求，符合創意產業實習媒合計畫。",
          "matchScore": 90,
          "createdAt": {
            "seconds": 1714000000,
            "nanoseconds": 0
          }
        },
        "reason": "使用者明確提到品牌設計與實習需求，符合創意產業實習媒合計畫。",
        "missingInfo": [],
        "assessment": {}
      }
    ]
  }
}
```

**Response `200` — skipped**

```json
{
  "success": true,
  "data": {
    "messageId": "msg-channel-xiaoya-001",
    "skipped": true,
    "status": "completed"
  }
}
```

**Errors**

| 狀態碼 | 情境 |
|------|------|
| `400` | `messageId` 缺少或不是非空字串，或 `threshold` 不是 0–100 整數 |
| `404` | 找不到 Firestore `channel_messages/{messageId}` |
| `500` | Firebase Admin env 未設定、讀取 Firestore 失敗、Gov Agent session 初始化或 pipeline 執行失敗 |

---

### ✅ `GET /gov/channel-replies`

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
          "uid": "uid-abc",
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

### ✅ `POST /gov/channel-replies/:replyId/open`

政府承辦人決定對某筆媒合開啟真人對話，建立 HumanThread。
同一筆 `replyId` 只能 open 一次；重複呼叫會直接回傳既有 thread。

**Response `201`**
```json
{
  "success": true,
  "data": {
    "tid": "ht-001",
    "type": "gov_user",
    "userId": "uid-abc",
    "govId": "rid-001",
    "channelReplyId": "r-001",
    "matchScore": 87,
    "status": "open",
    "createdAt": 1714003000000,
    "updatedAt": 1714003000000
  }
}
```

**Response `200` — 已開啟過**
```json
{
  "success": true,
  "data": {
    "tid": "ht-001",
    "type": "gov_user",
    "userId": "uid-abc",
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

### ✅ `GET /gov/dashboard`

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

### ✅ `GET /gov/dashboard/agents`

目前使用中的 Resource Agent 數量。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "agentCount": 4,
    "agents": [
      { "rid": "rid-coworking-space-subsidy-115", "name": "青年創業共享空間租賃補助" },
      { "rid": "rid-youth-startup-loan", "name": "臺北市青年創業融資貸款" }
    ]
  }
}
```

---

### ✅ `GET /gov/dashboard/users`

目前系統中的市民（persona）數量。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "userCount": 42
  }
}
```

---

### ✅ `GET /gov/dashboard/stats`

全部 Resource Agent 的媒合統計（包含每個 resource 的細項）。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "totalAttempts": 120,
    "totalMatches": 35,
    "matchRate": 29.17,
    "resources": [
      {
        "resourceId": "rid-coworking-space-subsidy-115",
        "resourceName": "青年創業共享空間租賃補助",
        "totalAttempts": 60,
        "totalMatches": 20,
        "matchRate": 33.33
      }
    ]
  }
}
```

| 欄位 | 說明 |
|------|------|
| `totalAttempts` | 所有 resource agent 評估次數（成功 + 失敗） |
| `totalMatches` | 媒合成功次數（eligible=true 且 score >= threshold） |
| `matchRate` | 成功率百分比（保留兩位小數） |

---

### ✅ `GET /gov/dashboard/stats/:resourceId`

單一 Resource Agent 的媒合統計。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "resourceId": "rid-coworking-space-subsidy-115",
    "resourceName": "青年創業共享空間租賃補助",
    "agencyId": "taipei-youth-dept",
    "totalAttempts": 60,
    "totalMatches": 20,
    "matchRate": 33.33
  }
}
```

若 resourceId 尚無統計紀錄，回傳全零：
```json
{
  "success": true,
  "data": {
    "resourceId": "rid-xxx",
    "totalAttempts": 0,
    "totalMatches": 0,
    "matchRate": 0
  }
}
```

---

## 7. 政府 — Human Threads

---

### ✅ `GET /gov/human-threads`

列出我（gov_staff）開啟的所有 human threads。

**Query params**

| 參數 | 型別 | 說明 |
|------|------|------|
| `since` | number (unix ms) | 增量 polling 用（選填） |
| `limit` | number | 預設 20 |

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
          "uid": "uid-abc",
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

### ✅ `GET /human-threads/:tid/messages`

同市民側，端點共用。後端驗證呼叫者是 thread 的 userId 或對應 govId。

---

## 8. 政府 — 資源管理

---

### ✅ `GET /gov/resources`

列出政府資源基本資料。詳細文件文字存放於 `gov_resources/{rid}/documents/{docId}`，不直接塞在 resource root。

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
        "createdAt": { "seconds": 1714000000, "nanoseconds": 0 },
        "updatedAt": { "seconds": 1714000000, "nanoseconds": 0 }
      }
    ]
  }
}
```

---

### ✅ `POST /gov/resources`

建立或更新政府資源。若 body 有帶 `rid`，會以該 id upsert；未帶則由後端產生 `rid-{timestamp}`。

**Request body**
```json
{
  "rid": "rid-001",
  "agencyId": "taipei-youth-dept",
  "agencyName": "臺北市青年局",
  "name": "青年就業促進計畫",
  "description": "提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢",
  "eligibilityCriteria": ["年齡 18–29 歲", "具中華民國國籍", "非在學中"],
  "contactUrl": "https://www.mol.gov.tw"
}
```

**Response `201`** — 回傳新建 `GovernmentResource`（結構同上）。

---

### ✅ `GET /gov/resources/:rid`

取得單一政府資源基本資料。

---

### ✅ `GET /gov/resources/:rid/documents`

列出該 resource 底下所有文件文字。

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "docId": "doc-001",
        "rid": "rid-001",
        "filename": "eligibility.md",
        "kind": "markdown",
        "mimeType": "text/markdown",
        "extractedText": "申請資格：18–29 歲...",
        "textLength": 8420,
        "createdAt": { "seconds": 1714000000, "nanoseconds": 0 },
        "updatedAt": { "seconds": 1714000000, "nanoseconds": 0 }
      }
    ]
  }
}
```

---

### ✅ `POST /gov/resources/:rid/documents`

上傳任意資源文件，後端會把文件轉成 `extractedText` 存到 Firestore subcollection：

```txt
gov_resources/{rid}/documents/{docId}
```

**Request — `multipart/form-data`**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `file` | File | 文件檔，支援 PDF / Markdown / txt / html，最大 10 MB |
| `kind` | string | 選填，`pdf` / `markdown` / `txt` / `html` / `csv` / `xlsx` / `url` / `other` |

解析規則：

- PDF：使用後端 PDF parser 抽文字。
- Markdown / txt / CSV：以 UTF-8 文字保存。
- HTML：移除 `script` / `style` / HTML tag 後保存正文文字。
- XLSX / XLS：逐 sheet 轉成 CSV 文字，並加上 sheet 名稱。

**Request — JSON / form fields**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `filename` | string | 沒有上傳 file 時建議提供 |
| `text` 或 `extractedText` | string | 已解析好的文件文字 |
| `sourceUrl` | string | URL 型文件來源 |
| `mimeType` | string | 選填 |

**Response `201`**
```json
{
  "success": true,
  "data": {
    "docId": "doc-001",
    "rid": "rid-001",
    "filename": "eligibility.md",
    "kind": "markdown",
    "extractedText": "申請資格：18–29 歲...",
    "textLength": 8420,
    "createdAt": { "seconds": 1714000000, "nanoseconds": 0 },
    "updatedAt": { "seconds": 1714000000, "nanoseconds": 0 }
  }
}
```

---

### ✅ `POST /gov/resources/:rid/pdf`

舊版相容 endpoint。新流程建議改用 `POST /gov/resources/:rid/documents`。

後端會解析 PDF 文字並寫成一筆 `documents/{docId}`；`pdfStoragePath` 只保留給舊客戶端相容。

**Request** — `multipart/form-data`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `pdf` | File | PDF 檔案，最大 10 MB |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "rid": "rid-001",
    "docId": "doc-001",
    "pdfStoragePath": "gov-resources/rid-001/guide.pdf",
    "extractedChars": 8420
  }
}
```

---

## 9. WebSocket 事件

**連線：** `ws://localhost:3000/ws?token=<uid>`

連線成功後維持長連線，三種對話型態共用同一條 WS。也可透過 upgrade request header 傳 `Authorization: Bearer <uid>`。

---

### ✅ Client → Server

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

### ✅ Server → Client

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
    "from": "user:uid-abc",
    "content": "你好！你是做什麼的？",
    "createdAt": { "seconds": 1714005000, "nanoseconds": 0 }
  }
}

// Human Thread 發訊息
{ "type": "human_message", "threadId": "ht-001", "content": "請問申請期限是何時？" }

// 對方收到
{
  "type": "human_message",
  "message": {
    "mid": "hm-005",
    "from": "user:uid-abc",
    "content": "請問申請期限是何時？",
    "createdAt": { "seconds": 1714005100, "nanoseconds": 0 }
  }
}

// 錯誤
{ "type": "error", "code": "THREAD_NOT_FOUND", "message": "Thread pt-001 不存在或無權限存取" }
```

---

## 10. 目前實作狀態總覽

以下根據 `services/api/src/app.ts`、`services/api/src/routes/*`、`services/api/src/ws/handler.ts` 與 `services/api/src/mock/server.ts` 盤點。

| 狀態 | API / 事件 | 實作位置 | 備註 |
|------|------------|----------|------|
| ✅ | `GET /health` | `services/api/src/app.ts` | API health check |
| ✅ | `POST /auth/verify` | `services/api/src/routes/auth.ts` | raw uid token，`gov001` / `gov002` 為 gov staff |
| ✅ | `GET /me/persona` | `services/api/src/routes/me.ts` | 需 `Authorization: Bearer <uid>` |
| ✅ | `GET /me/channel-replies` | `services/api/src/routes/me.ts` | 支援 `since`、`limit` |
| ✅ | `GET /me/peer-threads` | `services/api/src/routes/me.ts` | 支援 `since` |
| ✅ | `GET /peer-threads/:tid/messages` | `services/api/src/routes/threads.ts` | 支援 `before`、`limit` |
| ✅ | `GET /me/human-threads` | `services/api/src/routes/me.ts` | 支援 `since`、`limit` |
| ✅ | `GET /human-threads/:tid/messages` | `services/api/src/routes/threads.ts` | citizen / gov staff 共用 |
| ✅ | `POST /api/resource-followup` | `services/api/src/routes/gov.ts` | 市民追問媒合資源，需 `Authorization`（citizen OK） |
| ✅ | `POST /gov/agent/run-message` | `services/api/src/routes/gov.ts` | Firebase trigger target，免 `Authorization` |
| ✅ | `POST /gov/agent/run` | `services/api/src/routes/gov.ts` | demo / dev 觸發 Gov Agent |
| ✅ | `GET /gov/channel-replies` | `services/api/src/routes/gov.ts` | 支援 `since`、`minScore`、`limit` |
| ✅ | `POST /gov/channel-replies/:replyId/open` | `services/api/src/routes/gov.ts` | 建立或回傳既有 HumanThread |
| ✅ | `GET /gov/dashboard` | `services/api/src/routes/gov.ts` | 支援 `since` |
| ✅ | `GET /gov/dashboard/agents` | `services/api/src/routes/govDashboard.ts` | 目前 resource agent 數量 |
| ✅ | `GET /gov/dashboard/users` | `services/api/src/routes/govDashboard.ts` | 市民 persona 數量 |
| ✅ | `GET /gov/dashboard/stats` | `services/api/src/routes/govDashboard.ts` | 全域媒合統計 |
| ✅ | `GET /gov/dashboard/stats/:resourceId` | `services/api/src/routes/govDashboard.ts` | 單一 resource 媒合統計 |
| ✅ | `GET /gov/human-threads` | `services/api/src/routes/gov.ts` | gov staff 視角 |
| ✅ | `GET /gov/resources` | `services/api/src/routes/gov.ts` | Firestore resources |
| ✅ | `POST /gov/resources` | `services/api/src/routes/gov.ts` | 建立或更新 Firestore resource |
| ✅ | `GET /gov/resources/:rid` | `services/api/src/routes/gov.ts` | 單一 resource |
| ✅ | `GET /gov/resources/:rid/documents` | `services/api/src/routes/gov.ts` | resource 文件文字列表 |
| ✅ | `POST /gov/resources/:rid/documents` | `services/api/src/routes/gov.ts` | multipart `file` 或已解析文字 |
| ✅ | `POST /gov/resources/:rid/pdf` | `services/api/src/routes/gov.ts` | 舊版相容，內部寫入 documents |
| ✅ | WS `persona_message` → `agent_reply` | `services/api/src/ws/handler.ts` | persona stub streaming |
| ✅ | WS `peer_message` | `services/api/src/ws/handler.ts` | 寫入 peer messages 並推播雙方 |
| ✅ | WS `human_message` | `services/api/src/ws/handler.ts` | citizen / gov staff 共用 |
| ✅ | Mock-only `POST /me/chat` | `services/api/src/mock/server.ts` | SSE persona chat stub，real backend 不掛載 |
| ✅ | Mock-only `POST /me/swipe` | `services/api/src/mock/server.ts` | swipe card stub，real backend 不掛載 |

---

## 11. 錯誤格式

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
| `413` | PDF 超過 10 MB |
| `429` | Claude API rate limit |
| `500` | 伺服器錯誤 |

| WS `code` | 說明 |
|-----------|------|
| `AUTH_FAILED` | WS 連線認證失敗 |
| `THREAD_NOT_FOUND` | 指定 thread 不存在或無存取權 |
| `AGENT_ERROR` | Claude Sessions API 呼叫失敗 |
