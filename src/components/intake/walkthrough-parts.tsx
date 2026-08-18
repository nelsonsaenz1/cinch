import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { CARD, CHIP, TYPE } from '@/features/intake/walkthrough-spec';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Redesign 24's drawing hand.
 *
 * Every part here is presentational and decides nothing. Which phase the
 * walkthrough is in, whether a take is capped, what a failure is called, which
 * draft is current — all of that stays in `walkthrough/index.tsx`,
 * `use-recorder.ts`, `use-transcription.ts` and `procession.ts`, which are pure
 * or already tested. The routes hand these props and they paint.
 *
 * A component file rather than blocks inside the routes, for the reason
 * `capture-parts.tsx`'s own header gives: the dev fixtures have to draw THE
 * SAME chrome. A fixture cannot mount a recorder in a simulator — there is no
 * microphone, and a live meter produces different pixels every frame — so a
 * posed copy inside a fixture would be a second implementation of the page,
 * free to drift from the one that ships. One set of parts, two call sites, no
 * drift.
 *
 * `className` carries layout and palette grounds. Anything on an
 * `Animated.View` is an inline style: NativeWind's interop is registered for
 * the React Native primitives only, so a class on a Reanimated component is
 * silently dropped — see `use-press-feedback.ts`.
 */

// ---------------------------------------------------------------------------
// The chrome every frame carries
// ---------------------------------------------------------------------------

/**
 * The top row — a named exit on one side, the phase's state word on the other.
 *
 * TWO ARRANGEMENTS, BOTH DRAWN. When the frame has a state word to say
 * ("RECORDING", "PAUSED", "3 OF 14") the exit sits left and the word right;
 * when it has none, the exit sits alone on the right. That is not a stylistic
 * choice, it is the artifact's own two layouts, and collapsing them into one
 * would move the exit under the thumb on exactly the frames somebody is
 * mid-decision on.
 *
 * The state word is `eyebrow` — uppercase, tracked, muted — because that is
 * what it is: a colophon for the phase, never a status pill and never a colour.
 * The waveform is decorative, so this word and the timer beside it are the only
 * things carrying recording state to somebody who cannot see the bars.
 */
