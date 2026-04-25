'use client'
import { useEffect, useState } from 'react'
import type { DashboardStats } from '@/types'
import { getDashboard } from '@/lib/api'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    getDashboard().then(setStats)
  }, [])

  if (!stats) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        載入中...
      </div>
    )
  }

  return <DashboardClient stats={stats} />
}
