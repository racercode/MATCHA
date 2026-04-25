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
  const msgId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await db.collection('channel_messages').doc(msgId).set({
    uid,
    summary: input.summary,
    createdAt: Date.now(),
  })

  // Fire-and-forget: trigger Coffee Agent matching in background
  import('../../coffee/pipeline.js')
    .then(({ triggerCoffeeMatch }) => triggerCoffeeMatch(msgId))
    .catch(err => console.error('[publishToChannel] coffee trigger error:', err))

  return { msgId, published: true }
}
