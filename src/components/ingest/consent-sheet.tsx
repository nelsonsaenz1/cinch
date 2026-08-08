import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiPolicyPage } from '@/components/ingest/ai-policy-page';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

/**
 * The first-run AI-processing consent moment — Apple Guideline 5.1.2(i),
 * redesigned per the 2026-08 consent atlas (frame A-01).
 *
 * The disclosure is four numbered facts, stated plainly rather than buried
 * behind a policy link: where the photo goes, that the partner keeps nothing
 * and trains on nothing, what Cinch itself keeps, and that face recognition
 * never runs. Consent is also enforced server-side on every Edge Function
 * call; this is the "ask first" half.
 *
 * PRESENTED AS A BOTTOM SHEET OVER THE DIMMED SCREEN, not a pageSheet — the
 * shot the decision is about is still visible, dimmed, behind the ask.
 *
 * The sheet cannot be dismissed without choosing. Both buttons are live from
 * the first frame, neither is pre-selected, and neither is dimmed into a
 * ghost: declining is a working mode (photos stay on the phone, tags are
 * typed by hand), not a dead end. The scrim deliberately does NOT decline any
 * more — a stray tap outside the sheet must never be recorded as an answer to
 * a consent question, in either direction — and hardware back is likewise
 * ignored while the ask is open.
 *
 * "Read the full policy" slides `AiPolicyPage` (A-02) over the sheet inside
 * this same Modal. The sheet stays mounted underneath; backing out of the
 * page returns to the ask with neither choice made.
 */
const FACTS = [
  {
    lead: 'The photo goes to our AI partner,',
    rest: ' which returns a category, colour and fabric.',
  },
  {
    lead: 'They don’t keep it and don’t train on it.',
    rest: ' It’s deleted once the tags come back.',
  },
  {
    lead: 'We keep the photo and the tags',
    rest: ' in your closet. Deleting an item deletes both.',
  },
  {
    lead: 'We never run face recognition,',
    rest: ' here or anywhere in Cinch.',
  },
] as const;

export function ConsentSheet({
  visible,
  onAccept,
  onDecline,
  onDismissed,
  busy,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /**
   * Fired once the sheet has finished LEAVING — not when `visible` flips.
   *
   * This is what makes "Turn on AI tagging" open the picker on the first tap.
   * The picker and the describe sheet are both view controllers iOS presents
   * modally, and asking it to present one while this modal is still on its way
   * out is refused outright: the call resolved as though it had been cancelled
   * and the user was left looking at the capture screen, having consented to
   * nothing visible. Whatever was interrupted has to be resumed on the far side
   * of the dismissal, and this is the only signal for that edge.
   */
  onDismissed?: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // The policy page (A-02), slid over the sheet inside this same Modal.
  // `policyMounted` keeps it in the tree while it animates out; `slide` is
  // 0 = covering the screen, 1 = parked off the trailing edge. `spring.smooth`
  // carries `ReduceMotion.System`, so under the accessibility setting the page
  // appears and leaves instantly instead of travelling.
  const [policyMounted, setPolicyMounted] = useState(false);
  const slide = useSharedValue(1);

  const openPolicy = useCallback(() => {
    setPolicyMounted(true);
    slide.set(withSpring(0, spring.smooth));
  }, [slide]);

  const closePolicy = useCallback(() => {
    slide.set(
      withSpring(1, spring.smooth, (finished) => {
        if (finished) runOnJS(setPolicyMounted)(false);
      }),
    );
  }, [slide]);

  // If the sheet is torn down while the policy is up (a choice made elsewhere,
  // an account signed out), the next presentation must start at the ask.
  // Render-phase derivation rather than an effect: the reset must land in the
  // same pass that hides the sheet, never a frame later.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) {
      setPolicyMounted(false);
      slide.set(1);
    }
  }

  const policyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value * width }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onDismiss={onDismissed}
      onRequestClose={() => {
        // Hardware back closes the policy overlay if it is up; against the
        // ask itself it does nothing. Dismissal must never be mistakable for
        // an answer, and neither choice is a default.
        if (policyMounted) closePolicy();
      }}>
      {/* `scrim` is the one dimming value in the system — warm ink at 40%.
          The scrim is inert on purpose: no Pressable behind the sheet. A tap
          outside a consent question is not an answer to it. */}
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <View
          className="rounded-t-plate bg-canvas dark:bg-canvas-dark"
          style={{ maxHeight: '88%' }}>
          {/* The grabber — the sheet's own furniture, saying "this rises over
              capture and drops back into it". It no longer implies swipe-to-
              dismiss in behaviour, but the sheet still moves like a sheet. */}
          <View className="items-center pb-1 pt-2.5">
            <View className="h-[5px] w-9 rounded-full bg-sand dark:bg-sand-dark" />
          </View>

          <ScrollView
            contentContainerClassName="px-gutter pt-4"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            {/* Gap lives on the eyebrow: a `mt-*` stacked on the trimmed
                title resolves against trim's style-prop negative margins by
                merge order, and the designed gap collapses to nearly zero. */}
            <Text variant="eyebrow" className="mb-4">
              Before we send anything
            </Text>
            <Text variant="title" trim>
              Cinch can tag your clothes for you.
            </Text>
            {/* Tone as an inline style, not a stacked `text-muted`. Two colour
                utilities on one element are resolved by their order in the
                generated stylesheet, not by which one the call site wrote
                last; an inline style is the only tone that holds. */}
            <Text variant="callout" className="mt-3" style={{ color: theme.muted }}>
              To do it, the photo has to leave your phone. Here is exactly what that means.
            </Text>

            {/* The four facts — a hairline-ruled ledger, not an icon list.
                Serif oxblood numerals; each row leads with the claim in ink
                and lets the detail trail off in the quiet voice. */}
            <View className="mt-4">
              {FACTS.map(({ lead, rest }, index) => (
                <View
                  key={lead}
                  className={`flex-row gap-3 border-t border-rule py-2.5 dark:border-rule-dark ${
                    index === FACTS.length - 1 ? 'border-b' : ''
                  }`}>
                  <Text
                    variant="statSmall"
                    className="w-4"
                    style={{ color: theme.accent }}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants">
                    {index + 1}
                  </Text>
                  <Text variant="label" className="flex-1 font-body">
                    <Text variant="label" className="font-semibold" style={{ color: theme.ink }}>
                      {lead}
                    </Text>
                    {rest}
                  </Text>
                </View>
              ))}
            </View>

            {/* Two equal ways forward. The decline is a full outlined button in
                the same voice as the accept — declining is a working mode, so
                it is not dressed as a ghost or a "not now". */}
            <View className="mt-5 gap-2.5">
              <Button
                title="Turn on AI tagging"
                variant="ink"
                loading={busy}
                onPress={onAccept}
              />
              <Button
                title="Keep my photos on this phone"
                variant="secondary"
                disabled={busy}
                onPress={onDecline}
              />
            </View>

            {/* The whole footnote is the tap target for the policy link — an
                inline 13px link on its own is under the 44pt floor. */}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Read the full policy"
              onPress={openPolicy}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-2 justify-center active:opacity-60">
              <Text variant="label" className="text-center">
                Either way, you can change this in Settings.{' '}
                <Text variant="label" style={{ color: theme.accent }}>
                  Read the full policy
                </Text>
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* A-02, slid over the whole screen inside this same Modal. The sheet
            stays mounted underneath — back returns to the ask with neither
            choice made. */}
        {policyMounted ? (
          <Animated.View
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, policyStyle]}>
            <AiPolicyPage onBack={closePolicy} />
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}
