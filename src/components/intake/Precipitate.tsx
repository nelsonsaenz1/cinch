import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  LinearTransition,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { resolveSpokenColour } from '@/features/intake/colour-lexicon';
import type { IntakeDraftRow } from '@/features/intake/queries';
// ASSUMED SHAPE — `src/features/intake/silhouettes.tsx` is being written by
// another unit concurrently with this file and does not exist yet at the time
// of writing. Per the build brief: a default export taking a slot, a colour
// (hex), a pattern and a size. If the real file lands with a different prop
// name or shape, this is the one call site (inside PileCard, below) that
// needs to be reconciled — nothing else in this file assumes anything about it.
import Silhouette from '@/features/intake/silhouettes';
import type { Slot } from '@/lib/styling/types';
import { GUTTER, motion, shadow, useTheme, type ThemeColors } from '@/theme/tokens';

/**
 * V-04 — "Reading". The transcript arrives and garments precipitate out of it.
 *
 * Sequence, per the directive: the transcript sets in `muted`, filling from
 * the top; as the parse resolves, each matched phrase brightens to `ink`,
 * lifts up and to the right, and shrinks into a small silhouette card that
 * joins a loose pile in the upper third; the remaining text closes the gap
 * behind it. This is the state the founder asked to be beautiful, and it is
 * also the state that has to be the most honest one in the whole flow — see
 * the two rules below, which are load-bearing, not decorative.
 *
 * RULE 1 — every card corresponds to a real parsed garment.
 *
 * The pile renders exactly one `PileCard` per confirmed entry in `garments`,
 * driven off that array's own length. There is no separate "expected count"
 * anywhere in this file that a filler card could round up to.
 *
 * RULE 2 — unmatched text stays on screen, dimmed.
 *
 * `buildSegments` below only ever REMOVES a span of the transcript from flow
 * when it has matched a real garment's verbatim `utterance`. Everything else
 * renders as an ordinary `muted` word and is never touched again — it does
 * not fade further, get swept away, or get replaced by anything. Once its
 * siblings have brightened to `ink` and departed, its being left at `muted`
 * IS the "stays on screen, dimmed" the directive asks for; there is no second
 * dimming step.
 *
 * INTERRUPTIBILITY
 *
 * See the long comment above `useEffect`'s scheduling block below for the
 * mechanism. In short: garments are paced across a target window so a normal
 * closet reads as a considered ~8–25s reveal, but the instant `isComplete`
 * arrives, whatever hasn't lifted yet is rushed through in under
 * `ACCELERATED_FINISH_MS` instead of being metered out for the rest of the
 * original window. `onSettled` only ever fires once every garment that
 * `isComplete` says exists has actually landed in the pile — it cannot fire
 * on a count that would later turn out to be a lie.
 */

export type PrecipitateProps = {
  /**
   * The full transcript, already known. `transcribe-intake` returns it in one
   * response (§11: no streaming transcript in wave 1), so this component
   * paces its OWN reveal of a fixed string rather than being fed words over
   * the wire.
   */
  transcript: string;
  /**
   * Parsed drafts, in the order they'll actually appear (this component
   * re-sorts by `ordinal` itself, so callers may pass them in arrival order).
   * Pass `[]` while `parse-closet` is in flight and the real rows once they
   * resolve — appending is fine, removing or renaming an id already passed is
   * not (see the note on `buildSegments`'s memoisation below).
   */
  garments: IntakeDraftRow[];
  /**
   * False while the parse is still in flight, true the instant the real
   * array is final. This is what tells Precipitate no more cards are coming
   * — it gates both the acceleration described above and `onSettled` itself.
   */
  isComplete: boolean;
  /**
   * Fires exactly once, when every drafted garment has landed in the pile
   * and `isComplete` is true. The caller advances to V-05 from here —
   * Precipitate never navigates itself.
   */
  onSettled: () => void;
  /**
   * A pacing HINT, not a promise — clamped to `MAX_DURATION_MS` regardless of
   * what is passed, and always subordinate to `isComplete`'s acceleration.
   * Defaults to an estimate from transcript length at a natural reading pace.
   */
  targetDurationMs?: number;
};

