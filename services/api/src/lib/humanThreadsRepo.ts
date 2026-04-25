import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import { nowTimestamp, type HumanThread } from '@matcha/shared-types'
import { db } from './firebase.js'
import { toFirestoreTimestamp } from './firestoreTimestamp.js'

const HUMAN_THREADS_COLLECTION = 'human_threads'

type StoredHumanThread = Omit<HumanThread, 'createdAt' | 'updatedAt'> & {
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

export async function createHumanThread(params: {
  tid: string
  userId: string
  govId: string
  channelReplyId: string
  matchScore: number
}): Promise<HumanThread> {
  const now = nowTimestamp()
  const thread: HumanThread = {
    tid: params.tid,
    type: 'gov_user',
    userId: params.userId,
    govId: params.govId,
    channelReplyId: params.channelReplyId,
    matchScore: params.matchScore,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  }

  const stored: StoredHumanThread = {
    ...thread,
    createdAt: toFirestoreTimestamp(now),
    updatedAt: toFirestoreTimestamp(now),
  }

  await db.collection(HUMAN_THREADS_COLLECTION).doc(params.tid).set(stored, { merge: true })
  return thread
}
