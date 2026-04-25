'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const path = usePathname()

  useEffect(() => {
    if (!loading && !user && path !== '/login') {
      router.replace('/login')
    }
  }, [user, loading, path, router])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-tertiary)', fontSize: 13 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--matcha)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        載入中...
      </div>
    )
  }

  if (!user && path !== '/login') return null

  return <>{children}</>
}
