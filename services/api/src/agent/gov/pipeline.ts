import type { ChannelMessage, GovernmentResource } from '@matcha/shared-types'
import { client } from './managedAgent.js'
import {
  proposeMatchToolWrapper,
  queryProgramDocsToolWrapper,
  readChannelToolWrapper,
} from './toolWrappers/index.js'
import type { GovToolRuntimeContext } from './toolWrappers/index.js'
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

async function executeGovCustomTool(
  name: string,
  input: Record<string, unknown>,
  context: GovToolRuntimeContext,
) {
  switch (name) {
    case 'read_channel':
      return readChannelToolWrapper(input)
    case 'query_program_docs':
      return queryProgramDocsToolWrapper(input, context)
    case 'propose_match': {
      const proposeInput = input as { assessment: MatchAssessment }
      const resource = proposeInput.assessment.resource
      if (resource.agencyId !== context.agencyId || resource.rid !== context.resourceId) {
        throw new Error('propose_match resource does not match this resource agent context')
      }

      return proposeMatchToolWrapper(proposeInput)
    }
    default:
      throw new Error(`Unknown Gov Agent custom tool: ${name}`)
  }
}

function parseGovAgentFinalResponse(rawText: string): GovAgentPipelineResult | null {
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  if (!cleaned || cleaned === 'null') return null

  try {
    const parsed = JSON.parse(cleaned) as Partial<GovAgentPipelineResult> & { respond?: boolean }
    if (parsed.respond === false) return null
    if (!parsed.assessment || !parsed.thread || !parsed.initialMessage) return null

    return {
      assessment: parsed.assessment,
      thread: parsed.thread,
      initialMessage: parsed.initialMessage,
    }
  } catch {
    return null
  }
}

export async function runGovAgentForChannelUpdate(
  sessionId: string,
  channelMessage: ChannelMessage,
  context: GovToolRuntimeContext & { resourceName?: string },
): Promise<GovAgentPipelineResult | null> {
  const stream = await client.beta.sessions.events.stream(sessionId)

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task: 'channel_updated',
              instructions: [
                'A new ChannelMessage was published.',
                'Use read_channel if you need recent channel context.',
                'Use query_program_docs to inspect the single government resource bound to this resource agent.',
                'Evaluate only this bound resource. Do not ask for or propose another resource.',
                'If this resource should not respond, final answer must be null.',
                'If a match should be proposed, call propose_match first, then final answer must be the propose_match result JSON.',
              ],
              agencyId: context.agencyId,
              resourceId: context.resourceId,
              resourceName: context.resourceName,
              channelMessage,
            }),
          },
        ],
      },
    ],
  })

  let output = ''
  let proposedMatch: GovAgentPipelineResult | null = null

  for await (const event of stream) {
    if (event.type === 'agent.custom_tool_use') {
      console.log(`  [tool] ${event.name} called`, JSON.stringify(event.input).slice(0, 200))
      try {
        const toolResult = await executeGovCustomTool(event.name, event.input, context)
        if (event.name === 'propose_match') {
          const result = toolResult as Omit<GovAgentPipelineResult, 'assessment'> & { thread: GovAgentPipelineResult['thread'] }
          const assessment = (event.input as { assessment: MatchAssessment }).assessment
          proposedMatch = {
            assessment,
            thread: result.thread,
            initialMessage: result.initialMessage,
          }
        }

        await client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: 'user.custom_tool_result',
              custom_tool_use_id: event.id,
              content: [{ type: 'text', text: JSON.stringify(toolResult) }],
            },
          ],
        })
      } catch (error) {
        await client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: 'user.custom_tool_result',
              custom_tool_use_id: event.id,
              is_error: true,
              content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
            },
          ],
        })
      }
    }

    if (event.type === 'agent.message') {
      for (const block of event.content) {
        if ('text' in block) {
          output += block.text
        }
      }
    }

    if (event.type === 'session.status_idle') {
      const reason = (event as { stop_reason?: { type: string } }).stop_reason
      if (reason?.type !== 'requires_action') {
        break
      }
    }
  }

  if (output) {
    console.log(`  [agent output] ${output.slice(0, 300)}`)
  }

  return proposedMatch ?? parseGovAgentFinalResponse(output)
}

export async function runGovAgentPipeline(
  resourceAgents: Array<{ sessionId: string; resource: GovernmentResource }>,
  messages: ChannelMessage[],
  threshold = 70,
): Promise<GovAgentPipelineResult[]> {
  const results: GovAgentPipelineResult[] = []

  for (const message of messages) {
    console.log(`[Gov Agent] Channel update: ${message.uid} (${message.msgId})`)

    for (const { sessionId, resource } of resourceAgents) {
      console.log(`  [Resource Agent] ${resource.name} (${resource.rid})`)
      const result = await runGovAgentForChannelUpdate(sessionId, message, {
        agencyId: resource.agencyId,
        resourceId: resource.rid,
        resourceName: resource.name,
      })

      if (!result) {
        console.log('  -> No match proposed')
      } else if ((result.assessment.decision?.score ?? 0) < threshold) {
        console.log(`  -> Score too low: ${result.assessment.decision?.score ?? 'N/A'} (threshold: ${threshold})`)
      } else {
        results.push(result)
        console.log(`  -> Thread created: ${result.thread.tid}`)
        console.log(`  -> Initial message created: ${result.initialMessage.mid}`)
      }
    }
  }

  return results
}
