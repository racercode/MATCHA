# Matcha Gov — Architecture Overview

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Firebase Auth |
| Database | Firestore |
| Backend API | REST at `NEXT_PUBLIC_API_URL` (default `localhost:3001`) |
| Real-time | WebSocket at `NEXT_PUBLIC_WS_URL` (default `ws://localhost:3001`) |
| Styling | Inline styles with CSS variables (globals.css) |
| Language | TypeScript |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router (Server Components)
│   ├── layout.tsx              # Root layout: AuthProvider → AuthGuard → AppShell
│   ├── globals.css             # CSS variables (colors, radius, spacing)
│   ├── page.tsx                # Root redirect
│   ├── login/
│   │   └── page.tsx
│   ├── threads/
│   │   ├── page.tsx            # Server Component — fetches thread list
│   │   └── [tid]/
│   │       └── page.tsx        # Server Component — fetches single thread + messages
│   ├── resources/
│   │   └── page.tsx            # Server Component — fetches resource list
│   └── dashboard/
│       └── page.tsx            # Server Component — fetches dashboard stats
│
├── components/
│   ├── ui/                     # Shared UI primitives
│   │   ├── AppShell.tsx        # Sidebar + <main> wrapper, skips sidebar on /login
│   │   ├── Sidebar.tsx         # Nav links + user card + sign out
│   │   ├── AuthGuard.tsx       # Redirects unauthenticated users to /login
│   │   └── Badges.tsx          # StatusBadge, PresenceDot, ScoreBar
│   ├── threads/
│   │   ├── ThreadListClient.tsx    # Thread table with filters, search, 10s polling
│   │   └── ThreadDetailClient.tsx  # Thread detail + live chat (WebSocket)
│   ├── resources/
│   │   └── ResourcesClient.tsx     # Resource grid + create form
│   └── dashboard/
│       └── DashboardClient.tsx     # Stat cards, bar chart, tag cloud
│
├── lib/
│   ├── firebase.ts             # Firebase app init + signOut helper
│   ├── AuthContext.tsx         # React context wrapping Firebase Auth (useAuth)
│   ├── api.ts                  # REST client — primary data source
│   ├── firestore.ts            # Firestore direct access — fsGet*, fsListen*, fsPost*
│   └── useHumanChat.ts         # WebSocket hook for live gov-staff ↔ citizen chat
│
└── types/
    └── index.ts                # All shared TypeScript types
