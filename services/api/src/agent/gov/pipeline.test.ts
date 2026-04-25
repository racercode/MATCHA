import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMatchDecision } from './pipeline.js'
import { readChannelToolWrapper } from './toolWrappers/readChannel.js'
import { queryProgramDocsToolWrapper } from './toolWrappers/queryProgramDocs.js'
import { proposeMatchToolWrapper } from './toolWrappers/proposeMatch.js'
import { fakeChannelMessages, fakeGovernmentResources } from './fakeData.js'
import type { MatchDecision, MatchAssessment } from './types.js'

// ---------------------------------------------------------------------------
// parseMatchDecision
// ---------------------------------------------------------------------------

describe('parseMatchDecision', () => {
  const validJson: MatchDecision = {
    eligible: true,
    score: 85,
    reason: '使用者對品牌設計有興趣',
    missingInfo: ['是否可投入兩個月實習'],
    suggestedFirstMessage: '你好，我找到一個適合你的資源。',
  }

  it('parses valid JSON', () => {
    const result = parseMatchDecision(JSON.stringify(validJson))
    assert.deepStrictEqual(result, validJson)
  })

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + JSON.stringify(validJson) + '\n```'
    const result = parseMatchDecision(wrapped)
    assert.deepStrictEqual(result, validJson)
  })

  it('throws on missing eligible', () => {
    const bad = { ...validJson, eligible: undefined }
    assert.throws(
      () => parseMatchDecision(JSON.stringify(bad)),
      /missing eligible/,
    )
  })

  it('throws on score out of range', () => {
    const bad = { ...validJson, score: 150 }
    assert.throws(
      () => parseMatchDecision(JSON.stringify(bad)),
      /score must be an integer/,
    )
  })

  it('throws on negative score', () => {
    const bad = { ...validJson, score: -1 }
    assert.throws(
      () => parseMatchDecision(JSON.stringify(bad)),
      /score must be an integer/,
    )
  })

  it('throws on float score', () => {
    const bad = { ...validJson, score: 85.5 }
    assert.throws(
      () => parseMatchDecision(JSON.stringify(bad)),
      /score must be an integer/,
    )
  })

  it('throws on missing reason', () => {
    const bad = { ...validJson, reason: undefined }
    assert.throws(
      () => parseMatchDecision(JSON.stringify(bad)),
      /missing reason/,
    )
  })

  it('throws on missing missingInfo', () => {
    const bad = { ...validJson, missingInfo: undefined }
    assert.throws(
      () => parseMatchDecision(JSON.stringify(bad)),
      /missing missingInfo/,
    )
  })

  it('throws on missing suggestedFirstMessage', () => {
    const bad = { ...validJson, suggestedFirstMessage: undefined }
    assert.throws(
      () => parseMatchDecision(JSON.stringify(bad)),
      /missing suggestedFirstMessage/,
    )
  })

  it('throws on invalid JSON', () => {
    assert.throws(
      () => parseMatchDecision('not json at all'),
    )
  })
})

// ---------------------------------------------------------------------------
// readChannelToolWrapper
// ---------------------------------------------------------------------------

describe('readChannelToolWrapper', () => {
  it('returns all fake messages when no filter', () => {
    const { messages } = readChannelToolWrapper()
    assert.equal(messages.length, fakeChannelMessages.length)
  })

  it('filters by since', () => {
    const cutoff = Date.now() - 20_000
    const { messages } = readChannelToolWrapper({ since: cutoff })
    for (const message of messages) {
      assert.ok(message.publishedAt > cutoff)
    }
  })

  it('limits result count', () => {
    const { messages } = readChannelToolWrapper({ limit: 1 })
    assert.equal(messages.length, 1)
  })
})

// ---------------------------------------------------------------------------
// queryProgramDocsToolWrapper
// ---------------------------------------------------------------------------

