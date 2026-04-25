import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AgentThread, ThreadMessage, TimestampValue } from '@matcha/shared-types';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/containers/hooks/useAuth';
import { db } from '@/lib/firebase';
import ianAvatar from '@/assets/icons/ian.png';
import karinaAvatar from '@/assets/icons/karina.png';

type CafeChatSession = {
  thread: AgentThread;
  partnerName: string;
  avatarSource: ImageSourcePropType;
  highlight: string;
  bullets: string[];
  messages: ThreadMessage[];
};

type TextContent = { text: string };
type MaybeTimestamp = TimestampValue | Timestamp | null | undefined;

const getTimestampMs = (timestamp: MaybeTimestamp) => {
  if (!timestamp) return Date.now();
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate().getTime();
  return timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1_000_000);
};

const formatRelativeLabel = (timestamp: MaybeTimestamp) => {
  const diffMs = Date.now() - getTimestampMs(timestamp);
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  return `${diffDays} 天前`;
};

const getTextContent = (content: Record<string, unknown>) => (typeof content.text === 'string' ? content.text : '');

const getCafeThreadId = (uid: string, suffix: string) => `thread-cafe-chat-${uid}-${suffix}`;
const MODAL_WIDTH = Dimensions.get('window').width - 40;

const buildCafeSessions = (uid: string): CafeChatSession[] => [
  {
    thread: {
      tid: getCafeThreadId(uid, 'brand-ai'),
      type: 'user_user',
      initiatorId: `user:${uid}`,
      responderId: 'user:peer-brand-ai',
      status: 'matched',
      matchScore: 91,
      summary: 'Persona agent 與品牌設計取向的 peer agent 對話紀錄。',
      userPresence: 'agent',
      govPresence: 'agent',
      peerPresence: 'agent',
      createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 20),
      updatedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 18),
    },
    partnerName: '想轉品牌設計的ian',
    avatarSource: ianAvatar,
    highlight: '很像你',
    bullets: [
      '先找練習案子再考隨班課程，省時省錢',
      'Behance 比 IG 更能被設計公司看到',
      '跨域補助和實習可以同期進行',
    ],
    messages: [
      {
        mid: 'brand-ai-1',
        tid: getCafeThreadId(uid, 'brand-ai'),
        from: `coffee_agent:${uid}`,
        type: 'query',
        content: { text: '這位使用者目前文組背景，正在轉職 UI / 品牌設計。' } satisfies TextContent,
        createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 19),
      },
      {
        mid: 'brand-ai-2',
        tid: getCafeThreadId(uid, 'brand-ai'),
        from: 'coffee_agent:peer-brand-ai',
        type: 'answer',
        content: { text: '對方也是中文系，已在自學 Figma 兩個月，靠接小案子建立作品集，準備三個月後找正職。' } satisfies TextContent,
        createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 18.6),
      },
      {
        mid: 'brand-ai-3',
        tid: getCafeThreadId(uid, 'brand-ai'),
        from: `coffee_agent:${uid}`,
        type: 'answer',
        content: { text: '目前共通點很高，尤其是轉職策略和作品集節奏。' } satisfies TextContent,
        createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 18.2),
      },
    ],
  },
  {
    thread: {
      tid: getCafeThreadId(uid, 'packaging-bj'),
      type: 'user_user',
      initiatorId: `user:${uid}`,
      responderId: 'user:peer-packaging-bj',
      status: 'matched',
      matchScore: 84,
      summary: 'Persona agent 與包裝設計取向的 peer agent 對話紀錄。',
      userPresence: 'agent',
      govPresence: 'agent',
      peerPresence: 'agent',
      createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 72),
      updatedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 70),
    },
    partnerName: '文組轉設計的karina',
    avatarSource: karinaAvatar,
    highlight: '蠻像你',
    bullets: [
      '培訓課程名額比較到，先前先查',
      '文字能力是品牌設計的優勢，不用擔心',
    ],
    messages: [
      {
        mid: 'packaging-bj-1',
        tid: getCafeThreadId(uid, 'packaging-bj'),
        from: `coffee_agent:${uid}`,
        type: 'query',
        content: { text: '這位使用者對品牌設計有興趣，但目前方向還偏探索期。' } satisfies TextContent,
        createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 71),
      },
      {
        mid: 'packaging-bj-2',
        tid: getCafeThreadId(uid, 'packaging-bj'),
        from: 'coffee_agent:peer-packaging-bj',
        type: 'answer',
        content: { text: '對方有廣告文案背景，目前在台北市的設計培訓課，就補助申請流程也想像中容易。' } satisfies TextContent,
        createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 70.7),
      },
      {
        mid: 'packaging-bj-3',
        tid: getCafeThreadId(uid, 'packaging-bj'),
        from: `coffee_agent:${uid}`,
        type: 'answer',
        content: { text: '建議之後可以安排 coffee chat，聊作品集節奏和轉職切入點。' } satisfies TextContent,
        createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 70.3),
      },
    ],
  },
];

