import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import { File } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getGovernmentAgentRecord,
  upsertGovernmentAgentRecord,
  upsertSession,
  type GovernmentAgentRecord,
} from '../general/agentRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

if (!globalThis.File) {
  globalThis.File = File as unknown as typeof globalThis.File
}

const GOV_AGENT_MODEL = 'claude-haiku-4-5'
const GOV_AGENT_CONFIG_VERSION = 'persist-v1'
const DEFAULT_AGENCY_ID = 'taipei-youth-dept'
const DEFAULT_AGENCY_NAME = '臺北市青年局'
const DEFAULT_SESSION_KEY = 'default'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export { client }

const GOV_AGENT_SYSTEM_PROMPT = `你是 MATCHA 的 Government Resource Agent。
你的任務是在 channel 更新時，代表單一政府資源主動判斷是否應該媒合使用者。

請遵守：
1. 不要捏造使用者沒有提供的資料。
2. 如果資格條件缺少關鍵資訊，請填入 missingInfo。
3. score 必須是 0 到 100 的整數。
4. 只有明顯值得主動推薦時 eligible 才能是 true。
5. 需要資料時，自己呼叫 read_channel、query_resource_pdf custom tools。
6. query_resource_pdf 只會回傳你這個 resource agent 被授權看到的單一政府資源與其文件文字。
7. 不要嘗試查詢或媒合其他 resourceId。
8. 如果不需要回應，最後只回傳 null。
9. 如果需要回應，最後只回傳 MatchDecision JSON；後端 pipeline 會負責建立並寫入 ChannelReply。
10. 不要呼叫任何寫入資料庫的工具。
11. 最終回應只能是 JSON 或 null，不要使用 markdown，不要加解釋文字。

回應 JSON 格式：
{
  "eligible": true,
  "score": 0,
  "reason": "推薦理由",
  "missingInfo": []
}`

const GOV_CUSTOM_TOOLS = [
  {
    name: 'read_channel',
    type: 'custom' as const,
    description: 'Read recent channel messages from the central channel. Use this to inspect channel updates before deciding whether to match.',
    input_schema: {
      type: 'object' as const,
      properties: {
        since: { type: 'number', description: 'Optional unix ms timestamp. Only messages newer than this are returned.' },
        limit: { type: 'number', description: 'Optional max number of messages to return.' },
      },
    },
  },
  {
    name: 'query_resource_pdf',
    type: 'custom' as const,
    description: 'Query the single government resource and document text bound to this resource agent. Use before evaluating eligibility or fit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeDetails: { type: 'boolean', description: 'Optional. Return full resource details when available.' },
      },
    },
  },
]

async function findExistingSkills(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for await (const skill of client.beta.skills.list()) {
    if (skill.display_title?.startsWith('MATCHA Gov ')) {
      map.set(skill.display_title, skill.id)
    }
  }
  return map
}

async function createGovSkill(skillName: string, existing: Map<string, string>): Promise<string> {
  const displayTitle = `MATCHA Gov ${skillName} (${GOV_AGENT_CONFIG_VERSION})`
  const existingId = existing.get(displayTitle)
  if (existingId) {
    return existingId
  }

  const skillPath = path.join(__dirname, 'skills', skillName, 'SKILL.md')
  const content = await readFile(skillPath, 'utf8')
  const file = await Anthropic.toFile(Buffer.from(content, 'utf8'), `${skillName}/SKILL.md`)
  const skill = await client.beta.skills.create({
    display_title: displayTitle,
    files: [file],
  })

  return skill.id
}

async function createGovSkills(): Promise<string[]> {
  const existing = await findExistingSkills()
  return Promise.all([
    createGovSkill('read_channel', existing),
    createGovSkill('query_resource_pdf', existing),
  ])
}

function toSkillParams(skillIds: string[]) {
  return skillIds.map(skillId => ({
    type: 'custom' as const,
    skill_id: skillId,
  }))
}

function isRecordReusable(record: GovernmentAgentRecord, sessionKey: string): boolean {
  return Boolean(
    record.agentId &&
    record.environmentId &&
    record.configVersion === GOV_AGENT_CONFIG_VERSION &&
    record.skillIds?.length &&
    record.sessions.find(session => session.key === sessionKey),
  )
}

