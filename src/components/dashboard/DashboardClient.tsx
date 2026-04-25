'use client'
import type { DashboardStats } from '@/types'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: color ?? 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data }: { data: { date: string; matched: number; negotiating: number }[] }) {
  const max = Math.max(...data.map((d) => d.matched + d.negotiating))
  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>每日媒合趨勢</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, background: 'var(--matcha)', borderRadius: 2, display: 'inline-block' }} />
            已媒合
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, background: 'var(--amber-bg)', border: '1px solid var(--amber-text)', borderRadius: 2, display: 'inline-block' }} />
            協商中
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160 }}>
        {data.map((d) => {
          const matchedH = max > 0 ? (d.matched / max) * 140 : 0
          const negotiatingH = max > 0 ? (d.negotiating / max) * 140 : 0
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 2 }}>
                <div
                  title={`協商中: ${d.negotiating}`}
                  style={{
                    width: '100%',
                    height: negotiatingH,
                    background: 'var(--amber-bg)',
                    border: '0.5px solid var(--amber-text)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.3s',
                  }}
                />
                <div
                  title={`已媒合: ${d.matched}`}
                  style={{
                    width: '100%',
                    height: matchedH,
                    background: 'var(--matcha)',
                    borderRadius: 3,
                    transition: 'height 0.3s',
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{d.date}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TagCloud({ data }: { data: { tag: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count))
  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 20 }}>標籤分佈</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((d) => (
          <div key={d.tag} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 80, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' }}>
              {d.tag}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: 'var(--surface-2)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(d.count / max) * 100}%`,
                  height: '100%',
                  background: 'var(--matcha)',
                  borderRadius: 4,
                  transition: 'width 0.4s',
                }}
              />
            </div>
            <span style={{ width: 24, fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HumanVsAgent({ humanRate, matchRate }: { humanRate: number; matchRate: number }) {
  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 20 }}>介入模式</div>
      {[
        { label: '全程 Agent 自主媒合', value: 100 - humanRate, color: 'var(--purple-bg)', textColor: 'var(--purple-text)' },
        { label: '承辦人介入', value: humanRate, color: 'var(--blue-bg)', textColor: 'var(--blue-text)' },
        { label: '媒合成功率', value: matchRate, color: 'var(--matcha-light)', textColor: 'var(--matcha-dark)' },
      ].map((item) => (
        <div key={item.label} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: item.textColor }}>{item.value.toFixed(1)}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${item.value}%`,
                height: '100%',
                background: item.textColor,
                borderRadius: 4,
                opacity: 0.7,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardClient({ stats }: { stats: DashboardStats }) {
  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>
          統計 Dashboard
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>媒合效率、標籤分佈與承辦人介入率總覽</p>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard label="總 Threads" value={stats.totalThreads} sub="本月累計" />
        <StatCard label="已媒合" value={stats.matchedCount} color="var(--green-text)" sub={`成功率 ${stats.matchRatePercent.toFixed(1)}%`} />
        <StatCard label="真人介入" value={stats.humanTakeoverCount} color="var(--blue-text)" sub={`佔比 ${stats.humanTakeoverRatePercent.toFixed(1)}%`} />
        <StatCard label="協商中" value={stats.negotiatingCount} color="var(--amber-text)" sub="進行中" />
      </div>

      {/* Chart row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <BarChart data={stats.dailyMatches} />
        <HumanVsAgent
          humanRate={stats.humanTakeoverRatePercent}
          matchRate={stats.matchRatePercent}
        />
      </div>

      {/* Tag cloud */}
      <TagCloud data={stats.tagDistribution} />
    </div>
  )
}
