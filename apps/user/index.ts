// =============================================================================
// @matcha/shared-types
// Single source of truth for all interfaces shared across apps and services.
// ALL changes here require notifying all three groups.
// =============================================================================

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type UserRole = 'citizen' | 'gov_staff'
export interface FirestoreTimestamp {
  seconds: number
  nanoseconds: number
  toDate?: () => Date
  toMillis?: () => number
}

export type TimestampValue = FirestoreTimestamp

// Anonymous auth: email and displayName are absent until user sets them.
// Role is resolved server-side by checking Firestore /gov_staff/{uid}.
export interface AuthUser {
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  role: UserRole
  agencyId?: string // gov_staff only
}

// ---------------------------------------------------------------------------
// User Persona
// ---------------------------------------------------------------------------

export interface UserPersona {
  uid: string
  displayName: string
  photoURL?: string
  summary: string    // agent-maintained natural language summary
  tags: string[]     // structured tags for matching and coffee chat
  needs: string[]    // what the user is seeking
  offers: string[]   // what the user can share (coffee chat)
  updatedAt: TimestampValue
}

// Lightweight peer card shown in coffee chat matching
export interface PeerPreview {
  uid: string
  displayName: string
  photoURL?: string
  summary: string
  tags: string[]
  commonTags: string[] // intersection with viewer's tags
}

// ---------------------------------------------------------------------------
// Central Channel  (Firebase Realtime DB — ephemeral)
// ---------------------------------------------------------------------------

export interface ChannelBroadcast {
  uid: string
  displayName: string
  summary: string
  tags: string[]
  needs: string[]
  publishedAt: TimestampValue
}

// ---------------------------------------------------------------------------
// Government Resources
// ---------------------------------------------------------------------------

export interface GovernmentResource {
  rid: string
  agencyId: string
  agencyName: string
  name: string
  description: string
  eligibilityCriteria: string[]
  tags: string[]
  contactUrl?: string
  createdAt: TimestampValue
}

// ---------------------------------------------------------------------------
// Agent Threads
// ---------------------------------------------------------------------------

export type ThreadType = 'gov_user' | 'user_user'

export type ThreadStatus =
  | 'negotiating'
  | 'matched'
  | 'rejected'
  | 'human_takeover'

// 'agent'  — only the agent is active on this side
// 'human'  — human has joined, agent goes passive
// 'both'   — human joined but agent may still assist if tagged
export type PresenceState = 'agent' | 'human' | 'both'

export interface AgentThread {
  tid: string
  type: ThreadType
  initiatorId: string  // "gov:{rid}" | "user:{uid}"
  responderId: string  // "user:{uid}"
  status: ThreadStatus
  matchScore?: number  // 0–100, agent's subjective score for display only
  summary?: string     // agent-generated before human takeover

  // gov_user threads
  userPresence: PresenceState
  govPresence: PresenceState

  // user_user (coffee chat) threads — reuses userPresence for initiator
  // peerPresence tracks the responder's side
  peerPresence?: PresenceState

  // set when a gov_staff human joins; needed to push WS events to them
  govStaffUid?: string

  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export type MessageSenderType =
  | `persona_agent:${string}`   // uid
  | `coffee_agent:${string}`    // uid
  | `gov_agent:${string}`       // rid
  | `human:${string}`           // uid

export type MessageType = 'query' | 'answer' | 'decision' | 'human_note'

export interface ThreadMessage {
  mid: string
  tid: string
  from: string       // MessageSenderType pattern
  type: MessageType
  content: Record<string, unknown>
  createdAt: TimestampValue
}

// ---------------------------------------------------------------------------
// Swipe UI
// ---------------------------------------------------------------------------

export interface SwipeCard {
  cardId: string
  question: string
  leftLabel: string  // e.g. "不感興趣"
  rightLabel: string // e.g. "有興趣"
  leftValue: string
  rightValue: string
}

export type SwipeDirection = 'left' | 'right'

// ---------------------------------------------------------------------------
// WebSocket Events
// ---------------------------------------------------------------------------

// Client → Server
export type ClientEvent =
  | { type: 'chat_message'; content: string }
  | { type: 'swipe'; direction: SwipeDirection; cardId: string; value: string }
  | { type: 'subscribe_thread'; threadId: string }
  | { type: 'unsubscribe_thread'; threadId: string }
  | { type: 'human_join'; threadId: string }
  | { type: 'human_leave'; threadId: string }
  | { type: 'thread_message'; threadId: string; content: string }

// Server → Client
export type ServerEvent =
  | { type: 'agent_reply'; content: string; done: boolean }
  | { type: 'swipe_card'; card: SwipeCard }
  | { type: 'match_notify'; thread: AgentThread; resource: GovernmentResource }
  | { type: 'peer_notify'; thread: AgentThread; peer: PeerPreview }
  | { type: 'thread_update'; thread: AgentThread }
  | { type: 'thread_message'; message: ThreadMessage }
  | { type: 'presence_update'; threadId: string; side: 'user' | 'gov' | 'peer'; state: PresenceState }
  | { type: 'persona_updated'; persona: UserPersona }
  | { type: 'error'; code: string; message: string }

// ---------------------------------------------------------------------------
// REST API Helpers
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Gov Dashboard
// ---------------------------------------------------------------------------

export interface GovStats {
  totalMatches: number
  humanTakeoverCount: number
  activeThreads: number
  matchedToday: number
  tagDistribution: Record<string, number>    // tag → count
  needsDistribution: Record<string, number>  // need category → count
}

// ---------------------------------------------------------------------------
// Mock helpers (Group C provides, remove before prod)
// ---------------------------------------------------------------------------

const mockTimestamp = (unixMs: number): FirestoreTimestamp => ({
  seconds: Math.floor(unixMs / 1000),
  nanoseconds: (unixMs % 1000) * 1_000_000,
  toDate: () => new Date(unixMs),
  toMillis: () => unixMs,
})

export const MOCK_PERSONA: UserPersona = {
  uid: 'mock-uid-001',
  displayName: '陳小明',
  summary: '正在尋找就業輔導和職業培訓資源的年輕人',
  tags: ['就業', '職訓', '青年'],
  needs: ['就業輔導', '職業培訓'],
  offers: ['軟體開發經驗', '社區志工'],
  updatedAt: mockTimestamp(Date.now()),
}

export const MOCK_RESOURCE: GovernmentResource = {
  rid: 'mock-rid-001',
  agencyId: 'labor-dept',
  agencyName: '勞動部',
  name: '青年就業促進計畫',
  description: '提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢',
  eligibilityCriteria: ['年齡 18–29 歲', '具中華民國國籍', '非在學中'],
  tags: ['就業', '青年', '補助'],
  contactUrl: 'https://www.mol.gov.tw',
  createdAt: mockTimestamp(Date.now()),
}

export const MOCK_THREAD: AgentThread = {
  tid: 'mock-tid-001',
  type: 'gov_user',
  initiatorId: 'gov:mock-rid-001',
  responderId: 'user:mock-uid-001',
  status: 'negotiating',
  matchScore: 82,
  userPresence: 'agent',
  govPresence: 'agent',
  createdAt: mockTimestamp(Date.now() - 60_000),
  updatedAt: mockTimestamp(Date.now()),
}

export const MOCK_PEER_PREVIEW: PeerPreview = {
  uid: 'mock-uid-002',
  displayName: '林小華',
  summary: '對社會企業和公共政策有興趣，想找同路人交流',
  tags: ['社會企業', '公共政策', '青年'],
  commonTags: ['青年'],
}
