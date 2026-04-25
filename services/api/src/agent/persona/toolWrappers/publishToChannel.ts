import { Timestamp } from 'firebase-admin/firestore'
import { db } from '../../../lib/firebase.js'
import type { PublishToChannelInput } from '../types.js'

export interface PublishToChannelResult {
  msgId: string
  published: boolean
}

export async function publishToChannelToolWrapper(
  uid: string,
  input: PublishToChannelInput,
): Promise<PublishToChannelResult> {
  const now = Date.now()
  const msgId = `m-${now}-${Math.random().toString(36).slice(2, 6)}`
  const publishedAt = Timestamp.fromMillis(now)
  await db.collection('channel_messages').doc(msgId).set({ uid, summary: input.summary, publishedAt, createdAt: now })

  console.log(`[publishToChannel] uid=${uid} msgId=${msgId} summary="${input.summary.slice(0, 80)}"`)

  // Fire-and-forget: trigger Coffee Agent and Gov Agent in background
  import('../../coffee/pipeline.js')
    .then(({ triggerCoffeeMatch }) => triggerCoffeeMatch(msgId))
    .catch(err => console.error('[publishToChannel] coffee trigger error:', err))

  import('../../gov/channelMessageTrigger.js')
    .then(({ handleGovAgentRunForMessage }) => handleGovAgentRunForMessage(msgId))
    .catch(err => console.error('[publishToChannel] gov trigger error:', err))

  return { msgId, published: true }
}
