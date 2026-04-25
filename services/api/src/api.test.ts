/**
 * HTTP integration tests for all API endpoints.
 * Run: pnpm api:test
 *
 * Uses dynamic imports + FIREBASE_TEST_MODE to avoid real Firebase calls.
 */
import { describe, it, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { Express } from 'express'

// ─── Firestore mock ───────────────────────────────────────────────────────────
// Non-Admin code paths compare createdAt/updatedAt as plain numbers.

type Doc = Record<string, unknown>
type Store = Record<string, Record<string, Doc>>

const testDb: Store = {
  gov_staff: {
    'gov-uid-1': { govId: 'taipei-youth-dept' },
  },
  personas: {
    'citizen-uid-1': { displayName: 'Alice', summary: 'Looking for internship' },
  },
  peer_threads: {
    'pt-citizen': {
      userAId: 'citizen-uid-1', userBId: 'peer-uid-1',
      type: 'peer', matchRationale: 'both interested in design',
      status: 'active', createdAt: 1000, updatedAt: 2000,
    },
    'pt-other': {
      userAId: 'other-uid-a', userBId: 'other-uid-b',
      type: 'peer', matchRationale: 'other match',
      status: 'active', createdAt: 1000, updatedAt: 2000,
    },
  },
  human_threads: {
    'ht-citizen': {
      userId: 'citizen-uid-1', govId: 'taipei-youth-dept',
      channelReplyId: 'reply-existing', matchScore: 80,
      type: 'gov_user', status: 'open',
      createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 2, nanoseconds: 0 },
    },
    'ht-other-citizen': {
      userId: 'other-citizen', govId: 'taipei-youth-dept',
      channelReplyId: 'reply-gov-citizen', matchScore: 75,
      type: 'gov_user', status: 'open',
      createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 2, nanoseconds: 0 },
    },
    'ht-other-gov': {
      userId: 'citizen-uid-1', govId: 'other-gov',
      channelReplyId: 'reply-other', matchScore: 70,
      type: 'gov_user', status: 'open',
      createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 2, nanoseconds: 0 },
    },
  },
  channel_replies: {
    'reply-existing': {
      govId: 'taipei-youth-dept', messageId: 'msg-1',
      content: 'Great match for design program', matchScore: 80, createdAt: 1_000_000,
    },
    'reply-new': {
      govId: 'taipei-youth-dept', messageId: 'msg-1',
      content: 'Another match', matchScore: 85, createdAt: 2_000_000,
    },
    'reply-other-gov': {
      govId: 'other-gov', messageId: 'msg-2',
      content: 'Other agency reply', matchScore: 75, createdAt: 1_000_000,
    },
  },
  channel_messages: {
    'msg-1': { uid: 'citizen-uid-1', summary: 'Looking for design internship' },
    'msg-2': { uid: 'other-uid', summary: 'Other message' },
  },
  gov_resources: {
    'rid-1': {
      name: 'Youth Design Internship',
      description: 'Design internship program',
      agencyId: 'taipei-youth-dept',
      agencyName: 'Taipei Youth Dept',
      eligibilityCriteria: ['University student'],
    },
  },
}

function makeDoc(id: string, data: Doc | null) {
  return { id, exists: data !== null, data: () => data ?? {} }
}
function makeSnap(docs: ReturnType<typeof makeDoc>[]) {
  return { docs, empty: docs.length === 0 }
}

const mockDb = {
  collection: (colName: string) => {
    const store = () => testDb[colName] ?? {}
    return {
      doc: (id: string) => ({
        get: async () => makeDoc(id, store()[id] ?? null),
        set: async (data: Doc) => {
          testDb[colName] ??= {}
          testDb[colName][id] = data
        },
        update: async (data: Doc) => {
          testDb[colName] ??= {}
          testDb[colName][id] ??= {}
          Object.assign(testDb[colName][id], data)
        },
        collection: (_sub: string) => ({
          get: async () => makeSnap([]),
        }),
      }),
      where: (field: string, _op: string, val: unknown) => ({
        get: async () =>
          makeSnap(
            Object.entries(store())
              .filter(([, d]) => d[field] === val)
              .map(([id, d]) => makeDoc(id, d)),
          ),
        where: () => ({ get: async () => makeSnap([]) }),
      }),
      get: async () =>
        makeSnap(Object.entries(store()).map(([id, d]) => makeDoc(id, d))),
    }
  },
}

