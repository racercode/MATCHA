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
export const GOV_AGENT_CONFIG_VERSION = 'persist-v2'
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
2. 如果使用者可能不符合部分資格條件（eligibilityCriteria），將這些條件列入 missingInfo，並說明使用者可能不符合的原因。
3. score 必須是 0 到 100 的整數。
4. 採取寬鬆媒合策略：只要資源的主題、類型與使用者的需求或情境相關，即使部分資格條件（如年齡、身份、戶籍等）可能不完全符合，eligible 仍應設為 true。eligibilityCriteria 不符合不代表不能推薦，只需在 missingInfo 中誠實列出可能未符合的條件即可。
5. 需要資料時，自己呼叫 query_resource_document custom tool。
6. query_resource_document 只會回傳你這個 resource agent 被授權看到的單一政府資源與其文件文字。
7. 不要嘗試查詢或媒合其他 resourceId。
8. 永遠回傳 MatchDecision JSON，不要回傳 null。即使資源與使用者完全無關，也回傳 score 為 0 的 MatchDecision，並在 reason 說明為何不相關、在 missingInfo 列出未符合的條件。
9. 後端 pipeline 會負責根據 score 決定是否建立 ChannelReply。
10. 不要呼叫任何寫入資料庫的工具。
11. 最終回應只能是 MatchDecision JSON，不要使用 markdown，不要加解釋文字。
12. reason 欄位中請包含推薦理由，如果有未符合的資格條件，也請在 reason 中提醒使用者注意哪些條件可能需要確認。

回應 JSON 格式：
{
  "eligible": true/false,
  "score": 0-100,
  "reason": "推薦理由或不相關原因（若有未符合資格條件，請一併說明）",
  "missingInfo": ["可能未符合的條件1", "可能未符合的條件2"]
}`

const GOV_FOLLOWUP_SYSTEM_PROMPT = `你是 MATCHA 的 Government Resource Agent，目前處於「追問回答」模式。
使用者已收到這個政府資源的媒合通知，現在想進一步了解細節。

請遵守：
1. 只回答與此綁定資源相關的問題。
2. 用 query_resource_document 查詢資源文件來回答，確保回答有依據。
3. 不要捏造資料，如果文件中找不到答案，誠實告知使用者你無法確認，建議他們聯繫承辦單位。
4. 用友善、易懂的語氣回答，像是一位熱心的政府服務人員。
5. 回答用純文字，不要回傳 JSON。
6. 不要呼叫任何寫入資料庫的工具。`

export { GOV_FOLLOWUP_SYSTEM_PROMPT }

const GOV_CUSTOM_TOOLS = [
  {
    name: 'query_resource_document',
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

async function listAllSkills(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for await (const skill of client.beta.skills.list()) {
    if (skill.display_title) map.set(skill.display_title, skill.id)
  }
  return map
}

async function findExistingSkills(): Promise<Map<string, string>> {
  const all = await listAllSkills()
  const map = new Map<string, string>()
  for (const [title, id] of all) {
    if (title.startsWith('MATCHA Gov ')) map.set(title, id)
  }
  return map
}

// Module-level cache: all Gov resource agents share the same two skills
let sharedSkillIdsPromise: Promise<string[]> | null = null

async function createGovSkill(skillName: string, existing: Map<string, string>): Promise<string> {
  const displayTitle = `MATCHA Gov ${skillName} (${GOV_AGENT_CONFIG_VERSION})`
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

async function createGovSkills(): Promise<string[]> {
  if (!sharedSkillIdsPromise) {
    sharedSkillIdsPromise = (async () => {
      const existing = await findExistingSkills()
      return Promise.all([
        createGovSkill('query_resource_document', existing),
      ])
    })().catch(err => { sharedSkillIdsPromise = null; throw err })
  }
  return sharedSkillIdsPromise
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

function isFollowUpReusable(record: GovernmentAgentRecord, sessionKey: string): boolean {
  return Boolean(
    record.followUpAgentId &&
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

export async function initGovFollowUpSession(options: InitGovManagedAgentSessionOptions = {}): Promise<string> {
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
  if (isFollowUpReusable(record, sessionKey) && reusableSession) {
    await upsertGovernmentAgentRecord({
      ...record,
      sessions: upsertSession(record.sessions, {
        ...reusableSession,
        updatedAt: now,
      }),
      updatedAt: now,
    })
    console.log(`[Gov FollowUp] Reusing session: ${reusableSession.sessionId}`)
    return reusableSession.sessionId
  }

  let skillIds = record.skillIds
  if (!skillIds?.length || record.configVersion !== GOV_AGENT_CONFIG_VERSION) {
    skillIds = await createGovSkills()
    console.log(`[Gov FollowUp] Skills uploaded: ${skillIds.join(', ')}`)
  }

  let followUpAgentId = record.followUpAgentId
  if (!followUpAgentId) {
    const agent = await client.beta.agents.create({
      name: `MATCHA Gov FollowUp Agent (${displayName})`,
      model: GOV_AGENT_MODEL,
      system: GOV_FOLLOWUP_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: [
        ...GOV_CUSTOM_TOOLS,
        {
          type: 'agent_toolset_20260401' as const,
          configs: [{ name: 'read' as const, enabled: true }],
        },
      ],
    })
    followUpAgentId = agent.id
    console.log(`[Gov FollowUp] Agent created for ${agentScope}: ${followUpAgentId}`)
  } else {
    const agent = await client.beta.agents.retrieve(followUpAgentId)
    await client.beta.agents.update(followUpAgentId, {
      version: agent.version,
      model: GOV_AGENT_MODEL,
      system: GOV_FOLLOWUP_SYSTEM_PROMPT,
      skills: toSkillParams(skillIds),
      tools: [
        ...GOV_CUSTOM_TOOLS,
        {
          type: 'agent_toolset_20260401' as const,
          configs: [{ name: 'read' as const, enabled: true }],
        },
      ],
    })
    console.log(`[Gov FollowUp] Agent updated for ${agentScope}: ${followUpAgentId}`)
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
    console.log(`[Gov FollowUp] Environment created for ${agentScope}: ${environmentId}`)
  } else {
    console.log(`[Gov FollowUp] Reusing environment for ${agentScope}: ${environmentId}`)
  }

  const session = await client.beta.sessions.create({
    agent: followUpAgentId,
    environment_id: environmentId,
    title: `followup-${(resourceId ?? agencyId).slice(0, 30)}-${sessionKey}`.slice(0, 64),
  })

  const nextRecord: GovernmentAgentRecord = {
    ...record,
    agencyName,
    resourceId,
    resourceName,
    followUpAgentId,
    environmentId,
    skillIds,
    configVersion: GOV_AGENT_CONFIG_VERSION,
    model: GOV_AGENT_MODEL,
    sessions: upsertSession(record.sessions, {
      key: sessionKey,
      sessionId: session.id,
      title: `followup-${(resourceId ?? agencyId).slice(0, 30)}-${sessionKey}`.slice(0, 64),
      createdAt: now,
      updatedAt: now,
    }),
    updatedAt: now,
  }

  await upsertGovernmentAgentRecord(nextRecord)

  console.log(`[Gov FollowUp] Session created for ${agentScope}: ${session.id}`)
  return session.id
}
