import type { ChannelBroadcast, GovernmentResource } from '@matcha/shared-types'
import { client } from './managedAgent.js'
import { proposeMatchToolWrapper } from './toolWrappers/index.js'
import type { MatchDecision, MatchAssessment, GovAgentPipelineResult } from './types.js'

export function parseMatchDecision(rawText: string): MatchDecision {
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const parsed = JSON.parse(cleaned) as MatchDecision

  if (typeof parsed.eligible !== 'boolean') {
    throw new Error('Claude response missing eligible')
  }

  if (!Number.isInteger(parsed.score) || parsed.score < 0 || parsed.score > 100) {
    throw new Error('Claude response score must be an integer from 0 to 100')
  }

  if (typeof parsed.reason !== 'string') {
    throw new Error('Claude response missing reason')
  }

  if (!Array.isArray(parsed.missingInfo)) {
    throw new Error('Claude response missing missingInfo')
  }

  if (typeof parsed.suggestedFirstMessage !== 'string') {
    throw new Error('Claude response missing suggestedFirstMessage')
  }

  return parsed
}

export async function evaluateMatchWithClaude(
  sessionId: string,
  broadcast: ChannelBroadcast,
  resource: GovernmentResource,
): Promise<MatchDecision> {
  const stream = await client.beta.sessions.events.stream(sessionId)

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task: 'evaluate_government_resource_match',
              personaBroadcast: broadcast,
              governmentResource: resource,
            }),
          },
        ],
      },
    ],
  })

  let output = ''

  for await (const event of stream) {
    if (event.type === 'agent.message') {
      for (const block of event.content) {
        if ('text' in block) {
          output += block.text
        }
      }
    }

    if (event.type === 'session.status_idle') {
      break
    }
  }

  return parseMatchDecision(output)
}

export async function runGovAgentPipeline(
  sessionId: string,
  broadcasts: ChannelBroadcast[],
  resources: GovernmentResource[],
  threshold = 70,
): Promise<GovAgentPipelineResult[]> {
  const results: GovAgentPipelineResult[] = []

  for (const broadcast of broadcasts) {
    for (const resource of resources) {
      console.log(`[Gov Agent] Evaluating: ${broadcast.displayName} x ${resource.name}`)

      const decision = await evaluateMatchWithClaude(sessionId, broadcast, resource)
      const assessment: MatchAssessment = { broadcast, resource, decision }

      console.log(`  -> eligible=${decision.eligible}, score=${decision.score}`)

      if (decision.eligible && decision.score >= threshold) {
        const { thread, initialMessage } = proposeMatchToolWrapper({ assessment })
        results.push({ assessment, thread, initialMessage })
        console.log(`  -> Thread created: ${thread.tid}`)
        console.log(`  -> Initial message created: ${initialMessage.mid}`)
      }
    }
  }

  return results
}