/** The directive's own ceiling: "It should take 8–25 seconds." */
const MAX_DURATION_MS = 25_000;
const MIN_AUTO_ESTIMATE_MS = 8_000;
/** ~11 words/sec — a natural reading pace for sizing the DEFAULT estimate. */
const MS_PER_WORD_ESTIMATE = 90;
/**
 * Once `isComplete` arrives, everything still waiting to lift is compressed
 * into this window instead of continuing to meter out across whatever was
 * left of the original budget. This is the literal mechanism behind "if the
 * parse returns in 6 seconds, it finishes early and gracefully."
 */
const ACCELERATED_FINISH_MS = 1_200;
const MIN_STEP_MS = 140;

function estimateDurationMs(transcript: string): number {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(Math.max(words * MS_PER_WORD_ESTIMATE, MIN_AUTO_ESTIMATE_MS), MAX_DURATION_MS);
}

type WordSegment = { type: 'word'; key: string; text: string };
type GarmentSegment = { type: 'garment'; key: string; draft: IntakeDraftRow };
type Segment = WordSegment | GarmentSegment;

/**
 * Turns the fixed transcript into an ordered run of words and garment
 * phrases, by locating each garment's verbatim `utterance` in the text and
 * treating everything between matches as ordinary words.
 *
 * Garments are walked in `ordinal` order and matched with a forward-only
 * cursor, so two identical utterances ("black t-shirt", "black t-shirt")
 * resolve to their correct, distinct occurrences rather than both claiming
 * the first one.
 *
 * NOTE ON STREAMING ARRIVAL: because this recomputes from scratch whenever
 * `garments` grows, a NEW garment whose utterance sits earlier in the
 * transcript than words already on screen will re-key the word run after it
 * — those words remount and re-fade-in rather than holding their exact
 * position. In the common case (the full drafts array arrives at once from
 * `parse-closet`), this never happens; it is a deliberately accepted, minor
 * cosmetic cost of not maintaining a second incremental diffing pass for a
 * path that is not the primary one.
 */
function buildSegments(transcript: string, garments: IntakeDraftRow[]): Segment[] {
  const ordered = [...garments].sort((a, b) => a.ordinal - b.ordinal);
  const segments: Segment[] = [];
  let cursor = 0;

  const pushWords = (text: string, fromIndex: number) => {
    text
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word, i) => segments.push({ type: 'word', key: `w-${fromIndex}-${i}`, text: word }));
  };

  for (const draft of ordered) {
    const idx = draft.utterance ? transcript.indexOf(draft.utterance, cursor) : -1;
    if (idx === -1) {
      // Defensive, not expected: `parse-closet` is contracted to return a
      // verbatim span for `utterance` (directive §7). If it ever hands back
      // something that doesn't literally appear in the transcript, the
      // garment still gets a card — it just has no plausible position to
      // lift FROM, so it's appended at the point the transcript has been
      // read up to. What must never happen is the card silently vanishing.
      segments.push({ type: 'garment', key: `g-${draft.id}`, draft });
      continue;
    }
    if (idx > cursor) pushWords(transcript.slice(cursor, idx), cursor);
    segments.push({ type: 'garment', key: `g-${draft.id}`, draft });
    cursor = idx + draft.utterance.length;
  }

  if (cursor < transcript.length) pushWords(transcript.slice(cursor), cursor);

  return segments;
}

/**
 * The spans that never became a garment, in reading order — what V-05's "N
 * things I didn't catch" disclosure needs. Exported so that screen computes
 * "unmatched" the exact same way this one decides what stays dimmed on
 * screen, rather than growing a second, possibly-disagreeing definition.
 */
