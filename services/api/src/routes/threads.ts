import { Router, type Router as IRouter } from 'express'
import { toMs } from '@matcha/shared-types'
import { verifyToken, type AuthedRequest } from '../middleware/auth.js'
import { db } from '../lib/firebase.js'

const router: IRouter = Router()
router.use(verifyToken)

// GET /peer-threads/:tid/messages
router.get('/peer-threads/:tid/messages', async (req, res) => {
  const { uid } = req as unknown as AuthedRequest
  const { tid } = req.params
  const before = req.query.before ? Number(req.query.before) : Infinity
  const limit = Math.min(Number(req.query.limit) || 50, 100)

  const threadDoc = await db.collection('peer_threads').doc(tid).get()
  if (!threadDoc.exists) {
    res.status(404).json({ success: false, error: 'Thread 不存在', data: null })
    return
  }
  const thread = threadDoc.data()!
  if (thread.userAId !== uid && thread.userBId !== uid) {
    res.status(403).json({ success: false, error: '無存取權限', data: null })
    return
  }

  type MsgDoc = { mid: string; from: string; content: string; createdAt: { seconds: number; nanoseconds: number } }
  const msgsSnap = await db.collection('peer_threads').doc(tid).collection('messages').get()
  const all: MsgDoc[] = msgsSnap.docs
    .map(d => ({ mid: d.id, ...(d.data() as Omit<MsgDoc, 'mid'>) }))
    .filter(m => toMs(m.createdAt) < before)
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))

  const paged = all.slice(-limit)
  res.json({ success: true, data: { items: paged, hasMore: all.length > limit } })
})

// GET /human-threads/:tid/messages
router.get('/human-threads/:tid/messages', async (req, res) => {
  const { uid, role, govId } = req as unknown as AuthedRequest
  const { tid } = req.params
  const before = req.query.before ? Number(req.query.before) : Infinity
  const limit = Math.min(Number(req.query.limit) || 50, 100)

  const threadDoc = await db.collection('human_threads').doc(tid).get()
  if (!threadDoc.exists) {
    res.status(404).json({ success: false, error: 'Thread 不存在', data: null })
    return
  }
  const thread = threadDoc.data()!

  const hasAccess =
    (role === 'citizen' && thread.userId === uid) ||
    (role === 'gov_staff' && thread.govId === govId)

  if (!hasAccess) {
    res.status(403).json({ success: false, error: '無存取權限', data: null })
    return
  }

  type MsgDoc = { mid: string; from: string; content: string; createdAt: { seconds: number; nanoseconds: number } }
  const msgsSnap = await db.collection('human_threads').doc(tid).collection('messages').get()
  const all: MsgDoc[] = msgsSnap.docs
    .map(d => ({ mid: d.id, ...(d.data() as Omit<MsgDoc, 'mid'>) }))
    .filter(m => toMs(m.createdAt) < before)
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))

  const paged = all.slice(-limit)
  res.json({ success: true, data: { items: paged, hasMore: all.length > limit } })
})

export default router
