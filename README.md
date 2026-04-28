<p align="center">
  <img src="https://img.shields.io/badge/2026_YTP_黑客松-賽題_B：行善台北-4CAF50?style=for-the-badge" alt="YTP Badge"/>
</p>

<h1 align="center">MATCHA — Match with Agent</h1>
<p align="center"><b>讓 AI Agent 替你去社交，讓資源主動找到你</b></p>
<p align="center">隊伍：PV=NTR</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node"/>
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TS"/>
  <img src="https://img.shields.io/badge/Claude_API-Managed_Agents-6B4FBB?logo=anthropic&logoColor=white" alt="Claude"/>
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black" alt="Firebase"/>
  <img src="https://img.shields.io/badge/React_Native-Expo-000020?logo=expo&logoColor=white" alt="Expo"/>
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white" alt="Next.js"/>
</p>

---

## 30 秒看懂這個專案

<!-- TODO: 替換成實際截圖或 demo 影片 -->
<!-- <video src="docs/videos/demo-full.mp4" controls width="600"></video> -->
![截圖](asset/overview_screenshot.png)

MATCHA — Match with Agent (賽題B)
人生中最關鍵的機會資源大多來自人脈、社交網路
MATCHA 的解法不是做一個「更好的搜尋引擎」，而是建立一個 **AI 代理社交網路**：

主要功能：
- **Persona Chat**：跟 AI 聊天建立個人畫像，用 Swipe 卡片快速收斂偏好
- **自動媒合**：每個政府資源各有一個 AI Agent，主動讀取青年畫像、比對資格、推送媒合通知（含分數與理由）
- **Coffee Chat**：AI 自動配對背景相似的青年，促成同儕交流與經驗分享

```mermaid
graph LR

    APP["🧑 使用者App<br/>(RN / Expo)"]
    CH["📢 Channel<br/>(社群頻道)"]
    GOV["🏛️ Gov Agent<br/>(x N 個資源)"]

    APP -->|"廣播需求"| CH
    CH -->|"收到媒合通知"| APP
    GOV -->|"資源逐一媒合回覆"| CH

    APP -->|"追問資源細節<br/>(Follow-Up Agent)"| QA
    APP -->|"配對相似青年<br/>(Coffee Agent)"| APP

```

---

## TL;DR

| 面向 | 說明 |
|------|------|
| **解什麼問題** | 台北市青年面對大量政策計畫存在嚴重資訊不對稱，搜尋成本極高；政府端擁有資源卻無法有效觸及目標青年 |
| **怎麼解** | 多 Agent 代理社交——每個青年有 Persona Agent 建立畫像並廣播，每個政府資源有 Gov Agent 主動評估媒合，Coffee Agent 配對相似青年互助 |
| **關鍵創新** | 不是「更好的搜尋」而是「代理社交」；分散式 Agent 避免 context rot；從「被動查詢」翻轉為「主動媒合」 |
| **技術棧** | React Native (Expo) + Next.js 15 + Express + Claude Managed Agents (Sessions API) + Firestore + Redis |
| **資料來源** | 台北市青年局公開政策文件（PDF）、data.taipei 開放資料 |

---

## Illustration Video

### User Side

[![User Side Demo](asset/user_video.gif)](asset/user_video.mp4)

### Government Side

[![Government Side Demo](asset/gov_video.gif)](asset/gov_video.mp4)

---

## 使用說明

### 市民端（React Native App）

1. 登入後進入 **Persona Chat**，跟「媒伴」Agent 聊天建立個人畫像
2. 可切換到 **職涯羅盤**（Swipe 模式），像交友軟體一樣快速回答偏好問題，提升推薦精準度
3. Agent 準備好後會自動將 persona 廣播到 Channel，觸發資源媒合
4. 在 **媒合通知** 頁面查看 Gov Agent 的配對結果（符合度 + 理由），可追問資源細節
5. 在 **Coffee Chat** 查看被配對的相似青年，閱讀去識別化的交流摘要
6. 政府承辦人開啟真人對話後，在 **Human Thread** 頁面即時聊天

### 政府端（Next.js Dashboard）

