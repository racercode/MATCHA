import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import AuthGuard from '@/components/ui/AuthGuard'
import AppShell from '@/components/ui/AppShell'

export const metadata: Metadata = {
  title: 'Matcha Gov',
  description: '政府端媒合管理系統',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <AuthProvider>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  )
}
