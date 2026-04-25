import { Router, type Router as IRouter } from 'express'
import multer from 'multer'
import { msToTimestamp, nowTimestamp, toMs, type ChannelMessage, type ChannelReply as FirestoreChannelReply, type GovernmentResource as AgentGovernmentResource } from '@matcha/shared-types'
import { verifyToken, requireGovStaff, type AuthedRequest } from '../middleware/auth.js'
import { fakeChannelMessages, fakeGovernmentResources } from '../agent/gov/fakeData.js'
import { initGovManagedAgentSession } from '../agent/gov/managedAgent.js'
import { runGovAgentPipeline } from '../agent/gov/pipeline.js'
import type { GovAgentPipelineResult } from '../agent/gov/types.js'
import { hasFirebaseAdminEnv } from '../lib/firebaseEnv.js'
import { db } from '../lib/firebase.js'
import {
  createGovernmentResourceDocument,
  getGovernmentResource,
  listGovernmentResourceDocuments,
  listGovernmentResources,
  upsertGovernmentResource,
} from '../lib/govResourcesRepo.js'
import { extractTextFromUploadedFile, normalizeDocumentKind } from '../lib/documentParser.js'

const router: IRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

export const DEFAULT_AGENCY_ID = 'taipei-youth-dept'
export const DEFAULT_THRESHOLD = 70

export type ChannelMessageInput = Partial<ChannelMessage> & { publishedAtMs?: number }

export interface RunGovAgentRequestBody {
  agencyId?: string
  resourceId?: string
  message?: ChannelMessageInput
  broadcast?: ChannelMessageInput
  threshold?: number
}

export interface RunGovAgentForMessageRequestBody {
  messageId?: string
  threshold?: number
}

export interface GovAgentRunPlan {
  agencyId: string
  threshold: number
  trigger: 'channel_message' | 'fake_channel_messages'
  messages: ChannelMessage[]
  resources: AgentGovernmentResource[]
}

export type GovAgentRunPlanResult =
  | { ok: true; plan: GovAgentRunPlan }
  | { ok: false; status: 400 | 404; error: string }

export function normalizeChannelMessage(input: RunGovAgentRequestBody['message']): ChannelMessage | null {
  if (!input) return null

  if (
    typeof input.msgId !== 'string' ||
    typeof input.uid !== 'string' ||
    typeof input.summary !== 'string'
  ) {
    return null
  }

  const publishedAt =
    input.publishedAt ??
    (typeof (input as Record<string, unknown>).publishedAtMs === 'number'
      ? msToTimestamp((input as Record<string, unknown>).publishedAtMs as number)
      : nowTimestamp())

  return {
    msgId: input.msgId,
    uid: input.uid,
    summary: input.summary,
    publishedAt,
  }
}

export function selectResources(agencyId: string, resourceId?: string): AgentGovernmentResource[] {
  return fakeGovernmentResources.filter(resource => {
    if (resource.agencyId !== agencyId) return false
    if (resourceId && resource.rid !== resourceId) return false
    return true
  })
}

export function serializeGovAgentResult(result: GovAgentPipelineResult) {
  return {
    reply: result.reply,
    reason: result.assessment.decision.reason,
    missingInfo: result.assessment.decision.missingInfo,
    assessment: result.assessment,
  }
}

