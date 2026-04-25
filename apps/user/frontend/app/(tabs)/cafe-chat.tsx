import { useEffect, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AgentThread, PeerPreview } from '@matcha/shared-types';
import { toMs } from '@matcha/shared-types';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/containers/hooks/useAuth';
import { API_BASE_URL } from '@/lib/api';

type PeerThreadItem = {
  thread: AgentThread;
  peer: PeerPreview;
  bullets: string[];
};

const MODAL_WIDTH = Dimensions.get('window').width - 40;

const PEER_AVATARS = [
  require('@/assets/icons/ian.png'),
  require('@/assets/icons/karina.png'),
]

const formatRelativeLabel = (createdAt: AgentThread['updatedAt']) => {
  const diffDays = Math.max(0, Math.floor((Date.now() - toMs(createdAt)) / (1000 * 60 * 60 * 24)));
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  return `${diffDays} 天前`;
};

const scoreToHighlight = (score?: number) => {
  if (!score) return '可能適合你';
  if (score >= 90) return '很像你';
  if (score >= 80) return '蠻像你';
  return '有點像你';
};

export default function CafeChatScreen() {
  const { top } = useSafeAreaInsets();
  const { user } = useAuth();
  const currentUserId = user?.uid ?? 'mock-uid-001';
  const [items, setItems] = useState<PeerThreadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInsightModalVisible, setIsInsightModalVisible] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetch(`${API_BASE_URL}/me/peer-threads`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success) {
          setItems(json.data.items as PeerThreadItem[]);
        }
      })
      .catch((err) => console.warn('[CafeChat] fetch 失敗', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

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
                  本週 agent 幫你聊了 {items.length} 次
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

        {isLoading ? (
          <ThemedText style={styles.loadingText}>載入中…</ThemedText>
        ) : (
          items.map((item, index) => (
            <View key={item.thread.tid} style={[styles.sessionRow, index > 0 && styles.sessionRowSpacing]}>
              <View style={styles.avatarWrapper}>
                <View style={styles.singleAvatar}>
                  <Image source={PEER_AVATARS[index % PEER_AVATARS.length]} style={styles.avatarImage} resizeMode="cover" />
                </View>
                <View style={styles.avatarIndicator} />
              </View>

              <View style={styles.sessionInfo}>
                <ThemedText style={styles.partnerName}>{item.peer.displayName}</ThemedText>
                <ThemedText style={styles.tagLine}>
                  <ThemedText style={styles.tagText}>{item.bullets.slice(0, 2).join('、')}</ThemedText>
                  {item.thread.matchScore != null ? (
                    <ThemedText style={styles.tagText}>{` / 最近 ${scoreToHighlight(item.thread.matchScore)}`}</ThemedText>
                  ) : null}
                </ThemedText>
                <ThemedText style={styles.dateLabel}>{formatRelativeLabel(item.thread.updatedAt)}</ThemedText>
              </View>
            </View>
          ))
        )}
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
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
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
    shadowOffset: { width: 0, height: 2 },
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
  dateLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#9CA3AF',
  },
});
