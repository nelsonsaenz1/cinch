import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text as RNText, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atlas, MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/components/auth/chrome';
import { beatMs } from '@/features/auth/auth-run-spec';
import { greetingForHour } from '@/features/auth/greeting';
import { takePendingInvite } from '@/features/invite/pending-invite';
import { useTourGate } from '@/features/onboarding/tour-queries';
import { shouldShowTour } from '@/features/onboarding/tour-state';
import { supabase } from '@/lib/supabase';

const HANDOFF_PHOTO = require('../../../assets/garments/cream-mohair-sweater.jpg');

/**
 * W-14 — session written, then a held beat before the app.
 *
 * ── REVERTED 2026-08-18, BY FOUNDER ORDER ───────────────────────────────────
 *
 * Redesign 19 (7ac4ed2, deviation #5) flattened this screen to a plain oxblood
 * field with "Welcome to Cinch" / "Welcome back" on it, dropping the blurred
 * sweater, the Skia scrim over it and the hour greeting. The founder wants the
 * arrival back the way it was, so the VISUAL beat below is restored verbatim
 * from 7ac4ed2^: the photograph, the two-stop gradient, `greetingForHour`, the
 * ninety-seconds subline and the thin rule that fills left to right.
 *
 * ── WHAT THE REVERT DELIBERATELY DID NOT TAKE BACK ──────────────────────────
 *
 * Every decision later commits made about where this screen SENDS people, and
 * how long it holds them, is kept as it stands today:
 *
 *   - the name resolution and its redirect to the name screen (W-13),
 *   - the two reads that gate the beat — greeting AND tour — so a brand-new
 *     account is never timed past the tour it is only ever offered once,
 *   - invite-outranks-tour, and the `take`-once invite handle,
 *   - the refusal to write `toured_at` here.
 *
 * The held durations are still read from `beatMs` in `auth-run-spec` rather
 * than re-declared locally as they were at 7ac4ed2^. The numbers are identical
 * (1900 / 1400 / 900) — redesign 19 only MOVED them — and `tests/auth-run-
 * layout.test.ts` pins them there, so a local copy would be a second source of
 * truth for a value that is already under guard.
 *
 * Skia returns with the photograph. It is not a new native module: the welcome
 * screen (`sign-in.tsx`) and `components/event-outfits/OutfitPostCard.tsx`
 * both draw with it today, so it is already in the binary and this file stays
 * OTA-shippable. See the argued exemption in `tests/auth-run-layout.test.ts`.
 */
export default function HandoffScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ isNew?: string; name?: string }>();
  const isNew = params.isNew === '1';

  // The name usually rides in on the route params. When it does not — the
  // root gate routed here on the session write, an Apple sign-in whose
  // metadata is still settling — ask the session once. A signed-in account
  // with NO name at all is a new email account the flow hasn't finished: it
  // belongs on the name screen (W-13), not here, so it is sent there instead
  // of being greeted namelessly. The beat below waits for this to resolve.
  const [name, setName] = useState<string | null>(params.name?.trim() || null);
  const [resolved, setResolved] = useState(Boolean(params.name?.trim()));

  // Read alongside the greeting, not after it. This is the single funnel every
  // sign-in path ends at — email, returning, Apple, and the root gate's own
  // catch-all — which is what makes it the one place the tour can be offered
  // "once, ever" without a profile read in front of every cold start.
  const tourGate = useTourGate();
  useEffect(() => {
    if (resolved) return;
    let cancelled = false;
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        const md = (data.user?.user_metadata ?? {}) as {
          given_name?: string | null;
          full_name?: string | null;
        };
        const found = md.given_name ?? md.full_name?.trim().split(/\s+/)[0] ?? null;
        if (found) {
          setName(found);
          setResolved(true);
        } else {
          router.replace('/(auth)/name');
        }
      })
      .catch(() => {
        // Can't read the user — greet namelessly rather than strand the flow.
        if (!cancelled) setResolved(true);
      });
    return () => {
      cancelled = true;
    };
    // Once, on mount — the greeting must not re-render mid-beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The progress sweep: #E2B79C filling left to right, then the app. Under
  // Reduce Motion the bar is simply full and the beat shorter — no sweep.
  // Armed only once the greeting is resolved, so a redirect to the name
  // screen never races the timer.
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    // Two reads gate the beat, not one. The greeting has always held it; the
    // tour gate joins it because `shouldShowTour` answers false while the read
    // is still in flight — correctly, since it cannot know — and a timer that
    // fires first would send a brand-new account straight past the tour it is
    // only ever offered once. The two reads run in parallel, so waiting for
    // both costs nothing in practice.
    if (!resolved || tourGate.status === 'loading') return;
    const beat = beatMs(isNew, reduced);
    if (!reduced) progress.value = withTiming(1, { duration: beat - 150 });
    const id = setTimeout(() => {
      // An invite outranks the tour, which is the order atlas 39 states:
      // IV-06 is "shown after sign-in and before the tour". Someone who
      // arrived through a friend's link is owed the fact that the friendship
      // is already made before they are offered a walkthrough of a closet
      // they have not filled yet.
      //
      // `take` clears the slot, so the handle is spent exactly once — a
      // second sign-in on this phone does not replay somebody else's invite.
      // `toured_at` is deliberately NOT written here: the tour is still owed
      // and will be offered at the next sign-in, because skipping it is a
      // consequence of the ordering rather than a decision to withhold it.
      const invite = takePendingInvite();
      if (invite) {
        router.replace({ pathname: '/invite-arrival', params: { handle: invite } });
        return;
      }
      router.replace(shouldShowTour(tourGate) ? '/tour' : '/(tabs)');
    }, beat);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, tourGate.status]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const greeting = greetingForHour(new Date().getHours());
  const headline = isNew ? greeting : 'Welcome back';

  return (
    <View style={{ flex: 1, backgroundColor: atlas.coverBase }}>
      <StatusBar style="light" />
      <Image
        source={HANDOFF_PHOTO}
        contentFit="cover"
        transition={0}
        blurRadius={14}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ scale: 1.1 }],
        }}
        accessibilityIgnoresInvertColors
      />
      <Canvas pointerEvents="none" style={{ position: 'absolute', width, height }}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={['rgba(23,18,14,0.80)', 'rgba(23,18,14,0.86)']}
          />
        </Rect>
      </Canvas>

      <View
        accessibilityLiveRegion="polite"
        style={{
          position: 'absolute',
          left: 34,
          right: 34,
          top: insets.top + 96,
          // Until the greeting resolves this frame may yet redirect to the
          // name screen — hold the dark ground, don't flash a nameless line.
          opacity: resolved ? 1 : 0,
        }}>
        <RNText
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: 34,
            lineHeight: 34 * 1.12,
            color: atlas.cream,
          }}>
          {headline}
          {name ? (
            <>
              ,{' '}
              <RNText
                style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: atlas.warm }}>
                {name}
              </RNText>
            </>
          ) : null}
          .
        </RNText>
        {isNew ? (
          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              marginTop: 10,
              fontFamily: 'HelveticaNeue',
              fontSize: 14,
              lineHeight: 21.5,
              color: 'rgba(243,240,233,0.6)',
            }}>
            Your closet is empty for about ninety more seconds.
          </RNText>
        ) : null}
        <View
          style={{
            marginTop: 24,
            height: 2,
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: 'rgba(243,240,233,0.18)',
          }}>
          <Animated.View style={[{ height: '100%', backgroundColor: atlas.warm }, fillStyle]} />
        </View>
      </View>
    </View>
  );
}
