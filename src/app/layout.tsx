import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import AuthGuard from '@/components/ui/AuthGuard'
import AppShell from '@/components/ui/AppShell'

export const metadata: Metadata = {
  title: 'Matcha Gov — 政府資源媒合後台',
  description: '承辦人 Thread 管理與 Agent 協商監控系統',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <AuthProvider>
          <AuthGuard>
            <AppShell>
              {children}
            </AppShell>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  )
}
