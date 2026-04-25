import { msToTimestamp } from '@matcha/shared-types'
import { client } from '../persona/managedAgent.js'
import { db } from '../../lib/firebase.js'
import { broadcast } from '../../ws/push.js'

interface Persona {
  displayName?: string
  summary: string
  needs: string[]
  offers: string[]
}

function buildSystem(myName: string, mine: Persona, otherName: string, other: Persona): string {
  return `你是 ${myName} 的 AI 代理人，負責代表他與 ${otherName} 進行初次交流。

你代表的使用者：
- 簡介：${mine.summary}
- 需求：${mine.needs.join('、') || '（尚未填寫）'}
- 能提供：${mine.offers.join('、') || '（尚未填寫）'}

對方（${otherName}）的背景：
- 簡介：${other.summary}
- 需求：${other.needs.join('、') || '（尚未填寫）'}
- 能提供：${other.offers.join('、') || '（尚未填寫）'}

對話規則：
- 以第一人稱「我」說話，代表 ${myName}
- 語氣自然友善，像真人對話
- 每次 2–4 句，不要太長
- 聚焦在兩人互補或相似的地方
- 繁體中文，嚴禁 Markdown 語法`
}

async function callAgent(system: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system,
    messages,
  })
  return res.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()
}

async function saveAndBroadcast(
  threadId: string,
  fromUid: string,
  content: string,
  userAId: string,
  userBId: string,
): Promise<void> {
  const now = Date.now()
  const msgData = {
    from: `agent:${fromUid}`,
    content,
    createdAt: msToTimestamp(now),
  }
  const msgRef = db.collection('peer_threads').doc(threadId).collection('messages').doc()
  await msgRef.set(msgData)
  await db.collection('peer_threads').doc(threadId).update({ updatedAt: now })
  const msg = { mid: msgRef.id, ...msgData }
  broadcast(userAId, { type: 'peer_message', message: msg })
  broadcast(userBId, { type: 'peer_message', message: msg })
}

export async function runPeerAgentIntro(
  threadId: string,
  userAId: string,
  userBId: string,
): Promise<void> {
  const [docA, docB] = await Promise.all([
    db.collection('personas').doc(userAId).get(),
    db.collection('personas').doc(userBId).get(),
  ])

  if (!docA.exists || !docB.exists) {
    console.warn(`[PeerIntro] Missing persona: A=${docA.exists} B=${docB.exists}, skipping intro`)
    return
  }

  const pA = docA.data() as Persona
  const pB = docB.data() as Persona
  const nameA = pA.displayName || `使用者${userAId.slice(0, 5)}`
  const nameB = pB.displayName || `使用者${userBId.slice(0, 5)}`

  console.log(`[PeerIntro] Starting agent intro: ${nameA} ↔ ${nameB} (thread: ${threadId})`)

  // Turn 1: A opens
  const msgA1 = await callAgent(
    buildSystem(nameA, pA, nameB, pB),
    [{ role: 'user', content: `請代表 ${nameA} 向 ${nameB} 打招呼，簡短介紹自己，並說明為什麼覺得你們可能可以互相幫助。` }],
  )
  await saveAndBroadcast(threadId, userAId, msgA1, userAId, userBId)
  console.log(`[PeerIntro] ${nameA}: "${msgA1.slice(0, 80)}"`)

  // Turn 2: B responds
  const msgB1 = await callAgent(
    buildSystem(nameB, pB, nameA, pA),
    [{ role: 'user', content: `${nameA} 剛剛說：「${msgA1}」\n\n請代表 ${nameB} 友善地回應，並分享你自己的想法或經歷。` }],
  )
  await saveAndBroadcast(threadId, userBId, msgB1, userAId, userBId)
  console.log(`[PeerIntro] ${nameB}: "${msgB1.slice(0, 80)}"`)

  // Turn 3: A follows up
  const msgA2 = await callAgent(
    buildSystem(nameA, pA, nameB, pB),
    [
      { role: 'user', content: `請代表 ${nameA} 向 ${nameB} 打招呼。` },
      { role: 'assistant', content: msgA1 },
      { role: 'user', content: `${nameB} 回應：「${msgB1}」\n\n請代表 ${nameA} 繼續對話，可以問一個具體的問題或提出合作想法。` },
    ],
  )
  await saveAndBroadcast(threadId, userAId, msgA2, userAId, userBId)
  console.log(`[PeerIntro] ${nameA} (follow-up): "${msgA2.slice(0, 80)}"`)

  console.log(`[PeerIntro] ✅ Intro complete for thread ${threadId}`)
}
