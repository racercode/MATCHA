import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import { db } from './firebase.js'

const GOV_AGENT_RUNS_COLLECTION = 'gov_agent_runs'

export type GovAgentRunStatus = 'running' | 'completed' | 'failed'

export interface GovAgentRunRecord {
  messageId: string
  status: GovAgentRunStatus
  startedAt?: FirestoreTimestamp
  completedAt?: FirestoreTimestamp
  failedAt?: FirestoreTimestamp
  resourceCount?: number
  matchCount?: number
  error?: string
}

export type StartGovAgentRunResult =
  | { started: true; record: GovAgentRunRecord }
  | { started: false; record: GovAgentRunRecord }

function toGovAgentRunRecord(messageId: string, data: FirebaseFirestore.DocumentData): GovAgentRunRecord {
  return {
    messageId,
    status: data.status as GovAgentRunStatus,
    ...(data.startedAt ? { startedAt: data.startedAt as FirestoreTimestamp } : {}),
    ...(data.completedAt ? { completedAt: data.completedAt as FirestoreTimestamp } : {}),
    ...(data.failedAt ? { failedAt: data.failedAt as FirestoreTimestamp } : {}),
    ...(typeof data.resourceCount === 'number' ? { resourceCount: data.resourceCount } : {}),
    ...(typeof data.matchCount === 'number' ? { matchCount: data.matchCount } : {}),
    ...(typeof data.error === 'string' ? { error: data.error } : {}),
  }
}

export async function tryStartGovAgentRun(messageId: string): Promise<StartGovAgentRunResult> {
  const runRef = db.collection(GOV_AGENT_RUNS_COLLECTION).doc(messageId)

  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(runRef)
    if (snapshot.exists) {
      const record = toGovAgentRunRecord(messageId, snapshot.data() ?? {})
      if (record.status === 'running' || record.status === 'completed') {
        return { started: false, record }
      }
    }

    const record: GovAgentRunRecord = {
      messageId,
      status: 'running',
      startedAt: FirestoreTimestamp.now(),
    }
    transaction.set(runRef, record, { merge: true })
    return { started: true, record }
  })
}

export async function completeGovAgentRun(messageId: string, data: { resourceCount: number; matchCount: number }): Promise<void> {
  await db.collection(GOV_AGENT_RUNS_COLLECTION).doc(messageId).set({
    messageId,
    status: 'completed',
    completedAt: FirestoreTimestamp.now(),
    resourceCount: data.resourceCount,
    matchCount: data.matchCount,
  }, { merge: true })
}

export async function failGovAgentRun(messageId: string, error: string): Promise<void> {
  await db.collection(GOV_AGENT_RUNS_COLLECTION).doc(messageId).set({
    messageId,
    status: 'failed',
    failedAt: FirestoreTimestamp.now(),
    error,
  }, { merge: true })
}
