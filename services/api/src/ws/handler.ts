import type { IncomingMessage } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { getAuth } from 'firebase-admin/auth'
import type { ServerEvent } from '@matcha/shared-types'

// uid → set of open sockets (one user may have multiple tabs)
const clients = new Map<string, Set<WebSocket>>()

export function broadcast(uid: string, event: ServerEvent) {
  const sockets = clients.get(uid)
  if (!sockets) return
  const payload = JSON.stringify(event)
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  }
}

export function broadcastToThread(threadId: string, event: ServerEvent, uids: string[]) {
  for (const uid of uids) broadcast(uid, event)
}

export function createWss() {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage, uid: string) => {
    if (!clients.has(uid)) clients.set(uid, new Set())
    clients.get(uid)!.add(ws)
    console.log(`[ws] ${uid} connected`)

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        await handleClientEvent(ws, uid, msg)
      } catch {
        sendError(ws, 'BAD_REQUEST', '訊息格式錯誤')
      }
    })

    ws.on('close', () => {
      clients.get(uid)?.delete(ws)
      console.log(`[ws] ${uid} disconnected`)
    })
  })

  return wss
}

async function handleClientEvent(ws: WebSocket, uid: string, msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'chat_message':
      // TODO: forward to Persona Agent, stream agent_reply events back
      sendToSocket(ws, { type: 'agent_reply', content: '（待實作）', done: true })
      break

    case 'swipe':
      // TODO: call Persona Agent swipe handler
      break

    case 'human_join':
      // TODO: update presence in Firestore, broadcast presence_update
      break

    case 'human_leave':
      // TODO: update presence in Firestore, broadcast presence_update
      break

    case 'thread_message':
      // TODO: write human message to thread, broadcast thread_message
      break

    default:
      sendError(ws, 'UNKNOWN_EVENT', `未知的事件類型: ${msg.type}`)
  }
}

function sendToSocket(ws: WebSocket, event: ServerEvent) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event))
}

function sendError(ws: WebSocket, code: string, message: string) {
  sendToSocket(ws, { type: 'error', code, message })
}

export async function upgradeHandler(
  wss: WebSocketServer,
  req: IncomingMessage,
  socket: import('net').Socket,
  head: Buffer,
) {
  // Extract token from Authorization header or ?token= query param
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

  try {
    const decoded = await getAuth().verifyIdToken(token)
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, decoded.uid)
    })
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
  }
}
