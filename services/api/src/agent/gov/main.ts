import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') })

import { fakeChannelBroadcasts, fakeGovernmentResources } from './fakeData.js'
import { readChannelToolWrapper } from './toolWrappers/index.js'
import { initGovManagedAgentSession } from './managedAgent.js'
import { runGovAgentPipeline } from './pipeline.js'

async function main() {
  console.log('=== MATCHA Gov Agent Pipeline (Phase 1) ===\n')

  const { broadcasts } = readChannelToolWrapper()
  console.log(`[read_channel] ${broadcasts.length} broadcasts loaded`)

  console.log('[Gov Agent] Resources will be loaded by the agent via custom tools')
  console.log()

  console.log('[Gov Agent] Initializing Claude Managed Agent session...')
  const sessionId = await initGovManagedAgentSession({
    sessionKey: `run-${Date.now()}`,
  })
  console.log()

  console.log('[Gov Agent] Running match pipeline...\n')
  const results = await runGovAgentPipeline(sessionId, broadcasts, fakeGovernmentResources)

  console.log('\n=== Pipeline Results ===\n')
  console.log(`Total matches: ${results.length}\n`)

  for (const result of results) {
    console.log(`--- Match ---`)
    console.log(`User:     ${result.assessment.broadcast.displayName} (${result.assessment.broadcast.uid})`)
    console.log(`Resource: ${result.assessment.resource.name} (${result.assessment.resource.rid})`)
    console.log(`Score:    ${result.assessment.decision?.score ?? 'N/A'}`)
    console.log(`Reason:   ${result.assessment.decision?.reason ?? 'N/A'}`)
    console.log(`Missing:  ${result.assessment.decision?.missingInfo?.join(', ') || '(none)'}`)
    console.log(`Message:  ${result.assessment.decision?.suggestedFirstMessage ?? 'N/A'}`)
    console.log(`Thread:   ${result.thread.tid}`)
    console.log(`Msg ID:   ${result.initialMessage.mid}`)
    console.log()
  }

  console.log('=== Full JSON ===\n')
  console.log(JSON.stringify(results, null, 2))
}

main().catch(console.error)
