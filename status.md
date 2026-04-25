# Matcha API — Current Status

## What's done

### `packages/shared-types`
- All shared interfaces defined and compiled: `AuthUser`, `UserPersona`, `AgentThread`, `ThreadMessage`, `GovernmentResource`, `PeerPreview`, `ChannelMessage`, `SwipeCard`, `GovStats`
- `ClientEvent` and `ServerEvent` union types (full WS contract)
- `AgentThread.govStaffUid?: string` — tracks which gov staff UID joined a thread (needed for WS delivery)
- `ClientEvent` includes `subscribe_thread` / `unsubscribe_thread`
- Mock constants (`MOCK_PERSONA`, `MOCK_RESOURCE`, `MOCK_THREAD`, `MOCK_PEER_PREVIEW`) for Group A/B development
- Zero type errors, dist compiled

### `services/api` — Server bootstrap
- Firebase Admin initialized from env vars (project ID, client email, private key, Realtime DB URL)
- Express app on port 3000, WebSocket on `ws://localhost:3000/ws`
- Optional mock server on port 3001 via `--mock` flag or `ENABLE_MOCK=true`

### `services/api` — Auth middleware
- `verifyToken`: validates Firebase ID token, resolves role by checking Firestore `/gov_staff/{uid}`
- `requireGovStaff`: guards gov-only routes
- `AuthedRequest` interface extends `Request` with `uid`, `role`, `agencyId`

### `services/api` — REST routes (stubs)

| Method | Path | Status |
|--------|------|--------|
| POST | `/auth/verify` | Stub — token verify + role resolve done, returns `{ uid, role }` |
| GET | `/me/persona` | Stub — shape correct, Firestore read TODO |
| POST | `/me/chat` | Stub — SSE stream plumbing done, agent call TODO |
| POST | `/me/swipe` | Stub — validates fields, agent call TODO |
| GET | `/threads` | Stub — Firestore query TODO |
| GET | `/threads/:tid` | Stub — Firestore fetch TODO |
| GET | `/threads/:tid/messages` | Stub — Firestore fetch + pagination TODO |
| POST | `/threads/:tid/message` | Stub — message shape built, Firestore write + WS broadcast TODO |
| POST | `/threads/:tid/join` | Stub — presence response shape done, Firestore update + WS broadcast TODO |
| POST | `/threads/:tid/leave` | Stub — same as join |
| GET | `/gov/resources` | Stub — Firestore query TODO |
| POST | `/gov/resources` | Stub — resource shape built, Firestore write TODO |
| GET | `/gov/threads` | Stub — Firestore query TODO |
| GET | `/gov/dashboard` | Stub — returns zeroed stats, aggregation TODO |

### `services/api` — WebSocket handler

Full routing logic implemented. Firestore reads/writes and agent calls are stubbed.

**Connection management**
- `clients: Map<uid, Set<WebSocket>>` — supports multiple tabs per user
- `userRoles: Map<uid, role>` — cached on connect, avoids re-fetching role per message
- Clean teardown on disconnect (removes from `clients` and all `threadSubs`)

**Thread subscription registry**
- `threadSubs: Map<tid, Set<uid>>` — in-memory; gov staff subscribe when they open a thread
- Used by `getParticipantUids()` so WS events reach the right people without polling

**Event handlers**

| Event | Status |
|-------|--------|
| `chat_message` | Routing done — Persona Agent call TODO |
| `swipe` | Routing done — Persona Agent call TODO |
| `subscribe_thread` | Fully implemented (pure in-memory) |
| `unsubscribe_thread` | Fully implemented |
| `human_join` | Presence update logic done — Firestore write TODO; broadcasts `presence_update` + `thread_update` |
| `human_leave` | Same as join |
| `thread_message` | Full routing done — Firestore fetch/write TODO; broadcasts to all participants; calls `routeToAgent` |

**`routeToAgent` decision tree** (agent calls stubbed, logic complete)
```
gov_user thread:
  sender=citizen,    govPresence=agent   → invoke Gov Agent
  sender=gov_staff,  userPresence=agent  → invoke Persona Agent (reply_if_asked)

user_user thread:
  sender=initiator,  peerPresence=agent  → invoke Coffee Agent (responder side)
  sender=responder,  userPresence=agent  → invoke Coffee Agent (initiator side)
```

**`getParticipantUids(thread)`** — collects:
- `responderId` (always a user UID)
- `initiatorId` (user_user threads only)
- All UIDs in `threadSubs` for this thread
- `govStaffUid` stored on thread (set at `human_join`)

### `services/api` — Mock server (port 3001)
Fully functional for Group A/B to develop against:
- All REST endpoints return correctly shaped mock data
- WS pushes `match_notify` after 5s and `peer_notify` after 10s
- Echoes `chat_message` with a mock `agent_reply`

---

## What's next

### Immediate (needed to unblock agents)
- [ ] `src/lib/firestore.ts` — `getThread`, `writeThreadMessage`, `updatePresence`, `getPersona`, `upsertPersona`
- [ ] `src/lib/session.ts` — Redis get/set for `session:{agent_type}:{uid}` with 24h sliding TTL

### Agents (after Firestore helpers)
- [ ] `src/agents/persona.ts` — Claude Sessions API, tools: `ask_question`, `present_swipe`, `update_persona`, `publish_to_channel`
- [ ] `src/agents/gov.ts` — tools: `read_channel`, `check_eligibility`, `propose_match`, `notify_user`
- [ ] `src/agents/coffee.ts` — tools: `search_peers`, `propose_peer_match`

### Wire-up (after agents)
- [ ] WS `chat_message` → Persona Agent streaming
- [ ] WS `thread_message` → Firestore write + agent invocation
- [ ] WS `human_join/leave` → Firestore presence update
- [ ] `upgradeHandler` role resolution (Firestore `/gov_staff/{uid}` check)
- [ ] REST thread routes → Firestore reads

### Later
- [ ] BullMQ fan-out queue for Gov Agent (one job per channel message × resource)
- [ ] FCM push on `match_notify` / `peer_notify`
- [ ] Pinecone embeddings for peer matching (`search_peers` tool)
- [ ] Gov dashboard aggregation queries
