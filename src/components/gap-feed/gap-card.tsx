import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { gapLabel, describeGap, type Gain, type Tally } from '@/features/closet/gap-feed';
import type { GapPiece } from '@/features/closet/use-gap-feed';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * One ranked suggestion — G-01's card body, plus G-03's "up close" colophon
 * row baked directly in rather than drawn only in a detail illustration.
 *
 * NOTHING IS BLURRED, GREYED OR TEASED. The recommendation, the gain and the
 * garments it would pair with are fully legible; the lock is the plain
 * sentence in the colophon row ("CLOSET FULL · N OF LIMIT") and the "Add
 * anyway" link beside it — never a padlock badge, never a scrim.
 *
 * The colophon is oxblood TEXT, not a filled pill, so it never competes with
 * the screen's one filled oxblood action (rule 9) — the same convention the
 * app already uses for "Cancel" and "Select all" in the closet header.
 */
export type GapCardProps = {
  gain: Gain;
  tally: Tally;
  pairings: { shown: GapPiece[]; more: number };
  /** Undefined when the closet has room — the colophon row is withheld entirely. */
  lock?: { used: number; limit: number };
  /** Bigger type — G-05's single dominant card. */
  large?: boolean;
  onPress: () => void;
  onAddAnyway: () => void;
};

export function GapCard({ gain, tally, pairings, lock, large, onPress, onAddAnyway }: GapCardProps) {
  const theme = useTheme();
  const label = gapLabel(tally, gain.kind);
  const body = describeGap(tally, gain);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, plus ${gain.gain} outfits. ${body}`}
      accessibilityHint="Opens a closer look at this suggestion"
      className="rounded-[16px] border border-rule bg-surface active:opacity-90"
      style={{ padding: large ? 18 : 14 }}>
      <View className="flex-row items-baseline justify-between">
        <Text
          variant="body"
          className="flex-1 font-semibold"
          style={{ fontSize: large ? 19 : 17 }}>
          {label}
        </Text>
        <Text
          variant="title"
          trim
          style={{ fontSize: large ? 34 : 26, color: theme.accent, marginLeft: 8 }}>
          {`+${gain.gain}`}
        </Text>
      </View>

      <Text
        variant="body"
        className="mt-1 text-muted"
        style={{ fontSize: large ? 15 : 14, lineHeight: large ? 21 : 19 }}>
        {body}
      </Text>

      {pairings.shown.length > 0 ? (
        <View className="mt-3 flex-row" style={{ gap: 6 }}>
          {pairings.shown.map((p) => (
            <View
              key={p.id}
              className="overflow-hidden rounded-lg bg-tray"
              style={{ width: large ? 52 : 44, height: large ? 52 : 44 }}>
              {p.imageUri ? (
                <Image
                  source={stableImageSource(p.imageUri)}
                  contentFit="contain"
                  style={{ flex: 1, padding: 3 }}
                  cachePolicy="memory-disk"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
          ))}
          {pairings.more > 0 ? (
            <View
              className="items-center justify-center rounded-lg border border-dashed border-rule-strong"
              style={{ width: large ? 52 : 44, height: large ? 52 : 44 }}>
              <Text variant="caption" style={{ fontSize: 11, color: theme.faint }}>
                {`+${pairings.more}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {lock ? (
        <View
          className="mt-3 flex-row items-center justify-between border-t border-rule"
          style={{ paddingTop: 12 }}>
          <Text
            variant="caption"
            style={{ fontFamily: 'ui-monospace', fontSize: 11, letterSpacing: 0.4, color: theme.faint }}>
            {`CLOSET FULL · ${lock.used} OF ${lock.limit}`}
          </Text>
          <Pressable
            onPress={onAddAnyway}
            accessibilityRole="button"
            accessibilityLabel="Add anyway"
            accessibilityHint="Explains what a closet already at its limit means for this piece"
            hitSlop={{ top: (MIN_TAP_TARGET - 20) / 2, bottom: (MIN_TAP_TARGET - 20) / 2, left: 8, right: 8 }}
            className="active:opacity-60">
            <Text variant="label" style={{ fontSize: 14, color: theme.accent }}>
              Add anyway →
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}
