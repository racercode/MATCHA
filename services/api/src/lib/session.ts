import { redis } from './redis.js'

const SESSION_TTL_SECONDS = 60 * 60 * 24 // 24h sliding

export type AgentType = 'persona' | 'gov' | 'coffee'

function key(agentType: AgentType, uid: string) {
  return `session:${agentType}:${uid}`
}

export async function getSession(agentType: AgentType, uid: string): Promise<string | null> {
  const k = key(agentType, uid)
  const sessionId = await redis.get(k)
  if (sessionId) await redis.expire(k, SESSION_TTL_SECONDS) // refresh TTL on access
  return sessionId
}

export async function setSession(agentType: AgentType, uid: string, sessionId: string): Promise<void> {
  await redis.set(key(agentType, uid), sessionId, 'EX', SESSION_TTL_SECONDS)
}

export async function deleteSession(agentType: AgentType, uid: string): Promise<void> {
  await redis.del(key(agentType, uid))
}
