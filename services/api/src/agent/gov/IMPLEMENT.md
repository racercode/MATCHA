# Gov Agent — Phase 1 實作說明

## 概述

Phase 1 實作最小可行的 Gov Agent 媒合 pipeline：假資料 + Claude Managed Agent，不依賴資料庫或 WebSocket。

## 實作內容

### 型別定義（`types.ts`）

- `MatchDecision` — Claude 的結構化媒合判斷（eligible、score、reason、missingInfo、suggestedFirstMessage）
- `MatchAssessment` — 將一組 broadcast + resource + decision 綁在一起
- `GovAgentPipelineResult` — pipeline 最終輸出（assessment + thread + initialMessage）

### 假資料（`fakeData.ts`）

三筆假 persona 廣播和三筆臺北市青年局的假政府資源：

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
| `query_program_docs` | `skills/query_program_docs/SKILL.md` | `query_program_docs` |
| `propose_match` | `skills/propose_match/SKILL.md` | `propose_match` |

### Custom Tools（Managed Agent）

建立/更新 Gov Agent 時會註冊 custom tools。Claude Managed Agent 可自行呼叫這些 tools；後端負責接 `agent.custom_tool_use` event、執行對應 tool wrapper，並送回 `user.custom_tool_result`。

### Tool Wrappers（`toolWrappers/`）

Tool wrapper 是 TypeScript 執行層，目前底層讀假資料或建立 draft object：

| Tool wrapper | 檔案 | 說明 |
|--------------|------|------|
| `readChannelToolWrapper` | `toolWrappers/readChannel.ts` | 回傳 persona 廣播（支援 `since` 和 `limit` 篩選） |
| `queryProgramDocsToolWrapper` | `toolWrappers/queryProgramDocs.ts` | 依 `agencyId` 篩選資源（可選 `resourceId`） |
| `proposeMatchToolWrapper` | `toolWrappers/proposeMatch.ts` | 根據 `MatchAssessment` 建立 draft `AgentThread` 與 initial `ThreadMessage` |

### Managed Agent（`managedAgent.ts`）

- 初始化 Anthropic client
- 讀取 `services/api/src/agent/general/governmentAgents.json`
- 重用既有 Claude Managed Agent / environment / session
- 若 registry 沒有資料，才建立 Claude Managed Agent，使用 `claude-haiku-4-5`
- 上傳 Markdown Skills，並將 skill IDs 掛到 agent
- 註冊 `read_channel`、`query_program_docs`、`propose_match` custom tools
- 建立或重用 environment 和 session
- 匯出 `initGovManagedAgentSession()`，回傳 `sessionId`

### Agent Registry（`general/`）

用兩個 JSON 檔保存目前有哪些長期可重用的 Managed Agent：

| 檔案 | 用途 |
|------|------|
| `general/governmentAgents.json` | 保存政府 Agent 的 `agentId`、`environmentId`、sessions |
| `general/userAgents.json` | 保存使用者 Agent 的 `agentId`、`environmentId`、sessions |

`agentRegistry.ts` 負責讀寫這兩個 JSON。Phase 1 先用 JSON，後續可以換 Redis / Firestore。

### Pipeline（`pipeline.ts`）

- `parseMatchDecision(rawText)` — 驗證並解析 Claude 的 JSON 回應，自動清除 markdown code fence
- `runGovAgentForChannelUpdate(sessionId, broadcast, agencyId?)` — channel 更新時喚醒 Gov Agent，讓 Agent 自主使用 custom tools，最後回傳 match result 或 `null`
- `runGovAgentPipeline(sessionId, broadcasts, resources, threshold?)` — 對每筆 channel update 呼叫 Gov Agent，收集有回應的結果

### 測試進入點（`main.ts`）

執行腳本，流程：
1. 透過 `readChannelToolWrapper` 載入假廣播
2. 從 registry 重用或初始化 Claude Managed Agent session
3. 對每筆 channel update 喚醒 Gov Agent
4. Agent 自主呼叫 custom tools
5. 印出可讀的結果和完整 JSON，包含 `AgentThread` 與 initial `ThreadMessage`

### 單元測試（`pipeline.test.ts`）

4 個 suite、19 個測試，涵蓋：
- `parseMatchDecision` — 合法 JSON、markdown fence 清除、所有驗證錯誤情境
- `readChannelToolWrapper` — 無篩選、since 篩選、limit 限制
- `queryProgramDocsToolWrapper` — 已知 agencyId、未知 agencyId、resourceId 篩選
- `proposeMatchToolWrapper` — thread / initial message 資料結構、deterministic tid / mid

## 架構流程

```
main.ts（進入點）
  → readChannelToolWrapper()            // 假資料
  → initGovManagedAgentSession()
  → runGovAgentPipeline()
       → runGovAgentForChannelUpdate()
          → Claude Managed Agent decides whether to call custom tools
          → agent.custom_tool_use(read_channel / query_program_docs / propose_match)
          → backend executes tool wrapper
          → user.custom_tool_result
          → final JSON or null
```

## User Agent 通知責任

Gov Agent 不直接把媒合通知轉給使用者。Phase 1 的 `proposeMatchToolWrapper` 會產生 initial `ThreadMessage`，未來寫入 database 後，由 User Agent 讀取該 message，整理成使用者通知或 App 內摘要。

```txt
Gov Agent -> AgentThread + ThreadMessage -> database
User Agent -> read ThreadMessage -> notify citizen
```

## 尚未實作（後續階段）

- Firebase / Firestore 讀寫
- User Agent 讀取 `ThreadMessage` 並轉成使用者通知
- `POST /gov/agent/run` API endpoint
- `notify_user` Markdown Skill + `notifyUserToolWrapper`
- `escalate_to_caseworker` Markdown Skill + `escalateToCaseworkerToolWrapper`
- MCP server 整合
- Session 持久化（Redis）
- 重複媒合防護（目前只靠 deterministic `tid`）
