import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import { toMs, type ChannelReply } from '@matcha/shared-types'
import { db } from './firebase.js'
import { fromFirestoreTimestamp, toFirestoreTimestamp } from './firestoreTimestamp.js'

const CHANNEL_REPLIES_COLLECTION = 'channel_replies'
const CHANNEL_MESSAGES_COLLECTION = 'channel_messages'
const FIRESTORE_IN_QUERY_LIMIT = 30

export interface ListChannelRepliesForGovOptions {
  since?: number
  minScore?: number
  limit?: number
}

export interface ListChannelRepliesForUserOptions {
  since?: number
  limit?: number
}

type StoredChannelReply = Omit<ChannelReply, 'createdAt'> & {
  createdAt: FirestoreTimestamp
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 20, 1), 100)
}

function toChannelReply(data: FirebaseFirestore.DocumentData): ChannelReply {
  const reply = data as StoredChannelReply
  return {
    replyId: reply.replyId,
    messageId: reply.messageId,
    govId: reply.govId,
    content: reply.content,
    matchScore: reply.matchScore,
    createdAt: fromFirestoreTimestamp(reply.createdAt),
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function upsertChannelReply(reply: ChannelReply): Promise<ChannelReply> {
  const storedReply: StoredChannelReply = {
    ...reply,
    createdAt: toFirestoreTimestamp(reply.createdAt),
  }

  await db.collection(CHANNEL_REPLIES_COLLECTION).doc(reply.replyId).set(storedReply, { merge: true })
  return reply
}

export async function listChannelRepliesForGov(
  govId: string,
  options: ListChannelRepliesForGovOptions = {},
): Promise<ChannelReply[]> {
  const limit = normalizeLimit(options.limit)
  const since = options.since ?? 0
  const minScore = options.minScore ?? 0
  const fetchLimit = Math.min(Math.max(limit * 3, limit + 1), 300)

  const snapshot = await db
    .collection(CHANNEL_REPLIES_COLLECTION)
    .where('govId', '==', govId)
    .where('createdAt', '>', FirestoreTimestamp.fromMillis(since))
    .orderBy('createdAt', 'desc')
    .limit(fetchLimit)
    .get()

  return snapshot.docs
    .map(doc => toChannelReply(doc.data()))
    .filter(reply => reply.matchScore >= minScore)
    .slice(0, limit)
}

export async function listChannelRepliesForUser(
  uid: string,
  options: ListChannelRepliesForUserOptions = {},
): Promise<ChannelReply[]> {
  const limit = normalizeLimit(options.limit)
  const since = options.since ?? 0

  const messagesSnapshot = await db
    .collection(CHANNEL_MESSAGES_COLLECTION)
    .where('uid', '==', uid)
    .get()

  const messageIds = messagesSnapshot.docs
    .map(doc => {
      const data = doc.data() as { msgId?: string }
      return data.msgId ?? doc.id
    })
    .filter((msgId): msgId is string => Boolean(msgId))

  if (messageIds.length === 0) {
    return []
  }

  const replySnapshots = await Promise.all(
    chunk(messageIds, FIRESTORE_IN_QUERY_LIMIT).map(messageIdChunk =>
      db
        .collection(CHANNEL_REPLIES_COLLECTION)
        .where('messageId', 'in', messageIdChunk)
        .where('createdAt', '>', FirestoreTimestamp.fromMillis(since))
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get(),
    ),
  )

  return replySnapshots
    .flatMap(snapshot => snapshot.docs.map(doc => toChannelReply(doc.data())))
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
    .slice(0, limit)
}
