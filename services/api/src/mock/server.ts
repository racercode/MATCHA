/**
 * Mock server for Group A (mobile) and Group B (web) to develop against
 * before the real backend is ready.
 *
 * Run standalone:  pnpm mock          (port 3001)
 * Run with real:   pnpm dev:mock      (real on 3000, mock on 3001)
 *
 * All responses match the @matcha/shared-types interfaces exactly.
 */

import http from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import {
  MOCK_PERSONA,
  MOCK_RESOURCE,
  MOCK_THREAD,
  MOCK_PEER_PREVIEW,
  type ServerEvent,
  type AgentThread,
  type ThreadMessage,
} from '@matcha/shared-types'

export function createMockApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  const mockThreads: AgentThread[] = [{ ...MOCK_THREAD }]

  // -------------------------------------------------------------------------
  // REST — Citizen
  // -------------------------------------------------------------------------

  app.get('/me/persona', (_req, res) => {
    res.json({ success: true, data: MOCK_PERSONA })
  })

  app.post('/me/chat', async (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const chunks = ['思考中', '...', ' 我來幫你', '建立你的', ' persona！', ' 請問你目前', '最需要哪方面的協助？']
    for (const chunk of chunks) {
      const event: ServerEvent = { type: 'agent_reply', content: chunk, done: false }
      res.write(`data: ${JSON.stringify(event)}\n\n`)
      await sleep(120)
    }
    const done: ServerEvent = { type: 'agent_reply', content: '', done: true }
    res.write(`data: ${JSON.stringify(done)}\n\n`)
    res.end()
  })

  app.post('/me/swipe', (_req, res) => {
    res.json({
      success: true,
      data: {
        cardId: 'card-002',
        question: '你是否有穩定的住所？',
        leftLabel: '沒有',
        rightLabel: '有',
        leftValue: 'no_stable_housing',
        rightValue: 'has_stable_housing',
      },
    })
  })

  // -------------------------------------------------------------------------
  // REST — Threads
  // -------------------------------------------------------------------------

  app.get('/threads', (_req, res) => {
    res.json({ success: true, data: { items: mockThreads, total: mockThreads.length, hasMore: false } })
  })

  app.get('/threads/:tid', (req, res) => {
    const thread = mockThreads.find(t => t.tid === req.params.tid) ?? MOCK_THREAD
    res.json({ success: true, data: thread })
  })

  app.get('/threads/:tid/messages', (req, res) => {
    const msgs: ThreadMessage[] = [
      {
        mid: 'msg-001',
        tid: req.params.tid,
        from: `gov_agent:${MOCK_RESOURCE.rid}`,
        type: 'query',
        content: { text: '根據你的 persona，我認為你符合青年就業促進計畫的資格，請問你目前是否正在求職中？' },
        createdAt: Date.now() - 30_000,
      },
      {
        mid: 'msg-002',
        tid: req.params.tid,
        from: `persona_agent:${MOCK_PERSONA.uid}`,
        type: 'answer',
        content: { text: '是的，我目前正在積極求職，特別是軟體開發相關職位。' },
        createdAt: Date.now() - 20_000,
      },
    ]
    res.json({ success: true, data: { items: msgs, total: msgs.length, hasMore: false } })
  })

  app.post('/threads/:tid/message', (req, res) => {
    const msg: ThreadMessage = {
      mid: `msg-${Date.now()}`,
      tid: req.params.tid,
      from: `human:${MOCK_PERSONA.uid}`,
      type: 'human_note',
      content: { text: req.body?.content ?? '' },
      createdAt: Date.now(),
    }
    res.json({ success: true, data: msg })
  })

  app.post('/threads/:tid/join', (req, res) => {
    const thread = mockThreads.find(t => t.tid === req.params.tid)
    if (thread) thread.userPresence = 'human'
    res.json({ success: true, data: thread ?? MOCK_THREAD })
  })

  app.post('/threads/:tid/leave', (req, res) => {
    const thread = mockThreads.find(t => t.tid === req.params.tid)
    if (thread) thread.userPresence = 'agent'
    res.json({ success: true, data: thread ?? MOCK_THREAD })
  })

  // -------------------------------------------------------------------------
  // REST — Gov
  // -------------------------------------------------------------------------

  app.get('/gov/resources', (_req, res) => {
    res.json({ success: true, data: { items: [MOCK_RESOURCE], total: 1, hasMore: false } })
  })

  app.post('/gov/resources', (req, res) => {
    const resource = { ...MOCK_RESOURCE, rid: `rid-${Date.now()}`, ...req.body, createdAt: Date.now() }
    res.status(201).json({ success: true, data: resource })
  })

  app.get('/gov/threads', (_req, res) => {
    res.json({ success: true, data: { items: mockThreads, total: mockThreads.length, hasMore: false } })
  })

  app.get('/gov/dashboard', (_req, res) => {
    res.json({
      success: true,
      data: {
        totalMatches: 12,
        humanTakeoverCount: 3,
        activeThreads: 5,
        matchedToday: 4,
        tagDistribution: { 就業: 8, 青年: 6, 補助: 4, 住宅: 2 },
        needsDistribution: { 就業輔導: 7, 職業培訓: 5, 法律協助: 2 },
      },
    })
  })

  // Auth stub
  app.post('/auth/verify', (_req, res) => {
    res.json({ success: true, data: { uid: MOCK_PERSONA.uid, role: 'citizen' } })
  })

  return app
}

export function startMockServer(port = 3001) {
  const app = createMockApp()
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (socket: WebSocket) => {
    console.log('[mock] WS client connected')

    setTimeout(() => {
      const event: ServerEvent = { type: 'match_notify', thread: MOCK_THREAD, resource: MOCK_RESOURCE }
      socket.send(JSON.stringify(event))
    }, 5_000)

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
      const event: ServerEvent = { type: 'peer_notify', thread: peerThread, peer: MOCK_PEER_PREVIEW }
      socket.send(JSON.stringify(event))
    }, 10_000)

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'chat_message') {
          const reply: ServerEvent = { type: 'agent_reply', content: '（mock）收到你的訊息，正在思考中...', done: true }
          socket.send(JSON.stringify(reply))
        }
      } catch { /* ignore malformed */ }
    })

    socket.on('close', () => console.log('[mock] WS client disconnected'))
  })

  return new Promise<void>((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`[mock] server running on http://localhost:${port}`)
      resolve()
    })
  })
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// Run standalone: tsx src/mock/server.ts
// When imported from index.ts, startMockServer() is called explicitly.
const isMain = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')
if (isMain) startMockServer(3001)
