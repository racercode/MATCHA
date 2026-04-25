import type { IncomingMessage } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { msToTimestamp } from '@matcha/shared-types'
import { db } from '../lib/firebase.js'
import { clients, userRoles, userGovIds, broadcast } from './push.js'
import type { ServerEvent } from './push.js'
import { initPersonaManagedAgentSession } from '../agent/persona/managedAgent.js'
import { runPersonaAgentTurn } from '../agent/persona/pipeline.js'
import { generateSwipeCards, processSwipeAnswers } from '../agent/persona/cardAgent.js'


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
      const userText = msg.content
      await db.collection('persona_chats').doc(uid).collection('messages').add({
        from: `human:${uid}`,
        text: userText,
        createdAt: msToTimestamp(Date.now()),
      })
      try {
        const sessionId = await initPersonaManagedAgentSession(uid, 'chat')
        let agentText = ''
        await runPersonaAgentTurn(sessionId, uid, userText, event => {
          sendToSocket(ws, event)
          if (event.type === 'agent_reply' && !event.done && typeof event.content === 'string') {
            agentText += event.content
          }
        })
        if (agentText.trim()) {
          await db.collection('persona_chats').doc(uid).collection('messages').add({
            from: 'persona_agent',
            text: agentText,
            createdAt: msToTimestamp(Date.now()),
          })
        }
      } catch (err) {
        console.error('[persona] agent error:', err)
        sendError(ws, 'AGENT_ERROR', '代理人發生錯誤，請稍後再試')
      }
      break
    }

    case 'swipe_card_request': {
      console.log(`[card] swipe_card_request from ${uid}`)
      try {
        const personaDoc = await db.collection('personas').doc(uid).get()
        const persona = personaDoc.exists
          ? (personaDoc.data() as { summary: string; needs: string[]; offers: string[] })
          : null
        const cards = await generateSwipeCards(uid, persona)
        for (const card of cards) {
          broadcast(uid, { type: 'swipe_card', card })
        }
        sendToSocket(ws, { type: 'agent_reply', content: '', done: true })
      } catch (err) {
        console.error('[card] generateSwipeCards error:', err)
        sendError(ws, 'AGENT_ERROR', '卡片生成失敗，請稍後再試')
      }
      break
    }

    case 'swipe_card_answer': {
      // Single-answer path kept for compatibility but not used by current frontend
      sendToSocket(ws, { type: 'agent_reply', content: '', done: true })
      break
    }

    case 'swipe_card_batch_answer': {
      console.log(`[card] swipe_card_batch_answer from ${uid}, ${(msg.answers as unknown[])?.length ?? 0} answers`)
      const { answers } = msg
      if (
        !Array.isArray(answers) ||
        answers.length === 0 ||
        answers.some(
          answer =>
            !answer ||
            typeof answer !== 'object' ||
            typeof answer.cardId !== 'string' ||
            (answer.direction !== 'left' && answer.direction !== 'right') ||
            typeof answer.value !== 'string',
        )
      ) {
        sendError(ws, 'BAD_REQUEST', '缺少有效的 swipe card answers')
        return
      }

      try {
        await processSwipeAnswers(uid, answers as { cardId: string; direction: 'left' | 'right'; value: string }[])
        sendToSocket(ws, { type: 'agent_reply', content: '', done: true })
      } catch (err) {
        console.error('[card] processSwipeAnswers error:', err)
        sendError(ws, 'AGENT_ERROR', '卡片答案批次送出失敗，請稍後再試')
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

  let uid: string
  try {
    const { auth: firebaseAuth } = await import('../lib/firebase.js')
    const decoded = await firebaseAuth.verifyIdToken(token.trim())
    uid = decoded.uid
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  const staffSnap = await db.collection('gov_staff').where('uid', '==', uid).limit(1).get()
  const staffDoc = staffSnap.docs[0]
  const role: 'citizen' | 'gov_staff' = staffDoc ? 'gov_staff' : 'citizen'
  const govId = staffDoc ? (staffDoc.data().govId as string) : undefined

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, uid, role, govId)
  })
}