export function unmatchedTranscriptSpans(transcript: string, garments: IntakeDraftRow[]): string[] {
  const ordered = [...garments].sort((a, b) => a.ordinal - b.ordinal);
  const spans: string[] = [];
  let cursor = 0;

  for (const draft of ordered) {
    const idx = draft.utterance ? transcript.indexOf(draft.utterance, cursor) : -1;
    if (idx === -1) continue;
    if (idx > cursor) {
      const span = transcript.slice(cursor, idx).trim();
      if (span) spans.push(span);
    }
    cursor = idx + draft.utterance.length;
  }

  const tail = transcript.slice(cursor).trim();
  if (tail) spans.push(tail);
  return spans;
}

const KNOWN_SLOTS = new Set<Slot>([
  'base_top',
  'mid_layer',
  'bottom',
  'dress',
  'outerwear',
  'footwear',
  'bag',
  'headwear',
  'accessory',
]);

/** `intake_drafts.slot` is a raw `text` column (§5.2: "must match the
 *  engine's Slot union", not enforced by a CHECK). Anything outside the
 *  union degrades to `accessory` rather than crashing the silhouette. */
function resolveSlot(raw: string): Slot {
  return (KNOWN_SLOTS.has(raw as Slot) ? raw : 'accessory') as Slot;
}

/** Small, deterministic per-card rotation from the draft's own id — stable
 *  across re-renders, unlike `Math.random()`, and what gives the pile its
 *  "loose" rather than "grid" read without any layout of its own. */
function jitterDeg(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 700) / 100 - 3.5; // -3.5°…3.5°
}

const AnimatedText = Animated.createAnimatedComponent(RNText);

