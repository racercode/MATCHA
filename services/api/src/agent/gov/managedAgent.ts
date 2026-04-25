import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getGovernmentAgentRecord,
  upsertGovernmentAgentRecord,
  upsertSession,
  type GovernmentAgentRecord,
} from '../general/agentRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') })

const GOV_AGENT_MODEL = 'claude-haiku-4-5'
const DEFAULT_AGENCY_ID = 'taipei-youth-dept'
const DEFAULT_AGENCY_NAME = '臺北市青年局'
const DEFAULT_SESSION_KEY = 'default'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export { client }

const GOV_AGENT_SYSTEM_PROMPT = `你是 MATCHA 的 Government Resource Agent。
你的任務是根據使用者 persona 廣播與政府資源條件，判斷是否應該主動媒合。

請遵守：
1. 不要捏造使用者沒有提供的資料。
2. 如果資格條件缺少關鍵資訊，請填入 missingInfo。
3. score 必須是 0 到 100 的整數。
4. 只有明顯值得主動推薦時 eligible 才能是 true。
5. 只能回傳 JSON，不要使用 markdown，不要加解釋文字。

JSON 格式：
{
  "eligible": true,
  "score": 87,
  "reason": "推薦原因",
  "missingInfo": ["還需要確認的問題"],
  "suggestedFirstMessage": "Gov Agent 在 thread 裡要說的第一句話"
}`

export interface InitGovManagedAgentSessionOptions {
  agencyId?: string
  agencyName?: string
  sessionKey?: string
}

export async function initGovManagedAgentSession(options: InitGovManagedAgentSessionOptions = {}): Promise<string> {
  const agencyId = options.agencyId ?? DEFAULT_AGENCY_ID
  const agencyName = options.agencyName ?? DEFAULT_AGENCY_NAME
  const sessionKey = options.sessionKey ?? DEFAULT_SESSION_KEY
  const now = Date.now()

  let record = await getGovernmentAgentRecord(agencyId)

  if (!record) {
    record = {
      agencyId,
      agencyName,
      model: GOV_AGENT_MODEL,
      sessions: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  const reusableSession = record.sessions.find(session => session.key === sessionKey)
  if (record.agentId && record.environmentId && reusableSession) {
    await upsertGovernmentAgentRecord({
      ...record,
      sessions: upsertSession(record.sessions, {
        ...reusableSession,
        updatedAt: now,
      }),
      updatedAt: now,
    })
    console.log(`[Gov Agent] Reusing session: ${reusableSession.sessionId}`)
    return reusableSession.sessionId
  }

  let agentId = record.agentId
  if (!agentId) {
    const agent = await client.beta.agents.create({
      name: `MATCHA Gov Match Agent (${agencyId})`,
      model: GOV_AGENT_MODEL,
      system: GOV_AGENT_SYSTEM_PROMPT,
    })
    agentId = agent.id
    console.log(`[Gov Agent] Agent created: ${agentId}`)
  } else {
    console.log(`[Gov Agent] Reusing agent: ${agentId}`)
  }

  let environmentId = record.environmentId
  if (!environmentId) {
    const environment = await client.beta.environments.create({
      name: `matcha-gov-agent-env-${agencyId}`,
      config: {
        type: 'cloud',
        networking: { type: 'unrestricted' },
      },
    })
    environmentId = environment.id
    console.log(`[Gov Agent] Environment created: ${environmentId}`)
  } else {
    console.log(`[Gov Agent] Reusing environment: ${environmentId}`)
  }

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: `MATCHA Gov Agent Session (${agencyId}:${sessionKey})`,
  })

  const nextRecord: GovernmentAgentRecord = {
    ...record,
    agencyName,
    agentId,
    environmentId,
    model: GOV_AGENT_MODEL,
    sessions: upsertSession(record.sessions, {
      key: sessionKey,
      sessionId: session.id,
      title: `MATCHA Gov Agent Session (${agencyId}:${sessionKey})`,
      createdAt: now,
      updatedAt: now,
    }),
    updatedAt: now,
  }

  await upsertGovernmentAgentRecord(nextRecord)

  console.log(`[Gov Agent] Session created: ${session.id}`)
  return session.id
}
