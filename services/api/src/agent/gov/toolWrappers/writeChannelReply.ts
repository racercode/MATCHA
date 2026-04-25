import { msToTimestamp, type ChannelReply } from '@matcha/shared-types'
import { db } from '../../../lib/firebase.js'
import type { MatchAssessment } from '../types.js'

export interface WriteChannelReplyInput {
  assessment: MatchAssessment
}

export interface WriteChannelReplyOutput {
  reply: ChannelReply
}

export async function writeChannelReplyToolWrapper(input: WriteChannelReplyInput): Promise<WriteChannelReplyOutput> {
  const { assessment } = input
  const now = Date.now()
  const decision = assessment.decision as MatchAssessment['decision'] & { reasoning?: string }
  const reason = decision.reason ?? decision.reasoning ?? ''

  const replyId = `reply-gov-${assessment.resource.rid}-${assessment.channelMessage.msgId}`
  const reply: ChannelReply = {
    replyId,
    messageId: assessment.channelMessage.msgId,
    govId: assessment.resource.rid,
    content: reason,
    matchScore: decision.score,
    createdAt: msToTimestamp(now),
  }

  await db.collection('channel_replies').doc(replyId).set({
    messageId: reply.messageId,
    govId: reply.govId,
    content: reply.content,
    matchScore: reply.matchScore,
    createdAt: now,
  })

  return { reply }
}
