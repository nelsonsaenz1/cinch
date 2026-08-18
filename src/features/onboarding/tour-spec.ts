/**
 * Redesign 20 — the first-run tour, image-led.
 *
 * Everything the three frames DECIDE — colour, geometry, which composition a
 * given text size and screen height gets, and the drawn shape of every garment
 * on the plates — lives here, in a pure `.ts`, so `tests/tour-layout.test.ts`
 * can exercise it directly. `tour-frames.tsx` draws; it chooses nothing.
 *
 * Same split, and the same reason, as `features/auth/auth-run-spec.ts`: the
 * node test runner cannot parse React Native's Flow source, so anything a test
 * needs to read has to be reachable without importing a component.
 *
 * ── WHAT REDESIGN 20 CHANGED ────────────────────────────────────────────────
 *
 * The brief is four words long — "image-led frames over text; three beats max;
 * skippable always" — and the frames spend all four on ONE structural move:
 * the illustration comes off the bottom of the page and goes to the TOP, above
 * the eyebrow, where it is the first thing read. The shipped tour hung a
 * centred headline in the middle of the screen and put a small drawing under
 * the paragraph; the approved frames open on a picture and set the words
 * beneath it. `EditorialFrame` cannot express that (its children come after the
 * body by construction), which is why this wave stops using it.
 *
 * The other three changes follow from the directive rather than from the tour:
 * the CTA is a full-width 56pt oxblood capsule on BOTH grounds (the
 * one-oxblood-per-screen law is repealed — DIRECTIVE §1), the progress marks
 * become left-aligned dashes above the button rather than centred dots below
 * it, and the plates are drawn garment glyphs rather than photographs of the
 * bundled samples.
 *
 * ── WHAT IT DID NOT CHANGE ──────────────────────────────────────────────────
 *
 * The deck (`tour-copy.ts`), the once-ever gate (`tour-state.ts`,
 * `tour-queries.ts`) and the exit matrix are the shipped machinery, restyled
 * rather than rewritten. Nothing here reads `toured_at`, decides a route, or
 * raises a permission dialog.
 *
 * ── THE DIALECT ─────────────────────────────────────────────────────────────
 *
 * Same settlement `auth-run-spec.ts` records: the frames are drawn in their own
 * atlas and several of its values exist nowhere else, so they live here as
 * named constants rather than leaking into the palette. Values that match a
 * palette token ARE that token, reached through `useTheme()` at the call site —
 * ink, canvas, tray, accent, blush and muted are never re-typed below.
 *
 * TWO PLACES THE CONTRAST LAW OVERRULES THE FRAME (see `theme/contrast.ts`):
 *
 *   - the eyebrow on the two paper frames is drawn #B08A76, which is `accentWarm`
 *     and 2.61:1 on paper. An 11.5pt tracked line is never large text, so it is
 *     set in `muted` (5.46:1). The ink frame's #C2A08A eyebrow is KEPT — on the
 *     ink ground it is 7.1:1, and the census only ever forbade the clay as type
 *     on paper.
 *   - TR-03's "Last worn Friday" is drawn #A39B8B, which is 2.33:1 on the
 *     miniature's tray. It carries real information about a sample page, so it
 *     is `muted` too. The frame's own hierarchy survives: it is still the
 *     smaller of the two lines on that row.
 *
 * AND ONE THE TYPE RULE OVERRULES: every label the frames set in a 600 weight
 * (Skip, both CTAs, the secondary, "Camel shirt") is set in the one sans cut
 * this app has. TY-01 deleted every weight from product code and
 * `tests/type-weight.test.ts` enforces it; the emphasis is rebuilt from size,
 * colour and case exactly as `run-parts.tsx` rebuilt it for the auth run.
 */

import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';

export { AX_STACK_SCALE };

// ---------------------------------------------------------------------------
// Colour — the tour's dialect
// ---------------------------------------------------------------------------

/**
 * The values that are NOT palette tokens.
 *
 * Everything drawn in ink, canvas, tray, accent, blush or muted is read from
 * `useTheme()` instead and does not appear here. What is left is the two
 * grounds the ink plate is built from, the three sand steps the paper plates
 * separate their wells with, and the garment inks — a family of warm neutrals
 * that exists to make six drawn shapes distinguishable from each other and
 * from the well behind them, which is not a job any palette token has.
 */
