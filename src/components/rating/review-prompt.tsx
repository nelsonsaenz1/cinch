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
  markDone,
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
// must not multiply sessions.
let sessionNumber: number | null = null;
let shownThisSession = false;

export function ReviewPrompt() {
  const theme = useTheme();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  if (sessionNumber === null) sessionNumber = recordSession(io);

  const eligible = !shownThisSession && promptEligible(sessionNumber, io);

  // The two settle-in clocks: page moves, counted whenever the path changes
  // while the ask is still owed, and a dwell timer armed once on mount.
  const moves = useRef(0);
  const lastPath = useRef(pathname);
  const dwellElapsed = useRef(false);
  const [, forceCheck] = useState(0);

  useEffect(() => {
    if (!eligible) return;
    const t = setTimeout(() => {
      dwellElapsed.current = true;
      forceCheck((n) => n + 1);
    }, 30_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pathname !== lastPath.current) {
    lastPath.current = pathname;
    moves.current += 1;
  }

  const due = eligible && settledIn(dwellElapsed.current ? 30_000 : 0, moves.current);

  useEffect(() => {
    if (!due || visible || shownThisSession) return;
    // Only over a tab root — if the reader is mid-flow, wait for the next
    // path change or render to land somewhere calm.
    if (!TAB_PATHS.has(pathname)) return;
    shownThisSession = true;
    setVisible(true);
    track('review_prompt_shown');
  }, [due, visible, pathname]);

  const close = () => setVisible(false);

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={later}>
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
