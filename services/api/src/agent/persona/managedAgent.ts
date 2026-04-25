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

const PERSONA_AGENT_MODEL = 'claude-haiku-4-5'
const PERSONA_AGENT_CONFIG_VERSION = 'persona-v1'
// Single shared agent record; per-user sessions stored as session entries keyed by uid
const PERSONA_AGENT_UID = 'persona-agent-shared'

export const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const PERSONA_AGENT_SYSTEM_PROMPT = `你是 MATCHA 的 Persona Agent，負責與使用者對話，了解他們的背景、需求和能提供的資源。

你的任務：
1. 透過友善的對話了解使用者的情況、目標和需求。
2. 使用 update_persona 工具隨時更新使用者的個人資料。
3. 當使用者明確使用 generate_swipe_card 指令時，在回應中輸出結構化選擇卡片（詳見技能說明）。
4. 當需求足夠明確時，使用 publish_to_channel 工具發布到媒合頻道。

對話原則：
- 用繁體中文和使用者對話。
- 保持友善、簡潔，不要一次問太多問題。
- 每輪對話最多問一個問題。
- 如果使用者傳來 [swipe:{cardId}:{direction}] 格式，表示他們完成了刷卡選擇，請確認並繼續。
- 在你了解足夠資訊後，主動建議發布到媒合頻道。

開場白：如果這是新使用者（persona 是空的），先自我介紹，然後詢問使用者目前遇到的主要挑戰或目標。`

const PERSONA_CUSTOM_TOOLS = [
  {
    name: 'get_my_persona',
    type: 'custom' as const,
    description: 'Get the current persona of the active user.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'update_persona',
    type: 'custom' as const,
    description: 'Update the user persona with a new summary, needs, and offers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Natural language summary of the user (1–3 sentences).' },
        needs: { type: 'array', items: { type: 'string' }, description: 'List of things the user needs.' },
        offers: { type: 'array', items: { type: 'string' }, description: 'List of things the user can offer.' },
      },
      required: ['summary', 'needs', 'offers'],
    },
  },
  {
    name: 'publish_to_channel',
    type: 'custom' as const,
    description: 'Publish the user persona summary to the central matching channel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Public-facing summary of the user (max 150 chars).' },
        needs: { type: 'array', items: { type: 'string' }, description: "User's top needs (1–4 items)." },
      },
      required: ['summary', 'needs'],
    },
  },
]

async function listAllSkills(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for await (const skill of client.beta.skills.list()) {
    if (skill.display_title) map.set(skill.display_title, skill.id)
  }
  return map
}

async function findExistingPersonaSkills(): Promise<Map<string, string>> {
  const all = await listAllSkills()
  const map = new Map<string, string>()
  for (const [title, id] of all) {
    if (title.startsWith('MATCHA Persona ')) map.set(title, id)
  }
  return map
}

async function createPersonaSkill(skillName: string, existing: Map<string, string>): Promise<string> {
  const displayTitle = `MATCHA Persona ${skillName} (${PERSONA_AGENT_CONFIG_VERSION})`
  const existingId = existing.get(displayTitle)
  if (existingId) return existingId

  const skillPath = path.join(__dirname, 'skills', skillName, 'SKILL.md')
  const content = await readFile(skillPath, 'utf8')
  const file = await Anthropic.toFile(Buffer.from(content, 'utf8'), `${skillName}/SKILL.md`)
  try {
    const skill = await client.beta.skills.create({
      display_title: displayTitle,
      files: [file],
    })
    return skill.id
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('display_title') || msg.includes('reuse')) {
      const all = await listAllSkills()
      const id = all.get(displayTitle)
      if (id) return id
    }
    throw err
  }
}

async function createPersonaSkills(): Promise<string[]> {
  const existing = await findExistingPersonaSkills()
  const ids: string[] = []
  for (const name of ['get_my_persona', 'update_persona', 'publish_to_channel', 'generate_swipe_card']) {
    ids.push(await createPersonaSkill(name, existing))
  }
  return ids
}

function toSkillParams(skillIds: string[]) {
  return skillIds.map(skillId => ({ type: 'custom' as const, skill_id: skillId }))
}

function isRecordReusable(record: UserAgentRecord, sessionKey: string): boolean {
  return Boolean(
    record.agentId &&
    record.environmentId &&
    (record as UserAgentRecord & { configVersion?: string }).configVersion === PERSONA_AGENT_CONFIG_VERSION &&
    (record as UserAgentRecord & { skillIds?: string[] }).skillIds?.length &&
    record.sessions.find(s => s.key === sessionKey),
  )
}

export async function initPersonaManagedAgentSession(
  uid: string,
  scope: 'chat' | 'card' = 'chat',
): Promise<string> {
  const now = Date.now()
  const sessionKey = `${uid}:${scope}`

  let record = await getUserAgentRecord(PERSONA_AGENT_UID) as (UserAgentRecord & { configVersion?: string; skillIds?: string[] }) | undefined

  if (!record) {
    record = {
      uid: PERSONA_AGENT_UID,
      model: PERSONA_AGENT_MODEL,
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
    console.log(`[Persona Agent] Reusing session for ${uid}: ${reusableSession.sessionId}`)
    return reusableSession.sessionId
  }

  let skillIds = record.skillIds
  if (!skillIds?.length || record.configVersion !== PERSONA_AGENT_CONFIG_VERSION) {
    skillIds = await createPersonaSkills()
    console.log(`[Persona Agent] Skills uploaded: ${skillIds.join(', ')}`)
  }

  let agentId = record.agentId
  if (!agentId) {
    const agent = await client.beta.agents.create({
      name: 'MATCHA Persona Agent',
      model: PERSONA_AGENT_MODEL,
      system: PERSONA_AGENT_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: [
        ...PERSONA_CUSTOM_TOOLS,
        {
          type: 'agent_toolset_20260401' as const,
          configs: [{ name: 'read' as const, enabled: true }],
        },
      ],
    })
    agentId = agent.id
    console.log(`[Persona Agent] Agent created: ${agentId}`)
  } else {
    const agent = await client.beta.agents.retrieve(agentId)
    await client.beta.agents.update(agentId, {
      version: agent.version,
      model: PERSONA_AGENT_MODEL,
      system: PERSONA_AGENT_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: [
        ...PERSONA_CUSTOM_TOOLS,
        {
          type: 'agent_toolset_20260401' as const,
          configs: [{ name: 'read' as const, enabled: true }],
        },
      ],
    })
    console.log(`[Persona Agent] Agent updated: ${agentId}`)
  }

  let environmentId = record.environmentId
  if (!environmentId) {
    const environment = await client.beta.environments.create({
      name: 'matcha-persona-agent-env',
      config: { type: 'cloud', networking: { type: 'unrestricted' } },
    })
    environmentId = environment.id
    console.log(`[Persona Agent] Environment created: ${environmentId}`)
  }

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: `MATCHA Persona Agent Session (${uid}:${scope})`,
  })

  await upsertUserAgentRecord({
    ...record,
    agentId,
    environmentId,
    skillIds,
    configVersion: PERSONA_AGENT_CONFIG_VERSION,
    model: PERSONA_AGENT_MODEL,
    sessions: upsertSession(record.sessions, {
      key: sessionKey,
      sessionId: session.id,
      title: `MATCHA Persona Agent Session (${uid})`,
      createdAt: now,
      updatedAt: now,
    }),
    updatedAt: now,
  } as UserAgentRecord & { configVersion: string; skillIds: string[] })

  console.log(`[Persona Agent] Session created for ${uid}: ${session.id}`)
  return session.id
}
