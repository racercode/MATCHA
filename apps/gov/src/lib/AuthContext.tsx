'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './firebase'
import { error } from 'console'

interface AuthContextValue {
  user: User | null
  loading: boolean
  role: 'citizen' | 'gov_staff' | null
  govId: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  role: null,
  govId: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'citizen' | 'gov_staff' | null>(null)
  const [govId, setGovId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          const token = await u.getIdToken()
          const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          })    
          const data = await res.json()
          console.log(data)
          if (data.success) {
            setRole(data.data.role)
            setGovId(data.data.govId ?? null)
          }
        } catch(e) {
          setRole('citizen')
        }
      } else {
        setRole(null)
        setGovId(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const handleSignInWithGoogle = async () => {
    const { signInWithGoogle } = await import('./firebase')
    await signInWithGoogle()
  }

  const handleSignOut = async () => {
    const { signOut } = await import('./firebase')
    await signOut()
    setRole(null)
    setGovId(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, role, govId, signInWithGoogle: handleSignInWithGoogle, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
