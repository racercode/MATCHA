import type { ChannelMessage } from '@matcha/shared-types'
import { fakeChannelMessages } from '../fakeData.js'

export interface ReadChannelInput {
  since?: number
  limit?: number
}

export interface ReadChannelOutput {
  messages: ChannelMessage[]
}

export function readChannelToolWrapper(input?: ReadChannelInput): ReadChannelOutput {
  let messages = fakeChannelMessages

  if (input?.since) {
    messages = messages.filter(message => message.publishedAt > input.since!)
  }

  if (input?.limit) {
    messages = messages.slice(0, input.limit)
  }

  return { messages }
}
