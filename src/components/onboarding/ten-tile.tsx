import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { SLOT_LABEL, type TenSlot } from '@/features/onboarding/ten-slots';
import { useTheme } from '@/theme/tokens';

/**
 * One cell of The Ten's grid (T-01/T-02/T-05/T-06).
 *
 * Four looks, one component: a photograph once filled, the plain slot word
 * while empty, an accent ring on whichever slot is foregrounded, and a quiet
 * dashed cell for a slot the user declined and left open. An icon of a shirt
 * is never drawn here for an empty slot — "an icon of a shirt is a picture of
 * a shirt the user does not own" (The Ten atlas, 02).
 */
export function TenTile({
  slot,
  size,
  foregrounded,
  isLast,
  garmentName,
  imageUri,
  onPress,
}: {
  slot: TenSlot;
  size: number;
  /** This slot is the one the bottom card currently argues for. */
  foregrounded: boolean;
  /** Only one slot remains — the tile reads "Last" instead of "Next". */
  isLast: boolean;
  /** The garment's real name, once the tagger has one; falls back to the slot word. */
  garmentName?: string | null;
  imageUri?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const label = SLOT_LABEL[slot.kind];

  const body = (() => {
    if (slot.status === 'filled') {
      return (
        <View
          className="overflow-hidden rounded-md bg-sand dark:bg-sand-dark"
          style={{ width: size, height: size }}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      );
    }

    if (foregrounded) {
      return (
        <View
          className="items-center justify-center rounded-md bg-blush dark:bg-blush-dark"
          style={{ width: size, height: size, borderWidth: 2, borderColor: theme.accent }}>
          <Text variant="label" className="font-semibold" style={{ color: theme.accent, fontSize: 12 }}>
            {isLast ? 'Last' : 'Next'}
          </Text>
        </View>
      );
    }

    // `open` and unfilled `empty` slots both draw the same dashed cell — the
    // difference is the word underneath, not the tile itself. A declined slot
    // is settled, not abandoned, so it earns no visual penalty.
    return (
      <View
        className="rounded-md"
        style={{
          width: size,
          height: size,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.ruleStrong,
        }}
      />
    );
  })();

  const caption =
    slot.status === 'filled'
      ? (garmentName ?? label)
      : slot.status === 'open'
        ? 'Skipped'
        : label;

  const captionColor =
    slot.status === 'filled' ? theme.ink : foregrounded ? theme.accent : theme.muted;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        slot.status === 'filled'
          ? (garmentName ?? label)
          : slot.status === 'open'
            ? `${label}, skipped`
            : `${label}, not photographed yet`
      }
      style={{ width: size }}
      className={onPress ? 'active:opacity-70' : ''}>
      {body}
      <Text
        numberOfLines={1}
        style={{
          marginTop: 4,
          fontSize: 11,
          lineHeight: 14,
          fontFamily: 'HelveticaNeue-Medium',
          color: captionColor,
        }}>
        {caption}
      </Text>
    </Pressable>
  );
}
