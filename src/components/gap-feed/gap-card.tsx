import { Image } from 'expo-image';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { gapLabel, nounWithArticle, type Gain, type Tally } from '@/features/closet/gap-feed';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import type { GapPiece } from '@/features/closet/use-gap-feed';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useTheme } from '@/theme/tokens';

import { gapProse } from './gap-prose';

/**
 * One computed gap — GF-01's card body, GF-02's card with a merchant tray
 * footer, GF-04's card with the active-limit tray footer, GF-02 / AX's grown
 * form. One object in four states, which is why the footer is a slot rather
 * than four variants of a card.
 *
 * ── WHAT THIS CARD NO LONGER DRAWS ─────────────────────────────────────────
 *
 * · THE BARE DELTA. `+7` in 26pt oxblood is gone. Audit 85: a delta without
 *   its base is not a fact a person can check, so the figure became a sentence
 *   (`gap-prose.ts`) that names the unit, defines it and prints both endpoints.
 *   The accent came off with it — the gain was never a call to action, and
 *   spending oxblood on a number was spending it on nothing.
 *
 * · "ADD ANYWAY →". Correction 20. At an active limit the piece cannot be
 *   created until a slot is freed — `enforce_item_limit()` refuses the insert
 *   (migration 20260808190100) — so an action promising otherwise drew a state
 *   the app cannot enter. The standing refusal is "never a dead control"; this
 *   was one, and it is deleted rather than disabled. The two honest recoveries
 *   live in the footer the caller passes.
 *
 * · THE OXBLOOD COLOPHON. "CLOSET FULL · 10 OF 10" in `faint` monospace failed
 *   AA as type and said less than the tray footer now says in words.
 *
 * ── THE FOOTER SLOT ────────────────────────────────────────────────────────
 *
 * The atlas draws the merchant block as "a tray footer inside the same card",
 * and GF-04's limit block in exactly the same place and the same tray fill. So
 * the card is a `View` that clips, its explanation is one pressable region and
 * the footer is another — never a Pressable inside a Pressable, which React
 * Native resolves by swallowing one of them.
 *
 * ── VOICEOVER ──────────────────────────────────────────────────────────────
 *
 * The explanation region carries the whole explanation in one label, so a gap
 * card announces why it exists BEFORE any merchant row underneath it, and the
 * merchant rows announce themselves individually after it. Nothing here
 * announces a block-level disclosure marker, because no such marker exists.
 */
export type GapCardProps = {
  /** "Biggest gap", "Second gap" — the card's rank, in words. */
  eyebrow: string;
  gain: Gain;
  tally: Tally;
  /** Real owned pieces waiting for a partner. Omitted when the card's evidence isn't garments. */
  pairings?: { shown: GapPiece[]; more: number };
  /** Define "outfit core" inline. The feed's first card does; the others don't. */
  gloss?: boolean;
  /** Fixture override for the largest-Dynamic-Type composition. */
  stacked?: boolean;
  /** Opens the gap detail. Omitted where there is nothing further to open. */
  onPress?: () => void;
  /** The tray footer — merchant rows (GF-02) or the active-limit block (GF-04). */
  footer?: React.ReactNode;
};

export function GapCard({
  eyebrow,
  gain,
  tally,
  pairings,
  gloss = false,
  stacked: stackedOverride,
  onPress,
  footer,
}: GapCardProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  // Read from the system at the one threshold this app's stress frames share
  // (`features/closet/dynamic-type.ts`), never guessed and never measured.
  const stacked = stackedOverride ?? fontScale >= AX_STACK_SCALE;

  const label = gapLabel(tally, gain.kind);
  const prose = gapProse(tally, gain, { gloss });
  const shown = pairings?.shown ?? [];
  const more = pairings?.more ?? 0;

  const explanation = (
    <>
      <Text
        variant="eyebrow"
        style={{ fontSize: stacked ? 14 : 11, letterSpacing: 1.4 }}
        accessibilityElementsHidden
        importantForAccessibility="no">
        {eyebrow}
      </Text>
      {/* No `mt-*` on a trimmed serif Text — it cancels against the trim. The
          gap is spent as `mb` on the eyebrow above and `mt` is left alone. */}
      <Text
        variant="title"
        trim
        className="mt-1.5"
        style={{ fontSize: stacked ? 30 : 28, lineHeight: stacked ? 33 : 31 }}>
        {label}
      </Text>
      <Text
        variant="body"
        className="mt-2"
        style={{
          color: theme.muted,
          fontSize: stacked ? 20 : 16,
          lineHeight: stacked ? 29 : 24,
        }}>
        {prose}
      </Text>
    </>
  );

  return (
    <View className="overflow-hidden rounded-plate border border-rule bg-surface">
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${eyebrow}. ${label}. ${prose}`}
          accessibilityHint="Opens a closer look at this gap"
          className="p-[18px] active:opacity-90">
          {explanation}
        </Pressable>
      ) : (
        <View className="p-[18px]" accessible accessibilityLabel={`${eyebrow}. ${label}. ${prose}`}>
          {explanation}
        </View>
      )}

      {shown.length > 0 && !stacked ? (
        <View className="px-[18px] pb-[18px]">
          <View className="flex-row" style={{ gap: 8 }}>
            {shown.map((p) => (
              <View
                key={p.id}
                className="overflow-hidden rounded-lg bg-tray"
                style={{ width: 76, height: 88 }}>
                {p.imageUri ? (
                  <Image
                    source={stableImageSource(p.imageUri)}
                    contentFit="cover"
                    style={{ flex: 1 }}
                    cachePolicy="memory-disk"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
              </View>
            ))}
            {/* The designed cell, never a blank well: a count in sand reads as
                intentional, where an empty photograph well reads as an image
                that failed. A COUNT, never a bar — the standing refusal. */}
            {more > 0 ? (
              <View
                className="flex-1 items-center justify-center rounded-lg bg-sand"
                style={{ height: 88 }}
                accessibilityElementsHidden
                importantForAccessibility="no">
                {/* "4 more", not "+4": nothing on this card prints a bare
                    delta, and this cell counts pieces rather than a gain. */}
                <Text variant="caption" style={{ color: theme.muted }}>
                  {`${more} more`}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" className="mt-2" style={{ color: theme.muted, lineHeight: 19 }}>
            {`${shown.length === 1 ? 'This piece' : `These ${shown.length} pieces`} you own, plus ${nounWithArticle(gain.kind)} you do not own yet.`}
          </Text>
        </View>
      ) : null}

      {footer}
    </View>
  );
}
