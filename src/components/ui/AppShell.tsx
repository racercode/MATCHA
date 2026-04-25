'use client'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const isLogin = path === '/login'

  if (isLogin) return <>{children}</>

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--surface-1)' }}>
        {children}
      </main>
    </div>
  )
}
