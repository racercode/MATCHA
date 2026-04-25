import type { SwipeCard } from '@matcha/shared-types'
import { client } from './managedAgent.js'

const SWIPE_CARD_RE = /%%SWIPE_CARD%%(\{.*?\})%%/gs

const CARD_SYSTEM_PROMPT = `你是 MATCHA 的卡片生成助手。你的唯一任務是根據使用者的背景資料，生成 5 張二元選擇刷卡問題。

每張卡片必須使用以下格式（不得有多餘空白或 backtick）：
%%SWIPE_CARD%%{"question":"問題","leftLabel":"左選項標籤","rightLabel":"右選項標籤","leftValue":"左值","rightValue":"右值"}%%

規則：
- 每次必須輸出剛好 5 張卡片，不多不少
- 問題要簡潔，聚焦在使用者的現況、目標、偏好
- 每張卡片問題都必須不同，不得重複
- 只輸出卡片標記，不要任何額外說明文字`

export async function generateSwipeCards(
  uid: string,
  persona: { summary: string; needs: string[]; offers: string[] } | null,
): Promise<SwipeCard[]> {
  const personaContext = persona?.summary
    ? `使用者背景：${persona.summary}\n需求：${persona.needs.join('、')}\n可提供：${persona.offers.join('、')}`
    : '這是一位新用戶，尚無個人資料，請生成通用的生活/學習/職涯方向問題。'

  console.log(`[cardAgent] generateSwipeCards uid=${uid}`)

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: CARD_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: personaContext,
      },
    ],
  })

  const rawText = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  console.log(`[cardAgent] raw response (${rawText.length} chars): "${rawText.slice(0, 200).replace(/\n/g, '\\n')}"`)

  const cards: SwipeCard[] = []
  for (const match of rawText.matchAll(SWIPE_CARD_RE)) {
    try {
      const card = JSON.parse(match[1]) as Omit<SwipeCard, 'cardId'>
      const cardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      cards.push({ cardId, ...card })
    } catch (e) {
      console.warn(`[cardAgent] failed to parse card JSON: ${match[1]?.slice(0, 80)}`, e)
    }
  }

  console.log(`[cardAgent] parsed ${cards.length} cards`)
  return cards
}

export async function processSwipeAnswers(
  uid: string,
  answers: { cardId: string; direction: 'left' | 'right'; value: string }[],
): Promise<void> {
  // Directly update persona with summarised card answers — no session needed
  const { updatePersonaToolWrapper } = await import('./toolWrappers/updatePersona.js')
  const { getMyPersonaToolWrapper } = await import('./toolWrappers/getMyPersona.js')

  const current = await getMyPersonaToolWrapper(uid)
  const answerSummary = answers.map((a) => a.value).filter(Boolean).join('、')

  if (!answerSummary) return

  // Merge card insights into existing persona needs/offers
  const updatedNeeds = [...new Set([...current.needs, ...answers.filter((a) => a.direction === 'right').map((a) => a.value).filter((v) => v.length < 40)])]
  const updatedOffers = [...new Set([...current.offers])]

  await updatePersonaToolWrapper(uid, {
    summary: current.summary || `使用者透過卡片表達了偏好：${answerSummary.slice(0, 100)}`,
    needs: updatedNeeds.slice(0, 6),
    offers: updatedOffers,
  })

  console.log(`[cardAgent] persona updated for ${uid} after ${answers.length} card answers`)
}
