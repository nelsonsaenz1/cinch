import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atlas, MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/components/auth/chrome';
import { RunDots } from '@/components/auth/run-parts';
import {
  HEADLINE_SIZE,
  PAD,
  SUBLINE_SIZE,
  beatMs,
  handoffHeadline,
  handoffSubline,
} from '@/features/auth/auth-run-spec';
import { takePendingInvite } from '@/features/invite/pending-invite';
import { useTourGate } from '@/features/onboarding/tour-queries';
import { shouldShowTour } from '@/features/onboarding/tour-state';
import { leading } from '@/theme/font-metrics';
import { supabase } from '@/lib/supabase';

const HEADLINE_LEADING = leading('instrument', HEADLINE_SIZE, 1.12);

/**
 * Redesign 19 — the arrival. Session written, then a held beat before the app.
 *
 * ── WHAT MOVED ──────────────────────────────────────────────────────────────
 *
 * The blurred sweater, the Skia gradient over it, and the thin filling rule are
 * gone; the screen is one flat oxblood field with the greeting on it. The photo
 * was doing the work of saying "this is a clothes app" at the one moment the
 * user has no clothes in it yet — a stock garment nobody owns, dimmed to 14%
 * legibility under two scrims. The colour says the same thing louder, costs no
 * decode, and removes the last Skia canvas from the auth run.
 *
 * The greeting changed with it: a brand-new account is welcomed rather than
 * told the time of day. `greetingForHour` is untouched and still serves Today,
 * where a time-of-day line is a fact worth having.
 *
 * ── WHAT DID NOT ────────────────────────────────────────────────────────────
 *
 * Every routing decision. The name resolution and its redirect to step three,
 * the two reads that gate the beat, the invite-outranks-tour ordering, the
 * `take`-once invite handle, and the deliberate refusal to write `toured_at`
 * are all exactly as they shipped — this is the single funnel every sign-in
 * path ends at, including Apple's, and none of it is presentation.
 */
export default function HandoffScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ isNew?: string; name?: string }>();
  const isNew = params.isNew === '1';

  // The name usually rides in on the route params. When it does not — the root
  // gate routed here on the session write, an Apple sign-in whose metadata is
  // still settling — ask the session once. A signed-in account with NO name at
  // all is a new email account the flow hasn't finished: it belongs on the name
  // screen, not here, so it is sent there instead of being greeted namelessly.
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

  useEffect(() => {
    // Two reads gate the beat, not one. The greeting has always held it; the
    // tour gate joins it because `shouldShowTour` answers false while the read
    // is still in flight — correctly, since it cannot know — and a timer that
    // fired first would send a brand-new account straight past the tour it is
    // only ever offered once.
    if (!resolved || tourGate.status === 'loading') return;
    const id = setTimeout(() => {
      // An invite outranks the tour, which is the order atlas 39 states: IV-06
      // is "shown after sign-in and before the tour". Someone who arrived
      // through a friend's link is owed the fact that the friendship is already
      // made before they are offered a walkthrough of a closet they have not
      // filled yet.
      //
      // `take` clears the slot, so the handle is spent exactly once — a second
      // sign-in on this phone does not replay somebody else's invite.
      // `toured_at` is deliberately NOT written here: the tour is still owed
      // and will be offered at the next sign-in, because skipping it is a
      // consequence of the ordering rather than a decision to withhold it.
      const invite = takePendingInvite();
      if (invite) {
        router.replace({ pathname: '/invite-arrival', params: { handle: invite } });
        return;
      }
      router.replace(shouldShowTour(tourGate) ? '/tour' : '/(tabs)');
    }, beatMs(isNew, reduced));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, tourGate.status]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: atlas.oxblood,
        paddingTop: insets.top,
        paddingHorizontal: PAD,
        justifyContent: 'center',
      }}>
      <StatusBar style="light" />
      <View
        accessibilityLiveRegion="polite"
        style={{
          // Until the greeting resolves this frame may yet redirect to the name
          // screen — hold the ground, don't flash a nameless line.
          opacity: resolved ? 1 : 0,
        }}>
        <RNText
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: HEADLINE_SIZE,
            lineHeight: HEADLINE_LEADING,
            color: atlas.cream,
          }}>
          {handoffHeadline(isNew, name)}
        </RNText>
        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            marginTop: 12,
            fontFamily: 'HelveticaNeue',
            fontSize: SUBLINE_SIZE,
            lineHeight: 24,
            color: 'rgba(243,240,233,0.72)',
          }}>
          {handoffSubline(isNew)}
        </RNText>
        {/* The rule that filled left-to-right is now the run's own three dots,
            so the last screen of the flow marks time in the same vocabulary the
            first three did. Under Reduce Motion they simply rest. */}
        <View style={{ marginTop: 22 }}>
          <RunDots onFill />
        </View>
      </View>
    </View>
  );
}
