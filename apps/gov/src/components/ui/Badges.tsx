import type { PresenceState } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: '進行中', color: '#16a34a', bg: '#dcfce7' },
  closed: { label: '已關閉', color: '#6b7280', bg: '#f3f4f6' },
  negotiating: { label: '協商中', color: '#ca8a04', bg: '#fef9c3' },
  matched: { label: '已媒合', color: '#2563eb', bg: '#eff6ff' },
  rejected: { label: '已拒絕', color: '#dc2626', bg: '#fee2e2' },
  human_takeover: { label: '人工介入', color: '#7c3aed', bg: '#ede9fe' },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 500,
      color: cfg.color,
      background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  )
}

const PRESENCE_CONFIG: Record<PresenceState, { color: string; label: string }> = {
  agent: { color: '#2563eb', label: 'Agent' },
  human: { color: '#16a34a', label: 'Human' },
  both: { color: '#7c3aed', label: 'Both' },
}

export function PresenceDot({ mode, label }: { mode: PresenceState; label?: string }) {
  const cfg = PRESENCE_CONFIG[mode]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: cfg.color,
        display: 'inline-block',
      }} />
      {label !== undefined ? label : cfg.label}
    </span>
  )
}

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1,
        height: 6,
        background: '#e5e7eb',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color, minWidth: 28, textAlign: 'right' }}>
        {pct}
      </span>
    </div>
  )
}
