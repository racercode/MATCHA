'use client'
import { useEffect, useState } from 'react'
import type { GovernmentResource } from '@/types'
import { getResources } from '@/lib/api'
import ResourcesClient from '@/components/resources/ResourcesClient'

export default function ResourcesPage() {
  const [resources, setResources] = useState<GovernmentResource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getResources().then(r => { setResources(r); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        載入中...
      </div>
    )
  }

  return <ResourcesClient initialResources={resources} />
}
