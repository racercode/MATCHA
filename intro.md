# MATCHA — Match with Agent

> **讓 AI Agent 替你去社交，讓資源主動找到你。**
>
> 2026 YTP 黑客松 — 賽題 B：行善台北 | 隊伍：PV=NTR

---

## 一個迷惘的晚上

小雅，中文系大三，對未來完全沒有概念。同學們開始談實習、談研究所，她連自己想做什麼都不知道。

某天晚上，她打開台北市青年局網站，看到 47 個計畫連結，每個名字都很長，每個頁面都很複雜。她點了兩個，看不懂申請條件，也不確定自己符不符合。然後她關掉了瀏覽器，躺回床上，繼續看著天花板迷茫。

**這不是個案。這是無數台北青年的日常。**

政府擁有豐富的資源——實習媒合、轉職補助、創業貸款、職涯諮詢——但青年的搜尋成本太高，資訊不對稱讓這些資源形同虛設。而在另一端，政府第一線的職涯輔導人員每天接應大量青年，但常常專業不對口——一個擅長創業輔導的承辦人，面對想轉職設計的文組青年，很難給出最精準的建議。人力諮詢有上限，但青年的迷惘沒有。

---

## 問題分析

### 痛點拆解

| 角色 | 痛點 | 現況 |
|------|------|------|
| 迷惘青年 | 不知道自己想做什麼，不知道該怎麼尋找工作，也不知道政府有哪些資源可以幫助自己 | 面對大量政策計畫，存在嚴重資訊不對稱，搜尋成本極高，完全不知從何下手 |
| 政府人員 | 擁有資源卻無法有效對接迷惘青年，專業不對口、人力不足 | 第一線人員難以判斷優先級，總是被動等待青年上門，且職員不一定能接應到自己專長能幫助到的青年 |

### 為什麼這個問題很重要？

台北市每年投入大量預算於青年職涯發展，但政策觸及率始終低於預期。**問題的核心不是資源不足，而是資源與需求之間的「媒合失敗」。** 當一個青年因為搜尋成本太高而放棄，不僅是個人損失，更是整個社會的損失。

### 問題挑戰在哪？

- **如何深入了解使用者**：一線人員或現有推薦系統很難了解青年，並且給青年推薦需要的資源。青年自己常常也不確定自己要什麼，傳統問卷難以捕捉真實需求
- **如何做資源媒合**：政府資源分散、資料量大且異質性高（實習、補助、課程、貸款），難以用單一演算法匹配
- **如何讓 App 易用**：青年對官方 App 的耐心極低，介面必須像社群軟體一樣親切
- **如何讓政府端受益**：第一線人員需要減負，不是增加更多工具，因此要讓工具能自動化，並且讓一線人員精準接觸到需要幫忙的個案

---

## 動機與核心洞察

### 一個關鍵觀察

想一想你人生中那些最關鍵的機會——是搜尋引擎給你的，還是某個人在某個場合剛好推薦給你的？

大多數人的答案是後者。**資源的流動依賴社群和人際關係，而不是搜尋欄。** 這也是全球最大的職涯社群 LinkedIn 的核心理念：你加入一個社群，認識了幾個人，某天對方掌握了一個機會，剛好想到你，就推薦過來了。這種「被發現」的互動過程，比主動查詢更精準、更省力，也能接觸到更多使用者不知道的資源。

### 倚靠人際關係網的問題

但問題在於：維護人際關係需要時間和社交能量。對於正在迷惘的青年而言，這是一道很高的門檻。而對政府機關而言，也很難用社交的方式去與每一個青年建立關係並服務。

### 核心想法

> **想法很簡單：讓 AI Agent 替你去社交。**

我們的解法不是再做一個「更好的搜尋引擎」，而是建立一個**「代理社交」**的系統。每個青年擁有一個專屬的 AI Agent，它代替你去認識人、經營關係、搜集資訊；每個政府資源也各自有自己的 Agent，主動尋找符合條件的青年。這些 Agent 在一個共享的社群空間中互動、媒合、交換資訊，就像一個 24 小時運作的職涯社群。

從「被動查詢」轉為「主動媒合」——這就是 MATCHA 的核心理念。

### 為什麼用分散式 Agent，而不是一個大模型搜全部？

