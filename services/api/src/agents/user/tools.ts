import type { SwipeCard } from '@matcha/shared-types'

// ---------------------------------------------------------------------------
// Custom tool JSON schemas (used in setup.ts)
// ---------------------------------------------------------------------------

export const PERSONA_CUSTOM_TOOLS = [
  {
    type: 'custom' as const,
    name: 'get_my_persona',
    description:
      "Read the current user's persona from the database. Returns the stored summary and tags, or null if no persona exists yet. Call this at the start of a resumed session to recall what you already know about the user.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    type: 'custom' as const,
    name: 'update_persona',
    description:
      "Persist the user's persona to the database. Call this when you have gathered enough information (at least 2-3 quality data points) to write a meaningful summary. The summary should be 2-4 natural language sentences. Tags should be concrete, searchable keywords (3-8 tags). Write the draft to /workspace/persona_draft.json first, then call this when confident.",
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Natural language persona summary, 2-4 sentences' },
        tags: { type: 'array', items: { type: 'string' }, description: '3-8 concrete searchable tags' },
      },
      required: ['summary', 'tags'],
    },
  },
  {
    type: 'custom' as const,
    name: 'publish_to_channel',
    description:
      "Broadcast the user's current persona to the matching channel so government agents and coffee agents can discover them. Call this after successfully calling update_persona.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    type: 'custom' as const,
    name: 'present_swipe_cards',
    description:
      'Present the user with swipe cards to quickly gather structured preferences. Each card shows a binary choice. Results come back as swipe events. Use this to collect 2-4 cards on key topics (housing, employment, healthcare, family situation) before writing the persona.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              cardId: { type: 'string' },
              question: { type: 'string' },
              leftLabel: { type: 'string' },
              rightLabel: { type: 'string' },
              leftValue: { type: 'string' },
              rightValue: { type: 'string' },
            },
            required: ['cardId', 'question', 'leftLabel', 'rightLabel', 'leftValue', 'rightValue'],
          },
        },
      },
      required: ['cards'],
    },
  },
  {
    type: 'custom' as const,
    name: 'request_human_review',
    description:
      'Flag this conversation for human customer service review. Use when the user is distressed, expresses urgency, or explicitly asks to speak with a person.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Why human review is needed' },
      },
      required: ['reason'],
    },
  },
]

export const COFFEE_CUSTOM_TOOLS = [
  {
    type: 'custom' as const,
    name: 'search_peers',
    description:
      'Search the database for citizens with similar tags to the current user. Returns up to `limit` candidates with their UID, persona summary, and shared tags. The current user is automatically excluded.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to match against' },
        limit: { type: 'number', description: 'Max candidates to return (default 10, max 20)' },
      },
      required: ['tags'],
    },
  },
  {
    type: 'custom' as const,
    name: 'propose_peer_match',
    description:
      'Create a peer coffee chat thread between the current user and the selected candidate. Include a clear match_rationale and a 0-100 match_score. Sends a notification to both users. Only call this once per session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        peer_uid: { type: 'string', description: 'UID of the peer to match with' },
        match_rationale: { type: 'string', description: 'Why this match is beneficial, 1-2 sentences' },
        match_score: { type: 'number', description: '0-100 subjective compatibility score' },
      },
      required: ['peer_uid', 'match_rationale', 'match_score'],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool handlers — executed server-side when agent calls a custom tool
// ---------------------------------------------------------------------------

export async function executePersonaTool(
  name: string,
  input: Record<string, unknown>,
  uid: string,
): Promise<unknown> {
  switch (name) {
    case 'get_my_persona': {
      // TODO: return await getDoc('personas', uid)
      return null
    }

    case 'update_persona': {
      const { summary, tags } = input as { summary: string; tags: string[] }
      // TODO: await setDoc('personas', uid, { uid, summary, tags, updatedAt: Timestamp.now() })
      console.log(`[tool] update_persona for ${uid}:`, { summary, tags })
      return { success: true }
    }

    case 'publish_to_channel': {
      // TODO:
      //   const persona = await getDoc('personas', uid)
      //   await rtdb.ref(`/channel/${uid}`).set({ uid, summary: persona.summary, tags: persona.tags, publishedAt: Date.now() })
      //   triggerCoffeeMatch(uid, persona.summary, persona.tags)
      console.log(`[tool] publish_to_channel for ${uid}`)
      return { publishedAt: Date.now() }
    }

    case 'present_swipe_cards': {
      // Swipe is client-side UI state; return the cards as data for the agent reply to reference
      const { cards } = input as { cards: SwipeCard[] }
      return { queued: cards.length, cards }
    }

    case 'request_human_review': {
      const { reason } = input as { reason: string }
      // TODO: await setDoc('support_flags', uid, { uid, reason, createdAt: Timestamp.now() })
      console.log(`[tool] request_human_review for ${uid}: ${reason}`)
      return { flagged: true }
    }

    default:
      throw new Error(`Unknown persona tool: ${name}`)
  }
}

export async function executeCoffeeTool(
  name: string,
  input: Record<string, unknown>,
  uid: string,
): Promise<unknown> {
  switch (name) {
    case 'search_peers': {
      const { tags, limit = 10 } = input as { tags: string[]; limit?: number }
      // TODO:
      //   const snap = await firestore.collection('personas')
      //     .where('tags', 'array-contains-any', tags)
      //     .where('uid', '!=', uid)
      //     .limit(Math.min(limit, 20))
      //     .get()
      //   return snap.docs.map(d => d.data())
      console.log(`[tool] search_peers for ${uid} with tags:`, tags, `limit: ${limit}`)
      return []
    }

    case 'propose_peer_match': {
      const { peer_uid, match_rationale, match_score } = input as {
        peer_uid: string
        match_rationale: string
        match_score: number
      }
      // TODO:
      //   const thread = await createThread({ type: 'user_user', initiatorId: `user:${uid}`, responderId: `user:${peer_uid}`, matchScore: match_score })
      //   broadcast(uid, { type: 'match_notify', thread })
      //   broadcast(peer_uid, { type: 'match_notify', thread })
      console.log(`[tool] propose_peer_match ${uid} <-> ${peer_uid} (score: ${match_score}): ${match_rationale}`)
      return { success: true, threadId: `thread-${Date.now()}` }
    }

    default:
      throw new Error(`Unknown coffee tool: ${name}`)
  }
}
