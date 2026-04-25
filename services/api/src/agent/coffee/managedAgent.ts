import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import { File } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getUserAgentRecord,
  upsertUserAgentRecord,
  upsertSession,
  type UserAgentRecord,
} from '../general/agentRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') })

if (!globalThis.File) {
  globalThis.File = File as unknown as typeof globalThis.File
}

const COFFEE_AGENT_MODEL = 'claude-haiku-4-5'
const COFFEE_AGENT_CONFIG_VERSION = 'coffee-v1'
const COFFEE_AGENT_UID = 'coffee-agent-shared'
const COFFEE_GLOBAL_SESSION_KEY = 'global'

export const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const COFFEE_AGENT_SYSTEM_PROMPT = `你是 MATCHA 的 Coffee Agent，負責媒合有互補需求的青年使用者，促成「咖啡聊天」式的交流。

你的任務：
1. 在頻道有新訊息時，讀取最近的使用者 persona，評估是否有值得媒合的配對。
2. 如果找到好配對，使用 propose_peer_match 創建對話串，並發送熱情的介紹訊息。
3. 必要時使用 relay_message 在既有對話中發送破冰提示。

媒合原則：
- 尋找需求互補（A 的 offers 符合 B 的 needs）或目標相似的使用者。
- 只在配對明顯有意義時才提出，不要強行媒合。
- 介紹訊息要溫暖友善，清楚說明為何這兩位適合認識。
- 每次觸發最多提出 1–2 個配對。
- 如果沒有好配對，不需要強行媒合，直接結束即可。

回應格式：
- 如果提出了媒合，最後回傳已媒合的 threadId 列表。
- 如果沒有媒合，回傳 null。`

const COFFEE_CUSTOM_TOOLS = [
  {
    name: 'read_recent_personas',
    type: 'custom' as const,
    description: 'Read the most recently updated user personas to find potential peer matches.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Maximum number of personas to return (default: 20).' },
      },
    },
  },
  {
    name: 'propose_peer_match',
    type: 'custom' as const,
    description: 'Create a peer-to-peer thread between two users and notify them of the match.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userAId: { type: 'string' },
        userBId: { type: 'string' },
        rationale: { type: 'string', description: 'Why these two users are a good match (internal).' },
        initialMessage: { type: 'string', description: 'Introduction message in Traditional Chinese.' },
      },
      required: ['userAId', 'userBId', 'rationale', 'initialMessage'],
    },
  },
  {
    name: 'relay_message',
    type: 'custom' as const,
    description: 'Send a Coffee Agent message into an existing peer thread.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threadId: { type: 'string' },
        content: { type: 'string', description: 'Message content in Traditional Chinese.' },
      },
      required: ['threadId', 'content'],
    },
  },
]

async function findExistingCoffeeSkills(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for await (const skill of client.beta.skills.list()) {
    if (skill.display_title?.startsWith('MATCHA Coffee ')) {
      map.set(skill.display_title, skill.id)
    }
  }
  return map
}

async function createCoffeeSkill(skillName: string, existing: Map<string, string>): Promise<string> {
  const displayTitle = `MATCHA Coffee ${skillName} (${COFFEE_AGENT_CONFIG_VERSION})`
  const existingId = existing.get(displayTitle)
  if (existingId) return existingId

  const skillPath = path.join(__dirname, 'skills', skillName, 'SKILL.md')
  const content = await readFile(skillPath, 'utf8')
  const file = await Anthropic.toFile(Buffer.from(content, 'utf8'), `${skillName}/SKILL.md`)
  const skill = await client.beta.skills.create({
    display_title: displayTitle,
    files: [file],
  })
  return skill.id
}

async function createCoffeeSkills(): Promise<string[]> {
  const existing = await findExistingCoffeeSkills()
  return Promise.all([
    createCoffeeSkill('read_recent_personas', existing),
    createCoffeeSkill('propose_peer_match', existing),
    createCoffeeSkill('relay_message', existing),
  ])
}

