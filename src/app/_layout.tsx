import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Text } from '@/components/ui/text';
import { useDeepLinkAuth } from '@/features/auth/use-deep-link-auth';
import { useSession } from '@/features/auth/use-session';
import { Superwall } from '@/features/billing/superwall';
import { Analytics, identifyUser, useScreenTracking } from '@/lib/posthog';
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
// paints in the system fallback and then reflows once the serif loads —
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
 * Bind analytics identity to the auth state.
 *
 * `INITIAL_SESSION` IS handled here, unlike the cache purge above, and the
 * difference is the point: a returning user's cold start must identify as that
 * user, or every session until their next explicit sign-in is attributed to a
 * fresh anonymous id and retention reads as churn. `TOKEN_REFRESHED` stays
 * ignored — same person, newer token.
 *
 * Only the Supabase UUID is sent. No email, no name — see the header of
 * lib/posthog.tsx for why that line is load-bearing for App Review, not taste.
 */
function useAnalyticsIdentity() {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user.id) identifyUser(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        identifyUser(null);
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

  // Manual screen views — expo-router hides its NavigationContainer, so the
  // SDK's own screen autocapture cannot see route names here. The joined
  // segments are stable route identifiers ('(tabs)/closet'), never params.
  useScreenTracking(segments.join('/') || 'index');

  useEffect(() => {
    if (session.loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Design fixture routes.
    //
    // Expo Router registers every file under src/app/, so the dev- screens ship
    // in the production bundle whether or not anything links to them — and each
    // one presents hard-coded outfits, wear counts and cost-per-wear as if they
    // were the user's own. In a release build a deep link to cinch://dev-today
    // would therefore show a signed-in user convincing fake data about their own
    // wardrobe. Reachable in development, bounced to the app in production.
    if (segments[0]?.startsWith('dev-')) {
      if (__DEV__) return;
      if (router.canDismiss()) router.dismissAll();
      router.replace(session.userId ? '/(tabs)' : '/(auth)/sign-in');
      return;
    }

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
      // The tail of the sign-in flow runs signed IN by definition: the name
      // screen (W-13) writes the greeting name onto a session that already
      // exists, and the handoff (W-14) is the held beat between "session
      // written" and the tabs. Bouncing either would tear the flow down
      // mid-sentence; both exit via their own router.replace.
      // Typed routes narrow `segments` to per-route tuples, and the shortest
      // is `[string]` — indexing [1] is a type error there though it is just
      // `undefined` at runtime. Widen once rather than switch on every shape.
      const authLeaf = (segments as string[])[1];
      if (authLeaf === 'handoff' || authLeaf === 'name') return;
      // Any other (auth) route with a live session goes to the handoff, not
      // straight to the tabs. This is what makes the end of the flow immune
      // to the race between a screen's own success navigation and this
      // effect firing on the session write: whichever runs first, the user
      // lands on W-14, which sends nameless new accounts through W-13 and
      // gives everyone else the held beat. It also covers the signed-in
      // cold start that hydrates while the cover is up — that user gets the
      // "Welcome back" beat instead of a hard cut. The guarantee that a
      // signed-in user can never SIT on the sign-in cover is unchanged.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/(auth)/handoff');
    }
  }, [session, segments, router]);

  // Session hydrates from AsyncStorage on mount. Waiting a beat here prevents
  // the sign-in screen flashing for a user who was already signed in on a
  // previous launch.
  //
  // The frame that shows while it hydrates is the FIRST frame after the splash,
  // and it used to be an iOS blue-grey `ActivityIndicator` on paper. The splash
  // is the wordmark's canvas (#FBFAF6, app.config.ts); this holds that same
  // ground and prints the wordmark on it, so the handover reads as one screen
  // settling rather than two screens swapping. No spinner: the wait is usually
  // a few frames, and a ring that appears and vanishes is a flicker, not
  // feedback.
  if (session.loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Text variant="display" trim>
          Cinch
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  usePersistedCachePurge();
  useAnalyticsIdentity();

  const [fontsLoaded, fontError] = useFonts({
    // The display face — the whole app is set in one weight of one serif. Only
    // the serif is loaded here; the grotesque half of the system is Helvetica
    // Neue, an iOS system face that needs no bundling. Instrument Serif is a
    // single optical master (no `opsz` axis), so it needs no instanced cut —
    // the stock TTF is the display cut.
    InstrumentSerif_400Regular,
    // The italic is a real cut, not a slant: React Native does not synthesise
    // italics for a loaded family, so the emphasis words ("already own.") need
    // their own family name. See fontFamily.displayItalic in tailwind.config.js.
    InstrumentSerif_400Regular_Italic,
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
        {/*
          Pinned to light, not read from `useColorScheme`. The app declares
          `userInterfaceStyle: 'light'` (app.config.ts) and the palette has one
          set of values — the `dark:` halves in tailwind.config.js are the same
          hexes as the light ones. Branching on the system scheme therefore
          bought nothing and cost a real bug on a device set to Dark: expo-
          router's DarkTheme paints its own near-black under every navigator,
          which shows through as a dark flash between screens and behind the
          modal sheets while the canvas of the incoming screen mounts. The
          status bar goes with it — dark glyphs, because every screen but the
          sign-in hero is paper, and that one screen sets its own.
        */}
        <ThemeProvider value={DefaultTheme}>
          <StatusBar style="dark" />
          {/*
            Inside the query provider, because the identity binding reads
            `useSession` — which subscribes to the query client to purge caches
            on a change of user. Outside `AuthGate`, so the SDK configures and
            fetches paywall assignments while the session is still hydrating
            rather than after the first screen has painted.
          */}
          {/*
            Analytics wraps Superwall, not the reverse: the provider only adds
            lifecycle/screen autocapture, and paywall screens are screens too —
            a paywall impression that never reaches analytics is a funnel with a
            hole at its most important step.
          */}
          <Analytics>
            <Superwall>
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
                {/* Profile edit is a sheet off the closet, in the same dialect
                    as the stylist: a form you fill and dismiss, not a place
                    you go. Full height (no partial detent — the form is long
                    and a half sheet would open already scrolled), with the
                    grabber and the 38 `sheet` radius so the two sheets in the
                    app are visibly the same object. Capture stays a
                    full-screen modal above: a camera stage is not a sheet. */}
                <Stack.Screen
                  name="profile"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                {/* Privacy (consent atlas A-06) is pushed FROM the profile
                    sheet, so it presents as a sheet in the same dialect —
                    its own back chevron returns to Profile, which stays
                    mounted underneath. */}
                <Stack.Screen
                  name="privacy"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
              </Stack>
              </AuthGate>
            </Superwall>
          </Analytics>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
