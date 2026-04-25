import { anthropic } from '../../lib/anthropic.js'
import { PERSONA_CUSTOM_TOOLS, COFFEE_CUSTOM_TOOLS } from './tools.js'

// ---------------------------------------------------------------------------
// IDs loaded from env — set once after running `npm run agents:init`
// ---------------------------------------------------------------------------

export function getAgentIds() {
  const envId = process.env.MANAGED_ENV_ID
  const personaId = process.env.PERSONA_AGENT_ID
  const coffeeId = process.env.COFFEE_AGENT_ID

  if (!envId || !personaId || !coffeeId) {
    throw new Error(
      'Missing managed agent env vars. Run: npx tsx src/agents/user/setup.ts --init',
    )
  }
  return { envId, personaId, coffeeId }
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const PERSONA_SYSTEM = `You are the Persona Agent for Matcha, a platform that connects citizens with government resources and peer support.

Your job is to learn about a citizen through friendly conversation and build their persona — a structured summary that will help match them with the right resources.

Guidelines:
- Start by warmly introducing yourself and asking one open question about their situation
- Use present_swipe_cards (2–4 cards) to efficiently gather preferences on housing, employment, healthcare, or family needs
- After collecting enough information (3–5 data points), write a persona draft to /workspace/persona_draft.json using your write tool
- Review the draft, then call update_persona to save it
- Finally call publish_to_channel to make the persona discoverable
- Keep conversation natural — you are helping citizens, not interrogating them
- If the user seems distressed or asks for a human, call request_human_review immediately

Always write your working draft to /workspace/persona_draft.json before calling update_persona.`

const COFFEE_SYSTEM = `You are the Coffee Agent for Matcha, responsible for connecting citizens with similar situations for peer support.

When you receive a user's persona, your job is to:
1. Call search_peers with relevant tags from their persona
2. Write the candidate list to /workspace/candidates.json using your write tool
3. Read the file back, evaluate each candidate's profile and shared tags
4. Select the single best match — someone who shares meaningful challenges and could offer genuine peer support
5. Call propose_peer_match with a warm, specific rationale for why these two citizens should connect

Be thoughtful — a good coffee match should share enough context to have a meaningful conversation, but also bring different experiences that could be mutually helpful.`

// ---------------------------------------------------------------------------
// One-time init — run once, copy printed IDs to .env
// ---------------------------------------------------------------------------

export async function initAgents() {
  console.log('[agents:init] Creating environment...')

  const env = await anthropic.beta.environments.create({
    name: 'matcha-api',
    config: {
      type: 'cloud',
      networking: { type: 'unrestricted' },
    },
  })

  console.log('[agents:init] Creating agents...')

  const [personaAgent, coffeeAgent] = await Promise.all([
    anthropic.beta.agents.create({
      name: 'Matcha Persona Agent',
      model: 'claude-haiku-4-5',
      system: PERSONA_SYSTEM,
      tools: [
        { type: 'agent_toolset_20260401' as const },
        ...PERSONA_CUSTOM_TOOLS,
      ],
      description: 'Builds citizen personas through conversation and swipe interactions',
    }),
    anthropic.beta.agents.create({
      name: 'Matcha Coffee Agent',
      model: 'claude-haiku-4-5',
      system: COFFEE_SYSTEM,
      tools: [
        { type: 'agent_toolset_20260401' as const },
        ...COFFEE_CUSTOM_TOOLS,
      ],
      description: 'Finds peer coffee chat matches for citizens based on persona similarity',
    }),
  ])

  console.log('\nPaste into services/api/.env:\n')
  console.log(`MANAGED_ENV_ID=${env.id}`)
  console.log(`PERSONA_AGENT_ID=${personaAgent.id}`)
  console.log(`COFFEE_AGENT_ID=${coffeeAgent.id}`)
}

// Run as script: npx tsx src/agents/user/setup.ts --init
if (process.argv.includes('--init')) {
  initAgents().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
