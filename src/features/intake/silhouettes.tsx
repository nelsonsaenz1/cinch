import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

import { hexToOklch, oklchToHex, type Oklch } from '@/lib/color';
import type { Slot } from '@/lib/styling/types';
import { useTheme } from '@/theme/tokens';

/**
 * A garment drawn instead of photographed.
 *
 * Voice intake directive §1: a garment added by voice has no image at all —
 * "a drawing of what you said." This is the drawing. Nine shapes, one per
 * `Slot` (the same union `src/lib/styling/types.ts` already scores outfits
 * against), each filled with the garment's resolved colour and outlined so it
 * still reads when that colour is close to the paper it sits on.
 *
 * THE REGISTER. §1 asks for something "worth screenshotting" and explicitly
 * not a technical flat, not clip art. The house glyph vocabulary
 * (`components/activity/glyphs.tsx`, `features/explore/glyphs.tsx`) is
 * stroke-only icons on a 22-unit grid — right for a 17–36pt row mark, wrong
 * here, because a garment silhouette has to carry a fill (the whole point is
 * showing the colour) and has to read as a body-worn shape at up to half a
 * screen tall. So these are hand paths on a 100-unit square: shoulders,
 * sleeve notches, a waistband, a lapel — each with a small deliberate
 * asymmetry (a hem that dips a little more on one side, a cuff kink that
 * isn't mirrored) rather than the perfect bilateral symmetry a vector tool
 * produces by default. That asymmetry is the whole difference between "quick
 * pen line" and "icon."
 */

// ── Colour ───────────────────────────────────────────────────────────────

/**
 * What a caller may hand in. `colour-lexicon.ts`'s `ResolvedColour` already
 * carries both an OKLCH triple and a hex string for the same value, so most
 * call sites can pass either half of it without a conversion at the call
 * site — this file does the one conversion it needs (getting a hex to fill
 * with, and an `L` to reason about contrast) itself, rather than asking every
 * caller to remember which shape is expected.
 */
export type SilhouetteColour = Oklch | string;

function resolveFill(colour: SilhouetteColour): { hex: string; lightness: number } {
  if (typeof colour === 'string') {
    const oklch = hexToOklch(colour);
    // `hexToOklch` is nullable for a malformed string. Mid lightness is the
    // same honest-hedge value `colour-lexicon.ts` falls back to for a term
    // the lexicon cannot resolve — wrong in a way that reads as "unsure,"
    // never as a confident claim about the garment.
    return { hex: colour, lightness: oklch?.L ?? 0.62 };
  }
  return { hex: oklchToHex(colour), lightness: colour.L };
}

/**
 * Above this OKLCH lightness, a fill sits close enough to `canvas` (L≈0.98)
 * and `tray` (L≈0.94) that the standing `rule` outline — ink at 12% — stops
 * being a line and becomes a faint smudge at the fill's own edge. A cream
 * jumper drawn that way has no edge at all against a cream ground, which is
 * exactly the failure V-06's silhouette exists to avoid on the one screen
 * whose job is to make an unphotographed closet still look like a closet.
 *
 * The fix spends no new colour: `ruleStrong` (ink at 28%) already exists in
 * `theme/tokens.ts` for the same reason a form field needs a harder edge once
 * it holds an answer. Below the threshold, `rule` stays — most garments are
 * dark or saturated enough that the fill itself carries the contrast, and a
 * uniformly heavy outline would make every card look outlined in marker.
 */
const LIGHT_FILL_LIGHTNESS = 0.82;

// ── Pattern overlay ─────────────────────────────────────────────────────

type PatternKind = 'stripe' | 'check' | 'dot' | 'floral';

/**
 * Free text in, a known tile or nothing out. `tagSchema.pattern` and this
 * wave's `parse-closet` both describe pattern as an open string ("striped",
 * "houndstooth", "a loud floral") because it is a vision/language judgement,
 * not an enum anyone could exhaustively define — so this can never assume the
 * value is one of the four tiles below. Herringbone, houndstooth, camo,
 * animal print, "solid," empty, and anything else unrecognised all fall
 * through to `null`, which draws no overlay at all. A wrong guess at a print
 * would misrepresent a garment nobody has seen a photo of; no overlay is
 * simply a plain silhouette, which is already the honest default state.
 */
