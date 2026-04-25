import { msToTimestamp } from '@matcha/shared-types'
import { db } from '../../../lib/firebase.js'
import { broadcast } from '../../../ws/push.js'
import type { RelayMessageInput } from '../types.js'

export interface RelayMessageResult {
  relayed: boolean
  mid: string
}

export async function relayMessageToolWrapper(input: RelayMessageInput): Promise<RelayMessageResult> {
  const { threadId, content } = input
  const threadDoc = await db.collection('peer_threads').doc(threadId).get()
  if (!threadDoc.exists) {
    throw new Error(`Thread ${threadId} not found`)
  }
  const thread = threadDoc.data()!

  const now = Date.now()
  const msgData = {
    from: 'coffee_agent',
    content,
    createdAt: msToTimestamp(now),
  }
  const msgRef = db.collection('peer_threads').doc(threadId).collection('messages').doc()
  await msgRef.set(msgData)
  await db.collection('peer_threads').doc(threadId).update({ updatedAt: now })

  const midObj = { mid: msgRef.id, ...msgData }
  broadcast(thread.userAId as string, { type: 'peer_message', message: midObj })
  broadcast(thread.userBId as string, { type: 'peer_message', message: midObj })

  console.log(`[Coffee Agent] relay_message → thread ${threadId}: "${content.slice(0, 80)}"`)
  return { relayed: true, mid: msgRef.id }
}
