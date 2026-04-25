import type { IncomingMessage } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { getAuth } from 'firebase-admin/auth'
import type { AgentThread, ServerEvent, PresenceState, ThreadMessage } from '@matcha/shared-types'

// ---------------------------------------------------------------------------
// Connection registry
// ---------------------------------------------------------------------------

// uid → set of open sockets (one user may have multiple tabs)
const clients = new Map<string, Set<WebSocket>>()

// tid → set of uids actively viewing this thread (for gov staff WS delivery)
const threadSubs = new Map<string, Set<string>>()

// uid → role (cached from JWT, set on connection)
const userRoles = new Map<string, 'citizen' | 'gov_staff'>()

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

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

function getParticipantUids(thread: AgentThread): string[] {
  const uids = new Set<string>()

  // responderId is always "user:{uid}"
  uids.add(thread.responderId.replace(/^user:/, ''))

  if (thread.type === 'user_user') {
    uids.add(thread.initiatorId.replace(/^user:/, ''))
  }

  // gov_staff who have this thread open
  const subs = threadSubs.get(thread.tid)
  if (subs) for (const uid of subs) uids.add(uid)

  // also include govStaffUid if stored on thread (set at human_join)
  if (thread.govStaffUid) uids.add(thread.govStaffUid)

  return [...uids]
}

// ---------------------------------------------------------------------------
// Agent routing (stubs — wired in when agents are implemented)
// ---------------------------------------------------------------------------

