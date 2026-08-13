import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
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

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { catalogueSearchOffered } from '@/features/catalogue/analytics';
import {
  WALKTHROUGH_ACTION,
  WALKTHROUGH_EXPLANATION,
} from '@/features/catalogue/copy';
import type { ProcessionAction, ProcessionState } from '@/features/intake/procession';
import { currentDraft, lastDropped, positionLabel } from '@/features/intake/procession';
import type { IntakeDraftRow } from '@/features/intake/queries';
import { MIN_TAP_TARGET, motion, shadow, spring, useTheme } from '@/theme/tokens';

import { formalityLabel, slotLabel, warmthLabel, type CorrectionField } from './CorrectionSheet';
import { ProcessionMasthead } from './ProcessionMasthead';

/**
 * PR-01, PR-05 — the procession's ordinary card.
 *
 * Everything this card knows about WHERE it is comes from `procession.ts` via
 * the `procession`/`dispatch` pair. It holds no copy of the cursor, no copy of
 * the drafts array, and no undo stack of its own.
 *
 * THE SPOKEN PHRASE IS THE SUBJECT OF THE CARD, above the name and set off by a
 * rule. That ordering is the whole design: a wrong parse read against what was
 * actually said is a mishearing, and a wrong parse read alone is a fabrication.
 * It is why the card no longer draws a silhouette — the atlas replaces the
 * illustration with the utterance, and a drawn guess of a garment sitting above
 * a guessed name doubles the assertion instead of grounding it.
 *
 * DROP IS A PEER, NOT A DESTRUCTIVE ACTION. It is outlined, not red: it marks
 * the row rejected and Undo brings it back, and nothing in the flow deletes
 * anything. PR-05's tray band says so in as many words and stays until the next
 * decision — never a toast on a timer, because no dismissal in this group is
 * delayed and none is hidden.
 *
 * "CHANGE SOMETHING" CONFIRMS. Correcting a card IS the confirmation; making
 * somebody fix a card and then confirm it is a second tap for no information.
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
  const theme = useTheme();
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
        {dropped ? (
          // PR-05. A tray band, not a toast — it stays until the next decision.
          <View
            className="bg-tray"
            style={{ borderRadius: 12, padding: 16, marginBottom: 12 }}
            accessibilityRole="alert">
            <Text variant="heading" style={{ fontSize: 15 }}>
              {`${dropped.name} dropped`}
            </Text>
            <Text variant="note" style={{ fontSize: 14, lineHeight: 21, marginTop: 3 }}>
              Still on the list, marked as dropped. Undo puts it back exactly as it was.
            </Text>
          </View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View
            style={cardStyle}
            accessibilityActions={[{ name: 'back', label: 'Back one card' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'back') back();
            }}>
            <View
              className="bg-surface"
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: theme.rule,
                padding: 20,
                shadowColor: theme.ink,
                shadowOpacity: 0.16,
                shadowRadius: shadow.contact.blur,
                shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy },
              }}>
              <Text variant="eyebrow">You said</Text>
              <Text
                variant="note"
                className="italic"
                style={{ fontSize: 17, lineHeight: 26, marginTop: 6 }}>
                {`“${draft.utterance}”`}
              </Text>
              <View
                style={{ height: 1, backgroundColor: theme.rule, marginTop: 18, marginBottom: 18 }}
              />
              <Text variant="display" trim accessibilityRole="header" style={{ fontSize: 32 }}>
                {draft.name}
              </Text>

              {hedge ? (
                <Text variant="note" style={{ marginTop: 10 }}>
                  Cinch was not sure about this one.
                </Text>
              ) : null}

              <View className="flex-row flex-wrap" style={{ marginTop: 14, gap: 8 }}>
                {attributes.map((a) => (
                  <AttributeChip
                    key={a.field}
                    label={a.label}
                    muted={hedge}
                    accessibilityHint={`Opens editing for ${a.field}`}
                    onPress={() => onCorrect(a.field)}
                  />
                ))}
              </View>

              {/* Oxblood, and the frame's only oxblood TEXT — the filled Keep
                  it below is the frame's one filled action. Editing confirms,
                  so this is a way through the card, not a way around it. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change something"
                accessibilityHint="Opens the correction sheet for this card"
                onPress={() => onCorrect()}
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', marginTop: 8 }}
                className="active:opacity-60">
                <Text variant="body" style={{ fontSize: 16, color: theme.accent }}>
                  Change something
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </GestureDetector>
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

      <View
        className="flex-row px-gutter"
        style={{ gap: 12, paddingBottom: Math.max(insets.bottom, 12) + 6 }}>
        <View style={{ width: 96 }}>
          <Button
            title="Drop"
            variant="secondary"
            onPress={drop}
            accessibilityHint="Marks this card dropped. Undo puts it back exactly as it was."
            className="self-stretch"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Keep it"
            onPress={keep}
            accessibilityHint="Adds this garment to your closet and moves to the next one"
            className="self-stretch"
          />
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
    { field: 'colour', label: capitalize(draft.colour_term) },
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

/**
 * The attribute chip — tray ground, r12, 14px. Close to but not the same as the
 * shared `Chip`, which has no prop for the `muted` tone the hedge state needs;
 * a bespoke chip local to this screen keeps the shared component's contract
 * simple rather than growing it a one-off tone.
 */
function AttributeChip({
  label,
  muted,
  onPress,
  accessibilityHint,
}: {
  label: string;
  muted: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={{ minHeight: MIN_TAP_TARGET - 10, borderRadius: 12 }}
      className="flex-row items-center justify-center bg-tray px-3 active:opacity-60">
      <Text style={{ fontSize: 14, lineHeight: 18, color: muted ? theme.muted : theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}