export function WalkthroughChrome({
  exit,
  state,
}: {
  /** The named way out. Omitted entirely on phases that have none. */
  exit?: { label: string; onPress: () => void; hint?: string };
  /** "Recording", "Paused", "3 of 14". Rendered uppercase by the variant. */
  state?: string;
}) {
  const theme = useTheme();

  const exitNode = exit ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exit.label}
      accessibilityHint={exit.hint}
      onPress={exit.onPress}
      hitSlop={12}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
      className="active:opacity-60">
      {/* The frame's one oxblood word up here. It is a real destination, not a
          dismissal, so it is named rather than drawn as a glyph. */}
      <Text variant="body" style={{ fontSize: 17, color: theme.accent }}>
        {exit.label}
      </Text>
    </Pressable>
  ) : null;

  const stateNode = state ? (
    <Text
      variant="eyebrow"
      accessibilityLabel={state}
      style={{ fontVariant: ['tabular-nums'] }}>
      {state}
    </Text>
  ) : null;

  return (
    <View
      className="flex-row items-center justify-between px-gutter"
      style={{ minHeight: 52 }}>
      {/* An empty leading box rather than `justify-end`, so the state word lands
          in the same pixel column whether or not the phase has an exit. */}
      {exitNode ?? <View />}
      {stateNode ?? <View />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// V-01
// ---------------------------------------------------------------------------

/**
 * The three spoken examples, as the body of the page.
 *
 * THE SPECIMEN IS THE FRAME. They used to be three small italic lines under a
 * paragraph, read as leftovers; redesign 24 pushes them to serif italic at
 * reading-plus scale, and `spoken-examples-hero` is the same page with nothing
 * else changed. They are imperfect human phrases on purpose — nobody speaks in
 * taxonomy — which is also why they are still PROSE and not chips: a chip reads
 * as a controlled vocabulary, the exact opposite of what they teach.
 *
 * `exampleMin`, never a clamp. `largest-accessibility-text` shows them GROWING
 * and the block scrolling; a page that shrinks its own lesson to fit is a page
 * that teaches nothing at AX sizes.
 */
export function SpokenExamples({ examples }: { examples: readonly string[] }) {
  return (
    <View style={{ gap: 12 }}>
      {examples.map((example) => (
        <Text
          key={example}
          variant="title"
          className="italic"
          style={{
            fontSize: TYPE.exampleMin,
            lineHeight: Math.round(TYPE.exampleMin * TYPE.exampleLeading),
          }}>
          {example}
        </Text>
      ))}
    </View>
  );
}

/**
 * The consent sentence, immediately above the record action.
 *
 * VERBATIM AND WHOLE. The string is `WALKTHROUGH_INVITATION.consent` and
 * nothing here shortens, splits, wraps or re-punctuates it — this component
 * takes it as one prop and prints it as one node, which is what makes that
 * checkable. There is exactly one copy of it in the product.
 *
 * `accessible` on the wrapper is the other half of the contract, and the reason
 * this is a component at all: `legal-sentence-focus` draws VoiceOver focus
 * sitting on the sentence as its own node, immediately before Start recording,
 * so it cannot be swept past on the way to the button. Left as loose `<Text>`
 * beside a button it is merely nearby; declared accessible it is a stop.
 */
export function ConsentLine({ text }: { text: string }) {
  return (
    <View accessible accessibilityRole="text" style={{ marginBottom: 12 }}>
      <Text variant="note" style={{ fontSize: 13, lineHeight: 20 }}>
        {text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The notice bands
// ---------------------------------------------------------------------------

/**
 * The band this group says everything additive in.
 *
 * TWO TONES AND NO MORE. `tray` is the neutral one — the silence nudge, the
 * still-working notice, the drop confirmation — and `blush` is the one that
 * wants a beat of attention: the twelve-minute cap, the ambiguous count, the
 * ceiling's arithmetic. Neither is red and neither is a toast. They are
 * ADDITIVE: they arrive under the layout that was already there rather than
 * replacing it, so a slow response never looks like a different failure and a
 * dropped card never looks like a deleted one.
 *
 * Not `components/ui/notice-band.tsx`, which is group 4's shape: that one leads
 * with a tracked uppercase CAUSE and draws its actions as secondary buttons
 * inside the tray. This group's frames lead with a plain title and carry at
 * most one inline word of action ("Undo"). Two shapes, honestly different,
 * rather than one grown a tone prop and a lead-slot prop to serve both.
 */
export function WalkthroughBand({
  tone = 'tray',
  title,
  body,
  action,
  alert = false,
  children,
  style,
}: {
  tone?: 'tray' | 'blush';
  /** Omitted on the bands that are one sentence — the silence nudge is one. */
  title?: string;
  body: string;
  /** The one inline word out. "Undo", and nothing longer. */
  action?: { label: string; onPress: () => void; hint?: string };
  /**
   * `alert` for a band that reports something that already happened, `polite`
   * for one that merely arrived. The cap and the drop are the former; the
   * nudge and the still-working notice are the latter, and announcing those as
   * alerts is how a screen somebody sits in front of for half a minute starts
   * chattering.
   */
  alert?: boolean;
  /** The stepper, on the one band that carries a control rather than a word. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole={alert ? 'alert' : undefined}
      accessibilityLiveRegion={alert ? 'assertive' : 'polite'}
      className={tone === 'blush' ? 'bg-blush' : 'bg-tray'}
      style={[{ borderRadius: CARD.radius, padding: CARD.padding }, style]}>
      {title ? (
        <Text variant="heading" style={{ fontSize: 16 }}>
          {title}
        </Text>
      ) : null}
      <Text
        variant="note"
        style={{ fontSize: 15, lineHeight: 23, marginTop: title ? 4 : 0 }}>
        {body}
      </Text>
      {children}
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint={action.hint}
          onPress={action.onPress}
          hitSlop={10}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', marginTop: 2 }}
          className="active:opacity-60">
          <Text variant="body" style={{ fontSize: 16, color: theme.accent }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// V-04
// ---------------------------------------------------------------------------

/**
 * The skeletons that foreshadow the procession cards.
 *
 * They are the card's geometry at a row's height — plate on the left, two lines
 * beside it — so nothing shifts at the swap when real cards arrive. THEY DO NOT
 * SHIMMER, deliberately: a looping animation on a screen somebody may sit in
 * front of for thirty seconds is movement without information, and it makes
 * this frame impossible to photograph twice. No bar, no percentage, no spinner
 * either — the queue cannot promise a rate, and a spinner is a claim that
 * something is being measured.
 */
export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <View
      style={{ gap: 12 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => i).map((i) => (
        <View
          key={i}
          className="flex-row items-center bg-tray"
          style={{ borderRadius: CARD.radius, padding: 18, gap: 20 }}>
          <View className="bg-sand" style={{ width: 68, height: 88, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 10 }}>
            <View className="bg-sand" style={{ height: 12, borderRadius: 6 }} />
            <View
              className="bg-sand"
              style={{ height: 12, borderRadius: 6, width: '58%' }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The procession card's face
// ---------------------------------------------------------------------------

/**
 * The parsed facts, and the owner's own words beneath them.
 *
 * ── WHY THE UTTERANCE MOVED BELOW THE NAME ─────────────────────────────────
 *
 * It used to sit ABOVE the name, under a "You said" eyebrow and a rule, and the
 * argument for that ordering was a good one: a wrong parse read against what
 * was actually said is a mishearing, and a wrong parse read alone is a
 * fabrication. Redesign 24 keeps the whole of that argument and changes only
 * where the sentence lands — "the parsed facts, and the owner's own words
 * quoted beneath as the source of truth". The utterance is still on the card,
 * still verbatim, still in the reader's own quotation marks, and still the
 * thing the two decisions are taken against. What it stops being is the card's
 * headline, which is what let a three-word phrase out-shout the name the person
 * is actually being asked to judge.
 *
 * ── THE ONE PLACE THE ARTIFACT IS OVERRULED ────────────────────────────────
 *
 * Its measurements line asks for the quoted utterance "italic 17 in clay".
 * Clay is `accentWarm` (#B08A76), and clay-on-tray is roughly 2.4:1 — an AA
 * failure on the one line of this card whose whole job is to be READ against
 * the guess above it. The constitution's refusal is not negotiable and
 * `constitution.test.ts` enforces it by name, so the utterance is set in
 * `muted` (#6B665C, 5.46:1). Nothing else about the treatment moves: it is
 * still italic, still serif, still at 17, still one step quieter than the
 * facts. The distinction the artifact was drawing is carried by the cut and
 * the quotation marks, which survive the colour change intact — and clay stays
 * where it is legible, in the waveform's bars, where it is decorative.
 *
 * ── THE META LINE IS THE CORRECTION AFFORDANCE ─────────────────────────────
 *
 * "Tops · White · Linen" is drawn as one quiet sentence, exactly as the frame
 * draws it, and each fact in it is its own press target that opens the
 * correction sheet FOCUSED ON THAT FIELD. The chips this replaces carried that
 * focus and the frame does not draw chips; dropping to a plain line without
 * keeping the per-field entry would have been a silent loss of an affordance
 * for a visual change. The separators are not pressable, which is why they are
 * siblings of the targets rather than inside them.
 */
export function CardFace({
  name,
  facts,
  utterance,
  hedge = false,
  hedgeNote,
  plate,
  onCorrectField,
}: {
  name: string;
  /** The parsed facts, in reading order, each with the field it corrects. */
  facts: readonly { field: string; label: string }[];
  /** The verbatim phrase. Quoted here and never rewritten. */
  utterance: string;
  /** Below the confidence floor: the card admits it was not sure. */
  hedge?: boolean;
  hedgeNote?: string;
  /** The garment plate. Optional — a card without one simply has no well. */
  plate?: React.ReactNode;
  onCorrectField: (field: string) => void;
}) {
  const theme = useTheme();

  return (
    <View className="bg-tray" style={{ borderRadius: CARD.radius, overflow: 'hidden' }}>
      {plate ? (
        <View
          className="items-center justify-center bg-canvas"
          style={{
            height: CARD.plate,
            margin: 14,
            marginBottom: 0,
            borderRadius: CARD.radius - 4,
          }}>
          {plate}
        </View>
      ) : null}

      <View style={{ padding: 20 }}>
        <Text variant="display" trim accessibilityRole="header">
          {name}
        </Text>

        <View
          className="flex-row flex-wrap items-center"
          style={{ marginTop: 12 }}
          accessibilityLabel={facts.map((f) => f.label).join(', ')}>
          {facts.map((fact, i) => (
            <View key={fact.field} className="flex-row items-center">
              {i > 0 ? (
                <Text variant="note" style={{ fontSize: 16, paddingHorizontal: 6 }}>
                  ·
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fact.label}
                accessibilityHint={`Opens editing for ${fact.field}`}
                onPress={() => onCorrectField(fact.field)}
                hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
                className="active:opacity-60">
                <Text
                  variant="note"
                  style={{ fontSize: 16, color: hedge ? theme.muted : theme.ink }}>
                  {fact.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {hedge && hedgeNote ? (
          <Text variant="note" style={{ fontSize: 14, marginTop: 8 }}>
            {hedgeNote}
          </Text>
        ) : null}

        <Text
          className="italic"
          variant="title"
          style={{
            fontSize: TYPE.utterance,
            lineHeight: Math.round(TYPE.utterance * 1.45),
            // `muted`, not clay. See the note above the component.
            color: theme.muted,
            marginTop: 10,
          }}>
          {`You said “${utterance}”`}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The chip, for the correction sheet and the ceiling picker
// ---------------------------------------------------------------------------

/**
 * The warm chip — oxblood filled when chosen, tray when not.
 *
 * Filled/unfilled rather than a border change, because `review-fix-sheet` draws
 * the chosen category and the chosen colour as solid oxblood against tray
 * peers, and because a selected state carried by a hairline is the state
 * somebody misses in a shop window.
 */
export function WalkthroughChip({
  label,
  selected,
  onPress,
  accessibilityHint,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const press = usePressFeedback();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}>
      <Animated.View
        style={[
          {
            minHeight: MIN_TAP_TARGET,
            justifyContent: 'center',
            borderRadius: CHIP.radius,
            paddingVertical: CHIP.paddingVertical,
            paddingHorizontal: CHIP.paddingHorizontal,
            backgroundColor: selected ? theme.accent : theme.tray,
          },
          press.style,
        ]}>
        {/* Inline colour, never a second `text-*` class — two size or colour
            utilities on one element race in the generated stylesheet. */}
        <Text variant="body" style={{ color: selected ? theme.canvas : theme.ink }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
