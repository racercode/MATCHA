import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { Timestamp } from '@matcha/shared-types';
import { msToTimestamp, toMs } from '@matcha/shared-types';

type ChatMessage = {
  mid: string
  tid: string
  from: string
  type: 'answer' | 'query' | 'human_note'
  content: Record<string, unknown>
  createdAt: Timestamp
};
import type { ClientEvent, ServerEvent } from '@matcha/shared-types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/containers/hooks/useAuth';
import { WS_URL } from '@/lib/api';

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

const buildSeedMessages = (threadId: string, uid: string): ChatMessage[] => [
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

const AGENT_AVATAR = require('@/assets/icons/wife.jpg');

const formatTimeLabel = (createdAt: Timestamp) =>
  new Date(toMs(createdAt)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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

function TypingBubble({ text }: { text: string }) {
  return (
    <View style={[styles.messageRow, styles.messageRowOther]}>
      <Image source={AGENT_AVATAR} style={styles.avatar} contentFit="cover" />
      <View style={[styles.bubble, styles.bubbleOther]}>
        <ThemedText style={styles.bubbleText}>{text || '…'}</ThemedText>
      </View>
    </View>
  );
}

function MessageBubble({ message, isOwnMessage }: { message: ChatMessage; isOwnMessage: boolean }) {
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamBufferRef = useRef('');

  const currentUserId = user?.uid ?? 'mock-uid-001';
  const threadId = getPersonaThreadId(currentUserId);
  const routeTid = Array.isArray(params.tid) ? params.tid[0] : params.tid;

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  // Redirect to canonical thread URL if needed
  useEffect(() => {
    if (!user?.uid) return;
    if (routeTid && routeTid !== threadId) {
      router.replace(`/thread/${threadId}`);
    }
  }, [routeTid, threadId, user?.uid]);

  // Initialize messages with seed data
  useEffect(() => {
    setMessages(buildSeedMessages(threadId, currentUserId));
  }, [currentUserId, threadId]);

  // WebSocket connection
  useEffect(() => {
    if (!currentUserId) return;
    const ws = new WebSocket(`${WS_URL}?token=${currentUserId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Chat] WS connected');
    };

    ws.onmessage = (event) => {
      try {
        const data: ServerEvent = JSON.parse(event.data);

        if (data.type === 'agent_reply') {
          if (!data.done) {
            // Accumulate streaming chunks
            streamBufferRef.current += data.content;
            setStreamingText(streamBufferRef.current);
            scrollToBottom();
          } else {
            // Finalize message
            const finalText = streamBufferRef.current + (data.content ?? '');
            streamBufferRef.current = '';
            setStreamingText(null);

            if (finalText.trim()) {
              setMessages((prev) => [
                ...prev,
                {
                  mid: `agent-${Date.now()}`,
                  tid: threadId,
                  from: PERSONA_AGENT_ID,
                  type: 'answer',
                  content: { text: finalText },
                  createdAt: msToTimestamp(Date.now()),
                },
              ]);
            }
            scrollToBottom();
          }
        }
      } catch {
        // ignore malformed events
      }
    };

    ws.onerror = (e) => {
      console.warn('[Chat] WS error', e);
    };

    ws.onclose = () => {
      console.log('[Chat] WS disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [currentUserId, threadId]);

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;

    setDraft('');

    // Add user message to local state
    setMessages((prev) => [
      ...prev,
      {
        mid: `human-${Date.now()}`,
        tid: threadId,
        from: `human:${currentUserId}`,
        type: 'human_note',
        content: { text: content },
        createdAt: msToTimestamp(Date.now()),
      },
    ]);
    scrollToBottom();

    // Send to mock server via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const event: ClientEvent = { type: 'persona_message', content };
      wsRef.current.send(JSON.stringify(event));
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
                toMs(item.createdAt) - toMs(previousMessage.createdAt) > 1000 * 60 * 8;
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
            ListFooterComponent={streamingText !== null ? <TypingBubble text={streamingText} /> : null}
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