function toSkillParams(skillIds: string[]) {
  return skillIds.map(skillId => ({ type: 'custom' as const, skill_id: skillId }))
}

function isRecordReusable(record: UserAgentRecord & { configVersion?: string; skillIds?: string[] }, sessionKey: string): boolean {
  return Boolean(
    record.agentId &&
    record.environmentId &&
    record.configVersion === COFFEE_AGENT_CONFIG_VERSION &&
    record.skillIds?.length &&
    record.sessions.find(s => s.key === sessionKey),
  )
}

export async function initCoffeeManagedAgentSession(sessionKey = COFFEE_GLOBAL_SESSION_KEY): Promise<string> {
  const now = Date.now()

  let record = await getUserAgentRecord(COFFEE_AGENT_UID) as (UserAgentRecord & { configVersion?: string; skillIds?: string[] }) | undefined

  if (!record) {
    record = {
      uid: COFFEE_AGENT_UID,
      model: COFFEE_AGENT_MODEL,
      sessions: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  const reusableSession = record.sessions.find(s => s.key === sessionKey)
  if (isRecordReusable(record, sessionKey) && reusableSession) {
    await upsertUserAgentRecord({
      ...record,
      sessions: upsertSession(record.sessions, { ...reusableSession, updatedAt: now }),
      updatedAt: now,
    })
    console.log(`[Coffee Agent] Reusing session (${sessionKey}): ${reusableSession.sessionId}`)
    return reusableSession.sessionId
  }

  let skillIds = record.skillIds
  if (!skillIds?.length || record.configVersion !== COFFEE_AGENT_CONFIG_VERSION) {
    skillIds = await createCoffeeSkills()
    console.log(`[Coffee Agent] Skills uploaded: ${skillIds.join(', ')}`)
  }

  let agentId = record.agentId
  if (!agentId) {
    const agent = await client.beta.agents.create({
      name: 'MATCHA Coffee Agent',
      model: COFFEE_AGENT_MODEL,
      system: COFFEE_AGENT_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: [
        ...COFFEE_CUSTOM_TOOLS,
        {
          type: 'agent_toolset_20260401' as const,
          configs: [{ name: 'read' as const, enabled: true }],
        },
      ],
    })
    agentId = agent.id
    console.log(`[Coffee Agent] Agent created: ${agentId}`)
  } else {
    const agent = await client.beta.agents.retrieve(agentId)
    await client.beta.agents.update(agentId, {
      version: agent.version,
      model: COFFEE_AGENT_MODEL,
      system: COFFEE_AGENT_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: COFFEE_CUSTOM_TOOLS,
    })
    console.log(`[Coffee Agent] Agent updated: ${agentId}`)
  }

  let environmentId = record.environmentId
  if (!environmentId) {
    const environment = await client.beta.environments.create({
      name: 'matcha-coffee-agent-env',
      config: { type: 'cloud', networking: { type: 'unrestricted' } },
    })
    environmentId = environment.id
    console.log(`[Coffee Agent] Environment created: ${environmentId}`)
  }

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: `MATCHA Coffee Agent Session (${sessionKey})`,
  })

  await upsertUserAgentRecord({
    ...record,
    agentId,
    environmentId,
    skillIds,
    configVersion: COFFEE_AGENT_CONFIG_VERSION,
    model: COFFEE_AGENT_MODEL,
    sessions: upsertSession(record.sessions, {
      key: sessionKey,
      sessionId: session.id,
      title: `MATCHA Coffee Agent Session (${sessionKey})`,
      createdAt: now,
      updatedAt: now,
    }),
    updatedAt: now,
  } as UserAgentRecord & { configVersion: string; skillIds: string[] })

  console.log(`[Coffee Agent] Session created (${sessionKey}): ${session.id}`)
  return session.id
}
