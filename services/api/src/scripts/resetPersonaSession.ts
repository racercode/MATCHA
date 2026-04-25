import { clearUserAgentSessions } from '../agent/general/agentRegistry.js'

async function main() {
  const uid = process.argv[2]?.trim()

  if (!uid) {
    console.error('Usage: pnpm persona:reset-session <uid>')
    process.exit(1)
  }

  const removed = await clearUserAgentSessions(
    'persona-agent-shared',
    (session) => session.key === uid || session.key.startsWith(`${uid}:`),
  )

  console.log(
    removed > 0
      ? `[resetPersonaSession] Removed ${removed} persona session(s) for uid=${uid}`
      : `[resetPersonaSession] No persona sessions found for uid=${uid}`,
  )
}

main().catch((error) => {
  console.error('[resetPersonaSession] Failed:', error)
  process.exit(1)
})