export const TOUR = {
  /** TR-01's plate panel — one step up from the ink ground it sits on. */
  inkPanel: '#2A2622',
  /** The wells inside it, alternating so the grid reads as six cells. */
  inkWell: '#3A342C',
  inkWellAlt: '#453D33',
  /**
   * The eyebrow on the ink ground. 7.1:1 on ink — see the header for why this
   * one survives and the paper one does not.
   */
  inkEyebrow: '#C2A08A',

  /** The paper plates' three sand steps, deepest first. */
  well: '#E4DED2',
  wellAlt: '#DFD9CC',
  wellPale: '#E9E3D8',
  /** The blush card's hairline on TR-02. */
  cardRule: '#E8D6CD',
  /** A spent progress mark on paper. The lit one is `ink`. */
  markSpent: '#DFD9CC',

  // ── The garment inks ──────────────────────────────────────────────────────
  /** The linen family — the pale pieces on both grounds. */
  linen: '#C6BCA8',
  linenLight: '#D8CFBB',
  linenPale: '#E8DFCC',
  stone: '#BFB4A0',
  stoneWarm: '#CFC5B1',
  stoneDeep: '#B6AB96',
  /** The photographed piece on TR-02, before it is cut out. */
  greige: '#B9AE99',
  /** The camel the sample piece comes back as — TR-02's result and TR-03's skirt. */
  camel: '#8A5433',
  /** The loafers on TR-03. */
  leather: '#5A4636',
} as const;

// ---------------------------------------------------------------------------
// Metrics — transcribed from the approved frames
// ---------------------------------------------------------------------------

/** The text column. Wider than the app's 20pt gutter, as the frames set it. */
export const PAD = 26;
/** The plates bleed 6pt wider than the words, which is what makes them lead. */
export const PLATE_PAD = 20;
/** TR-03's miniature is inset further still — it is a picture of a page. */
export const MORNING_PAD = 34;
/** The foot: the CTA's own gutter. */
export const ACTION_PAD = 20;

export const EYEBROW_SIZE = 11.5;
export const EYEBROW_SIZE_AX = 15;
export const EYEBROW_SIZE_SHORT = 10.5;
export const EYEBROW_TRACKING = 0.16;

export const HEADLINE_SIZE = 38;
export const HEADLINE_SIZE_AX = 40;
export const HEADLINE_SIZE_SHORT = 29;
export const HEADLINE_LEADING_RATIO = 1.05;

export const BODY_SIZE = 15;
export const BODY_SIZE_AX = 21;
export const BODY_SIZE_SHORT = 14;

/**
 * The one filled CTA. 56 at the default setting, 60 once the label needs the
 * room — height is the only thing that grows, and nothing is capped, truncated
 * or scaled down. The radius is always half the height: the frames draw a
 * capsule, which is the same departure from the constitution's "labelled
 * controls 12" that redesign 19's `RunButton` already ships.
 */
export const CTA_HEIGHT = 56;
export const CTA_HEIGHT_AX = 60;
export const CTA_LABEL_SIZE = 17;
export const CTA_LABEL_SIZE_AX = 19;
export const CTA_LABEL_SIZE_SHORT = 16;

/** TR-03's text action. Never a second button — the atlas is explicit. */
export const SECONDARY_HEIGHT = 48;
export const SECONDARY_HEIGHT_AX = 56;

/** Skip. 44 at the tap floor, 56 once it is a full row in the foot. */
export const SKIP_HEIGHT = 44;
export const SKIP_HEIGHT_AX = 56;
export const SKIP_LABEL_SIZE = 15;
export const SKIP_LABEL_SIZE_AX = 19;

/** The progress marks — dashes, not dots. */
export const MARK_WIDTH = 22;
export const MARK_HEIGHT = 4;
export const MARK_GAP = 7;

export const PLATE_RADIUS = 22;
export const PLATE_RADIUS_COMPACT = 18;
export const WELL_RADIUS = 12;
export const WELL_RADIUS_COMPACT = 10;
export const CARD_RADIUS = 20;
export const CARD_RADIUS_COMPACT = 16;

/**
 * The screen height below which the tour draws its compact plates.
 *
 * 700, which puts the 667pt SE class on the short side and every notched device
 * on the full one. Read from `useWindowDimensions().height` — the real screen,
 * never a measured layout, so it is known before the first paint and the plate
 * does not resize under the reader.
 */
export const SHORT_DEVICE_HEIGHT = 700;

// ---------------------------------------------------------------------------
// Composition — the one place the frames relayout
// ---------------------------------------------------------------------------