export function Precipitate({
  transcript,
  garments,
  isComplete,
  onSettled,
  targetDurationMs,
}: PrecipitateProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // A stable signature rather than the raw array reference: react-query (and
  // plenty of ordinary parent re-renders) can hand back a new array instance
  // with identical rows, and re-deriving `segments` on every one of those
  // would remount every already-landed word/phrase token for no reason.
  const garmentsSignature = garments.map((g) => `${g.id}:${g.state}`).join(',');

  const segments = useMemo(
    () => buildSegments(transcript, garments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transcript, garmentsSignature],
  );

  /** Ids whose lift-off animation has been told to start. */
  const [armedIds, setArmedIds] = useState<Set<string>>(() => new Set());
  /** Ids that have finished lifting and are no longer rendered in the flow. */
  const [departedIds, setDepartedIds] = useState<Set<string>>(() => new Set());
  /** Ids in the pile, in the order they actually landed. */
  const [landedIds, setLandedIds] = useState<string[]>([]);

  // `null` until the scheduling effect below first runs — a static initial
  // value keeps this render pure; `Date.now()` itself is only ever called
  // from inside that effect, never during render.
  const startRef = useRef<number | null>(null);
  /** Every id that has ever been given a `setTimeout`, so a re-run of the
   *  scheduling effect below never double-schedules the same garment. */
  const scheduledRef = useRef<Set<string>>(new Set());
  const settledRef = useRef(false);

  const budget = Math.min(targetDurationMs ?? estimateDurationMs(transcript), MAX_DURATION_MS);

  /**
   * The pacing engine, and the whole of "interruptible" lives here.
   *
   * Every garment not yet scheduled gets a `setTimeout` that arms its
   * lift-off. While the parse is still running (`!isComplete`), those timers
   * are spread across whatever remains of `budget` — the considered, ~8–25s
   * reveal the directive describes. The moment `isComplete` flips true, the
   * window for anything still unscheduled collapses to
   * `ACCELERATED_FINISH_MS`: the animation stops pretending there is more
   * suspense to build and rushes to a graceful finish instead of holding the
   * user for the rest of a duration that was only ever a guess.
   *
   * Re-runs whenever `garments` grows or `isComplete` flips; `scheduledRef`
   * makes every re-run a no-op for ids it has already claimed, so a parent
   * that re-renders with a fresh array instance cannot schedule anything
   * twice.
   */
  useEffect(() => {
    if (startRef.current == null) startRef.current = Date.now();

    const pending = [...garments]
      .sort((a, b) => a.ordinal - b.ordinal)
      .filter((g) => !scheduledRef.current.has(g.id));
    if (pending.length === 0) return;

    const elapsed = Date.now() - startRef.current;
    const window = isComplete
      ? Math.min(ACCELERATED_FINISH_MS, Math.max(budget - elapsed, MIN_STEP_MS))
      : Math.max(budget - elapsed, pending.length * MIN_STEP_MS);
    const step = window / pending.length;

    const timers = pending.map((g, i) => {
      scheduledRef.current.add(g.id);
      return setTimeout(
        () => setArmedIds((prev) => new Set(prev).add(g.id)),
        Math.round(step * (i + 1)),
      );
    });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentsSignature, isComplete, budget]);

  const handleLanded = useCallback((id: string) => {
    setDepartedIds((prev) => new Set(prev).add(id));
    setLandedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  // Settle once, and only once every garment `isComplete` vouches for has
  // actually finished landing. Gating on `isComplete` — rather than "the
  // pile stopped growing for a moment" — is what stops this from firing on a
  // count that the parse might still revise upward a beat later.
  useEffect(() => {
    if (settledRef.current || !isComplete) return;
    if (garments.length === 0 || landedIds.length < garments.length) return;
    settledRef.current = true;
    onSettled();
  }, [isComplete, garments.length, landedIds.length, onSettled]);

  const visibleSegments = segments.filter((s) => s.type === 'word' || !departedIds.has(s.draft.id));

  return (
    <View style={styles.stage}>
      {/* The pile — upper third, per the directive. Exactly one card per
          landed id; nothing here is sized off `garments.length` in advance. */}
      <View style={styles.pileRegion}>
        <View style={styles.pileWrap}>
          {landedIds.map((id) => {
            const draft = garments.find((g) => g.id === id);
            // Can only be missing if a caller mutates `garments` to drop a
            // row after it has already landed — not a real path, but a
            // vanished card is worse than a skipped render.
            if (!draft) return null;
            return <PileCard key={id} draft={draft} reduceMotion={reduceMotion} theme={theme} />;
          })}
        </View>
      </View>

      {/* The transcript, thinning as its phrases depart. */}
      <View style={styles.transcriptRegion}>
        <View style={styles.wrapRow}>
          {visibleSegments.map((segment, index) =>
            segment.type === 'word' ? (
              <WordToken
                key={segment.key}
                text={segment.text}
                index={index}
                reduceMotion={reduceMotion}
                theme={theme}
              />
            ) : (
              <PhraseToken
                key={segment.key}
                draft={segment.draft}
                index={index}
                armed={armedIds.has(segment.draft.id)}
                reduceMotion={reduceMotion}
                theme={theme}
                onLanded={handleLanded}
              />
            ),
          )}
        </View>
      </View>
    </View>
  );
}

/** How far apart consecutive tokens fade in, capped so a long transcript
 *  still finishes its entrance quickly rather than trickling in for ages. */
const ENTRANCE_STAGGER_MS = 12;
const ENTRANCE_STAGGER_CAP_MS = 320;

function WordToken({
  text,
  index,
  reduceMotion,
  theme,
}: {
  text: string;
  index: number;
  reduceMotion: boolean;
  theme: ThemeColors;
}) {
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeIn.delay(Math.min(index * ENTRANCE_STAGGER_MS, ENTRANCE_STAGGER_CAP_MS)).duration(
              motion.duration.base,
            )
      }
      style={styles.tokenSpacing}>
      <RNText style={[styles.tokenText, { color: theme.muted }]}>{text}</RNText>
    </Animated.View>
  );
}

/** How far a lifting phrase travels before it's fully shrunk into the pile —
 *  a modest, LOCAL motion. The card itself, not this token, is what actually
 *  arrives in the pile (see the file-level comment on the two-layer choreo). */
const LIFT_UP = 46;
const LIFT_RIGHT = 32;
const LIFT_SCALE = 0.5;
/** The fraction of the lift over which the colour finishes brightening —
 *  the directive's "brightens... THEN translates", collapsed into one
 *  timeline rather than two sequential animations. */
const BRIGHTEN_FRACTION = 0.4;

