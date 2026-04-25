import type { ChannelMessage, GovernmentResource, AgentThread, ThreadMessage } from '@matcha/shared-types'

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

export interface GovAgentPipelineResult {
  assessment: MatchAssessment
  thread: AgentThread
  initialMessage: ThreadMessage
}
