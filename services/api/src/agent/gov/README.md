# Gov Agent

政府資源媒合 Agent，由 Claude Managed Agent 驅動。讀取 persona 廣播、評估媒合資格，建立 draft thread 與第一則 `ThreadMessage`。

## 前置需求

- Node.js >= 18
- 專案根目錄 `.env` 裡要有 `ANTHROPIC_API_KEY`

## 檔案結構

```
services/api/src/agent/gov/
├── types.ts              # MatchDecision、MatchAssessment、GovAgentPipelineResult
├── fakeData.ts           # 測試用假資料（廣播 + 政府資源）
├── managedAgent.ts       # Claude Managed Agent session 初始化
├── pipeline.ts           # 媒合評估與 pipeline 流程
├── main.ts               # 執行完整 pipeline 的進入點
├── pipeline.test.ts      # 單元測試（node:test）
├── skills/
│   ├── read_channel/SKILL.md
│   ├── query_program_docs/SKILL.md
│   ├── propose_match/SKILL.md
│   ├── notify_user/SKILL.md
│   └── escalate_to_caseworker/SKILL.md
├── toolWrappers/
│   ├── readChannel.ts        # 讀取 persona 廣播
│   ├── queryProgramDocs.ts   # 查詢政府資源
│   ├── proposeMatch.ts       # 建立 draft match thread + initial message
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
- Thread 與 initial ThreadMessage 建立的資料結構

## 跑完整 Pipeline（需要 API key）

```bash
# 從專案根目錄
npx tsx services/api/src/agent/gov/main.ts

# 或從 services/api 目錄
npm run gov:run
```

執行後會：
1. 載入 3 筆假 persona 廣播和 3 筆假政府資源
2. 讀取 `general/governmentAgents.json`，重用或建立 Claude Managed Agent session（claude-haiku-4-5）
3. 對所有 9 組廣播 x 資源組合進行媒合評估
4. 印出 `eligible === true` 且 `score >= 70` 的媒合結果，包含 `AgentThread` 與 initial `ThreadMessage`

預期輸出：Claude 至少應該配對到：
- 小雅 → 創意產業實習媒合計畫（score >= 70）
- 阿明 → 青年職涯探索諮詢（score >= 70）
- 小林 → 青年創業輔導與貸款說明（score >= 70）

## 核心概念

**Markdown Skills** 是 Agent 能力說明層。`skill` 一詞只指 `skills/*/SKILL.md`，用來描述使用時機、input/output，以及要呼叫哪個 tool wrapper 或 MCP tool。

**Tool Wrappers** 是 TypeScript 執行層。目前讀假資料，之後改接 Firebase、MCP 或外部 API 時，pipeline 不用改。

**Pipeline** 負責串接 tool wrappers 和 Claude，本身不碰任何資料庫或通知系統。

**ThreadMessage** 是交給 User Agent 的內容來源。Gov Agent 建立媒合後不直接通知使用者，而是產生 initial `ThreadMessage`；後續由 User Agent 讀取 message，整理成通知或 App 內摘要給使用者。

**Managed Agent Registry** 記錄可重用的 Claude `agentId`、`environmentId` 和 `sessionId`。同一個政府機關預設重用同一組 Managed Agent 資源，避免每次執行都建立新的 agent / environment / session。
