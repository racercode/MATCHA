import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useNotifications, type ChannelReplyItem } from '@/containers/hooks/useNotifications';
import { useFollowUp, type FollowUpMessage } from '@/containers/hooks/useFollowUp';

const agentMarkdownStyles = {
  body: { color: '#374151', fontSize: 13, lineHeight: 20 },
  paragraph: { marginTop: 0, marginBottom: 4 },
  bullet_list: { marginTop: 0, marginBottom: 4 },
  ordered_list: { marginTop: 0, marginBottom: 4 },
  list_item: { marginBottom: 2 },
  heading1: { fontSize: 15, fontWeight: '700' as const, color: '#1A1A1A', marginBottom: 4 },
  heading2: { fontSize: 14, fontWeight: '700' as const, color: '#1A1A1A', marginBottom: 4 },
  heading3: { fontSize: 13, fontWeight: '600' as const, color: '#1A1A1A', marginBottom: 2 },
  code_inline: { backgroundColor: '#E5E7EB', borderRadius: 4, paddingHorizontal: 4, fontSize: 12, fontFamily: 'monospace' },
  fence: { backgroundColor: '#E5E7EB', borderRadius: 8, padding: 8, fontSize: 12, fontFamily: 'monospace' },
  strong: { fontWeight: '700' as const },
  em: { fontStyle: 'italic' as const },
  link: { color: '#65A1FB', textDecorationLine: 'underline' as const },
};

const scoreColor = (score: number) => {
  if (score >= 88) return '#22C55E';
  if (score >= 72) return '#65A1FB';
  return '#F59E0B';
};

const scoreDot = (score: number) => {
  if (score >= 88) return '#22C55E';
  if (score >= 72) return '#818CF8';
  return '#F59E0B';
};

const deriveCategory = (name: string): string => {
  if (name.includes('實習')) return '實習計畫';
  if (name.includes('留學')) return '留學資源';
  if (name.includes('貸款') || name.includes('融資')) return '創業資金';
  if (name.includes('補助')) return '補助計畫';
  if (name.includes('創業') || name.includes('共享空間')) return '創業支援';
  return '資源媒合';
};

const formatDate = (ms: number): string => {
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - ms) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

function ReplyCard({
  item,
  messages,
  loading,
  onSend,
}: {
  item: ChannelReplyItem;
  messages: FollowUpMessage[];
  loading: boolean;
  onSend: (question: string) => void;
}) {
  const color = scoreColor(item.matchScore);
  const dot = scoreDot(item.matchScore);
  const category = deriveCategory(item.govName);
  const [expanded, setExpanded] = useState(false);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    const q = inputText.trim();
    if (!q || loading) return;
    setInputText('');
    onSend(q);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.cardHeader}>
        <View style={styles.cardTag}>
          <ThemedText style={styles.cardTagText}>{category}</ThemedText>
        </View>
        <ThemedText style={styles.cardDate}>{formatDate(item.createdAt)}</ThemedText>
      </View>
      <ThemedText style={styles.cardTitle} numberOfLines={2}>{item.govName}</ThemedText>
      <ThemedText style={styles.cardDesc} numberOfLines={3}>{item.content}</ThemedText>
      <View style={styles.scoreRow}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${item.matchScore}%` as any, backgroundColor: color }]} />
        </View>
        <ThemedText style={[styles.scoreLabel, { color }]}>符合度 {item.matchScore}%</ThemedText>
      </View>

      <Pressable onPress={() => setExpanded(e => !e)} style={styles.followUpToggle}>
        <ThemedText style={styles.followUpToggleText}>
          {expanded ? '收起 ↑' : '追問此資源 ↓'}
        </ThemedText>
      </Pressable>

      {expanded && (
        <View style={styles.followUpPanel}>
          {messages.map((msg, i) => (
            <View
              key={i}
              style={[
                styles.msgBubble,
                msg.role === 'user' ? styles.msgUser : msg.role === 'error' ? styles.msgError : styles.msgAgent,
              ]}
            >
              {msg.role === 'agent' ? (
                <Markdown style={agentMarkdownStyles}>{msg.text}</Markdown>
              ) : (
                <ThemedText style={[styles.msgText, msg.role === 'user' && styles.msgTextUser]}>
                  {msg.text}
                </ThemedText>
              )}
            </View>
          ))}
          {loading && <ActivityIndicator size="small" color="#65A1FB" style={styles.loader} />}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="輸入追問問題…"
              placeholderTextColor="#9CA3AF"
              editable={!loading}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || loading}
              style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
            >
              <Ionicons name="send" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function NotificationsScreen() {
  const { top } = useSafeAreaInsets();
  const { items, isLoading, unreadCount, refresh, markAllRead } = useNotifications();
  const { getMessages, isLoading: isFollowUpLoading, sendQuestion } = useFollowUp();

  useEffect(() => {
    if (items.length > 0) {
      markAllRead();
    }
  }, [items.length, markAllRead]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: '通知', headerBackTitle: 'Back' }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headingRow}>
          <ThemedText style={styles.heading}>
            {isLoading ? '載入中…' : `${items.length} 個資源主動找你`}
          </ThemedText>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <ThemedText style={styles.unreadPillText}>{unreadCount} 則未讀</ThemedText>
            </View>
          )}
        </View>

        {!isLoading && items.length === 0 && (
          <ThemedText style={styles.empty}>目前還沒有配對資源，繼續和 AI 對話讓它更了解你！</ThemedText>
        )}

        {items.map(item => (
          <ReplyCard
            key={item.replyId}
            item={item}
            messages={getMessages(item.replyId)}
            loading={isFollowUpLoading(item.replyId)}
            onSend={(question) => sendQuestion(item.replyId, item.resourceId, question)}
          />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  unreadPill: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unreadPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF3FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5B7FD6',
  },
  cardDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 18,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 6,
    paddingRight: 20,
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'right',
  },
  followUpToggle: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  followUpToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65A1FB',
  },
  followUpPanel: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    gap: 8,
  },
  msgBubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '85%',
  },
  msgAgent: {
    backgroundColor: '#EEF7FF',
    alignSelf: 'flex-start',
  },
  msgUser: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-end',
  },
  msgError: {
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
  },
  msgText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  msgTextUser: {
    color: '#1A1A1A',
  },
  loader: {
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1A1A1A',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#65A1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
});