async function ensureCafeThreads(uid: string) {
  const sessions = buildCafeSessions(uid);
  const batch = writeBatch(db);

  for (const session of sessions) {
    const threadRef = doc(db, 'threads', session.thread.tid);
    batch.set(
      threadRef,
      {
        ...session.thread,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();

  for (const session of sessions) {
    const messagesRef = collection(db, 'threads', session.thread.tid, 'messages');
    const existingMessages = await getDocs(messagesRef);

    if (existingMessages.empty) {
      const messagesBatch = writeBatch(db);

      for (const message of session.messages) {
        messagesBatch.set(doc(messagesRef, message.mid), message);
      }

      await messagesBatch.commit();
    }
  }
}

export default function CafeChatScreen() {
  const { top } = useSafeAreaInsets();
  const { user } = useAuth();
  const currentUserId = user?.uid ?? 'mock-uid-001';
  const [sessions, setSessions] = useState<CafeChatSession[]>([]);
  const [isInsightModalVisible, setIsInsightModalVisible] = useState(true);

  const sessionMetaMap = useMemo(() => {
    const map = new Map<string, Omit<CafeChatSession, 'thread' | 'messages'>>();
    for (const session of buildCafeSessions(currentUserId)) {
      map.set(session.thread.tid, {
        partnerName: session.partnerName,
        avatarSource: session.avatarSource,
        highlight: session.highlight,
        bullets: session.bullets,
      });
    }
    return map;
  }, [currentUserId]);

  useEffect(() => {
    let isMounted = true;

    ensureCafeThreads(currentUserId).catch((error) => {
      console.error('[CafeChat] 初始化 sessions 失敗', error);
    });

    const threadsQuery = query(collection(db, 'threads'), orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(threadsQuery, async (snapshot) => {
      const candidateThreads = snapshot.docs
        .map((snapshotDoc) => snapshotDoc.data() as AgentThread)
        .filter((thread) => thread.type === 'user_user' && thread.initiatorId === `user:${currentUserId}`);

      const nextSessions = await Promise.all(
        candidateThreads.map(async (thread) => {
          const messagesSnapshot = await getDocs(query(collection(db, 'threads', thread.tid, 'messages'), orderBy('createdAt', 'asc')));
          const messages = messagesSnapshot.docs.map((messageDoc) => {
            const data = messageDoc.data();
            return {
              mid: messageDoc.id,
              tid: String(data.tid ?? thread.tid),
              from: String(data.from ?? ''),
              type: (data.type ?? 'answer') as ThreadMessage['type'],
              content:
                data.content && typeof data.content === 'object' ? (data.content as Record<string, unknown>) : {},
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
            } satisfies ThreadMessage;
          });

          const meta = sessionMetaMap.get(thread.tid);
          return {
            thread: {
              ...thread,
              createdAt:
                thread.createdAt instanceof Timestamp || thread.createdAt
                  ? thread.createdAt
                  : Timestamp.now(),
              updatedAt:
                thread.updatedAt instanceof Timestamp || thread.updatedAt
                  ? thread.updatedAt
                  : thread.createdAt instanceof Timestamp || thread.createdAt
                    ? thread.createdAt
                    : Timestamp.now(),
            },
            partnerName: meta?.partnerName ?? '新的對話',
            avatarSource: meta?.avatarSource ?? ianAvatar,
            highlight: meta?.highlight ?? '可能適合你',
            bullets: meta?.bullets ?? [],
            messages,
          } satisfies CafeChatSession;
        }),
      );

      if (isMounted) {
        setSessions(nextSessions);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUserId, sessionMetaMap]);

  return (
    <ThemedView style={styles.container}>
      <Modal
        animationType="fade"
        transparent
        visible={isInsightModalVisible}
        onRequestClose={() => setIsInsightModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View>
              <View style={styles.insightHeader}>
                <ThemedText style={styles.insightTitle} numberOfLines={1} adjustsFontSizeToFit>
                  本週 agent 幫你聊了 {sessions.length} 次
                </ThemedText>
              </View>
              <View style={styles.insightBody}>
                <ThemedText style={styles.insightText}>
                  和你情況相似的人，多數人在做的事是{'\n'}
                  先累積自主作品集，再去找實習或課程。
                </ThemedText>
              </View>
            </View>

            <Pressable style={styles.confirmButton} onPress={() => setIsInsightModalVisible(false)}>
              <ThemedText style={styles.confirmButtonText}>確認</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 18 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Coffee Chat
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            對未來還沒有想法嗎？沒關係～{'\n'}
            讓你的agent代替你去認識相似的人，{'\n'}
            看看他們的想法吧！！
          </ThemedText>
        </View>

        <ThemedText style={styles.sectionTitle}>最近的 chats</ThemedText>

        {sessions.map((session, index) => (
          <View key={session.thread.tid} style={[styles.sessionRow, index > 0 && styles.sessionRowSpacing]}>
            <View style={styles.avatarWrapper}>
              <View style={styles.singleAvatar}>
                <Image source={session.avatarSource} style={styles.avatarImage} resizeMode="cover" />
              </View>
              <View style={styles.avatarIndicator} />
            </View>

            <View style={styles.sessionInfo}>
              <ThemedText style={styles.partnerName}>{session.partnerName}</ThemedText>
              <ThemedText style={styles.tagLine}>
                <ThemedText style={styles.tagText}>{session.bullets.slice(0, 2).join('、')}</ThemedText>
                {session.bullets.length > 0 && session.highlight ? (
                  <ThemedText style={styles.tagText}>{` / 最近 ${session.highlight}`}</ThemedText>
                ) : null}
              </ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  header: {
    gap: 4,
    marginBottom: 18,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  subtitle: {
    color: '#7A7A7A',
    fontSize: 15,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#DDF7FA',
    borderRadius: 16,
    width: MODAL_WIDTH,
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  insightHeader: {
    backgroundColor: '#F7F0DF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#51C3E0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 56,
    justifyContent: 'center',
    marginBottom: 14,
  },
  insightBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#51C3E0',
    paddingHorizontal: 18,
    paddingVertical: 20,
    minHeight: 190,
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  insightTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#6C8FD9',
    textAlign: 'left',
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6C8FD9',
    textAlign: 'left',
  },
  confirmButton: {
    alignSelf: 'flex-end',
    minWidth: 132,
    backgroundColor: '#C7D8F5',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2C69B7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#1C2F57',
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#8A8A8A',
    marginBottom: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sessionRowSpacing: {
    marginTop: 28,
  },
  avatarWrapper: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  singleAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#D9D9D9',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A90D9',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  partnerName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  tagLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A90D9',
  },
});
