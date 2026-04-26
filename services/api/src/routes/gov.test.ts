import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { msToTimestamp } from '@matcha/shared-types'
import {
  buildGovAgentRunPlan,
  DEFAULT_AGENCY_ID,
  DEFAULT_THRESHOLD,
  normalizeChannelMessage,
  selectResources,
  serializeGovAgentResult,
  validateFollowUpRequest,
} from './gov.js'
import { fakeChannelMessages, fakeGovernmentResources } from '../agent/gov/fakeData.js'
import type { GovAgentPipelineResult } from '../agent/gov/types.js'

describe('normalizeChannelMessage', () => {
  it('accepts a ChannelMessage-shaped payload', () => {
    const message = normalizeChannelMessage({
      msgId: 'msg-test-001',
      uid: 'user-test-001',
      summary: '想找設計實習。',
      publishedAtMs: 1710000000000,
    })

    assert.deepEqual(message, {
      msgId: 'msg-test-001',
      uid: 'user-test-001',
      summary: '想找設計實習。',
      publishedAt: msToTimestamp(1710000000000),
    })
  })

  it('rejects incomplete payloads', () => {
    const message = normalizeChannelMessage({
      msgId: 'msg-test-003',
      uid: 'user-test-003',
    })

    assert.equal(message, null)
  })
})

describe('selectResources', () => {
  it('selects a single fake resource by agency and resource id', () => {
    const resources = selectResources('taipei-youth-dept', 'rid-design-intern-002')

    assert.equal(resources.length, 1)
    assert.equal(resources[0].rid, 'rid-design-intern-002')
  })

  it('selects all fake resources for an agency when resource id is omitted', () => {
    const resources = selectResources('taipei-youth-dept')

    assert.equal(resources.length, fakeGovernmentResources.length)
  })
})

describe('buildGovAgentRunPlan', () => {
  it('builds a single-message single-resource plan', () => {
    const result = buildGovAgentRunPlan({
      resourceId: 'rid-design-intern-002',
      message: {
        msgId: 'msg-channel-001',
        uid: 'user-xiaoya-001',
        summary: '中文系大三，想找設計實習。',
        publishedAtMs: 1710000000000,
      },
    })

    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.plan.agencyId, DEFAULT_AGENCY_ID)
    assert.equal(result.plan.threshold, DEFAULT_THRESHOLD)
    assert.equal(result.plan.trigger, 'channel_message')
    assert.equal(result.plan.messages.length, 1)
    assert.equal(result.plan.messages[0].summary, '中文系大三，想找設計實習。')
    assert.equal(result.plan.messages[0].msgId, 'msg-channel-001')
    assert.equal(result.plan.resources.length, 1)
    assert.equal(result.plan.resources[0].rid, 'rid-design-intern-002')
  })

  it('accepts broadcast as a temporary compatibility alias for message', () => {
    const result = buildGovAgentRunPlan({
      resourceId: 'rid-design-intern-002',
      broadcast: {
        msgId: 'msg-compat-001',
        uid: 'user-xiaoya-001',
        summary: '舊欄位名稱仍可暫時使用。',
        publishedAtMs: 1710000000000,
      },
    })

    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.plan.trigger, 'channel_message')
    assert.equal(result.plan.messages[0].msgId, 'msg-compat-001')
  })

  it('falls back to all fake messages and agency resources when body is empty', () => {
    const result = buildGovAgentRunPlan(undefined)

    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.plan.trigger, 'fake_channel_messages')
    assert.equal(result.plan.messages.length, fakeChannelMessages.length)
    assert.equal(result.plan.resources.length, fakeGovernmentResources.length)
  })

  it('uses authenticated agency before request body agency', () => {
    const result = buildGovAgentRunPlan({ agencyId: 'other-agency' }, 'taipei-youth-dept')

    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.plan.agencyId, 'taipei-youth-dept')
  })

  it('rejects invalid message payloads', () => {
    const result = buildGovAgentRunPlan({
      message: {
        uid: 'user-bad-001',
        summary: '缺少 msgId',
      },
    })

    assert.equal(result.ok, false)
    if (result.ok) return

    assert.equal(result.status, 400)
    assert.match(result.error, /message/)
  })

  it('rejects thresholds outside 0 to 100', () => {
    const result = buildGovAgentRunPlan({ threshold: 101 })

    assert.equal(result.ok, false)
    if (result.ok) return

    assert.equal(result.status, 400)
    assert.match(result.error, /threshold/)
  })

  it('returns 404 for unknown resource ids', () => {
    const result = buildGovAgentRunPlan({ resourceId: 'rid-missing' })

    assert.equal(result.ok, false)
    if (result.ok) return

    assert.equal(result.status, 404)
    assert.match(result.error, /rid-missing/)
  })
})

