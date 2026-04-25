import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/containers/hooks/useColorScheme';
import { AuthProvider } from '@/containers/hooks/useAuth';
import { NotificationsProvider } from '@/containers/hooks/useNotifications';
import '@/global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="settings"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="thread/[tid]"
                options={{
                  presentation: 'card',
                  title: 'Chat',
                  headerBackTitle: 'Back',
                }}
              />
              <Stack.Screen
                name="human-thread/[tid]"
                options={{
                  presentation: 'card',
                  title: 'Staff Chat',
                  headerBackTitle: 'Back',
                }}
              />
              <Stack.Screen name="notifications" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="signin" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
