'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AgentThread, ThreadStatus } from '@/types'
import { StatusBadge, PresenceDot, ScoreBar } from '@/components/ui/Badges'
import { fsGetThreads } from '@/lib/firestore'

type Filter = 'all' | ThreadStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'negotiating', label: '協商中' },
  { key: 'human_takeover', label: '真人接手' },
  { key: 'matched', label: '已媒合' },
  { key: 'rejected', label: '已拒絕' },
]

function relativeTime(val: any) {
  try {
    const d = val?.toDate ? val.toDate() : new Date(val)
    const diff = Date.now() - d.getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '剛剛'
    if (m < 60) return `${m} 分鐘前`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} 小時前`
    return `${Math.floor(h / 24)} 天前`
  } catch { return '' }
}

export default function ThreadListClient({ initialThreads }: { initialThreads: AgentThread[] }) {
  const router = useRouter()
  const [threads, setThreads] = useState(initialThreads)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  // 每 10 秒重新拉一次（Firestore 即時監聽整個 collection 成本較高，輪詢即可）
  useEffect(() => {
    const tick = async () => {
      const fresh = await fsGetThreads()
      setThreads(fresh)
    }
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [])

  const visible = threads.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        t.userName?.toLowerCase().includes(q) ||
        t.resourceName?.toLowerCase().includes(q) ||
        t.userTags?.some(tag => tag.includes(q))
      )
    }
    return true
  })

  const counts: Record<string, number> = { all: threads.length }
  threads.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1 })

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>Thread 管理</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>監控 Agent 媒合協商，隨時接手對話</p>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '總 Threads', value: counts.all ?? 0, color: 'var(--text-primary)' },
          { label: '協商中', value: counts.negotiating ?? 0, color: 'var(--amber-text)' },
          { label: '真人接手', value: counts.human_takeover ?? 0, color: 'var(--blue-text)' },
          { label: '已媒合', value: counts.matched ?? 0, color: 'var(--green-text)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface-0)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: '0.5px solid', borderColor: filter === f.key ? 'var(--matcha)' : 'var(--border)', background: filter === f.key ? 'var(--matcha)' : 'transparent', color: filter === f.key ? '#fff' : 'var(--text-secondary)', fontWeight: filter === f.key ? 500 : 400, cursor: 'pointer' }}>
              {f.label}
              {counts[f.key] !== undefined && (
                <span style={{ marginLeft: 5, fontSize: 11, opacity: filter === f.key ? 0.8 : 0.6 }}>{counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="搜尋市民、資源、標籤..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 220, padding: '6px 12px', fontSize: 13, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-0)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface-0)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 90px 120px 80px 36px', padding: '10px 20px', borderBottom: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
          <span>市民 / 資源</span>
          <span>標籤</span>
          <span>狀態</span>
          <span>Presence</span>
          <span>媒合度</span>
          <span />
        </div>

        {visible.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            {threads.length === 0 ? 'Firestore 尚無資料' : '沒有符合條件的 thread'}
          </div>
        )}

        {visible.map((t, i) => (
          <div
            key={t.tid}
            onClick={() => router.push(`/threads/${t.tid}`)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 160px 90px 120px 80px 36px', padding: '14px 20px', borderBottom: i < visible.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{t.userName ?? t.responderId}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.resourceName ?? t.initiatorId} · {t.agencyId ?? ''}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{relativeTime(t.updatedAt)}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {(t.userTags ?? []).slice(0, 2).map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)' }}>{tag}</span>
              ))}
              {(t.userTags?.length ?? 0) > 2 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{(t.userTags?.length ?? 0) - 2}</span>}
            </div>
            <StatusBadge status={t.status} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <PresenceDot mode={t.userPresence} label={t.userPresence === 'human' ? '市民真人' : '市民 Agent'} />
              <PresenceDot mode={t.govPresence} label={t.govPresence === 'human' ? '承辦人' : 'Gov Agent'} />
            </div>
            {t.matchScore !== undefined
              ? <ScoreBar score={t.matchScore} />
              : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
            }
            <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
