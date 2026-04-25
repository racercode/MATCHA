import type { SwipeCard } from '@matcha/shared-types'

export type { SwipeCard }

export interface PersonaToolContext {
  uid: string
  displayName?: string
}

export interface UpdatePersonaInput {
  summary: string
  needs: string[]
  offers: string[]
}

export interface PublishToChannelInput {
  summary: string
  needs: string[]
}

