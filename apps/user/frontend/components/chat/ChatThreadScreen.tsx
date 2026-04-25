import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { ClientEvent, PeerMessage, ServerEvent, SwipeCard, Timestamp } from '@matcha/shared-types';
import { msToTimestamp, toMs } from '@matcha/shared-types';
import { SafeAreaView } from 'react-native-safe-area-context';
import Loading from '@/components/Loading';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/containers/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { API_BASE_URL, WS_URL } from '@/lib/api';
import {
  clearCachedStreamingPersonaReply,
  clearPendingPersonaMessages,
  enqueuePendingPersonaMessage,
  readCachedPersonaMessages,
  readCachedStreamingPersonaReply,
  readPendingPersonaMessages,
  writeCachedStreamingPersonaReply,
  writeCachedPersonaMessages,
} from '@/lib/personaChatCache';
import {
  readCachedPersonaCardState,
  writeCachedPersonaCardState,
  type CachedPromptCard,
} from '@/lib/personaCardCache';

type PersonaMessage = {
  mid: string;
  tid: string;
  from: string;
  type: 'answer' | 'query' | 'human_note';
  content: Record<string, unknown>;
  createdAt: Timestamp;
};

type ThreadMode = 'persona' | 'peer';

type PeerThreadMessage = {
  mid: string;
  tid: string;
  from: string;
  content: string;
  createdAt: Timestamp;
};

type PostPreviewContent = {
  kind: 'post_preview';
  author: string;
  handle: string;
  ageLabel: string;
  text: string;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
};

type TextContent = { text: string };

const PERSONA_AGENT_ID = 'gov:persona-agent-01';
const AGENT_AVATAR = require('@/assets/icons/wife.jpg');
const CARD_PREFETCH_MESSAGE = 'generate_swipe_card';
const INITIAL_MESSAGE_BATCH = 30;
const OLDER_MESSAGE_BATCH = 20;
const LOAD_OLDER_THRESHOLD = 80;

export const getPersonaThreadId = (uid: string) => `thread-persona-chat-${uid}`;

const buildSeedMessages = (threadId: string, uid: string): PersonaMessage[] => [
  {
    mid: 'm-001',
    tid: threadId,
    from: 'persona_agent:student-02',
    type: 'answer',
    content: { text: '嗨，我在這裡陪你聊聊。最近最想整理的是哪一件事？' } satisfies TextContent,
    createdAt: msToTimestamp(Date.now() - 1000 * 60 * 35),
  },
  {
    mid: 'm-002',
    tid: threadId,
    from: `human:${uid}`,
    type: 'query',
    content: { text: '我最近有點焦慮，不知道要先處理學校還是工作。' } satisfies TextContent,
    createdAt: msToTimestamp(Date.now() - 1000 * 60 * 28),
  },
  {
    mid: 'm-003',
    tid: threadId,
    from: 'persona_agent:student-02',
    type: 'answer',
    content: { text: '可以，我們先拆小一點。現在壓力最大的，是時間不夠，還是方向不清楚？' } satisfies TextContent,
    createdAt: msToTimestamp(Date.now() - 1000 * 60 * 27),
  },
];

