import type { ChannelBroadcast, GovernmentResource, AgentThread, ThreadMessage } from '@matcha/shared-types'

export interface MatchDecision {
  eligible: boolean
  score: number
  reason: string
  missingInfo: string[]
  suggestedFirstMessage: string
}

export interface MatchAssessment {
  broadcast: ChannelBroadcast
  resource: GovernmentResource
  decision: MatchDecision
}

export interface GovAgentPipelineResult {
  assessment: MatchAssessment
  thread: AgentThread
  initialMessage: ThreadMessage
}
