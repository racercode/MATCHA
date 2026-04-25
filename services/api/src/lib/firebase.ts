import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function normalizePrivateKey(rawKey: string): string {
  const key = rawKey.replace(/\\n/g, '\n').trim()

  if (key.includes('-----BEGIN PRIVATE KEY-----')) {
    return key
  }

  const body = key.replace(/\s+/g, '')
  const wrappedBody = body.match(/.{1,64}/g)?.join('\n') ?? body
  return `-----BEGIN PRIVATE KEY-----\n${wrappedBody}\n-----END PRIVATE KEY-----\n`
}

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY
const databaseURL = process.env.FIREBASE_REALTIME_DB_URL
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Firebase Admin env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  }),
  ...(databaseURL ? { databaseURL } : {}),
  ...(storageBucket ? { storageBucket } : {}),
})

export const firebaseApp = app
export const db = getFirestore(app)
