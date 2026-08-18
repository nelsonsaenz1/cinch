/**
 * Redesign 21 — The Ten, as the approved frames decide it.
 *
 * Everything the nineteen frames DECIDE — colour, geometry, which composition a
 * given text size and screen height gets, and the tone of the progress band —
 * lives here, in a pure `.ts`, so `tests/the-ten-layout.test.ts` can exercise it
 * directly. `ten-parts.tsx` draws; it chooses nothing.
 *
 * Same split, and the same reason, as `tour-spec.ts` and `auth-run-spec.ts`:
 * `scripts/run-tests.mjs` bundles with esbuild, which cannot parse React
 * Native's Flow source, so anything a test needs to read has to be reachable
 * without importing a component.
 *
 * ── WHAT REDESIGN 21 CHANGED ────────────────────────────────────────────────
 *
 * The brief is one sentence — "the grid is the hero; slots as warm tray wells
 * with settling photographs; the count as a designed progress band" — and the
 * frames spend it on three structural moves:
 *
 *  1. THE COUNT BECOMES A BAND. It was an 11pt tracked eyebrow above the title
 *     reading `3 of 10`. It is now a 53pt plate under the title carrying an
 *     uppercase word count, a trailing status, and ten pips that fill. The band
 *     changes GROUND as the run progresses — tray while nothing is filed, blush
 *     while it fills, oxblood once it is complete — which is the directive's
 *     "colour becomes structural" said on the one element that has a state.
 *  2. THE TENTH WELL SPANS THE TRAY. Nine wells in a three-up grid, then one
 *     full-width well beneath them. Ten in a 3-column grid is three rows and a
 *     ragged remainder; the frames close the tray with a band instead, and that
 *     band is the piece the flow is counting down to.
 *  3. THE CARD UNDER THE GRID BECOMES A FOOT. `SlotCard` argued for the next
 *     piece in a bordered plate with two buttons in it. The frames replace it
 *     with one full-width 56pt oxblood capsule whose LABEL is the argument
 *     ("Photograph a piece" → "Add the next" → "Add the last one" → "See your
 *     first outfits"), which is the directive's "less text, always" and its
 *     "buttons with presence" in the same move.
 *
 * ── WHAT IT DID NOT CHANGE ──────────────────────────────────────────────────
 *
 * The slot machinery (`ten-slots.ts`), the replacement machine
 * (`ten-replace.ts`), the readiness model (`starter-readiness.ts`) and the
 * storage-full doors are the shipped contract, restyled rather than rewritten.
 * The settling photograph is the shipped `FadeIn` on the cutout's URI — reused,
 * not rebuilt. Nothing here decides a route, writes a row, or raises a sheet.
 *
 * ── THE DIALECT ─────────────────────────────────────────────────────────────
 *
 * Same settlement `tour-spec.ts` records. Values that match a palette token ARE
 * that token, reached through `useTheme()` at the call site — canvas, tray,
 * sand, ink, muted, accent, blush and blushRule are never re-typed below. What
 * is left is the three sand steps the wells are separated with and the two
 * amber values the trouble plates are washed in, and even those are derived
 * from `warningAlpha` where the palette can reach them.
 *
 * TWO PLACES THE CONTRAST LAW OVERRULES THE FRAME (see `theme/contrast.ts`):
 *
 *   - the trouble plates draw their eyebrow #8A6A2B, a dark amber that is not a
 *     palette value and is unreachable from `warning` (#C58A2E) without
 *     inventing a second one. An 11.5pt tracked line is never large text, so it
 *     is set in `muted`, exactly as the tour set its clay eyebrow.
 *   - the empty band's ground is drawn #EFEBE1. That is `tray` to within a
 *     rounding step, and `tray` is what it is set in — which matters because
 *     `muted` on the frame's own #EAE5DB (`sand`) is 4.51:1, close enough to the
 *     4.5 floor that a future rounding of either value would break it. On `tray`
 *     the same label is 5.07:1.
 *
 * AND ONE THE TYPE RULE OVERRULES: every label the frames set in a 600 weight is
 * set in the one sans cut this app has. TY-01 deleted every weight from product
 * code and `tests/type-weight.test.ts` enforces it; the emphasis is rebuilt from
 * size, colour and case exactly as `run-parts.tsx` rebuilt it for the auth run.
 */

