'use client'
import { useEffect, useRef, useState } from 'react'
import { auth } from './firebase'
import type { HumanMessage } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'

export function useHumanChat(tid: string, initialMessages: HumanMessage[]) {
  const [messages, setMessages] = useState<HumanMessage[]>(initialMessages)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!tid) return

    let cancelled = false

    const connect = async () => {
      const user = auth.currentUser
      const token = user ? await user.getIdToken() : ''
      if (cancelled) return

      const ws = new WebSocket(`${WS_URL}/ws?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!cancelled) setConnected(true)
      }
      ws.onclose = () => {
        if (!cancelled) setConnected(false)
      }
      ws.onmessage = (evt) => {
        if (cancelled) return
        try {
          const event = JSON.parse(evt.data as string)
          if (event.type === 'human_message' && event.message) {
            const msg = event.message as HumanMessage
            setMessages((prev) => {
              if (prev.some((m) => m.mid === msg.mid)) return prev
              return [...prev, msg]
            })
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [tid])

  const sendMessage = (content: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const optimistic: HumanMessage = {
      mid: `optimistic-${Date.now()}`,
      from: `gov:${auth.currentUser?.uid ?? 'unknown'}`,
      content,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, optimistic])
    ws.send(JSON.stringify({ type: 'human_message', threadId: tid, content }))
  }

  return { messages, sendMessage, connected }
}
