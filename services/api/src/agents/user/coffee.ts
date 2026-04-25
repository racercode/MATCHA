import { anthropic } from '../../lib/anthropic.js'
import { getSession, setSession, deleteSession } from '../../lib/session.js'
import { getAgentIds } from './setup.js'
import { executeCoffeeTool } from './tools.js'

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function getOrCreateSession(uid: string): Promise<string> {
  const existing = await getSession('coffee', uid)
  if (existing) return existing

  const { envId, coffeeId } = getAgentIds()
  const session = await anthropic.beta.sessions.create({
    agent: coffeeId,
    environment_id: envId,
  })

  await setSession('coffee', uid, session.id)
  return session.id
}

// ---------------------------------------------------------------------------
// Trigger a coffee match for a user whose persona was just published.
//
// Resource storage:
//   Agent writes /workspace/candidates.json (via built-in write tool)
//   for ranking before selecting the best match.
//   Durable storage: propose_peer_match creates Firestore thread + WS notification.
//
// Called fire-and-forget from publish_to_channel tool handler.
// ---------------------------------------------------------------------------

export async function triggerCoffeeMatch(
  uid: string,
  personaSummary: string,
  personaTags: string[],
): Promise<void> {
  const sessionId = await getOrCreateSession(uid)

  const prompt =
    `Find a coffee chat match for a citizen with the following persona:\n\n` +
    `Summary: ${personaSummary}\n` +
    `Tags: ${personaTags.join(', ')}\n\n` +
    `Search for suitable peers, write your candidate analysis to /workspace/candidates.json, then propose the best match.`

  const stream = await anthropic.beta.sessions.events.stream(sessionId)

  await anthropic.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  })

  const eventsById: Record<string, { name: string; input: Record<string, unknown> }> = {}

  for await (const event of stream) {
    switch (event.type) {
      case 'agent.custom_tool_use': {
        eventsById[event.id] = { name: event.name, input: event.input as Record<string, unknown> }
        break
      }

      case 'session.status_idle': {
        const stopReason = (event as { stop_reason?: { type: string; event_ids?: string[] } }).stop_reason

        if (stopReason?.type === 'requires_action' && stopReason.event_ids) {
          for (const eventId of stopReason.event_ids) {
            const toolCall = eventsById[eventId]
            if (!toolCall) continue

            let resultText: string
            try {
              const result = await executeCoffeeTool(toolCall.name, toolCall.input, uid)
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
          return
        }
        break
      }

      case 'session.status_terminated': {
        await deleteSession('coffee', uid)
        throw new Error('Coffee agent session terminated')
      }
    }
  }
}
