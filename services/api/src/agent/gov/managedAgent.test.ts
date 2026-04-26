import { describe, it, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initGovFollowUpSession, GOV_AGENT_CONFIG_VERSION, client } from './managedAgent.js'
import {
  getGovernmentAgentRecord,
  upsertGovernmentAgentRecord,
  type GovernmentAgentRecord,
} from '../general/agentRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REGISTRY_PATH = path.join(__dirname, '../general/governmentAgents.json')

const TEST_AGENCY_ID = '__test-followup-agency__'
const TEST_RESOURCE_ID = '__test-followup-resource__'
const KNOWN_SESSION_ID = 'test-known-session-reuse-001'
const SESSION_KEY = 'followup-reply-test-001'

async function removeTestRecords() {
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf8')
    const registry = JSON.parse(raw)
    registry.agents = registry.agents.filter(
      (a: { agencyId: string; resourceId?: string }) =>
        a.agencyId !== TEST_AGENCY_ID,
    )
    await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  } catch {}
}

async function seedTestRecord(extraSessions: GovernmentAgentRecord['sessions'] = []): Promise<void> {
  const now = Date.now()
  await upsertGovernmentAgentRecord({
    agencyId: TEST_AGENCY_ID,
    agencyName: 'Test Agency',
    resourceId: TEST_RESOURCE_ID,
    resourceName: 'Test Resource',
    followUpAgentId: 'test-followup-agent-id',
    environmentId: 'test-env-id',
    skillIds: ['test-skill-id'],
    configVersion: GOV_AGENT_CONFIG_VERSION,
    model: 'claude-haiku-4-5',
    sessions: [
      {
        key: SESSION_KEY,
        sessionId: KNOWN_SESSION_ID,
        title: 'test followup session',
        createdAt: now,
        updatedAt: now,
      },
      ...extraSessions,
    ],
    createdAt: now,
    updatedAt: now,
  })
}

// ---------------------------------------------------------------------------
// initGovFollowUpSession — session reuse (no Anthropic API calls needed)
// ---------------------------------------------------------------------------

describe('initGovFollowUpSession — multi-turn session reuse', () => {
  before(async () => {
    await removeTestRecords()
    await seedTestRecord()
  })

  after(async () => {
    await removeTestRecords()
  })

  it('returns cached sessionId when followUpAgentId + sessionKey match', async () => {
    const sessionId = await initGovFollowUpSession({
      agencyId: TEST_AGENCY_ID,
      resourceId: TEST_RESOURCE_ID,
      sessionKey: SESSION_KEY,
    })

    assert.equal(sessionId, KNOWN_SESSION_ID)
  })

  it('returns same sessionId on repeated calls (multi-turn)', async () => {
    const id1 = await initGovFollowUpSession({
      agencyId: TEST_AGENCY_ID,
      resourceId: TEST_RESOURCE_ID,
      sessionKey: SESSION_KEY,
    })
    const id2 = await initGovFollowUpSession({
      agencyId: TEST_AGENCY_ID,
      resourceId: TEST_RESOURCE_ID,
      sessionKey: SESSION_KEY,
    })
    const id3 = await initGovFollowUpSession({
      agencyId: TEST_AGENCY_ID,
      resourceId: TEST_RESOURCE_ID,
      sessionKey: SESSION_KEY,
    })

    assert.equal(id1, KNOWN_SESSION_ID)
    assert.equal(id2, KNOWN_SESSION_ID)
    assert.equal(id3, KNOWN_SESSION_ID)
  })

  it('updates updatedAt and preserves followUpAgentId on reuse', async () => {
    const before = (await getGovernmentAgentRecord(TEST_AGENCY_ID, TEST_RESOURCE_ID))!
    const beforeUpdatedAt = before.sessions.find(s => s.key === SESSION_KEY)!.updatedAt

    await new Promise(resolve => setTimeout(resolve, 15))

    await initGovFollowUpSession({
      agencyId: TEST_AGENCY_ID,
      resourceId: TEST_RESOURCE_ID,
      sessionKey: SESSION_KEY,
    })

    const after = (await getGovernmentAgentRecord(TEST_AGENCY_ID, TEST_RESOURCE_ID))!
    const afterSession = after.sessions.find(s => s.key === SESSION_KEY)!

    assert.ok(afterSession.updatedAt > beforeUpdatedAt)
    assert.equal(after.followUpAgentId, 'test-followup-agent-id')
  })
})

// ---------------------------------------------------------------------------
// initGovFollowUpSession — new sessionKey creates new session
// ---------------------------------------------------------------------------

