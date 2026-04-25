import type { ChannelMessage, GovernmentResource, ChannelReply } from '@matcha/shared-types'

export interface MatchDecision {
  eligible: boolean
  score: number
  reason: string
  missingInfo: string[]
}

export interface MatchAssessment {
  channelMessage: ChannelMessage
  resource: GovernmentResource
  decision: MatchDecision
}

export interface GovAgentPipelineResult {
  assessment: MatchAssessment
  reply: ChannelReply
}

export interface FollowUpResult {
  answer: string
  resourceId: string
  replyId: string
}
