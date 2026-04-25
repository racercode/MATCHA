import { Router, type Router as IRouter } from 'express'
import { verifyToken, type AuthedRequest } from '../middleware/auth.js'
import { peerThreads, peerMessages, humanThreads, humanMessages } from '../lib/store.js'

const router: IRouter = Router()
router.use(verifyToken)

// GET /peer-threads/:tid/messages
router.get('/peer-threads/:tid/messages', (req, res) => {
  const { uid } = req as unknown as AuthedRequest
  const { tid } = req.params
  const before = req.query.before ? Number(req.query.before) : Infinity
  const limit = Math.min(Number(req.query.limit) || 50, 100)

  const thread = peerThreads.get(tid)
  if (!thread) {
    res.status(404).json({ success: false, error: 'Thread 不存在', data: null })
    return
  }
  if (thread.userAId !== uid && thread.userBId !== uid) {
    res.status(403).json({ success: false, error: '無存取權限', data: null })
    return
  }

  const all = (peerMessages.get(tid) ?? [])
    .filter(m => m.createdAt < before)
    .sort((a, b) => a.createdAt - b.createdAt)

  const paged = all.slice(-limit)
  res.json({ success: true, data: { items: paged, hasMore: all.length > limit } })
})

// GET /human-threads/:tid/messages
// Shared endpoint: caller must be the citizen userId or the gov_staff whose govId matches
router.get('/human-threads/:tid/messages', (req, res) => {
  const { uid, role, govId } = req as unknown as AuthedRequest
  const { tid } = req.params
  const before = req.query.before ? Number(req.query.before) : Infinity
  const limit = Math.min(Number(req.query.limit) || 50, 100)

  const thread = humanThreads.get(tid)
  if (!thread) {
    res.status(404).json({ success: false, error: 'Thread 不存在', data: null })
    return
  }

  const hasAccess =
    (role === 'citizen' && thread.userId === uid) ||
    (role === 'gov_staff' && thread.govId === govId)

  if (!hasAccess) {
    res.status(403).json({ success: false, error: '無存取權限', data: null })
    return
  }

  const all = (humanMessages.get(tid) ?? [])
    .filter(m => m.createdAt < before)
    .sort((a, b) => a.createdAt - b.createdAt)

  const paged = all.slice(-limit)
  res.json({ success: true, data: { items: paged, hasMore: all.length > limit } })
})

export default router
