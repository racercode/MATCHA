'use client'
import { useEffect, useState } from 'react'
import type { AgentThread } from '@/types'
import { getThreads } from '@/lib/api'
import ThreadListClient from '@/components/threads/ThreadListClient'

export default function ThreadsPage() {
  const [threads, setThreads] = useState<AgentThread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getThreads().then(t => { setThreads(t); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        載入中...
      </div>
    )
  }

  return <ThreadListClient initialThreads={threads} />
}
