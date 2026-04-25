import { toMs, type ChannelMessage, type GovernmentResource } from '@matcha/shared-types'
import { client } from './managedAgent.js'
import {
  buildChannelReplyFromAssessment,
  queryResourcePdfToolWrapper,
  writeChannelReplyToolWrapper,
} from './toolWrappers/index.js'
import type { GovToolRuntimeContext } from './toolWrappers/index.js'
import { hasFirebaseAdminEnv } from '../../lib/firebaseEnv.js'
import { recordMatchAttempt } from '../../lib/matchStatsRepo.js'
import { channelReplies, humanThreads } from '../../lib/store.js'
import type { MatchDecision, MatchAssessment, GovAgentPipelineResult, FollowUpResult } from './types.js'

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
    case 'query_resource_document':
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

function extractDecisionText(rawText: string): string {
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try { JSON.parse(cleaned); return cleaned } catch { /* not pure JSON */ }
  const lastBrace = cleaned.lastIndexOf('}')
  if (lastBrace !== -1) {
    let depth = 0
    for (let i = lastBrace; i >= 0; i--) {
      if (cleaned[i] === '}') depth++
      else if (cleaned[i] === '{') { depth--; if (depth === 0) return cleaned.slice(i, lastBrace + 1) }
    }
  }
  if (/\bnull\s*$/.test(cleaned)) return 'null'
  return cleaned
}

function parseGovAgentFinalResponse(
  rawText: string,
  assessmentBase: Pick<MatchAssessment, 'channelMessage' | 'resource'>,
): GovAgentPipelineResult | null {
  const cleaned = extractDecisionText(rawText)
  if (!cleaned || cleaned === 'null') return null

  try {
    const parsed = JSON.parse(cleaned) as Partial<GovAgentPipelineResult> & MatchDecision & { respond?: boolean; decision?: MatchDecision }
    if (parsed.respond === false) return null
    if (parsed.assessment && parsed.reply) {
      return {
        assessment: parsed.assessment,
        reply: parsed.reply,
      }
    }

    const decision = parsed.decision ?? parsed
    if (typeof decision.eligible !== 'boolean') return null
    if (!Number.isInteger(decision.score) || decision.score < 0 || decision.score > 100) return null
    if (typeof decision.reason !== 'string') return null
    if (!Array.isArray(decision.missingInfo)) return null

    const assessment: MatchAssessment = {
      ...assessmentBase,
      decision,
    }

    return {
      assessment,
      reply: buildChannelReplyFromAssessment(assessment),
    }
  } catch {
    return null
  }
}

async function persistChannelReply(result: GovAgentPipelineResult): Promise<void> {
  if (hasFirebaseAdminEnv()) {
    const { upsertChannelReply } = await import('../../lib/channelRepliesRepo.js')
    await upsertChannelReply(result.reply)
  } else {
    channelReplies.set(result.reply.replyId, {
      ...result.reply,
      createdAt: toMs(result.reply.createdAt),
    })
  }
}

async function persistHumanThread(result: GovAgentPipelineResult): Promise<void> {
  const tid = `thread-${result.reply.replyId}`
  const userId = result.assessment.channelMessage.uid

  if (hasFirebaseAdminEnv()) {
    const { createHumanThread } = await import('../../lib/humanThreadsRepo.js')
    await createHumanThread({
      tid,
      userId,
      govId: result.reply.govId,
      channelReplyId: result.reply.replyId,
      matchScore: result.reply.matchScore,
    })
  } else {
    const now = Date.now()
    humanThreads.set(tid, {
      tid,
      type: 'gov_user',
      userId,
      govId: result.reply.govId,
      channelReplyId: result.reply.replyId,
      matchScore: result.reply.matchScore,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function runGovAgentForChannelUpdate(
  sessionId: string,
  channelMessage: ChannelMessage,
  context: GovToolRuntimeContext & { resource?: GovernmentResource; resourceName?: string },
  threshold = 30,
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
                'Use query_resource_document to inspect the single government resource and document text bound to this resource agent.',
                'Evaluate only this bound resource. Do not ask for or propose another resource.',
                '永遠回傳 MatchDecision JSON，不要回傳 null。即使完全無關也回傳 score 0 並說明原因。',
                '採取寬鬆媒合策略：只要資源的主題與使用者需求相關，即使部分 eligibilityCriteria 可能不符合，仍應給予合理分數。',
                '將使用者可能不符合的資格條件列入 missingInfo，並在 reason 中提醒使用者注意。',
                'Do not write data or call write_channel_reply. The backend pipeline will create and persist ChannelReply after receiving your decision.',
                'Final answer must be a JSON MatchDecision: {"eligible":true/false,"score":0-100,"reason":"推薦理由或不相關原因","missingInfo":["未符合條件1"]}.',
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

  return channelReplyResult ?? parseGovAgentFinalResponse(output, {
    channelMessage,
    resource: context.resource ?? {
      rid: context.resourceId,
      agencyId: context.agencyId,
      agencyName: context.agencyId,
      name: context.resourceName ?? context.resourceId,
      description: '',
      eligibilityCriteria: [],
      createdAt: channelMessage.publishedAt,
    },
  })
}

export async function runGovAgentPipeline(
  resourceAgents: Array<{ sessionId: string; resource: GovernmentResource }>,
  messages: ChannelMessage[],
  threshold = 30,
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
          resource,
          resourceName: resource.name,
        },
        threshold,
      )

      const matched = Boolean(result && (result.assessment.decision?.score ?? 0) >= threshold)

      if (hasFirebaseAdminEnv()) {
        try {
          await recordMatchAttempt(resource.rid, matched, {
            agencyId: resource.agencyId,
            resourceName: resource.name,
          })
        } catch (err) {
          console.error(`  [match_stats] Failed to record: ${err instanceof Error ? err.message : err}`)
        }
      }

      if (!result) {
        console.log('  -> No match proposed')
      } else if (!matched) {
        console.log(`  -> Score too low: ${result.assessment.decision?.score ?? 'N/A'} (threshold: ${threshold})`)
      } else {
        await persistChannelReply(result)
        await persistHumanThread(result)
        results.push(result)
        console.log(`  -> Channel reply and human thread persisted: ${result.reply.replyId}`)
      }
    }
  }

  return results
}

export async function runGovFollowUpQuestion(
  sessionId: string,
  context: GovToolRuntimeContext,
  payload: {
    question: string
    replyId: string
    resourceId: string
    notificationContent?: string
    personaSummary?: string
  },
): Promise<FollowUpResult> {
  const stream = await client.beta.sessions.events.stream(sessionId)

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task: 'followup_question',
              resourceId: payload.resourceId,
              replyId: payload.replyId,
              notificationContent: payload.notificationContent,
              personaSummary: payload.personaSummary,
              question: payload.question,
            }),
          },
        ],
      },
    ],
  })

  let output = ''

  for await (const event of stream) {
    if (event.type === 'agent.custom_tool_use') {
      console.log(`  [followup tool] ${event.name} called`)
      try {
        const toolResult = await executeGovCustomTool(event.name, event.input, context)
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

  console.log(`[Gov FollowUp] Answer: ${output.slice(0, 200)}`)

  return {
    answer: output.trim(),
    resourceId: payload.resourceId,
    replyId: payload.replyId,
  }
}
