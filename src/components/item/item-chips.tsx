import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';

export type ItemChipsProps = {
  category: string;
  colors: { name: string; hex?: string | null }[];
  occasions: string[];
  seasons: string[];
  /** Absent = the "+ Tag" affordance is not offered. */
  onAddTag?: () => void;
};

/**
 * The vocabularies are stored lowercase — `casual`, `winter`, the tagger's own
 * enum values — and the atlas sets them capitalised ("Weekend", "Autumn"). This
 * is presentation and nothing else: the stored value is never rewritten, and a
 * tag that drifted outside the enum still reads correctly here.
 */
function capitalise(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

/**
 * Everything Cinch knows about a garment, as one wrapping row.
 *
 * The order is an argument, not a layout accident. Category comes first and is
 * the only chip drawn filled, because it is the one tag that is the garment's
 * IDENTITY rather than a description of it — a coat is outerwear before it is
 * cognac, weekend or autumn. Everything after it is a quality the piece has,
 * and all of it is set at the same weight so no colour outranks a season.
 */
export function ItemChips({ category, colors, occasions, seasons, onAddTag }: ItemChipsProps) {
  return (
    <View className="flex-row flex-wrap gap-1.5 px-gutter">
      {/* Composed, not a fourth tone: `selected` + `selectedGround="ink"` is
          already the ink ground with a canvas label, which is exactly what I-01
          draws here. `tone="fill"` would be the wrong half of the pair — it
          means the sand read-only tag, and its ground wins over `selected`. */}
      <Chip label={capitalise(category)} selected selectedGround="ink" />

      {colors.map((c, i) => (
        // A name-only colour is the tagger's ordinary output, not an edge case,
        // so `swatchHex` is passed straight through and the chip simply loses
        // its dot. Inventing a swatch here would be inventing data.
        <Chip key={`color-${c.name}-${i}`} label={capitalise(c.name)} swatchHex={c.hex} />
      ))}

      {occasions.map((o, i) => (
        <Chip key={`occasion-${o}-${i}`} label={capitalise(o)} />
      ))}

      {seasons.map((s, i) => (
        <Chip key={`season-${s}-${i}`} label={capitalise(s)} />
      ))}

      {onAddTag ? (
        <Chip
          label="+ Tag"
          tone="dashed"
          onPress={onAddTag}
          accessibilityHint="Adds a tag to this piece"
        />
      ) : null}
    </View>
  );
}
