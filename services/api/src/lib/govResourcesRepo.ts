import type { GovernmentResource } from '@matcha/shared-types'
import { db } from './firebase.js'
import { fromFirestoreTimestamp } from './firestoreTimestamp.js'

const GOV_RESOURCES_COLLECTION = 'gov_resources'

function toGovernmentResource(id: string, data: FirebaseFirestore.DocumentData): GovernmentResource {
  const eligibilityCriteria = Array.isArray(data.eligibilityCriteria)
    ? data.eligibilityCriteria.map(String)
    : []

  return {
    rid: typeof data.rid === 'string' ? data.rid : id,
    agencyId: String(data.agencyId ?? ''),
    agencyName: String(data.agencyName ?? ''),
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    eligibilityCriteria,
    ...(typeof data.contactUrl === 'string' ? { contactUrl: data.contactUrl } : {}),
    ...(typeof data.pdfStoragePath === 'string' ? { pdfStoragePath: data.pdfStoragePath } : {}),
    createdAt: fromFirestoreTimestamp(data.createdAt),
  }
}

export async function listGovernmentResources(): Promise<GovernmentResource[]> {
  const snapshot = await db.collection(GOV_RESOURCES_COLLECTION).get()
  return snapshot.docs.map(doc => toGovernmentResource(doc.id, doc.data()))
}
