import { client, initCoffeeManagedAgentSession } from './managedAgent.js'
import {
  readRecentPersonasToolWrapper,
  proposePeerMatchToolWrapper,
  relayMessageToolWrapper,
} from './toolWrappers/index.js'
import type { ReadRecentPersonasInput, ProposePeerMatchInput, RelayMessageInput } from './types.js'
import { db } from '../../lib/firebase.js'

async function executeCoffeeCustomTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'read_recent_personas':
      return readRecentPersonasToolWrapper(input as ReadRecentPersonasInput)

    case 'propose_peer_match':
      return proposePeerMatchToolWrapper(input as unknown as ProposePeerMatchInput)

    case 'relay_message':
      return relayMessageToolWrapper(input as unknown as RelayMessageInput)

    default:
      throw new Error(`Unknown Coffee Agent custom tool: ${name}`)
  }
}

async function runCoffeeSession(sessionId: string, prompt: string): Promise<void> {
  const stream = await client.beta.sessions.events.stream(sessionId)

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  })

  for await (const event of stream) {
    if (event.type === 'agent.custom_tool_use') {
      console.log(`  [coffee tool] ${event.name}`, JSON.stringify(event.input).slice(0, 200))
      try {
        const result = await executeCoffeeCustomTool(event.name, event.input as Record<string, unknown>)
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

    if (event.type === 'session.status_idle') {
      const reason = (event as { stop_reason?: { type: string } }).stop_reason
      if (reason?.type !== 'requires_action') {
        break
      }
    }
  }
}

export async function triggerCoffeeMatch(msgId: string): Promise<void> {
  const doc = await db.collection('channel_messages').doc(msgId).get()
  if (!doc.exists) {
    console.warn(`[Coffee Agent] Channel message ${msgId} not found`)
    return
  }
  const msg = doc.data()!

  console.log(`[Coffee Agent] Triggered by channel message: ${msgId}`)
  try {
    const sessionId = await initCoffeeManagedAgentSession()
    const prompt = JSON.stringify({
      task: 'channel_updated',
      instructions: [
        'A new channel message was published by a user.',
        'Use read_recent_personas to see current users.',
        'Evaluate if any two users have complementary needs and offers.',
        'If a good match exists, call propose_peer_match with a warm introduction message.',
        'Propose at most 1–2 matches. If no clear match exists, respond with null.',
      ],
      channelMessage: {
        msgId,
        uid: msg.uid as string,
        summary: msg.summary as string,
      },
    })
    await runCoffeeSession(sessionId, prompt)
    console.log(`[Coffee Agent] Match evaluation complete for ${msgId}`)
  } catch (err) {
    console.error('[Coffee Agent] triggerCoffeeMatch error:', err)
  }
}
