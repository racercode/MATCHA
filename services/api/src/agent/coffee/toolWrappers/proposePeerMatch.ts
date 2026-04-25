import { msToTimestamp } from '@matcha/shared-types'
import { db } from '../../../lib/firebase.js'
import { broadcast } from '../../../ws/push.js'
import type { ProposePeerMatchInput } from '../types.js'

export interface ProposePeerMatchResult {
  threadId: string
  created: boolean
}

export async function proposePeerMatchToolWrapper(input: ProposePeerMatchInput): Promise<ProposePeerMatchResult> {
  const { userAId, userBId, rationale, initialMessage } = input
  const now = Date.now()

  // Dedup: check all threads involving userAId for a match with userBId
  const [snapAasA, snapAasB] = await Promise.all([
    db.collection('peer_threads').where('userAId', '==', userAId).get(),
    db.collection('peer_threads').where('userBId', '==', userAId).get(),
  ])

  for (const doc of [...snapAasA.docs, ...snapAasB.docs]) {
    const data = doc.data()
    if (data.userAId === userBId || data.userBId === userBId) {
      return { threadId: doc.id, created: false }
    }
  }

  const tid = `pt-${now}-${Math.random().toString(36).slice(2, 6)}`
  const threadData = {
    type: 'user_user',
    userAId,
    userBId,
    matchRationale: rationale,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db.collection('peer_threads').doc(tid).set(threadData)

  const introMsg = {
    from: 'coffee_agent',
    content: initialMessage,
    createdAt: msToTimestamp(now),
  }
  const msgRef = db.collection('peer_threads').doc(tid).collection('messages').doc()
  await msgRef.set(introMsg)
  const midObj = { mid: msgRef.id, ...introMsg }

  const [peerADoc, peerBDoc] = await Promise.all([
    db.collection('personas').doc(userAId).get(),
    db.collection('personas').doc(userBId).get(),
  ])
  const peerA = peerADoc.exists ? peerADoc.data()! : {}
  const peerB = peerBDoc.exists ? peerBDoc.data()! : {}

  broadcast(userAId, {
    type: 'match_notify',
    threadId: tid,
    peer: { uid: userBId, displayName: (peerB.displayName as string) ?? userBId, summary: (peerB.summary as string) ?? '' },
  })
  broadcast(userBId, {
    type: 'match_notify',
    threadId: tid,
    peer: { uid: userAId, displayName: (peerA.displayName as string) ?? userAId, summary: (peerA.summary as string) ?? '' },
  })

  broadcast(userAId, { type: 'peer_message', message: midObj })
  broadcast(userBId, { type: 'peer_message', message: midObj })

  console.log(`[Coffee Agent] Peer match created: ${tid} (${userAId} ↔ ${userBId})`)

  const fallbackA = {
    displayName: (peerA.displayName as string) ?? userAId.slice(0, 8),
    summary: (peerA.summary as string) ?? rationale,
    needs: (peerA.needs as string[]) ?? [],
    offers: (peerA.offers as string[]) ?? [],
  }
  const fallbackB = {
    displayName: (peerB.displayName as string) ?? userBId.slice(0, 8),
    summary: (peerB.summary as string) ?? rationale,
    needs: (peerB.needs as string[]) ?? [],
    offers: (peerB.offers as string[]) ?? [],
  }

  // Fire-and-forget: run agent-to-agent intro conversation
  import('../peerIntroAgent.js')
    .then(({ runPeerAgentIntro }) => runPeerAgentIntro(tid, userAId, userBId, fallbackA, fallbackB))
    .catch(err => console.error('[Coffee Agent] peerIntroAgent error:', err))

  return { threadId: tid, created: true }
}
