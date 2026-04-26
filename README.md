# MATCHA — Match with Agent

> AI Agent 代理社交，讓資源主動找到你

**賽題分類**：賽題 B · 行善台北
**團隊**：PV=NTR

---

## 30 秒看懂這個專案

<!-- TODO: 替換成實際截圖或 demo 影片 -->
<!-- <video src="docs/videos/demo-full.mp4" controls width="600"></video> -->
<!-- ![截圖](docs/screenshots/overview.png) -->

我們做了 **AI 代理社交平台** 給 **迷惘的台北青年** 用，解決 **政府資源豐富但青年搜尋成本太高、資訊不對稱** 的問題。

主要功能：
- **Persona Chat**：跟 AI 聊天建立個人畫像，用 Swipe 卡片快速收斂偏好
- **自動媒合**：每個政府資源各有一個 AI Agent，主動讀取青年畫像、比對資格、推送媒合通知（含分數與理由）
- **Coffee Chat**：AI 自動配對背景相似的青年，促成同儕交流與經驗分享

---

## 解決什麼問題

台北市青年局網站有 47 個計畫，但青年打開看兩個就放棄了——搜尋成本太高、申請資格看不懂。政府端則是擁有資源卻觸及不到人，第一線人員專業不對口、人力不足。

**MATCHA 的核心洞察**：人生中最關鍵的機會來自社群推薦，不是搜尋引擎。我們用 AI Agent 複製這個過程——每個青年有「媒伴」Agent 代替你社交，每個政府資源也有 Agent 主動找人。**從「人找資源」翻轉為「資源找人」。**

與既有方案的差異：不是做更好的搜尋引擎或推薦系統，而是建立一個 **分散式 Agent 社群**——每個 Agent 只精通一小塊 context，避免單一大模型的 context rot 問題，媒合更精準且可水平擴展。

---

## Demo 影片

<!-- TODO: 錄製後替換 -->
<!-- <video src="docs/videos/demo-persona-chat.mp4" controls width="600"></video> -->
<!-- <video src="docs/videos/demo-matching.mp4" controls width="600"></video> -->
<!-- <video src="docs/videos/demo-gov-dashboard.mp4" controls width="600"></video> -->

**Demo 路徑（市民端）：**
1. 打開 App → 進入 Persona Chat → 跟 AI 對話 3–5 輪建立畫像
2. 切換到 Swipe 模式 → 左滑右滑回答偏好卡片 → Agent 精準度提升
3. Agent 自動廣播 persona → 後台所有 Gov Agent 同時評估
4. 打開「媒合通知」→ 看到 3 筆資源推薦（附分數 + 理由）→ 點擊追問細節
5. 承辦人在 Dashboard 點「開啟對話」→ 市民進入即時聊天

**Demo 路徑（政府端）：**
1. 登入 Dashboard → 查看媒合統計（總回覆數、平均分數、開話率）
2. Resources 頁面 → 上傳 PDF 文件（後端自動解析供 Agent 查閱）
3. Channel Replies → 檢視 AI 媒合結果 → 點「開啟對話」與市民溝通

---

## 系統架構

```mermaid
graph TB
    subgraph "市民端 — React Native + Expo"
        CHAT["Persona Chat<br/>(含 Swipe 模式)"]
        NOTIF["媒合通知<br/>(HTTP Polling)"]
        COFFEE["Coffee Chat"]
    end

    subgraph "政府端 — Next.js 15"
        DASH["Dashboard<br/>(統計 + 媒合列表)"]
        THREAD["Human Thread"]
        UPLOAD["資源管理<br/>(PDF 上傳)"]
    end

    subgraph "後端 — Express + TypeScript"
        API["REST + WebSocket API"]
        PA["Persona Agent"]
        GA["Gov Agent × N"]
        CA["Coffee Agent"]
    end

    subgraph "AI — Claude Managed Agents"
        CLAUDE["Claude Sessions API<br/>(持久記憶 + Tool Use)"]
    end

    subgraph "儲存"
        FS["Firestore<br/>(personas, channel_messages,<br/>channel_replies, gov_resources,<br/>human_threads, peer_threads)"]
        REDIS["Upstash Redis<br/>(Session ID 快取)"]
    end

    CHAT -->|"WS: persona_message"| API
    NOTIF -->|"GET /me/channel-replies"| API
    COFFEE -->|"WS: peer_message"| API
    DASH -->|"GET /gov/dashboard"| API
    THREAD -->|"WS: human_message"| API
    UPLOAD -->|"POST /gov/resources/:rid/documents"| API

    API --> PA
    API --> GA
    API --> CA

    PA --> CLAUDE
    GA --> CLAUDE
    CA --> CLAUDE

    PA --> FS
    GA -->|"讀資源文件 + 寫媒合回覆"| FS
    CA -->|"讀 personas + 建配對"| FS

    PA --> REDIS
    GA --> REDIS
    CA --> REDIS
```

