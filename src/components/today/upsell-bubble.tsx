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

/** Where the card sits: over the page, or in its scroll flow. */
export type UpsellPlacement = 'floating' | 'inline';

/**
 * The membership bubble Today opens with, for an account that is not paying.
 *
 * WHAT IT SAYS AND WHO SEES IT IS NOT HERE. `features/billing/upsell-bubble.ts`
 * owns both, as pure functions over the plan state, for the same reason
 * `capacity-note-copy.ts` owns the capacity note's sentence: an honesty rule
 * that lives inside a component is an honesty rule nothing can test. This file
 * is the drawing and the once-per-open latch, and nothing else.
 *
 * ── IT FLOATS, AND IT DOES NOT TRAP ───────────────────────────────────────
 *
 * The card is an overlay so it can arrive over a page that is already composed
 * rather than pushing the morning's outfit down the screen. The consequence a
 * founder would notice is handled explicitly: the wrapper is `pointerEvents:
 * 'box-none'`, so every point of the screen OUTSIDE the card still reaches the
 * carousel underneath it. There is no scrim, no modal, and no
 * `accessibilityViewIsModal` — swiping to the second look with the bubble on
 * screen works, and a VoiceOver reader is not sealed inside four sentences.
 *
 * It sits above the tab bar's own 96 points (the same clearance the page's
 * `pb-24` content inset uses), which is what keeps the dismiss control off the
 * glass.
 *
 * ── AND AT THE ACCESSIBILITY SIZES IT STOPS FLOATING ──────────────────────
 *
 * Directive #35: "Today's membership card covers recommendations and the tab
 * bar." Both are true above `AX_FONT_SCALE` and neither is fixable by a taller
 * clearance. An eyebrow, a serif headline, a four-line note and two 44 pt
 * controls come to roughly a third of an iPhone SE at the standard sizes and
 * to most of one at the accessibility sizes; anchored 96 points off the bottom
 * it then sits squarely on the outfit it is talking about, and the native
 * Liquid Glass bar is itself taller there than the 96 this file assumed.
 *
 * So `placement="inline"` — the card in the scroll flow, directly under the
 * masthead, at whatever height it needs. It pushes the morning's outfit down
 * the page, which is exactly what the floating version exists to avoid; that
 * trade is only worth making where the alternative is covering the outfit
 * entirely, so the float is kept below the threshold and nothing about the
 * default composition moves. Inline, the card also cannot cover the tab bar,
 * because the page's own `pb-24` is now the thing keeping it clear.
 *
 * ── ONE OXBLOOD, AND THE DISMISS IS QUIET ─────────────────────────────────
 *
 * Blush card, serif headline, one filled accent CTA, and a second way out that
 * is a word rather than a competing button — the house grammar, and the same
 * shape `InviteRow` and the error actions on People Search draw. The X is the
 * third way out and the only glyph on the card; it carries a real label because
 * a shape is not a name.
 *
 * There is no `bg-tray` variant of this. The blush surface IS the frame's one
 * spend, and TD-00's rule that "one blush card per screen" holds because
 * `CapacityNote` — the only other candidate — is tray and draws on a different
 * closet size entirely.
 */
