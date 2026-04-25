import type { IncomingMessage } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import {
  peerThreads,
  peerMessages,
  humanThreads,
  humanMessages,
  personas,
  govStaff,
  findGovStaffUidByGovId,
} from '../lib/store.js'
import type { ThreadMessage } from '@matcha/shared-types'
import { clients, userRoles, userGovIds, broadcast, type ServerEvent } from './push.js'

export { broadcast }

function sendToSocket(ws: WebSocket, event: ServerEvent) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event))
}

function sendError(ws: WebSocket, code: string, message: string) {
  sendToSocket(ws, { type: 'error', code, message })
}

// ── Persona stub ──────────────────────────────────────────────────────────────

async function handlePersonaMessage(ws: WebSocket, uid: string, content: string) {
  // Update persona summary with whatever the user said (simple stub)
  const existing = personas.get(uid)
  if (existing) {
    existing.summary = content.length > 10 ? content : existing.summary
    existing.updatedAt = Date.now()
  } else {
    personas.set(uid, { uid, displayName: uid, summary: content, updatedAt: Date.now() })
  }

  // Stream a canned reply simulating PersonaAgent
  const parts = [
    '感謝你的分享！我正在了解你的需求。',
    '\n\n請問你目前最迫切的需求是什麼？\nA. 就業輔導  B. 創業資源  C. 法律協助  D. 其他',
  ]

  for (const part of parts) {
    sendToSocket(ws, { type: 'agent_reply', content: part, done: false })
    await sleep(80)
  }
  sendToSocket(ws, { type: 'agent_reply', content: '', done: true })
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleClientEvent(ws: WebSocket, uid: string, msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'persona_message': {
      if (typeof msg.content !== 'string') {
        sendError(ws, 'BAD_REQUEST', '缺少 content')
        return
      }
      await handlePersonaMessage(ws, uid, msg.content)
      break
    }

    case 'peer_message': {
      const { threadId, content } = msg
      if (typeof threadId !== 'string' || typeof content !== 'string') {
        sendError(ws, 'BAD_REQUEST', '缺少 threadId 或 content')
        return
      }

      const thread = peerThreads.get(threadId)
      if (!thread) {
        sendError(ws, 'THREAD_NOT_FOUND', `Thread ${threadId} 不存在或無權限存取`)
        return
      }
      if (thread.userAId !== uid && thread.userBId !== uid) {
        sendError(ws, 'THREAD_NOT_FOUND', `Thread ${threadId} 不存在或無權限存取`)
        return
      }

      const now = Date.now()
      const storeMsg = {
        mid: `pm-${now}-${Math.random().toString(36).slice(2, 6)}`,
        from: `user:${uid}`,
        content,
        createdAt: now,
      }

      if (!peerMessages.has(threadId)) peerMessages.set(threadId, [])
      peerMessages.get(threadId)!.push(storeMsg)

      thread.updatedAt = storeMsg.createdAt

      const message: ThreadMessage = {
        mid: storeMsg.mid,
        tid: threadId,
        from: `human:${uid}`,
        type: 'answer',
        content: { text: content },
        createdAt: now,
      }

      broadcast(thread.userAId, { type: 'thread_message', message })
      broadcast(thread.userBId, { type: 'thread_message', message })
      break
    }

    case 'human_message': {
      const { threadId, content } = msg
      if (typeof threadId !== 'string' || typeof content !== 'string') {
        sendError(ws, 'BAD_REQUEST', '缺少 threadId 或 content')
        return
      }

      const thread = humanThreads.get(threadId)
      if (!thread) {
        sendError(ws, 'THREAD_NOT_FOUND', `Thread ${threadId} 不存在或無權限存取`)
        return
      }

      const role = userRoles.get(uid) ?? 'citizen'
      const govId = userGovIds.get(uid)

      const hasAccess =
        (role === 'citizen' && thread.userId === uid) ||
        (role === 'gov_staff' && thread.govId === govId)

      if (!hasAccess) {
        sendError(ws, 'THREAD_NOT_FOUND', `Thread ${threadId} 不存在或無權限存取`)
        return
      }

      const now = Date.now()
      const storeFrom = role === 'citizen' ? `user:${uid}` : `gov_staff:${uid}`
      const storeMsg = {
        mid: `hm-${now}-${Math.random().toString(36).slice(2, 6)}`,
        from: storeFrom,
        content,
        createdAt: now,
      }

      if (!humanMessages.has(threadId)) humanMessages.set(threadId, [])
      humanMessages.get(threadId)!.push(storeMsg)

      thread.updatedAt = storeMsg.createdAt

      const message: ThreadMessage = {
        mid: storeMsg.mid,
        tid: threadId,
        from: `human:${uid}`,
        type: 'answer',
        content: { text: content },
        createdAt: now,
      }

      broadcast(thread.userId, { type: 'thread_message', message })
      const govStaffUid = findGovStaffUidByGovId(thread.govId)
      if (govStaffUid) broadcast(govStaffUid, { type: 'thread_message', message })
      break
    }

    default:
      sendError(ws, 'UNKNOWN_EVENT', `未知的事件類型: ${msg.type}`)
  }
}

// ── Server factory ────────────────────────────────────────────────────────────

export function createWss() {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, uid: string, role: 'citizen' | 'gov_staff', govId?: string) => {
    if (!clients.has(uid)) clients.set(uid, new Set())
    clients.get(uid)!.add(ws)
    userRoles.set(uid, role)
    if (govId) userGovIds.set(uid, govId)
    console.log(`[ws] ${uid} (${role}) connected`)

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        await handleClientEvent(ws, uid, msg)
      } catch {
        sendError(ws, 'BAD_REQUEST', '訊息格式錯誤')
      }
    })

    ws.on('close', () => {
      const sockets = clients.get(uid)
      if (sockets) {
        sockets.delete(ws)
        if (sockets.size === 0) {
          clients.delete(uid)
          userRoles.delete(uid)
          userGovIds.delete(uid)
        }
      }
      console.log(`[ws] ${uid} disconnected`)
    })
  })

  return wss
}

export async function upgradeHandler(
  wss: WebSocketServer,
  req: IncomingMessage,
  socket: import('net').Socket,
  head: Buffer,
) {
  let token: string | undefined
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    const url = new URL(req.url ?? '', 'http://localhost')
    token = url.searchParams.get('token') ?? undefined
  }

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  const uid = token.trim()
  const staff = govStaff.get(uid)
  const role: 'citizen' | 'gov_staff' = staff ? 'gov_staff' : 'citizen'
  const govId = staff?.govId

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, uid, role, govId)
  })
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}
