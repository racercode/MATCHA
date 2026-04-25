import { db } from '../../../lib/firebase.js'
import type { UserPersona } from '../../../lib/store.js'

export async function getMyPersonaToolWrapper(uid: string): Promise<UserPersona> {
  const doc = await db.collection('personas').doc(uid).get()
  if (doc.exists) {
    const data = doc.data()!
    return {
      uid,
      displayName: data.displayName as string,
      summary: data.summary as string,
      needs: data.needs as string[],
      offers: data.offers as string[],
      updatedAt: data.updatedAt as number,
    }
  }
  return {
    uid,
    displayName: uid,
    summary: '',
    needs: [],
    offers: [],
    updatedAt: Date.now(),
  }
}
