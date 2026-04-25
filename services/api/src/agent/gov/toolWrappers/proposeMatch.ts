import { msToTimestamp } from '@matcha/shared-types'
import type { MatchAssessment, PipelineThread, PipelineMessage } from '../types.js'

export interface ProposeMatchInput {
  assessment: MatchAssessment
}

export interface ProposeMatchOutput {
  thread: PipelineThread
  initialMessage: PipelineMessage
}

export function proposeMatchToolWrapper(input: ProposeMatchInput): ProposeMatchOutput {
  const { assessment } = input
  const now = msToTimestamp(Date.now())
  const decision = assessment.decision as MatchAssessment['decision'] & { reasoning?: string }
  const reason = decision.reason ?? decision.reasoning ?? ''
  const suggestedFirstMessage = decision.suggestedFirstMessage ?? ''

  const thread: PipelineThread = {
    tid: `tid-gov-${assessment.resource.rid}-${assessment.channelMessage.uid}`,
    type: 'gov_user',
    initiatorId: `gov:${assessment.resource.rid}`,
    responderId: `user:${assessment.channelMessage.uid}`,
    status: 'negotiating',
    matchScore: decision.score,
    summary: reason,
    userPresence: 'agent',
    govPresence: 'agent',
    createdAt: now,
    updatedAt: now,
  }

  const initialMessage: PipelineMessage = {
    mid: `msg-gov-${assessment.resource.rid}-${assessment.channelMessage.uid}`,
    tid: thread.tid,
    from: `gov_agent:${assessment.resource.rid}`,
    type: 'decision',
    content: {
      text: suggestedFirstMessage,
      resourceId: assessment.resource.rid,
      resourceName: assessment.resource.name,
      reason,
      score: decision.score,
      missingInfo: decision.missingInfo ?? [],
      contactUrl: assessment.resource.contactUrl,
      channelMessageId: assessment.channelMessage.msgId,
      targetUserId: assessment.channelMessage.uid,
    },
    createdAt: now,
  }

  return { thread, initialMessage }
}