### 媒合流程

```mermaid
sequenceDiagram
    participant U as 青年 App
    participant PA as Persona Agent
    participant CH as Channel (Firestore)
    participant GA as Gov Agent × N
    participant GOV as 政府 Dashboard

    U->>PA: 聊天建立畫像
    PA->>PA: update_persona
    PA->>CH: publish_to_channel
    CH-->>GA: 新訊息觸發（並行）
    GA->>GA: query_resource_pdf + assess_fit
    GA->>CH: write_channel_reply (score + 理由)
    U->>CH: GET /me/channel-replies (Polling)
    CH-->>U: 「青年創業貸款 — 92%」
    U->>GA: POST /api/resource-followup (追問)
    GA-->>U: 即時回答
    GOV->>CH: GET /gov/channel-replies
    GOV->>GOV: 點擊「開啟對話」
    GOV->>U: Human Thread (WebSocket 即時聊天)
```

---

## 快速啟動

```bash
# 1. 安裝依賴
pnpm install

# 2. 設定環境變數（最小模式只需 PORT + NODE_ENV，使用 in-memory 假資料）
cp services/api/.env.example services/api/.env

# 3. 啟動後端 API（http://localhost:3000）
pnpm dev:api

# 4. 啟動政府 Dashboard（http://localhost:3001）
pnpm dev:web

# 5. 啟動市民 App（Expo）
pnpm dev:mobile
```

> 完整環境設定（Firebase / Claude API / Redis）見下方「環境設置」段落。

---

## 功能列表

| 功能 | 說明 | 對應檔案 / 路由 |
|------|------|---------------|
| **Persona Chat** | 與 AI 對話建立個人畫像 | `services/api/src/agent/persona/` · WS `persona_message` |
| **Swipe 模式** | 類交友軟體的快速偏好收集 | `apps/user/frontend/app/(tabs)/card.tsx` |
| **Persona 廣播** | Agent 自動將畫像發到 Channel | `publish_to_channel` tool · `channel_messages` collection |
| **Gov Agent 媒合** | 每個資源 Agent 讀取文件、評估配對度 0–100 | `services/api/src/agent/gov/` · `POST /gov/agent/run-message` |
| **媒合通知** | 市民 Polling 查看推薦結果 | `GET /me/channel-replies` · `apps/user/frontend/app/notifications.tsx` |
| **資源追問** | 市民對媒合結果追問，Agent 查文件回答 | `POST /api/resource-followup` · `services/api/src/agent/gov/pipeline.ts` |
| **Coffee Chat** | AI 配對相似青年、代理破冰聊天 | `services/api/src/agent/coffee/` · WS `peer_message` |
| **Human Thread** | 承辦人開啟真人對話 | `POST /gov/channel-replies/:id/open` · WS `human_message` |
| **政府 Dashboard** | 媒合統計、資源管理、Channel 視覺化 | `apps/gov/src/app/dashboard/` · `GET /gov/dashboard/*` |
| **資源文件上傳** | 上傳 PDF/Markdown，後端自動解析為文字 | `POST /gov/resources/:rid/documents` |
| **媒合統計** | 全域 / 單一資源的媒合次數與成功率 | `GET /gov/dashboard/stats` · `match_stats` collection |

---

## 技術棧

