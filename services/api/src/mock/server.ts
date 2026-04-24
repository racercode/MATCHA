/**
 * Mock server for Group A (mobile) and Group B (web) to develop against
 * before the real backend is ready.
 *
 * Run:  pnpm mock
 * Port: 3001
 *
 * All responses match the @matcha/shared-types interfaces exactly.
 * Replace with real endpoints as Group C completes them.
 */

import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fastifyCors from '@fastify/cors'
import {
  MOCK_PERSONA,
  MOCK_RESOURCE,
  MOCK_THREAD,
  MOCK_PEER_PREVIEW,
  type ServerEvent,
  type AgentThread,
  type ThreadMessage,
} from '@matcha/shared-types'

const app = Fastify({ logger: true })

await app.register(fastifyCors, { origin: '*' })
await app.register(fastifyWebsocket)

// ---------------------------------------------------------------------------
// REST — Citizen (Group A)
// ---------------------------------------------------------------------------

app.get('/me/persona', async () => ({
  success: true,
  data: MOCK_PERSONA,
}))

app.post('/me/chat', async (req, reply) => {
  // Simulate SSE streaming agent reply
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')

  const chunks = ['思考中', '...', ' 我來幫你', '建立你的', ' persona！', ' 請問你目前', '最需要哪方面的協助？']
  for (const chunk of chunks) {
    const event: ServerEvent = { type: 'agent_reply', content: chunk, done: false }
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    await new Promise(r => setTimeout(r, 120))
  }
  const done: ServerEvent = { type: 'agent_reply', content: '', done: true }
  reply.raw.write(`data: ${JSON.stringify(done)}\n\n`)
  reply.raw.end()
})

app.post('/me/swipe', async () => ({
  success: true,
  data: {
    cardId: 'card-002',
    question: '你是否有穩定的住所？',
    leftLabel: '沒有',
    rightLabel: '有',
    leftValue: 'no_stable_housing',
    rightValue: 'has_stable_housing',
  },
}))

// ---------------------------------------------------------------------------
// REST — Threads (both sides)
// ---------------------------------------------------------------------------

const mockThreads: AgentThread[] = [MOCK_THREAD]

app.get('/threads', async () => ({
  success: true,
  data: { items: mockThreads, total: mockThreads.length, hasMore: false },
}))

app.get<{ Params: { tid: string } }>('/threads/:tid', async (req) => ({
  success: true,
  data: mockThreads.find(t => t.tid === req.params.tid) ?? MOCK_THREAD,
}))

app.post<{ Params: { tid: string } }>('/threads/:tid/join', async (req) => {
  const thread = mockThreads.find(t => t.tid === req.params.tid)
  if (thread) thread.userPresence = 'human'
  return { success: true, data: thread ?? MOCK_THREAD }
})

app.post<{ Params: { tid: string } }>('/threads/:tid/leave', async (req) => {
  const thread = mockThreads.find(t => t.tid === req.params.tid)
  if (thread) thread.userPresence = 'agent'
  return { success: true, data: thread ?? MOCK_THREAD }
})

app.get<{ Params: { tid: string } }>('/threads/:tid/messages', async () => {
  const msgs: ThreadMessage[] = [
    {
      mid: 'msg-001',
      tid: MOCK_THREAD.tid,
      from: `gov_agent:${MOCK_RESOURCE.rid}`,
      type: 'query',
      content: { text: '根據你的 persona，我認為你符合青年就業促進計畫的資格，請問你目前是否正在求職中？' },
      createdAt: Date.now() - 30_000,
    },
    {
      mid: 'msg-002',
      tid: MOCK_THREAD.tid,
      from: `persona_agent:${MOCK_PERSONA.uid}`,
      type: 'answer',
      content: { text: '是的，我目前正在積極求職，特別是軟體開發相關職位。' },
      createdAt: Date.now() - 20_000,
    },
  ]
  return { success: true, data: { items: msgs, total: msgs.length, hasMore: false } }
})

// ---------------------------------------------------------------------------
// REST — Gov (Group B)
// ---------------------------------------------------------------------------

app.get('/gov/resources', async () => ({
  success: true,
  data: { items: [MOCK_RESOURCE], total: 1, hasMore: false },
}))

app.get('/gov/threads', async () => ({
  success: true,
  data: { items: mockThreads, total: mockThreads.length, hasMore: false },
}))

app.get('/gov/dashboard', async () => ({
  success: true,
  data: {
    totalMatches: 12,
    humanTakeoverCount: 3,
    activeThreads: 5,
    matchedToday: 4,
    tagDistribution: { 就業: 8, 青年: 6, 補助: 4, 住宅: 2 },
    needsDistribution: { 就業輔導: 7, 職業培訓: 5, 法律協助: 2 },
  },
}))

// ---------------------------------------------------------------------------
// WebSocket — real-time events
// ---------------------------------------------------------------------------

app.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket) => {
    app.log.info('WS client connected')

    // Simulate a gov match notification after 5 seconds
    setTimeout(() => {
      const event: ServerEvent = {
        type: 'match_notify',
        thread: MOCK_THREAD,
        resource: MOCK_RESOURCE,
      }
      socket.send(JSON.stringify(event))
    }, 5_000)

    // Simulate a coffee chat peer notification after 10 seconds
    setTimeout(() => {
      const peerThread: AgentThread = {
        ...MOCK_THREAD,
        tid: 'mock-tid-002',
        type: 'user_user',
        initiatorId: `user:${MOCK_PEER_PREVIEW.uid}`,
        responderId: `user:${MOCK_PERSONA.uid}`,
        govPresence: 'agent',
        peerPresence: 'agent',
      }
      const event: ServerEvent = {
        type: 'peer_notify',
        thread: peerThread,
        peer: MOCK_PEER_PREVIEW,
      }
      socket.send(JSON.stringify(event))
    }, 10_000)

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        app.log.info({ msg }, 'WS message received')

        if (msg.type === 'chat_message') {
          const reply: ServerEvent = { type: 'agent_reply', content: '（mock）收到你的訊息，正在思考中...', done: true }
          socket.send(JSON.stringify(reply))
        }
      } catch {
        // ignore malformed messages
      }
    })

    socket.on('close', () => app.log.info('WS client disconnected'))
  })
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

await app.listen({ port: 3001, host: '0.0.0.0' })
