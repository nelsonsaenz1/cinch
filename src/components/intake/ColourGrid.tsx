import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { Swatch } from '@/components/ui/swatch';
import { Text } from '@/components/ui/text';
import { isKnownColourTerm, resolveSpokenColour } from '@/features/intake/colour-lexicon';
import { hueFamily, type HueFamily, type Oklch } from '@/lib/color';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * V-07's colour field. The directive is explicit and it is the whole design
 * brief for this file: **do not ship a hue wheel.** "The user described a
 * colour in words; correcting it should also be in words. A continuous
 * picker invites a precision the input never had." So this is a grid of
 * named, tappable swatches — the correction stays the same shape as the
 * original utterance, just spoken by a chip instead of a mouth.
 *
 * THE CONSTRAINT THAT ACTUALLY MATTERS
 *
 * A correction writes back to `intake_drafts.colour_term`, which the styling
 * engine only ever sees through `resolveSpokenColour()` (colour-lexicon.ts).
 * Offering a swatch whose label that function cannot resolve would let
 * someone "fix" a colour into one the engine then scores as the grey
 * `UNRESOLVED` fallback — a correction that silently makes the garment worse.
 * So every candidate term below is round-tripped through the real resolver at
 * module load, not copied from a second list that could drift: the hex each
 * swatch is painted with, and the family it is grouped under, both come from
 * `resolveSpokenColour` + `hueFamily`, the exact functions the rest of the
 * app uses. In dev, any candidate that resolver does not actually recognise
 * is reported loudly rather than shipped quietly wrong — see the assertion
 * below `CANDIDATE_TERMS`.
 *
 * WHY A CURATED ~75, NOT THE FULL LEXICON
 *
 * `resolveColorName` in `src/lib/color/families.ts` answers for well over a
 * hundred strings once every spelling alias is counted ("grey"/"gray",
 * "navy"/"navy blue," "lime"/"lime green"). Offering all of them would just
 * be the hue wheel again with extra steps — a wall so dense that finding
 * "cornflower" costs as much attention as dragging a slider did. This list
 * keeps one spelling per concept and enough coverage per family that a
 * correction is never more than one step away from what was actually said.
 */

const CANDIDATE_TERMS = [
  // Neutrals — the correction a wardrobe asks for most often ("that's not
  // black, it's charcoal"), so it goes first and gets the most room.
  'black', 'charcoal', 'dark grey', 'grey', 'light grey', 'white', 'off white',
  'ivory', 'cream', 'ecru', 'bone',
  'red', 'crimson', 'burgundy', 'maroon', 'wine', 'brick', 'cherry', 'scarlet',
  'orange', 'rust', 'terracotta', 'peach', 'coral', 'brown', 'chocolate',
  'tan', 'camel', 'beige', 'stone', 'cognac',
  'yellow', 'mustard', 'gold', 'butter', 'lemon', 'ochre',
  'green', 'olive', 'khaki', 'forest green', 'emerald', 'sage', 'mint',
  'lime', 'moss',
  'teal', 'turquoise', 'aqua', 'cyan', 'petrol',
  'navy', 'midnight', 'indigo', 'denim', 'blue', 'royal blue', 'cobalt',
  'sky blue', 'cornflower', 'slate',
  'purple', 'lavender', 'lilac', 'violet', 'plum', 'aubergine',
  'pink', 'hot pink', 'blush', 'rose', 'fuchsia', 'magenta', 'mauve', 'salmon',
] as const;

if (__DEV__) {
  // The relationship this file depends on, asserted rather than assumed —
  // exactly what the build spec (V-07) asks for. `tests/` cannot reach this
  // file today (see `buckets.ts`'s note on the esbuild-based runner and RN
  // imports), so the check runs here, once, at module load in development,
  // where it will be seen the first time this screen renders rather than
  // discovered later as a garment that quietly stopped scoring.
  const unresolvable = CANDIDATE_TERMS.filter((term) => !isKnownColourTerm(term));
  if (unresolvable.length > 0) {
    console.error(
      `[ColourGrid] offers ${unresolvable.length} term(s) resolveSpokenColour() cannot resolve: ` +
        `${unresolvable.join(', ')}. Every swatch here must be a term the engine can score — ` +
        'fix the spelling or drop the term.',
    );
  }
}

/** One swatch, fully resolved once at module load — never recomputed per render. */
type ColourSwatch = { term: string; label: string; hex: string; family: HueFamily };

function labelFor(term: string): string {
  // The stored TERM keeps the lexicon's spelling ('grey' is what
  // `resolveSpokenColour` and `intake_drafts.colour_term` know); only the
  // printed label takes the American spelling.
  const shown = term.replace(/grey/g, 'gray');
  return shown.charAt(0).toUpperCase() + shown.slice(1);
}

function buildSwatches(): ColourSwatch[] {
  return CANDIDATE_TERMS.map((term) => {
    const resolved = resolveSpokenColour(term);
    const oklch: Oklch = { L: resolved.l, C: resolved.c, h: resolved.h };
    return { term, label: labelFor(term), hex: resolved.hex, family: hueFamily(oklch) };
  });
}