const mockVerifyIdToken = mock.fn(async (token: string) => {
  if (token === 'valid-citizen') return { uid: 'citizen-uid-1' }
  if (token === 'valid-gov') return { uid: 'gov-uid-1' }
  throw new Error('firebase id token has invalid signature')
})

const mockAuth = { verifyIdToken: mockVerifyIdToken }

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Must happen before any module that imports firebase.ts is loaded.
// Delete Firebase credentials so hasFirebaseAdminEnv() returns false and the
// non-Admin code paths are taken (pnpm auto-loads .env which would set these).

process.env.FIREBASE_TEST_MODE = '1'
delete process.env.FIREBASE_PROJECT_ID
delete process.env.FIREBASE_CLIENT_EMAIL
delete process.env.FIREBASE_PRIVATE_KEY

const { _setTestFirebase } = await import('./lib/firebase.js')
_setTestFirebase(mockDb, mockAuth)

const { createApp } = await import('./app.js')

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

let server: http.Server
let base: string

before(async () => {
  server = http.createServer(createApp() as Express)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address() as { port: number }
  base = `http://127.0.0.1:${addr.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve())),
  )
})

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {},
) {
  const headers: Record<string, string> = {}
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
  const isForm = opts.body instanceof FormData
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: isForm
      ? (opts.body as FormData)
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined,
  })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

const CT = 'valid-citizen'
const GT = 'valid-gov'

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with ok:true', async () => {
    const { status, body } = await req('GET', '/health')
    assert.equal(status, 200)
    assert.deepEqual(body, { ok: true })
  })
})

// ─── 404 handler ─────────────────────────────────────────────────────────────
// meRouter/threadsRouter apply verifyToken to ALL requests, and govRouter applies
// requireGovStaff before its catch-all. A gov token is needed to reach the 404 handler.

describe('unknown routes', () => {
  it('returns 404 with success:false when no routes match', async () => {
    const { status, body } = await req('GET', '/no-such-route', { token: GT })
    assert.equal(status, 404)
    assert.equal(body.success, false)
  })
})

// ─── POST /auth/verify ───────────────────────────────────────────────────────

describe('POST /auth/verify', () => {
  it('returns 400 when idToken is missing', async () => {
    const { status, body } = await req('POST', '/auth/verify', { body: {} })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  it('returns 400 when idToken is not a string', async () => {
    const { status, body } = await req('POST', '/auth/verify', { body: { idToken: 42 } })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  it('returns 401 for an invalid token', async () => {
    const { status, body } = await req('POST', '/auth/verify', { body: { idToken: 'bad' } })
    assert.equal(status, 401)
    assert.equal(body.success, false)
  })

  it('returns citizen role for a non-staff uid', async () => {
    const { status, body } = await req('POST', '/auth/verify', { body: { idToken: CT } })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.equal(data.role, 'citizen')
    assert.equal(data.uid, 'citizen-uid-1')
  })

  it('returns gov_staff role with govId for a staff uid', async () => {
    const { status, body } = await req('POST', '/auth/verify', { body: { idToken: GT } })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.equal(data.role, 'gov_staff')
    assert.equal(data.govId, 'taipei-youth-dept')
  })
})

// ─── Auth middleware ──────────────────────────────────────────────────────────

describe('auth middleware', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const { status } = await req('GET', '/me/persona')
    assert.equal(status, 401)
  })

  it('returns 401 for a bad bearer token', async () => {
    const { status } = await req('GET', '/me/persona', { token: 'garbage' })
    assert.equal(status, 401)
  })
})

// ─── GET /me/persona ─────────────────────────────────────────────────────────

describe('GET /me/persona', () => {
  it('returns persona for a citizen who has one', async () => {
    const { status, body } = await req('GET', '/me/persona', { token: CT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.equal(data.uid, 'citizen-uid-1')
    assert.equal(data.displayName, 'Alice')
  })

  it('returns null when the user has no persona', async () => {
    const { status, body } = await req('GET', '/me/persona', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data, null)
  })
})

// ─── GET /me/channel-replies ─────────────────────────────────────────────────

describe('GET /me/channel-replies', () => {
  it('returns 401 without a token', async () => {
    const { status } = await req('GET', '/me/channel-replies')
    assert.equal(status, 401)
  })

  it('returns empty list when user has no channel messages', async () => {
    const { status, body } = await req('GET', '/me/channel-replies', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.deepEqual(data.items, [])
    assert.equal(data.hasMore, false)
  })

  it('returns replies matched to the citizen\'s messages', async () => {
    const { status, body } = await req('GET', '/me/channel-replies', { token: CT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as { items: unknown[]; hasMore: boolean }
    assert.ok(data.items.length >= 1)
  })

  it('respects the limit query param', async () => {
    const { status, body } = await req('GET', '/me/channel-replies?limit=1', { token: CT })
    assert.equal(status, 200)
    const data = body.data as { items: unknown[] }
    assert.ok(data.items.length <= 1)
  })
})

// ─── GET /me/peer-threads ────────────────────────────────────────────────────

describe('GET /me/peer-threads', () => {
  it('returns 401 without a token', async () => {
    const { status } = await req('GET', '/me/peer-threads')
    assert.equal(status, 401)
  })

  it('returns peer threads the citizen belongs to', async () => {
    const { status, body } = await req('GET', '/me/peer-threads', { token: CT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as { items: unknown[] }
    assert.ok(data.items.length >= 1)
  })
})

// ─── GET /me/human-threads ───────────────────────────────────────────────────

describe('GET /me/human-threads', () => {
  it('returns 401 without a token', async () => {
    const { status } = await req('GET', '/me/human-threads')
    assert.equal(status, 401)
  })

  it('returns human threads for the citizen', async () => {
    const { status, body } = await req('GET', '/me/human-threads', { token: CT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as { items: unknown[] }
    assert.ok(data.items.length >= 1)
  })
})

// ─── GET /peer-threads/:tid/messages ─────────────────────────────────────────

describe('GET /peer-threads/:tid/messages', () => {
  it('returns 401 without a token', async () => {
    const { status } = await req('GET', '/peer-threads/pt-citizen/messages')
    assert.equal(status, 401)
  })

  it('returns 404 for a non-existent thread', async () => {
    const { status, body } = await req('GET', '/peer-threads/nonexistent/messages', { token: CT })
    assert.equal(status, 404)
    assert.equal(body.success, false)
  })

  it('returns 403 when the user is not a member', async () => {
    const { status, body } = await req('GET', '/peer-threads/pt-other/messages', { token: CT })
    assert.equal(status, 403)
    assert.equal(body.success, false)
  })

  it('returns messages for a thread the citizen is in', async () => {
    const { status, body } = await req('GET', '/peer-threads/pt-citizen/messages', { token: CT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray((body.data as Record<string, unknown>).items))
  })
})

// ─── GET /human-threads/:tid/messages ────────────────────────────────────────

describe('GET /human-threads/:tid/messages', () => {
  it('returns 401 without a token', async () => {
    const { status } = await req('GET', '/human-threads/ht-citizen/messages')
    assert.equal(status, 401)
  })

  it('returns 404 for a non-existent thread', async () => {
    const { status, body } = await req('GET', '/human-threads/nonexistent/messages', { token: CT })
    assert.equal(status, 404)
    assert.equal(body.success, false)
  })

  it("returns 403 when citizen accesses another user's thread", async () => {
    const { status, body } = await req('GET', '/human-threads/ht-other-citizen/messages', { token: CT })
    assert.equal(status, 403)
    assert.equal(body.success, false)
  })

  it('allows the owning citizen to read messages', async () => {
    const { status, body } = await req('GET', '/human-threads/ht-citizen/messages', { token: CT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok(Array.isArray((body.data as Record<string, unknown>).items))
  })

  it('allows gov_staff to read messages for their thread', async () => {
    const { status, body } = await req('GET', '/human-threads/ht-citizen/messages', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
  })

  it('returns 403 when gov_staff accesses a thread from a different agency', async () => {
    const { status, body } = await req('GET', '/human-threads/ht-other-gov/messages', { token: GT })
    assert.equal(status, 403)
    assert.equal(body.success, false)
  })
})

// ─── POST /gov/agent/run-message ─────────────────────────────────────────────
// This endpoint is unauthenticated within govRouter, but meRouter's blanket
// verifyToken middleware still runs. Any valid token passes through.

describe('POST /gov/agent/run-message', () => {
  it('returns 400 when messageId is missing', async () => {
    const { status, body } = await req('POST', '/gov/agent/run-message', { token: CT, body: {} })
    assert.equal(status, 400)
    assert.equal(body.success, false)
    assert.match(String(body.error), /messageId/)
  })

  it('returns 400 when messageId is blank', async () => {
    const { status, body } = await req('POST', '/gov/agent/run-message', { token: CT, body: { messageId: '   ' } })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  it('returns 400 when threshold is not a number', async () => {
    const { status, body } = await req('POST', '/gov/agent/run-message', {
      token: CT, body: { messageId: 'msg-1', threshold: 'high' },
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
    assert.match(String(body.error), /threshold/)
  })

  it('returns 400 when threshold is out of range', async () => {
    const { status, body } = await req('POST', '/gov/agent/run-message', {
      token: CT, body: { messageId: 'msg-1', threshold: 150 },
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
    assert.match(String(body.error), /threshold/)
  })

  it('returns 500 when Firebase env is not configured', async () => {
    const { status, body } = await req('POST', '/gov/agent/run-message', {
      token: CT, body: { messageId: 'msg-1' },
    })
    assert.equal(status, 500)
    assert.equal(body.success, false)
    assert.match(String(body.error), /Firebase/)
  })
})

// ─── Gov routes: requireGovStaff ─────────────────────────────────────────────

describe('gov routes require gov_staff role', () => {
  const govEndpoints: [string, string, Record<string, unknown>?][] = [
    ['GET', '/gov/channel-replies'],
    ['POST', '/gov/channel-replies/reply-existing/open'],
    ['POST', '/gov/agent/run'],
    ['GET', '/gov/dashboard'],
    ['GET', '/gov/human-threads'],
    ['GET', '/gov/resources'],
    ['POST', '/gov/resources', { name: 'x', description: 'x', eligibilityCriteria: [] }],
  ]

  for (const [method, path, body] of govEndpoints) {
    it(`${method} ${path} returns 401 without token`, async () => {
      const { status } = await req(method, path, { body })
      assert.equal(status, 401)
    })

    it(`${method} ${path} returns 403 for citizen`, async () => {
      const { status, body: resBody } = await req(method, path, { token: CT, body })
      assert.equal(status, 403)
      assert.equal(resBody.success, false)
    })
  }
})

// ─── GET /gov/channel-replies ────────────────────────────────────────────────

describe('GET /gov/channel-replies', () => {
  it("returns replies for the gov staff's agency", async () => {
    const { status, body } = await req('GET', '/gov/channel-replies', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as { items: unknown[] }
    assert.ok(data.items.length >= 1)
  })

  it('respects the minScore filter', async () => {
    const { status, body } = await req('GET', '/gov/channel-replies?minScore=90', { token: GT })
    assert.equal(status, 200)
    const data = body.data as { items: { matchScore: number }[] }
    for (const item of data.items) assert.ok(item.matchScore >= 90)
  })
})

// ─── POST /gov/channel-replies/:replyId/open ─────────────────────────────────

describe('POST /gov/channel-replies/:replyId/open', () => {
  it('returns 404 for a non-existent reply', async () => {
    const { status, body } = await req('POST', '/gov/channel-replies/no-such-reply/open', { token: GT })
    assert.equal(status, 404)
    assert.equal(body.success, false)
  })

  it('returns 403 when the reply belongs to a different agency', async () => {
    const { status, body } = await req('POST', '/gov/channel-replies/reply-other-gov/open', { token: GT })
    assert.equal(status, 403)
    assert.equal(body.success, false)
  })

  it('returns the existing thread idempotently for an already-opened reply', async () => {
    const { status, body } = await req('POST', '/gov/channel-replies/reply-existing/open', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.ok((body.data as Record<string, unknown>).tid)
  })

  it('creates a new human thread and returns 201 for an unopened reply', async () => {
    const { status, body } = await req('POST', '/gov/channel-replies/reply-new/open', { token: GT })
    assert.equal(status, 201)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.ok(data.tid)
    assert.equal(data.status, 'open')
    assert.equal(data.govId, 'taipei-youth-dept')
  })
})

// ─── POST /gov/agent/run ─────────────────────────────────────────────────────

describe('POST /gov/agent/run', () => {
  it('returns 400 for an invalid message payload', async () => {
    const { status, body } = await req('POST', '/gov/agent/run', {
      token: GT,
      body: { message: { uid: 'u', summary: 'no msgId' } },
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  it('returns 400 for an out-of-range threshold', async () => {
    const { status, body } = await req('POST', '/gov/agent/run', {
      token: GT,
      body: { threshold: -5 },
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
    assert.match(String(body.error), /threshold/)
  })

  it('returns 404 for an unknown resourceId', async () => {
    const { status, body } = await req('POST', '/gov/agent/run', {
      token: GT,
      body: { resourceId: 'rid-missing' },
    })
    assert.equal(status, 404)
    assert.equal(body.success, false)
    assert.match(String(body.error), /rid-missing/)
  })
})

// ─── GET /gov/dashboard ──────────────────────────────────────────────────────

describe('GET /gov/dashboard', () => {
  it('returns all required stat fields', async () => {
    const { status, body } = await req('GET', '/gov/dashboard?since=0', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.ok(typeof data.totalReplies === 'number')
    assert.ok(typeof data.avgMatchScore === 'number')
    assert.ok(typeof data.openedConversations === 'number')
    assert.ok(typeof data.openRate === 'number')
    assert.ok(data.scoreDistribution !== null && typeof data.scoreDistribution === 'object')
  })

  it('counts replies when since=0', async () => {
    const { status, body } = await req('GET', '/gov/dashboard?since=0', { token: GT })
    assert.equal(status, 200)
    assert.ok((body.data as { totalReplies: number }).totalReplies >= 1)
  })
})

// ─── GET /gov/human-threads ──────────────────────────────────────────────────

describe('GET /gov/human-threads', () => {
  it("returns threads for the gov staff's agency", async () => {
    const { status, body } = await req('GET', '/gov/human-threads', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as { items: unknown[] }
    assert.ok(data.items.length >= 1)
  })
})

// ─── GET /gov/resources ──────────────────────────────────────────────────────

describe('GET /gov/resources', () => {
  it('returns resources without pdfText', async () => {
    const { status, body } = await req('GET', '/gov/resources', { token: GT })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as { items: Record<string, unknown>[] }
    const item = data.items.find(r => r.rid === 'rid-1')
    assert.ok(item, 'rid-1 should be present')
    assert.equal(item.name, 'Youth Design Internship')
    assert.ok(!('pdfText' in item), 'pdfText must be stripped from response')
  })
})

// ─── POST /gov/resources ─────────────────────────────────────────────────────

describe('POST /gov/resources', () => {
  it('returns 400 when required fields are missing', async () => {
    const { status, body } = await req('POST', '/gov/resources', {
      token: GT,
      body: { name: 'Partial Resource' },
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  it('creates a resource and returns 201 with a generated rid', async () => {
    const { status, body } = await req('POST', '/gov/resources', {
      token: GT,
      body: {
        name: 'New Resource',
        description: 'A test resource',
        eligibilityCriteria: ['Taipei resident'],
        contactUrl: 'https://example.gov.tw',
      },
    })
    assert.equal(status, 201)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.ok(String(data.rid).startsWith('rid-'))
    assert.equal(data.name, 'New Resource')
  })
})

// ─── POST /gov/resources/:rid/pdf ────────────────────────────────────────────

describe('POST /gov/resources/:rid/pdf', () => {
  it('returns 404 for a non-existent resource', async () => {
    const form = new FormData()
    form.append('pdf', new Blob(['%PDF fake'], { type: 'application/pdf' }), 'test.pdf')
    const { status, body } = await req('POST', '/gov/resources/no-such-rid/pdf', {
      token: GT, body: form,
    })
    assert.equal(status, 404)
    assert.equal(body.success, false)
  })

  it('returns 400 when the pdf field is absent', async () => {
    const { status, body } = await req('POST', '/gov/resources/rid-1/pdf', {
      token: GT, body: new FormData(),
    })
    assert.equal(status, 400)
    assert.equal(body.success, false)
  })

  it('accepts a PDF upload and returns the storage path', async () => {
    const form = new FormData()
    form.append('pdf', new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' }), 'test.pdf')
    const { status, body } = await req('POST', '/gov/resources/rid-1/pdf', {
      token: GT, body: form,
    })
    assert.equal(status, 200)
    assert.equal(body.success, true)
    const data = body.data as Record<string, unknown>
    assert.equal(data.rid, 'rid-1')
    assert.ok(String(data.pdfStoragePath).includes('rid-1'))
    assert.ok(typeof data.extractedChars === 'number')
  })
})
