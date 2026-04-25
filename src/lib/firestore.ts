import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, type Unsubscribe, type Timestamp } from 'firebase/firestore'
import { auth } from '@/lib/firebase'
import type { AgentThread, ThreadMessage, GovernmentResource } from '@/types'

export const db = getFirestore(auth.app)

function toMs(val: any): number {
  if (!val) return Date.now()
  if (typeof val === 'number') return val
  if (val?.toDate) return (val as Timestamp).toDate().getTime()
  if (typeof val === 'string') return new Date(val).getTime()
  return Date.now()
}

const personaCache: Record<string, any> = {}
async function fetchPersona(uid: string) {
  if (personaCache[uid]) return personaCache[uid]
  const snap = await getDoc(doc(db, 'personas', uid))
  const data = snap.exists() ? snap.data() : null
  personaCache[uid] = data
  return data
}

const resourceCache: Record<string, any> = {}
async function fetchResource(rid: string) {
  if (resourceCache[rid]) return resourceCache[rid]
  const snap = await getDoc(doc(db, 'resources', rid))
  const data = snap.exists() ? snap.data() : null
  resourceCache[rid] = data
  return data
}

async function serializeThread(id: string, data: any): Promise<AgentThread> {
  const uid = data.responderId?.replace('user:', '') ?? ''
  const rid = data.initiatorId?.replace('gov:', '') ?? ''

  const [persona, resource] = await Promise.all([
    uid ? fetchPersona(uid) : null,
    rid ? fetchResource(rid) : null,
  ])

  return {
    ...data,
    tid: id,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
    matchScore: data.matchScore !== undefined ? Number(data.matchScore) : undefined,
    userName: data.userName ?? persona?.displayName ?? uid,
    userTags: data.userTags ?? persona?.tags ?? [],
    resourceName: data.resourceName ?? resource?.name ?? rid,
    agencyId: data.agencyId ?? resource?.agencyId ?? '',
  } as AgentThread
}

function serializeMessage(id: string, data: any): ThreadMessage {
  return { ...data, mid: id, createdAt: toMs(data.createdAt) } as ThreadMessage
}

function serializeResource(id: string, data: any): GovernmentResource {
  return { ...data, rid: id, createdAt: toMs(data.createdAt) } as GovernmentResource
}

export async function fsGetThreads(): Promise<AgentThread[]> {
  const snap = await getDocs(query(collection(db, 'threads'), orderBy('updatedAt', 'desc')))
  return Promise.all(snap.docs.map(d => serializeThread(d.id, d.data())))
}

export async function fsGetThread(tid: string): Promise<AgentThread | undefined> {
  const snap = await getDoc(doc(db, 'threads', tid))
  if (!snap.exists()) return undefined
  return serializeThread(snap.id, snap.data())
}

export async function fsUpdateThread(tid: string, data: Partial<AgentThread>): Promise<void> {
  await updateDoc(doc(db, 'threads', tid), { ...data, updatedAt: serverTimestamp() })
}

export function fsListenThread(tid: string, cb: (t: AgentThread) => void): Unsubscribe {
  return onSnapshot(doc(db, 'threads', tid), async snap => {
    if (snap.exists()) cb(await serializeThread(snap.id, snap.data()))
  })
}

export async function fsGetMessages(tid: string): Promise<ThreadMessage[]> {
  const snap = await getDocs(query(collection(db, 'threads', tid, 'messages'), orderBy('createdAt', 'asc')))
  return snap.docs.map(d => serializeMessage(d.id, d.data()))
}

export async function fsPostMessage(tid: string, from: string, content: string): Promise<ThreadMessage> {
  const now = Date.now()
  const ref = await addDoc(collection(db, 'threads', tid, 'messages'), {
    tid, from, type: 'human_note',
    content: { text: content },
    createdAt: serverTimestamp(),
  })
  return { mid: ref.id, tid, from, type: 'human_note', content: { text: content }, createdAt: now }
}

export function fsListenMessages(tid: string, cb: (msgs: ThreadMessage[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'threads', tid, 'messages'), orderBy('createdAt', 'asc')),
    snap => cb(snap.docs.map(d => serializeMessage(d.id, d.data())))
  )
}

export async function fsGetResources(): Promise<GovernmentResource[]> {
  const snap = await getDocs(query(collection(db, 'resources'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => serializeResource(d.id, d.data()))
}

export async function fsCreateResource(r: Omit<GovernmentResource, 'rid' | 'createdAt'>): Promise<GovernmentResource> {
  const now = Date.now()
  const ref = await addDoc(collection(db, 'resources'), { ...r, createdAt: serverTimestamp() })
  resourceCache[ref.id] = { ...r }
  return { ...r, rid: ref.id, createdAt: now }
}
