'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { signOut } from '@/lib/firebase'

const NAV = [
  {
    href: '/threads',
    label: 'Thread 管理',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 14h6M8 11v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/resources',
    label: '資源管理',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 5h5M5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M12 10.5v3M10.5 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: '統計 Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="8" width="3" height="7" rx="1" fill="currentColor" opacity="0.3"/>
        <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  const displayName = user?.displayName ?? '承辦人'
  const email = user?.email ?? ''
  const initial = displayName[0] ?? '?'
  const photoURL = user?.photoURL

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  return (
    <nav style={{ width: 220, flexShrink: 0, background: 'var(--surface-0)', borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--matcha)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5"/>
              <path d="M4.5 7l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em' }}>Matcha Gov</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -2 }}>政府</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
        {NAV.map((item) => {
          const active = path.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: active ? 500 : 400, color: active ? 'var(--matcha-dark)' : 'var(--text-secondary)', background: active ? 'var(--matcha-light)' : 'transparent' }}
            >
              <span style={{ color: active ? 'var(--matcha)' : 'var(--text-tertiary)', display: 'flex' }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', border: '0.5px solid var(--border)' }}>
          {photoURL ? (
            <img src={photoURL} alt={displayName} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--matcha-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: 'var(--matcha-dark)', flexShrink: 0 }}>
              {initial}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
          </div>
          <button onClick={handleSignOut} title="登出" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2H12a1 1 0 011 1v8a1 1 0 01-1 1H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M6 9.5L9 7l-3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 7H1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}
