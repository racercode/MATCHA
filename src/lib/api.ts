import {
  fsGetThreads,
  fsGetThread,
  fsGetMessages,
  fsPostMessage,
  fsUpdateThread,
  fsGetResources,
  fsCreateResource,
} from '@/lib/firestore'
import type { AgentThread, ThreadMessage, GovernmentResource, DashboardStats } from '@/types'

export async function getThreads(): Promise<AgentThread[]> {
  return fsGetThreads()
}

export async function getThread(tid: string): Promise<AgentThread | undefined> {
  return fsGetThread(tid)
}

export async function getMessages(tid: string): Promise<ThreadMessage[]> {
  return fsGetMessages(tid)
}

export async function postMessage(tid: string, content: string, from = 'human:gov'): Promise<ThreadMessage> {
  return fsPostMessage(tid, from, content)
}

export async function joinThread(tid: string): Promise<void> {
  await fsUpdateThread(tid, { govPresence: 'human', status: 'human_takeover' })
}

export async function leaveThread(tid: string): Promise<void> {
  await fsUpdateThread(tid, { govPresence: 'agent' })
}

export async function getResources(): Promise<GovernmentResource[]> {
  return fsGetResources()
}

export async function createResource(r: Omit<GovernmentResource, 'rid' | 'createdAt'>): Promise<GovernmentResource> {
  return fsCreateResource(r)
}

export async function getDashboard(): Promise<DashboardStats> {
  const threads = await fsGetThreads()
  const total = threads.length
  const matched = threads.filter(t => t.status === 'matched').length
  const humanTakeover = threads.filter(t => t.status === 'human_takeover').length
  const negotiating = threads.filter(t => t.status === 'negotiating').length

  // 標籤分佈
  const tagCount: Record<string, number> = {}
  threads.forEach(t => {
    t.userTags?.forEach(tag => {
      tagCount[tag] = (tagCount[tag] ?? 0) + 1
    })
  })
  const tagDistribution = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }))

  // 每日趨勢 — 把 threads 按日期分組
  const dayMap: Record<string, { matched: number; negotiating: number }> = {}
  threads.forEach(t => {
    const d = new Date(t.updatedAt)
    const label = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
    if (!dayMap[label]) dayMap[label] = { matched: 0, negotiating: 0 }
    if (t.status === 'matched') dayMap[label].matched++
    else if (t.status === 'negotiating') dayMap[label].negotiating++
  })

  // 補足最近 7 天（沒資料的天填 0）
  const days: { date: string; matched: number; negotiating: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const label = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
    days.push({ date: label, matched: dayMap[label]?.matched ?? 0, negotiating: dayMap[label]?.negotiating ?? 0 })
  }

  return {
    totalThreads: total,
    matchedCount: matched,
    humanTakeoverCount: humanTakeover,
    negotiatingCount: negotiating,
    matchRatePercent: total > 0 ? Math.round((matched / total) * 1000) / 10 : 0,
    humanTakeoverRatePercent: total > 0 ? Math.round((humanTakeover / total) * 1000) / 10 : 0,
    tagDistribution,
    dailyMatches: days,
  }
}
