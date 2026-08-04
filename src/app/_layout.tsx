import { QueryClientProvider } from '@tanstack/react-query';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useSession } from '@/features/auth/use-session';
import { queryClient } from '@/lib/query-client';

import '@/global.css';

/**
 * The routing gate.
 *
 * `useSegments` returns the current URL as an array — e.g. `['(tabs)', 'closet']`
 * or `['(auth)', 'sign-in']`. When the session doesn't match the current group
 * we redirect once, using `replace` so the auth screen doesn't sit on the back
 * stack after the user signs in.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session.loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session.userId && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session.userId && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, router]);

  // Session hydrates from AsyncStorage on mount. Waiting a beat here prevents
  // the sign-in screen flashing for a user who was already signed in on a
  // previous launch.
  if (session.loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {/*
          ThemeProvider, DefaultTheme and DarkTheme now come from `expo-router`
          itself — SDK 56 dropped React Navigation as the underlying
          implementation, so importing these from '@react-navigation/native'
          (as every older tutorial does) will not resolve.
        */}
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="capture"
                options={{ presentation: 'modal', headerShown: false }}
              />
              <Stack.Screen
                name="review"
                options={{ presentation: 'fullScreenModal', headerShown: false }}
              />
            </Stack>
          </AuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