export interface InitGovManagedAgentSessionOptions {
  agencyId?: string
  agencyName?: string
  resourceId?: string
  resourceName?: string
  sessionKey?: string
}

export async function initGovManagedAgentSession(options: InitGovManagedAgentSessionOptions = {}): Promise<string> {
  const agencyId = options.agencyId ?? DEFAULT_AGENCY_ID
  const agencyName = options.agencyName ?? DEFAULT_AGENCY_NAME
  const resourceId = options.resourceId
  const resourceName = options.resourceName
  const sessionKey = options.sessionKey ?? DEFAULT_SESSION_KEY
  const now = Date.now()
  const agentScope = resourceId ? `${agencyId}:${resourceId}` : agencyId
  const agentScopeSlug = agentScope.replace(/[^a-zA-Z0-9-_]/g, '-')
  const displayName = resourceName ? `${resourceName} (${resourceId})` : agentScope

  let record = await getGovernmentAgentRecord(agencyId, resourceId)

  if (!record) {
    record = {
      agencyId,
      agencyName,
      resourceId,
      resourceName,
      model: GOV_AGENT_MODEL,
      sessions: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  const reusableSession = record.sessions.find(session => session.key === sessionKey)
  if (isRecordReusable(record, sessionKey) && reusableSession) {
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

  let skillIds = record.skillIds
  if (!skillIds?.length || record.configVersion !== GOV_AGENT_CONFIG_VERSION) {
    skillIds = await createGovSkills()
    console.log(`[Gov Agent] Skills uploaded: ${skillIds.join(', ')}`)
  }

  let agentId = record.agentId
  if (!agentId) {
    const agent = await client.beta.agents.create({
      name: `MATCHA Gov Resource Agent (${displayName})`,
      model: GOV_AGENT_MODEL,
      system: GOV_AGENT_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: [
        ...GOV_CUSTOM_TOOLS,
        {
          type: 'agent_toolset_20260401' as const,
          configs: [{ name: 'read' as const, enabled: true }],
        },
      ],
    })
    agentId = agent.id
    console.log(`[Gov Agent] Agent created for ${agentScope}: ${agentId}`)
  } else {
    const agent = await client.beta.agents.retrieve(agentId)
    await client.beta.agents.update(agentId, {
      version: agent.version,
      model: GOV_AGENT_MODEL,
      system: GOV_AGENT_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: [
        ...GOV_CUSTOM_TOOLS,
        {
          type: 'agent_toolset_20260401' as const,
          configs: [{ name: 'read' as const, enabled: true }],
        },
      ],
    })
    console.log(`[Gov Agent] Agent updated with skills/tools for ${agentScope}: ${agentId}`)
  }

  let environmentId = record.environmentId
  if (!environmentId) {
    const environment = await client.beta.environments.create({
      name: `matcha-gov-agent-env-${agentScopeSlug}`,
      config: {
        type: 'cloud',
        networking: { type: 'unrestricted' },
      },
    })
    environmentId = environment.id
    console.log(`[Gov Agent] Environment created for ${agentScope}: ${environmentId}`)
  } else {
    console.log(`[Gov Agent] Reusing environment for ${agentScope}: ${environmentId}`)
  }

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: `gov-${(resourceId ?? agencyId).slice(0, 30)}-${sessionKey}`.slice(0, 64),
  })

  const nextRecord: GovernmentAgentRecord = {
    ...record,
    agencyName,
    resourceId,
    resourceName,
    agentId,
    environmentId,
    skillIds,
    configVersion: GOV_AGENT_CONFIG_VERSION,
    model: GOV_AGENT_MODEL,
    sessions: upsertSession(record.sessions, {
      key: sessionKey,
      sessionId: session.id,
      title: `gov-${(resourceId ?? agencyId).slice(0, 30)}-${sessionKey}`.slice(0, 64),
      createdAt: now,
      updatedAt: now,
    }),
    updatedAt: now,
  }

  await upsertGovernmentAgentRecord(nextRecord)

  console.log(`[Gov Agent] Session created for ${agentScope}: ${session.id}`)
  return session.id
}
