/**
 * Redesign 23 — Add clothes (the chooser), as measurements and copy.
 *
 * `src/app/add-clothes.tsx` holds the routing and the gates; `DoorPlate` draws
 * a door; this file holds everything the frame decides that is not already in
 * `intake-routes.ts`. Same split, and the same reason, as
 * `features/onboarding/ten-spec.ts`: a screen that types its own numbers and
 * its own hexes is a screen nobody can check against an artifact, and the
 * wave's no-hex rule is only enforceable if there is one place the hexes may
 * live.
 *
 * Nothing here imports anything. `tests/add-clothes-layout.test.ts` reads it
 * directly, which is only possible while that stays true.
 *
 * ── THE FRAME'S TOKENS, RECONCILED AGAINST THE PALETTE ────────────────────
 *
 * The artifact's token line is: paper #FBFAF6 · ink #1C1A16 · oxblood #6E2B2B ·
 * clay #B08A76 · blush #F7EDE8 · fill #F0ECE3 · sand #E4DED2 · muted #6B665C.
 * Seven of those eight ARE palette values under their palette names — canvas,
 * ink, accent, accentWarm, blush, tray, muted — so the screen spends tokens
 * rather than literals for every ground and every line of type.
 *
 * THE DOOR GROUND IS THE ONE THAT MOVED, AND IT MOVED FOR CONTRAST. The frame
 * draws the four doors on four near-identical warm tints (#EFE7DC, #E9E3D8,
 * #EDE6DA, #F0E8DF — one per door, within three steps of each other and of
 * `sand`). Two things are wrong with shipping them as drawn:
 *
 *   1. `muted` on #E9E3D8 is 4.47:1. That is below AA, and the method line
 *      under every door name is set in `muted` at 13–14px, which is never
 *      large text. `muted` on `sand` (#EAE5DB) is 4.55:1 and passes — the
 *      palette's darkest registered ground is registered precisely because
 *      `tests/contrast.test.ts` proves every text role against it.
 *   2. The frame's own handoff says the four peers share "one tint weight".
 *      Four tints that differ by two steps are one tint weight expressed as
 *      four numbers; `sand` is the same statement made once, and it is the
 *      statement the equal-doors law actually cares about.
 *
 * So all four doors are `sand`. The visible difference is under 1%, and the
 * contrast claim becomes provable rather than approximately true.
 *
 * ── THE ART TONES ─────────────────────────────────────────────────────────
 *
 * The four glyph tiles stop being SF Symbols and become drawn imagery — the
 * directive's "three equal designed door cards with imagery", and the one
 * thing on this page that is genuinely new rather than restyled. Their fills
 * are the artifact's, verbatim, and they are ILLUSTRATION, not chrome: no text
 * is ever set on them, so no contrast role applies and none is claimed.
 *
 * Precedent for a named illustration table rather than palette tokens:
 * `SAMPLE_DOTS` in `components/today/sample-plate.tsx`, which holds the three
 * garment colours of the example plate for the same reason — a drawn object's
 * colours are not the interface's colours, and forcing them through the
 * palette would either distort the drawing or add tokens the interface never
 * uses.
 *
 * Two of them are palette values and are noted as such below; the rest are the
 * frame's own.
 */

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * The peer line, and why it no longer branches.
 *
 * It used to carry the camera's condition — "Three doors are open. The camera
 * needs permission in Settings." — because the door itself said only that it
 * could not open. The frame moves that sentence ONTO the camera door, where it
 * also names the three that still work, so the count above the group would now
 * be saying a second time what the door says once, and saying it further from
 * the control it is about.
 *
 * Nothing is lost: the blocked and module-unavailable sentences below both
 * begin with the cause and end with the doors that work, which is more than
 * the branch ever carried.
 */
export const PEER_LINE = 'Four ways in. Any of them works.';

/**
 * AC-02 — the camera denied at the system level.
 *
 * The cause first, then what is open. No blame, and no privacy claim: the
 * frame's earlier "Your photos stay put either way" was withdrawn from this
 * screen because it is false for anyone who has granted processing consent,
 * and a privacy sentence true for only some readers is the worst kind.
 */
export const CAMERA_BLOCKED_LINE =
  'Camera access is off for Cinch. Photo library, product search and voice still work.';
export const CAMERA_BLOCKED_ACTION = 'Open Settings';

/**
 * CP-04 — no camera module in this binary. A different cause and a different
 * remedy, which is why it may not borrow the sentence above: there is no
 * switch in Settings to send anybody to, and updating is the only thing that
 * changes the answer.
 */