const formatTimeLabel = (createdAt: Timestamp) =>
  new Date(toMs(createdAt)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const isPostPreview = (content: Record<string, unknown>): content is PostPreviewContent =>
  content.kind === 'post_preview' && typeof content.author === 'string' && typeof content.text === 'string';

const getTextContent = (content: Record<string, unknown>) => (typeof content.text === 'string' ? content.text : '');

const toCachedPromptCard = (card: SwipeCard): CachedPromptCard => ({
  cardId: card.cardId,
  title: card.question,
  leftLabel: card.leftLabel,
  rightLabel: card.rightLabel,
  leftValue: card.leftValue,
  rightValue: card.rightValue,
});

const hasPendingReplyAlreadyCompleted = (
  items: { from: string; text: string; createdAt: Timestamp }[],
  pending: { text: string; createdAt: Timestamp }[],
) => {
  if (pending.length === 0 || items.length === 0) return false;

  return pending.some((pendingMessage) => {
    const matchedHumanIndex = items.findIndex(
      (item) => item.from.startsWith('human:') && item.text === pendingMessage.text,
    );

    if (matchedHumanIndex < 0) return false;

    return items.slice(matchedHumanIndex + 1).some((item) => !item.from.startsWith('human:'));
  });
};

function PostPreviewCard({ content }: { content: PostPreviewContent }) {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <Image source={AGENT_AVATAR} style={styles.previewAvatar} contentFit="cover" />
        <View style={styles.previewMeta}>
          <ThemedText style={styles.previewAuthor}>{content.author}</ThemedText>
          <ThemedText style={styles.previewHandle}>
            {content.handle} {content.ageLabel}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={styles.previewText}>{content.text}</ThemedText>
      <View style={styles.previewStatsRow}>
        <View style={styles.previewStat}>
          <Ionicons name="heart-outline" size={18} color="#9CA3AF" />
          <ThemedText style={styles.previewStatText}>{content.likes}</ThemedText>
        </View>
        <View style={styles.previewStat}>
          <Ionicons name="chatbubble-outline" size={17} color="#9CA3AF" />
          <ThemedText style={styles.previewStatText}>{content.comments}</ThemedText>
        </View>
        <View style={styles.previewStat}>
          <Ionicons name="repeat-outline" size={18} color="#9CA3AF" />
          <ThemedText style={styles.previewStatText}>{content.reposts}</ThemedText>
        </View>
        <View style={styles.previewStat}>
          <Ionicons name="paper-plane-outline" size={17} color="#9CA3AF" />
          <ThemedText style={styles.previewStatText}>{content.shares}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const TypingBubble = memo(function TypingBubble({ text }: { text: string }) {
  return (
    <View style={[styles.messageRow, styles.messageRowOther]}>
      <Image source={AGENT_AVATAR} style={styles.avatar} contentFit="cover" />
      <View style={[styles.bubble, styles.bubbleOther]}>
        <ThemedText style={styles.bubbleText}>{text || '…'}</ThemedText>
      </View>
    </View>
  );
});

const PersonaMessageBubble = memo(function PersonaMessageBubble({
  message,
  isOwnMessage,
}: {
  message: PersonaMessage;
  isOwnMessage: boolean;
}) {
  const content = message.content;

  if (isPostPreview(content)) {
    return (
      <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOwn : styles.messageRowOther]}>
        {!isOwnMessage ? <Image source={AGENT_AVATAR} style={styles.avatar} contentFit="cover" /> : null}
        <View style={[styles.bubbleShell, isOwnMessage ? styles.bubbleShellOwn : styles.bubbleShellOther]}>
          <PostPreviewCard content={content} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOwn : styles.messageRowOther]}>
      {!isOwnMessage ? <Image source={AGENT_AVATAR} style={styles.avatar} contentFit="cover" /> : null}
      <View style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}>
        <ThemedText style={[styles.bubbleText, isOwnMessage && styles.bubbleTextOwn]}>
          {getTextContent(content)}
        </ThemedText>
      </View>
    </View>
  );
});

const PeerMessageBubble = memo(function PeerMessageBubble({
  message,
  isOwnMessage,
}: {
  message: PeerThreadMessage;
  isOwnMessage: boolean;
}) {
  return (
    <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOwn : styles.messageRowOther]}>
      {!isOwnMessage ? <Image source={AGENT_AVATAR} style={styles.avatar} contentFit="cover" /> : null}
      <View style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}>
        <ThemedText style={[styles.bubbleText, isOwnMessage && styles.bubbleTextOwn]}>{message.content}</ThemedText>
      </View>
    </View>
  );
});

const buildAuthedHeaders = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const buildAuthedWsUrl = async () => {
  const token = await auth.currentUser?.getIdToken();
  return token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
};

