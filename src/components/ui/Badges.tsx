import type { ThreadStatus, PresenceMode } from '@/types'

const STATUS_MAP: Record<ThreadStatus, { label: string; bg: string; color: string }> = {
  negotiating:    { label: '協商中',   bg: 'var(--amber-bg)',  color: 'var(--amber-text)' },
  matched:        { label: '已媒合',   bg: 'var(--green-bg)',  color: 'var(--green-text)' },
  human_takeover: { label: '真人接手', bg: 'var(--blue-bg)',   color: 'var(--blue-text)' },
  rejected:       { label: '已拒絕',   bg: 'var(--red-bg)',    color: 'var(--red-text)' },
}

export function StatusBadge({ status }: { status: ThreadStatus }) {
  const s = STATUS_MAP[status]
  return (
    <span
      style={{
        fontSize: 11,
        padding: '3px 9px',
        borderRadius: 20,
        fontWeight: 500,
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

export function PresenceDot({ mode, label }: { mode: PresenceMode; label?: string }) {
  const color = mode === 'human' || mode === 'both' ? '#378ADD' : '#7F77DD'
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {label && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>}
    </span>
  )
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#1D9E75' : score >= 60 ? '#BA7517' : '#E24B4A'
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span
        style={{
          width: 64,
          height: 4,
          background: 'var(--surface-2)',
          borderRadius: 2,
          overflow: 'hidden',
          display: 'inline-block',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${score}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
          }}
        />
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color }}>{score}%</span>
    </span>
  )
}
