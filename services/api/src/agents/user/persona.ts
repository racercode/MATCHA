import { anthropic } from '../../lib/anthropic.js'
import { getSession, setSession, deleteSession } from '../../lib/session.js'
import { getAgentIds } from './setup.js'
import { executePersonaTool } from './tools.js'

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function getOrCreateSession(uid: string): Promise<string> {
  const existing = await getSession('persona', uid)
  if (existing) return existing

  const { envId, personaId } = getAgentIds()
  const session = await anthropic.beta.sessions.create({
    agent: personaId,
    environment_id: envId,
  })

  await setSession('persona', uid, session.id)
  return session.id
}

// ---------------------------------------------------------------------------
// Main invocation — called from ws/handler.ts for chat_message events
//
// Resource storage:
//   Within session container: agent writes /workspace/persona_draft.json
//   (persisted via checkpoint, survives 30 days of inactivity)
//   Durable storage: agent calls update_persona → Firestore via executePersonaTool
// ---------------------------------------------------------------------------

export async function invokePersonaAgent(
  uid: string,
  userMessage: string,
  onText: (chunk: string, done: boolean) => void,
): Promise<void> {
  const sessionId = await getOrCreateSession(uid)

  const stream = await anthropic.beta.sessions.events.stream(sessionId)

  await anthropic.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: userMessage }],
      },
    ],
  })

  // Track all events by ID so we can resolve custom tool calls
  const eventsById: Record<string, { name: string; input: Record<string, unknown> }> = {}

  for await (const event of stream) {
    switch (event.type) {
      case 'agent.message': {
        for (const block of event.content ?? []) {
          if (block.type === 'text') onText(block.text, false)
        }
        break
      }

      case 'agent.custom_tool_use': {
        eventsById[event.id] = { name: event.name, input: event.input as Record<string, unknown> }
        break
      }

      case 'session.status_idle': {
        const stopReason = (event as { stop_reason?: { type: string; event_ids?: string[] } }).stop_reason

        if (stopReason?.type === 'requires_action' && stopReason.event_ids) {
          // Execute each pending custom tool and return the result
          for (const eventId of stopReason.event_ids) {
            const toolCall = eventsById[eventId]
            if (!toolCall) continue

            let resultText: string
            try {
              const result = await executePersonaTool(toolCall.name, toolCall.input, uid)
              resultText = JSON.stringify(result)
            } catch (err) {
              resultText = JSON.stringify({ error: String(err) })
            }

            await anthropic.beta.sessions.events.send(sessionId, {
              events: [
                {
                  type: 'user.custom_tool_result',
                  custom_tool_use_id: eventId,
                  content: [{ type: 'text', text: resultText }],
                },
              ],
            })
          }
        } else if (stopReason?.type === 'end_turn') {
          onText('', true)
          return
        }
        break
      }

      case 'session.status_terminated': {
        // Container died — clear Redis session so next call creates a fresh one
        await deleteSession('persona', uid)
        onText('', true)
        throw new Error('Persona agent session terminated')
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Handle swipe results — inject into the active persona session
// ---------------------------------------------------------------------------

export async function injectSwipeResult(
  uid: string,
  cardId: string,
  direction: 'left' | 'right',
  value: string,
): Promise<void> {
  const sessionId = await getSession('persona', uid)
  if (!sessionId) return

  await anthropic.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [
          {
            type: 'text',
            text: `[swipe result] card=${cardId} direction=${direction} value=${value}`,
          },
        ],
      },
    ],
  })
}
