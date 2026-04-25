# Gov Agent

政府資源媒合 Agent，由 Claude Managed Agent 驅動。每個政府資源可以有自己的 resource-scoped Agent；後端在 channel 更新時喚醒各資源 Agent，Agent 依照上傳的 Markdown Skills 自主呼叫 custom tools 讀資料、查自己的資源、決定是否寫入 `ChannelReply`。

## 前置需求

- Node.js >= 18
- `services/api/.env` 裡要有 `ANTHROPIC_API_KEY`

## 檔案結構

```
services/api/src/agent/gov/
├── types.ts              # MatchDecision、MatchAssessment、GovAgentPipelineResult
├── fakeData.ts           # 測試用假資料（廣播 + 政府資源）
├── managedAgent.ts       # Claude Managed Agent session 初始化
├── pipeline.ts           # 媒合評估與 pipeline 流程
├── main.ts               # 執行完整 pipeline 的進入點
├── pipeline.test.ts      # 單元測試（node:test）
├── testTrigger.ts        # 測試觸發流程（寫假 message → 跑 gov agent pipeline）
├── skills/
│   ├── read_channel/SKILL.md
│   ├── query_resource_document/SKILL.md
│   ├── write_channel_reply/SKILL.md
│   └── escalate_to_caseworker/SKILL.md
├── toolWrappers/
│   ├── readChannel.ts        # 讀取 persona 廣播
│   ├── queryResourcePdf.ts   # 查詢政府資源 / documents 文字
│   ├── writeChannelReply.ts  # 建立 channel reply
│   └── index.ts              # 統一匯出
├── IMPLEMENT.md          # 實作細節說明
└── README.md             # 本檔案
```

共用 registry：

```txt
services/api/src/agent/general/
├── governmentAgents.json # 目前已建立的政府 Managed Agents / Environments / Sessions
├── userAgents.json       # 目前已建立的使用者 Managed Agents / Environments / Sessions
└── agentRegistry.ts      # JSON registry 讀寫工具
```

## 跑單元測試

```bash
# 從專案根目錄
npx tsx --test services/api/src/agent/gov/pipeline.test.ts

# 或從 services/api 目錄
npm run gov:test
```

單元測試不會呼叫 Claude API，驗證內容包括：
- JSON 解析與驗證邏輯
- 各 tool wrapper 的輸入輸出
- ChannelReply 建立的資料結構

## 跑完整 Pipeline（需要 API key）

```bash
# 從專案根目錄
npx tsx services/api/src/agent/gov/main.ts

# 或從 services/api 目錄
npm run gov:run
```

執行後會：
1. 載入 3 筆假 persona 廣播和 3 筆假政府資源
2. 讀取 `general/governmentAgents.json`，依每個 `resourceId` 重用或建立 Claude Managed Agent session（claude-haiku-4-5）
3. 建立/更新 agent 時上傳 Markdown Skills，並註冊 custom tools
4. 對每筆 channel update 喚醒每個 Resource Agent
5. Agent 自主呼叫 `read_channel`、`query_resource_document`、`write_channel_reply`
6. Agent 回傳 match 結果或 `null`

預期輸出：Claude 至少應該配對到：
- 小雅 → 創意產業實習媒合計畫（score >= 70）
- 阿明 → 青年職涯探索諮詢（score >= 70）
- 小林 → 青年創業輔導與貸款說明（score >= 70）

## 測試觸發流程（testTrigger）

用來驗證「新 channel message → gov agent 媒合」整條 pipeline 是否正常運作。

**不需要先啟動後端 server。** 這個 script 直接 import firebase 和 pipeline 模組，不經過 Express。

前置條件：

1. `services/api/.env` 設好 `ANTHROPIC_API_KEY` 和 Firebase Admin 環境變數（`FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`）
2. Firestore `gov_resources` 裡至少有一筆政府資源

執行：

```bash
# 從專案根目錄
pnpm --filter api exec tsx src/agent/gov/testTrigger.ts

# fire-and-forget 模式（模擬 publishToChannel 的非同步觸發路徑）
pnpm --filter api exec tsx src/agent/gov/testTrigger.ts -- --fire-and-forget
```

script 會做以下事情：

1. 寫一筆假的 `channel_messages/{msgId}` 到 Firestore
2. 呼叫 `handleGovAgentRunForMessage(msgId)` 觸發所有 resource agent
3. 印出每個 resource 的媒合結果（decision、score、reason）

預期輸出範例：

```
[1/2] Writing test channel message to Firestore...
[1/2] Done — channel_messages/test-trigger-1714100000000 created
[2/2] Triggering handleGovAgentRunForMessage...

=== Result ===
resourceCount: 3
matchCount: 1
  - [MATCH] score=75 reason=符合青年創業輔導資格
```

如果要驗證特定 message 有沒有被處理過，也可以直接打已啟動的後端 API（需要先 `pnpm --filter api dev`）：

```bash
curl -X POST http://localhost:3000/gov/agent/run-message \
  -H "Content-Type: application/json" \
  -d '{"messageId":"<msgId>","threshold":30}'
```

這支 API 有 idempotency 保護：同一筆 messageId 如果已經是 `running` 或 `completed` 會直接回傳 skipped，不會重複跑。上次 `failed` 的才會重跑。

## 核心概念

**Markdown Skills** 是上傳給 Claude Managed Agent 的能力說明層。`skill` 一詞只指 `skills/*/SKILL.md`，用來描述使用時機、input/output，以及要呼叫哪個 custom tool。

**Custom Tools** 是 Claude Managed Agent 可自主呼叫的工具介面。Agent 呼叫 custom tool 時，後端收到 `agent.custom_tool_use` event，執行對應 tool wrapper，再用 `user.custom_tool_result` 回傳結果。

**Tool Wrappers** 是 TypeScript 執行層。`query_resource_document` 會依 runtime context 只回傳該 Agent 綁定的單一 `resourceId`，有 Firebase env 時讀 `gov_resources/{rid}` 與 `gov_resources/{rid}/documents/*`，沒有 Firebase env 時 fallback 到 fake data summary document。文件上傳時由 API 解析成 `extractedText`：PDF 透過 parser 抽文字，Markdown / txt / CSV 直接保存，HTML 會先去除 tag，XLSX / XLS 會逐 sheet 轉成 CSV 文字。

**Pipeline** 負責在 channel 更新時逐一喚醒 Resource Agent，處理 custom tool events，並接收 Agent 最終回傳的 match result 或 `null`。

**ChannelReply** 是 Match Inbox 和 Gov Dashboard 的內容來源。Gov Agent 建立媒合後不直接通知使用者，也不建立真人對話；市民端和政府端用 HTTP polling 讀取 channel replies。

**Managed Agent Registry** 記錄可重用的 Claude `agentId`、`environmentId`、`sessionId` 與綁定的 `resourceId`。同一個政府資源預設重用同一組 Managed Agent 資源，避免每次執行都建立新的 agent / environment / session。
