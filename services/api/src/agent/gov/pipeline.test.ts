import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMatchDecision } from './pipeline.js'
import { readChannelToolWrapper } from './toolWrappers/readChannel.js'
import { queryResourcePdfToolWrapper } from './toolWrappers/queryResourcePdf.js'
import { writeChannelReplyToolWrapper } from './toolWrappers/writeChannelReply.js'
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
// queryResourcePdfToolWrapper
// ---------------------------------------------------------------------------

describe('queryResourcePdfToolWrapper', () => {
  it('returns only the resource bound to the runtime context', () => {
    const { resources } = queryResourcePdfToolWrapper({}, {
      agencyId: 'taipei-youth-dept',
      resourceId: 'rid-youth-career-001',
    })
    assert.equal(resources.length, 1)
    assert.equal(resources[0].agencyId, 'taipei-youth-dept')
    assert.equal(resources[0].rid, 'rid-youth-career-001')
  })

  it('returns empty for unknown runtime context', () => {
    const { resources } = queryResourcePdfToolWrapper({}, {
      agencyId: 'nonexistent',
      resourceId: 'rid-youth-career-001',
    })
    assert.equal(resources.length, 0)
  })

  it('ignores any resourceId supplied by the agent input', () => {
    const { resources } = queryResourcePdfToolWrapper({
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
// writeChannelReplyToolWrapper
// ---------------------------------------------------------------------------

describe('writeChannelReplyToolWrapper', () => {
  const mockDecision: MatchDecision = {
    eligible: true,
    score: 90,
    reason: '使用者需求與資源高度匹配',
    missingInfo: [],
  }

  it('creates a channel reply with correct shape', () => {
    const assessment: MatchAssessment = {
      channelMessage: fakeChannelMessages[0],
      resource: fakeGovernmentResources[1],
      decision: mockDecision,
    }

    const { reply } = writeChannelReplyToolWrapper({ assessment })

    assert.equal(reply.messageId, fakeChannelMessages[0].msgId)
    assert.equal(reply.govId, fakeGovernmentResources[1].rid)
    assert.equal(reply.content, mockDecision.reason)
    assert.equal(reply.matchScore, 90)
    assert.ok(reply.createdAt > 0)
  })

  it('generates deterministic reply id', () => {
    const assessment: MatchAssessment = {
      channelMessage: fakeChannelMessages[0],
      resource: fakeGovernmentResources[0],
      decision: mockDecision,
    }

    const { reply } = writeChannelReplyToolWrapper({ assessment })
    assert.equal(reply.replyId, 'reply-gov-rid-youth-career-001-msg-channel-xiaoya-001')
  })
})
