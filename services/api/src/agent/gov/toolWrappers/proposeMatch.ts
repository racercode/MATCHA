import type { AgentThread, ThreadMessage } from '@matcha/shared-types'
import type { MatchAssessment } from '../types.js'

export interface ProposeMatchInput {
  assessment: MatchAssessment
}

export interface ProposeMatchOutput {
  thread: AgentThread
  initialMessage: ThreadMessage
}

export function proposeMatchToolWrapper(input: ProposeMatchInput): ProposeMatchOutput {
  const { assessment } = input
  const now = Date.now()

  const thread: AgentThread = {
    tid: `tid-gov-${assessment.resource.rid}-${assessment.broadcast.uid}`,
    type: 'gov_user',
    initiatorId: `gov:${assessment.resource.rid}`,
    responderId: `user:${assessment.broadcast.uid}`,
    status: 'negotiating',
    matchScore: assessment.decision.score,
    summary: assessment.decision.reason,
    userPresence: 'agent',
    govPresence: 'agent',
    createdAt: now,
    updatedAt: now,
  }

  const initialMessage: ThreadMessage = {
    mid: `msg-gov-${assessment.resource.rid}-${assessment.broadcast.uid}`,
    tid: thread.tid,
    from: `gov_agent:${assessment.resource.rid}`,
    type: 'decision',
    content: {
      text: assessment.decision.suggestedFirstMessage,
      resourceId: assessment.resource.rid,
      resourceName: assessment.resource.name,
      reason: assessment.decision.reason,
      score: assessment.decision.score,
      missingInfo: assessment.decision.missingInfo,
      contactUrl: assessment.resource.contactUrl,
      targetUserId: assessment.broadcast.uid,
    },
    createdAt: now,
  }

  return { thread, initialMessage }
}
