import { Router, type Router as IRouter } from 'express'
import { verifyToken, type AuthedRequest } from '../middleware/auth.js'

const router: IRouter = Router()
router.use(verifyToken)

router.get('/me/persona', async (req, res) => {
  const { uid } = req as AuthedRequest
  // TODO: fetch UserPersona from Firestore /personas/{uid}
  res.json({ success: true, data: { uid, displayName: '', summary: '', needs: [], offers: [], updatedAt: Date.now() } })
})

router.post('/me/chat', async (req, res) => {
  const { content } = req.body
  if (!content) {
    res.status(400).json({ success: false, error: '缺少 content', data: null })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // TODO: stream from Persona Agent (Claude managed agent)
  // Placeholder: echo back a static streaming response
  const chunks = ['收到你的訊息。', ' 正在分析你的需求...']
  for (const chunk of chunks) {
    res.write(`data: ${JSON.stringify({ type: 'agent_reply', content: chunk, done: false })}\n\n`)
    await sleep(100)
  }
  res.write(`data: ${JSON.stringify({ type: 'agent_reply', content: '', done: true })}\n\n`)
  res.end()
})

router.post('/me/swipe', async (req, res) => {
  const { cardId, direction, value } = req.body
  if (!cardId || !direction || !value) {
    res.status(400).json({ success: false, error: '缺少必要欄位', data: null })
    return
  }

  // TODO: update persona via Persona Agent, return next SwipeCard or null
  res.json({ success: true, data: null })
})

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export default router
