'use client'
import { useState, useEffect } from 'react'
import type { DashboardStats, DashboardAgents, DashboardUsers, DashboardMatchStats } from '@/types'
import { getDashboard, getDashboardAgents, getDashboardUsers, getDashboardStats } from '@/lib/api'

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


interface AllDashboardData {
  stats: DashboardStats
  agents: DashboardAgents
  users: DashboardUsers
  matchStats: DashboardMatchStats
}

export default function DashboardClient({ initialStats }: { initialStats: DashboardStats | null }) {
  const [data, setData] = useState<AllDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getDashboard(),
      getDashboardAgents(),
      getDashboardUsers(),
      getDashboardStats(),
    ])
      .then(([stats, agents, users, matchStats]) => {
        setData({ stats, agents, users, matchStats })
        setLoading(false)
      })
      .catch(() => {
        // fallback: at least show initialStats if the new endpoints fail
        if (initialStats) setData({ stats: initialStats, agents: { agentCount: 0, agents: [] }, users: { userCount: 0 }, matchStats: { totalAttempts: 0, totalMatches: 0, matchRate: 0, resources: [] } })
        setLoading(false)
      })
  }, [initialStats])

  const stats = data?.stats ?? null
  const agents = data?.agents ?? null
  const users = data?.users ?? null
  const matchStats = data?.matchStats ?? null

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>
        媒合成效總覽
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>即時追蹤 AI 媒合與對話狀況</p>

      {loading && (
        <p style={{ color: 'var(--text-secondary)' }}>載入中...</p>
      )}

      {!loading && !data && (
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

      {!loading && data && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            <StatCard label="AI 推薦總次數" value={stats?.totalReplies ?? '—'} sub="累計媒合回覆" />
            <StatCard label="已開啟真人對話" value={stats?.openedConversations ?? '—'} sub={stats ? `共 ${stats.totalReplies} 筆推薦` : undefined} />
            <StatCard label="對話轉換率" value={stats ? `${(stats.openRate * 100).toFixed(1)}%` : '—'} sub="推薦 → 開啟對話" />
            <StatCard label="服務資源數" value={agents?.agentCount ?? '—'} sub="上線中的 AI 資源" />
            <StatCard label="服務人次" value={users?.userCount ?? '—'} sub="建立 persona 的市民" />
            <StatCard label="AI 評估次數" value={matchStats?.totalAttempts ?? '—'} sub="所有資源合計" />
            <StatCard label="整體媒合成功率" value={matchStats ? `${matchStats.matchRate.toFixed(1)}%` : '—'} sub={matchStats ? `${matchStats.totalMatches} 次成功` : undefined} />
            <StatCard label="媒合成功筆數" value={matchStats?.totalMatches ?? '—'} sub="達門檻的推薦" />
          </div>

          {/* Active agents list */}
          {agents && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 24,
              marginBottom: 20,
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>
                目前上線資源（{agents.agentCount} 項）
              </h2>
              {agents.agents.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>尚無上線資源</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {agents.agents.map((a) => (
                    <div key={a.rid} style={{
                      padding: '6px 12px',
                      background: '#f9fafb',
                      borderRadius: 6,
                      fontSize: 13,
                    }}>
                      <span style={{ fontWeight: 500 }}>{a.name}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 11 }}>{a.rid}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-resource match stats bar chart */}
          {matchStats && matchStats.resources.length > 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 24,
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>資源熱度排行榜</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[...matchStats.resources]
                  .sort((a, b) => b.matchRate - a.matchRate)
                  .map((r) => {
                    const color = r.matchRate >= 30 ? '#16a34a' : r.matchRate >= 15 ? '#2563eb' : '#94a3b8'
                    return (
                      <div key={r.resourceId}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{r.resourceName || r.resourceId}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 12, whiteSpace: 'nowrap' }}>
                            {r.totalMatches} 次成功 / 評估 {r.totalAttempts} 次
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 20, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(r.matchRate, 100)}%`,
                              height: '100%',
                              background: color,
                              borderRadius: 4,
                              transition: 'width 0.4s ease',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: 8,
                              minWidth: r.matchRate > 0 ? 2 : 0,
                            }}>
                              {r.matchRate >= 12 && (
                                <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                                  {r.matchRate.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ width: 44, fontSize: 12, fontWeight: 600, color, textAlign: 'right', flexShrink: 0 }}>
                            {r.matchRate < 12 ? `${r.matchRate.toFixed(1)}%` : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
