import { db } from '../../../lib/firebase.js'
import type { ReadRecentPersonasInput } from '../types.js'

export interface PersonaSummary {
  uid: string
  displayName: string
  summary: string
  needs: string[]
  offers: string[]
  updatedAt: number
}

export async function readRecentPersonasToolWrapper(input: ReadRecentPersonasInput): Promise<PersonaSummary[]> {
  const limit = input.limit ?? 20
  const snap = await db.collection('personas').get()

  return snap.docs
    .map(d => ({
      uid: d.id,
      displayName: d.data().displayName as string,
      summary: d.data().summary as string,
      needs: d.data().needs as string[],
      offers: d.data().offers as string[],
      updatedAt: d.data().updatedAt as number,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}