export const CAMERA_MODULE_LINE =
  'This build has no camera module. Updating Cinch will bring it back.';
/**
 * The action lands on Help, not the App Store — the same destination
 * `/camera-unavailable` already sends this sentence to, for the reason written
 * there: "sending somebody straight out of the app is a bigger jump than the
 * sentence promised, and Help is where the instruction actually lives."
 */
export const CAMERA_MODULE_ACTION = 'How to update';

/**
 * Declined processing consent, stated on the door it changes.
 *
 * A working mode rather than a dead end, and reversible — which is what the
 * action is for. The chooser already computes `declined`; before this frame it
 * computed it and drew nothing, so the one place the choice was visible was
 * the destination, after the tap.
 */
export const LOCAL_MODE_LINE =
  'Photographs stay on this device. You’ll type the category, color and fabric yourself.';
export const LOCAL_MODE_ACTION = 'Change this';

/**
 * AC-03's notice, unchanged from what ships.
 *
 * The frame draws no full-shelf notice at all — its at-cap state is the four
 * doors plus a "30 of 30" colophon. That is a copy deletion rather than a
 * restyle, and it would take the free recovery with it: `/storage` is reached
 * from here and the notice is the only thing that names it. The sentences and
 * the action are therefore the shipped ones, byte for byte, wearing the new
 * notice geometry. Recorded as a deviation.
 */
export const SHELF_FULL_TITLE = 'The active shelf is full';
export const SHELF_FULL_BODY =
  'Adding still starts normally. Once the new photograph or description exists, Cinch asks you to store a piece you are not reaching for — nothing you just added is lost while you decide. Stored pieces keep their photographs, wear history and price.';
export const SHELF_FULL_ACTION = 'See stored';

/**
 * The colophon — "N of N active pieces", set uppercase and tracked.
 *
 * A count, printed only when known: the caller omits the whole line while the
 * capacity query is unresolved rather than printing a placeholder or a dash.
 * Never a bar, a percentage, a streak or a countdown.
 *
 * THE WORD IS "ACTIVE", which is the repository's own term for the unarchived
 * shelf and the same word Profile's membership row uses. The atlas said
 * "awake" once and was corrected on 2026-08-12; two names for one count across
 * two screens is how a number stops being believed.
 */
export function capacityColophon(used: number, limit: number): string {
  return `${used} of ${limit} active pieces`;
}

// ---------------------------------------------------------------------------
// Geometry — the page. (A door's own geometry lives on `DoorPlate`.)
// ---------------------------------------------------------------------------

export const AC = {
  /** Between the peer doors. The frame's 10, not the 12 the old stack used. */
  doorGap: 10,
  /** Under the title row, above the peer line. */
  peerLineTop: 6,
  /** Between the peer line and the first door. */
  peerLineBottom: 10,
  /** Under the lead door, before the peer line. */
  leadBottom: 14,
  /** The disclosure tray: its own ground, inset from the doors by nothing. */
  disclosureTop: 12,
  disclosureRadius: 12,
  disclosurePadV: 12,
  disclosurePadH: 14,
  /** Above the colophon. */
  colophonTop: 12,
  /** The colophon is set at 13, not the 10 `text-colophon` gives by default. */
  colophonSize: 13,
  colophonTracking: 0.1,
  /** The full-shelf notice — the disclosure tray's geometry, one step up. */
  noticeRadius: 12,
  noticePad: 14,
  noticeTop: 12,
} as const;

// ---------------------------------------------------------------------------
// The drawn tiles
// ---------------------------------------------------------------------------

/** Which drawing a door carries. Keyed by `IntakeRouteKey`, plus the lead door. */
export type DoorArtKind = 'catalogue' | 'camera' | 'library' | 'voice' | 'ten';

/**
 * The illustration fills. See the header: drawing, not chrome.
 *
 * `clay` is the palette's `accentWarm` and `oxblood` is its `accent`; both are
 * written here as literals so the table reads as one drawing rather than as a
 * drawing with two imports in the middle of it, and the test asserts they
 * still equal the tokens.
 */
export const ART = {
  /** accentWarm. */
  clay: '#B08A76',
  bark: '#8A5433',
  tan: '#C89263',
  stone: '#8A8375',
  slate: '#5A544A',
  pebble: '#A39B8B',
  linen: '#C6BCA8',
  sage: '#5A6552',
  rust: '#A9673C',
  /** accent. */
  oxblood: '#6E2B2B',
  tenTan: '#D9A87A',
  tenAmber: '#C89263',
  tenCream: '#E8DFCC',
} as const;
