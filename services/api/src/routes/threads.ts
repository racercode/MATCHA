import { Router } from 'express'
import { verifyToken, type AuthedRequest } from '../middleware/auth.js'

const router = Router()
router.use(verifyToken)

router.get('/threads', async (req, res) => {
  const { uid, role } = req as AuthedRequest
  const { type, status, limit = '20', offset = '0' } = req.query
  // TODO: query Firestore threads where responderId or initiatorId matches uid
  res.json({ success: true, data: { items: [], total: 0, hasMore: false } })
})

router.get('/threads/:tid', async (req, res) => {
  const { tid } = req.params
  // TODO: fetch Firestore /threads/{tid}, verify access
  res.json({ success: true, data: null })
})

router.get('/threads/:tid/messages', async (req, res) => {
  const { tid } = req.params
  const { limit = '50', before } = req.query
  // TODO: fetch Firestore /threads/{tid}/messages, order by createdAt, paginate by `before`
  res.json({ success: true, data: { items: [], total: 0, hasMore: false } })
})

router.post('/threads/:tid/message', async (req, res) => {
  const { tid } = req.params
  const { uid } = req as AuthedRequest
  const { content } = req.body
  if (!content) {
    res.status(400).json({ success: false, error: '缺少 content', data: null })
    return
  }
  // TODO: write message to Firestore, broadcast via WS
  const msg = {
    mid: `msg-${Date.now()}`,
    tid,
    from: `human:${uid}`,
    type: 'human_note',
    content: { text: content },
    createdAt: Date.now(),
  }
  res.json({ success: true, data: msg })
})

router.post('/threads/:tid/join', async (req, res) => {
  const { tid } = req.params
  const { uid, role } = req as AuthedRequest
  // TODO: update presence in Firestore, broadcast presence_update via WS
  res.json({ success: true, data: { tid, userPresence: 'human', govPresence: 'agent' } })
})

router.post('/threads/:tid/leave', async (req, res) => {
  const { tid } = req.params
  const { uid, role } = req as AuthedRequest
  // TODO: update presence in Firestore, broadcast presence_update via WS
  res.json({ success: true, data: { tid, userPresence: 'agent', govPresence: 'agent' } })
})

export default router
