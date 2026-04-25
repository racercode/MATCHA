# Matcha Gov — 政府端前端

高雄市政府資源媒合後台，基於 Next.js 15 App Router。

## 快速開始

```bash
pnpm install
pnpm dev
# 開啟 http://localhost:3000
```

## 頁面結構

| 路由 | 說明 |
|------|------|
| `/threads` | Thread 列表，含狀態篩選與搜尋 |
| `/threads/[tid]` | Thread 詳情，承辦人介入/移交 |
| `/resources` | 政府資源列表與新增表單 |
| `/dashboard` | 媒合統計、標籤分佈、趨勢圖 |

## 切換真實 API

1. 修改 `src/lib/api.ts` 第一行：
   ```ts
   export const USE_MOCK = false
   ```
2. 設定 `.env.local`：
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

## 放進 Monorepo

```
matcha/
└── apps/
    └── web/          ← 把這個資料夾放在這裡
```

`pnpm-workspace.yaml` 已在 monorepo 根目錄定義，直接 `pnpm install` 即可。

## WebSocket 整合（Day 2）

在 `ThreadDetailClient.tsx` 加入 WebSocket 連線，監聽 `ServerEvent` 更新 `messages` state：

```ts
useEffect(() => {
  const ws = new WebSocket(`ws://localhost:3001/ws?tid=${thread.tid}`)
  ws.onmessage = (e) => {
    const event = JSON.parse(e.data)
    if (event.type === 'thread_message') {
      setMessages(prev => [...prev, event.message])
    }
    if (event.type === 'presence_update') {
      setThread(prev => ({ ...prev, userPresence: event.userPresence, govPresence: event.govPresence }))
    }
  }
  return () => ws.close()
}, [thread.tid])
```
