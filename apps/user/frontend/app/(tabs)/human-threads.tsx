import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/containers/hooks/useAuth';
import { API_BASE_URL } from '@/lib/api';
import { auth } from '@/lib/firebase';

type HumanThreadItem = {
  tid: string;
  govId: string;
  govName: string;
  matchScore: number;
  status: 'open' | 'closed';
  updatedAt: number;
};

const formatRelativeLabel = (ms: number) => {
  const diffDays = Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  return `${diffDays} 天前`;
};

const scoreLabel = (score: number) => {
  if (score >= 90) return '高度符合';
  if (score >= 75) return '相當符合';
  return '部分符合';
};

export default function HumanThreadListScreen() {
  const { top } = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<HumanThreadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    auth.currentUser?.getIdToken().then((token) =>
      fetch(`${API_BASE_URL}/me/human-threads?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
    .then((res) => res?.json())
    .then((json) => {
      if (isMounted && json?.success) {
        setItems(json.data.items as HumanThreadItem[]);
      }
    })
    .catch((err) => console.warn('[HumanThreads] fetch 失敗', err))
    .finally(() => { if (isMounted) setIsLoading(false); });

    return () => { isMounted = false; };
  }, [user]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: top + 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>政府聯絡</ThemedText>
          <ThemedText style={styles.subtitle}>
            政府承辦人員根據你的需求，{'\n'}主動聯繫你的對話紀錄。
          </ThemedText>
        </View>

        <ThemedText style={styles.sectionTitle}>我的對話</ThemedText>

        {isLoading ? (
          <ThemedText style={styles.loadingText}>載入中…</ThemedText>
        ) : items.length === 0 ? (
          <ThemedText style={styles.emptyText}>尚無政府聯絡對話</ThemedText>
        ) : (
          items.map((item, index) => (
            <Pressable
              key={item.tid}
              style={[styles.row, index > 0 && styles.rowSpacing]}
              onPress={() => router.push(`/human-thread/${item.tid}`)}
            >
              <View style={styles.avatarCircle}>
                <ThemedText style={styles.avatarInitial}>
                  {(item.govName ?? item.govId).charAt(0).toUpperCase()}
                </ThemedText>
              </View>

              <View style={styles.rowInfo}>
                <View style={styles.rowTop}>
                  <ThemedText style={styles.govName} numberOfLines={1}>
                    {item.govName ?? item.govId}
                  </ThemedText>
                  <View style={[styles.statusDot, item.status === 'open' ? styles.statusOpen : styles.statusClosed]} />
                </View>
                <View style={styles.rowMeta}>
                  <View style={styles.scoreBadge}>
                    <ThemedText style={styles.scoreBadgeText}>{scoreLabel(item.matchScore)}</ThemedText>
                  </View>
                  <ThemedText style={styles.dateLabel}>{formatRelativeLabel(item.updatedAt)}</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.chevron}>›</ThemedText>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  header: { gap: 4, marginBottom: 18 },
  title: { fontSize: 34, lineHeight: 40 },
  subtitle: { color: '#7A7A7A', fontSize: 15, lineHeight: 24 },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#8A8A8A',
    marginBottom: 12,
  },
  loadingText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 32 },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowSpacing: { marginTop: 24 },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3DAD8B',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  rowInfo: { flex: 1, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  govName: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOpen: { backgroundColor: '#3DAD8B' },
  statusClosed: { backgroundColor: '#C0C4CC' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreBadge: {
    backgroundColor: '#E6F7F3',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scoreBadgeText: { fontSize: 12, lineHeight: 18, color: '#2A8C6E', fontWeight: '600' },
  dateLabel: { fontSize: 12, lineHeight: 16, color: '#9CA3AF' },
  chevron: { fontSize: 22, color: '#C0C4CC', marginLeft: 4 },
});