/**
 * What a given text size and screen height draws.
 *
 * Four decisions, taken together because the frames take them together and
 * because a screen that moves Skip without also shrinking its plate has run out
 * of room in a different place than the one the accessibility frame drew.
 *
 *   - `skip: 'foot'` — at AX the corner affordance becomes a full row above the
 *     CTA. A 19pt "Skip" in a top-right corner is either clipped by the plate
 *     that now reaches the status bar or it pushes the plate off the screen;
 *     the frames move it into the foot, where it stacks with the action and
 *     both stay ≥56pt. IT IS NEVER REMOVED — see `skipVisible` in
 *     `tour-state.ts` for the frames it appears on at all.
 *   - `marks: false` — at AX the three dashes go. They are the eyebrow's job
 *     said again in a glance ("One · The promise" is on screen at 15pt), and
 *     the foot at that size has two 56pt rows in it already. Nothing is lost:
 *     the progress is still announced to VoiceOver from the plate.
 *   - `plate: 'compact'` — the illustrations shrink rather than the type. TR-01
 *     drops from six wells to three, TR-02's result card drops its caption, and
 *     TR-03's miniature drops its footer row. Composition changes; nothing is
 *     scaled below its documented size and no sentence is truncated.
 *   - `step: 'short'` — the 667pt screen sets its type one step down, which is
 *     what the short-device frame draws. This is a HEIGHT decision only; it
 *     never fires from the text size, because shrinking type in response to
 *     somebody asking for larger type is the one move the accessibility note
 *     forbids outright.
 */
export type TourMeasure = {
  readonly large: boolean;
  readonly short: boolean;
  readonly skip: 'corner' | 'foot';
  readonly marks: boolean;
  readonly plate: 'full' | 'compact';
  readonly eyebrowSize: number;
  readonly headlineSize: number;
  readonly bodySize: number;
  readonly ctaHeight: number;
  readonly ctaLabelSize: number;
  readonly secondaryHeight: number;
  readonly skipHeight: number;
  readonly skipLabelSize: number;
};

export function tourMeasure({
  fontScale,
  height,
}: {
  fontScale: number;
  height: number;
}): TourMeasure {
  const large = fontScale >= AX_STACK_SCALE;
  // A short screen at a large text size is the large composition, not a third
  // one: the type must grow, and the plate is already compact in both.
  const short = !large && height < SHORT_DEVICE_HEIGHT;

  return {
    large,
    short,
    skip: large ? 'foot' : 'corner',
    marks: !large,
    plate: large || short ? 'compact' : 'full',
    eyebrowSize: large ? EYEBROW_SIZE_AX : short ? EYEBROW_SIZE_SHORT : EYEBROW_SIZE,
    headlineSize: large ? HEADLINE_SIZE_AX : short ? HEADLINE_SIZE_SHORT : HEADLINE_SIZE,
    bodySize: large ? BODY_SIZE_AX : short ? BODY_SIZE_SHORT : BODY_SIZE,
    ctaHeight: large ? CTA_HEIGHT_AX : CTA_HEIGHT,
    ctaLabelSize: large ? CTA_LABEL_SIZE_AX : short ? CTA_LABEL_SIZE_SHORT : CTA_LABEL_SIZE,
    secondaryHeight: large ? SECONDARY_HEIGHT_AX : SECONDARY_HEIGHT,
    skipHeight: large ? SKIP_HEIGHT_AX : SKIP_HEIGHT,
    skipLabelSize: large ? SKIP_LABEL_SIZE_AX : SKIP_LABEL_SIZE,
  };
}

// ---------------------------------------------------------------------------
// The garments, as drawn shapes
// ---------------------------------------------------------------------------

/**
 * Seven garment silhouettes, as SVG polygon points in a 0–100 box.
 *
 * The frames draw these as CSS `clip-path: polygon(…)` on a sized span, which
 * is a percentage-of-the-box coordinate system. An `Svg` with
 * `viewBox="0 0 100 100"` and `preserveAspectRatio="none"` is the same
 * coordinate system, so these are the frame's own numbers rather than a
 * redrawing of them.
 *
 * WHY DRAWINGS AND NOT THE BUNDLED SAMPLE PHOTOGRAPHS. The shipped tour used
 * the four licensed sample garments the Today empty state draws. The approved
 * frames replace them with flat glyphs, and it is the right call for the one
 * screen whose whole subject is "photograph YOUR clothes": a photograph on this
 * page is either mistaken for the reader's closet or read as a stock model of
 * one. A drawing is unmistakably a diagram — which is also why every plate is
 * announced to VoiceOver as a sample.
 */
export const GARMENT_SHAPES = {
  /** A boxy tee. */
  tee: '20,0 80,0 100,20 86,30 86,100 14,100 14,30 0,20',
  dress: '32,0 40,6 60,6 68,0 64,34 100,100 0,100 36,34',
  /** The notch-collar blouse — TR-02's subject and TR-03's top. */
  blouse: '18,0 36,0 50,10 64,0 82,0 100,22 84,32 84,100 16,100 16,32 0,22',
  trousers: '4,0 96,0 88,100 58,100 50,38 42,100 12,100',
  boot: '16,0 74,0 74,68 100,74 100,100 16,100',
  skirt: '14,0 86,0 100,100 0,100',
  loafer: '0,30 26,8 74,8 100,30 100,100 0,100',
} as const;

