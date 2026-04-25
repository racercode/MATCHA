import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { AgentThread, ThreadMessage, TimestampValue } from '@matcha/shared-types';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/containers/hooks/useAuth';
import { db } from '@/lib/firebase';

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

export const getPersonaThreadId = (uid: string) => `thread-persona-chat-${uid}`;

const buildMockThread = (uid: string): AgentThread => ({
  tid: getPersonaThreadId(uid),
  type: 'gov_user',
  initiatorId: PERSONA_AGENT_ID,
  responderId: `user:${uid}`,
  status: 'matched',
  matchScore: 91,
  summary: 'General chat with the persona agent.',
  userPresence: 'human',
  govPresence: 'agent',
  createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 45),
  updatedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 2),
});

const buildMockMessages = (threadId: string, uid: string): ThreadMessage[] => [
  {
    mid: 'm-001',
    tid: threadId,
    from: 'persona_agent:student-02',
    type: 'answer',
    content: { text: '嗨，我在這裡陪你聊聊。最近最想整理的是哪一件事？' } satisfies TextContent,
    createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 35),
  },
  {
    mid: 'm-002',
    tid: threadId,
    from: `human:${uid}`,
    type: 'query',
    content: { text: '我最近有點焦慮，不知道要先處理學校還是工作。' } satisfies TextContent,
    createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 28),
  },
  {
    mid: 'm-003',
    tid: threadId,
    from: 'persona_agent:student-02',
    type: 'answer',
    content: { text: '可以，我們先拆小一點。現在壓力最大的，是時間不夠，還是方向不清楚？' } satisfies TextContent,
    createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 27),
  },
  {
    mid: 'm-004',
    tid: threadId,
    from: `human:${uid}`,
    type: 'human_note',
    content: { text: '比較像是方向不清楚，我不知道先做哪件事最有效。' } satisfies TextContent,
    createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 24),
  },
  {
    mid: 'm-005',
    tid: threadId,
    from: 'persona_agent:student-02',
    type: 'query',
    content: { text: '那我們先從你這週一定得完成的事情開始，列 2 到 3 件就好。' } satisfies TextContent,
    createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 16),
  },
  {
    mid: 'm-006',
    tid: threadId,
    from: 'persona_agent:student-02',
    type: 'answer',
    content: {
      kind: 'post_preview',
      author: 'wife',
      handle: '@matcha.agent',
      ageLabel: 'now',
      text: '先把最重要的一件事情完成，其餘的我們可以一起往後排。',
      likes: 0,
      comments: 0,
      reposts: 0,
      shares: 0,
    } satisfies PostPreviewContent,
    createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 15),
  },
  {
    mid: 'm-007',
    tid: threadId,
    from: `human:${uid}`,
    type: 'human_note',
    content: { text: '好，那我先整理這週最重要的三件事。' } satisfies TextContent,
    createdAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 12),
  },
];

const AGENT_AVATAR = require('@/assets/icons/wife.jpg');

const getTimestampMs = (timestamp: TimestampValue) => {
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  return timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1_000_000);
};

const formatTimeLabel = (timestamp: TimestampValue) =>
  new Date(getTimestampMs(timestamp)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const isPostPreview = (content: Record<string, unknown>): content is PostPreviewContent =>
  content.kind === 'post_preview' && typeof content.author === 'string' && typeof content.text === 'string';

const getTextContent = (content: Record<string, unknown>) => (typeof content.text === 'string' ? content.text : '');

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

function MessageBubble({ message, isOwnMessage }: { message: ThreadMessage; isOwnMessage: boolean }) {
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
}

export default function ChatThreadScreen() {
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ tid?: string }>();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const listRef = useRef<FlatList<ThreadMessage>>(null);
  const currentUserId = user?.uid ?? 'mock-uid-001';
  const threadId = getPersonaThreadId(currentUserId);
  const thread = useMemo(() => buildMockThread(currentUserId), [currentUserId]);
  const seedMessages = useMemo(() => buildMockMessages(threadId, currentUserId), [currentUserId, threadId]);
  const routeTid = Array.isArray(params.tid) ? params.tid[0] : params.tid;

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  useEffect(() => {
    if (!user?.uid) return;
    if (routeTid && routeTid !== threadId) {
      router.replace(`/thread/${threadId}`);
    }
  }, [routeTid, threadId, user?.uid]);

  useEffect(() => {
    let isMounted = true;

    const setupThread = async () => {
      const threadRef = doc(db, 'threads', threadId);
      const messagesRef = collection(threadRef, 'messages');

      await setDoc(
        threadRef,
        {
          ...thread,
          responderId: `user:${currentUserId}`,
          createdAt: thread.createdAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      const existingMessages = await getDocs(query(messagesRef, orderBy('createdAt', 'asc')));
      if (existingMessages.empty) {
        const batch = writeBatch(db);
        for (const message of seedMessages) {
          const messageRef = doc(messagesRef, message.mid);
          batch.set(messageRef, message);
        }
        await batch.commit();
      }

      const unsubscribe = onSnapshot(query(messagesRef, orderBy('createdAt', 'asc')), (snapshot) => {
        if (!isMounted) return;

        const nextMessages = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data();
          return {
            mid: snapshotDoc.id,
            tid: String(data.tid ?? threadId),
            from: String(data.from ?? ''),
            type: (data.type ?? 'human_note') as ThreadMessage['type'],
            content:
              data.content && typeof data.content === 'object' ? (data.content as Record<string, unknown>) : {},
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
          } satisfies ThreadMessage;
        });

        setMessages(nextMessages);
        scrollToBottom(false);
      });

      return unsubscribe;
    };

    let teardown: (() => void) | undefined;
    setupThread()
      .then((unsubscribe) => {
        teardown = unsubscribe;
      })
      .catch((error) => {
        console.error('[Chat] 初始化對話失敗', error);
        if (isMounted) {
          setMessages(seedMessages);
        }
      });

    return () => {
      isMounted = false;
      teardown?.();
    };
  }, [currentUserId, seedMessages, thread, threadId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;

    setDraft('');

    try {
      const threadRef = doc(db, 'threads', threadId);
      await addDoc(collection(threadRef, 'messages'), {
        tid: threadId,
        from: `human:${currentUserId}`,
        type: 'human_note',
        content: { text: content },
        createdAt: serverTimestamp(),
      });

      await setDoc(
        threadRef,
        {
          responderId: `user:${currentUserId}`,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error('[Chat] 傳送訊息失敗', error);
      setDraft(content);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.mid}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            onContentSizeChange={() => scrollToBottom(false)}
            renderItem={({ item, index }) => {
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const showTimestamp =
                previousMessage == null ||
                getTimestampMs(item.createdAt) - getTimestampMs(previousMessage.createdAt) > 1000 * 60 * 8;
              const isOwnMessage = item.from === `human:${currentUserId}`;

              return (
                <View style={styles.messageBlock}>
                  {showTimestamp ? (
                    <ThemedText style={styles.timestamp}>{formatTimeLabel(item.createdAt)}</ThemedText>
                  ) : null}
                  <MessageBubble message={item} isOwnMessage={isOwnMessage} />
                </View>
              );
            }}
          />

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
  messagesContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 8 },
  messageBlock: { gap: 10 },
  timestamp: {
    alignSelf: 'center',
    fontSize: 12,
    lineHeight: 16,
    color: '#C0C4CC',
    fontWeight: '600',
    marginVertical: 8,
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
