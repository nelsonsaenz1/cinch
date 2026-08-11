import { useCallback } from 'react';
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
import type { ProcessionAction, ProcessionState } from '@/features/intake/procession';
import { currentDraft, positionLabel } from '@/features/intake/procession';
import type { IntakeDraftRow } from '@/features/intake/queries';
import { capTrim, leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, motion, spring, useTheme } from '@/theme/tokens';

import {
  formalityLabel,
  slotLabel,
  warmthLabel,
  type CorrectionField,
} from './CorrectionSheet';

// silhouettes.tsx is being built concurrently by another unit
// (src/features/intake/silhouettes.tsx) and does not exist at the time this
// file was written. The assumed contract — stated in the build report — is a
// default export taking `{ slot, colour, pattern, size }`: `colour` a resolved
// hex (never a raw term; that resolution already happened in
// colour-lexicon.ts before a draft reaches this component), `pattern` the
// free-string overlay descriptor or null, `size` the edge length in points of
// the square the SVG draws into.
import Silhouette from '@/features/intake/silhouettes';

/**
 * V-06 — the core screen. One garment, confirm or correct.
 *
 * Everything this card needs about WHERE it is in the walkthrough comes from
 * `procession.ts` via the `procession`/`dispatch` pair, exactly as the
 * directive requires ("use it; do not reimplement it"). This component holds
 * no copy of the cursor, no copy of the drafts array, and no undo stack of its
 * own — `currentDraft` and `positionLabel` are the reducer's own accessors,
 * and every action a person can take here (`confirm`, `reject`, `back`,
 * `undo`) is dispatched as the exact `ProcessionAction` the reducer already
 * defines. The two things a plain dispatch cannot express — leaving this
 * screen for V-07's sheet or V-08's photo prompt — are the only two callback
 * props below.
 *
 * KEY THIS BY `draft.id` AT THE CALL SITE. `review-card.tsx` set the
 * precedent this follows to the letter: a card keyed by the garment's own id,
 * not by its position, arrives at 0 every time a NEW garment is under the
 * thumb, and the one that is promoted keeps whatever drag state it already
 * had (none, since it was never dragged). Reusing one instance across cards
 * via a stable key would carry the outgoing card's mid-flight `translateX`
 * onto the next garment's first frame.
 */

/**
 * Below this, a parse is shown as a hedge rather than a claim: chips go
 * `muted` instead of `ink` and the card admits "I wasn't sure about this
 * one." (§3, V-09's closing paragraph — the same treatment low-confidence
 * singular items get, one card, not a second screen).
 *
 * 0.6, not the 0.5 `parse-closet` uses to cap an unquoted guess
 * (`intake-schema.ts`): that ceiling is where the MODEL admits doubt about
 * its own read of the transcript, this is where the CARD admits it to the
 * person looking at it. Setting them equal would mean every unquoted guess
 * hedges and nothing else ever does, which flattens a graduated signal into a
 * binary one.
 */
const CONFIDENCE_HEDGE_THRESHOLD = 0.6;

/** How far a swipe has to travel before it commits, rather than snapping
 *  back. Same fraction `review-card.tsx` uses for the same reason: far enough
 *  that a scroll or a stray drag cannot fire it by accident. */
const SWIPE_THRESHOLD_RATIO = 0.28;

/** The name's serif size the directive's V-06 table specifies — 30px. There
 *  is no `text-30` step in the type scale (the nearest, `title`, is 28), so
 *  the cap-trim this needs is computed by hand from the same face metrics
 *  `text.tsx`'s own `TRIMS` table uses, rather than borrowed from a
 *  neighbouring size and left very slightly wrong. */
const NAME_SIZE = 30;
const NAME_LINE_HEIGHT = leading('instrument', NAME_SIZE, 1.08);
const NAME_TRIM = capTrim('instrument', NAME_SIZE, NAME_LINE_HEIGHT);

export type GarmentCardProps = {
  procession: ProcessionState;
  dispatch: (action: ProcessionAction) => void;
  /**
   * Whether the post-action "Undo" affordance should render right now.
   *
   * Deliberately a prop, not local state. §6's note is specific: component
   * state that tracks "just confirmed, show Undo for 4s" dies the moment a
   * query-cache refetch re-renders this component, and the affordance goes
   * silently missing — which is the one thing `procession.ts`'s bounded undo
   * stack was built to prevent. `procession.undo` already answers "CAN the
   * last action be undone"; a future `use-procession` hook is where the
   * four-second visibility window belongs (a plain timer keyed off the top
   * of the undo stack), because that hook is the thing that survives the
   * re-render this component does not control. This component only renders
   * what it is told, and always double-checks the stack is non-empty before
   * it does — a caller passing `true` past the window closes cannot make
   * this card offer an undo that would no-op.
   */
  showUndo: boolean;
  /** Opens V-07. `field` is set when a specific attribute chip was tapped, so
   *  the sheet can open scrolled straight to it; omitted for "Fix something",
   *  which opens at the top of the sheet. */
  onCorrect: (field?: CorrectionField) => void;
  /** Opens V-08. Never fires from a swipe or an edge — the silhouette itself
   *  is the only tap target, per the directive's interaction list. */
  onPhotoPrompt: (draftId: string) => void;
};

