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
      {/* ── AUDIT 2026-09-02 · 46 · ONE READ-ONLY TREATMENT ────────────────
          This was `selected` + `selectedGround="ink"` — I-01's filled ink chip
          with a canvas label. It is the treatment a SELECTED CONTROL wears
          everywhere else in the app, on the one chip in this row that cannot be
          selected and cannot be pressed, next to four tags that can't either
          and don't look like it. That is the "inconsistently exposed as buttons
          versus plain text" the audit names, in its loudest form.

          `tone="fill"` is the read-only tag's own ground, and the category
          keeps its precedence by ORDER — it is still the first chip, and it is
          still the garment's identity. What it no longer does is impersonate a
          control. The only chip in this row that looks different is now the
          only one that does anything: "+ Tag", dashed, and a real button. */}
      <Chip label={capitalise(category)} tone="fill" />

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
