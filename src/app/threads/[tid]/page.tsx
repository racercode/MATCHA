'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { AgentThread, ThreadMessage } from '@/types'
import { getThread, getMessages } from '@/lib/api'
import ThreadDetailClient from '@/components/threads/ThreadDetailClient'

export default function ThreadDetailPage() {
  const { tid } = useParams<{ tid: string }>()
  const [thread, setThread] = useState<AgentThread | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [t, msgs] = await Promise.all([getThread(tid), getMessages(tid)])
      if (t) setThread(t)
      setMessages(msgs)
      setLoading(false)
    }
    load()
  }, [tid])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        載入中...
      </div>
    )
  }

  if (!thread) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        找不到此 thread
      </div>
    )
  }

  return <ThreadDetailClient thread={thread} initialMessages={messages} />
}