| 層級 | 技術 | 用途 |
|------|------|------|
| 市民 App | React Native + Expo + NativeWind | 跨平台手機 App |
| 政府 Dashboard | Next.js 15 + App Router | Web 管理介面 |
| 後端 | Express (Node.js + TypeScript) | REST API + WebSocket + Agent 呼叫 |
| AI | Claude Managed Agents (Sessions API) | 三個 Agent 的持久記憶 + Tool Use |
| 認證 | Firebase Auth | 雙端共用登入 |
| 資料庫 | Firestore | 所有業務資料（personas、replies、threads、resources） |
| 快取 | Upstash Redis | Agent session ID 映射（TTL 24h） |
| 文件解析 | PDF / HTML / XLSX / Markdown parser | 政府上傳文件轉文字供 Agent 查閱 |
| Monorepo | pnpm workspaces + shared-types | 三端共用 TypeScript 型別 |

---

## 資料來源

| 來源 | 內容 | 整合方式 |
|------|------|---------|
| 台北市政府青年局官網 | 青創貸款、共享空間補助、實習津貼、留學貸款等政策文件（PDF） | 政府端上傳 → 後端解析文字 → 存入 Firestore → Gov Agent `query_resource_pdf` 查閱 |
| data.taipei | 青年局相關政策、計畫、統計資料 | 結構化為 `gov_resources` metadata |

目前已入庫的資源：
- 臺北市青年創業融資貸款（實施要點 + 不予核貸條件）
- 青年創業共享空間租賃補助（作業要點 + QA）
- 青年實習津貼計畫（計畫書 + QA）
- 青年留學貸款

---

## 環境設置

### 前置需求

- **Node.js** >= 20 · **pnpm** >= 8
- **Anthropic API Key**（Claude API，Agent 功能必需）
- **Firebase 專案**（Firestore + Auth；僅跑 in-memory 模式可跳過）
- **Upstash Redis**（Agent session 快取；僅跑 in-memory 模式可跳過）

### 環境變數

```bash
cp services/api/.env.example services/api/.env
```

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Claude Managed Agents（首次執行 setup 腳本產生）
MANAGED_ENV_ID=
PERSONA_AGENT_ID=
COFFEE_AGENT_ID=

# Firebase Admin SDK
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Upstash Redis
UPSTASH_REDIS_URL=rediss://default:<token>@<host>:6380

# Server
PORT=3000
NODE_ENV=development
```

### 初始化 Managed Agents（首次）

```bash
cd services/api && npx tsx src/agents/user/setup.ts --init
# 把輸出的 ID 貼回 .env
```

### 上傳政府資源

```bash
node data/upload.js --all          # 上傳全部
node data/upload.js --dry-run --all # 預覽不上傳
```

---

## Monorepo 結構

```
matcha/
├── apps/
│   ├── user/frontend/        ← 市民 App（React Native + Expo）
│   └── gov/                  ← 政府 Dashboard（Next.js 15）
├── services/
│   └── api/                  ← 後端 API + AI Agents（Express）
│       └── src/
│           ├── agent/        ← persona / gov / coffee Agent 實作
│           ├── lib/          ← Firebase / Redis / Anthropic / Repos
│           ├── routes/       ← REST endpoints
│           └── ws/           ← WebSocket handler
├── packages/
│   └── shared-types/         ← 三端共用 TypeScript 型別
├── data/                     ← 政府資源原始資料（PDF + metadata）
├── docs/                     ← 簡報 PDF、Demo 影片、架構圖
└── pnpm-workspace.yaml
```

---

## 團隊與分工

| 組別 | 負責範圍 | 技術 |
|------|---------|------|
| **Group A** | 市民 App（Persona Chat、Swipe、通知、Coffee Chat、Human Thread） | React Native + Expo |
| **Group B** | 政府 Dashboard（資源管理、媒合列表、統計視覺化、Human Thread） | Next.js 15 |
| **Group C** | 後端 API + 三個 AI Agent + Firebase 整合 + WebSocket | Express + Claude API |

協作機制：**Contract-First**——`shared-types` 先定義型別 → Mock Server 讓前端第一天就能開發 → 逐步切換到真實 Agent 端點。

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [intro.md](./intro.md) | 完整專案介紹（動機、洞察、情境、架構、技術細節、評分維度分析） |
| [api-doc.md](./api-doc.md) | REST API + WebSocket 完整合約 |
| [plan.md](./plan.md) | 開發計畫與 Agent 實作規格 |
| [data/README.md](./data/README.md) | 政府資源資料格式與上傳說明 |
<!-- | [docs/slides.pdf](./docs/slides.pdf) | 決選簡報投影片 | -->
