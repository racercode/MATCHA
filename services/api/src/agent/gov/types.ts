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
