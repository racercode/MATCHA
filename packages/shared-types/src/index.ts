// =============================================================================
// @matcha/shared-types
// Single source of truth for all interfaces shared across apps and services.
// ALL changes here require notifying all three groups.
// =============================================================================

// ---------------------------------------------------------------------------
// Timestamp  (compatible with Firebase Timestamp and plain JSON objects)
// ---------------------------------------------------------------------------

export interface Timestamp {
  seconds: number
  nanoseconds: number
  toMillis?(): number
  toDate?(): Date
}

/** Convert any Timestamp to unix milliseconds */
export const toMs = (ts: Timestamp): number =>
  ts.toMillis?.() ?? ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1_000_000)

/** Create a Timestamp from unix milliseconds */
export const msToTimestamp = (ms: number): Timestamp => ({
  seconds: Math.floor(ms / 1000),
  nanoseconds: (ms % 1000) * 1_000_000,
})

/** Timestamp for right now */
export const nowTimestamp = (): Timestamp => msToTimestamp(Date.now())

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type UserRole = 'citizen' | 'gov_staff'

export interface AuthUser {
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  role: UserRole
  agencyId?: string // gov_staff only
}

// ---------------------------------------------------------------------------
// User Persona  (Firestore: personas/{uid})
// ---------------------------------------------------------------------------

export interface UserPersona {
  uid: string
  displayName: string
  photoURL?: string
  summary: string    // agent-maintained natural language summary
  needs: string[]
  offers: string[]   // what the user can share (coffee chat)
  updatedAt: Timestamp
}

// Lightweight peer card shown in coffee chat matching
export interface PeerPreview {
  uid: string
  displayName: string
  photoURL?: string
  summary: string
}

// ---------------------------------------------------------------------------
// Central Channel  (Firestore: channel_messages/{msgId})
// ---------------------------------------------------------------------------

export interface ChannelMessage {
  msgId: string
  uid: string        // broadcaster citizen uid
  summary: string
  publishedAt: Timestamp
}

// ---------------------------------------------------------------------------
// Government Resources  (Firestore: gov_resources/{rid})
// ---------------------------------------------------------------------------

