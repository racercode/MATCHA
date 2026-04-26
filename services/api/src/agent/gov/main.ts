import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

import pLimit from 'p-limit'
import { fakeGovernmentResources } from './fakeData.js'
import { readChannelToolWrapper } from './toolWrappers/readChannel.js'
import { initGovManagedAgentSession } from './managedAgent.js'
import { runGovAgentPipeline } from './pipeline.js'
import type { GovernmentResource } from '@matcha/shared-types'

function getGovAgentConcurrency(): number {
  const raw = process.env.GOV_AGENT_CONCURRENCY
  if (!raw) return 1
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

async function main() {
  const concurrency = getGovAgentConcurrency()
  console.log(`=== MATCHA Gov Agent Pipeline (Phase 1) [concurrency=${concurrency}] ===\n`)

  const { messages } = await readChannelToolWrapper()
  console.log(`[read_channel] ${messages.length} channel messages loaded`)

  console.log(`[Gov Agent] ${fakeGovernmentResources.length} resource agents will be initialized`)
  console.log()

  console.log('[Gov Agent] Initializing Claude Managed Agent sessions...')
  const runKey = `run-${Date.now()}`
  let resourceAgents: Array<{ sessionId: string; resource: GovernmentResource }>

  if (concurrency <= 1) {
    resourceAgents = []
    for (const resource of fakeGovernmentResources) {
      const sessionId = await initGovManagedAgentSession({
        agencyId: resource.agencyId,
        agencyName: resource.agencyName,
        resourceId: resource.rid,
        resourceName: resource.name,
        sessionKey: runKey,
      })
      resourceAgents.push({ sessionId, resource })
    }
  } else {
    const limit = pLimit(concurrency)
    const settled = await Promise.allSettled(
      fakeGovernmentResources.map((resource) =>
        limit(async () => {
          const sessionId = await initGovManagedAgentSession({
            agencyId: resource.agencyId,
            agencyName: resource.agencyName,
            resourceId: resource.rid,
            resourceName: resource.name,
            sessionKey: runKey,
          })
          return { sessionId, resource }
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
  console.log()

  console.log('[Gov Agent] Running match pipeline...\n')
  const results = await runGovAgentPipeline(resourceAgents, messages, 30, concurrency)

  console.log('\n=== Pipeline Results ===\n')
  console.log(`Total matches: ${results.length}\n`)

  for (const result of results) {
    console.log(`--- Match ---`)
    console.log(`User:     ${result.assessment.channelMessage.uid}`)
    console.log(`Resource: ${result.assessment.resource.name} (${result.assessment.resource.rid})`)
    console.log(`Score:    ${result.assessment.decision?.score ?? 'N/A'}`)
    console.log(`Reason:   ${result.assessment.decision?.reason ?? 'N/A'}`)
    console.log(`Missing:  ${result.assessment.decision?.missingInfo?.join(', ') || '(none)'}`)
    console.log(`Reply:    ${result.reply.replyId}`)
    console.log(`Content:  ${result.reply.content}`)
    console.log()
  }

  console.log('=== Full JSON ===\n')
  console.log(JSON.stringify(results, null, 2))
}

main().catch(console.error)
