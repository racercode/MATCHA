'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithGoogle } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/threads')
  }, [user, loading, router])

  async function handleGoogle() {
    setSigning(true)
    setError('')
    try {
      await signInWithGoogle()
      router.replace('/threads')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '登入失敗，請再試一次')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)', padding: 24 }}>
      <div style={{ background: 'var(--surface-0)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px 36px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--matcha)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8"/>
              <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 6 }}>Matcha Gov</div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 32 }}>高雄市政府資源媒合後台</div>
        <button
          onClick={handleGoogle}
          disabled={signing}
          style={{ width: '100%', padding: '11px 16px', fontSize: 14, fontWeight: 500, borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-strong)', background: signing ? 'var(--surface-2)' : 'var(--surface-0)', color: signing ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: signing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {signing ? '登入中...' : '以 Google 帳號登入'}
        </button>
        {error && (
          <div style={{ marginTop: 16, padding: '8px 12px', background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius-sm)', fontSize: 12, textAlign: 'left' }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-tertiary)' }}>僅限政府機關人員使用</div>
      </div>
    </div>
  )
}