export interface GovernmentResource {
  rid: string
  agencyId: string
  agencyName: string
  name: string
  description: string
  eligibilityCriteria: string[]
  contactUrl?: string
  pdfStoragePath?: string  // legacy compatibility for the old /pdf upload API
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export type GovernmentResourceDocumentKind =
  | 'pdf'
  | 'markdown'
  | 'txt'
  | 'html'
  | 'csv'
  | 'xlsx'
  | 'url'
  | 'other'

// Firestore: gov_resources/{rid}/documents/{docId}
export interface GovernmentResourceDocument {
  docId: string
  rid: string
  filename: string
  kind: GovernmentResourceDocumentKind
  mimeType?: string
  sourceUrl?: string
  storagePath?: string
  extractedText: string
  textLength: number
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// ---------------------------------------------------------------------------
// Channel Replies  (Firestore: channel_replies/{replyId})
// GovAgent writes these after assessing a ChannelMessage.
// Citizens discover via GET /me/channel-replies (polling).
// ---------------------------------------------------------------------------

export interface ChannelReply {
  replyId: string
  messageId: string  // → channel_messages/{msgId}
  govId: string
  content: string    // GovAgent match rationale
  matchScore: number // 0–100
  createdAt: Timestamp
}

// ---------------------------------------------------------------------------
// Human Threads  (Firestore: human_threads/{tid})
// Created when gov staff opens a conversation from a channel reply.
// ---------------------------------------------------------------------------

export interface HumanThread {
  tid: string
  type: 'gov_user'
  userId: string
  govId: string
  channelReplyId: string
  matchScore: number
  status: 'open' | 'closed'
  createdAt: Timestamp
  updatedAt: Timestamp
}

// human_threads/{tid}/messages/{mid}
export interface HumanMessage {
  mid: string
  from: string    // "user:{uid}" | "gov_staff:{staffId}"
  content: string
  createdAt: Timestamp
}

// ---------------------------------------------------------------------------
// Peer Threads  (Firestore: peer_threads/{tid})
// CoffeeAgent creates these after matching two citizens.
// ---------------------------------------------------------------------------

export interface PeerThread {
  tid: string
  type: 'user_user'
  userAId: string
  userBId: string
  matchRationale: string
  status: 'active' | 'closed'
  createdAt: Timestamp
  updatedAt: Timestamp
}

// peer_threads/{tid}/messages/{mid}
export interface PeerMessage {
  mid: string
  from: string    // "user:{uid}" | "coffee_agent"
  content: string
  createdAt: Timestamp
}

// ---------------------------------------------------------------------------
// Swipe UI  (client-only state; no server WS event needed)
// ---------------------------------------------------------------------------

export interface SwipeCard {
  cardId: string
  question: string
  leftLabel: string
  rightLabel: string
  leftValue: string
  rightValue: string
}

export type SwipeDirection = 'left' | 'right'
export interface SwipeCardAnswer {
  cardId: string
  direction: SwipeDirection
  value: string
}

// ---------------------------------------------------------------------------
// WebSocket Events  (see api-doc §9)
// ---------------------------------------------------------------------------

// Client → Server
export type ClientEvent =
  // Persona Chat — swipe handled by sending special content string
  | { type: 'persona_message'; content: string }
  // Card tab — request a batch of swipe cards without polluting chat history
  | { type: 'swipe_card_request'; content?: string }
  // Card tab — submit a swipe answer back to the card-specific session
  | { type: 'swipe_card_answer'; cardId: string; direction: SwipeDirection; value: string }
  // Card tab — submit a whole batch of swipe answers at once
  | { type: 'swipe_card_batch_answer'; answers: SwipeCardAnswer[] }
  // Coffee Chat — CoffeeAgent relays and pushes to both participants
  | { type: 'peer_message'; threadId: string; content: string }
  // Human Thread — citizen or gov_staff sends a message
  | { type: 'human_message'; threadId: string; content: string }

// Server → Client
export type ServerEvent =
  // PersonaAgent streaming reply (one event per token, done=true signals end)
  | { type: 'agent_reply'; content: string; done: boolean }
  // PersonaAgent swipe card pushed to the user for interactive preference gathering
  | { type: 'swipe_card'; card: SwipeCard }
  // CoffeeAgent relay pushed to both thread participants
  | { type: 'peer_message'; message: PeerMessage }
  // CoffeeAgent peer match notification pushed when a new thread is created
  | { type: 'match_notify'; threadId: string; peer: PeerPreview }
  // Human thread message pushed to the other party
  | { type: 'human_message'; message: HumanMessage }
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
// Gov Dashboard  (GET /gov/dashboard — see api-doc §6)
// ---------------------------------------------------------------------------

export interface GovStats {
  totalReplies: number
  avgMatchScore: number
  openedConversations: number
  openRate: number
  scoreDistribution: {
    '90-100': number
    '70-89': number
    '50-69': number
    '0-49': number
  }
}

// ---------------------------------------------------------------------------
// Mock helpers (Group C provides, remove before prod)
// ---------------------------------------------------------------------------

export const MOCK_PERSONA: UserPersona = {
  uid: 'mock-uid-001',
  displayName: '陳小明',
  summary: '正在尋找就業輔導和職業培訓資源的年輕人',
  needs: ['就業輔導', '職業培訓'],
  offers: ['軟體開發經驗', '社區志工'],
  updatedAt: nowTimestamp(),
}

export const MOCK_RESOURCE: GovernmentResource = {
  rid: 'mock-rid-001',
  agencyId: 'labor-dept',
  agencyName: '勞動部',
  name: '青年就業促進計畫',
  description: '提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢',
  eligibilityCriteria: ['年齡 18–29 歲', '具中華民國國籍', '非在學中'],
  contactUrl: 'https://www.mol.gov.tw',
  createdAt: nowTimestamp(),
}

export const MOCK_PEER_PREVIEW: PeerPreview = {
  uid: 'mock-uid-002',
  displayName: '林小華',
  summary: '對社會企業和公共政策有興趣，想找同路人交流',
}
