/**
 * useNotifications
 *
 * 統一管理 `/me/channel-replies` 的抓取、polling、已讀狀態。
 * - NotificationBell 用 `unreadCount` 顯示 badge
 * - notifications.tsx 用 `items` / `isLoading` / `refresh` / `markAllRead`
 *
 * 架構：
 *   - onAuthStateChanged 確保 user 一登入就立刻 fetch（解決初始化競態）
 *   - 每 30 秒自動 polling 一次
 *   - 用 `lastReadAt` (AsyncStorage) 區分已讀/未讀
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';
import { API_BASE_URL } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChannelReplyItem = {
  replyId: string;
  messageId?: string;
  govId: string;
  govName: string;
  content: string;
  matchScore: number;
  createdAt: number;
};

type NotificationsContextType = {
  items: ChannelReplyItem[];
  isLoading: boolean;
  unreadCount: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const NotificationsContext = createContext<NotificationsContextType | null>(null);

const LAST_READ_KEY = '@matcha/notifications_last_read';
const POLL_INTERVAL_MS = 30_000;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ChannelReplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const isMountedRef = useRef(true);

  // 讀取上次已讀時間
  useEffect(() => {
    AsyncStorage.getItem(LAST_READ_KEY)
      .then((value) => {
        if (value) setLastReadAt(Number(value));
      })
      .catch(() => {});
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchReplies = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('[Notifications] fetch skipped: no currentUser');
      return;
    }
    try {
      const token = await currentUser.getIdToken();
      console.log('[Notifications] fetching channel-replies…');
      const res = await fetch(`${API_BASE_URL}/me/channel-replies?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      console.log('[Notifications] response:', JSON.stringify(json).slice(0, 200));
      if (isMountedRef.current && json.success) {
        const fetched = (json.data?.items ?? []) as ChannelReplyItem[];
        fetched.sort((a, b) => b.createdAt - a.createdAt);
        setItems(fetched);
        console.log(`[Notifications] got ${fetched.length} items`);
      }
    } catch (err) {
      console.warn('[Notifications] fetch failed', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchReplies();
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [fetchReplies]);

  const markAllRead = useCallback(async () => {
    const latest = items[0]?.createdAt ?? Date.now();
    setLastReadAt(latest);
    await AsyncStorage.setItem(LAST_READ_KEY, String(latest));
  }, [items]);

  // ── 監聽 auth 狀態：user 一登入就立刻 fetch，登出就清空 ──────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('[Notifications] auth ready, fetching…');
        refresh();
      } else {
        setItems([]);
      }
    });
    return () => unsubscribe();
  }, [refresh]);

  // ── 30 秒 polling（auth 就緒後才有效，因為 fetchReplies 內部會 guard）──
  useEffect(() => {
    const timer = setInterval(() => {
      fetchReplies();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchReplies]);

  const unreadCount = items.filter((item) => item.createdAt > lastReadAt).length;

  return (
    <NotificationsContext.Provider value={{ items, isLoading, unreadCount, refresh, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
