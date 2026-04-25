export type UserRole = 'citizen' | 'gov_staff'

export type ThreadType = 'gov_user' | 'user_user'
export type ThreadStatus = 'negotiating' | 'matched' | 'rejected' | 'human_takeover'
export type PresenceState = 'agent' | 'human' | 'both'

export interface UserPersona {
  uid: string
  displayName: string
  photoURL?: string
  summary: string
  tags: string[]
  needs: string[]
  offers: string[]
  updatedAt: number
}

export interface GovernmentResource {
  rid: string
  agencyId: string
  agencyName: string
  name: string
  description: string
  eligibilityCriteria: string[]
  tags: string[]
  contactUrl?: string
  createdAt: number
}

export interface AgentThread {
  tid: string
  type: ThreadType
  initiatorId: string
  responderId: string
  status: ThreadStatus
  matchScore?: number
  summary?: string
  userPresence: PresenceState
  govPresence: PresenceState
  peerPresence?: PresenceState
  govStaffUid?: string
  createdAt: number
  updatedAt: number
  // UI convenience
  userName?: string
  userTags?: string[]
  resourceName?: string
  agencyId?: string
}

export interface ThreadMessage {
  mid: string
  tid: string
  from: string
  type: 'query' | 'answer' | 'decision' | 'human_note'
  content: Record<string, unknown>
  createdAt: number
}

export interface DashboardStats {
  totalThreads: number
  matchedCount: number
  humanTakeoverCount: number
  negotiatingCount: number
  matchRatePercent: number
  humanTakeoverRatePercent: number
  tagDistribution: { tag: string; count: number }[]
  dailyMatches: { date: string; matched: number; negotiating: number }[]
}
