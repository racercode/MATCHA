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
import express, { type Express } from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import {
  MOCK_PERSONA,
  MOCK_RESOURCE,
  MOCK_PEER_PREVIEW,
  msToTimestamp,
  type ServerEvent,
} from '@matcha/shared-types'

export function createMockApp(): Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // -------------------------------------------------------------------------
  // Auth stub
  // -------------------------------------------------------------------------

  app.post('/auth/verify', (_req, res) => {
    res.json({ success: true, data: { uid: MOCK_PERSONA.uid, role: 'citizen' } })
  })

  // -------------------------------------------------------------------------
  // Citizen — Persona
  // -------------------------------------------------------------------------

  app.get('/me/persona', (_req, res) => {
    res.json({ success: true, data: MOCK_PERSONA })
  })

  // Persona Chat via SSE (mirrors the WS persona_message / agent_reply contract)
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

  // Swipe card stub
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
  // Citizen — Match Inbox (channel replies polling)
  // -------------------------------------------------------------------------

  app.get('/me/channel-replies', (_req, res) => {
    res.json({
      success: true,
      data: {
        items: [
          {
            replyId: 'r-001',
            messageId: 'm-001',
            govId: MOCK_RESOURCE.rid,
            govName: MOCK_RESOURCE.name,
            content: '你的背景非常符合本計畫的資格：年齡符合、有就業需求。建議申請。',
            matchScore: 87,
            createdAt: msToTimestamp(Date.now() - 3_000_000),
          },
        ],
        hasMore: false,
      },
    })
  })

  // -------------------------------------------------------------------------
  // Citizen — Peer Threads (Coffee Chat polling)
  // -------------------------------------------------------------------------

  const mockPeerThreadItems = [
    {
      tid: 'peer-tid-001',
      type: 'user_user',
      peer: {
        uid: 'peer-uid-001',
        displayName: '想轉品牌設計的ian',
        summary: '文組背景，正在轉職 UI / 品牌設計，自學 Figma 兩個月，靠接小案子建立作品集',
      },
      bullets: ['先找練習案子再考隨班課程，省時省錢', 'Behance 比 IG 更能被設計公司看到', '跨域補助和實習可以同期進行'],
      matchRationale: '兩人都是文組背景轉設計，且都在尋找作品集建立方向',
      status: 'active',
      createdAt: msToTimestamp(Date.now() - 1000 * 60 * 60 * 20),
      updatedAt: msToTimestamp(Date.now() - 1000 * 60 * 60 * 18),
    },
    {
      tid: 'peer-tid-002',
      type: 'user_user',
      peer: {
        uid: 'peer-uid-002',
        displayName: '文組轉設計的karina',
        summary: '廣告文案背景，目前在台北市設計培訓課，對品牌設計有興趣',
      },
      bullets: ['培訓課程名額比較到，先前先查', '文字能力是品牌設計的優勢，不用擔心'],
      matchRationale: '兩人對品牌設計與職涯轉換都有興趣，背景互補',
      status: 'active',
      createdAt: msToTimestamp(Date.now() - 1000 * 60 * 60 * 72),
      updatedAt: msToTimestamp(Date.now() - 1000 * 60 * 60 * 70),
    },
  ]

  app.get('/me/peer-threads', (_req, res) => {
    res.json({ success: true, data: { items: mockPeerThreadItems, hasMore: false } })
  })

  app.get('/peer-threads/:tid/messages', (req, res) => {
    res.json({
      success: true,
      data: {
        items: [
          {
            mid: `${req.params.tid}-msg-1`,
            from: 'coffee_agent',
            content: '你們兩個都是文組背景轉設計，應該有很多可以聊的！',
            createdAt: msToTimestamp(Date.now() - 1000 * 60 * 60 * 19),
          },
          {
            mid: `${req.params.tid}-msg-2`,
            from: `user:${MOCK_PEER_PREVIEW.uid}`,
            content: '對，我也覺得！你現在在學哪些設計工具呢？',
            createdAt: msToTimestamp(Date.now() - 1000 * 60 * 60 * 18),
          },
        ],
        hasMore: false,
      },
    })
  })

  // -------------------------------------------------------------------------
  // Citizen — Human Threads polling
  // -------------------------------------------------------------------------

  app.get('/me/human-threads', (_req, res) => {
    res.json({ success: true, data: { items: [], hasMore: false } })
  })

  app.get('/human-threads/:tid/messages', (_req, res) => {
    res.json({ success: true, data: { items: [], hasMore: false } })
  })

  // -------------------------------------------------------------------------
  // Gov — Channel Replies & Dashboard
  // -------------------------------------------------------------------------

  app.get('/gov/channel-replies', (_req, res) => {
    res.json({
      success: true,
      data: {
        items: [
          {
            replyId: 'r-001',
            messageId: 'm-001',
            govId: MOCK_RESOURCE.rid,
            content: '你的背景非常符合本計畫的資格：年齡符合、有就業需求。建議申請。',
            matchScore: 87,
            createdAt: msToTimestamp(Date.now() - 3_000_000),
            citizen: {
              uid: MOCK_PERSONA.uid,
              displayName: MOCK_PERSONA.displayName,
              summary: MOCK_PERSONA.summary,
            },
            humanThreadOpened: false,
          },
        ],
        hasMore: false,
      },
    })
  })

  app.post('/gov/channel-replies/:replyId/open', (req, res) => {
    const now = msToTimestamp(Date.now())
    res.status(201).json({
      success: true,
      data: {
        tid: `ht-${Date.now()}`,
        type: 'gov_user',
        userId: MOCK_PERSONA.uid,
        govId: MOCK_RESOURCE.rid,
        channelReplyId: req.params.replyId,
        matchScore: 87,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      },
    })
  })

  app.get('/gov/dashboard', (_req, res) => {
    res.json({
      success: true,
      data: {
        totalReplies: 12,
        avgMatchScore: 78.5,
        openedConversations: 3,
        openRate: 0.25,
        scoreDistribution: { '90-100': 2, '70-89': 7, '50-69': 2, '0-49': 1 },
      },
    })
  })

  app.get('/gov/human-threads', (_req, res) => {
    res.json({ success: true, data: { items: [], hasMore: false } })
  })

  // -------------------------------------------------------------------------
  // Gov — Resources
  // -------------------------------------------------------------------------

  app.get('/gov/resources', (_req, res) => {
    res.json({ success: true, data: { items: [MOCK_RESOURCE] } })
  })

  app.post('/gov/resources', (req, res) => {
    const resource = { ...MOCK_RESOURCE, rid: `rid-${Date.now()}`, ...req.body, createdAt: msToTimestamp(Date.now()) }
    res.status(201).json({ success: true, data: resource })
  })

  return app
}

