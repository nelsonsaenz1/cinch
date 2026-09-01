import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Storage from 'expo-sqlite/kv-store';
import { SymbolView } from 'expo-symbols';
import { usePathname } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  WRITE_REVIEW_URL,
  blockedByOtherSurface,
  markDone,
  markTouchpoint,
  promptEligible,
  recordSession,
  settledIn,
  type ReviewPromptIo,
} from '@/features/rating/review-prompt-core';
import { track } from '@/lib/posthog';
import { useTheme } from '@/theme/tokens';

/**
 * The recurring review ask (founder directive 2026-08-28) — Cinch's own card,
 * in Cinch's own dress, that hands the reader to the App Store's write-review
 * page. The decision logic lives in `review-prompt-core.ts` and is node-
 * tested; this file is the mount, the triggers, and the sheet.
 *
 * WHY THE CARD IS CINCH-DRESSED AND NOT SYSTEM-DRESSED. The real Apple rating
 * card (`requestReview`) displays at most three times a year, on the OS's
 * schedule, and cannot carry this cadence. A hand-drawn imitation of it is a
 * Guideline violation (mimicking system UI) and reads as counterfeit the
 * moment it differs. So the ask is honestly ours; the *rating* is honestly
 * Apple's — the button opens the store's own composer, stars and text field
 * both.
 *
 * WHERE IT MAY APPEAR. Only over the five tab roots. Never over onboarding,
 * capture, a paywall, or any pushed flow — an ask that interrupts a task
 * costs more goodwill than a rating is worth, and session 1 (the account's
 * own session) never sees it at all.
 *
 * NO BILLING OR SUPERWALL HOOKS, deliberately — this mounts beside
 * `AnalyticsProperties` in the root layout, and the 8/26 outage is the
 * standing reason a root-layout component keeps its imports boring.
 */

// '/stylist' is deliberately absent since 2026-08-31: the stylist ROOT is
// the conversation itself, and the founder's screenshot showed this card
// landing on top of a live reply — exactly the ask-over-a-task the docblock
// above forbids. Four surfaces remain, which is plenty of cadence.
const TAB_PATHS = new Set(['/', '/closet', '/plan', '/explore']);

const io: ReviewPromptIo = {
  read(key) {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      Storage.setItemSync(key, value);
    } catch {
      // A failed write only means one extra ask some later session.
    }
  },
};

// Once per LAUNCH, not per mount — fast refresh and a remounting root layout
// must not multiply sessions. The cache lives in a module function so the
// component only ever CALLS it; the React Compiler forbids a render mutating
// module state directly, and it is right to — this way the write happens in
// exactly one place with one guard.
let sessionNumberCache: number | null = null;
function sessionThisLaunch(): number {
  if (sessionNumberCache === null) sessionNumberCache = recordSession(io);
  return sessionNumberCache;
}

export function ReviewPrompt() {
  const theme = useTheme();
  const pathname = usePathname();
  const [sessionNumber] = useState(sessionThisLaunch);
  /**
   * waiting → showing → spent, once per mount — and this component mounts
   * once, in the root layout, so per mount IS per session. The transition
   * into `showing` happens as an adjust-during-render (the same pattern
   * use-reveal-sequence documents); the analytics event fires from the
   * Modal's own `onShow`, which is the first honest moment the card exists.
   */
  const [stage, setStage] = useState<'waiting' | 'showing' | 'spent'>('waiting');

  const eligible = stage === 'waiting' && promptEligible(sessionNumber, io);

  // The two settle-in clocks — both as STATE, because both are read during
  // render to decide `due`: page moves, counted when the path changes, and a
  // dwell timer armed once on mount.
  const [moves, setMoves] = useState(0);
  const [dwelled, setDwelled] = useState(false);
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== lastPath.current) {
      lastPath.current = pathname;
      setMoves((n) => n + 1);
    }
  }, [pathname]);

  useEffect(() => {
    const t = setTimeout(() => setDwelled(true), 30_000);
    return () => clearTimeout(t);
  }, []);

  const due = eligible && settledIn(dwelled ? 30_000 : 0, moves);

  // Only over a tab root — if the reader is mid-flow, the next path change
  // lands somewhere calm and this adjusts then. Also deferred (Issue 6,
  // 2026-08-31) if the settled-wear native ask or the post-share native ask
  // fired inside the shared touchpoint window — this is the exact collision
  // that let the card and the system sheet appear together. A deferral is
  // not a spend: the card is still due next session, unchanged.
  if (stage === 'waiting' && due && TAB_PATHS.has(pathname) && !blockedByOtherSurface(new Date(), io)) {
    markTouchpoint(new Date(), io);
    setStage('showing');
  }

  const visible = stage === 'showing';
  const close = () => setStage('spent');

  const rate = () => {
    markDone(io);
    track('review_prompt_action', { action: 'rate' });
    close();
    void Linking.openURL(WRITE_REVIEW_URL);
  };

  const already = () => {
    markDone(io);
    track('review_prompt_action', { action: 'already' });
    close();
  };

  const later = () => {
    track('review_prompt_action', { action: 'later' });
    close();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={later}
      onShow={() => track('review_prompt_shown')}>
      {/* The scrim dismisses — this ask must never trap anyone. */}
      <Pressable
        className="flex-1 justify-end bg-black/40"
        onPress={later}
        accessibilityLabel="Dismiss"
        accessibilityRole="button">
        <Pressable onPress={() => undefined} accessibilityRole="none">
          {/* Founder note 8/29: the card breathes — generous top padding, a
              wide gap between the stars and the title, and air around every
              block, so the sheet reads as a moment rather than a toast. */}
          <SafeAreaView edges={['bottom']} className="rounded-t-3xl bg-canvas px-gutter pb-8 pt-12">
            <View className="flex-row justify-center gap-2" accessibilityElementsHidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <SymbolView key={i} name="star.fill" size={24} tintColor={theme.accent} />
              ))}
            </View>
            <Text variant="title" trim className="mt-10 text-center">
              Enjoying Cinch?
            </Text>
            <Text variant="body" className="mt-6 text-center" style={{ color: theme.muted }}>
              Ratings are how small apps get found. Twenty seconds — stars count, a
              sentence counts double.
            </Text>
            <Button
              title="Rate Cinch"
              variant="primary"
              className="mt-10 self-stretch"
              onPress={rate}
              accessibilityHint="Opens the App Store review page"
            />
            <View className="mt-3 flex-row">
              <Button title="I already have" variant="ghost" className="flex-1" onPress={already} />
              <Button title="Not now" variant="ghost" className="flex-1" onPress={later} />
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
