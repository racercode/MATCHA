import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useLocalSearchParams } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/containers/hooks/useAuth';
import { API_BASE_URL, WS_URL } from '@/lib/api';
import { auth } from '@/lib/firebase';

type HumanMessage = {
  mid: string;
  from: string;
  content: string;
  createdAt: Timestamp;
};

const formatTimeLabel = (createdAt: Timestamp) =>
  new Date(toMs(createdAt)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function StaffAvatar() {
  return <View style={styles.staffAvatar} />;
}

function MessageBubble({ message, isOwn }: { message: HumanMessage; isOwn: boolean }) {
  return (
    <View style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
      {!isOwn && <StaffAvatar />}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleStaff]}>
        <ThemedText style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
          {message.content}
        </ThemedText>
      </View>
    </View>
  );
}

export default function HumanChatScreen() {
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ tid?: string }>();
  const tid = Array.isArray(params.tid) ? params.tid[0] : params.tid;

  const [messages, setMessages] = useState<HumanMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const listRef = useRef<FlatList<HumanMessage>>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const currentUserId = user?.uid ?? '';

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  useEffect(() => {
    if (!user || !tid) return;
    let isMounted = true;

    auth.currentUser?.getIdToken().then((token) =>
      fetch(`${API_BASE_URL}/human-threads/${tid}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    .then((res) => res.json())
    .then((json) => {
      if (isMounted && json.success) {
        setMessages(json.data.items as HumanMessage[]);
      }
    })
    .catch((err) => console.warn('[HumanChat] history fetch 失敗', err))
    .finally(() => { if (isMounted) setIsLoading(false); });

    return () => { isMounted = false; };
  }, [tid, user]);

  useEffect(() => {
    if (!currentUserId) return;
    const ws = new WebSocket(`${WS_URL}?token=${currentUserId}`);
    wsRef.current = ws;

    ws.onopen = () => console.log('[HumanChat] WS connected');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'human_message') {
          setMessages((prev) => [...prev, data.message as HumanMessage]);
          scrollToBottom();
        }
      } catch { /* ignore */ }
    };

    ws.onerror = (e) => console.warn('[HumanChat] WS error', e);
    ws.onclose = () => console.log('[HumanChat] WS disconnected');

    return () => { ws.close(); wsRef.current = null; };
  }, [currentUserId]);

  const handleSend = () => {
    const content = draft.trim();
    if (!content || !tid) return;
    setDraft('');

    const optimistic: HumanMessage = {
      mid: `local-${Date.now()}`,
      from: `user:${currentUserId}`,
      content,
      createdAt: msToTimestamp(Date.now()),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'human_message', threadId: tid, content }));
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
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>載入中…</ThemedText>
            </View>
          ) : (
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
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>尚無訊息，開始對話吧！</ThemedText>
              }
              renderItem={({ item, index }) => {
                const previous = index > 0 ? messages[index - 1] : null;
                const showTimestamp =
                  previous == null ||
                  toMs(item.createdAt) - toMs(previous.createdAt) > 1000 * 60 * 8;
                const isOwn = item.from.startsWith('user:');

                return (
                  <View style={styles.messageBlock}>
                    {showTimestamp && (
                      <ThemedText style={styles.timestamp}>{formatTimeLabel(item.createdAt)}</ThemedText>
                    )}
                    <MessageBubble message={item} isOwn={isOwn} />
                  </View>
                );
              }}
            />
          )}

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
              <Pressable
                style={[styles.sendButton, draft.trim() ? styles.sendButtonActive : undefined]}
                onPress={handleSend}
              >
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#9CA3AF', fontSize: 14 },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 40 },
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
  staffAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginBottom: 2,
    backgroundColor: '#3DAD8B',
  },
  bubble: { maxWidth: '82%', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleStaff: { backgroundColor: '#E6F7F3', borderBottomLeftRadius: 10 },
  bubbleOwn: { backgroundColor: '#65A1FB', borderBottomRightRadius: 10 },
  bubbleText: { fontSize: 16, lineHeight: 22, color: '#222222' },
  bubbleTextOwn: { color: '#FFFFFF' },
  composerBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: '#3DAD8B',
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
    backgroundColor: '#A8DDD0',
  },
  sendButtonActive: {
    backgroundColor: '#2A8C6E',
  },
});
