import { msToTimestamp, type ChannelReply } from '@matcha/shared-types'
import type { MatchAssessment } from '../types.js'

export interface WriteChannelReplyInput {
  assessment: MatchAssessment
}

export interface WriteChannelReplyOutput {
  reply: ChannelReply
}

export function buildChannelReplyFromAssessment(assessment: MatchAssessment): ChannelReply {
  const now = msToTimestamp(Date.now())
  const decision = assessment.decision as MatchAssessment['decision'] & { reasoning?: string }
  const reason = decision.reason ?? decision.reasoning ?? ''

  return {
    replyId: `reply-gov-${assessment.resource.rid}-${assessment.channelMessage.msgId}`,
    messageId: assessment.channelMessage.msgId,
    govId: assessment.resource.rid,
    content: reason,
    matchScore: decision.score,
    createdAt: now,
  }
}

export async function writeChannelReplyToolWrapper(input: WriteChannelReplyInput): Promise<WriteChannelReplyOutput> {
  const reply = buildChannelReplyFromAssessment(input.assessment)
  return { reply }
}