傳統做法是用搜尋引擎或單一 LLM 在大量資料庫裡搜索，但當 context 太大時，會產生 **context rot** 問題——搜索的精度會下降。

MATCHA 的做法不同：**每個 Agent 只負責一小塊 context**。每個政府資源有自己的 Agent，它只需要精通自己那份資源的申請條件和文件內容；每個青年也有自己的 Agent，它只需要深入了解這一個人。媒合發生在 Agent 與 Agent 之間的互動，而不是一個巨大模型試圖同時理解所有人和所有資源。

這帶來三個好處：
- **媒合更精準**：每個 Agent 處理小範圍的 context，不會因為單一模型負擔過重而降低品質
- **算力集中在政府端**：主要的推論負擔在政府資源 Agent，政府可以更好管理資源分配
- **可擴展**：新增一個政府資源，只需要新增一個 Agent，不需要重新訓練或調整整個系統

---

## 具體來說，使用者會看到什麼？

### 情境：小雅的一天

小雅下載了 MATCHA。第一次開啟時，她的專屬 Agent「媒伴」開始和她聊天：

> 「嗨！我是你的媒伴。先聊聊吧——你現在大概是什麼狀態？」

小雅說：「剛畢業，讀中文系，想跨去做設計，但不知道從哪裡開始。」媒伴不急著推薦任何計畫，而是繼續問：「聽起來你對設計有感覺，但還在探索方向。你說的設計比較偏視覺、產品、還是品牌這種感覺？」

**幾輪對話後，媒伴建立了小雅的初步畫像**：中文系畢業、對品牌設計和排版有興趣、住台北大安區、正在探索階段。

對話結束後，媒伴邀請小雅玩一下**職涯羅盤**：畫面上出現幾張卡片——「你比較想先累積作品集，還是先找實習？」「你能接受的通勤時間？」「薪資還是學習機會，哪個優先？」小雅像滑交友軟體一樣，幾秒鐘就回答了五個問題，媒伴的推薦精準度從 68% 跳到 85%。

**幾小時後，小雅收到一則通知：「3 個資源主動找上你」**——包括一個創意實習媒合平台（符合度 87%）、一個文組轉職培訓補助（符合度 92%）、一個職涯探索心理測驗（符合度 74%）。每筆資源都附上截止日期和一句話摘要。她不需要搜尋任何東西，資源就這樣找到了她。

小雅對「文組轉職培訓補助」很感興趣，直接在通知下方追問：「申請截止日期是什麼時候？需要準備什麼文件？」AI Agent 查閱該計畫的完整文件後即時回答。政府承辦人在 Dashboard 上看到這筆高分媒合，點了「開啟對話」——小雅收到通知，進入真人聊天室，直接跟承辦人一對一溝通。

**在小雅迷茫這麼多資源、自己該怎麼做時**，發現頁面下方有一個「Coffee Chat」的區塊亮起了紅點。原來媒伴已經幫她找到三位背景相似的使用者——一位同樣是文組轉設計、已經在接案的學姐；一位剛完成職訓課程的社會新鮮人。她讀到這些去識別化的聊天摘要，突然發覺原來這條路可以這樣走，並且真的有人走過，焦慮感少了一大半。

**睡前，小雅點開自己的個人檔案**，看到媒伴對她的理解程度：「職涯方向」72%、「技能偏好」58%、「生活條件」45%。頁面提示她：「再聊兩輪，我就能幫你找到更精準的資源。」小雅覺得自己正在被一點一點地理解，明天還想再打開這個 App。

**從小雅的角度，她只是跟 AI 聊了幾分鐘天，滑了幾張卡片，就收到了精準的資源推薦、看到了同路人的經驗、還跟承辦人搭上了線。** 她不需要自己搜尋、不需要自己判斷資格、不需要打電話問來問去。

---

## 系統怎麼運作的？——三種訊息流

MATCHA 的核心設計可以拆成三種獨立的訊息流，每一種都由不同的 AI Agent 驅動：

### 1. Persona Chat（建立個人檔案）

```
市民 ←→ Persona Agent
```

