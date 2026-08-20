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
import { ToastHost } from '@/components/ui/toast-host';
import { AnalyticsProperties } from '@/features/analytics/analytics-properties';
import { isoWeek } from '@/features/analytics/signup-week';
import { useDeepLinkAuth } from '@/features/auth/use-deep-link-auth';
import { useSession } from '@/features/auth/use-session';
import { useInviteDeepLink } from '@/features/invite/use-invite-deep-link';
import { Superwall } from '@/features/billing/superwall';
import { useReportTimeZone } from '@/features/push/time-zone';
import { UpdateCoordinator } from '@/features/updates/update-coordinator';
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
 *
 * The signup week rides along because this is the one place it is free: the
 * session already carries `created_at`, so no query is needed to cohort the
 * user. It is derived from a fixed string, which keeps the call pure — and it
 * is set ONCE on the person, never overwritten. The rest of the person
 * properties are set by `AnalyticsProperties`, which cannot live here: this
 * hook runs outside the query provider. See that file.
 */
function useAnalyticsIdentity() {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user.id) {
          // The cohort rides on SIGNED_IN only. `INITIAL_SESSION` fires on
          // every cold start, and a set-once property re-sent each launch is a
          // billed person update per launch for a value that by definition
          // cannot have changed. SIGNED_IN is the moment it becomes true, and
          // because it is set-once, arriving late costs nothing.
          const week = event === 'SIGNED_IN' ? isoWeek(session.user.created_at) : null;
          identifyUser(session.user.id, week);
        }
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

  // The other thing a link can be: an invite (atlas 39). Sits alongside the
  // auth listener rather than inside it because the two want opposite things
  // from a session — the magic link CREATES one, the invite needs one to
  // already exist. Signed in, this deep-links straight to IV-06; signed out,
  // it parks the handle for the handoff to spend.
  useInviteDeepLink(Boolean(session.userId));

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
  // The reader's IANA zone, written on every launch with a session. The morning
  // edit and the event reminder fire on THEIR clock, and the server has no
  // other way to know it. See features/push/time-zone.ts — deliberately not
  // gated on push existing, so the first notification after a store build has
  // a schedule to fire on.
  useReportTimeZone();

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
        UX-08's shared toast, mounted once at the root so `useToast()` reaches it
        from any depth without a screen holding toast state. Outside the query
        provider deliberately: it is chrome, it has no data of its own, and a
        confirmation must not be torn down by a cache purge on sign-out.

        Directly inside GestureHandlerRootView because the toast positions
        absolutely and this is the view that fills the window. It cannot rise
        above a NATIVE sheet presentation — see the note in toast-host.tsx; a
        sheet-local confirmation still renders its own <Toast>.
      */}
      <ToastHost>
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
          set of values. The `dark:` halves in tailwind.config.js held the same
          hexes as the light ones and were removed by audit item 51; the
          variant could never match anyway. Branching on the system scheme
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
            {/*
              Inside the query provider, because it reads `usePlan` and
              `useCapacity` — see the file for why this is a component rather
              than a call inside `useAnalyticsIdentity` above.
            */}
            <AnalyticsProperties />
            <UpdateCoordinator />
            <Superwall>
              <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                {/* The Add Clothes chooser (AC-01) — the door before the
                    doors. A modal, matching capture: it is the same
                    interruption, and a door that arrives differently from the
                    room behind it reads as a different kind of thing. */}
                <Stack.Screen
                  name="add-clothes"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="capture"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="review"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                {/* The Walkthrough — the second door into a closet, beside The
                    Ten. A directory rather than an `(intake)` group because a
                    group is invisible in the path, so `(intake)/review` would
                    resolve to `/review` and collide with the photo-verification
                    queue registered directly above. `/walkthrough/review` is
                    the same grouping with a path that cannot collide.

                    Full-screen: V-02 empties the screen out and a recording
                    must not have a back chevron sitting over it. */}
                <Stack.Screen
                  name="walkthrough/index"
                  options={{ presentation: 'fullScreenModal', headerShown: false }}
                />
                <Stack.Screen
                  name="walkthrough/review"
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
                {/* Settings (UX-05) — the administration half of what used to
                    be one Profile screen, pushed from the gear in Profile's
                    header. Same options as Privacy, Help, Notifications and
                    Diary, and for the identical reason: it is reached from
                    inside the Profile sheet, and a plain push would stack a
                    card on top of one.

                    A pushed route deliberately, not a fifth tab and not a
                    route group. Settings are somewhere you go once and leave.
                    Everything Settings itself pushes to (`/membership`,
                    `/privacy`, `/friends`, `/borrow`, `/notifications`,
                    `/help`) is already registered or already inherits, so the
                    split adds exactly one screen to this stack. */}
                <Stack.Screen
                  name="settings"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                {/* Recreate a look — reached through the stylist's door, so it
                    presents in the sheet dialect for the stacking reason every
                    sheet-reached route shares: a plain push would slide a card
                    over the stylist sheet. Full height; the flow is an upload,
                    a wait, and a list, and none of those want a half sheet. */}
                <Stack.Screen
                  name="recreate"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                {/* The lifestyle questionnaire — reached from Settings ("What
                    you dress for") and pushed once, ever, over the tabs at
                    onboarding. A sheet in the settings dialect both times:
                    from Settings because a plain push would stack a card on a
                    sheet, and at onboarding because a form you fill and
                    dismiss is exactly what the formSheet grammar means here.
                    Full height — the occasions grid is tall, and a half sheet
                    would open already scrolled. */}
                <Stack.Screen
                  name="style-profile"
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
                {/* Help (atlas 40), Privacy's sibling in every sense: reached
                    from the same Profile card, and a plain push would stack a
                    card on top of a sheet.

                    Only `help` is registered. `help/[id]` and `help/write` are
                    pushed FROM here and inherit this presentation, which is
                    what keeps an article and the composer inside the same
                    object rather than sliding a second one over it — the same
                    arrangement `privacy/ai|export|delete` and `diary/[id]`
                    already use. */}
                <Stack.Screen
                  name="help"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                {/* Notifications is Privacy's sibling: both are reached from
                    Profile, which is itself a sheet, and a plain push would
                    stack a card on top of one. Same options deliberately —
                    they are the same kind of detour and should feel like it.

                    Registered unconditionally. The route is unreachable on a
                    binary without push because Profile does not draw the row
                    (NOTIFICATION_SETTINGS_AVAILABLE), and a Stack.Screen for a
                    route nobody navigates to costs nothing. */}
                <Stack.Screen
                  name="notifications"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                {/* The wear diary, in the same dialect and for the same reason
                    — it is reached from Profile, and a card pushed from inside
                    a sheet stacks a page on top of a sheet. `diary/[id]` is
                    pushed from the diary and inherits this presentation, which
                    is what keeps the entry inside the same object rather than
                    escaping it. */}
                <Stack.Screen
                  name="diary"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                {/* UX-04 — people search, lifted off Explore's masthead into
                    its own sheet. Same dialect as the others: a task you
                    complete and dismiss, not a place you go.

                    Full height with no partial detent, unlike the stylist: the
                    field autofocuses, so the keyboard is up on arrival and a
                    0.75 detent would put the results behind it. */}
                <Stack.Screen
                  name="people-search"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                {/* Saved looks (OS-01 … OS-10) — the private shelf, pushed as
                    ordinary cards.

                    NOT a tab, and not `/saved`. The handoff puts this at the
                    root of a fourth tab called Saved; this app's four are
                    Today / Closet / Plan / Explore, and `/saved` is already the
                    kept-plate lookbook that ships against atlas 35. Two accepted
                    atlases want the same word, which is a product decision about
                    what "Saved" means rather than an implementation detail — so
                    this takes an unambiguous path and leaves the decision where
                    it belongs. Every segment below is otherwise the handoff's §1.

                    `saved-looks/index` and `saved-looks/[saveId]` inherit the
                    stack's default card presentation and need no entry — this
                    registers only the two that deviate.

                    The two collection editors are form sheets in the same
                    dialect as `profile` and `people-search`: a form you fill and
                    dismiss, not a place you go. Full height with no partial
                    detent because both autofocus a field, so the keyboard is up
                    on arrival and a 0.75 detent would put the helper text and
                    the Save button behind it — which is exactly what §9 asks not
                    to happen ("Cancel/Save stay reachable"). */}
                <Stack.Screen
                  name="saved-looks/collections/new"
                  options={{
                    presentation: 'formSheet',
                    sheetAllowedDetents: [1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 38,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="saved-looks/collections/[collectionId]"
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
      </ToastHost>
    </GestureHandlerRootView>
  );
}
