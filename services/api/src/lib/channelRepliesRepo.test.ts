import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateKey } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as dotenv from 'dotenv'
import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import { msToTimestamp, toMs, type ChannelReply } from '@matcha/shared-types'

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
  if (!hasFirebaseEnv) {
    return 'Firebase Admin env is not configured'
  }

  try {
    createPrivateKey(normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY ?? ''))
    return false
  } catch {
    return 'FIREBASE_PRIVATE_KEY is not a valid private key'
  }
}

const firebaseSkipReason = getFirebaseSkipReason()

const testRunId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
const uid = `uid-${testRunId}`
const govId = `gov-${testRunId}`
const messageId = `msg-${testRunId}`
const replyId = `reply-${testRunId}`
const keepFirestoreTestData = process.env.KEEP_FIRESTORE_TEST_DATA === 'true'

describe('channelRepliesRepo', () => {
  after(async () => {
    if (firebaseSkipReason) return
    if (keepFirestoreTestData) return

    const { db } = await import('./firebase.js')
    await Promise.allSettled([
      db.collection('channel_replies').doc(replyId).delete(),
      db.collection('channel_messages').doc(messageId).delete(),
    ])
  })

  it(
    'upserts a reply and lists it for gov and user',
    { skip: firebaseSkipReason },
    async () => {
      const { db } = await import('./firebase.js')
      const {
        listChannelRepliesForGov,
        listChannelRepliesForUser,
        upsertChannelReply,
      } = await import('./channelRepliesRepo.js')

      const nowMs = Date.now()
      const reply: ChannelReply = {
        replyId,
        messageId,
        govId,
        content: '測試用媒合回覆',
        matchScore: 88,
        createdAt: msToTimestamp(nowMs),
      }

      await db.collection('channel_messages').doc(messageId).set({
        msgId: messageId,
        uid,
        summary: '測試用 channel message',
        publishedAt: FirestoreTimestamp.fromMillis(nowMs - 1_000),
      })

      await upsertChannelReply(reply)

      const govReplies = await listChannelRepliesForGov(govId, {
        since: nowMs - 10_000,
        minScore: 80,
        limit: 10,
      })
      const userReplies = await listChannelRepliesForUser(uid, {
        since: nowMs - 10_000,
        limit: 10,
      })

      const govReply = govReplies.find(item => item.replyId === replyId)
      const userReply = userReplies.find(item => item.replyId === replyId)

      assert.ok(govReply)
      assert.ok(userReply)
      assert.equal(govReply.messageId, messageId)
      assert.equal(govReply.govId, govId)
      assert.equal(govReply.content, reply.content)
      assert.equal(govReply.matchScore, reply.matchScore)
      assert.equal(toMs(govReply.createdAt), nowMs)
      assert.deepEqual(userReply, govReply)
    },
  )
})
