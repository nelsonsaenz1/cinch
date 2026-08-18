import { SymbolView } from 'expo-symbols';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GarmentImage } from '@/components/media/garment-image';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import { gapLabel, type Gain, type Tally } from '@/features/closet/gap-feed';
import {
  ABSENCE,
  CARD,
  GAP_FEED_COPY,
  TILE,
  TYPE,
  absenceNoun,
} from '@/features/closet/gap-feed-spec';
import type { CountedKind } from '@/features/closet/outfit-count';
import type { GapPiece } from '@/features/closet/use-gap-feed';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { gainSentence } from './gap-prose';

/**
 * The Gap Feed, drawn. Redesign 26.
 *
 * ── THE IMAGERY LEADS, AND IT IS EVIDENCE RATHER THAN DECORATION ───────────
 *
 * The brief is "gap cards led by the outfit-you-can't-make imagery". Every
 * well in `GapImagery` is a garment the wardrobe actually holds, sampled by
 * `pairablePieces` (`features/closet/gap-feed.ts`), and the last well is the
 * marked absence — a dashed blush box with a noun in it. NOTHING on this
 * screen has ever drawn a picture of a garment nobody owns, and the fact that
 * the absence is now the visual subject of the card makes that rule more
 * load-bearing, not less: the moment a catalogue photograph appeared in that
 * well, "what your closet is missing" would become an advertisement with the
 * arithmetic as a caption.
 *
 * ── WHY THE CARD PRINTS ONE SENTENCE AND NOT TWO ───────────────────────────
 *
 * The shipped card printed `gapProse` — the evidence sentence ("You own 3 tops
 * that work over bottoms and only 2 bottoms") followed by `gainSentence` (the
 * arithmetic). The redesign's rule is "one headline, at most one supporting
 * line", and the honest way to obey it here is to drop the EVIDENCE sentence
 * from the feed, because the imagery row above it now says the same thing in
 * the medium the brief asked for: those are the pieces waiting, and that is the
 * hole. `gainSentence` stays, unabridged, because it is the half audit 85 is
 * about — the unit is named, the unit is glossed on the leading card, and both
 * endpoints are printed. A card that shortened THAT would be back to `+7`.
 *
 * `gapProse` is untouched and still exported; the gap detail screen prints the
 * evidence sentence in full, and Today's own gap card is a different lane's
 * caller that this build does not reach into.
 *
 * ── NO WEIGHT, ANYWHERE ────────────────────────────────────────────────────
 *
 * The artifact sets merchant titles, actions and notice headlines in bold. The
 * app has two cuts and neither is Medium (TY-01 / TY-02, `components/ui/
 * text.tsx`, pinned by `tests/type-weight.test.ts`), so every one of those
 * emphases is carried here by size, colour and case instead — an ink line over
 * a muted one, a serif over a sans, an uppercase tracked eyebrow over running
 * text. Reported as a deviation rather than smuggled in as a `fontWeight`.
 */

/** Whether Dynamic Type has reached the size the artifact's AX frames draw. */
export function useAx(): boolean {
  const { fontScale } = useWindowDimensions();
  return fontScale >= AX_STACK_SCALE;
}

// ---------------------------------------------------------------------------
// The wells
// ---------------------------------------------------------------------------

/**
 * One owned garment, or the designed cell that stands in for its photograph.
 *
 * `GarmentImage` collapses all four ways a picture can be missing — no path, a
 * dead signature, a failed fetch, an undecodable body — onto one fallback, so
 * the reader sees one thing when there is no photograph because it is one
 * fact. The fallback is the word, never a blank well: the frame for this state
 * draws "NO PHOTO" in the sand, and an empty rectangle would read as an image
 * still loading forever.
 */
export function OwnedWell({
  piece,
  height,
  width,
}: {
  piece: GapPiece;
  height: number;
  width?: number;
}) {
  const theme = useTheme();

  return (
    <View
      className="overflow-hidden bg-sand"
      style={{
        width: width ?? TILE.size,
        height,
        borderRadius: TILE.radius,
        flex: width === undefined ? 1 : 0,
      }}>
      <GarmentImage
        uri={piece.imageUri}
        contentFit="cover"
        style={{ flex: 1 }}
        fallback={
          <Text
            variant="eyebrow"
            style={{ fontSize: 11, letterSpacing: 0.8, color: theme.muted, textAlign: 'center' }}>
            {GAP_FEED_COPY.noPhoto}
          </Text>
        }
      />
    </View>
  );
}

