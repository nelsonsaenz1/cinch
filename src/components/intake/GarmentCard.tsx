import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFace, WalkthroughBand } from '@/components/intake/walkthrough-parts';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { catalogueSearchOffered } from '@/features/catalogue/analytics';
import {
  WALKTHROUGH_ACTION,
  WALKTHROUGH_EXPLANATION,
} from '@/features/catalogue/copy';
import { resolveSpokenColour } from '@/features/intake/colour-lexicon';
import type { ProcessionAction, ProcessionState } from '@/features/intake/procession';
import { currentDraft, lastDropped, positionLabel } from '@/features/intake/procession';
import type { IntakeDraftRow } from '@/features/intake/queries';
import { GarmentSilhouette } from '@/features/intake/silhouettes';
import { CARD } from '@/features/intake/walkthrough-spec';
import { motion, spring } from '@/theme/tokens';

import { formalityLabel, slotLabel, warmthLabel, type CorrectionField } from './CorrectionSheet';
import { ProcessionMasthead } from './ProcessionMasthead';

/**
 * PR-01, PR-05 — the procession's ordinary card.
 *
 * Everything this card knows about WHERE it is comes from `procession.ts` via
 * the `procession`/`dispatch` pair. It holds no copy of the cursor, no copy of
 * the drafts array, and no undo stack of its own.
 *
 * THE SPOKEN PHRASE IS STILL THE SOURCE OF TRUTH — and redesign 24 moves it.
 * It used to be the card's headline, above the name and set off by a rule; it
 * is now quoted beneath the parsed facts, in clay italic, under "You said". The
 * argument for the old ordering survives the move intact — a wrong parse read
 * against what was actually said is a mishearing, and a wrong parse read alone
 * is a fabrication — because the utterance is still on the card, still
 * verbatim, and still the thing the two decisions are taken against. What it
 * stops doing is out-shouting the name the reader is actually being asked to
 * judge. See `CardFace` for the full note, including why the plate came back.
 *
 * DROP IS A PEER, NOT A DESTRUCTIVE ACTION. It is outlined, not red: it marks
 * the row rejected and Undo brings it back, and nothing in the flow deletes
 * anything. The band says so in as many words, carries Undo as its own word,
 * and stays until the next decision — never a toast on a timer, because no
 * dismissal in this group is delayed and none is hidden.
 *
 * FIX CONFIRMS. Correcting a card IS the confirmation; making somebody fix a
 * card and then confirm it is a second tap for no information. The control was
 * an inline "Change something" link inside the card body and is now a peer of
 * Keep and Drop, which is the weight a third decision was always owed.
 *
 * KEY THIS BY `draft.id` AT THE CALL SITE, so a new garment arrives at
 * `translateX` 0 rather than inheriting the outgoing card's mid-flight drag.
 */

/**
 * Below this, a parse is shown as a hedge rather than a claim: the chips go
 * `muted` and the card admits it was not sure. 0.6, not the 0.5 `parse-closet`
 * uses to cap an unquoted guess — that ceiling is where the MODEL admits doubt,
 * this is where the CARD admits it to the person looking at it.
 */
const CONFIDENCE_HEDGE_THRESHOLD = 0.6;

/** How far a swipe travels before it commits rather than snapping back. */
const SWIPE_THRESHOLD_RATIO = 0.28;

export type GarmentCardProps = {
  procession: ProcessionState;
  dispatch: (action: ProcessionAction) => void;
  /**
   * Whether the masthead's Undo is live.
   *
   * Deliberately a prop, not local state: component state that tracks "just
   * decided, offer Undo" dies the moment a query-cache refetch re-renders this
   * component, and the affordance goes silently missing. The control itself is
   * always drawn — it changes WEIGHT rather than appearing, so the header never
   * reflows — and it is only pressable when the stack really has something.
   */
  showUndo: boolean;
  /** Opens the edit sheet. `field` is set when a chip was tapped. */
  onCorrect: (field?: CorrectionField) => void;
  /**
   * CPV2-V01 — "Find its product photo", for THIS card only.
   *
   * A tap, and only a tap. §7 of the CPV2 handoff: "one catalogue request per
   * garment the user asks about, never one per garment in the procession." The
   * procession is seven cards and the allowance is 10,000 requests a month; a
   * walkthrough that looked up every card as it arrived would be the single
   * fastest way to spend it, and it would spend it on garments the user was
   * about to drop.
   *
   * Optional, so the card renders unchanged everywhere it is posed without one
   * — including the existing dev fixtures, which must keep showing the
   * walkthrough exactly as it ships.
   */
  onFindPhoto?: () => void;
};

