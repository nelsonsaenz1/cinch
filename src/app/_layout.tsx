import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold } from '@expo-google-fonts/archivo';
import { BodoniModa_400Regular, BodoniModa_600SemiBold } from '@expo-google-fonts/bodoni-moda';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
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

import { PaperGrain } from '@/components/ui/paper';
import { useDeepLinkAuth } from '@/features/auth/use-deep-link-auth';
import { useSession } from '@/features/auth/use-session';
import {
  persistBuster,
  persistMaxAge,
  persister,
  purgePersistedCache,
  queryClient,
  shouldDehydrateQuery,
} from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

import '@/global.css';

// Hold the splash until the fonts are in memory. Without this the first frame
// paints in the system fallback and then reflows once Bodoni and Archivo load —
// a visible jolt on the very first screen a new user ever sees.
void SplashScreen.preventAutoHideAsync();

/**
 * Anchor the root stack on the tabs. Without this, a cold-start deep link to
 * cinch://stylist or cinch://profile builds a stack containing ONLY that
 * route — the stylist sheet has no Today beneath it and nothing to pop back
 * to, and the profile modal cannot be dismissed at all. With the anchor the
 * link produces [(tabs), stylist], which is also what the sheet's 0.75 detent
 * is designed over.
 */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Erase the on-disk query cache whenever the signed-in identity changes.
 *
 * `useSession` already calls `queryClient.clear()` on the same events, but that
 * only empties memory — the dehydrated blob in SQLite survives it, and the next
 * cold start rehydrates it before anyone knows who is signed in. On a shared
 * device that means user B watching user A's closet paint in.
 *
 * This lives here rather than in `signOut()` because sign-out is not the only
 * way the identity changes: account deletion, a revoked refresh token, and the
 * magic-link callback all move the session without going through that function.
 * The auth event is the thing that is actually true in every case.
 *
 * `INITIAL_SESSION` and `TOKEN_REFRESHED` are deliberately not handled — the
 * first fires on every cold start, which is precisely when the cache must be
 * kept, and the second is the same user with a newer token.
 */
function usePersistedCachePurge() {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void purgePersistedCache();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}

/**
 * The routing gate.
 *
 * `useSegments` returns the current URL as an array — e.g. `['(tabs)', 'closet']`
 * or `['(auth)', 'sign-in']`. When the session doesn't match the current group
 * we redirect once, using `replace` so the auth screen doesn't sit on the back
 * stack after the user signs in.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  // Completes a magic-link sign-in when the link opens the app, including the
  // cold-start case where no URL event ever fires.
  useDeepLinkAuth();

  const session = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session.loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Design fixture routes stay reachable signed-out in development builds.
    if (__DEV__ && segments[0]?.startsWith('dev-')) return;

    // The magic-link callback is the one route a signed-OUT user is supposed to
    // be sitting on: it is where the PKCE code is exchanged, so by definition
    // there is no session yet when it mounts. Bouncing it to sign-in would tear
    // the screen down mid-exchange and swallow the "signing you in…" state and
    // any expired-link error the user needs to read. It routes itself when the
    // exchange settles.
    if (segments[0] === 'auth-callback') return;

    // `replace` only swaps the FOCUSED route. If the session ends while the
    // profile modal or stylist sheet is up, replacing in place would leave the
    // signed-in (tabs) subtree alive underneath the sign-in screen — and the
    // next sign-in would stack a second (tabs) on top of the first. Unwind to
    // the stack root first so replace always operates at depth 1.
    if (!session.userId && !inAuthGroup) {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/(auth)/sign-in');
    } else if (session.userId && inAuthGroup) {
      if (router.canDismiss()) router.dismissAll();
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

  usePersistedCachePurge();

  const [fontsLoaded, fontError] = useFonts({
    BodoniModa_400Regular,
    BodoniModa_600SemiBold,
    // Bodoni Moda is a variable font with an `opsz` (optical size) axis running
    // 6–96, and React Native cannot set variable axes on iOS — a variable TTF
    // renders only its default instance. The @expo-google-fonts static cuts are
    // all instanced at the axis default, opsz=11, which is the CAPTION master.
    // Rendering it at 62px gave the wordmark a 3.35-device-pixel hairline: thick,
    // muddy, and with none of the stroke contrast that is the entire reason to
    // set a didone large.
    //
    // This cut is instanced at opsz=24 (see scripts/build-fonts.sh). Measured
    // hairlines on the O, at 62px on a @3x screen:
    //
    //     opsz=11  3.35 device px   what we were shipping — no contrast
    //     opsz=24  1.58 device px   crisp on both @2x and @3x
    //     opsz=96  0.37 device px   true display master, but sub-pixel: drops out
    //
    // opsz≈point-size is the print rule; on screen it has to be biased coarser or
    // the hairline falls below one device pixel and renders as grey mush.
    BodoniModa_Display: require('@/assets/fonts/BodoniModa_Display.ttf'),
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
  });

  useEffect(() => {
    // Hide on error too. A missing font is a downgrade; a splash screen that
    // never goes away is a bricked app.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/*
        Persisted, not plain. The closet, the wardrobe and the learned style
        profile are written to SQLite and restored on launch, so a cold start
        with no signal still has something to dress you from — the styling
        engine is a local beam search and needs no network once those three are
        cached. Without this the app opened to an empty closet offline, which
        the App Store listing already claimed it did not.

        `shouldDehydrateQuery` is an allowlist and the exclusions matter as much
        as the inclusions; see the note on it in lib/query-client.ts.
      */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          buster: persistBuster,
          maxAge: persistMaxAge,
          dehydrateOptions: { shouldDehydrateQuery },
        }}
      >
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
              {/* Stylist is a sheet off Today, not a tab — a chat tab is the
                  generic-AI tell, and it duplicates Today's job. It OPENS at
                  0.75 so Today stays visible behind it — the conversation is
                  an aside on the page — but a long chat can be dragged to
                  full height. 38 is the `sheet` radius token. */}
              <Stack.Screen
                name="stylist"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.75, 1],
                  sheetGrabberVisible: true,
                  sheetCornerRadius: 38,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="profile"
                options={{ presentation: 'modal', headerShown: false }}
              />
            </Stack>
          </AuthGate>
        </ThemeProvider>
      </PersistQueryClientProvider>
      {/* The grain covers the base app only. Natively-presented modals sit in
          their own view controllers above this view — which is correct: the
          camera feed and the stylist sheet are not paper. */}
      <PaperGrain />
    </GestureHandlerRootView>
  );
}
