import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { SectionHeader } from '@/components/ui/section-header';
import { Swatch } from '@/components/ui/swatch';
import { Text } from '@/components/ui/text';
import type { Item, ItemCategory } from '@/schemas/item';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The A-05 editors — manual tagging for a local item, "the same detail screen,
 * minus the returned tags". Chips instead of a keyboard, so the manual path is
 * taps: a category, a colour or three, a fabric, Save. Everything here is a
 * controlled value the screen owns; nothing writes on its own.
 */

/** What the manual editor edits — the exact columns Save patches. */
export type ManualTags = {
  category: ItemCategory;
  /** `[{name, hex}]`, the same shape the `colors` jsonb column holds. */
  colors: Item['colors'];
  /** Free text in the row, but chosen from chips here. Null = unsaid. */
  material: string | null;
};

/**
 * Same keys and plural convention as the review deck's category row
 * (components/review/review-card.tsx `CATEGORY_OPTIONS`) — kept as a local
 * table rather than imported so item detail does not reach into the deck's
 * component file for a constant.
 */
const CATEGORY_OPTIONS: { key: ItemCategory; label: string }[] = [
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'footwear', label: 'Shoes' },
  { key: 'dress', label: 'Dress' },
  { key: 'accessory', label: 'Accessory' },
  { key: 'bag', label: 'Bag' },
  { key: 'headwear', label: 'Headwear' },
  { key: 'jewelry', label: 'Jewelry' },
];

/**
 * The wardrobe palette, name → hex, values from the colour lib's own table
 * (src/lib/color/families.ts NAMED — clothing-label hexes, not CSS ones).
 * Names stored lowercase because that is how the tagger writes the column, so
 * a hand-picked "navy" and a machine-read "navy" are the same word downstream.
 */
const STARTER_COLOURS: { name: string; hex: string }[] = [
  { name: 'black', hex: '#111111' },
  { name: 'white', hex: '#f7f7f5' },
  { name: 'cream', hex: '#efe6d2' },
  { name: 'grey', hex: '#8b8f94' },
  { name: 'navy', hex: '#1f2a44' },
  { name: 'brown', hex: '#6b4a34' },
];

const MORE_COLOURS: { name: string; hex: string }[] = [
  { name: 'charcoal', hex: '#36393d' },
  { name: 'beige', hex: '#d6c4a8' },
  { name: 'tan', hex: '#b99567' },
  { name: 'camel', hex: '#b58f5f' },
  { name: 'denim', hex: '#3f5d80' },
  { name: 'blue', hex: '#2f5fa8' },
  { name: 'light blue', hex: '#9fc4e0' },
  { name: 'green', hex: '#3f7a4a' },
  { name: 'olive', hex: '#6a6b3d' },
  { name: 'khaki', hex: '#9a9060' },
  { name: 'yellow', hex: '#e3c23c' },
  { name: 'mustard', hex: '#c9a227' },
  { name: 'orange', hex: '#d97230' },
  { name: 'rust', hex: '#a8502c' },
  { name: 'red', hex: '#b8332f' },
  { name: 'burgundy', hex: '#5e2233' },
  { name: 'pink', hex: '#e493ac' },
  { name: 'purple', hex: '#6b4a8a' },
];

/** Up to three, matching what the tagger itself is allowed to return. */
const MAX_COLOURS = 3;

/**
 * Common fabrics, one row-ish — written to the `material` column lowercase,
 * the same casing the tagger uses for the field.
 */
const FABRIC_OPTIONS = [
 'cotton',
 'linen',
 'wool',
 'knit',
 'denim',
 'leather',
 'silk',
 'synthetic',
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The sand pill beside the local item's photo: a 6pt oxblood dot and the
 * tracked "On this phone". A fact, not a warning — the one persistent trace
 * that this photograph never left the device.
 */
export function OnThisPhonePill() {
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-2 self-start rounded-chip bg-sand px-2.5 py-1.5">
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent }} />
      <Text variant="colophon">On this phone</Text>
    </View>
  );
}

