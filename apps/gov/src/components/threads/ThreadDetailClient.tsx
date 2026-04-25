'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { HumanThread, ChannelReply, HumanMessage } from '@/types'
import { getThread, getHumanMessages } from '@/lib/api'
import { useHumanChat } from '@/lib/useHumanChat'
import { ScoreBar, StatusBadge } from '@/components/ui/Badges'

interface Props {
  tid: string
  initialThread: HumanThread | null
  initialReply: ChannelReply | null
  initialMessages: HumanMessage[]
}

function formatTs(ts: number | { seconds: number; nanoseconds: number }): string {
  const ms = typeof ts === 'number' ? ts : ts.seconds * 1000
  return new Date(ms).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function isGovSender(from: string): boolean {
  return from.startsWith('gov:') || from.startsWith('gov_agent') || from.startsWith('gov_staff')
}

export default function ThreadDetailClient({ tid, initialThread, initialReply, initialMessages }: Props) {
  const [thread, setThread] = useState<HumanThread | null>(initialThread)
  const [reply, setReply] = useState<ChannelReply | null>(initialReply)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const { messages, sendMessage, connected } = useHumanChat(tid, initialMessages)

  useEffect(() => {
    getThread(tid)
      .then(({ thread: t, reply: r }) => {
        if (t) setThread(t)
        if (r) setReply(r)
      })
      .catch(() => {})

    getHumanMessages(tid).catch(() => {})
  }, [tid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input.trim())
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{
        padding: '14px 28px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/threads')}
            style={{
              color: 'var(--text-secondary)',
              background: 'none',
              fontSize: 20,
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ←
          </button>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500 }}>
              {thread?.citizen.displayName ?? '人工對話'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 1 }}>
              {tid}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {thread && (
            <>
              <StatusBadge status={thread.status} />
              <div style={{ width: 120 }}>
                <ScoreBar score={thread.matchScore} />
              </div>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? 'var(--success)' : '#9ca3af',
              display: 'inline-block',
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {connected ? '已連線' : '未連線'}
            </span>
          </div>
        </div>
      </div>

      {/* Context banner */}
      {(thread?.citizen.summary || reply?.content) && (
        <div style={{
          padding: '10px 28px',
          background: '#f0f9ff',
          borderBottom: '1px solid #bae6fd',
          fontSize: 13,
          color: '#0369a1',
          flexShrink: 0,
        }}>
          {thread?.citizen.summary && (
            <span>
              <strong>市民摘要：</strong>{thread.citizen.summary}
            </span>
          )}
          {reply?.content && (
            <span style={{ marginLeft: 20 }}>
              <strong>媒合理由：</strong>{reply.content}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 48, fontSize: 13 }}>
            {connected ? '尚無訊息，請開始對話' : '連線中，請稍候...'}
          </p>
        )}
        {messages.map((msg) => {
          const gov = isGovSender(msg.from)
          return (
            <div key={msg.mid} style={{ display: 'flex', justifyContent: gov ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '65%',
                padding: '10px 14px',
                borderRadius: 12,
                background: gov ? 'var(--primary)' : 'var(--surface)',
                color: gov ? '#fff' : 'var(--text)',
                border: gov ? 'none' : '1px solid var(--border)',
              }}>
                {!gov && (
                  <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                    {thread?.citizen.displayName ?? '市民'}
                  </p>
                )}
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>{msg.content}</p>
                <p style={{ fontSize: 11, opacity: 0.65, textAlign: 'right', marginTop: 4 }}>
                  {formatTs(msg.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '14px 28px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        gap: 10,
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="輸入訊息，Enter 送出..."
          disabled={!connected}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: connected ? 'var(--bg)' : '#f3f4f6',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!connected || !input.trim()}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius)',
            background: connected && input.trim() ? 'var(--primary)' : '#9ca3af',
            color: '#fff',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          送出
        </button>
      </div>
    </div>
  )
}
