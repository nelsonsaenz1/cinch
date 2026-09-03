import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import {
  UPSELL_COPY,
  claimUpsellBubble,
  upsellBubbleFor,
  type UpsellBubbleView,
} from '@/features/billing/upsell-bubble';
import type { Plan } from '@/features/billing/plans';
import { haptics } from '@/lib/haptics';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

/**
 * The membership row Today closes the day's set with, for an account that is
 * not paying.
 *
 * WHAT IT SAYS AND WHO SEES IT IS NOT HERE. `features/billing/upsell-bubble.ts`
 * owns both, as pure functions over the plan state, for the same reason
 * `capacity-note-copy.ts` owns the capacity note's sentence: an honesty rule
 * that lives inside a component is an honesty rule nothing can test. This file
 * is the drawing and the once-per-open latch, and nothing else.
 *
 * ── IT WAS A FLOATING CARD, AND AUDIT 2026-09-02 TOOK THAT AWAY ────────────
 *
 * Findings 2, 5 and 7. This used to be an absolutely-positioned blush card
 * pinned 96pt off the bottom of the screen: a blush ground, an eyebrow, a serif
 * headline, four lines of plan arithmetic, a filled oxblood CTA and a second
 * "Not now" control under it — the largest and loudest object on Today, arriving
 * over the outfit before anybody had decided what to wear. "Commercial UI
 * arrives before product trust is earned"; "the first viewport has four
 * simultaneous asks"; "move it after the full daily set or reduce it to a quiet
 * inline row." It is now both.
 *
 * So: NO absolute position, no overlay, no blush. It is a tray row in the
 * scroll flow, mounted by the route AFTER all three plates, their actions and
 * the compose escape hatch — see the call site in `app/(tabs)/index.tsx`. The
 * `pointerEvents="box-none"` that used to keep the page alive underneath it is
 * gone because there is no longer anything on top of the page: a row that
 * occupies its own space cannot swallow a swipe.
 *
 * ── ONE ROW, ONE ACTION, ONE WAY OUT ──────────────────────────────────────
 *
 * The whole row is the door — headline, one-line consequence, chevron — and the
 * only other control is the dismiss disc, which is a way out rather than a
 * second ask. The filled oxblood pill is gone with the card: an accent button
 * at the foot of the day's set would still be the loudest thing under the
 * outfit, and the row already says where it goes.
 *
 * `CapacityNote` remains the only other membership-adjacent block on this
 * screen and is also tray, so the screen still spends no blush and no accent on
 * anything commercial.
 */
export function TodayUpsell({
  plan,
  trialing,
  trialEndsAt,
  /**
   * False while `usePlan` is still reading and after a failed read. The row
   * refuses to speak about a plan it has not seen; see the module docblock in
   * `upsell-bubble.ts` for why "assume free" is wrong for a sentence.
   */
  ready,
  onSeePlans,
}: {
  plan: Plan;
  trialing: boolean;
  trialEndsAt: Date | null;
  ready: boolean;
  onSeePlans: () => void;
}) {
  /**
   * THE GATE IS A SEPARATE COMPONENT ON PURPOSE, and it is the whole reason
   * this file has two.
   *
   * The row has to decide what it says exactly ONCE — at the moment it mounts,
   * from the clock as it is then — and hold that. Deciding again on a later
   * render would mean calling `new Date()` in a render path, which is the impure
   * call `usePlan` documents the React Compiler rejecting; deciding in an effect
   * would mean `setState` inside one, which cascades a render for a value that
   * was known before the first paint. The remaining honest shape is a lazy
   * `useState` initialiser, and that only works if the component is not mounted
   * until the plan is readable. So this half is the gate, and it holds no state
   * at all.
   */
  if (!ready) return null;

  return (
    <UpsellRow
      plan={plan}
      trialing={trialing}
      trialEndsAt={trialEndsAt}
      onSeePlans={onSeePlans}
    />
  );
}

function UpsellRow({
  plan,
  trialing,
  trialEndsAt,
  onSeePlans,
}: {
  plan: Plan;
  trialing: boolean;
  trialEndsAt: Date | null;
  onSeePlans: () => void;
}) {
  const theme = useTheme();

  /**
   * Decided once, on mount, and frozen — including the claim on the session's
   * single slot.
   *
   * The initialiser runs exactly one time, which is what makes the impure reads
   * inside it safe: the clock is sampled at the moment the row appears, and a
   * day count cannot tick over under a reader who is halfway through the
   * sentence containing it.
   *
   * `null` covers both "nothing to say to this account" and "the slot was
   * already spent this session", and the row draws nothing either way.
   */
  const [view] = useState<UpsellBubbleView | null>(() => {
    const next = upsellBubbleFor({ plan, trialing, trialEndsAt, unknown: false, now: new Date() });
    return next && claimUpsellBubble() ? next : null;
  });
  const [dismissed, setDismissed] = useState(false);

  // A purchase that lands while the row is still up. Derived rather than
  // stored: an account that stopped being free has stopped being the audience,
  // and leaving an upgrade offer over a receipt is the one state this must not
  // reach.
  const paying = plan !== 'free' && !trialing;

  if (!view || dismissed || paying) return null;

  const close = () => {
    haptics.selection();
    setDismissed(true);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(motion.duration.base).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
      // Inline, not a className: NativeWind's interop is registered for the
      // RN primitives only, so a class on a Reanimated component is dropped.
      style={{ marginHorizontal: 20, marginTop: 20 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {/* THE ROW IS THE ACTION. One target, spanning the sentence it is about
            — not a sentence with a button under it, which is two objects for
            one offer. */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={UPSELL_COPY.cta}
          accessibilityHint={view.headline}
          // The intent, not a strength — `PressableSurface` spends it from
          // `lib/haptics` itself, which is the one door onto expo-haptics.
          haptic="selection"
          onPress={onSeePlans}
          fill
          className="flex-1 rounded-md bg-tray"
          style={{ minHeight: MIN_TAP_TARGET }}
          contentStyle={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            {/* `label`, not `plate`: a serif display headline at the foot of the
                day's set would compete with the outfit names above it, which is
                the hierarchy finding 2 is about. */}
            <Text variant="label" style={{ color: theme.ink }}>
              {view.headline}
            </Text>
            <Text variant="note" style={{ color: theme.muted }}>
              {view.body}
            </Text>
          </View>
          <SymbolView
            name="chevron.right"
            size={12}
            tintColor={theme.muted}
            resizeMode="scaleAspectFit"
          />
        </PressableSurface>

        {/* 28 drawn, 44 tapped — the Remove disc's arrangement, and the
            same reason: a close control at the full target size would be
            the largest thing beside a row whose subject is a sentence. */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={UPSELL_COPY.close}
          onPress={close}
          hitSlop={(MIN_TAP_TARGET - 28) / 2}
          fill
          contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          className="rounded-full"
          style={{ width: 28, height: 28, flexShrink: 0, backgroundColor: theme.tray }}>
          <SymbolView name="xmark" size={11} tintColor={theme.muted} resizeMode="scaleAspectFit" />
        </PressableSurface>
      </View>
    </Animated.View>
  );
}