1. 在 **Resources** 管理政府資源，上傳 PDF/Markdown 文件（後端自動解析文字）
2. 在 **Dashboard** 查看媒合統計——總回覆數、平均分數、開話率、分數分佈、資源熱度
3. 在 **Channel Replies** 檢視 AI 媒合結果，可依分數篩選
4. 點擊 **「開啟對話」** 建立 Human Thread，與市民一對一即時溝通

---

## 專案架構圖


```mermaid
graph LR

    %% ===== 使用者端 =====
    subgraph USER["👤 使用者端 App — React Native"]
        direction TB
        U1["💬 聊天 Agent"]
        U2["🔔 媒合通知"]
        U3["🃏 滑卡測驗"]
        U4["☕ Coffee Chat"]
    end

    %% ===== 後端 =====
    subgraph BACKEND["⚙️ 後端 — Express.js"]
        direction TB

        subgraph FIREBASE["🗄️ Firebase"]
            direction LR
            DB1[("💬 聊天室")]
            DB2[("👤 User 背景")]
            DB3[("📊 統計資料")]
            DB4[("📁 資源文件")]
        end

        subgraph CLAUDE["🤖 Claude Managed Agent"]
            direction LR
            UA["🧑 User Agent"]
            RA["🏛️ Resource Agent"]
        end
    end

    %% ===== 政府端 =====
    subgraph GOV["🏛️ 政府端 — Next.js"]
        direction TB
        G1["📊 數據儀錶板"]
        G2["💬 社交紀錄"]
        G3["📁 資源管理"]
    end

    %% ── 使用者端 → User Agent ──
    U1 <-->|"對話建立 Persona"| UA
    U3 <-->|"根據缺漏背景訊息發問"| UA
    U4 <-->|"紀錄agent coffee chat"| UA
    UA <-->|"同儕配對聊天"| UA
    U2 -->|"查看媒合結果"| DB1

    %% ── 政府端 → 後端 ──
    G1 -->|"查看媒合統計"| DB3
    G2 <-->|"真人對話紀錄"| DB1
    G3 -->|"上傳與管理資源"| DB4

    %% ── Agent → Firebase ──
    UA <-->|"更新使用者背景"| DB2
    UA -->|"廣播需求到頻道"| DB1
    RA -->|"讀取資源條件"| DB4
    RA -->|"寫入媒合統計資料"| DB3

    %% ── 觸發鏈 ──
    DB1 -.->|"觸發資源媒合評估"| RA

    %% ── 樣式 ──
    classDef userStyle fill:#E6F1FB,stroke:#185FA5,color:#0C447C
    classDef govStyle fill:#EAF3DE,stroke:#3B6D11,color:#27500A
    classDef dbStyle fill:#FAEEDA,stroke:#854F0B,color:#633806
    classDef agentStyle fill:#E6F1FB,stroke:#185FA5,color:#0C447C

    class U1,U2,U3,U4 userStyle
    class G1,G2,G3 govStyle
    class DB1,DB2,DB3,DB4 dbStyle
    class UA,RA agentStyle
```


---

## Monorepo 結構


```
matcha/
├── apps/
│   ├── user/frontend/     ← 市民 App（React Native + Expo）
│   └── gov/               ← 政府 Dashboard（Next.js 15）
├── services/
│   └── api/               ← 後端 API + AI Agents（Express + TypeScript）
│       └── src/
│           ├── agent/     ← Persona / Gov / Coffee Agent 實作
│           ├── lib/       ← Firebase / Redis / Anthropic client
│           ├── routes/    ← REST API endpoints
│           ├── ws/        ← WebSocket handler
│           └── mock/      ← Mock server（前端開發用）
├── packages/
│   └── shared-types/      ← 三端共用 TypeScript 型別
├── data/                  ← 政府資源原始資料（PDF + metadata）
└── pnpm-workspace.yaml
```

---

## 環境設置

### 前置需求



- **Node.js** >= 20
- **pnpm** >= 8（`npm install -g pnpm`）
- **Anthropic API Key**（Claude API，Agent 功能必需）
- **Firebase 專案**（Firestore + Auth，全功能必需；僅跑 in-memory 模式可跳過）
- **Upstash Redis**（Agent session 快取，全功能必需）

