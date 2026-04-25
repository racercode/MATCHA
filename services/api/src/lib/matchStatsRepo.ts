import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import { db } from './firebase.js'

const MATCH_STATS_COLLECTION = 'match_stats'

export interface MatchStatRecord {
  resourceId: string
  agencyId: string
  resourceName: string
  totalAttempts: number
  totalMatches: number
  updatedAt: FirestoreTimestamp
}

export async function recordMatchAttempt(
  resourceId: string,
  matched: boolean,
  meta: { agencyId: string; resourceName: string },
): Promise<void> {
  const ref = db.collection(MATCH_STATS_COLLECTION).doc(resourceId)

  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref)
    const data = snap.data()
    const prev = {
      totalAttempts: (data?.totalAttempts as number) ?? 0,
      totalMatches: (data?.totalMatches as number) ?? 0,
    }

    transaction.set(ref, {
      resourceId,
      agencyId: meta.agencyId,
      resourceName: meta.resourceName,
      totalAttempts: prev.totalAttempts + 1,
      totalMatches: prev.totalMatches + (matched ? 1 : 0),
      updatedAt: FirestoreTimestamp.now(),
    }, { merge: true })
  })
}

export async function getMatchStats(resourceId: string): Promise<MatchStatRecord | null> {
  const snap = await db.collection(MATCH_STATS_COLLECTION).doc(resourceId).get()
  if (!snap.exists) return null
  return snap.data() as MatchStatRecord
}

export async function getAllMatchStats(): Promise<MatchStatRecord[]> {
  const snap = await db.collection(MATCH_STATS_COLLECTION).get()
  return snap.docs.map(doc => doc.data() as MatchStatRecord)
}