// ---------------------------------------------------------------------------
// Colour — The Ten's dialect
// ---------------------------------------------------------------------------

/**
 * The values that are NOT palette tokens, and cannot be composited from one.
 *
 * Three sand steps and one amber. Everything else the frames draw is a token.
 */
export const TEN = {
  /**
   * A filled well's ground, behind the photograph. Deeper than `tray` so a
   * cutout with a pale garment in it still reads as sitting IN something.
   * The frames alternate two steps across the tray to keep nine cells from
   * reading as one slab; `wellFillIndex` decides which cell gets which.
   */
  wellFilled: '#E4DED2',
  wellFilledAlt: '#DFD9CC',
  /** An empty well. One step LIGHTER than `tray` — a hole, not a tile. */
  wellEmpty: '#F4F1EA',
  /** A spent pip on the tray and blush bands. The lit one is `accent`. */
  pipSpent: '#DFD9CC',
} as const;

/**
 * The trouble plates' ground — amber at the house's own low step.
 *
 * `warningAlpha(0.16)` over canvas resolves to #F4EBDC, which is the frame's
 * #F6ECD9 to within a rounding step. Derived rather than eyedropped, for the
 * reason `warningAlpha` exists at all: a fourth amber nobody can trace back to
 * a token is how a palette stops being one.
 */
export const TROUBLE_GROUND_ALPHA = 0.16;

// ---------------------------------------------------------------------------
// Metrics — transcribed from the approved frames
// ---------------------------------------------------------------------------

/** The page gutter. The app's own 20, which the frames draw. */
export const PAD = 20;

/** Wells across the tray, at the default type scale. */
export const TRAY_COLUMNS = 3;
/** Wells across the tray once the reader is at an accessibility text size. */
export const TRAY_COLUMNS_AX = 2;

/**
 * The gaps between wells. Different on the two axes, and the frames draw them
 * that way: 12 across, 8 down. Both on the 1/8/12/20/24/28/44 spacing scale.
 */
export const TRAY_GAP = 12;
export const TRAY_ROW_GAP = 8;

export const WELL_RADIUS = 14;
/**
 * A well's height as a share of its width — 127 tall in a 110 column, measured
 * off the frames at their own 393pt width.
 *
 * PORTRAIT, which reverses the landscape 86/111 the shipped grid used. That
 * ratio was chosen to keep ten square cells above the fold; the frames buy the
 * same height back by spanning the tenth well across the tray instead of giving
 * it a row of its own with two holes beside it. A garment photographed standing
 * up belongs in a portrait well, and this is the first composition that could
 * afford one.
 */
export const WELL_ASPECT = 127 / 110;
/**
 * And at accessibility sizes, where two columns make each well 60% wider: the
 * frames flatten it rather than letting a single well fill the screen.
 */
export const WELL_ASPECT_AX = 148 / 170;
/** The tenth well's height, as a share of an ordinary well's. */
export const TENTH_HEIGHT_RATIO = 81 / 127;

/** The progress band. */
export const BAND_HEIGHT = 54;
export const BAND_RADIUS = 18;
export const BAND_PAD_H = 14;
export const BAND_PAD_TOP = 13;
export const BAND_PAD_BOTTOM = 11;
export const BAND_LABEL_SIZE = 13;
export const BAND_LABEL_TRACKING = 0.14;
export const BAND_TRAIL_SIZE = 15;
/** The trailing status, on the oxblood band. Canvas at 0.8 is 6.87:1 on accent. */
export const BAND_TRAIL_ON_ACCENT_ALPHA = 0.8;

/** The pips. Ten of them, and their width is derived so the run fills the band. */
export const PIP_HEIGHT = 6;
export const PIP_GAP = 3;
export const PIP_RADIUS = 3;

export const TITLE_SIZE = 36;
export const TITLE_SIZE_AX = 38;
export const TITLE_SIZE_SHORT = 30;
export const TITLE_LEADING_RATIO = 1.06;

export const SUB_SIZE = 15;
export const SUB_SIZE_AX = 19;
export const SUB_SIZE_SHORT = 14;

/** The one filled action. The directive's 56, and 60 once the label needs it. */
export const CTA_HEIGHT = 56;
export const CTA_HEIGHT_AX = 60;
export const CTA_LABEL_SIZE = 17;
export const CTA_LABEL_SIZE_AX = 19;

