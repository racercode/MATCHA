# Gov Agent — Phase 1 實作說明

## 概述

Phase 1 實作最小可行的 Gov Agent 媒合 pipeline：假資料 + Claude Managed Agent，不依賴資料庫或 WebSocket。

## 實作內容

### 型別定義（`types.ts`）

- `MatchDecision` — Claude 的結構化媒合判斷（eligible、score、reason、missingInfo）
- `MatchAssessment` — 將一組 channel message + resource + decision 綁在一起
- `GovAgentPipelineResult` — pipeline 最終輸出（assessment + reply）
- `FollowUpResult` — 追問功能的回應（answer、resourceId、replyId）

### 假資料（`fakeData.ts`）

三筆假 channel message 和三筆臺北市青年局的假政府資源：

| 使用者 | 摘要                              |
|--------|-----------------------------------|
| 小雅   | 中文系大三，品牌設計/實習/轉職    |
| 阿明   | 剛退伍，找工作/職訓補助          |
| 小林   | 準備創業，找貸款/輔導/補助       |

| 資源名稱                    | RID                      |
|-----------------------------|--------------------------|
| 青年職涯探索諮詢            | rid-youth-career-001     |
| 創意產業實習媒合計畫        | rid-design-intern-002    |
| 青年創業輔導與貸款說明      | rid-youth-startup-003    |

### Markdown Skills（`skills/*/SKILL.md`）

`skill` 統一指 Markdown Skill，用來描述能力的使用時機、input/output，以及要呼叫哪個 custom tool：

| Markdown Skill | 檔案 | 指向的 custom tool |
|----------------|------|---------------------|
| `read_channel` | `skills/read_channel/SKILL.md` | `read_channel` |
| `query_resource_document` | `skills/query_resource_document/SKILL.md` | `query_resource_document` |
| `write_channel_reply` | `skills/write_channel_reply/SKILL.md` | `write_channel_reply` |

### Custom Tools（Managed Agent）

建立/更新 Gov Agent 時會註冊 custom tools。Claude Managed Agent 可自行呼叫這些 tools；後端負責接 `agent.custom_tool_use` event、執行對應 tool wrapper，並送回 `user.custom_tool_result`。

### Tool Wrappers（`toolWrappers/`）

Tool wrapper 是 TypeScript 執行層，目前底層讀假資料或建立 draft object：

| Tool wrapper | 檔案 | 說明 |
|--------------|------|------|
| `readChannelToolWrapper` | `toolWrappers/readChannel.ts` | 回傳 channel messages（支援 `since` 和 `limit` 篩選） |
| `queryResourcePdfToolWrapper` | `toolWrappers/queryResourcePdf.ts` | 依 runtime `agencyId/resourceId` context 只回傳此 Resource Agent 綁定的資源 |
| `writeChannelReplyToolWrapper` | `toolWrappers/writeChannelReply.ts` | 根據 `MatchAssessment` 建立 `ChannelReply` |

### Managed Agent（`managedAgent.ts`）

- 初始化 Anthropic client
- 讀取 `services/api/src/agent/general/governmentAgents.json`
- 依 `resourceId` 重用既有 Claude Managed Agent / environment / session
- 若 registry 沒有該資源的資料，才建立 Claude Managed Agent，使用 `claude-haiku-4-5`
- 上傳 Markdown Skills，並將 skill IDs 掛到 agent
- 註冊 `read_channel`、`query_resource_document`、`write_channel_reply` custom tools
- 建立或重用 environment 和 session
- 匯出 `initGovManagedAgentSession()`，回傳 `sessionId`
- 匯出 `initGovFollowUpSession()`，使用 `GOV_FOLLOWUP_SYSTEM_PROMPT` 建立 Q&A 模式的 agent session，用於市民追問功能

### Agent Registry（`general/`）

用兩個 JSON 檔保存目前有哪些長期可重用的 Managed Agent：

| 檔案 | 用途 |
|------|------|
| `general/governmentAgents.json` | 保存政府 Resource Agent 的 `resourceId`、`agentId`、`environmentId`、sessions |
| `general/userAgents.json` | 保存使用者 Agent 的 `agentId`、`environmentId`、sessions |

`agentRegistry.ts` 負責讀寫這兩個 JSON。Phase 1 先用 JSON，後續可以換 Redis / Firestore。

