import { db } from '../../../lib/firebase.js'
import type { UserPersona } from '../../../lib/store.js'
import type { UpdatePersonaInput } from '../types.js'

export async function updatePersonaToolWrapper(
  uid: string,
  input: UpdatePersonaInput,
  displayName?: string,
): Promise<UserPersona> {
  const existing = await db.collection('personas').doc(uid).get()
  const updated: UserPersona = {
    uid,
    displayName: (existing.exists ? (existing.data()!.displayName as string) : null) ?? displayName ?? uid,
    summary: input.summary,
    needs: input.needs,
    offers: input.offers,
    updatedAt: Date.now(),
  }
  await db.collection('personas').doc(uid).set({
    displayName: updated.displayName,
    summary: updated.summary,
    needs: updated.needs,
    offers: updated.offers,
    updatedAt: updated.updatedAt,
  })
  return updated
}
