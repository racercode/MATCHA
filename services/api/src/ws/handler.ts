import type { IncomingMessage } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { msToTimestamp } from '@matcha/shared-types'
import { db } from '../lib/firebase.js'
import { clients, userRoles, userGovIds, broadcast } from './push.js'
import type { ServerEvent } from './push.js'
import { initPersonaManagedAgentSession } from '../agent/persona/managedAgent.js'
import { runPersonaAgentTurn } from '../agent/persona/pipeline.js'

export { broadcast }

// ── Socket helpers ────────────────────────────────────────────────────────────

function sendToSocket(ws: WebSocket, event: ServerEvent) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event))
}

function sendError(ws: WebSocket, code: string, message: string) {
  sendToSocket(ws, { type: 'error', code, message })
}

async function findGovStaffUidByGovId(govId: string): Promise<string | undefined> {
  const snap = await db.collection('gov_staff').where('govId', '==', govId).get()
  return snap.empty ? undefined : snap.docs[0].id
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleClientEvent(ws: WebSocket, uid: string, msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'persona_message': {
      if (typeof msg.content !== 'string') {
        sendError(ws, 'BAD_REQUEST', '缺少 content')
        return
      }
      try {
        const sessionId = await initPersonaManagedAgentSession(uid)
        await runPersonaAgentTurn(sessionId, uid, msg.content, event => sendToSocket(ws, event))
      } catch (err) {
        console.error('[persona] agent error:', err)
        sendError(ws, 'AGENT_ERROR', '代理人發生錯誤，請稍後再試')
      }
      break
    }

    case 'peer_message': {
      const { threadId, content } = msg
      if (typeof threadId !== 'string' || typeof content !== 'string') {
        sendError(ws, 'BAD_REQUEST', '缺少 threadId 或 content')
        return
      }

      const threadDoc = await db.collection('peer_threads').doc(threadId).get()
      if (!threadDoc.exists) {
        sendError(ws, 'THREAD_NOT_FOUND', `Thread ${threadId} 不存在或無權限存取`)
        return
      }
      const thread = threadDoc.data()!
      if (thread.userAId !== uid && thread.userBId !== uid) {
        sendError(ws, 'THREAD_NOT_FOUND', `Thread ${threadId} 不存在或無權限存取`)
        return
      }

      const now = Date.now()
      const msgData = {
        from: `user:${uid}`,
        content,
        createdAt: msToTimestamp(now),
      }
      const msgRef = db.collection('peer_threads').doc(threadId).collection('messages').doc()
      await msgRef.set(msgData)
      await db.collection('peer_threads').doc(threadId).update({ updatedAt: now })

      const storeMsg = { mid: msgRef.id, ...msgData }
      broadcast(thread.userAId as string, { type: 'peer_message', message: storeMsg })
      broadcast(thread.userBId as string, { type: 'peer_message', message: storeMsg })
      break
    }

    case 'human_message': {
      const { threadId, content } = msg
      if (typeof threadId !== 'string' || typeof content !== 'string') {
        sendError(ws, 'BAD_REQUEST', '缺少 threadId 或 content')
        return
      }

      const threadDoc = await db.collection('human_threads').doc(threadId).get()
      if (!threadDoc.exists) {
        sendError(ws, 'THREAD_NOT_FOUND', `Thread ${threadId} 不存在或無權限存取`)
        return
      }
      const thread = threadDoc.data()!

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
      const msgData = {
        from: storeFrom,
        content,
        createdAt: msToTimestamp(now),
      }
      const msgRef = db.collection('human_threads').doc(threadId).collection('messages').doc()
      await msgRef.set(msgData)
      await db.collection('human_threads').doc(threadId).update({ updatedAt: now })

      const storeMsg = { mid: msgRef.id, ...msgData }
      broadcast(thread.userId as string, { type: 'human_message', message: storeMsg })
      const govStaffUid = await findGovStaffUidByGovId(thread.govId as string)
      if (govStaffUid) broadcast(govStaffUid, { type: 'human_message', message: storeMsg })
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
  const staffDoc = await db.collection('gov_staff').doc(uid).get()
  const role: 'citizen' | 'gov_staff' = staffDoc.exists ? 'gov_staff' : 'citizen'
  const govId = staffDoc.exists ? (staffDoc.data()!.govId as string) : undefined

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, uid, role, govId)
  })
}
