/**
 * 測試 gov agent 觸發流程：寫一筆假 channel message → 呼叫 handleGovAgentRunForMessage
 *
 * 用法：
 *   pnpm --filter api tsx src/agent/gov/testTrigger.ts
 *   pnpm --filter api tsx src/agent/gov/testTrigger.ts --fire-and-forget   # 模擬 publishToChannel 的 fire-and-forget 路徑
 */

import { db } from '../../lib/firebase.js'
import { handleGovAgentRunForMessage } from './channelMessageTrigger.js'

const useFireAndForget = process.argv.includes('--fire-and-forget')

const msgId = `test-trigger-${Date.now()}`
const testMessage = {
  uid: 'test-user-001',
  summary: '我是大學生，想找實習或職涯輔導的資源，對青年創業補助也有興趣',
  createdAt: Date.now(),
}

console.log(`\n=== Gov Agent Trigger Test ===`)
console.log(`msgId:   ${msgId}`)
console.log(`summary: ${testMessage.summary}`)
console.log(`mode:    ${useFireAndForget ? 'fire-and-forget (like publishToChannel)' : 'await (direct call)'}`)
console.log('')

// Step 1: 寫入 Firestore channel_messages
console.log('[1/2] Writing test channel message to Firestore...')
await db.collection('channel_messages').doc(msgId).set(testMessage)
console.log(`[1/2] Done — channel_messages/${msgId} created`)

// Step 2: 觸發 gov agent
console.log('[2/2] Triggering handleGovAgentRunForMessage...')

if (useFireAndForget) {
  handleGovAgentRunForMessage(msgId, { threshold: 30 })
    .then((result) => {
      console.log('\n=== Result (fire-and-forget) ===')
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error('\n=== Error (fire-and-forget) ===')
      console.error(err)
      process.exit(1)
    })
} else {
  try {
    const result = await handleGovAgentRunForMessage(msgId, { threshold: 30 })
    console.log('\n=== Result ===')
    console.log(JSON.stringify(result, null, 2))

    if (result.ok && !result.skipped) {
      console.log(`\nresourceCount: ${result.resourceCount}`)
      console.log(`matchCount:    ${result.matchCount}`)
      for (const m of result.matches) {
        console.log(`  - [${m.assessment.decision.decision}] score=${m.assessment.decision.score} reason=${m.assessment.decision.reason}`)
      }
    }
  } catch (err) {
    console.error('\n=== Error ===')
    console.error(err)
    process.exit(1)
  }
  process.exit(0)
}