### 1. 安裝依賴

```bash
pnpm install
```

### 2. 設定環境變數

```bash
cp services/api/.env.example services/api/.env
```

編輯 `services/api/.env`：

```env
# ── 必填（AI Agent 功能）────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Claude Managed Agents（首次執行 setup 腳本產生）──
MANAGED_ENV_ID=
PERSONA_AGENT_ID=
COFFEE_AGENT_ID=

# ── Firebase Admin SDK ─────────────────────────
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_REALTIME_DB_URL=https://your-project.firebaseio.com

# ── Upstash Redis ──────────────────────────────
UPSTASH_REDIS_URL=rediss://default:<token>@<host>:6380

# ── Server ─────────────────────────────────────
PORT=3000
NODE_ENV=development
```

> **最小開發模式**（不需要 Firebase / Claude）：只填 `PORT=3000` 和 `NODE_ENV=development`，後端會使用 in-memory seed data。

### 3. 初始化 Managed Agents（首次）





```bash
cd services/api
npx tsx src/agents/user/setup.ts --init
```

把輸出的 `MANAGED_ENV_ID`、`PERSONA_AGENT_ID`、`COFFEE_AGENT_ID` 貼回 `.env`。

### 4. 上傳政府資源資料

```bash
# 上傳 data/ 目錄下所有資源到 Firestore
node data/upload.js --all

# 或指定單一資源
node data/upload.js 青年創業共享空間租賃補助作業要點
```

### 5. 啟動服務

```bash
# 後端 API（http://localhost:3000）
pnpm dev:api

# 政府 Dashboard（http://localhost:3001）
pnpm dev:web

# 市民 App（Expo）
pnpm dev:mobile
```

啟動後可驗證：
- Health check: `GET http://localhost:3000/health`
- WebSocket: `ws://localhost:3000/ws?token=uid-abc`

---

### 常用指令

```bash
# ── 開發 ────────────────────────────────
pnpm dev:api                          # 後端 API（port 3000）
pnpm dev:web                          # 政府 Dashboard
pnpm dev:mobile                       # 市民 App（Expo）
pnpm --filter api dev:mock            # Mock server（port 3001）

# ── 建置 ────────────────────────────────
pnpm build:types                      # 編譯 shared-types
pnpm --filter api build               # 編譯後端

# ── 測試與工具 ──────────────────────────
pnpm --filter api gov:test            # Gov Agent pipeline 測試
pnpm --filter api gov:upload-resources # 批次上傳 data/ 到 Firestore
```

### API 文件

完整 REST API 與 WebSocket 事件合約見 [`api-doc.md`](./api-doc.md)。

---

## 評分維度自評

### 1. 技術實作 / 功能完整度

**AI 應用深度**
- 使用 Claude **Managed Agents（Sessions API）** 實作三個獨立 Agent，非單純 prompt → response 的 wrapper
- 每個 Agent 有持久記憶（Session + Redis TTL 24h）、自有工具集（Firestore CRUD）、獨立 system prompt
- Gov Agent 支援 RAG：讀取政府上傳的 PDF 文件文字，對照市民 persona 進行結構化媒合評估（0–100 分 + 理由 + 缺漏資訊）
- 分散式 Agent 架構避免 context rot——每個 Agent 只處理小範圍的 context（一個資源或一個使用者），不靠單一大模型搜全部
- Follow-Up Agent 支援多輪追問，session 複用讓市民可以對同一資源連續提問

**系統穩定性**
- 冪等觸發機制（`gov_agent_runs/{messageId}`）防止重複處理同一 channel message
- 可控的並行度（`GOV_AGENT_CONCURRENCY` 環境變數）
- In-memory fallback 模式：不接 Firebase/Claude 也能跑完整 API，供前端獨立開發

### 2. 創新性