```

---

## Routing

| Route | Page (Server) | Client Component |
|---|---|---|
| `/login` | `app/login/page.tsx` | — |
| `/threads` | `app/threads/page.tsx` | `ThreadListClient` |
| `/threads/[tid]` | `app/threads/[tid]/page.tsx` | `ThreadDetailClient` |
| `/resources` | `app/resources/page.tsx` | `ResourcesClient` |
| `/dashboard` | `app/dashboard/page.tsx` | `DashboardClient` |

**Pattern**: every page is a Server Component that fetches initial data and passes it as `initialXxx` props to a `'use client'` component. The client component re-fetches on a timer or WebSocket event to stay fresh.

---

## Data Layer

### Two data paths

```
api.ts         →  REST API (backend at NEXT_PUBLIC_API_URL)
firestore.ts   →  Firestore direct (real-time capable)
```

`api.ts` is the active path in all current components. `firestore.ts` is available for direct reads, real-time listeners (`fsListen*`), and writes.

### api.ts — exported functions

| Function | Method | Endpoint |
|---|---|---|
| `getThreads()` | GET | `/gov/channel-replies` |
| `getThread(tid)` | GET | `/gov/channel-replies` + `/gov/human-threads` |
| `getHumanThreads()` | GET | `/gov/human-threads` |
| `openHumanThread(replyId)` | POST | `/gov/channel-replies/:id/open` |
| `getHumanMessages(tid)` | GET | `/gov/human-threads/:tid/messages` |
| `sendHumanMessage(tid, content)` | POST | `/gov/human-threads/:tid/messages` |
| `getResources()` | GET | `/gov/resources` |
| `createResource(r)` | POST | `/gov/resources` |
| `getDashboard()` | GET | `/gov/dashboard` |

### firestore.ts — exported functions

| Function | Description |
|---|---|
| `fsGetThreads()` | List all threads ordered by `updatedAt` |
| `fsGetThread(tid)` | Get single thread with persona + resource enrichment |
| `fsUpdateThread(tid, data)` | Partial update on a thread |
| `fsListenThread(tid, cb)` | Real-time listener on a single thread |
| `fsGetMessages(tid)` | List messages for a thread |
| `fsPostMessage(tid, from, content)` | Write a message to Firestore |
| `fsListenMessages(tid, cb)` | Real-time listener on thread messages |
| `fsGetResources()` | List all resources |
| `fsCreateResource(r)` | Create a new resource |

### useHumanChat — WebSocket hook

```ts
const { messages, sendMessage, connected } = useHumanChat(tid, initialMessages)
```

Connects to `NEXT_PUBLIC_WS_URL/ws?token=<firebase-id-token>`. Listens for `human_message` events and sends messages with optimistic UI update.

---

## Types (`src/types/index.ts`)

### Core types

```ts
type UserRole       = 'citizen' | 'gov_staff'
type ThreadType     = 'gov_user' | 'user_user'
type ThreadStatus   = 'negotiating' | 'matched' | 'rejected' | 'human_takeover'
type PresenceState  = 'agent' | 'human' | 'both'
```

### Data shapes

| Interface | Key Fields |
|---|---|
| `GovernmentResource` | `rid`, `agencyId`, `agencyName`, `name`, `description`, `eligibilityCriteria[]`, `tags[]`, `contactUrl?` |
| `AgentThread` | `tid`, `type`, `initiatorId`, `responderId`, `status`, `matchScore?`, `userPresence`, `govPresence`, `userName?`, `resourceName?` |
| `ThreadMessage` | `mid`, `tid`, `from`, `type` (`query\|answer\|decision\|human_note`), `content` |
| `UserPersona` | `uid`, `displayName`, `summary`, `tags[]`, `needs[]`, `offers[]` |
| `DashboardStats` | `totalThreads`, `matchedCount`, `humanTakeoverCount`, `matchRatePercent`, `tagDistribution[]`, `dailyMatches[]` |

---

## UI Shell

### Layout tree

```
RootLayout
└── AuthProvider          (Firebase Auth context)
    └── AuthGuard         (redirects to /login if unauthenticated)
        └── AppShell      (Sidebar + <main>)
            └── {page}
```

### Sidebar NAV entries

| Label | Route |
|---|---|
| Thread 管理 | `/threads` |
| 資源管理 | `/resources` |
| 統計 Dashboard | `/dashboard` |

### Shared badge components (Badges.tsx)

| Component | Props | Use |
|---|---|---|
| `StatusBadge` | `status: ThreadStatus` | Color-coded pill for thread status |
| `PresenceDot` | `mode: PresenceState`, `label?` | Colored dot for agent vs human presence |
| `ScoreBar` | `score: number` | Progress bar for match score 0–100 |

---

## Adding a New Page — Checklist

1. **Type** — add any new data shape to `src/types/index.ts`
2. **API** — add fetch/post functions to `src/lib/api.ts` (and optionally `firestore.ts`)
3. **Route** — create `src/app/<name>/page.tsx` as a Server Component; fetch initial data and pass as props
4. **Client component** — create `src/components/<name>/<Name>Client.tsx` with `'use client'`; accept `initialXxx` prop, re-fetch client-side as needed
5. **Sidebar** — add an entry to the `NAV` array in `src/components/ui/Sidebar.tsx`

### Template

```tsx
// src/app/<name>/page.tsx  (Server Component)
import { getFoo } from '@/lib/api'
import FooClient from '@/components/foo/FooClient'

export default async function FooPage() {
  const initialFoos = await getFoo().catch(() => [])
  return <FooClient initialFoos={initialFoos} />
}
```

```tsx
// src/components/foo/FooClient.tsx
'use client'
import { useState, useEffect } from 'react'
import type { Foo } from '@/types'
import { getFoo } from '@/lib/api'

export default function FooClient({ initialFoos }: { initialFoos: Foo[] }) {
  const [foos, setFoos] = useState(initialFoos)

  useEffect(() => {
    getFoo().then(setFoos)
  }, [])

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>
        頁面標題
      </h1>
      {/* content */}
    </div>
  )
}
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend REST API base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001` | WebSocket base URL |
| Firebase config vars | — | Set in `.env.local` (see firebase.ts) |
