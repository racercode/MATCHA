import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import type { ChannelMessage } from '@matcha/shared-types'
import { db } from './firebase.js'
import { fromFirestoreTimestamp } from './firestoreTimestamp.js'

const CHANNEL_MESSAGES_COLLECTION = 'channel_messages'

function toChannelMessage(id: string, data: FirebaseFirestore.DocumentData): ChannelMessage {
  return {
    msgId: typeof data.msgId === 'string' ? data.msgId : id,
    uid: String(data.uid ?? ''),
    summary: String(data.summary ?? ''),
    publishedAt: fromFirestoreTimestamp(data.publishedAt ?? data.createdAt),
  }
}

export async function getChannelMessageById(messageId: string): Promise<ChannelMessage | null> {
  const snapshot = await db.collection(CHANNEL_MESSAGES_COLLECTION).doc(messageId).get()
  if (!snapshot.exists) return null

  return toChannelMessage(snapshot.id, snapshot.data() ?? {})
}

export async function listRecentChannelMessages(options: { since?: number; limit?: number } = {}): Promise<ChannelMessage[]> {
  const since = options.since ?? 0
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)

  const snapshot = await db
    .collection(CHANNEL_MESSAGES_COLLECTION)
    .where('publishedAt', '>', FirestoreTimestamp.fromMillis(since))
    .orderBy('publishedAt', 'desc')
    .limit(limit)
    .get()

  return snapshot.docs.map(doc => toChannelMessage(doc.id, doc.data()))
}