describe('serializeGovAgentResult', () => {
  it('returns the compact API match shape', () => {
    const assessment = {
      channelMessage: fakeChannelMessages[0],
      resource: fakeGovernmentResources[1],
      decision: {
        eligible: true,
        score: 90,
        reason: '需求與資源高度匹配',
        missingInfo: ['是否可投入兩個月實習'],
      },
    }
    const result: GovAgentPipelineResult = {
      assessment,
      reply: {
        replyId: 'reply-test',
        messageId: fakeChannelMessages[0].msgId,
        govId: 'rid-design-intern-002',
        content: '需求與資源高度匹配',
        matchScore: 90,
        createdAt: msToTimestamp(1710000000000),
      },
    }

    const serialized = serializeGovAgentResult(result)

    assert.equal(serialized.reply.replyId, 'reply-test')
    assert.equal(serialized.reply.messageId, fakeChannelMessages[0].msgId)
    assert.equal(serialized.reason, '需求與資源高度匹配')
    assert.deepEqual(serialized.missingInfo, ['是否可投入兩個月實習'])
    assert.equal(serialized.assessment, assessment)
  })
})

describe('validateFollowUpRequest', () => {
  it('accepts a valid follow-up request', () => {
    const result = validateFollowUpRequest({
      resourceId: 'rid-youth-career-001',
      replyId: 'reply-gov-rid-youth-career-001-msg-001',
      question: '請問申請截止日期是什麼時候？',
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.resourceId, 'rid-youth-career-001')
    assert.equal(result.replyId, 'reply-gov-rid-youth-career-001-msg-001')
    assert.equal(result.question, '請問申請截止日期是什麼時候？')
  })

  it('trims whitespace from fields', () => {
    const result = validateFollowUpRequest({
      resourceId: '  rid-001  ',
      replyId: '  reply-001  ',
      question: '  問題  ',
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.resourceId, 'rid-001')
    assert.equal(result.replyId, 'reply-001')
    assert.equal(result.question, '問題')
  })

  it('rejects missing resourceId', () => {
    const result = validateFollowUpRequest({
      replyId: 'reply-001',
      question: '問題',
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /resourceId/)
  })

  it('rejects empty resourceId', () => {
    const result = validateFollowUpRequest({
      resourceId: '   ',
      replyId: 'reply-001',
      question: '問題',
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /resourceId/)
  })

  it('rejects missing replyId', () => {
    const result = validateFollowUpRequest({
      resourceId: 'rid-001',
      question: '問題',
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /replyId/)
  })

  it('rejects missing question', () => {
    const result = validateFollowUpRequest({
      resourceId: 'rid-001',
      replyId: 'reply-001',
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /question/)
  })

  it('rejects empty question', () => {
    const result = validateFollowUpRequest({
      resourceId: 'rid-001',
      replyId: 'reply-001',
      question: '',
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /question/)
  })

  it('rejects undefined body', () => {
    const result = validateFollowUpRequest(undefined)

    assert.equal(result.ok, false)
  })
})