export default function ChatThreadScreen() {
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ tid?: string; kind?: string; peerName?: string }>();
  const [draft, setDraft] = useState('');
  const [personaMessages, setPersonaMessages] = useState<PersonaMessage[]>([]);
  const [peerMessages, setPeerMessages] = useState<PeerThreadMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isAwaitingPersonaReply, setIsAwaitingPersonaReply] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasMorePeerHistory, setHasMorePeerHistory] = useState(false);
  const [peerHistoryError, setPeerHistoryError] = useState<string | null>(null);
  const [visiblePersonaCount, setVisiblePersonaCount] = useState(INITIAL_MESSAGE_BATCH);
  const [visiblePeerCount, setVisiblePeerCount] = useState(INITIAL_MESSAGE_BATCH);
  const listRef = useRef<FlatList<PersonaMessage | PeerThreadMessage>>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamBufferRef = useRef('');
  const scrollFrameRef = useRef<number | null>(null);
  const isLoadingOlderRef = useRef(false);
  const cardPrefetchCountRef = useRef(0);
  const cardPrefetchPendingRef = useRef(false);

  const currentUserId = user?.uid ?? '';
  const personaThreadId = currentUserId ? getPersonaThreadId(currentUserId) : '';
  const routeTid = Array.isArray(params.tid) ? params.tid[0] : params.tid;
  const peerName = Array.isArray(params.peerName) ? params.peerName[0] : params.peerName;
  const mode: ThreadMode =
    params.kind === 'peer' || (routeTid != null && routeTid !== personaThreadId) ? 'peer' : 'persona';
  const activeThreadId = mode === 'peer' ? routeTid ?? '' : personaThreadId;

  const visibleMessages = useMemo(() => {
    if (mode === 'peer') {
      return peerMessages.slice(-visiblePeerCount);
    }
    return personaMessages.slice(-visiblePersonaCount);
  }, [mode, peerMessages, personaMessages, visiblePeerCount, visiblePersonaCount]);

  const scrollToBottom = (animated = true) => {
    if (scrollFrameRef.current != null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }
    scrollFrameRef.current = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
      scrollFrameRef.current = null;
    });
  };

  useEffect(() => {
    if (!user?.uid) return;
    if (mode === 'persona' && routeTid && routeTid !== personaThreadId) {
      router.replace(`/thread/${personaThreadId}`);
    }
  }, [mode, personaThreadId, routeTid, user?.uid]);

  useEffect(() => {
    if (!currentUserId) return;
    if (mode === 'persona') {
      let isMounted = true;
      setIsLoadingHistory(true);
      setVisiblePersonaCount(INITIAL_MESSAGE_BATCH);
      (async () => {
        try {
          const cached = await readCachedPersonaMessages(currentUserId);
          const pending = await readPendingPersonaMessages(currentUserId);
          const cachedStreamingReply = await readCachedStreamingPersonaReply(currentUserId);
          if (isMounted && cached.length > 0) {
            setPersonaMessages(
              cached.map((item) => ({
                mid: item.mid,
                tid: personaThreadId,
                from: item.from,
                type: item.from.startsWith('human:') ? ('human_note' as const) : ('answer' as const),
                content: { text: item.text },
                createdAt: item.createdAt,
              })),
            );
          }
          if (isMounted) {
            setIsAwaitingPersonaReply(pending.length > 0);
            setStreamingText(pending.length > 0 ? cachedStreamingReply?.text ?? null : null);
            streamBufferRef.current = pending.length > 0 ? cachedStreamingReply?.text ?? '' : '';
          }

          const headers = await buildAuthedHeaders();
          const res = await fetch(`${API_BASE_URL}/me/persona-messages`, { headers });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error ?? '讀取對話失敗');
          }
          if (!isMounted) return;
          const items: { mid: string; from: string; text: string; createdAt: Timestamp }[] =
            Array.isArray(json.data?.items) ? json.data.items : [];
          if (items.length > 0) {
            const shouldClearPending = hasPendingReplyAlreadyCompleted(items, pending);
            const mapped = items.map((item) => ({
              mid: item.mid,
              tid: personaThreadId,
              from: item.from,
              type: item.from.startsWith('human:') ? ('human_note' as const) : ('answer' as const),
              content: { text: item.text },
              createdAt: item.createdAt,
            }));
            setPersonaMessages(mapped);
            setVisiblePersonaCount((prev) => Math.max(prev, Math.min(INITIAL_MESSAGE_BATCH, mapped.length)));
            await writeCachedPersonaMessages(
              currentUserId,
              items.map((item) => ({
                mid: item.mid,
                from: item.from,
                text: item.text,
                createdAt: item.createdAt,
              })),
            );
            if (shouldClearPending) {
              setIsAwaitingPersonaReply(false);
              setStreamingText(null);
              streamBufferRef.current = '';
              await clearPendingPersonaMessages(currentUserId);
              await clearCachedStreamingPersonaReply(currentUserId);
            } else if (pending.length === 0) {
              await clearCachedStreamingPersonaReply(currentUserId);
            }
          } else if (cached.length === 0) {
            setPersonaMessages(buildSeedMessages(personaThreadId, currentUserId));
            setVisiblePersonaCount(INITIAL_MESSAGE_BATCH);
          }
        } catch {
          if (isMounted) {
            const cached = await readCachedPersonaMessages(currentUserId);
            if (cached.length === 0) {
              setPersonaMessages(buildSeedMessages(personaThreadId, currentUserId));
              setVisiblePersonaCount(INITIAL_MESSAGE_BATCH);
            }
          }
        } finally {
          if (isMounted) setIsLoadingHistory(false);
        }
      })();
      return () => { isMounted = false; };
    }

    if (mode === 'peer' && activeThreadId) {
      let isMounted = true;
      setIsLoadingHistory(true);
      setPeerHistoryError(null);
      setVisiblePeerCount(INITIAL_MESSAGE_BATCH);
      (async () => {
        try {
          const headers = await buildAuthedHeaders();
          const res = await fetch(
            `${API_BASE_URL}/peer-threads/${activeThreadId}/messages?limit=${INITIAL_MESSAGE_BATCH}`,
            { headers },
          );
          const json = await res.json();
          if (!isMounted) return;
          if (!res.ok || !json.success) throw new Error(json.error ?? '讀取對話失敗');
          const items = Array.isArray(json.data?.items) ? (json.data.items as PeerMessage[]) : [];
          setPeerMessages(items.map((message) => ({ ...message, tid: activeThreadId })));
          setHasMorePeerHistory(Boolean(json.data?.hasMore));
        } catch (error) {
          if (!isMounted) return;
          setPeerHistoryError(error instanceof Error ? error.message : '讀取對話失敗');
        } finally {
          if (isMounted) setIsLoadingHistory(false);
        }
      })();
      return () => { isMounted = false; };
    }
  }, [activeThreadId, currentUserId, mode, personaThreadId]);

  useEffect(() => {
    if (!currentUserId) return;
    if (mode !== 'persona') return;

    void writeCachedPersonaMessages(
      currentUserId,
      personaMessages.map((message) => ({
        mid: message.mid,
        from: message.from,
        text: getTextContent(message.content),
        createdAt: message.createdAt,
      })),
    );
  }, [currentUserId, mode, personaMessages]);

  useEffect(() => {
    if (!currentUserId) return;
    let isActive = true;

    (async () => {
      const wsUrl = await buildAuthedWsUrl();
      if (!isActive) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        if (mode !== 'persona') return;

        const pending = await readPendingPersonaMessages(currentUserId);
        if (pending.length > 0) {
          const cachedMessages = await readCachedPersonaMessages(currentUserId);
          const shouldClearPending = hasPendingReplyAlreadyCompleted(cachedMessages, pending);

          if (shouldClearPending) {
            setIsAwaitingPersonaReply(false);
            setStreamingText(null);
            streamBufferRef.current = '';
            await clearPendingPersonaMessages(currentUserId);
            await clearCachedStreamingPersonaReply(currentUserId);
          } else {
            for (const message of pending) {
              if (ws.readyState !== WebSocket.OPEN) return;
              const event: ClientEvent = { type: 'persona_message', content: message.text };
              ws.send(JSON.stringify(event));
            }
          }
        }

        const cachedCardState = await readCachedPersonaCardState(currentUserId);
        const hasCachedCards =
          cachedCardState != null &&
          (cachedCardState.cards.length > 0 ||
            cachedCardState.answers.length > 0 ||
            cachedCardState.awaitingBatchResponse);

        if (!hasCachedCards && ws.readyState === WebSocket.OPEN) {
          cardPrefetchPendingRef.current = true;
          cardPrefetchCountRef.current = 0;
          const event: ClientEvent = { type: 'swipe_card_request', content: CARD_PREFETCH_MESSAGE };
          ws.send(JSON.stringify(event));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data);

          if (mode === 'persona' && data.type === 'agent_reply') {
            if (!data.done) {
              setIsAwaitingPersonaReply(false);
              streamBufferRef.current += data.content;
              setStreamingText(streamBufferRef.current);
              void writeCachedStreamingPersonaReply(currentUserId, {
                text: streamBufferRef.current,
                createdAt: msToTimestamp(Date.now()),
              });
            } else {
              if (cardPrefetchPendingRef.current && cardPrefetchCountRef.current > 0) {
                void (async () => {
                  const existing = await readCachedPersonaCardState(currentUserId);
                  await writeCachedPersonaCardState(currentUserId, {
                    cards: existing?.cards ?? [],
                    answers: existing?.answers ?? [],
                    expectedBatchSize: cardPrefetchCountRef.current,
                    awaitingBatchResponse: existing?.awaitingBatchResponse ?? false,
                  });
                })();
              }
              cardPrefetchPendingRef.current = false;
              cardPrefetchCountRef.current = 0;

              const finalText = streamBufferRef.current + (data.content ?? '');
              streamBufferRef.current = '';
              setStreamingText(null);
              setIsAwaitingPersonaReply(false);
              void clearCachedStreamingPersonaReply(currentUserId);
              void clearPendingPersonaMessages(currentUserId);

              if (finalText.trim()) {
                setPersonaMessages((prev) => [
                  ...prev,
                  {
                    mid: `agent-${Date.now()}`,
                    tid: personaThreadId,
                    from: PERSONA_AGENT_ID,
                    type: 'answer',
                    content: { text: finalText },
                    createdAt: msToTimestamp(Date.now()),
                  },
                ]);
              }
            }
          }

          if (mode === 'persona' && data.type === 'swipe_card') {
            cardPrefetchCountRef.current += 1;
            void (async () => {
              const existing = await readCachedPersonaCardState(currentUserId);
              const nextCard = toCachedPromptCard(data.card);
              const cards = existing?.cards ?? [];
              if (cards.some((card) => card.cardId === nextCard.cardId)) return;

              await writeCachedPersonaCardState(currentUserId, {
                cards: [...cards, nextCard],
                answers: existing?.answers ?? [],
                expectedBatchSize: existing?.expectedBatchSize ?? 0,
                awaitingBatchResponse: existing?.awaitingBatchResponse ?? false,
              });
            })();
          }

          if (mode === 'peer' && data.type === 'peer_message') {
            setPeerMessages((prev) => {
              if (prev.some((message) => message.mid === data.message.mid)) return prev;
              return [...prev, { ...data.message, tid: activeThreadId }];
            });
            scrollToBottom();
          }
        } catch {
          // ignore malformed events
        }
      };

      ws.onerror = (e) => {
        console.warn('[Chat] WS error', e);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };
    })();

    return () => {
      isActive = false;
      if (scrollFrameRef.current != null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [activeThreadId, currentUserId, mode, personaThreadId]);

  useEffect(() => {
    if (isLoadingHistory) return;
    scrollToBottom(false);
  }, [isLoadingHistory, visibleMessages.length]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlderRef.current || isLoadingHistory) return;

    if (mode === 'persona') {
      if (visiblePersonaCount >= personaMessages.length) return;
      isLoadingOlderRef.current = true;
      setIsLoadingOlderMessages(true);
      setVisiblePersonaCount((prev) => Math.min(prev + OLDER_MESSAGE_BATCH, personaMessages.length));
      setIsLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;
      return;
    }

    if (mode !== 'peer' || !activeThreadId) return;

    if (visiblePeerCount < peerMessages.length) {
      isLoadingOlderRef.current = true;
      setIsLoadingOlderMessages(true);
      setVisiblePeerCount((prev) => Math.min(prev + OLDER_MESSAGE_BATCH, peerMessages.length));
      setIsLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;
      return;
    }

    if (!hasMorePeerHistory || peerMessages.length === 0) return;

    const oldestMessage = peerMessages[0];
    const before = toMs(oldestMessage.createdAt);
    isLoadingOlderRef.current = true;
    setIsLoadingOlderMessages(true);

    try {
      const headers = await buildAuthedHeaders();
      const res = await fetch(
        `${API_BASE_URL}/peer-threads/${activeThreadId}/messages?before=${before}&limit=${OLDER_MESSAGE_BATCH}`,
        { headers },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? '讀取更多對話失敗');

      const items = Array.isArray(json.data?.items) ? (json.data.items as PeerMessage[]) : [];
      const olderMessages = items.map((message) => ({ ...message, tid: activeThreadId }));

      setPeerMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.mid));
        const mergedOlder = olderMessages.filter((message) => !existingIds.has(message.mid));
        return [...mergedOlder, ...prev];
      });
      setVisiblePeerCount((prev) => prev + olderMessages.length);
      setHasMorePeerHistory(Boolean(json.data?.hasMore));
    } catch (error) {
      console.warn('[Chat] load older messages failed', error);
    } finally {
      setIsLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;
    }
  }, [
    activeThreadId,
    hasMorePeerHistory,
    isLoadingHistory,
    mode,
    peerMessages,
    personaMessages.length,
    visiblePeerCount,
    visiblePersonaCount,
  ]);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (event.nativeEvent.contentOffset.y <= LOAD_OLDER_THRESHOLD) {
        void loadOlderMessages();
      }
    },
    [loadOlderMessages],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: PersonaMessage | PeerThreadMessage; index: number }) => {
      const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
      const showTimestamp =
        previousMessage == null ||
        toMs(item.createdAt) - toMs(previousMessage.createdAt) > 1000 * 60 * 8;
      const isOwnMessage =
        mode === 'peer' ? item.from === `user:${currentUserId}` : item.from === `human:${currentUserId}`;

      return (
        <View style={styles.messageBlock}>
          {showTimestamp ? (
            <ThemedText style={styles.timestamp}>{formatTimeLabel(item.createdAt)}</ThemedText>
          ) : null}
          {mode === 'peer' ? (
            <PeerMessageBubble message={item as PeerThreadMessage} isOwnMessage={isOwnMessage} />
          ) : (
            <PersonaMessageBubble message={item as PersonaMessage} isOwnMessage={isOwnMessage} />
          )}
        </View>
      );
    },
    [currentUserId, mode, visibleMessages],
  );

  const handleSend = () => {
    const content = draft.trim();
    if (!content || !activeThreadId) return;

    setDraft('');

    if (mode === 'persona') {
      setIsAwaitingPersonaReply(true);
      void enqueuePendingPersonaMessage(currentUserId, {
        mid: `pending-${Date.now()}`,
        text: content,
        createdAt: msToTimestamp(Date.now()),
      });
      void clearCachedStreamingPersonaReply(currentUserId);
      streamBufferRef.current = '';
      setStreamingText(null);

      setPersonaMessages((prev) => [
        ...prev,
        {
          mid: `human-${Date.now()}`,
          tid: personaThreadId,
          from: `human:${currentUserId}`,
          type: 'human_note',
          content: { text: content },
          createdAt: msToTimestamp(Date.now()),
        },
      ]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const event: ClientEvent = { type: 'persona_message', content };
        wsRef.current.send(JSON.stringify(event));
      }
    } else {
      const localMessage: PeerThreadMessage = {
        mid: `local-${Date.now()}`,
        tid: activeThreadId,
        from: `user:${currentUserId}`,
        content,
        createdAt: msToTimestamp(Date.now()),
      };

      setPeerMessages((prev) => [...prev, localMessage]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const event: ClientEvent = { type: 'peer_message', threadId: activeThreadId, content };
        wsRef.current.send(JSON.stringify(event));
      }
    }

    scrollToBottom();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        >
          {mode === 'peer' ? (
            <View style={styles.threadHeader}>
              <ThemedText style={styles.threadEyebrow}>Coffee Chat</ThemedText>
              <ThemedText style={styles.threadTitle}>{peerName ?? '對話紀錄'}</ThemedText>
            </View>
          ) : null}
          <View style={styles.messagesArea}>
            <FlatList
              ref={listRef}
              data={visibleMessages}
              keyExtractor={(item) => item.mid}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              renderItem={renderMessage}
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              initialNumToRender={12}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={Platform.OS === 'android'}
              ListHeaderComponent={
                isLoadingHistory ? (
                  <ThemedText style={styles.statusText}>載入對話中…</ThemedText>
                ) : isLoadingOlderMessages ? (
                  <ThemedText style={styles.statusText}>載入更早的對話…</ThemedText>
                ) : peerHistoryError ? (
                  <ThemedText style={styles.errorText}>{peerHistoryError}</ThemedText>
                ) : null
              }
              ListFooterComponent={mode === 'persona' && streamingText !== null ? <TypingBubble text={streamingText} /> : null}
            />

            {mode === 'persona' && isAwaitingPersonaReply && streamingText === null && !isLoadingHistory ? (
              <View pointerEvents="none" style={styles.chatLoadingOverlay}>
                <Loading text="AI 正在生成回覆…" contentStyle={styles.chatLoadingContent} />
              </View>
            ) : null}
          </View>

          <View style={styles.composerBar}>
            <View style={styles.composerInner}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message..."
                placeholderTextColor="#A1A1AA"
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                onFocus={() => scrollToBottom()}
              />
              <Pressable style={[styles.sendButton, draft.trim() ? styles.sendButtonActive : undefined]} onPress={handleSend}>
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  threadHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 2,
    backgroundColor: '#FFFFFF',
  },
  threadEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    color: '#65A1FB',
    fontWeight: '700',
  },
  threadTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: '#1F2937',
  },
  messagesArea: {
    flex: 1,
    position: 'relative',
  },
  messagesContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 8 },
  chatLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chatLoadingContent: {
    transform: [{ translateY: 0 }],
  },
  messageBlock: { gap: 10 },
  timestamp: {
    alignSelf: 'center',
    fontSize: 12,
    lineHeight: 16,
    color: '#C0C4CC',
    fontWeight: '600',
    marginVertical: 8,
  },
  statusText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowOther: { justifyContent: 'flex-start' },
  messageRowOwn: { justifyContent: 'flex-end' },
  avatar: { width: 30, height: 30, borderRadius: 15, marginBottom: 2, overflow: 'hidden' },
  bubbleShell: { maxWidth: '82%' },
  bubbleShellOther: { alignItems: 'flex-start' },
  bubbleShellOwn: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleOther: { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 10 },
  bubbleOwn: { backgroundColor: '#65A1FB', borderBottomRightRadius: 10 },
  bubbleText: { fontSize: 16, lineHeight: 22, color: '#222222' },
  bubbleTextOwn: { color: '#FFFFFF' },
  previewCard: {
    width: 270,
    borderRadius: 24,
    backgroundColor: '#EEF5FF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D7E6FF',
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  previewAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  previewMeta: { flex: 1 },
  previewAuthor: { fontSize: 15, lineHeight: 18, fontWeight: '700', color: '#202020' },
  previewHandle: { fontSize: 12, lineHeight: 16, color: '#9CA3AF' },
  previewText: { fontSize: 16, lineHeight: 22, color: '#1D3557', marginBottom: 12 },
  previewStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  previewStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewStatText: { fontSize: 12, lineHeight: 16, color: '#9CA3AF' },
  composerBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: '#65A1FB',
  },
  composerInner: {
    minHeight: 48,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
  },
  input: { flex: 1, minHeight: 40, fontSize: 16, color: '#222222' },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9FC3FF',
  },
  sendButtonActive: {
    backgroundColor: '#2F6FD6',
  },
});