// POST /gov/agent/run-message
// Internal trigger target: Firebase trigger posts messageId, backend reads Firestore and runs all resource agents.
router.post('/gov/agent/run-message', async (req, res) => {
  const body = (req.body ?? {}) as RunGovAgentForMessageRequestBody
  const threshold = typeof body.threshold === 'number' ? body.threshold : DEFAULT_THRESHOLD

  if (typeof body.messageId !== 'string' || !body.messageId.trim()) {
    res.status(400).json({ success: false, error: 'messageId 必須是非空字串', data: null })
    return
  }

  if (body.threshold !== undefined && typeof body.threshold !== 'number') {
    res.status(400).json({ success: false, error: 'threshold 必須是 0 到 100 的整數', data: null })
    return
  }

  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
    res.status(400).json({ success: false, error: 'threshold 必須是 0 到 100 的整數', data: null })
    return
  }

  if (!hasFirebaseAdminEnv()) {
    res.status(500).json({ success: false, error: 'Firebase Admin env 尚未設定，無法讀取 Firestore trigger message', data: null })
    return
  }

  try {
    const { handleGovAgentRunForMessage } = await import('../agent/gov/channelMessageTrigger.js')
    const result = await handleGovAgentRunForMessage(body.messageId.trim(), { threshold })

    if (!result.ok) {
      res.status(result.status).json({ success: false, error: result.error, data: null })
      return
    }

    if (result.skipped) {
      res.json({
        success: true,
        data: {
          messageId: result.messageId,
          skipped: true,
          status: result.status,
        },
      })
      return
    }

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        skipped: false,
        resourceCount: result.resourceCount,
        matchCount: result.matchCount,
        threshold,
        matches: result.matches.map(serializeGovAgentResult),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Gov Agent message trigger 執行失敗',
      data: null,
    })
  }
})

router.use('/gov', verifyToken, requireGovStaff)

function serializeGovChannelReply(reply: FirestoreChannelReply, citizenUid = '') {
  return {
    replyId: reply.replyId,
    messageId: reply.messageId,
    govId: reply.govId,
    content: reply.content,
    matchScore: reply.matchScore,
    createdAt: toMs(reply.createdAt),
    citizen: { uid: citizenUid, displayName: citizenUid, summary: '' },
    humanThreadOpened: false,
  }
}

export function buildGovAgentRunPlan(
  requestBody: RunGovAgentRequestBody | undefined,
  authedAgencyId?: string,
): GovAgentRunPlanResult {
  const body = requestBody ?? {}
  const agencyId = authedAgencyId ?? body.agencyId ?? DEFAULT_AGENCY_ID
  const rawMessage = body.message ?? body.broadcast
  const hasMessage =
    Object.prototype.hasOwnProperty.call(body, 'message') ||
    Object.prototype.hasOwnProperty.call(body, 'broadcast')
  const threshold = typeof body.threshold === 'number' ? body.threshold : DEFAULT_THRESHOLD
  const message = normalizeChannelMessage(rawMessage)

  if (body.threshold !== undefined && typeof body.threshold !== 'number') {
    return { ok: false, status: 400, error: 'threshold 必須是 0 到 100 的整數' }
  }

  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
    return { ok: false, status: 400, error: 'threshold 必須是 0 到 100 的整數' }
  }

  if (hasMessage && !message) {
    return { ok: false, status: 400, error: 'message 必須包含 msgId、uid 與 summary' }
  }

  const resources = selectResources(agencyId, body.resourceId)
  if (resources.length === 0) {
    return {
      ok: false,
      status: 404,
      error: body.resourceId ? `找不到 resourceId: ${body.resourceId}` : `找不到 agencyId: ${agencyId} 的 fake resources`,
    }
  }

  return {
    ok: true,
    plan: {
      agencyId,
      threshold,
      trigger: message ? 'channel_message' : 'fake_channel_messages',
      messages: message ? [message] : fakeChannelMessages,
      resources,
    },
  }
}

