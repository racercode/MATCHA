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
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') })

if (!globalThis.File) {
  globalThis.File = File as unknown as typeof globalThis.File
}

const GOV_AGENT_MODEL = 'claude-haiku-4-5'
const GOV_AGENT_CONFIG_VERSION = 'gov-custom-tools-v2'
const DEFAULT_AGENCY_ID = 'taipei-youth-dept'
const DEFAULT_AGENCY_NAME = '臺北市青年局'
const DEFAULT_SESSION_KEY = 'default'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export { client }

const GOV_AGENT_SYSTEM_PROMPT = `你是 MATCHA 的 Government Resource Agent。
你的任務是在 channel 更新時，自主使用 Markdown Skills 與 custom tools 判斷是否應該主動媒合。

請遵守：
1. 不要捏造使用者沒有提供的資料。
2. 如果資格條件缺少關鍵資訊，請填入 missingInfo。
3. score 必須是 0 到 100 的整數。
4. 只有明顯值得主動推薦時 eligible 才能是 true。
5. 需要資料時，自己呼叫 read_channel、query_program_docs、propose_match custom tools。
6. 如果不需要回應，最後只回傳 null。
7. 如果需要回應，請先呼叫 propose_match，最後只回傳 propose_match 的結果 JSON。
8. 最終回應只能是 JSON 或 null，不要使用 markdown，不要加解釋文字。

回應 JSON 格式：
{
  "respond": true,
  "thread": {},
  "initialMessage": {}
}`

const GOV_CUSTOM_TOOLS = [
  {
    name: 'read_channel',
    type: 'custom' as const,
    description: 'Read recent persona broadcasts from the central channel. Use this to inspect channel updates before deciding whether to match.',
    input_schema: {
      type: 'object' as const,
      properties: {
        since: { type: 'number', description: 'Optional unix ms timestamp. Only broadcasts newer than this are returned.' },
        limit: { type: 'number', description: 'Optional max number of broadcasts to return.' },
      },
    },
  },
  {
    name: 'query_program_docs',
    type: 'custom' as const,
    description: 'Query government resources for an agency, optionally scoped to one resource. Use before evaluating eligibility or fit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agencyId: { type: 'string', description: 'Government agency id.' },
        resourceId: { type: 'string', description: 'Optional resource id.' },
      },
      required: ['agencyId'],
    },
  },
  {
    name: 'propose_match',
    type: 'custom' as const,
    description: 'Create a draft gov_user AgentThread and initial ThreadMessage after deciding the match is eligible and score is high enough.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assessment: {
          type: 'object',
          description: 'MatchAssessment containing broadcast, resource, and decision.',
          properties: {
            broadcast: { type: 'object', description: 'The ChannelBroadcast being evaluated.' },
            resource: { type: 'object', description: 'The GovernmentResource being matched.' },
            decision: {
              type: 'object',
              description: 'MatchDecision with the evaluation result.',
              properties: {
                eligible: { type: 'boolean', description: 'Whether the user is eligible for this resource.' },
                score: { type: 'number', description: 'Match score from 0 to 100.' },
                reason: { type: 'string', description: 'Why this match is or is not suitable.' },
                missingInfo: { type: 'array', items: { type: 'string' }, description: 'Information still needed from the user.' },
                suggestedFirstMessage: { type: 'string', description: 'A suggested first message to send to the user in Traditional Chinese.' },
              },
              required: ['eligible', 'score', 'reason', 'suggestedFirstMessage'],
            },
          },
          required: ['broadcast', 'resource', 'decision'],
        },
      },
      required: ['assessment'],
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
  const displayTitle = `MATCHA Gov ${skillName}`
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
    createGovSkill('query_program_docs', existing),
    createGovSkill('propose_match', existing),
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
      name: `MATCHA Gov Match Agent (${agencyId})`,
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
    console.log(`[Gov Agent] Agent created: ${agentId}`)
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
    console.log(`[Gov Agent] Agent updated with skills/tools: ${agentId}`)
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
    skillIds,
    configVersion: GOV_AGENT_CONFIG_VERSION,
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
