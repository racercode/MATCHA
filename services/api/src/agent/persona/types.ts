import type { UserPersona, SwipeCard, ChannelBroadcast } from '@matcha/shared-types'

export type { UserPersona, SwipeCard, ChannelBroadcast }

export interface PersonaToolContext {
  uid: string
  displayName?: string
}

export interface UpdatePersonaInput {
  summary: string
  needs: string[]
  offers: string[]
}

export interface GenerateSwipeCardInput {
  question: string
  leftLabel: string
  rightLabel: string
  leftValue: string
  rightValue: string
}

export interface PublishToChannelInput {
  summary: string
  needs: string[]
}

export interface PersonaBroadcastResult {
  broadcast: ChannelBroadcast
  published: boolean
  msgId: string
}