/**
 * Category · Colour · Fabric, each under its tracked eyebrow.
 *
 * Category is single-select and ink-filled when picked (the closet's own
 * selected-chip grammar). Colour is the 30pt swatch row — a starter set plus
 * "More" — multi-select to three, because `colors` is a list and claiming one
 * colour for a striped sweater would be a lie. Fabric is single-select with
 * tap-again-to-clear, because "unsaid" is the column's own honest null.
 */
export function ManualTagSections({
  value,
  onChange,
}: {
  value: ManualTags;
  onChange: (next: ManualTags) => void;
}) {
  const theme = useTheme();
  const [showAllColours, setShowAllColours] = useState(
    // Open with the full palette when the item already wears a colour the
    // starter row doesn't hold — collapsing it would hide the current answer.
    () => value.colors.some((c) => !STARTER_COLOURS.some((s) => s.name === c.name)),
  );

  const colours = showAllColours ? [...STARTER_COLOURS, ...MORE_COLOURS] : STARTER_COLOURS;

  const toggleColour = (swatch: { name: string; hex: string }) => {
    const picked = value.colors.some((c) => c.name === swatch.name);
    if (picked) {
      onChange({ ...value, colors: value.colors.filter((c) => c.name !== swatch.name) });
      return;
    }
    if (value.colors.length >= MAX_COLOURS) return;
    onChange({ ...value, colors: [...value.colors, swatch] });
  };

  return (
    <View>
      <View className="mt-6">
        <SectionHeader title="Category" className="mb-3" />
        <View className="flex-row flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              selected={value.category === c.key}
              selectedGround="ink"
              onPress={() => onChange({ ...value, category: c.key })}
            />
          ))}
        </View>
      </View>

      <View className="mt-6">
        <SectionHeader title="Colour" className="mb-3" />
        <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
          {colours.map((swatch) => {
            const picked = value.colors.some((c) => c.name === swatch.name);
            const full = !picked && value.colors.length >= MAX_COLOURS;
            return (
              <Pressable
                key={swatch.name}
                onPress={() => toggleColour(swatch)}
                accessibilityRole="button"
                accessibilityLabel={cap(swatch.name)}
                accessibilityState={{ selected: picked, disabled: full }}
                accessibilityHint={
                  picked ? 'Removes this colour' : `Adds this colour. Up to ${MAX_COLOURS}.`
                }
                // 30pt circle, 44pt target — the difference is hitSlop.
                hitSlop={7}
                className="active:opacity-60"
                style={full ? { opacity: 0.35 } : undefined}>
                <Swatch hex={swatch.hex} size={30} selected={picked} />
              </Pressable>
            );
          })}
          {!showAllColours ? (
            <Pressable
              onPress={() => setShowAllColours(true)}
              accessibilityRole="button"
              accessibilityLabel="More colours"
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
              className="active:opacity-60">
              <Text variant="label" style={{ color: theme.muted }}>
                More
              </Text>
            </Pressable>
          ) : null}
        </View>
        {value.colors.length > 0 ? (
          <Text variant="label" className="mt-2.5">
            {value.colors.map((c) => cap(c.name)).join(' · ')}
          </Text>
        ) : null}
      </View>

      <View className="mt-6">
        <SectionHeader title="Fabric" className="mb-3" />
        <View className="flex-row flex-wrap gap-2">
          {FABRIC_OPTIONS.map((fabric) => (
            <Chip
              key={fabric}
              label={cap(fabric)}
              selected={value.material === fabric}
              selectedGround="ink"
              onPress={() =>
                onChange({ ...value, material: value.material === fabric ? null : fabric })
              }
              accessibilityHint={
                value.material === fabric ? 'Clears the fabric' : 'Sets the fabric'
              }
            />
          ))}
        </View>
      </View>
    </View>
  );
}