function PhraseToken({
  draft,
  index,
  armed,
  reduceMotion,
  theme,
  onLanded,
}: {
  draft: IntakeDraftRow;
  index: number;
  armed: boolean;
  reduceMotion: boolean;
  theme: ThemeColors;
  onLanded: (id: string) => void;
}) {
  const progress = useSharedValue(0);
  // Same trade review-card.tsx makes for its swipe fly-off: Reduce Motion
  // does not cancel the lift (it is what makes the card land and the count
  // advance), it only collapses how long the motion takes.
  const duration = reduceMotion ? motion.duration.fast : motion.duration.slow;

  useEffect(() => {
    if (!armed) return;
    progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onLanded)(draft.id);
    });
    // `duration` only ever takes one of two fixed values for the lifetime of
    // this token (Reduce Motion doesn't flip mid-lift), so it's intentionally
    // left out of the effect's own re-trigger condition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  const wrapperStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.7, 1], [1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(p, [0, 1], [0, -LIFT_UP], Extrapolation.CLAMP) },
        { translateX: interpolate(p, [0, 1], [0, LIFT_RIGHT], Extrapolation.CLAMP) },
        { scale: interpolate(p, [0, 1], [1, LIFT_SCALE], Extrapolation.CLAMP) },
      ],
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, BRIGHTEN_FRACTION], [theme.muted, theme.ink]),
  }));

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeIn.delay(Math.min(index * ENTRANCE_STAGGER_MS, ENTRANCE_STAGGER_CAP_MS)).duration(
              motion.duration.base,
            )
      }
      style={[styles.tokenSpacing, wrapperStyle]}>
      <AnimatedText style={[styles.tokenText, textStyle]}>{draft.utterance}</AnimatedText>
    </Animated.View>
  );
}

const CARD_SIZE = 46;
/** Scaled down from the app's one contact shadow — `shadow.contact` is tuned
 *  for a full sheet; a 46px card wants a fraction of that blur and drop,
 *  the same move `closet-full-sheet.tsx`'s SHEET_SHADOW_SCALE makes in the
 *  other direction. */
const PILE_CARD_SHADOW_SCALE = 0.4;

function PileCard({
  draft,
  reduceMotion,
  theme,
}: {
  draft: IntakeDraftRow;
  reduceMotion: boolean;
  theme: ThemeColors;
}) {
  // Resolved here rather than read off `draft.colour_oklch`: that column is
  // written at commit time by `resolveDraftColours` (src/features/intake/
  // actions.ts) and is null on a fresh parse, which is exactly when this
  // component needs to draw something. Same lexicon, same term, so a card
  // drawn here and the same garment's card on V-06 never disagree.
  const hex = useMemo(() => resolveSpokenColour(draft.colour_term).hex, [draft.colour_term]);
  const rotation = useMemo(() => jitterDeg(draft.id), [draft.id]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.base)}
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.base)}
      style={[
        styles.pileCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.rule,
          transform: [{ rotate: `${rotation}deg` }],
          shadowColor: shadow.contact.color,
          shadowOpacity: 1,
          shadowRadius: shadow.contact.blur * PILE_CARD_SHADOW_SCALE,
          shadowOffset: {
            width: shadow.contact.dx,
            height: shadow.contact.dy * PILE_CARD_SHADOW_SCALE,
          },
        },
      ]}>
      <Silhouette
        slot={resolveSlot(draft.slot)}
        colour={hex}
        pattern={draft.pattern}
        size={CARD_SIZE * 0.6}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  pileRegion: {
    // "Upper third" per the directive — a touch over a third in practice so a
    // dozen-plus cards can wrap to a second row without crowding the
    // transcript below.
    flexBasis: '36%',
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
  },
  pileWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  transcriptRegion: {
    flex: 1,
    paddingHorizontal: GUTTER,
    paddingTop: 4,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  tokenSpacing: {
    marginRight: 5,
    marginBottom: 4,
  },
  tokenText: {
    fontFamily: 'HelveticaNeue',
    fontSize: 15,
    lineHeight: 22,
  },
  pileCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