### Pipeline（`pipeline.ts`）

- `parseMatchDecision(rawText)` — 驗證並解析 Claude 的 JSON 回應，自動清除 markdown code fence
- `runGovAgentForChannelUpdate(sessionId, channelMessage, context)` — channel 更新時喚醒單一 Resource Agent，讓 Agent 自主使用 custom tools，最後回傳 match result 或 `null`
- `runGovAgentPipeline(resourceAgents, messages, threshold?)` — 對每筆 channel update 逐一呼叫各 Resource Agent，收集有回應的結果
- `runGovFollowUpQuestion(sessionId, context, payload)` — 市民追問功能，送追問到 follow-up agent session，處理 tool calls（query_resource_document），收集純文字回答

### 測試進入點（`main.ts`）

執行腳本，流程：
1. 透過 `readChannelToolWrapper` 載入假 channel messages
2. 從 registry 依每個 resource 重用或初始化 Claude Managed Agent session
3. 對每筆 channel update 逐一喚醒 Resource Agent
4. Agent 自主呼叫 custom tools
5. 印出可讀的結果和完整 JSON，包含 `ChannelReply`

### 單元測試（`pipeline.test.ts` + `gov.test.ts`）

pipeline.test.ts — 4 個 suite、17 個測試，涵蓋：
- `parseMatchDecision` — 合法 JSON、markdown fence 清除、所有驗證錯誤情境
- `readChannelToolWrapper` — 無篩選、since 篩選、limit 限制
- `queryResourcePdfToolWrapper` — runtime context resource scoping、未知 context、忽略 agent input 裡的 resourceId
- `writeChannelReplyToolWrapper` — reply 資料結構、deterministic replyId

gov.test.ts — 5 個 suite、20 個測試，涵蓋：
- `normalizeChannelMessage` — 合法 payload、不完整 payload
- `selectResources` — 單一 / 全部 resource 篩選
- `buildGovAgentRunPlan` — 各種 plan 建構場景
- `serializeGovAgentResult` — API 回傳格式
- `validateFollowUpRequest` — 合法追問、trim、缺少 resourceId / replyId / question、空字串、undefined body

## 架構流程

```
main.ts（進入點）
  → readChannelToolWrapper()            // 假資料
  → initGovManagedAgentSession()
  → runGovAgentPipeline()
       → runGovAgentForChannelUpdate()
          → Claude Managed Agent decides whether to call custom tools
          → agent.custom_tool_use(read_channel / query_resource_document / write_channel_reply)
          → backend executes tool wrapper
          → user.custom_tool_result
          → final JSON or null
```

### 追問流程（Follow-Up）

```
POST /api/resource-followup { resourceId, replyId, question }
  → verifyToken (citizen OK)
  → validateFollowUpRequest()
  → getGovernmentResource(resourceId)
  → read channel_replies/{replyId}, personas/{uid}
  → initGovFollowUpSession(sessionKey = followup-{replyId})
     → 使用 GOV_FOLLOWUP_SYSTEM_PROMPT（Q&A 模式）
     → 複用既有 environment，建立新 agent + session
  → runGovFollowUpQuestion()
     → agent 可呼叫 query_resource_document
     → 收集純文字回答
  → return { answer, resourceId, replyId }
```

多輪對話靠 `sessionKey = followup-{replyId}` 管理，同一個 replyId 的追問共用 session。

## Match Inbox polling 責任

Gov Agent 不直接把媒合通知轉給使用者。Phase 1 的 `writeChannelReplyToolWrapper` 會產生 `ChannelReply`，未來寫入 database 後，由市民端 Match Inbox 和 Gov Dashboard 透過 HTTP polling 讀取。

```txt
Gov Agent -> ChannelReply -> channel_replies
Citizen app -> GET /me/channel-replies
Gov dashboard -> GET /gov/channel-replies
```

## 尚未實作（後續階段）

- Firebase / Firestore 讀寫
- Firestore `channel_replies` 寫入
- `POST /gov/agent/run` API endpoint
- `escalate_to_caseworker` Markdown Skill + `escalateToCaseworkerToolWrapper`
- MCP server 整合
- Session 持久化（Redis）
- 重複媒合防護（目前只靠 deterministic `replyId`）
