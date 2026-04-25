'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { AgentThread, ThreadMessage, PresenceMode } from '@/types'
import { StatusBadge, PresenceDot, ScoreBar } from '@/components/ui/Badges'
import { postMessage, joinThread, leaveThread } from '@/lib/api'
import { fsListenMessages, fsListenThread } from '@/lib/firestore'
import { useAuth } from '@/lib/AuthContext'

function formatTime(val: number | string) {
  try {
    const d = typeof val === "number" ? new Date(val) : new Date(val)
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function senderLabel(from: string, govName: string) {
  if (from.startsWith('gov_agent')) return 'Gov Agent'
  if (from.startsWith('persona_agent')) return 'Persona Agent'
  if (from === 'system') return ''
  if (from === 'human:gov') return `承辦人 ${govName}`
  if (from.startsWith('human:')) return '市民 (真人)'
  return from
}

function bubbleStyle(from: string): React.CSSProperties {
  if (from.startsWith('gov_agent')) return { background: 'var(--matcha-light)', border: '0.5px solid var(--matcha-mid)', color: 'var(--matcha-dark)' }
  if (from === 'human:gov') return { background: 'var(--blue-bg)', border: '0.5px solid #B5D4F4', color: '#042C53' }
  if (from.startsWith('human:')) return { background: 'var(--purple-bg)', border: '0.5px solid #CECBF6', color: '#26215C' }
  if (from === 'system') return { background: 'var(--surface-1)', border: '0.5px dashed var(--border-strong)', color: 'var(--text-tertiary)', fontSize: 12, borderRadius: 'var(--radius-sm)' }
  return { background: 'var(--surface-0)', border: '0.5px solid var(--border)' }
}

function msgAlign(from: string): 'flex-start' | 'flex-end' | 'center' {
  if (from === 'system') return 'center'
  if (from.startsWith('gov_agent') || from === 'human:gov') return 'flex-end'
  return 'flex-start'
}

export default function ThreadDetailClient({
  thread: initialThread,
  initialMessages,
}: {
  thread: AgentThread
  initialMessages: ThreadMessage[]
}) {
  const { user } = useAuth()
  const govName = user?.displayName ?? '承辦人'

  const [thread, setThread] = useState(initialThread)
  const [messages, setMessages] = useState(initialMessages)
  const [takenOver, setTakenOver] = useState(
    initialThread.govPresence === 'human' || initialThread.status === 'human_takeover'
  )
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 即時監聽 thread 狀態
  useEffect(() => {
    const unsub = fsListenThread(thread.tid, (t) => {
      setThread(t)
      setTakenOver(t.govPresence === 'human' || t.status === 'human_takeover')
    })
    return unsub
  }, [thread.tid])

  // 即時監聽訊息
  useEffect(() => {
    const unsub = fsListenMessages(thread.tid, (msgs) => {
      setMessages(msgs)
    })
    return unsub
  }, [thread.tid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleTakeover() {
    await joinThread(thread.tid)
    await postMessage(thread.tid, `承辦人 ${govName} 加入對話，Gov Agent 已靜音`, 'system')
  }

  async function handleLeave() {
    await leaveThread(thread.tid)
    await postMessage(thread.tid, `承辦人 ${govName} 移交 Gov Agent，恢復自動協商`, 'system')
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    try {
      await postMessage(thread.tid, text)
    } finally {
      setSending(false)
    }
  }

  const isEnded = thread.status === 'matched' || thread.status === 'rejected'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', background: 'var(--surface-0)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <Link href="/threads" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }}>
          ‹ 返回
        </Link>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--matcha-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: 'var(--matcha-dark)', flexShrink: 0 }}>
            {thread.userName?.[0] ?? '?'}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{thread.userName} · {thread.resourceName}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {thread.userTags?.map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'var(--surface-2)', border: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <StatusBadge status={thread.status} />
          {!isEnded && !takenOver && (
            <button onClick={handleTakeover} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 'var(--radius-md)', background: '#185FA5', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer' }}>
              接手對話
            </button>
          )}
        </div>
      </div>

      {/* Presence bar */}
      <div style={{ padding: '9px 24px', background: 'var(--surface-0)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>市民</span>
          <PresenceDot mode={thread.userPresence} label={thread.userPresence === 'human' ? '真人在線' : 'Agent 代理'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>政府</span>
          <PresenceDot mode={thread.govPresence} label={thread.govPresence === 'human' ? '承辦人接手' : 'Gov Agent'} />
        </div>
        {thread.matchScore !== undefined && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>媒合度</span>
            <ScoreBar score={thread.matchScore} />
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, marginTop: 40 }}>
            尚無訊息
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.mid} style={{ display: 'flex', flexDirection: 'column', alignItems: msgAlign(msg.from), maxWidth: msg.from === 'system' ? '100%' : '70%', alignSelf: msgAlign(msg.from) }}>
            {msg.from !== 'system' && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>
                {senderLabel(msg.from, govName)} · {formatTime(msg.createdAt)}
              </div>
            )}
            <div style={{ padding: msg.from === 'system' ? '5px 14px' : '9px 13px', borderRadius: 'var(--radius-lg)', fontSize: 13, lineHeight: 1.55, ...bubbleStyle(msg.from) }}>
              {msg.content.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div style={{ padding: '12px 24px', background: 'var(--surface-0)', borderTop: '0.5px solid var(--border)' }}>
        {isEnded ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '4px 0' }}>此 thread 已結束</div>
        ) : takenOver ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', background: 'var(--matcha-light)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--matcha-mid)' }}>
              <span style={{ fontSize: 12, color: 'var(--matcha-dark)', flex: 1 }}>您正在接手對話 — Gov Agent 已靜音</span>
              <button onClick={handleLeave} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--red-text)', border: '0.5px solid var(--red-bg)', cursor: 'pointer' }}>
                移交 Agent
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="輸入訊息..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button onClick={handleSend} disabled={sending || !input.trim()} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius-md)', background: input.trim() ? 'var(--matcha)' : 'var(--surface-2)', color: input.trim() ? '#fff' : 'var(--text-tertiary)', border: 'none', cursor: input.trim() ? 'pointer' : 'default' }}>
                {sending ? '送出中...' : '送出'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--blue-bg)', borderRadius: 'var(--radius-md)', border: '0.5px solid #B5D4F4' }}>
            <span style={{ fontSize: 12, color: 'var(--blue-text)', flex: 1 }}>Agent 協商中 — 隨時可接手</span>
            <button onClick={handleTakeover} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--radius-md)', background: '#185FA5', color: '#fff', border: 'none', cursor: 'pointer' }}>
              接手對話
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
