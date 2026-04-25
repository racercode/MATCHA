import { Router, type Router as IRouter } from 'express'
import { verifyToken, type AuthedRequest } from '../middleware/auth.js'
import {
  personas,
  channelReplies,
  channelMessages,
  peerThreads,
  humanThreads,
  getGovName,
  getCitizenInfo,
} from '../lib/store.js'

const router: IRouter = Router()
router.use(verifyToken)

// GET /me/persona
router.get('/me/persona', (req, res) => {
  const { uid } = req as AuthedRequest
  const persona = personas.get(uid) ?? null
  res.json({ success: true, data: persona })
})

// GET /me/channel-replies — poll for GovAgent match replies
router.get('/me/channel-replies', (req, res) => {
  const { uid } = req as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  // Collect all msgIds that belong to this user
  const myMsgIds = new Set<string>()
  for (const msg of channelMessages.values()) {
    if (msg.uid === uid) myMsgIds.add(msg.msgId)
  }

  const items = []
  for (const reply of channelReplies.values()) {
    if (!myMsgIds.has(reply.messageId)) continue
    if (reply.createdAt <= since) continue
    items.push({
      replyId: reply.replyId,
      messageId: reply.messageId,
      govId: reply.govId,
      govName: getGovName(reply.govId),
      content: reply.content,
      matchScore: reply.matchScore,
      createdAt: reply.createdAt,
    })
  }

  items.sort((a, b) => b.createdAt - a.createdAt)
  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

// GET /me/peer-threads — poll for CoffeeAgent peer matches
router.get('/me/peer-threads', (req, res) => {
  const { uid } = req as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const items = []
  for (const thread of peerThreads.values()) {
    if (thread.userAId !== uid && thread.userBId !== uid) continue
    if (thread.updatedAt <= since) continue

    const peerUid = thread.userAId === uid ? thread.userBId : thread.userAId
    items.push({
      tid: thread.tid,
      type: thread.type,
      peer: getCitizenInfo(peerUid),
      matchRationale: thread.matchRationale,
      status: thread.status,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    })
  }

  items.sort((a, b) => b.updatedAt - a.updatedAt)
  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

// GET /me/human-threads — poll for gov-opened human threads
router.get('/me/human-threads', (req, res) => {
  const { uid } = req as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const items = []
  for (const thread of humanThreads.values()) {
    if (thread.userId !== uid) continue
    if (thread.updatedAt <= since) continue
    items.push({
      tid: thread.tid,
      type: thread.type,
      govId: thread.govId,
      govName: getGovName(thread.govId),
      channelReplyId: thread.channelReplyId,
      matchScore: thread.matchScore,
      status: thread.status,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    })
  }

  items.sort((a, b) => b.updatedAt - a.updatedAt)
  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

export default router
