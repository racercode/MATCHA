# MATCHA

## 後端 API 啟動

專案使用 pnpm workspace，後端在 `services/api`。

### 1. 安裝依賴

```powershell
pnpm install
```

### 2. 建立後端 `.env`

```powershell
Copy-Item services\api\.env.example services\api\.env
```

最小開發模式可以先只保留 server 設定：

```env
PORT=3000
NODE_ENV=development
```

這種模式會使用 in-memory seed data，不需要 Firebase；API 文件中的 token 先用 raw uid，例如 `uid-abc`、`gov001`。

### 3. 啟動 API server

```powershell
pnpm dev:api
```

啟動後：

- REST API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`
- Health check: `http://localhost:3000/health`

如果想同時啟動 mock server：

```powershell
pnpm --filter api dev:mock
```

mock server 會跑在 `http://localhost:3001`。

## 後端 `.env` 設定

`.env` 放在 `services/api/.env`，可參考 `services/api/.env.example`。

```env
# Claude API
ANTHROPIC_API_KEY=

# Claude Managed Agents
MANAGED_ENV_ID=
PERSONA_AGENT_ID=
COFFEE_AGENT_ID=

# Firebase Admin SDK
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_REALTIME_DB_URL=

# Upstash Redis
UPSTASH_REDIS_URL=

# Server
PORT=3000
NODE_ENV=development
```

### 常用設定說明

- `ANTHROPIC_API_KEY`: 跑 Claude / Gov Agent pipeline 時需要；只開一般 in-memory API 可以先留空。
- `MANAGED_ENV_ID`, `PERSONA_AGENT_ID`, `COFFEE_AGENT_ID`: Persona / Coffee Managed Agents 用。可在 `services/api` 底下執行 `npx tsx src/agents/user/setup.ts --init` 產生，然後把輸出貼回 `.env`。
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_REALTIME_DB_URL`: 啟用 Firebase Admin / Firestore 相關流程時需要。`FIREBASE_PRIVATE_KEY` 若含換行，請用 `\n` 放在同一行。
- `UPSTASH_REDIS_URL`: Redis session 快取用，格式類似 `rediss://default:<token>@<host>:6380`。
- `PORT`: API server port，預設 `3000`。

## 常用後端指令

```powershell
# 開發模式
pnpm dev:api

# 只在 services/api 跑
pnpm --filter api dev

# build 後端
pnpm --filter api build

# 跑 Gov Agent / route 相關測試
pnpm --filter api gov:test
```

API 詳細路徑與已完成狀態請看 `api-doc.md`。