function patternKind(pattern: string | null | undefined): PatternKind | null {
  if (!pattern) return null;
  const lower = pattern.toLowerCase();
  if (/stripe/.test(lower)) return 'stripe';
  if (/check|plaid|tartan|gingham/.test(lower)) return 'check';
  if (/dot|spot|polka/.test(lower)) return 'dot';
  if (/floral|flower/.test(lower)) return 'floral';
  return null;
}

/** One tile per kind, always drawn in `ink` — the overlay's own opacity (not
 *  the tile's) is what keeps it "subtle," per §1, against any fill colour. */
function PatternTile({ kind, id, ink }: { kind: PatternKind; id: string; ink: string }) {
  switch (kind) {
    case 'stripe':
      return (
        <Pattern id={id} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <Line x1={0} y1={0} x2={0} y2={9} stroke={ink} strokeWidth={3.4} />
        </Pattern>
      );
    case 'check':
      return (
        <Pattern id={id} width={11} height={11} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={11} y2={0} stroke={ink} strokeWidth={1} />
          <Line x1={0} y1={5.5} x2={11} y2={5.5} stroke={ink} strokeWidth={1} />
          <Line x1={0} y1={0} x2={0} y2={11} stroke={ink} strokeWidth={1} />
          <Line x1={5.5} y1={0} x2={5.5} y2={11} stroke={ink} strokeWidth={1} />
        </Pattern>
      );
    case 'dot':
      return (
        <Pattern id={id} width={9} height={9} patternUnits="userSpaceOnUse">
          <Circle cx={4.5} cy={4.5} r={1.3} fill={ink} />
        </Pattern>
      );
    case 'floral':
      // A loose scatter rather than a regular grid — three uneven petals per
      // tile reads as growth, where evenly spaced circles would read as dots.
      return (
        <Pattern id={id} width={16} height={16} patternUnits="userSpaceOnUse">
          <Circle cx={4} cy={5} r={1.6} fill={ink} />
          <Circle cx={10} cy={3} r={1.1} fill={ink} />
          <Circle cx={12} cy={11} r={1.7} fill={ink} />
          <Circle cx={4} cy={13} r={1} fill={ink} />
        </Pattern>
      );
  }
}

// ── The nine shapes ─────────────────────────────────────────────────────
//
// Every `d` below is a single closed path on a 0–100 square, built the same
// way a garment is actually constructed: shoulders/waistband first, then the
// edges that make the slot legible at a glance (a sleeve notch, a crotch
// seam, a lapel, a sole line, a bag handle, a hat brim, a belt buckle). Kept
// as one path per slot (two for the handful that need an unfilled detail
// line, like the cardigan's open front or the bag's handle) so the pattern
// overlay below can reuse the exact same outline as its clip shape.

