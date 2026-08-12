/**
 * DEV ONLY — deterministic walkthrough and procession data for the Wave 3
 * Group 1 fixture routes (`src/app/dev-w3-g1-*.tsx`).
 *
 * DETERMINISM IS THE POINT. Nothing here reads a clock, a random source or the
 * network: every id, ordinal, timestamp and count is a literal, so a fixture
 * route photographed twice produces the same bytes. `created_at` is a frozen
 * string for the same reason — a fixture that formatted `new Date()` would
 * change every day and every capture would be a diff.
 *
 * Kept as a plain `.ts` beside the module it models rather than inside a route,
 * because half a dozen fixture routes need the same twenty-three-piece
 * walkthrough and a second copy would drift from the first.
 */

import type { IntakeDraftRow } from './queries';

/** The one frozen instant every fixture in this group is dated at. */
export const FROZEN_ISO = '2026-08-07T09:41:00.000Z';

/** The frozen weekday TR-06's resume card prints. */
export const FROZEN_WEEKDAY = 'Tuesday';

const SESSION = 'dev-w3-g1-session';

function draft(
  ordinal: number,
  name: string,
  slot: string,
  colour: string,
  utterance: string,
  extra: Partial<IntakeDraftRow> = {},
): IntakeDraftRow {
  return {
    id: `dev-draft-${ordinal}`,
    session_id: SESSION,
    user_id: 'dev-user',
    ordinal,
    name,
    slot,
    colour_term: colour,
    colour_oklch: null,
    fabric: null,
    pattern: null,
    formality: null,
    warmth: null,
    quantity: 1,
    confidence: 0.9,
    state: 'draft',
    utterance,
    image_path: null,
    created_at: FROZEN_ISO,
    ...extra,
  } as IntakeDraftRow;
}

/**
 * The twenty-three-card walkthrough the atlas draws throughout: 7 tops, 5
 * bottoms, 2 dresses, 4 shoes, 3 coats, 2 bags.
 *
 * TWENTY-THREE ROWS, not twenty rows with quantities that add to twenty-three.
 * "23 pieces, in your own words" and "4 of 23" are both counts of CARDS — one
 * per phrase heard — and an ambiguous plural is still one phrase until the
 * stepper answers it. Written out rather than generated so the composition
 * chips are the atlas's own numbers and not whatever a loop produced.
 *
 * Index 3 is the ambiguous card, so PR-03 opens on "4 of 23" like PR-01 does
 * and the two frames can be read against each other.
 */
export const DEV_DRAFTS: IntakeDraftRow[] = [
  draft(0, 'White linen shirt', 'base_top', 'white', 'a white linen shirt, the one I wear in summer', {
    fabric: 'linen',
  }),
  draft(1, 'Cream mohair jumper', 'mid_layer', 'cream', 'the cream mohair jumper'),
  draft(2, 'Navy crew knit', 'base_top', 'navy', 'a navy crew knit'),
  draft(3, 'Plain black t-shirt', 'base_top', 'black', 'a few plain black tees', {
    state: 'ambiguous',
    quantity: 3,
    confidence: 0.42,
  }),
  draft(4, 'Grey marl tee', 'base_top', 'grey', 'a grey marl tee'),
  draft(5, 'Striped breton top', 'base_top', 'navy', 'the striped breton'),
  draft(6, 'Olive overshirt', 'mid_layer', 'olive', 'an olive overshirt'),
  draft(7, 'Charcoal trousers', 'bottom', 'charcoal', 'the charcoal tailored trousers'),
  draft(8, 'Corduroy skirt', 'bottom', 'beige', 'a beige corduroy skirt'),
  draft(9, 'Indigo jeans', 'bottom', 'indigo', 'my indigo jeans'),
  draft(10, 'Black jeans', 'bottom', 'black', 'a pair of black jeans'),
  draft(11, 'Linen shorts', 'bottom', 'sand', 'sand linen shorts'),
  draft(12, 'Green midi dress', 'dress', 'green', 'a green midi dress'),
  draft(13, 'Black shift dress', 'dress', 'black', 'the black shift dress'),
  draft(14, 'Brown loafers', 'footwear', 'brown', 'those brown loafers'),
  draft(15, 'Black boots', 'footwear', 'black', 'black leather boots'),
  draft(16, 'White trainers', 'footwear', 'white', 'white trainers'),
  draft(17, 'Tan sandals', 'footwear', 'tan', 'tan sandals'),
  draft(18, 'Shearling coat', 'outerwear', 'cognac', 'a cognac shearling coat'),
  draft(19, 'Grey wool coat', 'outerwear', 'grey', 'a heavy grey coat'),
  draft(20, 'Navy raincoat', 'outerwear', 'navy', 'the navy raincoat'),
  draft(21, 'Cognac tote', 'bag', 'cognac', 'the cognac leather tote'),
  draft(22, 'Black crossbody', 'bag', 'black', 'a small black crossbody'),
];

/** V-13c's transcript — the atlas's own take, verbatim. */
export const DEV_UNPARSED_TRANSCRIPT =
  '“… okay so I’m in here now, hang on, the light’s terrible — right. I don’t know how much of this you want. Most of it is stuff I never wear, honestly. Should I be doing this by season? I’ll come back to it.”';

/** Four minutes, the duration every V-04 and V-13d frame in the atlas quotes. */
export const DEV_DURATION_MS = 4 * 60 * 1000;
