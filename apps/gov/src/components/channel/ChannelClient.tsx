'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ChannelMessageItem, ChannelReplyForChannel, GovernmentResource } from '@/types'
import { getChannelMessages, openHumanThread, getResources } from '@/lib/api'

function formatTime(ms: number) {
  const d = new Date(ms)
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(ms: number) {
  const d = new Date(ms)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return '今天'
  return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })
}

function scoreColor(score: number) {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#ca8a04'
  return '#dc2626'
}

function scoreBg(score: number) {
  if (score >= 80) return '#dcfce7'
  if (score >= 60) return '#fef9c3'
  return '#fee2e2'
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.slice(0, 1)
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `hsl(${hue}, 60%, 55%)`,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.4,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function ReplyCard({
  reply,
  resourceName,
  onOpen,
  opening,
}: {
  reply: ChannelReplyForChannel
  resourceName: string
  onOpen: (replyId: string) => void
  opening: string | null
}) {
  const router = useRouter()
  const color = scoreColor(reply.matchScore)
  const bg = scoreBg(reply.matchScore)

  return (
    <div style={{
      background: '#f8f9fa',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 'var(--radius)',
      padding: '10px 14px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 13,
        color: '#fff',
      }}>
        資
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{resourceName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>資源 agent</span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color,
            background: bg,
            padding: '1px 6px',
            borderRadius: 10,
          }}>
            {reply.matchScore} 分
          </span>
        </div>
        <p style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          marginBottom: 8,
        }}>
          {reply.content}
        </p>
        <div>
          {reply.humanThreadOpened && reply.humanThreadId ? (
            <button
              onClick={() => router.push(`/threads/${reply.humanThreadId}`)}
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 4,
                background: '#eff6ff',
                color: 'var(--primary)',
                border: '1px solid #bfdbfe',
              }}
            >
              查看對話
            </button>
          ) : (
            <button
              onClick={() => onOpen(reply.replyId)}
              disabled={opening === reply.replyId}
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 4,
                background: opening === reply.replyId ? '#9ca3af' : 'var(--primary)',
                color: '#fff',
              }}
            >
              {opening === reply.replyId ? '開啟中...' : '開啟對話'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageGroup({ msg, resourceNames, opening, onOpen }: {
  msg: ChannelMessageItem
  resourceNames: Map<string, string>
  opening: string | null
  onOpen: (replyId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar name={msg.citizen.displayName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{msg.citizen.displayName} 的 agent</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: '#eff6ff', padding: '1px 6px', borderRadius: 10 }}>使用者</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {formatDate(msg.publishedAt)} {formatTime(msg.publishedAt)}
            </span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            更新 {msg.citizen.displayName} 的現況，尋求相關資源。
          </p>

          <div style={{
            background: '#f0f4ff',
            border: '1px solid #c7d7f9',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            marginBottom: msg.replies.length > 0 ? 10 : 0,
          }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setExpanded(e => !e)}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3b5fc0' }}>現況廣播</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{expanded ? '▲' : '▼'}</span>
            </div>
            {expanded && (
              <p style={{ fontSize: 13, color: '#374151', marginTop: 8, lineHeight: 1.6 }}>
                {msg.summary}
              </p>
            )}
          </div>

          {msg.replies.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {msg.replies.map(reply => (
                <ReplyCard
                  key={reply.replyId}
                  reply={reply}
                  resourceName={resourceNames.get(reply.govId) ?? reply.govId}
                  onOpen={onOpen}
                  opening={opening}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const CHANNEL = { id: 'taipei-youth', label: '臺北青年', description: '臺北市青年使用者 agent 聚集地' }

export default function ChannelClient() {
  const [messages, setMessages] = useState<ChannelMessageItem[]>([])
  const [resourceNames, setResourceNames] = useState<Map<string, string>>(new Map())
  const [opening, setOpening] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const refresh = useCallback(async (silent = false) => {
    try {
      const [msgs, resources] = await Promise.all([getChannelMessages(30), getResources()])
      setMessages(msgs)
      setResourceNames(new Map(resources.map(r => [r.rid, r.name])))
    } catch {
      // silently fail on background polls
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(() => refresh(true), 10_000)
    return () => clearInterval(timer)
  }, [refresh])

  const handleOpen = async (replyId: string) => {
    setOpening(replyId)
    try {
      const thread = await openHumanThread(replyId)
      router.push(`/threads/${thread.tid}`)
    } catch {
      alert('開啟對話失敗，請稍後再試')
    } finally {
      setOpening(null)
    }
  }

  const memberCount = new Set(messages.map(m => m.uid)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Message feed */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Feed */}
        <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)', position: 'relative' }}>
          {/* MATCHA watermark */}
          <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 0,
          }}>
            <span style={{
              fontSize: 120,
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: 'rgba(0,0,0,0.6)',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ opacity: 1 }}>🍵</span>{' '}<span style={{ opacity: 0.2 }}>MATCHA</span>
            </span>
          </div>

          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              載入中...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              頻道尚無廣播訊息
            </div>
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>
          {messages.map(msg => (
            <MessageGroup
              key={msg.msgId}
              msg={msg}
              resourceNames={resourceNames}
              opening={opening}
              onOpen={handleOpen}
            />
          ))}
          </div>
        </div>
      </div>
    </div>
  )
}