export function GarmentCard({
  procession,
  dispatch,
  showUndo,
  onCorrect,
  onFindPhoto,
}: GarmentCardProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const draft = currentDraft(procession);
  const { index, total } = positionLabel(procession);
  const canUndo = showUndo && procession.undo.length > 0;
  const dropped = lastDropped(procession);

  /**
   * CPV2-V01: `catalogue_search_offered(path: walkthrough)` fires ON CARD
   * DISPLAY, not on tap — it is the DENOMINATOR. Without it the walkthrough
   * lookup has a completion rate with nothing under the line, which is the
   * exact hole `posthog.tsx` says the offer events exist to close.
   *
   * Keyed on the draft so it fires once per card rather than once per render,
   * and only when the ask is actually on screen.
   */
  const offeredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!onFindPhoto || !draft || offeredFor.current === draft.id) return;
    offeredFor.current = draft.id;
    catalogueSearchOffered('walkthrough');
  }, [onFindPhoto, draft]);

  const translateX = useSharedValue(0);
  const swipeThreshold = screenWidth * SWIPE_THRESHOLD_RATIO;

  const dispatchOnJS = useCallback((action: ProcessionAction) => dispatch(action), [dispatch]);

  /**
   * Confirm and Back both leave via the same slide. Not wrapped in
   * `useCallback`: `translateX` is a Reanimated shared value, and memoising a
   * function that mutates one would list the shared value in a dependency
   * array, which the compiler's hook rules refuse.
   */
  const leave = (direction: 1 | -1, action: ProcessionAction) => {
    translateX.value = withTiming(
      direction * screenWidth * 1.15,
      { duration: motion.duration.base },
      (finished) => {
        if (finished) runOnJS(dispatchOnJS)(action);
      },
    );
  };

  const keep = () => leave(-1, { type: 'confirm' });
  const back = () => leave(1, { type: 'back' });
  const drop = () => leave(-1, { type: 'reject' });

  const pan = Gesture.Pan()
    .enabled(draft !== null)
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const dragged = e.translationX + e.velocityX * 0.15;
      if (dragged < -swipeThreshold) runOnJS(keep)();
      else if (dragged > swipeThreshold) runOnJS(back)();
      else translateX.value = withSpring(0, spring.interactive);
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-6, 0, 6],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX: translateX.value }, { rotate: `${rotate}deg` }] };
  });

  if (!draft) return null;

  const hedge = draft.confidence < CONFIDENCE_HEDGE_THRESHOLD;
  const attributes = buildAttributes(draft);

  return (
    <View className="flex-1 bg-canvas">
      <ProcessionMasthead
        index={index}
        total={total}
        canUndo={canUndo}
        onBack={back}
        onUndo={() => dispatch({ type: 'undo' })}
      />

      <ScrollView contentContainerClassName="px-gutter pb-4" showsVerticalScrollIndicator={false}>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={cardStyle}
            accessibilityActions={[{ name: 'back', label: 'Back one card' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'back') back();
            }}>
            <CardFace
              name={draft.name}
              facts={attributes}
              utterance={draft.utterance ?? ''}
              hedge={hedge}
              hedgeNote="Cinch was not sure about this one."
              /**
               * THE PLATE IS BACK, and this is a reversal worth naming.
               *
               * The card dropped its silhouette on the argument that a drawn
               * guess of a garment sitting above a guessed name doubles the
               * assertion instead of grounding it. Redesign 24 restores it,
               * and the reason the argument no longer bites is that the
               * ordering changed with it: the plate is a WELL now, above facts
               * that are themselves above the reader's verbatim words, rather
               * than an illustration competing with the utterance for the top
               * of the card. It is drawn from `draft.slot` and `colour_term` —
               * the parse's own answers, the same ones the facts line prints —
               * so it asserts nothing the line beneath it does not already say.
               */
              plate={
                <GarmentSilhouette
                  slot={draft.slot}
                  /**
                   * The parse's own colour, resolved through the lexicon — and
                   * `UNRESOLVED`'s deliberate mid grey when nobody named one.
                   * Never a guess: a draft with no colour term draws a shape
                   * that reads as "not sure", which is exactly what the facts
                   * line above it says with its "Colour?" prompt.
                   */
                  colour={resolveSpokenColour(draft.colour_term ?? '').hex}
                  pattern={draft.pattern}
                  size={Math.round(CARD.plate * 0.62)}
                />
              }
              onCorrectField={(field) => onCorrect(field as CorrectionField)}
            />
          </Animated.View>
        </GestureDetector>

        {dropped ? (
          // PR-05. A band, not a toast — it stays until the next decision, and
          // it carries Undo as its own word, which is where redesign 24 puts
          // the control. Blush rather than tray: a drop is the one decision on
          // this screen worth a beat, and the band's whole job is to say that
          // the beat is reversible and that nothing was deleted.
          <WalkthroughBand
            alert
            tone="blush"
            title={`${dropped.name} dropped`}
            body="Still on the list, marked as dropped. Your recording and the words you said are untouched."
            action={
              canUndo
                ? {
                    label: 'Undo',
                    onPress: () => dispatch({ type: 'undo' }),
                    hint: 'Puts it back exactly as it was',
                  }
                : undefined
            }
            style={{ marginTop: 12 }}
          />
        ) : null}
      </ScrollView>

      {/* CPV2-V01's quiet ask, above the two decisions and never competing with
          them: "Looks right — next" is what this screen is for, and the lookup
          is an aside somebody takes when they want a picture for this one
          piece. Ghost weight, its own explanation line, no badge. */}
      {onFindPhoto ? (
        <View className="gap-1 px-gutter pb-2">
          <Button
            title={WALKTHROUGH_ACTION}
            variant="ghost"
            onPress={onFindPhoto}
            accessibilityHint={WALKTHROUGH_EXPLANATION}
            className="self-stretch"
          />
          <Text variant="noteSmall">{WALKTHROUGH_EXPLANATION}</Text>
        </View>
      ) : null}

      {/* KEEP IS THE FRAME'S ONE FILLED ACTION, full width; Fix and Drop are
          peers beneath it, equal halves. Drop is outlined and never red — it
          rejects the draft from THIS IMPORT and the band above offers Undo;
          nothing here deletes anything, and a critical variant would say
          otherwise.

          "Fix" replaces the inline "Change something" link the card used to
          carry inside its body. Same destination, same one-action semantics
          (correcting a card IS confirming it), promoted to a real control
          because a decision offered as body text sits below the two it is a
          peer of. */}
      <View
        className="px-gutter"
        style={{ gap: 10, paddingBottom: Math.max(insets.bottom, 12) + 6 }}>
        <Button
          title="Keep"
          onPress={keep}
          haptic
          accessibilityHint="Adds this garment to your closet and moves to the next one"
          className="self-stretch"
        />
        <View className="flex-row" style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Fix"
              variant="secondary"
              onPress={() => onCorrect()}
              accessibilityHint="Opens the correction sheet. Saving a correction also keeps the card."
              className="self-stretch"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Drop"
              variant="secondary"
              onPress={drop}
              accessibilityHint="Marks this card dropped. Undo puts it back exactly as it was."
              className="self-stretch"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

type Attribute = { field: CorrectionField; label: string };

/**
 * Kind, Colour, Fabric, Pattern, How dressy, How warm — with Fabric and Pattern
 * silently absent when the draft does not have one. `parse-closet` returns both
 * as nullable precisely because a model that always writes something is a model
 * that sometimes writes fiction, and a chip for a fabric nobody said would be
 * exactly the invention the spoken phrase above it exists to guard against.
 */
function buildAttributes(draft: IntakeDraftRow): Attribute[] {
  const attrs: Attribute[] = [
    { field: 'kind', label: slotLabel(draft.slot) },
    // Null is a real state now: the description named no colour and nothing
    // guessed one. The chip still appears — it is how a correction is opened —
    // but it asks instead of asserting.
    { field: 'colour', label: draft.colour_term ? capitalize(draft.colour_term) : 'Color?' },
  ];
  if (draft.fabric) attrs.push({ field: 'fabric', label: capitalize(draft.fabric) });
  if (draft.pattern) attrs.push({ field: 'pattern', label: capitalize(draft.pattern) });
  const formality = formalityLabel(draft.formality);
  if (formality) attrs.push({ field: 'formality', label: formality });
  const warmth = warmthLabel(draft.warmth);
  if (warmth) attrs.push({ field: 'warmth', label: warmth });
  return attrs;
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