describe('initGovFollowUpSession — different replyId creates new session', () => {
  const NEW_SESSION_KEY = 'followup-reply-test-002'
  const MOCK_NEW_SESSION_ID = 'mock-newly-created-session-id'

  before(async () => {
    await removeTestRecords()
    await seedTestRecord()

    mock.method(client.beta.agents, 'retrieve', async () => ({
      id: 'test-followup-agent-id',
      version: 1,
    }))
    mock.method(client.beta.agents, 'update', async () => ({}))
    mock.method(client.beta.sessions, 'create', async () => ({
      id: MOCK_NEW_SESSION_ID,
    }))
  })

  after(async () => {
    mock.restoreAll()
    await removeTestRecords()
  })

  it('creates new session for a different sessionKey', async () => {
    const sessionId = await initGovFollowUpSession({
      agencyId: TEST_AGENCY_ID,
      resourceId: TEST_RESOURCE_ID,
      sessionKey: NEW_SESSION_KEY,
    })

    assert.equal(sessionId, MOCK_NEW_SESSION_ID)
  })

  it('does not overwrite the original session', async () => {
    const record = await getGovernmentAgentRecord(TEST_AGENCY_ID, TEST_RESOURCE_ID)
    assert.ok(record)

    const originalSession = record!.sessions.find(s => s.key === SESSION_KEY)
    assert.ok(originalSession)
    assert.equal(originalSession!.sessionId, KNOWN_SESSION_ID)

    const newSession = record!.sessions.find(s => s.key === NEW_SESSION_KEY)
    assert.ok(newSession)
    assert.equal(newSession!.sessionId, MOCK_NEW_SESSION_ID)
  })

  it('reuses followUpAgentId (does not create new agent)', async () => {
    const record = await getGovernmentAgentRecord(TEST_AGENCY_ID, TEST_RESOURCE_ID)
    assert.equal(record!.followUpAgentId, 'test-followup-agent-id')

    assert.equal(
      (client.beta.agents.create as { mock?: { callCount: () => number } }).mock?.callCount(),
      undefined,
      'agents.create should not have been called',
    )
  })
})

// ---------------------------------------------------------------------------
// initGovFollowUpSession — no record exists (first call creates everything)
// ---------------------------------------------------------------------------

describe('initGovFollowUpSession — first call for unknown resource', () => {
  const FRESH_AGENCY = '__test-followup-fresh-agency__'
  const FRESH_RESOURCE = '__test-followup-fresh-resource__'
  const MOCK_AGENT_ID = 'mock-fresh-followup-agent-id'
  const MOCK_ENV_ID = 'mock-fresh-env-id'
  const MOCK_SESSION_ID = 'mock-fresh-session-id'
  const MOCK_SKILL_ID = 'mock-fresh-skill-id'

  async function removeFreshRecords() {
    try {
      const raw = await readFile(REGISTRY_PATH, 'utf8')
      const registry = JSON.parse(raw)
      registry.agents = registry.agents.filter(
        (a: { agencyId: string }) => a.agencyId !== FRESH_AGENCY,
      )
      await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
    } catch {}
  }

  before(async () => {
    await removeFreshRecords()

    mock.method(client.beta.skills, 'list', () => ({
      [Symbol.asyncIterator]() {
        return { async next() { return { done: true, value: undefined } } }
      },
    }))
    mock.method(client.beta.skills, 'create', async () => ({ id: MOCK_SKILL_ID }))
    mock.method(client.beta.agents, 'create', async () => ({ id: MOCK_AGENT_ID }))
    mock.method(client.beta.environments, 'create', async () => ({ id: MOCK_ENV_ID }))
    mock.method(client.beta.sessions, 'create', async () => ({ id: MOCK_SESSION_ID }))
  })

  after(async () => {
    mock.restoreAll()
    await removeFreshRecords()
  })

  it('creates agent, environment, session and persists record', async () => {
    const sessionId = await initGovFollowUpSession({
      agencyId: FRESH_AGENCY,
      resourceId: FRESH_RESOURCE,
      resourceName: 'Fresh Test Resource',
      sessionKey: 'followup-reply-fresh-001',
    })

    assert.equal(sessionId, MOCK_SESSION_ID)

    const record = await getGovernmentAgentRecord(FRESH_AGENCY, FRESH_RESOURCE)
    assert.ok(record)
    assert.equal(record!.followUpAgentId, MOCK_AGENT_ID)
    assert.equal(record!.environmentId, MOCK_ENV_ID)
    assert.equal(record!.configVersion, GOV_AGENT_CONFIG_VERSION)
    assert.ok(record!.skillIds!.length > 0)

    const session = record!.sessions.find(s => s.key === 'followup-reply-fresh-001')
    assert.ok(session)
    assert.equal(session!.sessionId, MOCK_SESSION_ID)
  })

  it('second call reuses the persisted session', async () => {
    const sessionId = await initGovFollowUpSession({
      agencyId: FRESH_AGENCY,
      resourceId: FRESH_RESOURCE,
      sessionKey: 'followup-reply-fresh-001',
    })

    assert.equal(sessionId, MOCK_SESSION_ID)
  })
})