- 市民透過 App 跟 Persona Agent 對話
- Agent 一邊聊天，一邊在背後整理出一份結構化的 persona 摘要
- 除了一般對話，App 也有「Swipe 模式」——像 Tinder 那樣左滑右滑回答選擇題，快速蒐集偏好
- 聊得差不多了，Agent 會把 persona 摘要「廣播」到 Channel（一個所有 Agent 都能看到的公共空間）

### 2. Channel Matching（政府資源媒合）

```
Persona Agent → Channel ← Gov Agent（每個政府資源各一個）
```

- Persona Agent 把市民的摘要發到 Channel
- 每個政府資源都有自己的 Gov Agent，它們監聽 Channel 上的新訊息
- Gov Agent 讀取市民摘要，對照自己負責的資源的申請資格（包括 PDF 文件內容），給出 0–100 的配對分數和媒合理由
- 結果寫成 Channel Reply，市民定期刷新就能看到
- 市民收到媒合通知後，還可以針對該資源追問問題（Follow-Up），Agent 會查閱資源文件後回答
- 政府承辦人在 Dashboard 上看到高分媒合，可以決定是否開啟一對一的真人對話（Human Thread）

### 3. Coffee Chat（市民互相配對）

```
市民 A ←→ Coffee Agent ←→ 市民 B
```

- Coffee Agent 掃描 Channel 上所有市民的摘要，用語意比對找到興趣或需求相似的兩個人
- 自動建立 Peer Thread，並在聊天室裡當中間人，幫雙方破冰介紹
- 之後雙方的對話由 Coffee Agent 代理轉發，Agent 也可以適時促進對話

---

## 技術架構總覽

MATCHA 是一個 **pnpm monorepo**，分成三個主要工作區，分別對應三組開發團隊：

```
matcha/
├── apps/
│   ├── user/frontend/     ← Group A：React Native + Expo（市民 App）
│   └── gov/               ← Group B：Next.js 15（政府 Dashboard）
├── services/
│   └── api/               ← Group C：Express 後端 + AI Agents
└── packages/
    └── shared-types/      ← 三組共用的 TypeScript 型別定義
```

### 前端：市民 App（React Native + Expo）

市民端是一個跨平台的手機 App，主要頁面包括：

| 頁面 | 功能 |
|------|------|
| **Persona Chat** | 跟 AI 對話建立個人檔案，支援一般聊天與 Swipe 選擇題模式 |
| **媒合通知（Notifications）** | 定期 polling 查看 Gov Agent 的媒合結果，顯示配對度與理由；可追問細節 |
| **Coffee Chat** | 跟被配對的市民聊天，Coffee Agent 在中間代理 |
| **Human Threads** | 政府承辦人開啟的一對一真人對話 |
| **Profile / Settings** | 個人資料與設定 |

技術選型：React Native + Expo + TypeScript + NativeWind（Tailwind CSS for RN）。

### 前端：政府 Dashboard（Next.js 15）

政府端是一個 Web Dashboard，讓承辦人管理資源和處理媒合：

| 頁面 | 功能 |
|------|------|
| **Dashboard** | 媒合統計總覽——總回覆數、平均分數、開話率、分數分佈圖；Resource Agent 數量與市民數量 |
| **Resources** | 管理政府資源——新增/編輯資源、上傳 PDF 說明文件（後端自動解析文字供 Agent 查閱） |
| **Channel Replies** | 檢視所有 AI 媒合結果，可依分數篩選，點擊「開啟對話」建立 Human Thread |
| **Threads** | 管理進行中的真人對話，透過 WebSocket 即時聊天 |

技術選型：Next.js 15 App Router + TypeScript + Firebase Auth。

### 後端：Express API + AI Agents

後端負責所有商業邏輯、Agent 呼叫、WebSocket 即時通訊和資料存取：

```
services/api/src/
├── agent/
│   ├── persona/       ← Persona Agent：對話管理 + persona 維護 + 廣播
│   ├── gov/           ← Gov Agent：讀取資源文件 + 評估媒合度 + 寫入回覆
│   ├── coffee/        ← Coffee Agent：掃描配對 + 建立 Peer Thread + 代理聊天
│   └── general/       ← Agent 註冊與管理工具
├── lib/               ← Firebase / Redis / Anthropic client / 各 collection 的 Repository
├── routes/            ← REST API endpoints
├── ws/                ← WebSocket handler + push
├── middleware/        ← Auth middleware
└── mock/              ← Mock server（供前端開發期間使用）
```

