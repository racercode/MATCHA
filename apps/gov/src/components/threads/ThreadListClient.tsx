'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ChannelReply } from '@/types'
import { getThreads, getResources } from '@/lib/api'
import { ScoreBar } from '@/components/ui/Badges'

interface Props {
  initialReplies: ChannelReply[]
}

export default function ThreadListClient({ initialReplies }: Props) {
  const [replies, setReplies] = useState<ChannelReply[]>(initialReplies)
  const [resourceNames, setResourceNames] = useState<Map<string, string>>(new Map())
  const [search, setSearch] = useState('')
  const [minScore, setMinScore] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const [r, resources] = await Promise.all([getThreads(), getResources()])
      setReplies(r)
      setResourceNames(new Map(resources.map((res) => [res.rid, res.name])))
    } catch {
      // silently fail on background polls
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 10_000)
    return () => clearInterval(timer)
  }, [refresh])

  const filtered = replies.filter(
    (r) =>
      r.matchScore >= minScore &&
      (search === '' ||
        r.citizen.displayName.toLowerCase().includes(search.toLowerCase()) ||
        r.citizen.summary.toLowerCase().includes(search.toLowerCase()) ||
        (resourceNames.get(r.govId) ?? r.govId).toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>
        Thread 管理
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        GovAgent 媒合回覆 — 每 10 秒自動更新
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          placeholder="搜尋市民姓名、摘要或資源..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
          }}
        />
        <select
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
          }}
        >
          <option value={0}>全部分數</option>
          <option value={70}>70 分以上</option>
          <option value={80}>80 分以上</option>
          <option value={90}>90 分以上</option>
        </select>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: '#f9fafb' }}>
              {['市民', '摘要', '媒合分數', '資源'].map((h) => (
                <th key={h} style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} style={{
                  padding: 48,
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}>
                  尚無媒合回覆
                </td>
              </tr>
            )}
            {filtered.map((reply) => (
              <tr
                key={reply.replyId}
                style={{
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = ''
                }}
              >
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  {reply.citizen.displayName}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: 300 }}>
                  <div style={{
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    fontSize: 13,
                  }}>
                    {reply.citizen.summary}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', width: 160 }}>
                  <ScoreBar score={reply.matchScore} />
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {resourceNames.get(reply.govId) ?? reply.govId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
        共 {filtered.length} 筆
        {filtered.length !== replies.length && `（已篩選，共 ${replies.length} 筆）`}
      </p>
    </div>
  )
}
