import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateKey } from 'node:crypto'
import http from 'node:http'
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

async function startTestServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const { createApp } = await import('../app.js')
  const server = http.createServer(createApp())

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start test server')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: 'Bearer gov001',
      ...init.headers,
    },
  })
  const payload = await response.json() as { success: boolean; data?: T; error?: string }

  assert.equal(response.ok, true, payload.error)
  assert.equal(payload.success, true, payload.error)

  return payload.data as T
}

const firebaseSkipReason = getFirebaseSkipReason()
const testRunId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
const rid = `rid-${testRunId}`
const keepFirestoreTestData = process.env.KEEP_FIRESTORE_TEST_DATA === 'true'

describe('gov resource document API', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAllowTestAuth = process.env.ALLOW_TEST_AUTH

  after(async () => {
    process.env.NODE_ENV = originalNodeEnv
    process.env.ALLOW_TEST_AUTH = originalAllowTestAuth

    if (firebaseSkipReason) return
    if (keepFirestoreTestData) return

    const { db } = await import('../lib/firebase.js')
    const documentSnapshot = await db.collection('gov_resources').doc(rid).collection('documents').get()
    await Promise.allSettled(documentSnapshot.docs.map(doc => doc.ref.delete()))
    await db.collection('gov_resources').doc(rid).delete()
  })

  it(
    'POSTs a resource and document to Firebase, then GETs the document back',
    { skip: firebaseSkipReason },
    async () => {
      process.env.NODE_ENV = 'test'
      process.env.ALLOW_TEST_AUTH = 'true'
      const server = await startTestServer()

      try {
        type ResourceResponse = { rid: string; name: string; agencyId: string }
        type DocumentResponse = {
          docId: string
          rid: string
          filename: string
          kind: string
          extractedText: string
          textLength: number
        }
        type DocumentsListResponse = { items: DocumentResponse[] }

        const resource = await requestJson<ResourceResponse>(`${server.baseUrl}/gov/resources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rid,
            agencyId: 'taipei-youth-dept',
            agencyName: '臺北市青年局',
            name: '測試資源文件上傳',
            description: '測試 API 是否能寫入 Firebase 並讀回 documents。',
            eligibilityCriteria: ['測試資格'],
            contactUrl: 'https://example.test/resource',
          }),
        })

        assert.equal(resource.rid, rid)
        assert.equal(resource.agencyId, 'taipei-youth-dept')

        const document = await requestJson<DocumentResponse>(`${server.baseUrl}/gov/resources/${rid}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: 'eligibility.csv',
            kind: 'csv',
            text: 'name,eligible\n小明,true\n',
          }),
        })

        assert.equal(document.rid, rid)
        assert.equal(document.filename, 'eligibility.csv')
        assert.equal(document.kind, 'csv')
        assert.match(document.extractedText, /小明,true/)
        assert.ok(document.textLength > 0)

        const documents = await requestJson<DocumentsListResponse>(`${server.baseUrl}/gov/resources/${rid}/documents`, {
          method: 'GET',
        })

        const fetched = documents.items.find(item => item.docId === document.docId)
        assert.ok(fetched)
        assert.equal(fetched.rid, rid)
        assert.equal(fetched.kind, 'csv')
        assert.equal(fetched.extractedText, document.extractedText)
      } finally {
        await server.close()
      }
    },
  )
})
