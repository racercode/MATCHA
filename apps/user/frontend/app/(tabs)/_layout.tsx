import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getPersonaThreadId } from '@/components/chat/ChatThreadScreen';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/containers/hooks/useColorScheme';
import { useAuth } from '@/containers/hooks/useAuth';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !user) {
      router.replace('/signin');
    }
  }, [isInitialized, router, user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarShowLabel: false,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarButton: () => (
            <Pressable
              onPress={() => {
                if (!user?.uid) {
                  router.push('/signin');
                  return;
                }
                router.push(`/thread/${getPersonaThreadId(user.uid)}`);
              }}
              style={styles.chatTabButton}
            >
              <Image source={require('@/assets/icons/MsgTab.svg')} style={{ width: 36, height: 36 }} />
            </Pressable>
          ),
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('@/assets/icons/MsgTab1.svg') : require('@/assets/icons/MsgTab.svg')}
              style={{ width: 36, height: 36 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cafe-chat"
        options={{
          title: 'Cafe Chat',
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('@/assets/icons/CafeTab1.svg') : require('@/assets/icons/CafeTab.svg')}
              style={{ width: 32, height: 29 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="human-threads"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: 'Card',
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('@/assets/icons/PostTab1.svg') : require('@/assets/icons/PostTab.svg')}
              style={{ width: 35, height: 35 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused ? require('@/assets/icons/ProfileTab.svg') : require('@/assets/icons/ProfileTab1.svg')}
              style={{ width: 36, height: 36 }}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  chatTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