export function TodayUpsell({
  plan,
  trialing,
  trialEndsAt,
  /**
   * False while `usePlan` is still reading and after a failed read. The bubble
   * refuses to speak about a plan it has not seen; see the module docblock in
   * `upsell-bubble.ts` for why "assume free" is wrong for a sentence.
   */
  ready,
  onSeePlans,
  /**
   * `floating` is the overlay this card was designed as. `inline` drops the
   * absolute wrapper so the card can sit in a scroll's content flow — the
   * accessibility-size arrangement; see the docblock.
   */
  placement = 'floating',
}: {
  plan: Plan;
  trialing: boolean;
  trialEndsAt: Date | null;
  ready: boolean;
  onSeePlans: () => void;
  placement?: UpsellPlacement;
}) {
  /**
   * THE GATE IS A SEPARATE COMPONENT ON PURPOSE, and it is the whole reason
   * this file has two.
   *
   * The card has to decide what it says exactly ONCE — at the moment it mounts,
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
    <UpsellCard
      plan={plan}
      trialing={trialing}
      trialEndsAt={trialEndsAt}
      onSeePlans={onSeePlans}
      placement={placement}
    />
  );
}

function UpsellCard({
  plan,
  trialing,
  trialEndsAt,
  onSeePlans,
  placement,
}: {
  plan: Plan;
  trialing: boolean;
  trialEndsAt: Date | null;
  onSeePlans: () => void;
  placement: UpsellPlacement;
}) {
  const theme = useTheme();

  /**
   * Decided once, on mount, and frozen — including the claim on the session's
   * single slot.
   *
   * The initialiser runs exactly one time, which is what makes the impure reads
   * inside it safe: the clock is sampled at the moment the card appears, and a
   * day count cannot tick over under a reader who is halfway through the
   * sentence containing it.
   *
   * `null` covers both "nothing to say to this account" and "the slot was
   * already spent this session", and the card draws nothing either way.
   */
  const [view] = useState<UpsellBubbleView | null>(() => {
    const next = upsellBubbleFor({ plan, trialing, trialEndsAt, unknown: false, now: new Date() });
    return next && claimUpsellBubble() ? next : null;
  });
  const [dismissed, setDismissed] = useState(false);

  // A purchase that lands while the card is still up. Derived rather than
  // stored: an account that stopped being free has stopped being the audience,
  // and leaving an upgrade offer over a receipt is the one state this must not
  // reach.
  const paying = plan !== 'free' && !trialing;

  if (!view || dismissed || paying) return null;

  const close = () => {
    haptics.selection();
    setDismissed(true);
  };

  const floating = placement === 'floating';

  const card = (
      <Animated.View
        entering={FadeIn.duration(motion.duration.base).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
        // Inline, not a className: NativeWind's interop is registered for the
        // RN primitives only, so a class on a Reanimated component is dropped.
        // The 20 pt margin is the page gutter either way, so the card lines up
        // with the masthead above it in both placements.
        style={{ marginHorizontal: 20, marginTop: floating ? 0 : 16 }}>
        <View
          accessibilityRole="summary"
          className="rounded-lg"
          style={{
            backgroundColor: theme.blush,
            borderWidth: 1,
            borderColor: theme.blushRule,
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 16,
            gap: 10,
          }}>
          <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              {/* `eyebrow`'s own `muted`, not overridden. The warm tan reads as
                  the blush card's own colour and is 3.5:1 — below AA at 10px,
                  and `tests/constitution.test.ts` refuses it as text. The
                  tracking, the casing and the size are what make this an
                  eyebrow; the tint never was. */}
              <Text variant="eyebrow">{view.eyebrow}</Text>
              <Text accessibilityRole="header" variant="plate" trim>
                {view.headline}
              </Text>
            </View>

            {/* 28 drawn, 44 tapped — the Remove disc's arrangement, and the
                same reason: a close control at the full target size would be
                the largest thing on a card whose subject is a sentence. */}
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={UPSELL_COPY.close}
              onPress={close}
              hitSlop={(MIN_TAP_TARGET - 28) / 2}
              fill
              contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              className="rounded-full"
              style={{ width: 28, height: 28, flexShrink: 0, backgroundColor: theme.canvas }}>
              <SymbolView
                name="xmark"
                size={11}
                tintColor={theme.muted}
                resizeMode="scaleAspectFit"
              />
            </PressableSurface>
          </View>

          <Text variant="note" style={{ color: theme.muted, lineHeight: 20 }}>
            {view.body}
          </Text>

          <View style={{ gap: 6, paddingTop: 4 }}>
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={UPSELL_COPY.cta}
              // The intent, not a strength — `PressableSurface` spends it from
              // `lib/haptics` itself, which is the one door onto expo-haptics.
              haptic="selection"
              onPress={onSeePlans}
              className="rounded-md"
              style={{ backgroundColor: theme.accent }}
              contentStyle={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: MIN_TAP_TARGET,
                paddingHorizontal: 20,
              }}>
              <Text variant="label" style={{ color: theme.canvas }}>
                {UPSELL_COPY.cta}
              </Text>
            </PressableSurface>

            {/* The second way out. A word, not a button — a card with two
                filled controls asks a question it has no right to ask twice. */}
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={UPSELL_COPY.dismiss}
              onPress={close}
              contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              style={{ minHeight: MIN_TAP_TARGET }}>
              <Text variant="label" style={{ color: theme.muted }}>
                {UPSELL_COPY.dismiss}
              </Text>
            </PressableSurface>
          </View>
        </View>
      </Animated.View>
  );

  // Inline is the card and nothing else: no absolute wrapper, no
  // `pointerEvents` opt-out, because there is nothing underneath it to reach.
  if (!floating) return card;

  return (
    <View
      // Everything outside the card is still the page. See the docblock.
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 96 }}>
      {card}
    </View>
  );
}