#### AI Agent 的運作方式

MATCHA 使用 **Claude Managed Agents**（Anthropic 的 Sessions API）來實作三個 Agent。每個 Agent 都是一個有持續記憶的 AI 實體：

- **Environment**：一次性建立的雲端容器設定
- **Agent**：定義模型、系統提示詞、可用工具（每種 Agent 各建一個）
- **Session**：每個使用者/資源/對話各自一個，透過 Redis 快取 session ID，讓同一個市民在 24 小時內的對話都保持上下文

```
Redis 快取結構：
  session:persona:{uid}       → 一位市民一個 Persona Agent session
  session:gov:{resourceId}    → 一個政府資源一個 Gov Agent session
  session:coffee:{threadId}   → 一個 Peer Thread 一個 Coffee Agent session
```

每個 Agent 都有自己的「技能」（Tools），這些技能對應到具體的 Firestore 讀寫操作：

| Agent | 技能 | 做什麼 |
|-------|------|--------|
| Persona Agent | `get_my_persona` | 讀取使用者的 persona |
| | `update_persona` | 更新 persona 摘要 |
| | `publish_to_channel` | 把 persona 廣播到 Channel，觸發 Gov Agent 和 Coffee Agent |
| Gov Agent | `query_resource_pdf` | 讀取資源的 PDF 文件內容 |
| | `assess_fit` | 評估市民與資源的媒合度（0–100 分） |
| | `write_channel_reply` | 寫入媒合結果 |
| Coffee Agent | `read_channel_messages` | 掃描近期的市民摘要 |
| | `propose_peer_match` | 建立配對 |
| | `relay_message` | 在配對聊天中代理轉發訊息 |

#### 通訊架構：WebSocket + HTTP Polling

MATCHA 把「即時聊天」和「通知發現」拆成兩種不同的通訊方式：

| 情境 | 方式 | 原因 |
|------|------|------|
| Persona Chat、Coffee Chat、Human Thread 的訊息 | **WebSocket** | 需要即時串流，一句一句地推到畫面上 |
| 媒合結果、新的 Peer Thread、新的 Human Thread | **HTTP Polling** | 不需要即時，市民每 10–30 秒刷新一次即可；降低 WS 複雜度 |

所有 WebSocket 事件共用同一條連線（`ws://host/ws?token=<uid>`），透過 `type` 欄位區分事件類型。

### 資料層：Firestore + Redis

| 儲存 | 用途 |
|------|------|
| **Firestore** | 所有持久化資料——personas、channel_messages、channel_replies、human_threads、peer_threads、gov_resources 及其子集合 documents |
| **Upstash Redis** | 唯一用途是快取 Agent 的 session ID，讓同一個使用者不用每次重建對話（TTL 24 小時） |
| **Firebase Auth** | 市民端和政府端共用的登入機制 |

核心資料模型：

```
Firestore
├── personas/{uid}                         ← 市民的 AI 整理摘要
├── channel_messages/{msgId}               ← Persona Agent 廣播的市民需求
├── channel_replies/{replyId}              ← Gov Agent 的媒合回覆（含 matchScore）
├── human_threads/{tid}                    ← 政府承辦人開啟的真人對話
│   └── messages/{mid}                     ← 對話訊息
├── peer_threads/{tid}                     ← Coffee Agent 配對的市民對話
│   └── messages/{mid}                     ← 對話訊息
├── gov_resources/{rid}                    ← 政府資源定義
│   └── documents/{docId}                  ← 資源的文件文字（PDF 解析後）
├── match_stats/{resourceId}               ← 各資源的媒合統計
└── gov_agent_runs/{messageId}             ← 防止重複觸發的冪等紀錄
```

---

## API 設計概覽

後端提供完整的 REST API，依角色分為市民端和政府端：

**市民端：**
- `GET /me/persona` — 取得自己的 persona
- `GET /me/channel-replies` — [Polling] 查看 AI 媒合通知
- `GET /me/peer-threads` — [Polling] 查看 Coffee Agent 配對
- `GET /me/human-threads` — [Polling] 查看政府開啟的對話
- `POST /api/resource-followup` — 對媒合通知追問細節

