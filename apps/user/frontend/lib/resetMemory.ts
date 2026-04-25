import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';
import { API_BASE_URL } from '@/lib/api';
import {
  clearCachedStreamingPersonaReply,
  clearPendingPersonaMessages,
  writeCachedPersonaMessages,
} from '@/lib/personaChatCache';
import { clearCachedPersonaCardState } from '@/lib/personaCardCache';

const buildAuthedHeaders = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken(true);
  if (!token) {
    throw new Error('目前沒有可用的登入憑證，請重新登入後再試')
  }

  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

export async function clearPersonaLocalCache(uid: string): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const targetKeys = allKeys.filter((key) =>
    key === `persona-chat-cache:${uid}` ||
    key === `persona-chat-pending:${uid}` ||
    key === `persona-chat-streaming:${uid}` ||
    key === `persona-card-cache:${uid}`,
  );

  await Promise.all([
    writeCachedPersonaMessages(uid, []),
    clearPendingPersonaMessages(uid),
    clearCachedStreamingPersonaReply(uid),
    clearCachedPersonaCardState(uid),
    targetKeys.length > 0 ? AsyncStorage.multiRemove(targetKeys) : Promise.resolve(),
  ]);
}

export async function resetPersonaMemory(uid: string): Promise<void> {
  const headers = await buildAuthedHeaders();
  const res = await fetch(`${API_BASE_URL}/me/reset-memory`, {
    method: 'POST',
    headers,
  });
  const raw = await res.text();
  let json: { success?: boolean; error?: string } | null = null;
  try {
    json = raw ? (JSON.parse(raw) as { success?: boolean; error?: string }) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json.success) {
    throw new Error(
      json?.error ? `${json.error} (HTTP ${res.status})` : `重置 memory 失敗 (HTTP ${res.status})`,
    );
  }

  await clearPersonaLocalCache(uid);
}
