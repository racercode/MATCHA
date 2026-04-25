import { Router, type Router as IRouter } from 'express'
import multer from 'multer'
import { msToTimestamp, nowTimestamp, type ChannelMessage, type GovernmentResource as AgentGovernmentResource } from '@matcha/shared-types'
import { verifyToken, requireGovStaff, type AuthedRequest } from '../middleware/auth.js'
import { fakeChannelMessages, fakeGovernmentResources } from '../agent/gov/fakeData.js'
import { initGovManagedAgentSession } from '../agent/gov/managedAgent.js'
import { runGovAgentPipeline } from '../agent/gov/pipeline.js'
import type { GovAgentPipelineResult } from '../agent/gov/types.js'
import { channelMessages, channelReplies, humanThreads, humanMessages, govResources, getCitizenInfo } from '../lib/store.js'

const router: IRouter = Router()
router.use(verifyToken, requireGovStaff)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

export const DEFAULT_AGENCY_ID = 'taipei-youth-dept'
export const DEFAULT_THRESHOLD = 70

export interface RunGovAgentRequestBody {
  agencyId?: string
  resourceId?: string
  message?: Partial<ChannelMessage>
  broadcast?: Partial<ChannelMessage>
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
    thread: result.thread,
    initialMessage: result.initialMessage,
    reason: result.assessment.decision.reason,
    missingInfo: result.assessment.decision.missingInfo,
    assessment: result.assessment,
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
router.get('/gov/channel-replies', (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const since = Number(req.query.since) || 0
  const minScore = Number(req.query.minScore) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  // Build msgId → citizenUid map
  const msgToUid = new Map<string, string>()
  for (const msg of channelMessages.values()) {
    msgToUid.set(msg.msgId, msg.uid)
  }

  // Build replyId → humanThreadOpened map
  const openedReplies = new Set<string>()
  for (const t of humanThreads.values()) {
    openedReplies.add(t.channelReplyId)
  }

  const items = []
  for (const reply of channelReplies.values()) {
    if (reply.govId !== govId) continue
    if (reply.createdAt <= since) continue
    if (reply.matchScore < minScore) continue

    const citizenUid = msgToUid.get(reply.messageId) ?? ''
    items.push({
      replyId: reply.replyId,
      messageId: reply.messageId,
      govId: reply.govId,
      content: reply.content,
      matchScore: reply.matchScore,
      createdAt: reply.createdAt,
      citizen: getCitizenInfo(citizenUid),
      humanThreadOpened: openedReplies.has(reply.replyId),
    })
  }

  items.sort((a, b) => b.createdAt - a.createdAt)
  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

// POST /gov/channel-replies/:replyId/open — open a HumanThread for a matched citizen
router.post('/gov/channel-replies/:replyId/open', (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const { replyId } = req.params

  const reply = channelReplies.get(replyId)
  if (!reply) {
    res.status(404).json({ success: false, error: '回覆不存在', data: null })
    return
  }
  if (reply.govId !== govId) {
    res.status(403).json({ success: false, error: '無存取權限', data: null })
    return
  }

  // Idempotent: return existing thread if already opened
  for (const t of humanThreads.values()) {
    if (t.channelReplyId === replyId) {
      res.json({ success: true, data: t })
      return
    }
  }

  // Find citizen uid from the channel message
  const msg = channelMessages.get(reply.messageId)
  if (!msg) {
    res.status(404).json({ success: false, error: '原始訊息不存在', data: null })
    return
  }

  const now = Date.now()
  const tid = `ht-${now}`
  const thread = {
    tid,
    type: 'gov_user' as const,
    userId: msg.uid,
    govId: reply.govId,
    channelReplyId: replyId,
    matchScore: reply.matchScore,
    status: 'open' as const,
    createdAt: now,
    updatedAt: now,
  }

  humanThreads.set(tid, thread)
  humanMessages.set(tid, [])

  res.status(201).json({ success: true, data: thread })
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
router.get('/gov/dashboard', (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const since = req.query.since ? Number(req.query.since) : Date.now() - 7 * 86_400_000

  const myReplies = [...channelReplies.values()].filter(r => r.govId === govId && r.createdAt >= since)
  const totalReplies = myReplies.length
  const avgMatchScore = totalReplies ? myReplies.reduce((s, r) => s + r.matchScore, 0) / totalReplies : 0

  const myThreads = [...humanThreads.values()].filter(t => t.govId === govId && t.createdAt >= since)
  const openedConversations = myThreads.length
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
router.get('/gov/human-threads', (req, res) => {
  const { govId } = req as unknown as AuthedRequest
  const since = Number(req.query.since) || 0
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const items = []
  for (const thread of humanThreads.values()) {
    if (thread.govId !== govId) continue
    if (thread.updatedAt <= since) continue
    items.push({
      tid: thread.tid,
      type: thread.type,
      govId: thread.govId,
      channelReplyId: thread.channelReplyId,
      matchScore: thread.matchScore,
      status: thread.status,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      citizen: getCitizenInfo(thread.userId),
    })
  }

  items.sort((a, b) => b.updatedAt - a.updatedAt)
  res.json({ success: true, data: { items: items.slice(0, limit), hasMore: items.length > limit } })
})

// GET /gov/resources
router.get('/gov/resources', (_req, res) => {
  const items = [...govResources.values()].map(({ pdfText: _, ...r }) => r)
  res.json({ success: true, data: { items } })
})

// POST /gov/resources
router.post('/gov/resources', (req, res) => {
  const { name, description, eligibilityCriteria, contactUrl } = req.body
  if (!name || !description || !Array.isArray(eligibilityCriteria)) {
    res.status(400).json({ success: false, error: '缺少必要欄位', data: null })
    return
  }

  const rid = `rid-${Date.now()}`
  const resource = {
    rid,
    name,
    description,
    eligibilityCriteria: eligibilityCriteria as string[],
    ...(contactUrl ? { contactUrl } : {}),
    createdAt: Date.now(),
  }
  govResources.set(rid, resource)
  res.status(201).json({ success: true, data: resource })
})

// POST /gov/resources/:rid/pdf
router.post('/gov/resources/:rid/pdf', upload.single('pdf'), (req, res) => {
  const { rid } = req.params
  const resource = govResources.get(rid)
  if (!resource) {
    res.status(404).json({ success: false, error: '資源不存在', data: null })
    return
  }
  if (!req.file) {
    res.status(400).json({ success: false, error: '缺少 pdf 欄位', data: null })
    return
  }

  const pdfStoragePath = `gov-resources/${rid}.pdf`
  // Store file bytes in memory (no Firebase Storage); pretend we extracted text
  const extractedChars = req.file.size // approximate
  resource.pdfStoragePath = pdfStoragePath
  resource.pdfText = `[PDF uploaded: ${req.file.originalname}, ${req.file.size} bytes]`

  res.json({ success: true, data: { rid, pdfStoragePath, extractedChars } })
})

export default router