/**
 * The marked absence — a plus over a noun, in a dashed blush well.
 *
 * `accent` on `blush`, not `accentWarm`. The artifact draws this noun in the
 * clay (#B08A76), which is 2.6:1 on the blush ground and fails AA outright;
 * the oxblood is ~8:1 and is the colour the shipped detail screen already used
 * for exactly this well. The contrast law outranks the swatch, and the well
 * still reads as warm because the GROUND is the clay-derived blush.
 */
export function AbsenceWell({
  noun,
  height,
  width,
}: {
  noun: string;
  height: number;
  width?: number;
}) {
  const theme = useTheme();

  return (
    <View
      className="items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: width ?? TILE.size,
        height,
        flex: width === undefined ? 1 : 0,
        borderRadius: TILE.radius,
        borderWidth: ABSENCE.borderWidth,
        borderStyle: 'dashed',
        borderColor: theme.blushRule,
        backgroundColor: theme.blush,
      }}>
      <Text
        variant="body"
        style={{ fontSize: ABSENCE.plusSize, lineHeight: ABSENCE.plusSize + 4, color: theme.accent }}>
        +
      </Text>
      <Text
        variant="eyebrow"
        className="mt-1 px-1"
        style={{
          fontSize: ABSENCE.nounSize,
          letterSpacing: ABSENCE.nounTracking,
          color: theme.accent,
          textAlign: 'center',
        }}>
        {noun}
      </Text>
    </View>
  );
}

/**
 * The outfit you can't make: owned wells, then the absence, always last.
 *
 * At most two owned wells beside the absence — three equal wells across the
 * card is the frame's composition, and a row that grew to four would turn one
 * missing garment into a gallery. A closet holding fewer than two pairable
 * pieces draws fewer wells and the row simply narrows; it never pads itself.
 *
 * Hidden from VoiceOver as a unit. The card's own label already says which
 * pieces are waiting and what is missing, and a screen reader that stopped on
 * three unlabelled boxes between the eyebrow and the headline would be reading
 * the composition rather than the fact.
 */
export function GapImagery({
  kind,
  pieces,
  height,
}: {
  kind: CountedKind;
  pieces: readonly GapPiece[];
  height: number;
}) {
  const shown = pieces.slice(0, 2);

  return (
    <View
      className="flex-row"
      style={{ gap: TILE.gap }}
      accessibilityElementsHidden
      importantForAccessibility="no">
      {shown.map((piece) => (
        <OwnedWell key={piece.id} piece={piece} height={height} />
      ))}
      <AbsenceWell noun={absenceNoun(kind)} height={height} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The cards
// ---------------------------------------------------------------------------

/**
 * The leading gap — imagery, headline, one line, and a footer slot.
 *
 * The footer is a SLOT rather than a variant because the artifact draws three
 * different things in the same place at the same inset: the merchant tray, the
 * active-limit notice, and nothing at all. A card that took `products` and
 * `capacity` would be a card that knows about commerce, which is the edge
 * `tests/commerce-isolation.test.ts` exists to keep off the ranking side.
 *
 * The pressable region covers the imagery and the prose but NOT the footer:
 * the footer holds its own controls, and a Pressable inside a Pressable is
 * resolved by React Native swallowing one of them.
 */
export function LeadGapCard({
  eyebrow,
  gain,
  tally,
  pieces,
  gloss = false,
  ax: axOverride,
  onPress,
  footer,
}: {
  eyebrow: string;
  gain: Gain;
  tally: Tally;
  pieces: readonly GapPiece[];
  /** Define "outfit core" inline. The feed's first card does; the others don't. */
  gloss?: boolean;
  /** Fixture override for the largest-Dynamic-Type composition. */
  ax?: boolean;
  onPress?: () => void;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const systemAx = useAx();
  const ax = axOverride ?? systemAx;
  const press = usePressFeedback(onPress !== undefined);

  const label = gapLabel(tally, gain.kind);
  const sentence = gainSentence(tally, gain, { gloss });

  const body = (
    <Animated.View style={onPress ? press.style : undefined}>
      <View style={{ padding: CARD.padding }}>
        <Text
          variant="eyebrow"
          className="mb-3"
          style={{
            fontSize: ax ? TYPE.eyebrowAx : TYPE.eyebrow,
            letterSpacing: TYPE.eyebrowTracking,
            color: theme.accent,
          }}>
          {eyebrow}
        </Text>

        <GapImagery kind={gain.kind} pieces={pieces} height={ax ? TILE.axHeight : TILE.height} />

        {/* No `mt-*` on a trimmed serif Text — it cancels against the trim. The
            space is spent as padding on the row above instead. */}
        <View style={{ height: 16 }} />
        <Text
          variant="title"
          trim
          style={{
            fontSize: ax ? TYPE.headlineAx : TYPE.headline,
            lineHeight: ax ? TYPE.headlineAx + 3 : TYPE.headlineLineHeight,
          }}>
          {label}
        </Text>
        <Text
          variant="body"
          className="mt-2"
          style={{
            color: theme.muted,
            fontSize: ax ? TYPE.supportingAx : TYPE.supporting,
            lineHeight: ax ? TYPE.supportingAxLineHeight : TYPE.supportingLineHeight,
          }}>
          {sentence}
        </Text>
      </View>
    </Animated.View>
  );

  return (
    <View className="overflow-hidden bg-tray" style={{ borderRadius: CARD.radius }}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${eyebrow}. ${label}. ${sentence}`}
          accessibilityHint="Opens a closer look at this gap">
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${eyebrow}. ${label}. ${sentence}`}>{body}</View>
      )}

      {footer}
    </View>
  );
}