export function GarmentCard({ procession, dispatch, showUndo, onCorrect, onPhotoPrompt }: GarmentCardProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const draft = currentDraft(procession);
  const { index, total } = positionLabel(procession);
  const canUndo = showUndo && procession.undo.length > 0;

  const translateX = useSharedValue(0);
  const swipeThreshold = screenWidth * SWIPE_THRESHOLD_RATIO;

  // `runOnJS` needs a plain JS function to hand off to, not the `dispatch`
  // prop directly used from inside a worklet — wrapping it here is what lets
  // the gesture and the timing-callback below both call it the same way.
  const dispatchOnJS = useCallback((action: ProcessionAction) => dispatch(action), [dispatch]);

  /**
   * Confirm and Back both leave via the same "slide, then advance" shape —
   * the directive states the confirm case exactly ("220ms horizontal slide,
   * no bounce") and gives Back no timing of its own, so Back reuses it rather
   * than inventing a second unspecified animation. The dispatch is deferred
   * to the animation's completion callback, not fired alongside it, so the
   * slide is guaranteed to finish before the next card (a new component
   * instance, per the keying note above) mounts in its place.
   *
   * Deliberately NOT wrapped in `useCallback`. `translateX` is a Reanimated
   * shared value — mutating `.value` is the library's own API, exactly what
   * every gesture handler in this file already does — and memoising a
   * function that touches it would list the shared value itself in a
   * dependency array, which is the one thing the React Compiler's hooks
   * rules refuse: a value cannot be "passed as an argument to a hook" and
   * then mutated inside it. Plain functions, recreated each render, are the
   * cheap and correct shape here; `review-card.tsx`'s pan gesture makes the
   * same choice for the same reason.
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

  const confirm = () => leave(-1, { type: 'confirm' });
  const back = () => leave(1, { type: 'back' });
  const notMine = () => leave(-1, { type: 'reject' });

  const pan = Gesture.Pan()
    .enabled(draft !== null)
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const dragged = e.translationX + e.velocityX * 0.15;
      if (dragged < -swipeThreshold) {
        // Left = confirm, per the directive's interaction list.
        runOnJS(confirm)();
      } else if (dragged > swipeThreshold) {
        // Right = back one card. Navigation, not a rejection — the card this
        // reveals keeps whatever state it already had (procession.ts's
        // `back` case changes nothing about the draft itself).
        runOnJS(back)();
      } else {
        translateX.value = withSpring(0, spring.interactive);
      }
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
  const silhouetteSize = Math.round(screenHeight * 0.46);
  const colourHex = resolveDraftHex(draft);

  const attributes = buildAttributes(draft);

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Position — a count, never a bar or a percentage (standing refusal 4). */}
      <View className="px-gutter pt-3">
        <Text
          variant="note"
          accessibilityLabel={`Garment ${index} of ${total}`}
          style={{ fontVariant: ['tabular-nums'] }}>
          {index} of {total}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[{ flex: 1 }, cardStyle]}
          // The swipe itself has no VoiceOver equivalent — a pan gesture is
          // unreachable to it — so "back one card" (the direction with no
          // button anywhere on this screen; Confirm alone gets one, per the
          // directive's literal action list) is exposed as a custom rotor
          // action instead of a fourth visible control the layout table never
          // asked for.
          accessibilityActions={[{ name: 'back', label: 'Back one card' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'back') back();
          }}>
          <ScrollView
            contentContainerClassName="grow items-center justify-center px-gutter pb-6"
            showsVerticalScrollIndicator={false}
            // The receipt line at the foot of this content must never be the
            // thing that gets clipped on a small phone with Dynamic Type
            // turned up — a ScrollView, not a fixed View, is what guarantees
            // that (§3: "the receipt line ... must not be cut for space").
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
              accessibilityHint="Opens the option to photograph this garment instead of drawing it"
              onPress={() => onPhotoPrompt(draft.id)}
              hitSlop={8}
              // `marginBottom` here, not `marginTop` on the name below it: the
              // name is a trimmed serif, and a top margin on a trimmed serif
              // cancels to roughly nothing against the trim's own negative
              // margin — the gap has to be spent on the sibling ABOVE it.
              style={{ width: silhouetteSize, height: silhouetteSize, marginBottom: 14 }}
              className="items-center justify-center active:opacity-80">
              <Silhouette slot={draft.slot} colour={colourHex} pattern={draft.pattern} size={silhouetteSize} />
            </Pressable>

            {/* `variant="display"` for the ONE font-family class it carries
                (`font-display`) — stacking a second `font-*` className
                alongside a variant's own is the same unresolved-precedence
                trap `text.tsx` and `chip.tsx` both warn about for colour and
                size utilities, so every property that has to be 30 rather
                than the variant's own 40 is overridden through `style`
                instead, never through a second class. */}
            <Text
              variant="display"
              accessibilityRole="header"
              style={{
                fontSize: NAME_SIZE,
                lineHeight: NAME_LINE_HEIGHT,
                letterSpacing: -0.15,
                textAlign: 'center',
                ...NAME_TRIM,
              }}>
              {draft.name}
            </Text>

            {hedge ? (
              // The honest hedge, not a separate screen (§3, V-09's closing
              // note). `mb-*` on THIS sibling, never `mt-*` on the name above
              // it — the name is a trimmed serif and a top margin there
              // cancels to roughly nothing against the trim.
              <Text variant="note" className="mb-1 mt-1 text-center">
                I wasn&rsquo;t sure about this one.
              </Text>
            ) : null}

            <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
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

            {/* THE RECEIPT LINE. The most important element on this screen —
                it is what makes a wrong parse read as a mishearing rather
                than a fabrication (§3, §12) — so it is laid out last but
                never optional and never truncated by `numberOfLines`. */}
            <Text variant="note" className="mt-4 px-6 text-center italic">
              you said: “{draft.utterance}”
            </Text>
          </ScrollView>
        </Animated.View>
      </GestureDetector>

      {/* The pinned footer tray — same ground and placement as every other
          primary action in this flow (V-01, V-05). */}
      <View
        className="bg-tray px-gutter pt-3 dark:bg-tray-dark"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 10 }}>
        {canUndo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            accessibilityHint="Restores the previous card to its state before that action"
            onPress={() => dispatch({ type: 'undo' })}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET - 12 }}
            className="mb-1 items-center justify-center active:opacity-60">
            <Text variant="label" className="text-muted dark:text-muted-dark">
              Undo
            </Text>
          </Pressable>
        ) : null}

        <View className="mb-2 flex-row items-center justify-center gap-8">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fix something"
            accessibilityHint="Opens the correction sheet for this card"
            onPress={() => onCorrect()}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET - 12 }}
            className="items-center justify-center active:opacity-60">
            <Text variant="callout" className="text-muted dark:text-muted-dark">
              Fix something
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not mine"
            accessibilityHint="Removes this card. It can be restored with Undo for a few seconds after."
            onPress={notMine}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET - 12 }}
            className="items-center justify-center active:opacity-60">
            <Text variant="callout" className="text-muted dark:text-muted-dark">
              Not mine
            </Text>
          </Pressable>
        </View>

        {/* Exactly one oxblood action on this screen (refusal 6). */}
        <Button
          title="Confirm"
          onPress={confirm}
          accessibilityHint="Adds this garment to your closet and moves to the next one"
          className="w-full"
        />
      </View>
    </View>
  );
}