**核心創新：代理社交**
- 不是「更好的搜尋引擎」——是根本性地翻轉了資源流動方向：從「人找資源」變成「資源找人」
- 靈感來自 LinkedIn 的核心觀察：人生中最關鍵的機會來自社群推薦而非主動搜尋。MATCHA 用 AI Agent 低成本地複製了這個社交過程

**分散式 Agent 作為架構創新**
- 傳統 LLM 搜索在資料量大時 context rot 導致精度下降；MATCHA 的每個 Agent 只精通一小塊 context，媒合發生在 Agent 間互動
- 新增資源只需新增一個 Agent，系統水平擴展，不需重新訓練或調整

**Coffee Chat：同儕連結**
- 不只是「人 ↔ 資源」媒合，還做「人 ↔ 人」媒合——讓迷惘的青年看到跟自己背景相似的人怎麼走過來的，提供傳統政府系統無法給予的同儕支持

### 3. 體驗與可用性

**UI 友善**
- 市民端以「聊天」為核心互動，零學習成本——不需要填表、不需要搜尋、不需要讀文件
- 職涯羅盤（Swipe 模式）模仿交友軟體的互動設計，幾秒鐘就能回答五個問題，讓 Agent 更了解使用者
- 媒合結果以卡片 + 百分比 + 一句話理由呈現，直覺好懂

**數據視覺化**
- 政府 Dashboard 提供：媒合統計（總回覆數、平均 matchScore、開話率）、分數分佈、Resource Agent 數量、市民數量、單一資源媒合統計

**弱勢包容性**
- 設計初衷就是為「不知道自己要什麼」的迷惘青年服務——這群人在傳統搜尋模式下完全被遺漏
- 對話式互動降低了資訊素養門檻：不需要知道「正確的關鍵字」就能被找到

### 4. 主題契合度

**行善台北**
- 直接針對台北市青年局的真實政策計畫（青創貸款、共享空間補助、實習津貼、留學貸款）做媒合
- 解決的核心問題就是賽題的核心：政府有豐富資源、青年有迫切需求，但中間的資訊不對稱讓這些資源形同虛設

**政府開放資料整合**
- 資料來源：台北市青年局官網公開文件、data.taipei 開放資料
- 政府端可自行上傳 PDF/Markdown，後端自動解析為文字供 Agent 查閱——不依賴靜態爬蟲，支援動態更新

### 5. 落地 / 商業化潛力

**實用性**
- 完整的端到端流程已實作：從市民建立 persona → 資源自動媒合 → 追問細節 → 承辦人開啟真人對話
- 資源管理介面讓政府端無需技術背景即可新增/更新資源

**商業可行性**
- **算力套利人力**：以低廉的雲端推論成本，大幅減輕第一線人員負擔，替代高昂的真人諮詢工時
- **活化政策預算**：自動化媒合精準提升觸及率，解決資源閒置的痛點，極大化政府預算實質影響力
- 主要推論負擔集中在政府端 Agent，政府可控制資源分配

**擴展性**
- 多 Agent 插件式架構：新增一個政府資源只需新增一個 Agent + 上傳文件，不需修改系統
- 可從台北市擴展到全台，甚至應用於其他政策領域（社福、衛生、教育）
- 未來可接入民間企業（實習機會、培訓課程），生態自然成長

**社會影響力**
- 當一個青年因為搜尋成本太高而放棄，不僅是個人損失，更是整個社會的損失。MATCHA 將搜尋成本降至接近零，讓每個人都有機會被看見，讓每個資源都能找到它該去的地方

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [`intro.md`](./intro.md) | 完整專案介紹（動機 → 情境 → 架構 → 技術細節） |
| [`api-doc.md`](./api-doc.md) | REST API + WebSocket 完整合約 |
| [`plan.md`](./plan.md) | 開發計畫與 Agent 實作細節 |

---

<p align="center"><b>政府擁有豐富的資源，青年擁有迫切的需求，但中間缺少的從來不是「搜尋引擎」，而是「社群」。</b></p>
<p align="center">MATCHA 讓 AI Agent 建立一個 24 小時運作的職涯社群，代替青年去社交、代替政府去尋找。<br/>在這個社群中，每個人都能被看見，每個資源都能找到它該去的地方。</p>
