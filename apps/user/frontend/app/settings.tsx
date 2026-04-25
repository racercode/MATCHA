import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Loading from '@/components/Loading';
import { useAuth } from '@/containers/hooks/useAuth';
import { clearPersonaLocalCache, resetPersonaMemory } from '@/lib/resetMemory';

export default function SettingsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [isClearingLocalCache, setIsClearingLocalCache] = useState(false);

  const handleResetMemory = () => {
    if (!user?.uid || isResetting) return;

    Alert.alert(
      'Reset Memory',
      '這會清除目前裝置上的 persona 快取，並重置 Persona Agent 的重用 session，不會刪除 Firestore 資料。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetPersonaMemory(user.uid);
              Alert.alert('完成', '本機快取與 Persona Agent session 已重置。');
              router.back();
            } catch (error: any) {
              Alert.alert('重置失敗', error?.message ?? '請稍後再試');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ],
    );
  };

  const handleClearLocalCache = () => {
    if (!user?.uid || isClearingLocalCache) return;

    Alert.alert(
      'Clear Local Cache',
      '這只會清掉目前裝置上的 AsyncStorage 快取，不會刪除 Firebase / 後端資料。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            setIsClearingLocalCache(true);
            try {
              await clearPersonaLocalCache(user.uid);
              Alert.alert('完成', '本機快取已清除。');
            } catch (error: any) {
              Alert.alert('清除失敗', error?.message ?? '請稍後再試');
            } finally {
              setIsClearingLocalCache(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      {isResetting || isClearingLocalCache ? (
        <Loading
          text={isResetting ? '正在重置 memory...' : '正在清除本機快取...'}
          opacity={false}
        />
      ) : null}
      <ThemedView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: top + 16, paddingBottom: bottom + 32 }]}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={22} color="#173B63" />
            </Pressable>
            <ThemedText style={styles.title}>Settings</ThemedText>
            <View style={styles.iconSpacer} />
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Memory</ThemedText>
            <View style={styles.panel}>
              <View style={styles.panelCopy}>
                <ThemedText style={styles.panelTitle}>Reset Memory</ThemedText>
                <ThemedText style={styles.panelDescription}>
                  清除這台裝置上的 persona chat / card 快取，並把 Persona Agent 的重用 session 清掉；Firestore 資料會保留。
                </ThemedText>
              </View>

              <Pressable style={styles.resetButton} onPress={handleResetMemory}>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.resetButtonText}>Reset Memory</ThemedText>
              </Pressable>

              <Pressable style={styles.localClearButton} onPress={handleClearLocalCache}>
                <Ionicons name="trash-outline" size={18} color="#173B63" />
                <ThemedText style={styles.localClearButtonText}>Clear Local Cache</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FAFF',
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E4F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#173B63',
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7B93AC',
    fontWeight: '700',
  },
  panel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E9F8',
    gap: 18,
    shadowColor: '#A8C4DE',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  panelCopy: {
    gap: 8,
  },
  panelTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: '#173B63',
  },
  panelDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#687C93',
  },
  resetButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#E05666',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  localClearButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#E8F3FF',
    borderWidth: 1,
    borderColor: '#C7DEFA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  localClearButtonText: {
    color: '#173B63',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
});
