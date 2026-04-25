import { Router, type Router as IRouter } from 'express'
import multer from 'multer'
import { toMs, type ChannelReply as FirestoreChannelReply } from '@matcha/shared-types'
import { verifyToken, type AuthedRequest } from '../middleware/auth.js'
import { hasFirebaseAdminEnv } from '../lib/firebaseEnv.js'
import { auth, db, bucket } from '../lib/firebase.js'
import { clearUserAgentSessions } from '../agent/general/agentRegistry.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const router: IRouter = Router()
router.use(verifyToken)

function serializeChannelReply(reply: FirestoreChannelReply, govName: string) {
  return {
    replyId: reply.replyId,
    messageId: reply.messageId,
    govId: reply.govId,
    govName,
    content: reply.content,
    matchScore: reply.matchScore,
    createdAt: toMs(reply.createdAt),
  }
}

async function resolveGovNames(govIds: string[]): Promise<Map<string, string>> {
  const govNames = new Map<string, string>()
  await Promise.all(govIds.map(async gid => {
    const doc = await db.collection('gov_resources').doc(gid).get()
    govNames.set(gid, doc.exists ? (doc.data()!.name as string) : gid)
  }))
  return govNames
}

// GET /me/profile
router.get('/me/profile', async (req, res) => {
  const { uid } = req as AuthedRequest
  const snap = await db.collection('userProfiles').doc(uid).get()
  if (!snap.exists) {
    res.json({ success: true, data: null })
    return
  }
  const d = snap.data()!
  res.json({
    success: true,
    data: {
      name: typeof d.name === 'string' ? d.name : '',
      bio: typeof d.bio === 'string' ? d.bio : '',
      school: typeof d.school === 'string' ? d.school : '',
      grade: typeof d.grade === 'string' ? d.grade : '',
      birthday: typeof d.birthday === 'string' ? d.birthday : '',
      avatar: typeof d.avatar === 'string' ? d.avatar : '',
    },
  })
})

// PUT /me/profile
router.put('/me/profile', async (req, res) => {
  const { uid } = req as AuthedRequest
  const { name, bio, school, grade, birthday, avatar } = req.body as Record<string, unknown>

  const update: Record<string, unknown> = { updatedAt: Date.now() }
  if (typeof name === 'string') update.name = name
  if (typeof bio === 'string') update.bio = bio
  if (typeof school === 'string') update.school = school
  if (typeof grade === 'string') update.grade = grade
  if (typeof birthday === 'string') update.birthday = birthday
  if (typeof avatar === 'string') update.avatar = avatar

  await db.collection('userProfiles').doc(uid).set(update, { merge: true })

  const authUpdate: { displayName?: string; photoURL?: string } = {}
  if (typeof name === 'string') authUpdate.displayName = name
  if (typeof avatar === 'string' && /^https?:\/\//.test(avatar)) authUpdate.photoURL = avatar
  if (Object.keys(authUpdate).length > 0) {
    await auth.updateUser(uid, authUpdate)
  }

  res.json({ success: true, data: update })
})

// POST /me/avatar
router.post('/me/avatar', upload.single('avatar'), async (req, res) => {
  const { uid } = req as AuthedRequest
  if (!req.file) {
    res.status(400).json({ success: false, error: '未提供圖片', data: null })
    return
  }

  const ext = req.file.mimetype.split('/')[1] ?? 'jpg'
  const filePath = `avatars/${uid}/${Date.now()}.${ext}`
  const file = bucket.file(filePath)

  await file.save(req.file.buffer, { contentType: req.file.mimetype })
  await file.makePublic()

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`

  await db.collection('userProfiles').doc(uid).set({ avatar: publicUrl, updatedAt: Date.now() }, { merge: true })
  await auth.updateUser(uid, { photoURL: publicUrl })

  res.json({ success: true, data: { avatar: publicUrl } })
})

// GET /me/persona-messages
router.get('/me/persona-messages', async (req, res) => {
  const { uid } = req as AuthedRequest
  const snap = await db.collection('persona_chats').doc(uid).collection('messages').get()
  type MsgDoc = { from: string; text: string; createdAt: { seconds: number; nanoseconds: number } }
  const items = snap.docs
    .map((d) => ({ mid: d.id, ...(d.data() as MsgDoc) }))
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))
  res.json({ success: true, data: { items } })
})

// GET /me/persona
router.get('/me/persona', async (req, res) => {
  const { uid } = req as AuthedRequest
  const doc = await db.collection('personas').doc(uid).get()
  res.json({ success: true, data: doc.exists ? { uid, ...doc.data() } : null })
})

// POST /me/reset-memory
router.post('/me/reset-memory', async (req, res) => {
  const { uid } = req as AuthedRequest

  try {
    const [clearedPersonaSessions, chatSnap] = await Promise.all([
      clearUserAgentSessions(
        'persona-agent-shared',
        (session) => session.key === uid || session.key.startsWith(`${uid}:`),
      ),
      db.collection('persona_chats').doc(uid).collection('messages').get(),
    ])

    const deleteBatch = db.batch()
    for (const doc of chatSnap.docs) {
      deleteBatch.delete(doc.ref)
    }
    deleteBatch.delete(db.collection('persona_chats').doc(uid))
    deleteBatch.delete(db.collection('personas').doc(uid))
    await deleteBatch.commit()

    res.json({
      success: true,
      data: {
        clearedPersonaSessions,
        deletedChatMessages: chatSnap.size,
        deletedPersona: true,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '重置 memory 失敗',
      data: null,
    })
  }
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
      const sliced = replies.slice(0, limit)
      const govNames = await resolveGovNames([...new Set(sliced.map(r => r.govId))])
      res.json({
        success: true,
        data: {
          items: sliced.map(r => serializeChannelReply(r, govNames.get(r.govId) ?? r.govId)),
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
    const [personaDoc, profileDoc] = await Promise.all([
      db.collection('personas').doc(peerUid).get(),
      db.collection('userProfiles').doc(peerUid).get(),
    ])
    const personaName = personaDoc.exists ? (personaDoc.data()!.displayName as string | undefined) : undefined
    const profileName = profileDoc.exists ? (profileDoc.data()!.name as string | undefined) : undefined
    const authUser = await auth.getUser(peerUid).catch(() => null)
    const emailPrefix = authUser?.email?.split('@')[0]
    const displayName = profileName || authUser?.displayName || (personaName && personaName !== peerUid ? personaName : undefined) || emailPrefix || peerUid.slice(0, 8)
    const summary = personaDoc.exists ? (personaDoc.data()!.summary as string) : ''
    peerPersonas.set(peerUid, { displayName, summary })
  }))

  const items = threads.map(t => {
    const peerUid = t.userAId === uid ? t.userBId : t.userAId
    const peer = peerPersonas.get(peerUid)
    return {
      tid: t.tid,
      type: t.type,
      peer: { uid: peerUid, displayName: peer?.displayName ?? peerUid.slice(0, 8), summary: peer?.summary ?? '' },
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

  type ThreadDoc = { tid: string; type: string; govId: string; channelReplyId: string; matchScore: number; status: string; createdAt: number | any; updatedAt: number | any }
  const snap = await db.collection('human_threads').where('userId', '==', uid).get()
  const threads: ThreadDoc[] = snap.docs
    .map(d => ({ tid: d.id, ...(d.data() as Omit<ThreadDoc, 'tid'>) }))
    .filter(t => toMs(t.updatedAt) > since)

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
      createdAt: toMs(t.createdAt),
      updatedAt: toMs(t.updatedAt),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

export default router