const PATHS: Record<Slot, string> = {
  // Crew tee: rounded neckline, short set-in sleeves, a hem that settles
  // slightly unevenly rather than a perfectly level line.
  base_top:
    'M38 16 C36 9,45 6,50 7 C55 6,64 9,62 16 L80 27 C84 30,82 35,78 37 L67 44 L66 40 C65 58,67 76,65 85 C55 89,45 89,35 85 C33 76,35 58,34 40 L33 44 L22 37 C18 35,16 30,20 27 Z',
  // Same envelope as base_top, but the neckline drops into a deep V that
  // reaches almost to the hem — an open cardigan rather than a closed crew —
  // with a centre-front seam line as the second, unfilled path below.
  mid_layer:
    'M37 15 C35 9,44 6,50 8 C56 6,65 9,63 15 L81 26 C85 29,83 34,79 36 L68 43 L67 39 C66.5 48,67 60,67 72 L67 87 C60 89,53 88,50 84 C47 88,40 89,33 87 L33 72 C33 60,33.5 48,33 39 L32 43 L21 36 C17 34,15 29,19 26 Z',
  // Waistband, two legs, a rounded crotch notch between them.
  bottom:
    'M28 18 C28 15,72 15,72 18 L75 30 L76 87 C76 90,65 91,63 87 L54 46 C53 44,51 44,50 46 L43 87 C41 91,29 90,29 87 L26 30 Z',
  // Fitted bodice flaring into a wide A-line hem — the flare starts at the
  // waist, not the shoulder, so it reads as "dress" and not "coat."
  dress:
    'M40 12 C38 7,46 4,50 5 C54 4,62 7,60 12 L64 24 C74 30,79 44,77 58 L82 85 C70 92,30 92,18 85 L23 58 C21 44,26 30,36 24 Z',
  // Longer than the tops, dropped shoulders, a lapel notch cut into the top
  // corners, and a swept hem well past where a jumper would end.
  outerwear:
    'M34 14 L30 22 L14 30 C10 32,10 38,14 40 L27 47 L27 43 C24 60,25 78,23 90 C35 94,65 94,77 90 C75 78,76 60,73 43 L73 47 L86 40 C90 38,90 32,86 30 L70 22 L66 14 C66 20,60 24,50 24 C40 24,34 20,34 14 Z',
  // Side profile: a raised toe, a flat sole line, a distinct heel counter.
  footwear:
    'M12 68 C12 60,20 56,30 55 C42 54,55 50,64 44 C70 40,78 40,84 44 C90 47,90 54,84 57 L84 62 C88 63,90 66,88 70 C86 74,78 75,68 74 L20 74 C14 74,10 72,12 68 Z',
  // A trapezoid body; the handle is a second, unfilled arc above it.
  bag:
    'M26 38 C26 34,74 34,74 38 L80 84 C80 88,20 88,20 84 Z',
  // A dome crown over a wide flat brim — two overlapping shapes, since a hat
  // is a crown SITTING ON a brim, not one continuous outline.
  headwear:
    'M20 62 C18 40,30 24,50 24 C70 24,82 40,80 62 C68 56,32 56,20 62 Z',
  // A belt: a horizontal strap with a buckle outline at its centre. Chosen as
  // the accessory catch-all because it is the one accessory silhouette that
  // cannot be mistaken for any of the other eight shapes at a glance.
  accessory:
    'M10 46 C10 42,90 42,90 46 L90 56 C90 60,10 60,10 56 Z',
};

/** Every slot this file knows how to draw. */
const KNOWN_SLOTS = new Set<Slot>([
  'base_top', 'mid_layer', 'bottom', 'dress', 'outerwear', 'footwear', 'bag', 'headwear', 'accessory',
]);

/**
 * `intake_drafts.slot` is a Postgres `text` column with a CHECK constraint,
 * not a real enum, so the generated `IntakeDraftRow['slot']` — and therefore
 * whatever a caller reads off a draft — types as plain `string`. Falling back
 * to `accessory` for anything this file does not recognise (a stale draft
 * from before a tenth slot ships, a typo that slipped past the CHECK during a
 * migration window) mirrors exactly what `normalizeGarments` already does
 * server-side in `intake-schema.ts` for the same situation: draw *something*
 * recognisable rather than throw and lose the card.
 */
function normalizeSlot(slot: string): Slot {
  return KNOWN_SLOTS.has(slot as Slot) ? (slot as Slot) : 'accessory';
}

/** The bag's handle — drawn open (stroke, no fill), sitting above the body. */
const BAG_HANDLE_D = 'M32 30 C32 18,68 18,68 30 L68 34';
/** The hat's brim — a second filled shape beneath the crown. */
const HAT_BRIM_D =
  'M14 63 C30 54,70 54,86 63 C87 68,84 71,78 70 C60 65,40 65,22 70 C16 71,13 68,14 63 Z';
/** The cardigan's open front — a centre seam, drawn as a line, not a fill edge. */
const CARDIGAN_SEAM_D = 'M50 8 L50 84';
/** The belt's buckle — an unfilled rounded rect over the strap's centre. */
const BELT_BUCKLE = { x: 42, y: 40, width: 16, height: 20, rx: 3 };