/**
 * A runner-up gap — the same card at a lower volume.
 *
 * No imagery and no tray. The frames give the second and third gaps a compact
 * row with the rank, the label, one line and a chevron, which is the wave's
 * "less text" and its image-forward rule pulling in the same direction: three
 * full cards of garment wells would make the feed a catalogue of absences and
 * flatten the one gap that actually matters most.
 */
export function CompactGapRow({
  eyebrow,
  gain,
  tally,
  ax: axOverride,
  onPress,
}: {
  eyebrow: string;
  gain: Gain;
  tally: Tally;
  ax?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const systemAx = useAx();
  const ax = axOverride ?? systemAx;
  const press = usePressFeedback();

  const label = gapLabel(tally, gain.kind);
  const sentence = gainSentence(tally, gain);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${label}. ${sentence}`}
      accessibilityHint="Opens a closer look at this gap">
      <Animated.View
        style={[
          press.style,
          {
            borderRadius: CARD.radius,
            backgroundColor: theme.tray,
            padding: CARD.padding,
            minHeight: MIN_TAP_TARGET,
          },
        ]}>
        <Text
          variant="eyebrow"
          style={{
            fontSize: ax ? TYPE.eyebrowAx : TYPE.eyebrow,
            letterSpacing: TYPE.eyebrowTracking,
            color: theme.accent,
          }}>
          {eyebrow}
        </Text>

        <View className="mt-2 flex-row items-center" style={{ gap: 12 }}>
          <View className="flex-1">
            <Text
              variant="title"
              trim
              style={{
                fontSize: ax ? TYPE.headlineAx : TYPE.compactHeadline,
                lineHeight: ax ? TYPE.headlineAx + 3 : TYPE.compactHeadlineLineHeight,
              }}>
              {label}
            </Text>
          </View>
          {/* Decorative: the row is already a button and announces itself. */}
          <SymbolView
            name="chevron.right"
            size={ax ? 22 : 18}
            tintColor={theme.muted}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>

        <Text
          variant="body"
          className="mt-1.5"
          style={{
            color: theme.muted,
            fontSize: ax ? TYPE.supportingAx : 15,
            lineHeight: ax ? TYPE.supportingAxLineHeight : 22,
          }}>
          {sentence}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The states with no gap in them
// ---------------------------------------------------------------------------

/**
 * The feed while the wardrobe is still being read.
 *
 * Two card-shaped skeletons in the real geometry — a card's radius, a card's
 * padding, three wells across and two lines under them — so the content
 * arrives into the shape it was already occupying. Never an `ActivityIndicator`
 * on this screen: a spinner is a stall, and this is a page whose whole promise
 * is that it already knows the answer from data it holds.
 */
export function GapFeedSkeleton() {
  return (
    <View style={{ gap: CARD.gap }} accessibilityElementsHidden importantForAccessibility="no">
      {[0, 1].map((card) => (
        <View
          key={card}
          className="bg-tray"
          style={{ borderRadius: CARD.radius, padding: CARD.padding }}>
          <Skeleton
            className="rounded-full"
            style={{ width: 108, height: 11 }}
            delay={card * 120}
          />
          <View className="mt-3 flex-row" style={{ gap: TILE.gap }}>
            {[0, 1, 2].map((well) => (
              <Skeleton
                key={well}
                style={{ flex: 1, height: TILE.height, borderRadius: TILE.radius }}
                delay={card * 120 + well * 60}
              />
            ))}
          </View>
          <Skeleton
            className="mt-4 rounded-full"
            style={{ width: '62%', height: 20 }}
            delay={card * 120 + 180}
          />
          <Skeleton
            className="mt-2 rounded-full"
            style={{ width: '86%', height: 13 }}
            delay={card * 120 + 240}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * The wardrobe read failed.
 *
 * A blush panel, not the shared `ErrorState`'s centred column: the frame keeps
 * the masthead in place and puts the failure where the first card would be,
 * which is the composition that says "this page still knows what it is, it
 * just could not read your closet today".
 *
 * The body is oxblood rather than muted — `refusal` tone, the same grammar
 * `storage-spec.ts` gives its blocked states — and it leads with what did NOT
 * happen, because this is the screen somebody opens to look at their own
 * clothes.
 */
export function GapFeedStop({ retrying }: { retrying: boolean }) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${GAP_FEED_COPY.readError.title}. ${GAP_FEED_COPY.readError.body}`}
      style={{
        borderRadius: CARD.radius,
        backgroundColor: theme.blush,
        paddingHorizontal: CARD.padding,
        paddingVertical: CARD.padding,
      }}>
      <Text variant="body" style={{ fontSize: 17 }}>
        {GAP_FEED_COPY.readError.title}
      </Text>
      <Text variant="body" className="mt-1.5" style={{ color: theme.accent, lineHeight: 22 }}>
        {retrying ? GAP_FEED_COPY.readError.retrying : GAP_FEED_COPY.readError.body}
      </Text>
    </View>
  );
}

