import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

export async function fsGetThreads() {
  const q = query(collection(db, 'channel_replies'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ replyId: d.id, ...d.data() }))
}

export async function fsGetThread(tid: string) {
  const snap = await getDoc(doc(db, 'human_threads', tid))
  return snap.exists() ? { tid: snap.id, ...snap.data() } : null
}

export async function fsUpdateThread(tid: string, data: Partial<DocumentData>) {
  await updateDoc(doc(db, 'human_threads', tid), data)
}

export function fsListenThread(tid: string, cb: (data: DocumentData | null) => void) {
  return onSnapshot(doc(db, 'human_threads', tid), (snap) => {
    cb(snap.exists() ? { tid: snap.id, ...snap.data() } : null)
  })
}

export async function fsGetMessages(tid: string) {
  const q = query(
    collection(db, 'human_threads', tid, 'messages'),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ mid: d.id, ...d.data() }))
}

export async function fsPostMessage(tid: string, from: string, content: string) {
  return addDoc(collection(db, 'human_threads', tid, 'messages'), {
    from,
    content,
    createdAt: Timestamp.now(),
  })
}

export function fsListenMessages(tid: string, cb: (msgs: DocumentData[]) => void) {
  const q = query(
    collection(db, 'human_threads', tid, 'messages'),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ mid: d.id, ...d.data() })))
  })
}

export async function fsGetResources() {
  const snap = await getDocs(collection(db, 'gov_resources'))
  return snap.docs.map((d) => ({ rid: d.id, ...d.data() }))
}

export async function fsCreateResource(r: Record<string, unknown>) {
  const rid = (r.rid as string) ?? `rid-${Date.now()}`
  await setDoc(doc(db, 'gov_resources', rid), {
    ...r,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return { rid, ...r }
}
