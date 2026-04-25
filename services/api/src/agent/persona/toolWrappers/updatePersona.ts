import { personas } from '../../lib/store.js'
import { broadcast } from '../../ws/push.js'
import type { UserPersona } from '@matcha/shared-types'
import type { UpdatePersonaInput } from '../types.js'

export function updatePersonaToolWrapper(
  uid: string,
  input: UpdatePersonaInput,
  displayName?: string,
): UserPersona {
  const existing = personas.get(uid)
  const updated: UserPersona = {
    uid,
    displayName: existing?.displayName ?? displayName ?? uid,
    summary: input.summary,
    needs: input.needs,
    offers: input.offers,
    updatedAt: Date.now(),
  }

  personas.set(uid, updated)
  broadcast(uid, { type: 'persona_updated', persona: updated })

  return updated
}
