import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import { msToTimestamp, toMs, type Timestamp } from '@matcha/shared-types'

export function toFirestoreTimestamp(timestamp: Timestamp): FirestoreTimestamp {
  return FirestoreTimestamp.fromMillis(toMs(timestamp))
}

export function fromFirestoreTimestamp(value: unknown): Timestamp {
  if (value instanceof FirestoreTimestamp) {
    return msToTimestamp(value.toMillis())
  }

  if (typeof value === 'number') {
    return msToTimestamp(value)
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { seconds?: unknown }).seconds === 'number' &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === 'number'
  ) {
    const timestamp = value as { seconds: number; nanoseconds: number }
    return msToTimestamp(timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1_000_000))
  }

  return msToTimestamp(Date.now())
}