**政府端：**
- `GET /gov/channel-replies` — [Polling] 所有媒合結果（Dashboard 用）
- `POST /gov/channel-replies/:replyId/open` — 對高分媒合開啟真人對話
- `GET /gov/resources` / `POST /gov/resources` — 資源 CRUD
- `POST /gov/resources/:rid/documents` — 上傳資源文件（PDF/Markdown/HTML/XLSX）
- `GET /gov/dashboard` / `GET /gov/dashboard/stats` — 媒合統計
- `POST /gov/agent/run-message` — Firebase trigger，新 channel message 寫入後觸發所有 Gov Agent 評估

**共用：**
- `POST /auth/verify` — Firebase token 驗證
- `GET /human-threads/:tid/messages` / `GET /peer-threads/:tid/messages` — 歷史訊息

所有回應統一格式：`{ success: boolean, data: T }` 或 `{ success: false, error: string }`。

---

## 開發分工與協作機制

這是一個黑客松專案，團隊分成三組同步開發：

| 組別 | 負責 | 技術 |
|------|------|------|
| **Group A** | 市民 App | React Native + Expo |
| **Group B** | 政府 Dashboard | Next.js 15 |
| **Group C** | 後端 + AI Agents | Express + Claude API + Firebase |

為了讓三組能平行開發而不互相卡住，採用 **Contract-First** 策略：

1. **shared-types 先行**：所有 TypeScript 介面定義放在 `packages/shared-types/`，三組共用，改動需全員 review
2. **Mock Server**：Group C 在 Day 1 提供假資料的 mock server，讓 Group A/B 可以先對著假資料開發 UI
3. **逐步切換**：Day 2 上午 Persona Agent 上線，Group A 切到真實端點；Day 2 下午 Gov + Coffee Agent 上線，Group B 接上

---

## Demo Flow（完整走一遍）

### Path 1 — 政府資源媒合

```
① 市民登入 App → Persona Agent 開始對話，問 3–5 個問題了解狀況
② 市民可選擇用 Swipe 模式快速回答選擇題 → Persona Agent 整理 persona 摘要
③ Persona Agent 呼叫 publish_to_channel → 摘要寫入 Firestore channel_messages
④ 後端觸發所有 Gov Agent（每個政府資源各一個）→ 各自讀取資源文件 + 評估媒合度
⑤ Gov Agent 寫入 channel_replies（例如：配對度 87 分 + 媒合理由）
⑥ 市民刷新媒合通知 → 看到「青年就業促進計畫 — 87%」→ 可追問細節
⑦ 承辦人在 Dashboard 看到高分媒合 → 點「開啟對話」→ 建立 Human Thread
⑧ 市民收到新對話通知 → 進入即時聊天室 → 跟承辦人一對一溝通
```

### Path 2 — 市民互相配對

```
① 市民 A 建立 persona → 廣播到 Channel
② Coffee Agent 掃描 Channel，發現市民 B 的興趣高度相似
③ Coffee Agent 建立 Peer Thread，寫入配對理由
④ 市民 A/B 各自刷新 peer-threads → 發現新的配對
⑤ 進入 Coffee Chat → Coffee Agent 先幫雙方破冰介紹
⑥ 雙方開始即時聊天，Coffee Agent 在必要時介入促進對話
```

---

## 技術棧一覽

| 層級 | 技術 | 用途 |
|------|------|------|
| 市民 App | React Native + Expo + NativeWind | 跨平台手機 App |
| 政府 Dashboard | Next.js 15 + App Router | Web 管理介面 |
| 後端 | Express (Node.js + TypeScript) | REST API + WebSocket + Agent 呼叫 |
| AI | Claude Managed Agents (Sessions API) | 三個 Agent 的對話管理與工具呼叫 |
| 認證 | Firebase Auth | 市民端與政府端共用 |
| 資料庫 | Firestore | 所有業務資料 |
| 快取 | Upstash Redis | Agent session ID 映射 |
| 文件解析 | 後端 PDF/HTML/XLSX parser | 政府上傳的文件轉成文字供 Agent 查閱 |
| Monorepo | pnpm workspaces | 共用型別、統一依賴管理 |
