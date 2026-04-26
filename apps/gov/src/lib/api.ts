import { auth } from './firebase'
import type { ChannelReply, GovernmentResource, DashboardStats, DashboardAgents, DashboardUsers, DashboardMatchStats, ChannelMessageItem } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  if (options?.headers) {
    Object.assign(headers, options.headers)
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  const json = await res.json()
  return json.data
}

export async function getThreads(): Promise<ChannelReply[]> {
  const data = await apiFetch<{ items: ChannelReply[] }>('/gov/channel-replies')
  return data.items
}

export async function getResources(): Promise<GovernmentResource[]> {
  const data = await apiFetch<{ items: GovernmentResource[] }>('/gov/resources')
  return data.items
}

export async function createResource(r: Record<string, unknown>): Promise<GovernmentResource> {
  return apiFetch<GovernmentResource>('/gov/resources', {
    method: 'POST',
    body: JSON.stringify(r),
  })
}

export async function uploadResourceDocument(rid: string, file: File): Promise<void> {
  const token = await getToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_URL}/gov/resources/${rid}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
}

export async function getChannelMessages(limit = 30): Promise<ChannelMessageItem[]> {
  const data = await apiFetch<{ items: ChannelMessageItem[] }>(`/gov/channel-messages?limit=${limit}`)
  return data.items
}

export async function getDashboard(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/gov/dashboard')
}

export async function getDashboardAgents(): Promise<DashboardAgents> {
  return apiFetch<DashboardAgents>('/gov/dashboard/agents')
}

export async function getDashboardUsers(): Promise<DashboardUsers> {
  return apiFetch<DashboardUsers>('/gov/dashboard/users')
}

export async function getDashboardStats(): Promise<DashboardMatchStats> {
  return apiFetch<DashboardMatchStats>('/gov/dashboard/stats')
}
