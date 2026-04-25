import { Router, type Router as IRouter } from 'express'
import { toMs, type ChannelReply as FirestoreChannelReply } from '@matcha/shared-types'
import { verifyToken, type AuthedRequest } from '../middleware/auth.js'
import { hasFirebaseAdminEnv } from '../lib/firebaseEnv.js'
import { db } from '../lib/firebase.js'

const router: IRouter = Router()
router.use(verifyToken)

function serializeChannelReply(reply: FirestoreChannelReply) {
  return {
    replyId: reply.replyId,
    messageId: reply.messageId,
    govId: reply.govId,
    govName: reply.govId,
    content: reply.content,
    matchScore: reply.matchScore,
    createdAt: toMs(reply.createdAt),
  }
}

// GET /me/persona
router.get('/me/persona', async (req, res) => {
  const { uid } = req as AuthedRequest
  const doc = await db.collection('personas').doc(uid).get()
  res.json({ success: true, data: doc.exists ? { uid, ...doc.data() } : null })
})

// GET /me/channel-replies — poll for GovAgent match replies
router.get('/me/channel-replies', async (req, res) => {
  const { uid } = req as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  if (hasFirebaseAdminEnv()) {
    try {
      const { listChannelRepliesForUser } = await import('../lib/channelRepliesRepo.js')
      const replies = await listChannelRepliesForUser(uid, { since, limit: limit + 1 })
      res.json({
        success: true,
        data: {
          items: replies.slice(0, limit).map(serializeChannelReply),
          hasMore: replies.length > limit,
        },
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '讀取 Firestore channel replies 失敗',
        data: null,
      })
    }
    return
  }

  const msgsSnap = await db.collection('channel_messages').where('uid', '==', uid).get()
  const myMsgIds = new Set(msgsSnap.docs.map(d => d.id))
  if (myMsgIds.size === 0) {
    res.json({ success: true, data: { items: [], hasMore: false } })
    return
  }

  type ReplyDoc = { replyId: string; messageId: string; govId: string; content: string; matchScore: number; createdAt: number }
  const repliesSnap = await db.collection('channel_replies').get()
  const filtered: ReplyDoc[] = repliesSnap.docs
    .map(d => ({ replyId: d.id, ...(d.data() as Omit<ReplyDoc, 'replyId'>) }))
    .filter(r => myMsgIds.has(r.messageId) && r.createdAt > since)

  const govIds = [...new Set(filtered.map(r => r.govId as string))]
  const govNames = new Map<string, string>()
  await Promise.all(govIds.map(async gid => {
    const doc = await db.collection('gov_resources').doc(gid).get()
    govNames.set(gid, doc.exists ? (doc.data()!.name as string) : gid)
  }))

  const items = filtered
    .map(r => ({
      replyId: r.replyId,
      messageId: r.messageId,
      govId: r.govId,
      govName: govNames.get(r.govId) ?? r.govId,
      content: r.content,
      matchScore: r.matchScore,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)

  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

// GET /me/peer-threads — poll for CoffeeAgent peer matches
router.get('/me/peer-threads', async (req, res) => {
  const { uid } = req as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const [snapA, snapB] = await Promise.all([
    db.collection('peer_threads').where('userAId', '==', uid).get(),
    db.collection('peer_threads').where('userBId', '==', uid).get(),
  ])

  type PeerThreadDoc = { tid: string; type: string; userAId: string; userBId: string; matchRationale: string; status: string; createdAt: number; updatedAt: number }
  const seen = new Set<string>()
  const threads: PeerThreadDoc[] = []
  for (const doc of [...snapA.docs, ...snapB.docs]) {
    if (seen.has(doc.id)) continue
    seen.add(doc.id)
    const data = doc.data() as Omit<PeerThreadDoc, 'tid'>
    if (data.updatedAt <= since) continue
    threads.push({ tid: doc.id, ...data })
  }

  const peerUids = [...new Set(threads.map(t => (t.userAId === uid ? t.userBId : t.userAId)))]
  const peerPersonas = new Map<string, { displayName: string; summary: string }>()
  await Promise.all(peerUids.map(async peerUid => {
    const doc = await db.collection('personas').doc(peerUid).get()
    if (doc.exists) {
      peerPersonas.set(peerUid, { displayName: doc.data()!.displayName as string, summary: doc.data()!.summary as string })
    }
  }))

  const items = threads.map(t => {
    const peerUid = t.userAId === uid ? t.userBId : t.userAId
    const peer = peerPersonas.get(peerUid)
    return {
      tid: t.tid,
      type: t.type,
      peer: { uid: peerUid, displayName: peer?.displayName ?? peerUid, summary: peer?.summary ?? '' },
      matchRationale: t.matchRationale,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }
  }).sort((a, b) => b.updatedAt - a.updatedAt)

  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

// GET /me/human-threads — poll for gov-opened human threads
router.get('/me/human-threads', async (req, res) => {
  const { uid } = req as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  type ThreadDoc = { tid: string; type: string; govId: string; channelReplyId: string; matchScore: number; status: string; createdAt: number; updatedAt: number }
  const snap = await db.collection('human_threads').where('userId', '==', uid).get()
  const threads: ThreadDoc[] = snap.docs
    .map(d => ({ tid: d.id, ...(d.data() as Omit<ThreadDoc, 'tid'>) }))
    .filter(t => t.updatedAt > since)

  const govIds = [...new Set(threads.map(t => t.govId as string))]
  const govNames = new Map<string, string>()
  await Promise.all(govIds.map(async gid => {
    const doc = await db.collection('gov_resources').doc(gid).get()
    govNames.set(gid, doc.exists ? (doc.data()!.name as string) : gid)
  }))

  const items = threads
    .map(t => ({
      tid: t.tid,
      type: t.type,
      govId: t.govId,
      govName: govNames.get(t.govId) ?? t.govId,
      channelReplyId: t.channelReplyId,
      matchScore: t.matchScore,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

export default router