/**
 * A closet too small for a gap worth naming.
 *
 * The absence well sits in the MIDDLE here rather than last, because there is
 * no particular garment missing — the row is not one outfit you cannot make,
 * it is the whole wardrobe being too short to have an opinion about. The frame
 * draws it exactly that way, and the difference in position is the difference
 * in claim.
 */
export function GapFeedEmpty({ pieces }: { pieces: readonly GapPiece[] }) {
  const theme = useTheme();
  const ax = useAx();
  const height = ax ? TILE.axHeight : TILE.height;
  const shown = pieces.slice(0, 2);

  return (
    <View>
      <View
        className="flex-row"
        style={{ gap: TILE.gap }}
        accessibilityElementsHidden
        importantForAccessibility="no">
        {shown[0] ? <OwnedWell piece={shown[0]} height={height} /> : null}
        <AbsenceWell noun={GAP_FEED_COPY.empty.absence} height={height} />
        {shown[1] ? <OwnedWell piece={shown[1]} height={height} /> : null}
      </View>
      <Text
        variant="body"
        className="mt-4"
        style={{
          color: theme.muted,
          fontSize: ax ? TYPE.supportingAx : TYPE.supporting,
          lineHeight: ax ? TYPE.supportingAxLineHeight : TYPE.supportingLineHeight,
        }}>
        {GAP_FEED_COPY.empty.body(pieces.length)}
      </Text>
    </View>
  );
}

/**
 * The AX affordance — at the largest type only one card fits a viewport, so the
 * fact that there are more is stated rather than left to be discovered.
 *
 * Drawn only when there ARE more, and it counts them: a hint that promised a
 * third gap over a two-gap feed would be the same small lie the masthead's own
 * sentence exists to avoid.
 */
export function ScrollHint({ remaining }: { remaining: number }) {
  const theme = useTheme();
  if (remaining <= 0) return null;

  return (
    <Text variant="body" style={{ color: theme.muted, fontSize: 17 }}>
      {GAP_FEED_COPY.scrollHint(remaining)}
    </Text>
  );
}

/** The line under a dominant gap, naming what the runner-up would really buy. */
export function DominantFootnote({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Text variant="caption" style={{ color: theme.muted, lineHeight: 19 }}>
      {GAP_FEED_COPY.nothingElseComesClose(label)}
    </Text>
  );
}
