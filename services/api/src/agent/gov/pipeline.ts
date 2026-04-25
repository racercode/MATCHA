import type { ChannelMessage, GovernmentResource } from '@matcha/shared-types'
import { client } from './managedAgent.js'
import {
  queryResourcePdfToolWrapper,
  readChannelToolWrapper,
  writeChannelReplyToolWrapper,
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
    case 'query_resource_pdf':
      return queryResourcePdfToolWrapper(input, context)
    case 'write_channel_reply': {
      const replyInput = input as { assessment: MatchAssessment }
      const resource = replyInput.assessment.resource
      if (resource.agencyId !== context.agencyId || resource.rid !== context.resourceId) {
        throw new Error('write_channel_reply resource does not match this resource agent context')
      }

      return writeChannelReplyToolWrapper(replyInput)
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
    if (!parsed.assessment || !parsed.reply) return null

    return {
      assessment: parsed.assessment,
      reply: parsed.reply,
    }
  } catch {
    return null
  }
}

export async function runGovAgentForChannelUpdate(
  sessionId: string,
  channelMessage: ChannelMessage,
  context: GovToolRuntimeContext & { resourceName?: string },
  threshold = 70,
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
                'Use query_resource_pdf to inspect the single government resource bound to this resource agent.',
                'Evaluate only this bound resource. Do not ask for or propose another resource.',
                'If this resource should not respond, final answer must be null.',
                `Only call write_channel_reply when eligible is true and score is at least ${threshold}.`,
                'If a match should be proposed, call write_channel_reply first, then final answer must be the write_channel_reply result JSON.',
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
  let channelReplyResult: GovAgentPipelineResult | null = null

  for await (const event of stream) {
    if (event.type === 'agent.custom_tool_use') {
      console.log(`  [tool] ${event.name} called`, JSON.stringify(event.input).slice(0, 200))
      try {
        const toolResult = await executeGovCustomTool(event.name, event.input, context)
        if (event.name === 'write_channel_reply') {
          const result = toolResult as Omit<GovAgentPipelineResult, 'assessment'>
          const assessment = (event.input as { assessment: MatchAssessment }).assessment
          channelReplyResult = {
            assessment,
            reply: result.reply,
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

  return channelReplyResult ?? parseGovAgentFinalResponse(output)
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
      const result = await runGovAgentForChannelUpdate(
        sessionId,
        message,
        {
          agencyId: resource.agencyId,
          resourceId: resource.rid,
          resourceName: resource.name,
        },
        threshold,
      )

      if (!result) {
        console.log('  -> No match proposed')
      } else if ((result.assessment.decision?.score ?? 0) < threshold) {
        console.log(`  -> Score too low: ${result.assessment.decision?.score ?? 'N/A'} (threshold: ${threshold})`)
      } else {
        results.push(result)
        console.log(`  -> Channel reply created: ${result.reply.replyId}`)
      }
    }
  }

  return results
}
