import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const GOVERNMENT_AGENTS_PATH = path.join(__dirname, 'governmentAgents.json')
const USER_AGENTS_PATH = path.join(__dirname, 'userAgents.json')

export interface ManagedAgentSessionRecord {
  key: string
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface GovernmentAgentRecord {
  agencyId: string
  agencyName: string
  agentId?: string
  environmentId?: string
  model: string
  sessions: ManagedAgentSessionRecord[]
  createdAt: number
  updatedAt: number
}

export interface UserAgentRecord {
  uid: string
  displayName?: string
  agentId?: string
  environmentId?: string
  model: string
  sessions: ManagedAgentSessionRecord[]
  createdAt: number
  updatedAt: number
}

interface RegistryFile<T> {
  agents: T[]
}

async function readRegistry<T>(filePath: string): Promise<RegistryFile<T>> {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as RegistryFile<T>
}

async function writeRegistry<T>(filePath: string, registry: RegistryFile<T>): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
}

export async function getGovernmentAgentRecord(agencyId: string): Promise<GovernmentAgentRecord | undefined> {
  const registry = await readRegistry<GovernmentAgentRecord>(GOVERNMENT_AGENTS_PATH)
  return registry.agents.find(agent => agent.agencyId === agencyId)
}

export async function upsertGovernmentAgentRecord(record: GovernmentAgentRecord): Promise<GovernmentAgentRecord> {
  const registry = await readRegistry<GovernmentAgentRecord>(GOVERNMENT_AGENTS_PATH)
  const index = registry.agents.findIndex(agent => agent.agencyId === record.agencyId)
  const nextRecord = { ...record, updatedAt: Date.now() }

  if (index >= 0) {
    registry.agents[index] = nextRecord
  } else {
    registry.agents.push(nextRecord)
  }

  await writeRegistry(GOVERNMENT_AGENTS_PATH, registry)
  return nextRecord
}

export async function getUserAgentRecord(uid: string): Promise<UserAgentRecord | undefined> {
  const registry = await readRegistry<UserAgentRecord>(USER_AGENTS_PATH)
  return registry.agents.find(agent => agent.uid === uid)
}

export async function upsertUserAgentRecord(record: UserAgentRecord): Promise<UserAgentRecord> {
  const registry = await readRegistry<UserAgentRecord>(USER_AGENTS_PATH)
  const index = registry.agents.findIndex(agent => agent.uid === record.uid)
  const nextRecord = { ...record, updatedAt: Date.now() }

  if (index >= 0) {
    registry.agents[index] = nextRecord
  } else {
    registry.agents.push(nextRecord)
  }

  await writeRegistry(USER_AGENTS_PATH, registry)
  return nextRecord
}

export function upsertSession(
  sessions: ManagedAgentSessionRecord[],
  session: ManagedAgentSessionRecord,
): ManagedAgentSessionRecord[] {
  const index = sessions.findIndex(existing => existing.key === session.key)
  if (index >= 0) {
    const next = [...sessions]
    next[index] = { ...session, updatedAt: Date.now() }
    return next
  }

  return [...sessions, session]
}