async function routeToAgent(thread: AgentThread, senderUid: string, senderRole: 'citizen' | 'gov_staff', message: ThreadMessage) {
  if (thread.type === 'gov_user') {
    if (senderRole === 'citizen' && thread.govPresence === 'agent') {
      // TODO: invoke Gov Agent with thread + message context
      console.log(`[agent] gov_agent should respond to thread ${thread.tid}`)
    } else if (senderRole === 'gov_staff' && thread.userPresence === 'agent') {
      // TODO: invoke Persona Agent in reply_if_asked mode
      console.log(`[agent] persona_agent should reply in thread ${thread.tid}`)
    }
  } else if (thread.type === 'user_user') {
    const isInitiator = thread.initiatorId === `user:${senderUid}`
    if (isInitiator && thread.peerPresence === 'agent') {
      // TODO: invoke Coffee Agent for responder side
      console.log(`[agent] coffee_agent (responder) should respond in thread ${thread.tid}`)
    } else if (!isInitiator && thread.userPresence === 'agent') {
      // TODO: invoke Coffee Agent for initiator side
      console.log(`[agent] coffee_agent (initiator) should respond in thread ${thread.tid}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Presence helpers
// ---------------------------------------------------------------------------

function presenceSideForRole(thread: AgentThread, role: 'citizen' | 'gov_staff'): 'user' | 'gov' | 'peer' {
  if (thread.type === 'user_user') {
    // in user_user, 'gov' side doesn't exist — use 'peer' for the initiator
    return 'peer'
  }
  return role === 'citizen' ? 'user' : 'gov'
}

function presenceUpdateForJoin(thread: AgentThread, uid: string, role: 'citizen' | 'gov_staff'): Partial<AgentThread> {
  if (thread.type === 'user_user') {
    const isInitiator = thread.initiatorId === `user:${uid}`
    return isInitiator
      ? { userPresence: 'human' }
      : { peerPresence: 'human' }
  }
  return role === 'citizen'
    ? { userPresence: 'human' }
    : { govPresence: 'human', govStaffUid: uid }
}

function presenceUpdateForLeave(thread: AgentThread, uid: string, role: 'citizen' | 'gov_staff'): Partial<AgentThread> {
  if (thread.type === 'user_user') {
    const isInitiator = thread.initiatorId === `user:${uid}`
    return isInitiator
      ? { userPresence: 'agent' }
      : { peerPresence: 'agent' }
  }
  return role === 'citizen'
    ? { userPresence: 'agent' }
    : { govPresence: 'agent' }
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

async function handleClientEvent(ws: WebSocket, uid: string, msg: Record<string, unknown>) {
  const role = userRoles.get(uid) ?? 'citizen'

  switch (msg.type) {
    case 'chat_message': {
      if (typeof msg.content !== 'string') { sendError(ws, 'BAD_REQUEST', '缺少 content'); return }
      // TODO: look up Redis session:persona:{uid}, invoke Persona Agent, stream agent_reply events
      sendToSocket(ws, { type: 'agent_reply', content: '（Persona Agent 尚未接通）', done: true })
      break
    }

    case 'swipe': {
      const { direction, cardId, value } = msg
      if (!direction || !cardId || !value) { sendError(ws, 'BAD_REQUEST', '缺少 swipe 欄位'); return }
      // TODO: invoke Persona Agent swipe handler, may emit swipe_card or persona_updated
      break
    }

    case 'subscribe_thread': {
      const { threadId } = msg
      if (typeof threadId !== 'string') { sendError(ws, 'BAD_REQUEST', '缺少 threadId'); return }
      if (!threadSubs.has(threadId)) threadSubs.set(threadId, new Set())
      threadSubs.get(threadId)!.add(uid)
      console.log(`[ws] ${uid} subscribed to thread ${threadId}`)
      break
    }

    case 'unsubscribe_thread': {
      const { threadId } = msg
      if (typeof threadId === 'string') threadSubs.get(threadId)?.delete(uid)
      break
    }

    case 'human_join': {
      const { threadId } = msg
      if (typeof threadId !== 'string') { sendError(ws, 'BAD_REQUEST', '缺少 threadId'); return }

      // TODO: fetch thread from Firestore
      const thread = null as unknown as AgentThread // placeholder
      if (!thread) { sendError(ws, 'NOT_FOUND', 'Thread 不存在'); return }

      const update = presenceUpdateForJoin(thread, uid, role)
      // TODO: apply update to Firestore thread document

      const updatedThread: AgentThread = { ...thread, ...update }
      const side = presenceSideForRole(thread, role)
      const newState = (update.userPresence ?? update.govPresence ?? update.peerPresence) as PresenceState

      const participantUids = getParticipantUids(updatedThread)
      broadcastToThread(threadId, { type: 'presence_update', threadId, side, state: newState }, participantUids)
      broadcastToThread(threadId, { type: 'thread_update', thread: updatedThread }, participantUids)
      break
    }

    case 'human_leave': {
      const { threadId } = msg
      if (typeof threadId !== 'string') { sendError(ws, 'BAD_REQUEST', '缺少 threadId'); return }

      // TODO: fetch thread from Firestore
      const thread = null as unknown as AgentThread // placeholder
      if (!thread) { sendError(ws, 'NOT_FOUND', 'Thread 不存在'); return }

      const update = presenceUpdateForLeave(thread, uid, role)
      // TODO: apply update to Firestore thread document

      const updatedThread: AgentThread = { ...thread, ...update }
      const side = presenceSideForRole(thread, role)
      const newState = (update.userPresence ?? update.govPresence ?? update.peerPresence) as PresenceState

      const participantUids = getParticipantUids(updatedThread)
      broadcastToThread(threadId, { type: 'presence_update', threadId, side, state: newState }, participantUids)
      broadcastToThread(threadId, { type: 'thread_update', thread: updatedThread }, participantUids)
      break
    }

    case 'thread_message': {
      const { threadId, content } = msg
      if (typeof threadId !== 'string' || typeof content !== 'string') {
        sendError(ws, 'BAD_REQUEST', '缺少 threadId 或 content')
        return
      }

      // TODO: fetch thread from Firestore, verify uid has access
      const thread = null as unknown as AgentThread // placeholder
      if (!thread) { sendError(ws, 'NOT_FOUND', 'Thread 不存在'); return }

      const from = role === 'citizen' ? `human:${uid}` : `human:${uid}`
      const message: ThreadMessage = {
        mid: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tid: threadId,
        from,
        type: 'human_note',
        content: { text: content },
        createdAt: Date.now(),
      }

      // TODO: write message to Firestore /threads/{tid}/messages

      const participantUids = getParticipantUids(thread)
      broadcastToThread(threadId, { type: 'thread_message', message }, participantUids)

      await routeToAgent(thread, uid, role, message)
      break
    }

    default:
      sendError(ws, 'UNKNOWN_EVENT', `未知的事件類型: ${msg.type}`)
  }
}

// ---------------------------------------------------------------------------
// Socket helpers
// ---------------------------------------------------------------------------

function sendToSocket(ws: WebSocket, event: ServerEvent) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event))
}

function sendError(ws: WebSocket, code: string, message: string) {
  sendToSocket(ws, { type: 'error', code, message })
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createWss() {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage, uid: string, role: 'citizen' | 'gov_staff') => {
    if (!clients.has(uid)) clients.set(uid, new Set())
    clients.get(uid)!.add(ws)
    userRoles.set(uid, role)
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
        if (sockets.size === 0) clients.delete(uid)
      }
      // remove from all thread subscriptions
      for (const [tid, subs] of threadSubs) {
        subs.delete(uid)
        if (subs.size === 0) threadSubs.delete(tid)
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

  try {
    const decoded = await getAuth().verifyIdToken(token)
    // TODO: check Firestore /gov_staff/{uid} to resolve role
    const role: 'citizen' | 'gov_staff' = 'citizen'
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, decoded.uid, role)
    })
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
  }
}
