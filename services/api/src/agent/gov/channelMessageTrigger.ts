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
    const resources = await listGovernmentResources()
    const resourceAgents: Array<{ resource: typeof resources[number]; sessionId: string }> = []
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

    const matches = await runGovAgentPipeline(resourceAgents, [message], options.threshold)
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