const SWATCHES = buildSwatches();

const FAMILY_LABEL: Record<HueFamily, string> = {
  neutral: 'Neutrals',
  red: 'Reds',
  orange: 'Oranges & browns',
  yellow: 'Yellows',
  green: 'Greens',
  teal: 'Teals',
  blue: 'Blues',
  purple: 'Purples',
  pink: 'Pinks',
};

// Neutral first (see the comment on `CANDIDATE_TERMS`), then the same
// spectrum order `FAMILY_BANDS` walks in `families.ts` — so a family that
// moves in that file's band order does not have to be re-decided here.
const FAMILY_ORDER: HueFamily[] = [
  'neutral', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink',
];

/**
 * Which family each candidate landed in is computed, not asserted — the same
 * `hueFamily`/`neutrality` maths that decides whether a real garment's navy
 * pairs with olive decides whether "cognac" prints under Neutrals or under
 * Oranges & browns. A section that ends up empty (no family is guaranteed
 * members from this particular 75) is simply not rendered.
 */
const SECTIONS = FAMILY_ORDER.map((family) => ({
  family,
  label: FAMILY_LABEL[family],
  swatches: SWATCHES.filter((swatch) => swatch.family === family),
})).filter((section) => section.swatches.length > 0);

export type ColourGridProps = {
  /** The draft's current `colour_term`, or NULL when the description named no
   *  colour — the column is nullable as of migration 20260813212206, because a
   *  colour nobody said used to be resolved to 'grey'. Null simply highlights
   *  nothing, which is the honest rendering of "not chosen yet".
   *
   *  Matched by exact string, not by nearest colour: a nearest-match highlight
   *  would silently claim the model's "cognac" and this grid's "camel" are the
   *  same correction, which is exactly the false precision V-07 exists to
   *  refuse. */
  value: string | null;
  /** Fired with the tapped term. The caller re-resolves it through
   *  `resolveSpokenColour`, same as V-06's original card, rather than this
   *  component handing back a colour object — a correction and the original
   *  parse must never be able to disagree about what a term means. */
  onChange: (term: string) => void;
};

/** V-07's colour field: named swatches, grouped by hue family, each a real
 *  44pt target. No wheel, no slider — see the file header for why. */
export function ColourGrid({ value, onChange }: ColourGridProps) {
  const theme = useTheme();
  // Null highlights nothing, which is what "not chosen yet" looks like.
  const normalizedSelected = value?.trim().toLowerCase() ?? '';

  return (
    <View>
      {SECTIONS.map((section, index) => (
        <View key={section.family} style={{ marginBottom: index === SECTIONS.length - 1 ? 0 : 20 }}>
          <Text variant="eyebrow" className="mb-2">
            {section.label}
          </Text>
          <View className="flex-row flex-wrap" style={{ columnGap: 14, rowGap: 16 }}>
            {section.swatches.map((swatch) => (
              <ColourSwatchButton
                key={swatch.term}
                swatch={swatch}
                selected={swatch.term === normalizedSelected}
                muted={theme.muted}
                ink={theme.ink}
                onSelect={onChange}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function ColourSwatchButton({
  swatch,
  selected,
  muted,
  ink,
  onSelect,
}: {
  swatch: ColourSwatch;
  selected: boolean;
  muted: string;
  ink: string;
  onSelect: (term: string) => void;
}) {
  // The same selection tick every chip and swatch in the app gives —
  // best-effort, so a Low Power Mode no-op never eats the press itself.
  const press = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    onSelect(swatch.term);
  }, [onSelect, swatch.term]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={swatch.label}
      accessibilityState={{ selected }}
      onPress={press}
      className="active:opacity-70"
      // A fixed 60×MIN_TAP_TARGET box rather than hitSlop padding out a
      // smaller visual: the swatch circle and its label already draw taller
      // than 44 (30pt circle + a 4pt gap + an 11px caption), so the real
      // constraint here is width — a bare 30pt circle is well under the
      // floor, and hitSlop on a wrapped grid would let one row's slop reach
      // into the row below it, the same hazard `chip.tsx` documents for its
      // `tap` size.
      style={{ width: 60, minHeight: MIN_TAP_TARGET, alignItems: 'center' }}>
      {/* `Swatch`'s own `selected` ring (2px ink vs 1px rule) is a WIDTH and
          CONTRAST change, not a hue change, so it survives colour-blindness
          and grayscale screenshots alike. The label darkens from `muted` to
          `ink` on selection as a second, independent cue for the same
          reason — required reading here because the thing being chosen among
          IS colour, so "selected" can never be allowed to mean "slightly
          more saturated." */}
      <Swatch hex={swatch.hex} size={30} selected={selected} />
      <Text
        variant="caption"
        numberOfLines={1}
        className="mt-1"
        style={{ color: selected ? ink : muted }}>
        {swatch.label}
      </Text>
    </Pressable>
  );
}
