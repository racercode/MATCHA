import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Image, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Loading from '@/components/Loading';
import EditProfileModal from '@/components/EditProfileModal';
import { useAuth } from '@/containers/hooks/useAuth';
import { useProfile, type UserProfileData } from '@/containers/hooks/useProfile';

const mockCoinItems = [
  { id: 1, image: require('@/assets/images/icon.png'), coins: 50, title: '和同路人一起參加設計交流小聚' },
  { id: 2, image: require('@/assets/images/icon.png'), coins: 30, title: '整理你的作品集亮點與下一步' },
  { id: 3, image: require('@/assets/images/icon.png'), coins: 15, title: '小獎勵：本週成功完成偏好更新' },
];

export default function ProfileScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { user, isInitialized, loadingMessage, signOut } = useAuth();
  const { loadProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<'posts' | 'coins'>('posts');
  const [isTabsSticky, setIsTabsSticky] = useState(false);
  const [tabsOffsetY, setTabsOffsetY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [profileData, setProfileData] = useState<UserProfileData>({
    name: '',
    bio: '',
    school: '',
    grade: '',
    birthday: '',
    avatar: '',
  });

  const loadUserProfile = useCallback(async () => {
    if (!user?.uid) return;

    const remoteProfile = await loadProfile(user.uid);
    setProfileData({
      name: remoteProfile?.name || user.displayName || 'Matcha 使用者',
      bio:
        remoteProfile?.bio ||
        (user.email ? `使用 ${user.email} 登入中，正在建立自己的媒合偏好與探索路徑。` : '尚未設定個人簡介'),
      school: remoteProfile?.school || '',
      grade: remoteProfile?.grade || '',
      birthday: remoteProfile?.birthday || '',
      avatar: remoteProfile?.avatar || user.photoURL || '',
    });
  }, [loadProfile, user]);

  useEffect(() => {
    loadUserProfile().catch((error) => {
      console.error('[Profile] 載入個人資料失敗', error);
    });
  }, [loadUserProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUserProfile();
    } finally {
      setRefreshing(false);
    }
  }, [loadUserProfile]);

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    setIsTabsSticky(scrollY >= tabsOffsetY);
  };

  const handleTabsLayout = (event: any) => {
    const { y } = event.nativeEvent.layout;
    setTabsOffsetY(y);
  };

  const avatarSource = profileData.avatar ? { uri: profileData.avatar } : require('@/assets/icons/wife.jpg');
  const profileStats = useMemo(
    () => [
      { label: '媒合紀錄', value: '12' },
      { label: '回覆率', value: '86%' },
      { label: 'matcha 指數', value: profileData.name ? 'A+' : '--' },
    ],
    [profileData.name],
  );

  if (!isInitialized) return <Loading />;

  return (
    <>
      {loadingMessage != null && <Loading text={loadingMessage} opacity={false} />}
      {user?.uid ? (
        <EditProfileModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          userData={profileData}
          onProfileUpdated={setProfileData}
          userId={user.uid}
        />
      ) : null}

      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 100, paddingTop: top }]}>
          <View style={styles.topBanner}>
            <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              <ThemedText style={styles.settingsButtonText}>Settings</ThemedText>
            </Pressable>
          </View>

          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <Image source={avatarSource} style={styles.avatar} />
            </View>

            <View style={styles.nameRow}>
              <View style={styles.nameBlock}>
                <ThemedText style={styles.userName}>{profileData.name || 'Matcha 使用者'}</ThemedText>
                <ThemedText style={styles.userAccount}>@{user?.email?.split('@')[0] || 'matcha_user'}</ThemedText>
              </View>

              <Pressable style={styles.editButton} onPress={() => setIsEditModalVisible(true)}>
                <ThemedText style={styles.editButtonText}>編輯資料</ThemedText>
              </Pressable>
            </View>

            <View style={styles.bioContainer}>
              <ThemedText style={styles.bioText}>{profileData.bio || '尚未設定個人簡介'}</ThemedText>
            </View>

            <View style={styles.statsRow}>
              {profileStats.map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <ThemedText style={styles.statValue}>{item.value}</ThemedText>
                  <ThemedText style={styles.statLabel}>{item.label}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {isTabsSticky ? <View style={styles.tabsPlaceholder} /> : null}

          <View style={styles.tabContainer} onLayout={handleTabsLayout}>
            <Pressable style={[styles.tab, activeTab === 'posts' && styles.activeTab]} onPress={() => setActiveTab('posts')}>
              <ThemedText style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>貼文</ThemedText>
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'coins' && styles.activeTab]} onPress={() => setActiveTab('coins')}>
              <ThemedText style={[styles.tabText, activeTab === 'coins' && styles.activeTabText]}>金幣庫</ThemedText>
            </Pressable>
          </View>

          <View style={styles.contentContainer}>
            {activeTab === 'posts' ? (
              <View style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>這個版本先不載入 threads / 貼文內容</ThemedText>
                <ThemedText style={styles.emptySubtext}>外觀先完整對齊 `wvs_project50`，之後再把資料接上。</ThemedText>
              </View>
            ) : (
              <View style={styles.coinLibrary}>
                <View style={styles.seasonRewardContainer}>
                  <ThemedText style={styles.seasonRewardTitle}>這一季的累積獎金......！</ThemedText>
                  <ThemedText style={styles.seasonRewardScore}>50/50</ThemedText>
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: '100%' }]} />
                  </View>
                </View>

                <View style={styles.coinItemsList}>
                  {mockCoinItems.map((item) => (
                    <View key={item.id} style={styles.coinItem}>
                      <Image source={item.image} style={styles.coinItemImage} />
                      <View style={styles.coinBadge}>
                        <ThemedText style={styles.coinBadgeText}>{item.coins}</ThemedText>
                      </View>
                      <ThemedText style={styles.coinItemTitle}>{item.title}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Pressable style={styles.logoutButton} onPress={signOut}>
              <ThemedText style={styles.logoutButtonText}>登出</ThemedText>
            </Pressable>
          </View>
        </ScrollView>

        {isTabsSticky ? (
          <View style={styles.stickyTabContainer}>
            <Pressable style={[styles.tab, activeTab === 'posts' && styles.activeTab]} onPress={() => setActiveTab('posts')}>
              <ThemedText style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>貼文</ThemedText>
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'coins' && styles.activeTab]} onPress={() => setActiveTab('coins')}>
              <ThemedText style={[styles.tabText, activeTab === 'coins' && styles.activeTabText]}>金幣庫</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  settingsButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(23, 59, 99, 0.18)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topBanner: {
    height: 120,
    backgroundColor: '#E0F7FA',
    position: 'relative',
  },
  headerContent: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginTop: -40,
    marginBottom: 10,
    borderWidth: 4,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameBlock: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  userAccount: {
    fontSize: 14,
    lineHeight: 20,
    color: '#888',
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000',
    fontWeight: '600',
  },
  bioContainer: {
    marginTop: 8,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FCFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCECF9',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: '#1F5E96',
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#7E9BB8',
    marginTop: 4,
  },
  tabsPlaceholder: {
    height: 50,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  stickyTabContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFF',
    zIndex: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#A0E0E0',
  },
  tabText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#888',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    lineHeight: 20,
    color: '#B1B1B1',
    textAlign: 'center',
  },
  coinLibrary: {
    padding: 20,
  },
  seasonRewardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seasonRewardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: '#000',
    fontWeight: '700',
  },
  seasonRewardScore: {
    fontSize: 15,
    lineHeight: 20,
    color: '#000',
    fontWeight: '700',
  },
  progressBarContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 24,
    backgroundColor: '#FFC0CB',
    borderRadius: 12,
    overflow: 'hidden',
    opacity: 0.5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFB6C1',
    borderRadius: 12,
  },
  coinItemsList: {
    gap: 20,
  },
  coinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  coinItemImage: {
    width: 100,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#E0F7FA',
  },
  coinBadge: {
    backgroundColor: '#F5F0E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadgeText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#000',
  },
  coinItemTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    fontWeight: '500',
  },
  logoutButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#8FD6FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A7D8F5',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
