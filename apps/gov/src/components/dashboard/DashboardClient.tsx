'use client'
import { useState, useEffect } from 'react'
import type { DashboardStats } from '@/types'
import { getDashboard } from '@/lib/api'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '20px 24px',
    }}>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em' }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

const SCORE_RANGES = ['90-100', '70-89', '50-69', '0-49'] as const
const RANGE_COLORS: Record<string, string> = {
  '90-100': '#16a34a',
  '70-89': '#2563eb',
  '50-69': '#ca8a04',
  '0-49': '#dc2626',
}

export default function DashboardClient({ initialStats }: { initialStats: DashboardStats | null }) {
  const [stats, setStats] = useState<DashboardStats | null>(initialStats)
  const [loading, setLoading] = useState(!initialStats)

  useEffect(() => {
    getDashboard()
      .then((s) => {
        setStats(s)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>
        統計 Dashboard
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>媒合成效總覽</p>

      {loading && (
        <p style={{ color: 'var(--text-secondary)' }}>載入中...</p>
      )}

      {!loading && !stats && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 48,
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          無法取得統計資料，請確認後端服務已啟動
        </div>
      )}

      {stats && (
        <>
          {/* Stat cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            marginBottom: 28,
          }}>
            <StatCard
              label="媒合回覆總數"
              value={stats.totalReplies}
            />
            <StatCard
              label="平均媒合分數"
              value={stats.avgMatchScore.toFixed(1)}
              sub="分"
            />
          </div>

          {/* Score distribution */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 24,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>媒合分數分佈</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {SCORE_RANGES.map((range) => {
                const count = stats.scoreDistribution[range] ?? 0
                const total = stats.totalReplies || 1
                const pct = (count / total) * 100
                const color = RANGE_COLORS[range]
                return (
                  <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 56,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}>
                      {range}
                    </span>
                    <div style={{
                      flex: 1,
                      height: 22,
                      background: '#f3f4f6',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 4,
                        transition: 'width 0.4s ease',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 8,
                      }}>
                        {pct > 10 && (
                          <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>
                            {pct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      width: 36,
                      fontSize: 13,
                      fontWeight: 500,
                      color: count > 0 ? color : 'var(--text-secondary)',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}>
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
