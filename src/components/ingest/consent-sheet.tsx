import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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
import { CONSENT_FACTS } from '@/features/auth/consent-facts';
import {
  CONSENT_ASK_FOOTER,
  CONSENT_ASK_LEAD,
  CONSENT_ASK_TITLE,
} from '@/features/privacy/copy';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

/**
 * The first-run AI-processing consent moment — Apple Guideline 5.1.2(i),
 * redrawn as CN-01 and CN-01/AX.
 *
 * The disclosure is four facts, stated plainly rather than buried behind a
 * policy link: where the photo goes and what does NOT travel with it, what
 * Cinch itself keeps, and that face recognition never runs. Consent is also
 * enforced server-side on every Edge Function call; this is the "ask first"
 * half.
 *
 * ── What CN-01 changed, and the one thing it did not ──────────────────────
 *
 * Changed: the title and opening sentence separate the on-device cutout from
 * the model call (`CONSENT_ASK_TITLE` / `CONSENT_ASK_LEAD` carry the citation),
 * the facts move from 13px to 17px, the numerals and rules are gone, the
 * actions are pinned below the scroll region so the sheet can never cover
 * them, and the footer states the honest limit of the claim instead of a
 * retention promise nobody has verified.
 *
 * NOT changed: the four sentences. CN-01 draws four different ones and calls
 * them "the shared consent-fact records, used verbatim"; they are not the
 * records. `CONSENT_FACTS` is what people actually agreed to and what the
 * privacy page quotes back to them, so rewriting it here would tell existing
 * users they agreed to sentences they never saw. The drawn wording is reported
 * as a conflict, not applied.
 *
 * ── The action CN-01 draws that is not here ───────────────────────────────
 *
 * "Not now" — a third exit that defers rather than answering. Nothing in this
 * component can honour it: the sheet's contract is that it cannot be dismissed
 * without choosing, and what deferral MEANS is a decision belonging to the
 * screens that raise it (`app/capture.tsx`, `app/describe.tsx`) — whether the
 * pending piece is kept, whether the ask returns, and when. A third button
 * wired to nothing would be worse than its absence. Raised as a dependency.
 *
 * Every claim here is one this app can prove about ITS OWN behaviour.
 * system-safety-contract.md §3 is explicit: a retention or no-training
 * promise about the AI partner is not something Cinch has verified, and
 * printing it in a consent sheet would be the single worst sentence the app
 * could contain. Restore a stronger claim only once the provider terms are
 * confirmed in writing.
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

export function ConsentSheet({
  visible,
  onAccept,
  onDecline,
  onDismissed,
  busy,
  stressViewport,
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
  /**
   * Cap the scroll region, so CN-01/AX's arrangement can be captured without
   * depending on the simulator's Dynamic Type setting — the same contract
   * `Plate`'s `stacked` prop has in Group 2: the fixture is a picture of the
   * arrangement, not of the device's settings.
   *
   * It does NOT fake the count. The "n more facts below" line is measured off
   * this viewport exactly as it is measured off a real one, so a smaller cap
   * and a larger type setting produce the same sentence for the same reason.
   * `__DEV__` fixtures only; no shipping call site passes it.
   */
  stressViewport?: number;
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

  // ── CN-01 / AX · "facts scroll, decisions do not" ────────────────────────
  //
  // At the largest Dynamic Type sizes four facts cannot share a viewport with
  // the actions. The atlas's answer is to scroll the facts and pin the actions
  // above the home indicator, so the sheet never covers its own footer — and to
  // STATE the cut in words, because a reader should not have to discover by
  // scrolling that content continues.
  //
  // The number in that sentence is measured, never assumed. `factTops` holds
  // each fact's offset inside the scroll content; a fact is "below" when its
  // top has not yet reached the bottom of the visible region. At ordinary type
  // nothing is below and the line is absent, which is why this needs no font-
  // scale branch: one composition, and the measurement decides.
  //
  // Refusing to guess matters here specifically. "Two more facts below" with a
  // hard-coded two would be a printed count that is right on one device and
  // wrong on the next, which is exactly the refusal — never estimated.
  const factTops = useRef<Record<number, number>>({});
  const factsTop = useRef(0);
  const viewport = useRef(0);
  const [factsBelow, setFactsBelow] = useState(0);

  const recount = useCallback((offsetY: number) => {
    if (!viewport.current) return;
    const bottom = offsetY + viewport.current;
    let below = 0;
    for (const key of Object.keys(factTops.current)) {
      if (factsTop.current + factTops.current[Number(key)] >= bottom) below += 1;
    }
    setFactsBelow((current) => (current === below ? current : below));
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => recount(event.nativeEvent.contentOffset.y),
    [recount],
  );

  const onViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewport.current = event.nativeEvent.layout.height;
      recount(0);
    },
    [recount],
  );

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
          className="rounded-t-plate bg-canvas"
          style={{ maxHeight: '88%' }}>
          {/* The grabber — the sheet's own furniture, saying "this rises over
              capture and drops back into it". It no longer implies swipe-to-
              dismiss in behaviour, but the sheet still moves like a sheet. */}
          <View className="items-center pb-1 pt-2.5">
            <View className="h-[5px] w-9 rounded-full bg-sand" />
          </View>

          <ScrollView
            // `flexShrink`, so the scroll region gives way to the pinned
            // actions inside the sheet's 88% ceiling rather than pushing them
            // past its own bottom edge.
            style={{ flexShrink: 1, maxHeight: stressViewport }}
            onLayout={onViewportLayout}
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerClassName="px-gutter pt-4"
            contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Gap lives on the eyebrow: a `mt-*` stacked on the trimmed
                title resolves against trim's style-prop negative margins by
                merge order, and the designed gap collapses to nearly zero. */}
            <Text variant="eyebrow" className="mb-4">
              Before we send anything
            </Text>
            <Text variant="title" trim accessibilityRole="header">
              {CONSENT_ASK_TITLE}
            </Text>
            {/* Tone as an inline style, not a stacked `text-muted`. Two colour
                utilities on one element are resolved by their order in the
                generated stylesheet, not by which one the call site wrote
                last; an inline style is the only tone that holds. */}
            <Text variant="body" className="mt-4" style={{ color: theme.muted }}>
              {CONSENT_ASK_LEAD}
            </Text>

            {/* ── The four facts ─────────────────────────────────────────────
                Was a hairline-ruled ledger with serif oxblood numerals, set at
                13px. Two things changed and neither is the wording:

                  · 17px. The group's floor is that no legal sentence is set
                    below 15 pt, and a consent fact is the most legal sentence
                    in the app. The lead stays Medium — a clause, never a full
                    sentence — and the rest is regular in `muted`.
                  · No numerals and no rules. Four numbered rows read as a
                    ranked list, and the numerals were a second oxblood on a
                    frame whose accent belongs to the action. Air separates the
                    facts instead, which is what makes four things countable at
                    a glance.

                Each fact is ONE `Text` with the lead nested inside it, so the
                sentence wraps as one sentence. CN-01 draws a Medium heading
                above a separate regular sentence; that shape cannot be built
                from this record without writing four new headings, and a
                heading on a consent sheet is a sentence a user agreed to. The
                record is quoted, not re-cut. */}
            <View
              className="mt-5 gap-5"
              onLayout={(event) => {
                factsTop.current = event.nativeEvent.layout.y;
              }}>
              {CONSENT_FACTS.map(({ lead, rest }, index) => (
                <View
                  key={lead}
                  onLayout={(event) => {
                    factTops.current[index] = event.nativeEvent.layout.y;
                  }}>
                  <Text variant="body" style={{ color: theme.muted }}>
                    <Text variant="body" style={{ color: theme.ink }}>
                      {lead}
                    </Text>
                    {rest}
                  </Text>
                </View>
              ))}
            </View>

            {/* The legal line, inside the scrolling region so that at the
                largest type it is READ at full size rather than shrunk to fit
                beside the actions — CN-01/AX moves it here for that reason, and
                keeping one composition means it lives here always. The whole
                footnote is the tap target: an inline link on its own is under
                the 44pt floor. */}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Read the full privacy page"
              onPress={openPolicy}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-6 justify-center active:opacity-60">
              <Text variant="callout" style={{ color: theme.muted }}>
                {CONSENT_ASK_FOOTER}{' '}
                <Text variant="callout" style={{ color: theme.accent }}>
                  Read the full privacy page
                </Text>
              </Text>
            </Pressable>
          </ScrollView>

          {/* ── The decisions, pinned ─────────────────────────────────────────
              Outside the ScrollView, so the sheet can never cover its own
              actions however large the type is. At ordinary sizes nothing
              scrolls and this reads as the bottom of one column. */}
          <View
            className="border-t border-hairline px-gutter pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}>
            {factsBelow > 0 ? (
              // The cut, stated. Only ever a measured number of facts that are
              // genuinely still below the fold.
              <Text
                variant="callout"
                accessibilityLiveRegion="polite"
                className="mb-2.5"
                style={{ color: theme.muted }}>
                {factsBelow === 1 ? 'One more fact below' : `${factsBelow} more facts below`}
              </Text>
            ) : null}

            {/* Two equal ways forward. The decline is a full outlined button in
                the same voice as the accept — declining is a working mode, so
                it is not dressed as a ghost or a "not now". */}
            <View className="gap-2.5">
              <Button
                title="Allow processing"
                variant="primary"
                loading={busy}
                onPress={onAccept}
              />
              <Button
                title="Keep photos on this phone"
                variant="secondary"
                disabled={busy}
                onPress={onDecline}
              />
            </View>
          </View>
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
