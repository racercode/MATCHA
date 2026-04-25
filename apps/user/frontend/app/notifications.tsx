import { useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useNotifications, type ChannelReplyItem } from '@/containers/hooks/useNotifications';

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

function ReplyCard({ item }: { item: ChannelReplyItem }) {
  const color = scoreColor(item.matchScore);
  const dot = scoreDot(item.matchScore);
  const category = deriveCategory(item.govName);

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
    </View>
  );
}

export default function NotificationsScreen() {
  const { top } = useSafeAreaInsets();
  const { items, isLoading, unreadCount, refresh, markAllRead } = useNotifications();

  // 進入頁面時自動標記已讀
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
          <ReplyCard key={item.replyId} item={item} />
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
});
