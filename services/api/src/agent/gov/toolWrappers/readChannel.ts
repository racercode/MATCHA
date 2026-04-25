import type { ChannelBroadcast } from '@matcha/shared-types'
import { fakeChannelBroadcasts } from '../fakeData.js'

export interface ReadChannelInput {
  since?: number
  limit?: number
}

export interface ReadChannelOutput {
  broadcasts: ChannelBroadcast[]
}

export function readChannelToolWrapper(input?: ReadChannelInput): ReadChannelOutput {
  let broadcasts = fakeChannelBroadcasts

  if (input?.since) {
    broadcasts = broadcasts.filter(b => b.publishedAt > input.since!)
  }

  if (input?.limit) {
    broadcasts = broadcasts.slice(0, input.limit)
  }

  return { broadcasts }
}
