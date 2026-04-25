'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

export default function LoginClient() {
  const { user, loading, role, signInWithGoogle } = useAuth()
  const router = useRouter()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && role === 'gov_staff') {
      router.replace('/threads')
    }
  }, [loading, role, router])

  const handleGoogleLogin = async () => {
    setSigningIn(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google 登入失敗')
      setSigningIn(false)
    }
  }

  if (loading || signingIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>載入中...</p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--surface)', padding: 40, borderRadius: 12,
        border: '1px solid var(--border)', maxWidth: 360, width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Matcha Gov</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>政府端媒合管理系統</p>

        {role === 'citizen' && (
          <p style={{ color: 'var(--danger)', marginBottom: 16, fontSize: 13 }}>
            此帳號無政府人員存取權限
          </p>
        )}
        {error && (
          <p style={{ color: 'var(--danger)', marginBottom: 16, fontSize: 13 }}>{error}</p>
        )}

        {!user ? (
          <button
            onClick={handleGoogleLogin}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#fff', color: '#3c4043', padding: '10px 24px',
              borderRadius: 6, width: '100%', fontSize: 14,
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            <GoogleIcon />
            使用 Google 帳號登入
          </button>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            正在驗證政府人員身分...
          </p>
        )}

        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          登入後，請由管理員在 Firestore<br />
          <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
            /gov_staff/{user ? user.uid : '{uid}'}, {role}
          </code>{' '}
          建立帳號授權
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}
