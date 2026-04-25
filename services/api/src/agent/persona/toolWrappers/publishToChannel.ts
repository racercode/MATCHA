import { db } from '../../../lib/firebase.js'
import type { PublishToChannelInput } from '../types.js'

export interface PublishToChannelResult {
  msgId: string
  published: boolean
}

const PUBLISH_RATE_LIMIT_MS = 10 * 60 * 1000 // 10 minutes

export async function publishToChannelToolWrapper(
  uid: string,
  input: PublishToChannelInput,
): Promise<PublishToChannelResult> {
  // Rate limit: skip if published within the last 10 minutes
  const personaDoc = await db.collection('personas').doc(uid).get()
  const lastPublishedAt: number = personaDoc.data()?.lastPublishedAt ?? 0
  if (Date.now() - lastPublishedAt < PUBLISH_RATE_LIMIT_MS) {
    const nextAllowedIn = Math.ceil((PUBLISH_RATE_LIMIT_MS - (Date.now() - lastPublishedAt)) / 1000 / 60)
    console.log(`[publishToChannel] uid=${uid} rate-limited, next allowed in ~${nextAllowedIn}m`)
    return { msgId: '', published: false }
  }

  const now = Date.now()
  const msgId = `m-${now}-${Math.random().toString(36).slice(2, 6)}`
  await Promise.all([
    db.collection('channel_messages').doc(msgId).set({ uid, summary: input.summary, createdAt: now }),
    db.collection('personas').doc(uid).set({ lastPublishedAt: now }, { merge: true }),
  ])

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
