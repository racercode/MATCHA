export type UserRole = 'citizen' | 'gov_staff'
export type ThreadType = 'gov_user' | 'user_user'
export type ThreadStatus = 'open' | 'closed' | 'negotiating' | 'matched' | 'rejected' | 'human_takeover'
export type PresenceState = 'agent' | 'human' | 'both'

export interface CitizenInfo {
  uid: string
  displayName: string
  summary: string
}

export interface ChannelReply {
  replyId: string
  messageId: string
  govId: string
  content: string
  matchScore: number
  createdAt: number
  citizen: CitizenInfo
}

export interface GovernmentResource {
  rid: string
  agencyId?: string
  agencyName?: string
  name: string
  description: string
  eligibilityCriteria: string[]
  tags?: string[]
  contactUrl?: string
  createdAt?: number | { seconds: number; nanoseconds: number }
  updatedAt?: number | { seconds: number; nanoseconds: number }
}

export interface DashboardStats {
  totalReplies: number
  openedConversations: number
  openRate: number
}

export interface DashboardAgents {
  agentCount: number
  agents: { rid: string; name: string }[]
}

export interface DashboardUsers {
  userCount: number
}

export interface ResourceMatchStat {
  resourceId: string
  resourceName: string
  totalAttempts: number
  totalMatches: number
  matchRate: number
}

export interface DashboardMatchStats {
  totalAttempts: number
  totalMatches: number
  matchRate: number
  resources: ResourceMatchStat[]
}

export interface ChannelReplyForChannel {
  replyId: string
  govId: string
  content: string
  matchScore: number
  createdAt: number
}

export interface ChannelMessageItem {
  msgId: string
  uid: string
  summary: string
  publishedAt: number
  citizen: CitizenInfo
  replies: ChannelReplyForChannel[]
}

export interface CreateResourcePayload {
  rid?: string
  agencyId?: string
  agencyName?: string
  name: string
  description: string
  eligibilityCriteria?: string[]
  contactUrl?: string
}
