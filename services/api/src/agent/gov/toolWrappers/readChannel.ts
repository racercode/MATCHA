import { msToTimestamp, type ChannelMessage } from '@matcha/shared-types'
import { db } from '../../../lib/firebase.js'

export interface ReadChannelInput {
  since?: number
  limit?: number
}

export interface ReadChannelOutput {
  messages: ChannelMessage[]
}

export async function readChannelToolWrapper(input?: ReadChannelInput): Promise<ReadChannelOutput> {
  const snap = await db.collection('channel_messages').get()

  type MsgDoc = { id: string; uid: string; summary: string; createdAt: number }
  let docs: MsgDoc[] = snap.docs.map(d => {
    const data = d.data() as { uid: string; summary: string; createdAt: number }
    return { id: d.id, ...data }
  })

  if (input?.since) {
    docs = docs.filter(d => d.createdAt > input.since!)
  }

  if (input?.limit) {
    docs = docs.slice(0, input.limit)
  }

  const messages: ChannelMessage[] = docs.map(d => ({
    msgId: d.id,
    uid: d.uid,
    summary: d.summary,
    publishedAt: msToTimestamp(d.createdAt),
  }))

  return { messages }
}
