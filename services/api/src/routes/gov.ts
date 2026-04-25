import { Router, type Router as IRouter } from 'express'
import type { ChannelMessage, GovernmentResource } from '@matcha/shared-types'
import { verifyToken, requireGovStaff, type AuthedRequest } from '../middleware/auth.js'
import { fakeChannelMessages, fakeGovernmentResources } from '../agent/gov/fakeData.js'
import { initGovManagedAgentSession } from '../agent/gov/managedAgent.js'
import { runGovAgentPipeline } from '../agent/gov/pipeline.js'
import type { GovAgentPipelineResult } from '../agent/gov/types.js'

const router: IRouter = Router()
router.use(verifyToken, requireGovStaff)

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
  resources: GovernmentResource[]
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

  return {
    msgId: input.msgId,
    uid: input.uid,
    summary: input.summary,
    publishedAt: typeof input.publishedAt === 'number' ? input.publishedAt : Date.now(),
  }
}

export function selectResources(agencyId: string, resourceId?: string): GovernmentResource[] {
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

router.get('/gov/resources', async (req, res) => {
  const { agencyId } = req as AuthedRequest
  // TODO: query Firestore /resources where agencyId matches
  res.json({ success: true, data: { items: [], total: 0, hasMore: false } })
})

router.post('/gov/resources', async (req, res) => {
  const { uid, agencyId } = req as AuthedRequest
  const { name, description, eligibilityCriteria, contactUrl } = req.body
  if (!name || !description || !eligibilityCriteria) {
    res.status(400).json({ success: false, error: '缺少必要欄位', data: null })
    return
  }
  // TODO: write to Firestore, initialize Gov Agent with this resource
  const resource = {
    rid: `rid-${Date.now()}`,
    agencyId,
    agencyName: '', // TODO: fetch from agency profile
    name, description, eligibilityCriteria,
    contactUrl,
    createdAt: Date.now(),
  }
  res.status(201).json({ success: true, data: resource })
})

router.post('/gov/agent/run', async (req, res) => {
  const authed = req as AuthedRequest
  const planResult = buildGovAgentRunPlan(req.body as RunGovAgentRequestBody | undefined, authed.agencyId)

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

router.get('/gov/threads', async (req, res) => {
  const { agencyId } = req as AuthedRequest
  const { type, status, limit = '20', offset = '0' } = req.query
  // TODO: query Firestore threads where initiatorId starts with gov:{rid} for this agency
  res.json({ success: true, data: { items: [], total: 0, hasMore: false } })
})

router.get('/gov/dashboard', async (req, res) => {
  const { agencyId } = req as AuthedRequest
  const { since } = req.query
  // TODO: aggregate stats from Firestore
  res.json({
    success: true,
    data: {
      totalMatches: 0,
      humanTakeoverCount: 0,
      activeThreads: 0,
      matchedToday: 0,
      needsDistribution: {},
    },
  })
})

export default router