export type GarmentShape = keyof typeof GARMENT_SHAPES;

/** One cell of a plate: a well, and a garment drawn in it. */
export type PlateCell = {
  readonly shape: GarmentShape;
  /** The garment's ink. */
  readonly fill: string;
  /** The well behind it. `null` means the plate's accent — oxblood. */
  readonly well: string | null;
  readonly width: number;
  readonly height: number;
};

/**
 * TR-01 — six pieces of a closet, two rows of three.
 *
 * The last cell is the accent: one oxblood well among five neutral ones, which
 * is the directive's "colour becomes structural" said in the smallest possible
 * way. It is deliberately the LAST cell, so the eye lands on it after reading
 * the grid rather than before.
 */
export const CLOSET_PLATE: readonly PlateCell[] = [
  { shape: 'tee', fill: TOUR.linen, well: TOUR.inkWell, width: 52, height: 72 },
  { shape: 'dress', fill: TOUR.linenLight, well: TOUR.inkWellAlt, width: 52, height: 72 },
  { shape: 'blouse', fill: TOUR.stone, well: TOUR.inkWell, width: 50, height: 66 },
  { shape: 'trousers', fill: TOUR.stoneWarm, well: TOUR.inkWellAlt, width: 48, height: 70 },
  { shape: 'boot', fill: TOUR.stoneDeep, well: TOUR.inkWell, width: 52, height: 60 },
  { shape: 'skirt', fill: TOUR.linenPale, well: null, width: 52, height: 66 },
] as const;

/**
 * Which three survive the compact plate — NOT the first three.
 *
 * The oxblood cell has to be one of them or the compact plate loses the only
 * colour on the frame, so the row is the two that open the grid plus the one
 * that closes it. The accessibility frame draws exactly this.
 */
export const CLOSET_COMPACT_CELLS = [0, 1, 5] as const;

export function closetCells(plate: TourMeasure['plate']): readonly PlateCell[] {
  if (plate === 'full') return CLOSET_PLATE;
  return CLOSET_COMPACT_CELLS.map((i) => CLOSET_PLATE[i]!);
}

/** TR-01's grid, three across on both compositions. */
export const CLOSET_COLUMNS = 3;
export const CLOSET_WELL_HEIGHT = 98;
export const CLOSET_WELL_HEIGHT_COMPACT = 78;
export const CLOSET_GAP = 8;

/** TR-02 — the photograph, and what it comes back as. */
export const CAMERA_BEFORE: PlateCell = {
  shape: 'blouse',
  fill: TOUR.greige,
  well: TOUR.well,
  width: 78,
  height: 104,
};
export const CAMERA_AFTER: PlateCell = {
  shape: 'blouse',
  fill: TOUR.camel,
  well: null,
  width: 74,
  height: 98,
};
export const CAMERA_CARD_HEIGHT = 196;
export const CAMERA_CARD_HEIGHT_COMPACT = 104;
/** The viewfinder corners — a drawing of a frame, never a live preview. */
export const VIEWFINDER_CORNER = 18;
export const VIEWFINDER_STROKE = 2.5;
export const VIEWFINDER_INSET = 12;
/** The chevron between the two halves. A graphic; it carries no content. */
export const CHEVRON_COLUMN = 26;
export const CHEVRON_COLUMN_COMPACT = 22;
export const CHEVRON_SIZE = 11;

/** TR-03 — the page the habit produces, in miniature. */
export const MORNING_PLATE: readonly PlateCell[] = [
  { shape: 'blouse', fill: TOUR.linen, well: TOUR.well, width: 44, height: 62 },
  { shape: 'skirt', fill: TOUR.camel, well: TOUR.wellAlt, width: 44, height: 60 },
  { shape: 'loafer', fill: TOUR.leather, well: TOUR.wellPale, width: 46, height: 38 },
] as const;

export const MORNING_WELL_HEIGHT = 96;
export const MORNING_WELL_HEIGHT_COMPACT = 74;
export const MORNING_WEEKDAY_SIZE = 20;
export const MORNING_WEEKDAY_SIZE_COMPACT = 17;
export const MORNING_WEATHER_SIZE = 13;
export const MORNING_FOOTER_SIZE = 12.5;

/**
 * TR-02's result card carries its caption; the miniature carries its footer.
 * Both go on the compact plate, and they go for the same reason: the picture
 * has to shrink and a two-line caption under a 104pt card is the first thing
 * that stops being legible.
 */
export function captionVisible(plate: TourMeasure['plate']): boolean {
  return plate === 'full';
}