// ── The component ───────────────────────────────────────────────────────

export type GarmentSilhouetteProps = {
  /** `IntakeDraftRow['slot']` — see `normalizeSlot` above for why this is
   *  `string` rather than the narrower `Slot` union. */
  slot: string;
  /** The garment's resolved colour — `resolveSpokenColour(term).hex` (or the
   *  raw OKLCH) for a spoken garment, or a measured hex once V-08 upgrades
   *  it. Never invented here: this file only draws whatever colour it is
   *  handed, per reframe directive §4.9. */
  colour: SilhouetteColour;
  /** Free text from the parse or a correction. Unrecognised values (and
   *  "solid"/null) draw no overlay — see `patternKind`. */
  pattern?: string | null;
  /** Square side length in points. Defaults to the review card's own size;
   *  callers drawing a denser grid (V-04's pile, V-11's tally) pass smaller. */
  size?: number;
};

/**
 * One garment, drawn.
 *
 * Decorative by design: the name, colour and pattern this shape encodes are
 * always stated in text elsewhere on the same card (V-06's name line, chips
 * and receipt), so a screen reader that also announced the drawing would
 * repeat the row — the same call `ActivityGlyphMark` already makes for its
 * object marks.
 */
function GarmentSilhouette({ slot, colour, pattern, size = 120 }: GarmentSilhouetteProps) {
  const theme = useTheme();
  const resolvedSlot = normalizeSlot(slot);
  const reactId = useId();
  // SVG pattern/def ids are global to the document (or, on native, to the
  // rendering surface) rather than scoped to one <Svg>. A closet screen draws
  // many of these at once — the V-04 pile, a grid, a procession's neighbours
  // pre-rendered off-screen — so two silhouettes sharing a literal id like
  // "stripe" would silently steal each other's pattern. `useId` is stable
  // per mounted instance and unique across them, which a module-level
  // counter would not survive across a fast-refresh remount.
  const patternId = `silhouette-pattern-${reactId}`;

  const { hex, lightness } = resolveFill(colour);
  const outline = lightness > LIGHT_FILL_LIGHTNESS ? theme.ruleStrong : theme.rule;
  const kind = patternKind(pattern);
  const d = PATHS[resolvedSlot];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {kind ? (
          <Defs>
            <PatternTile kind={kind} id={patternId} ink={theme.ink} />
          </Defs>
        ) : null}

        {resolvedSlot === 'headwear' ? (
          <Path d={HAT_BRIM_D} fill={hex} stroke={outline} strokeWidth={1} strokeLinejoin="round" />
        ) : null}

        <Path d={d} fill={hex} stroke={outline} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />

        {/* The pattern overlay reuses the garment's own outline as its
            shape, so the tile never spills past the silhouette's edge — no
            separate clip path to keep in sync with the drawing above. */}
        {kind ? <Path d={d} fill={`url(#${patternId})`} opacity={0.16} /> : null}

        {resolvedSlot === 'mid_layer' ? (
          <Path d={CARDIGAN_SEAM_D} stroke={outline} strokeWidth={0.8} />
        ) : null}

        {resolvedSlot === 'bag' ? (
          <Path d={BAG_HANDLE_D} fill="none" stroke={outline} strokeWidth={1.4} strokeLinecap="round" />
        ) : null}

        {resolvedSlot === 'accessory' ? (
          <Rect
            x={BELT_BUCKLE.x}
            y={BELT_BUCKLE.y}
            width={BELT_BUCKLE.width}
            height={BELT_BUCKLE.height}
            rx={BELT_BUCKLE.rx}
            fill="none"
            stroke={outline}
            strokeWidth={1.4}
          />
        ) : null}
      </Svg>
    </View>
  );
}

// `GarmentCard.tsx` was built concurrently against an assumed contract of a
// default export — recorded in its own header comment — so this ships both:
// default for that call site, named for anywhere reaching for it explicitly.
export { GarmentSilhouette };
export default GarmentSilhouette;
