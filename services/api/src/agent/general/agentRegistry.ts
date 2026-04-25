import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
  resourceId?: string
  resourceName?: string
  agentId?: string
  environmentId?: string
  skillIds?: string[]
  configVersion?: string
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
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as RegistryFile<T>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { agents: [] }
    }
    throw err
  }
}

async function writeRegistry<T>(filePath: string, registry: RegistryFile<T>): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
}

export async function getGovernmentAgentRecord(
  agencyId: string,
  resourceId?: string,
): Promise<GovernmentAgentRecord | undefined> {
  const registry = await readRegistry<GovernmentAgentRecord>(GOVERNMENT_AGENTS_PATH)
  return registry.agents.find(agent => agent.agencyId === agencyId && agent.resourceId === resourceId)
}

export async function upsertGovernmentAgentRecord(record: GovernmentAgentRecord): Promise<GovernmentAgentRecord> {
  const registry = await readRegistry<GovernmentAgentRecord>(GOVERNMENT_AGENTS_PATH)
  const index = registry.agents.findIndex(
    agent => agent.agencyId === record.agencyId && agent.resourceId === record.resourceId,
  )
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

export async function clearUserAgentSessions(
  registryUid: string,
  matcher: (session: ManagedAgentSessionRecord) => boolean,
): Promise<number> {
  const registry = await readRegistry<UserAgentRecord>(USER_AGENTS_PATH)
  const index = registry.agents.findIndex(agent => agent.uid === registryUid)

  if (index < 0) return 0

  const record = registry.agents[index]
  const nextSessions = record.sessions.filter(session => !matcher(session))
  const removedCount = record.sessions.length - nextSessions.length

  if (removedCount === 0) return 0

  registry.agents[index] = {
    ...record,
    sessions: nextSessions,
    updatedAt: Date.now(),
  }

  await writeRegistry(USER_AGENTS_PATH, registry)
  return removedCount
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
