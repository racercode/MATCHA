import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateKey } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const hasFirebaseEnv = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY,
)

function normalizePrivateKey(rawKey: string): string {
  const key = rawKey.replace(/\\n/g, '\n').trim()
  if (key.includes('-----BEGIN PRIVATE KEY-----')) return key
  const body = key.replace(/\s+/g, '')
  const wrappedBody = body.match(/.{1,64}/g)?.join('\n') ?? body
  return `-----BEGIN PRIVATE KEY-----\n${wrappedBody}\n-----END PRIVATE KEY-----\n`
}

function getFirebaseSkipReason(): string | false {
  if (!hasFirebaseEnv) return 'Firebase Admin env is not configured'
  try {
    createPrivateKey(normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY ?? ''))
    return false
  } catch {
    return 'FIREBASE_PRIVATE_KEY is not a valid private key'
  }
}

const firebaseSkipReason = getFirebaseSkipReason()
const testRunId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
const resourceIdA = `rid-test-a-${testRunId}`
const resourceIdB = `rid-test-b-${testRunId}`

describe('matchStatsRepo', () => {
  after(async () => {
    if (firebaseSkipReason) return
    const { db } = await import('./firebase.js')
    await Promise.allSettled([
      db.collection('match_stats').doc(resourceIdA).delete(),
      db.collection('match_stats').doc(resourceIdB).delete(),
    ])
  })

  it(
    'recordMatchAttempt increments totalAttempts on miss',
    { skip: firebaseSkipReason },
    async () => {
      const { recordMatchAttempt, getMatchStats } = await import('./matchStatsRepo.js')

      await recordMatchAttempt(resourceIdA, false, {
        agencyId: 'test-agency',
        resourceName: 'Test Resource A',
      })

      const stats = await getMatchStats(resourceIdA)
      assert.ok(stats)
      assert.equal(stats.resourceId, resourceIdA)
      assert.equal(stats.totalAttempts, 1)
      assert.equal(stats.totalMatches, 0)
    },
  )

  it(
    'recordMatchAttempt increments totalMatches on match',
    { skip: firebaseSkipReason },
    async () => {
      const { recordMatchAttempt, getMatchStats } = await import('./matchStatsRepo.js')

      await recordMatchAttempt(resourceIdA, true, {
        agencyId: 'test-agency',
        resourceName: 'Test Resource A',
      })

      const stats = await getMatchStats(resourceIdA)
      assert.ok(stats)
      assert.equal(stats.totalAttempts, 2)
      assert.equal(stats.totalMatches, 1)
    },
  )

  it(
    'multiple attempts accumulate correctly',
    { skip: firebaseSkipReason },
    async () => {
      const { recordMatchAttempt, getMatchStats } = await import('./matchStatsRepo.js')

      await recordMatchAttempt(resourceIdA, true, {
        agencyId: 'test-agency',
        resourceName: 'Test Resource A',
      })
      await recordMatchAttempt(resourceIdA, false, {
        agencyId: 'test-agency',
        resourceName: 'Test Resource A',
      })

      const stats = await getMatchStats(resourceIdA)
      assert.ok(stats)
      assert.equal(stats.totalAttempts, 4)
      assert.equal(stats.totalMatches, 2)
    },
  )

  it(
    'getAllMatchStats returns stats for multiple resources',
    { skip: firebaseSkipReason },
    async () => {
      const { recordMatchAttempt, getAllMatchStats } = await import('./matchStatsRepo.js')

      await recordMatchAttempt(resourceIdB, true, {
        agencyId: 'test-agency',
        resourceName: 'Test Resource B',
      })

      const allStats = await getAllMatchStats()
      const statsA = allStats.find(s => s.resourceId === resourceIdA)
      const statsB = allStats.find(s => s.resourceId === resourceIdB)

      assert.ok(statsA)
      assert.ok(statsB)
      assert.equal(statsA.totalAttempts, 4)
      assert.equal(statsA.totalMatches, 2)
      assert.equal(statsB.totalAttempts, 1)
      assert.equal(statsB.totalMatches, 1)
    },
  )

  it(
    'getMatchStats returns null for non-existent resource',
    { skip: firebaseSkipReason },
    async () => {
      const { getMatchStats } = await import('./matchStatsRepo.js')
      const stats = await getMatchStats('rid-does-not-exist')
      assert.equal(stats, null)
    },
  )
})
