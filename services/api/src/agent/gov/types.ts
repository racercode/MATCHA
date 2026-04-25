import type { ChannelMessage, GovernmentResource } from '@matcha/shared-types'
import type { Timestamp } from '@matcha/shared-types'

export interface MatchDecision {
  eligible: boolean
  score: number
  reason: string
  missingInfo: string[]
  suggestedFirstMessage: string
}

export interface MatchAssessment {
  channelMessage: ChannelMessage
  resource: GovernmentResource
  decision: MatchDecision
}

// Pipeline-internal thread/message shapes returned to the API route
export interface PipelineThread {
  tid: string
  type: 'gov_user'
  initiatorId: string
  responderId: string
  status: 'negotiating'
  matchScore: number
  summary: string
  userPresence: 'agent'
  govPresence: 'agent'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PipelineMessage {
  mid: string
  tid: string
  from: string
  type: 'decision'
  content: Record<string, unknown>
  createdAt: Timestamp
}

export interface GovAgentPipelineResult {
  assessment: MatchAssessment
  thread: PipelineThread
  initialMessage: PipelineMessage
}
