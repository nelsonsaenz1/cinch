/**
 * CPV2-05's colour row — the only selectable thing in the feature.
 *
 * §6: "Selection never relies on hue: swatch + printed colour name + check
 * mark." All three are here, and the check is the one that carries the state
 * for anyone who cannot see the ring.
 *
 * §11: a listing may have no image. That is drawn, not hidden — a pictureless
 * colourway is still a shirt somebody owns, and it announces itself as "No
 * photo in the catalogue" rather than being quietly dropped from a list whose
 * length the card above already promised.
 */

import { Pressable, View } from 'react-native';

import { CataloguePlate } from '@/components/catalogue/plate';
import { Text } from '@/components/ui/text';
import { NO_PHOTO } from '@/features/catalogue/copy';
import type { CatalogueColourway } from '@/features/catalogue/types';
import { useTheme } from '@/theme/tokens';

export type ColourRowProps = {
  colour: CatalogueColourway;
  selected: boolean;
  /** The family's printed name, for the VoiceOver sentence. */
  familyTitle: string;
  onToggle: (colour: CatalogueColourway) => void;
  /** AX5 grows the swatch 36 → 40 and the check 26 → 32 (§4). */
  large?: boolean;
};

export function ColourRow({ colour, selected, familyTitle, onToggle, large = false }: ColourRowProps) {
  const theme = useTheme();
  const swatch = large ? 40 : 36;
  const check = large ? 32 : 26;

  // §6, verbatim shape: "Black. Selected. Colour of Crew Neck Jersey Tee.
  // Toggle." and the pictureless variant.
  const label = [
    colour.label,
    colour.imageUrl ? null : NO_PHOTO,
    selected ? 'Selected' : 'Not selected',
    `Colour of ${familyTitle}`,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => onToggle(colour)}
      // §4/§6: minimum target 44; AX5 rows grow rather than truncate.
      className="flex-row items-center gap-3 px-gutter"
      style={{ minHeight: large ? 76 : 60, paddingVertical: 8 }}>
      <CataloguePlate
        uri={colour.imageUrl}
        contentFit="cover"
        compact
        className="overflow-hidden rounded-full bg-tray"
        style={{ width: swatch, height: swatch, borderWidth: 1, borderColor: theme.rule }}
      />

      <View className="flex-1">
        <Text variant="body">{colour.label}</Text>
        {colour.imageUrl ? null : (
          <Text variant="noteSmall">{NO_PHOTO}</Text>
        )}
      </View>

      {/* The check. Never animated — §6's Reduce Motion rule is that state
          changes replace transitions everywhere in this feature, so it is
          simply present or absent. */}
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: check,
          height: check,
          borderWidth: selected ? 0 : 1,
          borderColor: theme.rule,
          backgroundColor: selected ? theme.ink : 'transparent',
        }}>
        {selected ? (
          <Text variant="noteSmall" style={{ color: theme.canvas }}>
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
