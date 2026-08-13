/**
 * CPV2-04's family card, and the colour chips that sit under it.
 *
 * THE CHIP IS A PREVIEW AND ONLY A PREVIEW. Tapping one swaps the picture in
 * the plate above it and does nothing else — no selection, no navigation, and
 * emphatically no write. §11: "That tapping a family or a colour may write a
 * piece" is on the list of things implementation must not assume. Selection
 * happens on CPV2-05, where the user can see what they are choosing at size;
 * the chips here exist so somebody can tell, from the list, whether the shirt
 * they own is in this family at all.
 *
 * Because the chip is inert, it is NOT a button to VoiceOver — it is part of
 * the card's own label ("Six colours available"), and the card is the only
 * focusable thing in the row. A row of six unlabelled toggles that do not
 * toggle would be six dead stops on the way down the page.
 */

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CataloguePlate } from '@/components/catalogue/plate';
import { Text } from '@/components/ui/text';
import { PROVENANCE_SHORT } from '@/features/catalogue/copy';
import {
  presentedTitle,
  representativeColour,
  type CatalogueFamily,
} from '@/features/catalogue/types';
import { useTheme } from '@/theme/tokens';

/** §4: the family card's image plate is 104 × 124. */
const PLATE_WIDTH = 104;
const PLATE_HEIGHT = 124;
/** §4: minimum target 44; the chip is a preview, so it sits inside the card's own target. */
const CHIP = 26;

export type FamilyCardProps = {
  family: CatalogueFamily;
  /** 1-based, as the user sees it. Passed through to the rank bucket. */
  position: number;
  onOpen: (family: CatalogueFamily, position: number) => void;
};

export function FamilyCard({ family, position, onOpen }: FamilyCardProps) {
  const theme = useTheme();
  const [previewIndex, setPreviewIndex] = useState(0);

  const title = presentedTitle(family);
  const preview = family.colours[previewIndex] ?? representativeColour(family);
  const count = family.colours.length;

  // §6's example: "Crew Neck Jersey Tee. James Perse, short sleeve. Six colours
  // available. Photos from the shop catalogue. Button." Built here rather than
  // in the screen so every list that draws a family says the same sentence.
  const spokenCut = family.nearMissCut ? `, ${family.nearMissCut}` : '';
  const label = [
    title,
    family.brand ? `${family.brand}${spokenCut}.` : null,
    `${count} ${count === 1 ? 'colour' : 'colours'} available.`,
    PROVENANCE_SHORT,
  ]
    .filter(Boolean)
    .join('. ')
    .replace(/\.\./g, '.');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onOpen(family, position)}
      className="flex-row gap-3.5 rounded-2xl bg-surface p-3.5"
      style={{ borderWidth: 1, borderColor: theme.rule }}>
      <CataloguePlate
        uri={preview?.imageUrl ?? null}
        contentFit="contain"
        className="overflow-hidden rounded-xl bg-tray"
        style={{ width: PLATE_WIDTH, height: PLATE_HEIGHT }}
      />

      <View className="flex-1 justify-center gap-1">
        <Text variant="door" numberOfLines={3}>
          {title}
        </Text>
        {family.brand ? (
          <Text variant="note" numberOfLines={1}>
            {family.brand}
          </Text>
        ) : null}
        <Text variant="noteSmall" numberOfLines={2}>
          {PROVENANCE_SHORT}
        </Text>

        {/* Preview only. See the header. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="mt-1 flex-row flex-wrap gap-1.5">
          {family.colours.slice(0, 6).map((colour, i) => (
            <Pressable
              key={colour.externalId}
              onPress={() => setPreviewIndex(i)}
              className="overflow-hidden rounded-md bg-tray"
              style={{
                width: CHIP,
                height: CHIP,
                borderWidth: i === previewIndex ? 1.5 : 1,
                borderColor: i === previewIndex ? theme.ink : theme.rule,
              }}>
              <CataloguePlate uri={colour.imageUrl} contentFit="cover" compact className="flex-1" />
            </Pressable>
          ))}
        </View>
      </View>
    </Pressable>
  );
}
