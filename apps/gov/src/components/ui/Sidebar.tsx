'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

const NAV = [
  { label: '頻道', href: '/channel' },
  { label: '資源管理', href: '/resources' },
  { label: '統計 Dashboard', href: '/dashboard' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <nav style={{
      width: 'var(--sidebar-w)',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 20px', marginBottom: 32 }}>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
          Matcha Gov
        </span>
      </div>

      <ul style={{ listStyle: 'none', flex: 1 }}>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                style={{
                  display: 'block',
                  padding: '9px 20px',
                  fontSize: 15,
                  color: active ? 'var(--primary)' : 'var(--text)',
                  background: active ? '#eff6ff' : 'transparent',
                  fontWeight: active ? 500 : 400,
                  borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>

      {user && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={signOut}
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              background: 'none',
              padding: '4px 0',
            }}
          >
            登出
          </button>
        </div>
      )}
    </nav>
  )
}
