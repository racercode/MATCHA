// In-memory store — substitutes for Firestore in no-Firebase mode
import { msToTimestamp, type Timestamp } from '@matcha/shared-types'
export type { Timestamp }

export interface UserPersona {
  uid: string
  displayName: string
  summary: string
  needs: string[]
  offers: string[]
  updatedAt: number
}

export interface ChannelMessage {
  msgId: string
  uid: string
  summary: string
  createdAt: number
}

export interface ChannelReply {
  replyId: string
  messageId: string
  govId: string
  content: string
  matchScore: number
  createdAt: number
}

export interface HumanThread {
  tid: string
  type: 'gov_user'
  userId: string
  govId: string
  channelReplyId: string
  matchScore: number
  status: 'open' | 'closed'
  createdAt: number
  updatedAt: number
}

export interface HumanMessage {
  mid: string
  from: string // "user:{uid}" | "gov_staff:{staffId}"
  content: string
  createdAt: Timestamp
}

export interface PeerThread {
  tid: string
  type: 'user_user'
  userAId: string
  userBId: string
  matchRationale: string
  status: 'active' | 'closed'
  createdAt: number
  updatedAt: number
}

export interface PeerMessage {
  mid: string
  from: string // "user:{uid}" | "coffee_agent"
  content: string
  createdAt: Timestamp
}

export interface GovernmentResource {
  rid: string
  name: string
  description: string
  eligibilityCriteria: string[]
  contactUrl?: string
  pdfStoragePath?: string
  pdfText?: string
  createdAt: number
}

export interface GovStaff {
  uid: string
  govId: string
  displayName: string
}

// ── Collections ──────────────────────────────────────────────────────────────

export const personas = new Map<string, UserPersona>()
export const channelMessages = new Map<string, ChannelMessage>()
export const channelReplies = new Map<string, ChannelReply>()
export const humanThreads = new Map<string, HumanThread>()
export const humanMessages = new Map<string, HumanMessage[]>()
export const peerThreads = new Map<string, PeerThread>()
export const peerMessages = new Map<string, PeerMessage[]>()
export const govResources = new Map<string, GovernmentResource>()
export const govStaff = new Map<string, GovStaff>() // uid → staff record

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getGovName(govId: string): string {
  return govResources.get(govId)?.name ?? govId
}

export function getCitizenInfo(uid: string): { uid: string; displayName: string; summary: string } {
  const p = personas.get(uid)
  return {
    uid,
    displayName: p?.displayName ?? uid,
    summary: p?.summary ?? '',
  }
}

export function findGovStaffUidByGovId(govId: string): string | undefined {
  for (const [uid, staff] of govStaff) {
    if (staff.govId === govId) return uid
  }
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

const NOW = Date.now()

govStaff.set('gov001', { uid: 'gov001', govId: 'rid-001', displayName: '承辦人甲' })
govStaff.set('gov002', { uid: 'gov002', govId: 'rid-002', displayName: '承辦人乙' })

govResources.set('rid-001', {
  rid: 'rid-001',
  name: '青年就業促進計畫',
  description: '提供 18–29 歲青年就業媒合、職訓補助與職涯諮詢',
  eligibilityCriteria: ['年齡 18–29 歲', '具中華民國國籍', '非在學中'],
  contactUrl: 'https://www.mol.gov.tw',
  createdAt: NOW - 86_400_000,
})

govResources.set('rid-002', {
  rid: 'rid-002',
  name: '青年創業補助計畫',
  description: '提供有創業想法的青年資金與輔導資源',
  eligibilityCriteria: ['年齡 20–35 歲', '具中華民國國籍', '有具體創業計畫'],
  contactUrl: 'https://www.moea.gov.tw',
  createdAt: NOW - 86_400_000,
})

personas.set('uid-abc', {
  uid: 'uid-abc',
  displayName: '陳小明',
  summary: '正在尋找就業輔導和職業培訓資源的年輕人，目前無穩定收入',
  needs: ['就業輔導', '職業培訓'],
  offers: ['軟體開發經驗'],
  updatedAt: NOW - 3_600_000,
})

personas.set('uid-xyz', {
  uid: 'uid-xyz',
  displayName: '林小華',
  summary: '對社會企業有興趣的青年，正在尋找同伴',
  needs: ['創業夥伴', '資金連結'],
  offers: ['社區志工經驗', '政策研究'],
  updatedAt: NOW - 3_600_000,
})

channelMessages.set('m-001', {
  msgId: 'm-001',
  uid: 'uid-abc',
  summary: '正在尋找就業輔導和職業培訓資源的年輕人，目前無穩定收入',
  createdAt: NOW - 3_600_000,
})

channelReplies.set('r-001', {
  replyId: 'r-001',
  messageId: 'm-001',
  govId: 'rid-001',
  content: '你的背景非常符合本計畫的資格：年齡符合、有就業需求。建議申請。',
  matchScore: 87,
  createdAt: NOW - 3_000_000,
})

channelReplies.set('r-002', {
  replyId: 'r-002',
  messageId: 'm-001',
  govId: 'rid-002',
  content: '你有軟體背景，若有創業想法可申請此計畫。',
  matchScore: 65,
  createdAt: NOW - 2_900_000,
})

peerThreads.set('pt-001', {
  tid: 'pt-001',
  type: 'user_user',
  userAId: 'uid-abc',
  userBId: 'uid-xyz',
  matchRationale: '兩人都對青年創業有興趣，且都缺乏資金與資源連結',
  status: 'active',
  createdAt: NOW - 2_000_000,
  updatedAt: NOW - 2_000_000,
})

peerMessages.set('pt-001', [
  {
    mid: 'pm-001',
    from: 'coffee_agent',
    content: '你們兩位都對青年創業感興趣，我來介紹一下彼此！林小華目前在尋找共同創業夥伴。',
    createdAt: msToTimestamp(NOW - 2_000_000),
  },
])