/** The text action under it. Never a second capsule — the frames are explicit. */
export const SECONDARY_HEIGHT = 48;
export const SECONDARY_HEIGHT_AX = 56;
export const SECONDARY_LABEL_SIZE = 16;
export const SECONDARY_LABEL_SIZE_AX = 19;

/** The trouble and no-room plates. */
export const PLATE_RADIUS = 20;
export const PLATE_PAD = 18;
export const PLATE_EYEBROW_SIZE = 11.5;
export const PLATE_EYEBROW_TRACKING = 0.16;
export const PLATE_HEADLINE_SIZE = 26;
export const PLATE_BODY_SIZE = 15.5;
/** The plates' own pill actions — shorter than the page CTA, still over the floor. */
export const PLATE_ACTION_HEIGHT = 52;

/**
 * The screen height below which the page draws its compact composition.
 *
 * 700, the same threshold the tour uses, which puts the 667pt SE class on the
 * short side and every notched device on the full one. Read from
 * `useWindowDimensions().height` — the real screen, never a measured layout, so
 * it is known before the first paint and the tray does not resize under anyone.
 */
export const SHORT_DEVICE_HEIGHT = 700;

/**
 * Where the accessibility recomposition begins.
 *
 * 1.35, carried over unchanged from the `ten-layout.ts` this module replaces:
 * iOS's five accessibility text sizes start above the largest standard one, and
 * `fontScale` crosses 1.35 at exactly that boundary on the current device table.
 * Deliberately NOT `AX_STACK_SCALE` (1.5), which is the closet's own threshold
 * for a different question — this page's threshold was argued against this
 * page's frames and `tests/w3-g1-ten-layout.test.ts` has pinned it since.
 *
 * One threshold, named once, so the tray, the band and the foot cannot disagree
 * about which composition they are in — a two-column tray under a band that
 * still prints its trailing status is worse than either composition alone.
 */
export const TEN_AX_FONT_SCALE = 1.35;

export function isAccessibilityScale(fontScale: number): boolean {
  return fontScale >= TEN_AX_FONT_SCALE;
}

// ---------------------------------------------------------------------------
// Composition — the two places the frames relayout
// ---------------------------------------------------------------------------

export type TenMeasure = {
  readonly large: boolean;
  readonly short: boolean;
  readonly columns: number;
  /** Whether the tenth well spans the tray. False only at accessibility sizes. */
  readonly wideTenth: boolean;
  /** Whether the band prints its trailing status beside the count. */
  readonly bandTrailing: boolean;
  readonly wellAspect: number;
  readonly titleSize: number;
  readonly subSize: number;
  readonly ctaHeight: number;
  readonly ctaLabelSize: number;
  readonly secondaryHeight: number;
  readonly secondaryLabelSize: number;
};

/**
 * What a given text size and screen height draws.
 *
 * TWO DECISIONS AT THE LARGEST TYPE, and the accessibility frame takes both:
 *
 *   - `columns: 2` and `wideTenth: false`. Three 110pt wells become three 110pt
 *     wells with a 22pt garment in them once everything else on the page has
 *     grown; the frames drop to two columns and flatten the well, which is
 *     recomposition rather than a cap. The tenth stops spanning because with an
 *     even column count there is no ragged remainder for it to close — ten in
 *     two columns is five clean rows.
 *   - `bandTrailing: false`. "Six to go" goes. It is the count said twice —
 *     "FOUR OF TEN" is on the same line at 13pt — and at AX the two of them
 *     collide in a 54pt band. Nothing is lost: the remaining count is still in
 *     the band's own accessibility label, which is what a reader at that text
 *     size is most likely to be hearing anyway.
 *
 * AND ONE ON A SHORT SCREEN: the type sets one step down. A HEIGHT decision
 * only — it never fires from the text size, because shrinking type in response
 * to somebody asking for larger type is the one move the accessibility note
 * forbids outright.
 */
