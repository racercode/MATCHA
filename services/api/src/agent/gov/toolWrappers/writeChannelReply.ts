import { msToTimestamp, type ChannelReply } from '@matcha/shared-types'
import { hasFirebaseAdminEnv } from '../../../lib/firebaseEnv.js'
import type { MatchAssessment } from '../types.js'

export interface WriteChannelReplyInput {
  assessment: MatchAssessment
}

export interface WriteChannelReplyOutput {
  reply: ChannelReply
}

export function buildChannelReplyFromAssessment(assessment: MatchAssessment): ChannelReply {
  const now = Date.now()
  const decision = assessment.decision as MatchAssessment['decision'] & { reasoning?: string }
  const reason = decision.reason ?? decision.reasoning ?? ''
  const replyId = `reply-gov-${assessment.resource.rid}-${assessment.channelMessage.msgId}`
  return {
    replyId,
    messageId: assessment.channelMessage.msgId,
    govId: assessment.resource.rid,
    content: reason,
    matchScore: decision.score,
    createdAt: msToTimestamp(now),
  }
}

export async function writeChannelReplyToolWrapper(input: WriteChannelReplyInput): Promise<WriteChannelReplyOutput> {
  const reply = buildChannelReplyFromAssessment(input.assessment)

  if (hasFirebaseAdminEnv()) {
    const { upsertChannelReply } = await import('../../../lib/channelRepliesRepo.js')
    await upsertChannelReply(reply)
  }

  return { reply }
}
