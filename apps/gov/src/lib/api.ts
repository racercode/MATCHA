import { auth } from './firebase'
import type { ChannelReply, HumanThread, HumanMessage, GovernmentResource, DashboardStats, ChannelMessageItem } from '@/types'

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

export async function getHumanThreads(): Promise<HumanThread[]> {
  const data = await apiFetch<{ items: HumanThread[] }>('/gov/human-threads')
  return data.items
}

export async function getThread(tid: string): Promise<{ thread: HumanThread | null; reply: ChannelReply | null }> {
  const [replies, threads] = await Promise.all([getThreads(), getHumanThreads()])
  const thread = threads.find((t) => t.tid === tid) ?? null
  const reply = thread
    ? (replies.find((r) => r.replyId === thread.channelReplyId) ?? null)
    : null
  return { thread, reply }
}

export async function openHumanThread(replyId: string): Promise<HumanThread> {
  return apiFetch<HumanThread>(`/gov/channel-replies/${replyId}/open`, { method: 'POST' })
}

export async function getHumanMessages(tid: string): Promise<HumanMessage[]> {
  const data = await apiFetch<{ items: HumanMessage[] }>(`/human-threads/${tid}/messages`)
  return data.items
}

export async function sendHumanMessage(tid: string, content: string): Promise<HumanMessage> {
  return apiFetch<HumanMessage>(`/human-threads/${tid}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
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
