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

async function runCoffeeSession(sessionId: string, prompt: string): Promise<{ toolCalls: string[]; matches: string[] }> {
  const stream = await client.beta.sessions.events.stream(sessionId)
  const toolCalls: string[] = []
  const matches: string[] = []
  let agentText = ''

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  })

  for await (const event of stream) {
    if (event.type === 'agent.text') {
      const chunk = (event as { text?: string }).text ?? ''
      agentText += chunk
    }

    if (event.type === 'agent.custom_tool_use') {
      const inputStr = JSON.stringify(event.input)
      toolCalls.push(event.name)
      console.log(`[Coffee Agent]   → tool: ${event.name} | input: ${inputStr.slice(0, 300)}`)
      try {
        const result = await executeCoffeeCustomTool(event.name, event.input as Record<string, unknown>)
        const resultStr = JSON.stringify(result)
        console.log(`[Coffee Agent]   ← result: ${resultStr.slice(0, 300)}`)

        if (event.name === 'propose_peer_match') {
          const r = result as { threadId?: string; created?: boolean }
          if (r.threadId) matches.push(r.threadId)
        }

        await client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: 'user.custom_tool_result',
              custom_tool_use_id: event.id,
              content: [{ type: 'text', text: resultStr }],
            },
          ],
        })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error(`[Coffee Agent]   ← tool error (${event.name}): ${errMsg}`)
        await client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: 'user.custom_tool_result',
              custom_tool_use_id: event.id,
              is_error: true,
              content: [{ type: 'text', text: errMsg }],
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

  if (agentText.trim()) {
    console.log(`[Coffee Agent]   agent says: "${agentText.trim().slice(0, 300)}"`)
  }

  return { toolCalls, matches }
}

export async function triggerCoffeeMatch(msgId: string): Promise<void> {
  const doc = await db.collection('channel_messages').doc(msgId).get()
  if (!doc.exists) {
    console.warn(`[Coffee Agent] Channel message ${msgId} not found`)
    return
  }
  const msg = doc.data()!
  const t0 = Date.now()

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[Coffee Agent] ▶ Triggered by channel message: ${msgId}`)
  console.log(`[Coffee Agent]   uid: ${msg.uid}  summary: "${(msg.summary as string)?.slice(0, 80)}"`)

  try {
    const sessionId = await initCoffeeManagedAgentSession()
    console.log(`[Coffee Agent]   session: ${sessionId}`)

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

    const { toolCalls, matches } = await runCoffeeSession(sessionId, prompt)
    const elapsed = Date.now() - t0

    if (matches.length > 0) {
      console.log(`[Coffee Agent] ✅ ${matches.length} match(es) created: ${matches.join(', ')} (${elapsed}ms)`)
    } else {
      console.log(`[Coffee Agent] ℹ no match proposed. tools called: [${toolCalls.join(', ')}] (${elapsed}ms)`)
    }
    console.log(`${'─'.repeat(60)}\n`)
  } catch (err) {
    console.error(`[Coffee Agent] ❌ triggerCoffeeMatch error (${Date.now() - t0}ms):`, err)
    console.log(`${'─'.repeat(60)}\n`)
  }
}
