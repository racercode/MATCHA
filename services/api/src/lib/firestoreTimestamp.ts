import { Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'

export function toFirestoreTimestamp(timestamp: number): FirestoreTimestamp {
  return FirestoreTimestamp.fromMillis(timestamp)
}

export function fromFirestoreTimestamp(value: unknown): number {
  if (value instanceof FirestoreTimestamp) {
    return value.toMillis()
  }

  if (typeof value === 'number') {
    return value
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { seconds?: unknown }).seconds === 'number' &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === 'number'
  ) {
    const timestamp = value as { seconds: number; nanoseconds: number }
    return timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1_000_000)
  }

  return Date.now()
}
