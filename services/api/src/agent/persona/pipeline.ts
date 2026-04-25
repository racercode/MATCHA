import { client } from './managedAgent.js'
import { broadcast } from '../../ws/push.js'
import type { ServerEvent } from '../../ws/push.js'
import type { SwipeCard } from '@matcha/shared-types'
import {
  getMyPersonaToolWrapper,
  updatePersonaToolWrapper,
  publishToChannelToolWrapper,
} from './toolWrappers/index.js'
import type { UpdatePersonaInput, PublishToChannelInput } from './types.js'

const SWIPE_CARD_RE = /%%SWIPE_CARD%%(\{.*?\})%%/gs

async function executePersonaCustomTool(
  name: string,
  input: Record<string, unknown>,
  uid: string,
): Promise<unknown> {
  switch (name) {
    case 'get_my_persona':
      return getMyPersonaToolWrapper(uid)

    case 'update_persona':
      return updatePersonaToolWrapper(uid, input as unknown as UpdatePersonaInput)

    case 'publish_to_channel':
      return publishToChannelToolWrapper(uid, input as unknown as PublishToChannelInput)

    default:
      throw new Error(`Unknown Persona Agent custom tool: ${name}`)
  }
}

export async function runPersonaAgentTurn(
  sessionId: string,
  uid: string,
  userMessage: string,
  emitter: (event: ServerEvent) => void,
): Promise<void> {
  const isCardRequest = userMessage.startsWith('generate_swipe_card')
  console.log(`[pipeline] turn uid=${uid} session=${sessionId} card=${isCardRequest} msg="${userMessage.slice(0, 60)}"`)

  const stream = await client.beta.sessions.events.stream(sessionId)

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: userMessage }],
      },
    ],
  })

  let cardsEmitted = 0

  for await (const event of stream) {
    console.log(`[pipeline] event type=${event.type}`)

    if (event.type === 'agent.custom_tool_use') {
      console.log(`  [persona tool] ${event.name}`, JSON.stringify(event.input).slice(0, 200))
      try {
        const result = await executePersonaCustomTool(
          event.name,
          event.input as Record<string, unknown>,
          uid,
        )
        await client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: 'user.custom_tool_result',
              custom_tool_use_id: event.id,
              content: [{ type: 'text', text: JSON.stringify(result) }],
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
        if ('text' in block && block.text) {
          let text = block.text
          console.log(`  [pipeline] agent text (${text.length} chars): "${text.slice(0, 120).replace(/\n/g, '\\n')}"`)
          const matches = [...text.matchAll(SWIPE_CARD_RE)]
          console.log(`  [pipeline] swipe_card markers found: ${matches.length}`)
          for (const match of matches) {
            try {
              const card = JSON.parse(match[1]) as Omit<SwipeCard, 'cardId'>
              const cardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              console.log(`  [pipeline] broadcasting card ${cardId}: "${card.question?.slice(0, 60)}"`)
              broadcast(uid, { type: 'swipe_card', card: { cardId, ...card } })
              cardsEmitted++
            } catch (e) {
              console.warn(`  [pipeline] failed to parse swipe_card JSON: ${match[1]?.slice(0, 100)}`, e)
            }
          }
          text = text.replace(SWIPE_CARD_RE, '').trim()
          if (text) {
            emitter({ type: 'agent_reply', content: text, done: false })
          }
        }
      }
    }

    if (event.type === 'session.status_idle') {
      const reason = (event as { stop_reason?: { type: string } }).stop_reason
      console.log(`[pipeline] session idle, stop_reason=${reason?.type ?? 'none'}`)
      if (reason?.type !== 'requires_action') {
        break
      }
    }
  }

  if (isCardRequest) {
    console.log(`[pipeline] card turn complete, emitted ${cardsEmitted} cards`)
  }

  emitter({ type: 'agent_reply', content: '', done: true })
}