// GET /gov/channel-replies
router.get('/gov/channel-replies', async (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const since = Number(req.query.since) || 0
  const minScore = Number(req.query.minScore) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  if (hasFirebaseAdminEnv()) {
    try {
      const { listChannelRepliesForGov } = await import('../lib/channelRepliesRepo.js')
      const replies = await listChannelRepliesForGov(govId ?? '', { since, minScore, limit: limit + 1 })
      res.json({
        success: true,
        data: {
          items: replies.slice(0, limit).map(reply => serializeGovChannelReply(reply)),
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

  const [repliesSnap, msgsSnap, threadsSnap] = await Promise.all([
    db.collection('channel_replies').where('govId', '==', govId).get(),
    db.collection('channel_messages').get(),
    db.collection('human_threads').where('govId', '==', govId).get(),
  ])

  const msgToUid = new Map<string, string>()
  for (const doc of msgsSnap.docs) {
    msgToUid.set(doc.id, doc.data().uid as string)
  }

  const openedReplies = new Set(threadsSnap.docs.map(d => d.data().channelReplyId as string))

  type ReplyDoc = { replyId: string; messageId: string; govId: string; content: string; matchScore: number; createdAt: number }
  const items = repliesSnap.docs
    .map(d => ({ replyId: d.id, ...(d.data() as Omit<ReplyDoc, 'replyId'>) }))
    .filter(r => r.createdAt > since && r.matchScore >= minScore)
    .map(r => {
      const citizenUid = msgToUid.get(r.messageId) ?? ''
      return {
        replyId: r.replyId,
        messageId: r.messageId,
        govId: r.govId,
        content: r.content,
        matchScore: r.matchScore,
        createdAt: r.createdAt,
        citizen: { uid: citizenUid, displayName: citizenUid, summary: '' },
        humanThreadOpened: openedReplies.has(r.replyId),
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)

  // Enrich citizen info from personas
  const citizenUids = [...new Set(items.map(i => i.citizen.uid).filter(Boolean))]
  const personaMap = new Map<string, { displayName: string; summary: string }>()
  await Promise.all(citizenUids.map(async uid => {
    const doc = await db.collection('personas').doc(uid).get()
    if (doc.exists) {
      personaMap.set(uid, { displayName: doc.data()!.displayName as string, summary: doc.data()!.summary as string })
    }
  }))

  const enriched = items.map(i => ({
    ...i,
    citizen: {
      uid: i.citizen.uid,
      displayName: personaMap.get(i.citizen.uid)?.displayName ?? i.citizen.uid,
      summary: personaMap.get(i.citizen.uid)?.summary ?? '',
    },
  }))

  res.json({ success: true, data: { items: enriched.slice(0, limit), hasMore: enriched.length > limit } })
})

// POST /gov/channel-replies/:replyId/open — open a HumanThread for a matched citizen
router.post('/gov/channel-replies/:replyId/open', async (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const { replyId } = req.params

  const replyDoc = await db.collection('channel_replies').doc(replyId).get()
  if (!replyDoc.exists) {
    res.status(404).json({ success: false, error: '回覆不存在', data: null })
    return
  }
  const reply = replyDoc.data()!
  if (reply.govId !== govId) {
    res.status(403).json({ success: false, error: '無存取權限', data: null })
    return
  }

  // Idempotent: return existing thread if already opened
  const existingSnap = await db.collection('human_threads')
    .where('channelReplyId', '==', replyId)
    .get()
  if (!existingSnap.empty) {
    const doc = existingSnap.docs[0]
    res.json({ success: true, data: { tid: doc.id, ...doc.data() } })
    return
  }

  const msgDoc = await db.collection('channel_messages').doc(reply.messageId as string).get()
  if (!msgDoc.exists) {
    res.status(404).json({ success: false, error: '原始訊息不存在', data: null })
    return
  }
  const msg = msgDoc.data()!

  const now = Date.now()
  const tid = `ht-${now}`
  const thread = {
    type: 'gov_user' as const,
    userId: msg.uid as string,
    govId: reply.govId as string,
    channelReplyId: replyId,
    matchScore: reply.matchScore as number,
    status: 'open' as const,
    createdAt: now,
    updatedAt: now,
  }

  await db.collection('human_threads').doc(tid).set(thread)
  res.status(201).json({ success: true, data: { tid, ...thread } })
})

router.post('/gov/agent/run', async (req, res) => {
  const authed = req as AuthedRequest
  const authedAgencyId = (authed as AuthedRequest & { agencyId?: string }).agencyId
  const planResult = buildGovAgentRunPlan(req.body as RunGovAgentRequestBody | undefined, authedAgencyId)

  if (!planResult.ok) {
    res.status(planResult.status).json({
      success: false,
      error: planResult.error,
      data: null,
    })
    return
  }

  const { agencyId, messages, resources, threshold, trigger } = planResult.plan

  try {
    const resourceAgents = await Promise.all(
      resources.map(async resource => ({
        resource,
        sessionId: await initGovManagedAgentSession({
          agencyId: resource.agencyId,
          agencyName: resource.agencyName,
          resourceId: resource.rid,
          resourceName: resource.name,
        }),
      })),
    )

    const results = await runGovAgentPipeline(resourceAgents, messages, threshold)

    res.json({
      success: true,
      data: {
        trigger,
        agencyId,
        resourceIds: resources.map(resource => resource.rid),
        threshold,
        matches: results.map(serializeGovAgentResult),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Gov Agent pipeline 執行失敗',
      data: null,
    })
  }
})

// GET /gov/dashboard
router.get('/gov/dashboard', async (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const since = req.query.since ? Number(req.query.since) : Date.now() - 7 * 86_400_000

  const [repliesSnap, threadsSnap] = await Promise.all([
    db.collection('channel_replies').where('govId', '==', govId).get(),
    db.collection('human_threads').where('govId', '==', govId).get(),
  ])

  const myReplies = repliesSnap.docs
    .map(d => d.data() as { createdAt: number; matchScore: number })
    .filter(r => r.createdAt >= since)

  const openedConversations = threadsSnap.docs
    .filter(d => toMs(d.data().createdAt) >= since)
    .length

  const totalReplies = myReplies.length
  const avgMatchScore = totalReplies ? myReplies.reduce((s, r) => s + r.matchScore, 0) / totalReplies : 0
  const openRate = totalReplies ? openedConversations / totalReplies : 0

  const dist: Record<string, number> = { '90-100': 0, '70-89': 0, '50-69': 0, '0-49': 0 }
  for (const r of myReplies) {
    if (r.matchScore >= 90) dist['90-100']++
    else if (r.matchScore >= 70) dist['70-89']++
    else if (r.matchScore >= 50) dist['50-69']++
    else dist['0-49']++
  }

  res.json({
    success: true,
    data: {
      totalReplies,
      avgMatchScore: Math.round(avgMatchScore * 10) / 10,
      openedConversations,
      openRate: Math.round(openRate * 100) / 100,
      scoreDistribution: dist,
    },
  })
})

// GET /gov/human-threads
router.get('/gov/human-threads', async (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  type GovThreadDoc = { tid: string; type: string; govId: string; userId: string; channelReplyId: string; matchScore: number; status: string; createdAt: number | any; updatedAt: number | any }
  const snap = await db.collection('human_threads').where('govId', '==', govId).get()
  const threads: GovThreadDoc[] = snap.docs
    .map(d => ({ tid: d.id, ...(d.data() as Omit<GovThreadDoc, 'tid'>) }))
    .filter(t => toMs(t.updatedAt) > since)

  const citizenUids = [...new Set(threads.map(t => t.userId))]
  const personaMap = new Map<string, { displayName: string; summary: string }>()
  await Promise.all(citizenUids.map(async uid => {
    const doc = await db.collection('personas').doc(uid).get()
    if (doc.exists) {
      personaMap.set(uid, { displayName: doc.data()!.displayName as string, summary: doc.data()!.summary as string })
    }
  }))

  const items = threads
    .map(t => ({
      tid: t.tid,
      type: t.type,
      govId: t.govId,
      channelReplyId: t.channelReplyId,
      matchScore: t.matchScore,
      status: t.status,
      createdAt: toMs(t.createdAt),
      updatedAt: toMs(t.updatedAt),
      citizen: {
        uid: t.userId,
        displayName: personaMap.get(t.userId)?.displayName ?? t.userId,
        summary: personaMap.get(t.userId)?.summary ?? '',
      },
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

// GET /gov/resources
router.get('/gov/resources', async (_req, res) => {
  const items = await listGovernmentResources()
  res.json({ success: true, data: { items } })
})

// POST /gov/resources
router.post('/gov/resources', async (req, res) => {
  const { rid, agencyId, agencyName, name, description, eligibilityCriteria, contactUrl } = req.body
  if (!name || !description || !Array.isArray(eligibilityCriteria)) {
    res.status(400).json({ success: false, error: '缺少必要欄位', data: null })
    return
  }

  const resource = await upsertGovernmentResource({
    rid: typeof rid === 'string' && rid.trim() ? rid.trim() : `rid-${Date.now()}`,
    agencyId: typeof agencyId === 'string' && agencyId.trim() ? agencyId.trim() : DEFAULT_AGENCY_ID,
    agencyName: typeof agencyName === 'string' && agencyName.trim() ? agencyName.trim() : '臺北市青年局',
    name,
    description,
    eligibilityCriteria: eligibilityCriteria as string[],
    ...(contactUrl ? { contactUrl } : {}),
  })

  res.status(201).json({ success: true, data: resource })
})

// GET /gov/resources/:rid
router.get('/gov/resources/:rid', async (req, res) => {
  const resource = await getGovernmentResource(req.params.rid)
  if (!resource) {
    res.status(404).json({ success: false, error: '資源不存在', data: null })
    return
  }

  res.json({ success: true, data: resource })
})

// GET /gov/resources/:rid/documents
router.get('/gov/resources/:rid/documents', async (req, res) => {
  const resource = await getGovernmentResource(req.params.rid)
  if (!resource) {
    res.status(404).json({ success: false, error: '資源不存在', data: null })
    return
  }

  const documents = await listGovernmentResourceDocuments(req.params.rid)
  res.json({ success: true, data: { items: documents } })
})

// POST /gov/resources/:rid/documents
router.post('/gov/resources/:rid/documents', upload.single('file'), async (req, res) => {
  const { rid } = req.params
  const resource = await getGovernmentResource(rid)
  if (!resource) {
    res.status(404).json({ success: false, error: '資源不存在', data: null })
    return
  }

  const body = req.body as Record<string, unknown>
  const file = req.file
  const filename =
    (typeof body.filename === 'string' && body.filename.trim()) ||
    file?.originalname ||
    (typeof body.sourceUrl === 'string' && body.sourceUrl.trim()) ||
    `document-${Date.now()}`
  const mimeType = file?.mimetype ?? (typeof body.mimeType === 'string' ? body.mimeType : undefined)
  const kind = normalizeDocumentKind(body.kind, filename, mimeType)
  const sourceUrl = typeof body.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : undefined
  let extractedText =
    (typeof body.extractedText === 'string' && body.extractedText) ||
    (typeof body.text === 'string' && body.text) ||
    ''

  if (!extractedText && file) {
    try {
      extractedText = await extractTextFromUploadedFile(file)
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? `文件解析失敗：${error.message}` : '文件解析失敗',
        data: null,
      })
      return
    }
  }

  if (!extractedText.trim()) {
    res.status(400).json({ success: false, error: '缺少可儲存的文件文字，請提供 file、text 或 extractedText', data: null })
    return
  }

  const document = await createGovernmentResourceDocument(rid, {
    filename,
    kind: sourceUrl && !file ? 'url' : kind,
    ...(mimeType ? { mimeType } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    extractedText,
  })

  res.status(201).json({ success: true, data: document })
})

// POST /gov/resources/:rid/pdf
router.post('/gov/resources/:rid/pdf', upload.single('pdf'), async (req, res) => {
  const { rid } = req.params
  const resource = await getGovernmentResource(rid)
  if (!resource) {
    res.status(404).json({ success: false, error: '資源不存在', data: null })
    return
  }
  if (!req.file) {
    res.status(400).json({ success: false, error: '缺少 pdf 欄位', data: null })
    return
  }

  const pdfStoragePath = `gov-resources/${rid}/${req.file.originalname}`
  let extractedText: string
  try {
    extractedText = await extractTextFromUploadedFile(req.file)
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? `PDF 解析失敗：${error.message}` : 'PDF 解析失敗',
      data: null,
    })
    return
  }

  const document = await createGovernmentResourceDocument(rid, {
    filename: req.file.originalname,
    kind: 'pdf',
    mimeType: req.file.mimetype,
    storagePath: pdfStoragePath,
    extractedText,
  })
  await upsertGovernmentResource({ ...resource, pdfStoragePath })

  res.json({ success: true, data: { rid, docId: document.docId, pdfStoragePath, extractedChars: document.textLength } })
})

export default router
