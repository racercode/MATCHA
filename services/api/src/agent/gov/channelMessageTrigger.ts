import pLimit from 'p-limit'
import type { GovAgentPipelineResult } from './types.js'
import { initGovManagedAgentSession } from './managedAgent.js'
import { runGovAgentPipeline } from './pipeline.js'
import { getChannelMessageById } from '../../lib/channelMessagesRepo.js'
import { listGovernmentResources } from '../../lib/govResourcesRepo.js'
import {
  completeGovAgentRun,
  failGovAgentRun,
  tryStartGovAgentRun,
  type GovAgentRunStatus,
} from '../../lib/govAgentRunsRepo.js'

function getGovAgentConcurrency(): number {
  const raw = process.env.GOV_AGENT_CONCURRENCY
  if (!raw) return 1
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export interface GovAgentRunForMessageOptions {
  threshold?: number
}

export type GovAgentRunForMessageResult =
  | {
      ok: true
      skipped: false
      messageId: string
      resourceCount: number
      matchCount: number
      matches: GovAgentPipelineResult[]
    }
  | {
      ok: true
      skipped: true
      messageId: string
      status: GovAgentRunStatus
    }
  | {
      ok: false
      status: 404
      error: string
    }

export async function handleGovAgentRunForMessage(
  messageId: string,
  options: GovAgentRunForMessageOptions = {},
): Promise<GovAgentRunForMessageResult> {
  const message = await getChannelMessageById(messageId)
  if (!message) {
    return {
      ok: false,
      status: 404,
      error: `找不到 channel message: ${messageId}`,
    }
  }

  const run = await tryStartGovAgentRun(messageId)
  if (!run.started) {
    return {
      ok: true,
      skipped: true,
      messageId,
      status: run.record.status,
    }
  }

  try {
    const concurrency = getGovAgentConcurrency()
    const resources = await listGovernmentResources()

    let resourceAgents: Array<{ resource: typeof resources[number]; sessionId: string }>

    if (concurrency <= 1) {
      // === Sequential：原本的 for loop ===
      resourceAgents = []
      for (const resource of resources) {
        const sessionId = await initGovManagedAgentSession({
          agencyId: resource.agencyId,
          agencyName: resource.agencyName,
          resourceId: resource.rid,
          resourceName: resource.name,
          sessionKey: messageId,
        })
        resourceAgents.push({ resource, sessionId })
      }
    } else {
      // === Parallel：session init 也平行化 ===
      const limit = pLimit(concurrency)
      const settled = await Promise.allSettled(
        resources.map((resource) =>
          limit(async () => {
            const sessionId = await initGovManagedAgentSession({
              agencyId: resource.agencyId,
              agencyName: resource.agencyName,
              resourceId: resource.rid,
              resourceName: resource.name,
              sessionKey: messageId,
            })
            return { resource, sessionId }
          }),
        ),
      )
      resourceAgents = []
      for (const entry of settled) {
        if (entry.status === 'fulfilled') {
          resourceAgents.push(entry.value)
        } else {
          console.error(`[Gov Agent] Session init failed:`, entry.reason)
        }
      }
    }

    const matches = await runGovAgentPipeline(resourceAgents, [message], options.threshold, concurrency)
    await completeGovAgentRun(messageId, {
      resourceCount: resources.length,
      matchCount: matches.length,
    })

    return {
      ok: true,
      skipped: false,
      messageId,
      resourceCount: resources.length,
      matchCount: matches.length,
      matches,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await failGovAgentRun(messageId, message)
    throw error
  }
}
