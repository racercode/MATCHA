import { personas } from '../../lib/store.js'
import type { UserPersona } from '@matcha/shared-types'

export function getMyPersonaToolWrapper(uid: string): UserPersona {
  const p = personas.get(uid)
  return p ?? {
    uid,
    displayName: uid,
    summary: '',
    needs: [],
    offers: [],
    updatedAt: Date.now(),
  }
}
