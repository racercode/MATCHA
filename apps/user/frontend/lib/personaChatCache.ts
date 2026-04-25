import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Timestamp } from '@matcha/shared-types';

export type CachedPersonaMessage = {
  mid: string;
  from: string;
  text: string;
  createdAt: Timestamp;
};

export type PendingPersonaMessage = {
  mid: string;
  text: string;
  createdAt: Timestamp;
};

export type CachedStreamingPersonaReply = {
  text: string;
  createdAt: Timestamp;
};

const personaCacheKey = (uid: string) => `persona-chat-cache:${uid}`;
const pendingQueueKey = (uid: string) => `persona-chat-pending:${uid}`;
const streamingReplyKey = (uid: string) => `persona-chat-streaming:${uid}`;

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export async function readCachedPersonaMessages(uid: string): Promise<CachedPersonaMessage[]> {
  const data = safeParse<CachedPersonaMessage[]>(await AsyncStorage.getItem(personaCacheKey(uid)));
  return Array.isArray(data) ? data : [];
}

export async function writeCachedPersonaMessages(uid: string, messages: CachedPersonaMessage[]): Promise<void> {
  await AsyncStorage.setItem(personaCacheKey(uid), JSON.stringify(messages));
}

export async function readPendingPersonaMessages(uid: string): Promise<PendingPersonaMessage[]> {
  const data = safeParse<PendingPersonaMessage[]>(await AsyncStorage.getItem(pendingQueueKey(uid)));
  return Array.isArray(data) ? data : [];
}

export async function enqueuePendingPersonaMessage(uid: string, message: PendingPersonaMessage): Promise<void> {
  const existing = await readPendingPersonaMessages(uid);
  await AsyncStorage.setItem(pendingQueueKey(uid), JSON.stringify([...existing, message]));
}

export async function clearPendingPersonaMessages(uid: string): Promise<void> {
  await AsyncStorage.removeItem(pendingQueueKey(uid));
}

export async function readCachedStreamingPersonaReply(uid: string): Promise<CachedStreamingPersonaReply | null> {
  return safeParse<CachedStreamingPersonaReply>(await AsyncStorage.getItem(streamingReplyKey(uid)));
}

export async function writeCachedStreamingPersonaReply(
  uid: string,
  reply: CachedStreamingPersonaReply,
): Promise<void> {
  await AsyncStorage.setItem(streamingReplyKey(uid), JSON.stringify(reply));
}

export async function clearCachedStreamingPersonaReply(uid: string): Promise<void> {
  await AsyncStorage.removeItem(streamingReplyKey(uid));
}
