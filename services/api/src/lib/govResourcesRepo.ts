import { nowTimestamp, type GovernmentResource, type GovernmentResourceDocument, type GovernmentResourceDocumentKind } from '@matcha/shared-types'
import { db } from './firebase.js'
import { fromFirestoreTimestamp, toFirestoreTimestamp } from './firestoreTimestamp.js'

const GOV_RESOURCES_COLLECTION = 'gov_resources'
const DOCUMENTS_COLLECTION = 'documents'

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
    ...(data.updatedAt ? { updatedAt: fromFirestoreTimestamp(data.updatedAt) } : {}),
  }
}

function normalizeDocumentKind(value: unknown): GovernmentResourceDocumentKind {
  if (
    value === 'pdf' ||
    value === 'markdown' ||
    value === 'txt' ||
    value === 'html' ||
    value === 'csv' ||
    value === 'xlsx' ||
    value === 'url' ||
    value === 'other'
  ) {
    return value
  }

  return 'other'
}

function toGovernmentResourceDocument(
  rid: string,
  id: string,
  data: FirebaseFirestore.DocumentData,
): GovernmentResourceDocument {
  const extractedText = String(data.extractedText ?? '')

  return {
    docId: typeof data.docId === 'string' ? data.docId : id,
    rid: typeof data.rid === 'string' ? data.rid : rid,
    filename: String(data.filename ?? id),
    kind: normalizeDocumentKind(data.kind),
    ...(typeof data.mimeType === 'string' ? { mimeType: data.mimeType } : {}),
    ...(typeof data.sourceUrl === 'string' ? { sourceUrl: data.sourceUrl } : {}),
    ...(typeof data.storagePath === 'string' ? { storagePath: data.storagePath } : {}),
    extractedText,
    textLength: typeof data.textLength === 'number' ? data.textLength : extractedText.length,
    createdAt: fromFirestoreTimestamp(data.createdAt),
    ...(data.updatedAt ? { updatedAt: fromFirestoreTimestamp(data.updatedAt) } : {}),
  }
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}

export async function listGovernmentResources(): Promise<GovernmentResource[]> {
  const snapshot = await db.collection(GOV_RESOURCES_COLLECTION).get()
  return snapshot.docs.map(doc => toGovernmentResource(doc.id, doc.data()))
}

export async function getGovernmentResource(rid: string): Promise<GovernmentResource | null> {
  const doc = await db.collection(GOV_RESOURCES_COLLECTION).doc(rid).get()
  if (!doc.exists) return null
  return toGovernmentResource(doc.id, doc.data() ?? {})
}

export async function upsertGovernmentResource(
  input: Omit<GovernmentResource, 'createdAt'> & { createdAt?: GovernmentResource['createdAt'] },
): Promise<GovernmentResource> {
  const now = nowTimestamp()
  const resource: GovernmentResource = {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  }

  await db.collection(GOV_RESOURCES_COLLECTION).doc(resource.rid).set(stripUndefined({
    rid: resource.rid,
    agencyId: resource.agencyId,
    agencyName: resource.agencyName,
    name: resource.name,
    description: resource.description,
    eligibilityCriteria: resource.eligibilityCriteria,
    contactUrl: resource.contactUrl,
    pdfStoragePath: resource.pdfStoragePath,
    createdAt: toFirestoreTimestamp(resource.createdAt),
    updatedAt: toFirestoreTimestamp(resource.updatedAt ?? now),
  }), { merge: true })

  return resource
}

export async function listGovernmentResourceDocuments(rid: string): Promise<GovernmentResourceDocument[]> {
  const snapshot = await db
    .collection(GOV_RESOURCES_COLLECTION)
    .doc(rid)
    .collection(DOCUMENTS_COLLECTION)
    .orderBy('createdAt', 'asc')
    .get()

  return snapshot.docs.map(doc => toGovernmentResourceDocument(rid, doc.id, doc.data()))
}

export async function createGovernmentResourceDocument(
  rid: string,
  input: {
    docId?: string
    filename: string
    kind: GovernmentResourceDocumentKind
    mimeType?: string
    sourceUrl?: string
    storagePath?: string
    extractedText: string
  },
): Promise<GovernmentResourceDocument> {
  const now = nowTimestamp()
  const docRef = input.docId
    ? db.collection(GOV_RESOURCES_COLLECTION).doc(rid).collection(DOCUMENTS_COLLECTION).doc(input.docId)
    : db.collection(GOV_RESOURCES_COLLECTION).doc(rid).collection(DOCUMENTS_COLLECTION).doc()

  const document: GovernmentResourceDocument = {
    docId: docRef.id,
    rid,
    filename: input.filename,
    kind: input.kind,
    ...(input.mimeType ? { mimeType: input.mimeType } : {}),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.storagePath ? { storagePath: input.storagePath } : {}),
    extractedText: input.extractedText,
    textLength: input.extractedText.length,
    createdAt: now,
    updatedAt: now,
  }

  await docRef.set(stripUndefined({
    docId: document.docId,
    rid,
    filename: document.filename,
    kind: document.kind,
    mimeType: document.mimeType,
    sourceUrl: document.sourceUrl,
    storagePath: document.storagePath,
    extractedText: document.extractedText,
    textLength: document.textLength,
    createdAt: toFirestoreTimestamp(document.createdAt),
    updatedAt: toFirestoreTimestamp(document.updatedAt ?? now),
  }))

  return document
}
