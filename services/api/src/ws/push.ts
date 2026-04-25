import { WebSocket } from 'ws'
import type { ServerEvent } from '@matcha/shared-types'

export type { ServerEvent }

export const clients = new Map<string, Set<WebSocket>>()
export const userRoles = new Map<string, 'citizen' | 'gov_staff'>()
export const userGovIds = new Map<string, string>()

export function broadcast(uid: string, event: ServerEvent) {
  const sockets = clients.get(uid)
  if (!sockets) return
  const payload = JSON.stringify(event)
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  }
}