describe('queryProgramDocsToolWrapper', () => {
  it('returns only the resource bound to the runtime context', () => {
    const { resources } = queryProgramDocsToolWrapper({}, {
      agencyId: 'taipei-youth-dept',
      resourceId: 'rid-youth-career-001',
    })
    assert.equal(resources.length, 1)
    assert.equal(resources[0].agencyId, 'taipei-youth-dept')
    assert.equal(resources[0].rid, 'rid-youth-career-001')
  })

  it('returns empty for unknown runtime context', () => {
    const { resources } = queryProgramDocsToolWrapper({}, {
      agencyId: 'nonexistent',
      resourceId: 'rid-youth-career-001',
    })
    assert.equal(resources.length, 0)
  })

  it('ignores any resourceId supplied by the agent input', () => {
    const { resources } = queryProgramDocsToolWrapper({
      resourceId: 'rid-youth-startup-003',
    } as never, {
      agencyId: 'taipei-youth-dept',
      resourceId: 'rid-youth-career-001',
    })
    assert.equal(resources.length, 1)
    assert.equal(resources[0].rid, 'rid-youth-career-001')
  })
})

// ---------------------------------------------------------------------------
// proposeMatchToolWrapper
// ---------------------------------------------------------------------------

describe('proposeMatchToolWrapper', () => {
  const mockDecision: MatchDecision = {
    eligible: true,
    score: 90,
    reason: '使用者需求與資源高度匹配',
    missingInfo: [],
    suggestedFirstMessage: '你好！',
  }

  it('creates a thread and initial message with correct shape', () => {
    const assessment: MatchAssessment = {
      channelMessage: fakeChannelMessages[0],
      resource: fakeGovernmentResources[1],
      decision: mockDecision,
    }

    const { thread, initialMessage } = proposeMatchToolWrapper({ assessment })

    assert.equal(thread.type, 'gov_user')
    assert.equal(thread.initiatorId, `gov:${fakeGovernmentResources[1].rid}`)
    assert.equal(thread.responderId, `user:${fakeChannelMessages[0].uid}`)
    assert.equal(thread.status, 'negotiating')
    assert.equal(thread.matchScore, 90)
    assert.equal(thread.summary, mockDecision.reason)
    assert.equal(thread.userPresence, 'agent')
    assert.equal(thread.govPresence, 'agent')
    assert.ok(thread.createdAt > 0)
    assert.ok(thread.updatedAt > 0)

    assert.equal(initialMessage.tid, thread.tid)
    assert.equal(initialMessage.from, `gov_agent:${fakeGovernmentResources[1].rid}`)
    assert.equal(initialMessage.type, 'decision')
    assert.equal(initialMessage.content.text, mockDecision.suggestedFirstMessage)
    assert.equal(initialMessage.content.reason, mockDecision.reason)
    assert.equal(initialMessage.content.score, mockDecision.score)
    assert.deepEqual(initialMessage.content.missingInfo, mockDecision.missingInfo)
    assert.equal(initialMessage.content.resourceId, fakeGovernmentResources[1].rid)
    assert.equal(initialMessage.content.channelMessageId, fakeChannelMessages[0].msgId)
    assert.equal(initialMessage.content.targetUserId, fakeChannelMessages[0].uid)
    assert.ok(initialMessage.createdAt > 0)
  })

  it('generates deterministic tid', () => {
    const assessment: MatchAssessment = {
      channelMessage: fakeChannelMessages[0],
      resource: fakeGovernmentResources[0],
      decision: mockDecision,
    }

    const { thread } = proposeMatchToolWrapper({ assessment })
    assert.equal(thread.tid, 'tid-gov-rid-youth-career-001-user-xiaoya-001')
  })

  it('generates deterministic initial message id', () => {
    const assessment: MatchAssessment = {
      channelMessage: fakeChannelMessages[0],
      resource: fakeGovernmentResources[0],
      decision: mockDecision,
    }

    const { initialMessage } = proposeMatchToolWrapper({ assessment })
    assert.equal(initialMessage.mid, 'msg-gov-rid-youth-career-001-user-xiaoya-001')
  })
})
