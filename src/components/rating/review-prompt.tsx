import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { usePathname } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { subscribeReviewMoments } from '@/features/rating/review-moments';
import {
  DWELL_MS,
  WRITE_REVIEW_URL,
  consumeMoment,
  markDone,
  markTouchpoint,
  promptEligible,
  reviewCardDue,
  type ReviewMoment,
} from '@/features/rating/review-prompt-core';
import { reviewPromptIo as io } from '@/features/rating/review-prompt-io';
import { track } from '@/lib/posthog';
import { useTheme } from '@/theme/tokens';

/**
 * The review ask — Cinch's own card, in Cinch's own dress, that hands the
 * reader to the App Store's write-review page. The decision logic lives in
 * `review-prompt-core.ts` and is node-tested; this file is the mount, the
 * clocks, and the sheet.
 *
 * WHEN IT APPEARS (ledger A50, 2026-09-06). At a MOMENT and not on a timer:
 * the tenth garment landing, or the Reveal completing — the two beats where
 * Cinch has just visibly done the thing it was installed for. Each arms the
 * card once, ever; the card then draws on the next tab root after a short
 * settle, and never over a paywall (the gate stamps its sheets; the core
 * reads them). See the core's docblock for the whole rule and why the
 * per-session timer it replaces was retired.
 *
 * WHY THE CARD IS CINCH-DRESSED AND NOT SYSTEM-DRESSED. The real Apple rating
 * card (`requestReview`) displays at most three times a year, on the OS's
 * schedule, and cannot be aimed at a moment. A hand-drawn imitation of it is
 * a Guideline violation (mimicking system UI) and reads as counterfeit the
 * moment it differs. So the ask is honestly ours; the *rating* is honestly
 * Apple's — the button opens the store's own composer, stars and text field
 * both.
 *
 * WHERE IT MAY APPEAR. Only over the five tab roots. Never over onboarding,
 * capture, a paywall, or any pushed flow — an ask that interrupts a task
 * costs more goodwill than a rating is worth.
 *
 * NO BILLING OR SUPERWALL HOOKS, deliberately — this mounts beside
 * `AnalyticsProperties` in the root layout, and the 8/26 outage is the
 * standing reason a root-layout component keeps its imports boring. The
 * paywall stamps it reads are plain kv rows the gate writes; nothing here
 * imports the SDK.
 */

// '/stylist' is deliberately absent since 2026-08-31: the stylist ROOT is
// the conversation itself, and the founder's screenshot showed this card
// landing on top of a live reply — exactly the ask-over-a-task the docblock
// above forbids. Four surfaces remain, which is plenty of cadence.
const TAB_PATHS = new Set(['/', '/closet', '/plan', '/explore']);

/** While a sheet is in the way, how often the card looks again. */
const RECHECK_MS = 2_000;
/** …and for how long per arrival on a tab root, before it gives up until the next one. */
const MAX_RECHECKS = 30;

export function ReviewPrompt() {
  const theme = useTheme();
  const pathname = usePathname();
  /**
   * waiting → showing → waiting. Not a per-mount one-shot any more: the
   * Reveal's moment can arrive a minute after the Ten's in one launch, and
   * a card that had spent itself on the first would miss the better beat.
   * The transition into `showing` happens as an adjust-during-render (the
   * same pattern use-reveal-sequence documents); the analytics event fires
   * from the Modal's own `onShow`, which is the first honest moment the card
   * exists.
   */
  const [stage, setStage] = useState<'waiting' | 'showing'>('waiting');
  const [moment, setMoment] = useState<ReviewMoment | null>(null);

  // The settle clock, per arrival on a path, and a tick that re-runs the
  // verdict when the clock lands, when a sheet that was in the way closes,
  // and when a moment is recorded under the card's feet. Everything that
  // reads the clock runs in effects — render stays pure.
  const arrivedAt = useRef<number | null>(null);
  const rechecks = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeReviewMoments(() => setTick((n) => n + 1)), []);

  // Declared before the verdict effect below, so on a route change the
  // clock resets first and the verdict — which also depends on `pathname` —
  // reads the new arrival in the same commit.
  useEffect(() => {
    arrivedAt.current = Date.now();
    rechecks.current = 0;
  }, [pathname]);

  // The verdict, from one place (`reviewCardDue`). Every "no" is a wait,
  // never a spend: while the settle is still running or a sheet is in the
  // way, the card looks again a little later, bounded per arrival.
  useEffect(() => {
    if (stage !== 'waiting' || arrivedAt.current === null) return;
    const now = new Date();
    const dwelledMs = now.getTime() - arrivedAt.current;
    const onTabRoot = TAB_PATHS.has(pathname);
    const due = reviewCardDue({ now, onTabRoot, dwelledMs, io });
    if (due) {
      markTouchpoint(now, io);
      setMoment(due);
      setStage('showing');
      return;
    }
    if (!onTabRoot || !promptEligible(io)) return;
    let delay: number | null = null;
    if (dwelledMs < DWELL_MS) delay = DWELL_MS - dwelledMs;
    else if (rechecks.current < MAX_RECHECKS) {
      rechecks.current += 1;
      delay = RECHECK_MS;
    }
    if (delay === null) return;
    const t = setTimeout(() => setTick((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [stage, pathname, tick]);

  const visible = stage === 'showing';
  const close = () => setStage('waiting');
  const shownMoment = moment ?? 'ten';

  const rate = () => {
    markDone(io);
    track('review_prompt_action', { action: 'rate', moment: shownMoment });
    close();
    void Linking.openURL(WRITE_REVIEW_URL);
  };

  const already = () => {
    markDone(io);
    track('review_prompt_action', { action: 'already', moment: shownMoment });
    close();
  };

  const later = () => {
    consumeMoment(io);
    track('review_prompt_action', { action: 'later', moment: shownMoment });
    close();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={later}
      onShow={() => track('review_prompt_shown', { moment: shownMoment })}>
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