export function tenMeasure({
  fontScale,
  height,
}: {
  fontScale: number;
  height: number;
}): TenMeasure {
  const large = isAccessibilityScale(fontScale);
  // A short screen at a large text size is the large composition, not a third
  // one: the type must grow, and the tray is already two-up in both.
  const short = !large && height < SHORT_DEVICE_HEIGHT;

  return {
    large,
    short,
    columns: large ? TRAY_COLUMNS_AX : TRAY_COLUMNS,
    wideTenth: !large,
    bandTrailing: !large,
    wellAspect: large ? WELL_ASPECT_AX : WELL_ASPECT,
    titleSize: large ? TITLE_SIZE_AX : short ? TITLE_SIZE_SHORT : TITLE_SIZE,
    subSize: large ? SUB_SIZE_AX : short ? SUB_SIZE_SHORT : SUB_SIZE,
    ctaHeight: large ? CTA_HEIGHT_AX : CTA_HEIGHT,
    ctaLabelSize: large ? CTA_LABEL_SIZE_AX : CTA_LABEL_SIZE,
    secondaryHeight: large ? SECONDARY_HEIGHT_AX : SECONDARY_HEIGHT,
    secondaryLabelSize: large ? SECONDARY_LABEL_SIZE_AX : SECONDARY_LABEL_SIZE,
  };
}

// ---------------------------------------------------------------------------
// The tray's geometry
// ---------------------------------------------------------------------------

/**
 * The tray as REAL ROWS, never a wrapped run.
 *
 * `tests/tour-layout.test.ts` pins why, and the reason is load-bearing here
 * too: a well is sized by width and height together, and the only parent in
 * which `flex: 1` and `height` agree is a row. A percentage `flexBasis` is
 * wrong on its own terms as well — React Native does not subtract `gap` from
 * it, so three cells plus two gaps overflow the tray by a gap and a half.
 *
 * Returns slot INDEXES, so a grid of a different length cannot make the caller
 * type a ten. With the wide tenth the last row holds exactly one index, which
 * is how `TenTray` knows to span it.
 */
export function trayRows(total: number, m: Pick<TenMeasure, 'columns' | 'wideTenth'>): number[][] {
  const spans = m.wideTenth && total > 1;
  const gridded = spans ? total - 1 : total;
  const rows: number[][] = [];
  for (let i = 0; i < gridded; i += m.columns) {
    rows.push(Array.from({ length: Math.min(m.columns, gridded - i) }, (_, k) => i + k));
  }
  if (spans) rows.push([total - 1]);
  return rows;
}

/** A well's width, for a measured tray width at the columns that width holds. */
export function wellWidth(contentWidth: number, columns: number): number {
  return (contentWidth - TRAY_GAP * (columns - 1)) / columns;
}

/** A well's height, from the frames' own ratio at this composition. */
export function wellHeight(width: number, m: Pick<TenMeasure, 'wellAspect'>): number {
  return Math.round(width * m.wellAspect);
}

/** The spanning tenth well is shorter than the nine above it, by the frames' ratio. */
export function tenthHeight(ordinaryHeight: number): number {
  return Math.round(ordinaryHeight * TENTH_HEIGHT_RATIO);
}

/**
 * Which of the two sand steps a well takes.
 *
 * Alternating by ROW rather than by cell: alternating per cell makes a
 * chequerboard, which is a pattern the eye reads as meaning something. By row
 * it reads as a tray with a grain in it, which is all the frames are after.
 */
export function wellFillIndex(row: number): 0 | 1 {
  return (row % 2) as 0 | 1;
}

/** A pip's width, derived so ten of them plus their gaps fill the band exactly. */
export function pipWidth(bandInnerWidth: number, total: number): number {
  return (bandInnerWidth - PIP_GAP * (total - 1)) / total;
}

// ---------------------------------------------------------------------------
// The band's tone
// ---------------------------------------------------------------------------

/**
 * The three grounds the progress band takes.
 *
 * `complete` is the frames' one unqualified spend of oxblood as a FILL on this
 * page, and it fires on the count alone — ten wells taken — not on readiness.
 * That is deliberate: the band reports the tray, and the tray IS full. Whether
 * those ten pieces make an outfit is a different claim, it is made by the
 * subtitle and the repair plate, and conflating them is how the shipped screen
 * once told a closet of ten watches that it was ready.
 */
export type BandTone = 'empty' | 'filling' | 'complete';

export function bandTone(filled: number, total: number): BandTone {
  if (filled <= 0) return 'empty';
  return filled >= total ? 'complete' : 'filling';
}