export function startMockServer(port = 3001) {
  const app = createMockApp()
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (socket: WebSocket) => {
    console.log('[mock] WS client connected')

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())

        if (msg.type === 'persona_message') {
          // Simulate streaming PersonaAgent reply
          const reply: ServerEvent = { type: 'agent_reply', content: '我好想你...', done: false }
          socket.send(JSON.stringify(reply))
          setTimeout(() => {
            const done: ServerEvent = { type: 'agent_reply', content: '', done: true }
            socket.send(JSON.stringify(done))
          }, 800)
        }

        if (msg.type === 'peer_message') {
          const echo: ServerEvent = {
            type: 'peer_message',
            message: {
              mid: `pm-${Date.now()}`,
              from: `user:mock`,
              content: `（mock echo）${msg.content}`,
              createdAt: msToTimestamp(Date.now()),
            },
          }
          socket.send(JSON.stringify(echo))
        }

        if (msg.type === 'human_message') {
          const echo: ServerEvent = {
            type: 'human_message',
            message: {
              mid: `hm-${Date.now()}`,
              from: 'gov_staff:mock',
              content: `（mock）承辦人收到：${msg.content}`,
              createdAt: msToTimestamp(Date.now()),
            },
          }
          socket.send(JSON.stringify(echo))
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
const isMain = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')
if (isMain) startMockServer(3001)