/**
 * A resolved hex for the drawing, never a raw term.
 *
 * `colour_oklch` is null until `resolveDraftColours` runs (see
 * `features/intake/actions.ts`), which happens just before commit rather than
 * as each card is confirmed — so a card still mid-procession may not have one
 * yet. Falling back to the same unresolved grey `colour-lexicon.ts` uses for
 * an unknown term keeps this card honest in exactly the same situation: "not
 * sure" drawn as "not sure", never a guessed colour presented as a real one.
 */
function resolveDraftHex(draft: IntakeDraftRow): string {
  const oklch = draft.colour_oklch as unknown as { hex?: string } | null;
  return oklch?.hex ?? '#9A9691';
}

type Attribute = { field: CorrectionField; label: string };

/**
 * The attribute row, built in the directive's own example order — Kind,
 * Colour, Fabric, Pattern, How dressy, How warm — with Fabric and Pattern
 * silently absent when the draft does not have one. `parse-closet` returns
 * both as nullable precisely because a model that always writes something is
 * a model that sometimes writes fiction (`intake-schema.ts`'s own comment on
 * `material` makes the same point for tagging); a chip for a fabric nobody
 * said would be exactly the kind of confident invention the receipt line
 * exists to guard against.
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
 * The attribute chip, per the directive's own literal spec for this row —
 * "sand ground, ink 12.5px, radius 14" — which is close to but not the same
 * as the shared `Chip` (radius 12, 13px label) and, for the hedge state,
 * needs a `muted` text tone `Chip` has no prop for (its unselected label is
 * hard-coded to `ink`). A bespoke chip local to this screen keeps the shared
 * component's contract simple rather than growing it a one-off tone for a
 * single atlas's literal numbers.
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
      style={{ minHeight: MIN_TAP_TARGET - 12, borderRadius: 12 }}
      className="flex-row items-center justify-center bg-sand px-3.5 active:opacity-60 dark:bg-sand-dark">
      <Text style={{ fontSize: 12.5, lineHeight: 16, color: muted ? theme.muted : theme.ink }}>{label}</Text>
    </Pressable>
  );
}
