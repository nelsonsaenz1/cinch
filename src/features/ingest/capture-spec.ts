/**
 * Redesign 22 — Capture, as the twenty-two approved frames decide it.
 *
 * Everything the frames DECIDE — the dialect colours the palette cannot reach,
 * the geometry of the viewfinder chrome, which words a queue is described with,
 * and when the celebration is allowed to fire — lives here, in a pure `.ts`, so
 * `tests/capture-layout.test.ts` can exercise it without a camera, a render or
 * a native module. `capture-parts.tsx` draws; it chooses nothing.
 *
 * Same split, and the same reason, as `ten-spec.ts`, `tour-spec.ts` and
 * `auth-run-spec.ts`: `scripts/run-tests.mjs` bundles with esbuild, which
 * cannot parse React Native's Flow source, so anything a test needs to read has
 * to be reachable without importing a component. `@/theme/metrics` is the one
 * value import allowed here for exactly that reason — `@/theme/tokens` drags
 * react-native in.
 *
 * ── WHAT REDESIGN 22 CHANGED ────────────────────────────────────────────────
 *
 * The brief is one sentence — "viewfinder chrome minimal; batch review as large
 * cutout cards with keep/fix/drop as big tinted buttons with haptics; settled
 * state celebrates" — and the frames spend it on four structural moves:
 *
 *  1. THE CHROME COMES OFF THE PREVIEW. CP-01 carried a dashed framing
 *     rectangle, a "one piece, laid flat" sentence in a 132pt instruction foot,
 *     a filed-count pill floating over the garment and a Done pill. Frame 04
 *     keeps a close disc, one mode pill, four corner marks, a shutter and a
 *     library door — and nothing else. Every sentence that was floating on the
 *     live frame moves to the ask BEFORE the camera opens (frame 01) or the
 *     notice AFTER it (frames 08/17/19).
 *  2. THE QUEUE BECOMES A PAGE OF ROWS. CP-03's counted tray cards and
 *     horizontal thumbnail rail become a canvas page: a serif headline, a
 *     count subline, and one 64pt row per piece carrying its own ground and
 *     its own status word. "Each row shows its own state so the batch is
 *     legible piece by piece." The bar is still gone and is still not coming
 *     back — see `queue-count.ts`, which this does not replace.
 *  3. THE SETTLED BATCH GETS A DOOR AND, SOMETIMES, A CELEBRATION. Frame 09 is
 *     a grid of what just landed under one oxblood capsule; frame 10 is the
 *     whole page painted oxblood with the direction's own words on it.
 *  4. THE THREE DECISIONS BECOME TINTED SLABS. Frames 11/20/22 draw Keep as
 *     oxblood, Fix as sand and Drop as a bordered outline at 60pt — "
 *     differentiated by shape and weight, not colour alone".
 *
 * ── WHAT IT DID NOT CHANGE (and what may never change) ──────────────────────
 *
 * The camera CAPABILITY guard (`CAMERA_AVAILABLE`), the permission gate
 * (`useCameraGate`), the deferred `CameraView` wrapper, the consent sheet and
 * its local mode, the closet-full hold, the listing offer's trigger and
 * routing, and the invite line's condition are the shipped contract. They are
 * restyled by the parts below and rewired by nothing. `tests/camera-
 * availability.test.ts` and `tests/camera-deferred.test.ts` hold the first
 * three; `tests/capture-layout.test.ts` holds the last two.
 *
 * ── THE DIALECT ─────────────────────────────────────────────────────────────
 *
 * Same settlement `ten-spec.ts` records. Values that match a palette token ARE
 * that token, reached through `useTheme()` at the call site — canvas, tray,
 * sand, ink, muted, accent, blush and rule are never re-typed below. What is
 * left is the three stage greys the dark frames are built from, one sand step
 * between canvas and tray, and the two well fills, none of which the palette
 * can reach: the app has exactly one ink (#1C1A16) and the stage frames are
 * built on three deliberately deeper ones so a garment photographed against a
 * white wall is not the second-brightest thing on the screen.
 *
 * THREE PLACES THE CONTRAST LAW OVERRULES THE FRAME (see `theme/contrast.ts`):
 *
 *   - the "Filing" status word is drawn #B08A76 (`accentWarm`) on the blush
 *     row. That is 2.2:1 — a 13px status word is never large text. Set in
 *     `ink`, which keeps the row's ladder intact because the LADDER IS THE
 *     GROUND (tray → blush → the pale sand step), not the word.
 *   - the "Waiting" status word is drawn #A39B8B, which is `byline` to within
 *     a rounding step and 2.6:1 on its own ground. Set in `muted`.
 *   - the amber notice's eyebrow is drawn #8A6A2B, a dark amber that is not a
 *     palette value and is unreachable from `warning` (#C58A2E) without
 *     inventing a second one. An 11.5pt tracked line is never large text, so it
 *     is set in `muted` — the same answer `ten-spec.ts` reached for the same
 *     colour on the same kind of plate.
 *
 * AND ONE THE TYPE RULE OVERRULES: every label the frames set at weight 600 or
 * 700 is set in the one sans cut this app has. TY-01 deleted every weight from
 * product code and `tests/type-weight.test.ts` enforces it; the emphasis is
 * rebuilt from size, colour and ground exactly as `ten-parts.tsx` rebuilt it.
 */

import { MIN_TAP_TARGET } from '@/theme/metrics';

// ---------------------------------------------------------------------------
// Colour — Capture's dialect
// ---------------------------------------------------------------------------

/**
 * The values that are NOT palette tokens and cannot be composited from one.
 *
 * Three stage greys, one sand step, two well fills. Everything else the frames
 * draw is a token reached through `useTheme()`.
 */
export const CAPTURE = {
  /**
   * The stage's ground — the chrome band above and below the preview.
   *
   * Deeper than `ink` (#1C1A16) on purpose and by a visible amount: the frames
   * put a live photographic preview between two bands, and a band drawn in the
   * app's warm near-black reads as a slightly-off continuation of the picture
   * rather than as chrome. This is the one surface in the app that wants to
   * disappear.
   */
  stage: '#14120F',
  /** Behind the preview itself, while there is no frame to show yet. */
  preview: '#1E1B17',
  /** The library door's well, and a strip thumbnail's ground, on the stage. */
  stageWell: '#3A342C',
  /**
   * A row whose piece has not been started yet. One step LIGHTER than `tray`
   * and one step darker than `canvas` — a row that is present but not yet
   * anybody's business.
   */
  rowIdle: '#F4F1EA',
  /** A filled tile's ground in the settled grid — deeper than `tray`. */
  tileFilled: '#E4DED2',
  /** A settled tile's alternate step, so six cells do not read as one slab. */
  tileFilledAlt: '#DFD9CC',
} as const;

/**
 * `canvas` at the alphas the stage chrome is drawn with.
 *
 * Named rather than typed at four call sites, and kept to the small set of
 * steps `canvasAlpha`'s own docblock asks for: a control's ground, a mark, a
 * rule, a secondary label.
 */
export const STAGE_ALPHA = {
  /** The close disc's and the mode pill's ground. */
  chrome: 0.14,
  /** The library door's ground, before anything is held. */
  door: 0.12,
  /** The library door's hairline. */
  doorRule: 0.2,
  /** The four corner marks. */
  guide: 0.85,
  /** The describe glyph, which is a route and not the subject. */
  quiet: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Geometry — the numbers the frames draw
// ---------------------------------------------------------------------------

/**
 * The viewfinder's chrome, at the frames' own measures.
 *
 * `shutter` is 76 in every dark frame INCLUDING the 667pt one (frame 21's
 * annotation: "the 76pt shutter and the strip keep full size"), which is why it
 * is a constant rather than a function of screen height.
 */
export const VIEWFINDER = {
  /** The close disc — 44pt, a circle, at the tap floor exactly. */
  closeDiameter: MIN_TAP_TARGET,
  /** The mode / held pill: 44pt tall, capsule, 16pt of side padding. */
  pillHeight: MIN_TAP_TARGET,
  pillPadding: 16,
  /** One corner mark: 34pt arms, 3pt strokes, a 6pt outer radius. */
  cornerSize: 34,
  cornerStroke: 3,
  cornerRadius: 6,
  /** The framing guide's box, on a tall device. Frame 21 shrinks it; see below. */
  guideWidth: 250,
  guideHeight: 330,
  /** The shutter — the only filled element on the stage. */
  shutter: 76,
  shutterInner: 64,
  shutterInnerStroke: 2,
  /** The library door, and the strip thumbnail beside it. */
  door: 52,
  doorRadius: 12,
  stripThumb: 46,
  stripThumbHeight: 60,
  stripThumbRadius: 9,
  stripGap: 7,
  /** The count badge that rides the library door. */
  badgeDiameter: 22,
  /** The Review pill that replaces the door's slot once there is a deck. */
  reviewPillHeight: 52,
  reviewPillPadding: 18,
} as const;

/**
 * The framing guide on a short device — frame 21, a 667pt screen.
 *
 * "The guide shrinks with the preview". Expressed as a function rather than a
 * second constant so there is one rule and no cliff: the guide takes the
 * frames' 330pt where there is room and gives height back proportionally where
 * there is not, never going below the point at which four corner marks stop
 * describing a rectangle at all.
 */
export function guideHeightFor(previewHeight: number): number {
  if (previewHeight <= 0) return VIEWFINDER.guideHeight;
  const wanted = Math.min(VIEWFINDER.guideHeight, previewHeight - 72);
  return Math.max(VIEWFINDER.cornerSize * 3, wanted);
}

/**
 * The canvas pages' measures — filing, settled, celebration, resume, error.
 *
 * The three action heights are the frames' 56 / 52 / 46, all above the 44pt
 * floor. The radii are the frames' capsules; this page's dialect warms the
 * control radius past the app's `rounded-md` 12 exactly as the directive
 * permits ("radii may warm … the artifact decides"), and it is scoped to this
 * page rather than promoted to `button-spec.ts`, which every other screen reads.
 */
export const PAGE = {
  cta: 56,
  ctaRadius: 28,
  secondary: 52,
  secondaryRadius: 26,
  quiet: 46,
  /** One filing row, and the thumbnail inside it. */
  rowHeight: 64,
  rowRadius: 14,
  rowThumbWidth: 42,
  rowThumbHeight: 52,
  rowThumbRadius: 8,
  rowGap: 8,
  /** The settled grid — three up, and the celebration's five up. */
  tileRadius: 14,
  tileHeight: 132,
  tileGap: 9,
  celebrationTileRadius: 10,
  celebrationTileHeight: 88,
  celebrationTileGap: 7,
  /** An amber or oxblood notice plate. */
  plateRadius: 18,
  offerRadius: 22,
} as const;

/**
 * The three decisions, at the frames' measures.
 *
 * `flexKeep` is 1.4 against 1 and 1: the frames give Keep the wider slab
 * because it is the answer to almost every card, and the width is the third
 * signal after the ground and the border — "differentiated by shape and weight,
 * not colour alone", which is also what keeps the row legible to somebody who
 * cannot tell oxblood from sand.
 */
export const DECISION = {
  height: 60,
  radius: 16,
  gap: 9,
  flexKeep: 1.4,
  flexOther: 1,
  /** The bordered Drop slab's hairline, at the frames' 1.5. */
  dropStroke: 1.5,
} as const;

/**
 * Above this Dynamic Type multiplier the three decisions stack full width.
 *
 * Frame 20's annotation: "the cut-out gives up height, the chips wrap, and the
 * three decisions stack full width at 60pt each so none of them is ever a
 * cramped third." A three-across row of 17pt labels survives to roughly 1.3×;
 * past that "Drop" wraps inside its own slab, which is the point the frame
 * chose to stop laying them side by side.
 */
export const DECISION_STACK_SCALE = 1.3;

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * Spelled numbers to twelve, numerals above — the same ceiling and the same
 * reason as `queue-count.ts`'s own table. The frames write "Filing six pieces"
 * and "Six pieces filed", never "Filing 6 pieces".
 *
 * Two cases rather than one call with a capitalise: "Six" opens a headline and
 * "six" sits inside one, and a `.toUpperCase()` on the first character is a
 * transformation waiting to be applied to a numeral.
 */
const SPELLED_LOWER = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
] as const;

const SPELLED_UPPER = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
] as const;

export function spell(n: number, lead: 'upper' | 'lower' = 'lower'): string {
  const i = Math.max(0, Math.trunc(n));
  const table = lead === 'upper' ? SPELLED_UPPER : SPELLED_LOWER;
  return i < table.length ? table[i]! : String(i);
}

/** "one piece" / "six pieces" — spelled, and plural-correct. */
export function pieces(n: number, lead: 'upper' | 'lower' = 'lower'): string {
  const i = Math.max(0, Math.trunc(n));
  return `${spell(i, lead)} ${i === 1 ? 'piece' : 'pieces'}`;
}

/** Frame 07/08's headline. */
export function filingTitle(total: number): string {
  return `Filing ${pieces(total)}`;
}

/** Frame 09's headline. */
export function settledTitle(filed: number): string {
  return `${pieces(filed, 'upper')} filed`;
}

/** Frame 09's oxblood capsule. */
export function reviewCta(filed: number): string {
  return `Review ${pieces(filed)}`;
}

/** Frame 06's Review pill, which is a count and not prose. */
export function reviewPill(ready: number): string {
  return `Review ${ready}`;
}

/** Frame 05/06's top-right pill, and frame 04's when nothing is held. */
export function heldPill(held: number): string {
  return held === 0 ? MODE_PILL : `${held} held`;
}

/**
 * The mode pill's label when the stage is empty.
 *
 * NOT a mode SWITCH. The frames draw one pill and never a second state for it,
 * and there is no second capture mode in the shipped app to switch to — it is a
 * standing instruction reduced to two words, which is the whole of the brief's
 * "viewfinder chrome minimal". Drawn as a label, never as a button, so nothing
 * on the stage is a control that does nothing.
 */
export const MODE_PILL = 'Flat lay';

/** Frame 09's subline. */
export const SETTLED_SUB = 'Have a look before they join your closet.';

/** Frame 09's quiet second action, and frame 14's. */
export const PHOTOGRAPH_MORE = 'Photograph more';

/** Frame 07's foot. The shipped promise, in the frame's words. */
export const FILING_FOOT =
  'You can leave this — filing carries on and the batch will be here when you come back.';

/** Frame 10 — the direction's own words, and nothing added to them. */
export function celebrationTitle(count: number): string {
  return `${count} pieces in`;
}
export const CELEBRATION_BODY = "That’s a closet Cinch can dress you from tomorrow morning.";
export const CELEBRATION_CTA = 'See your first outfits';
export const CELEBRATION_SECONDARY = 'Keep photographing';

/** Frame 17. */
export const OFFLINE_EYEBROW = "You’re offline";
export const OFFLINE_BODY =
  "They’re held on this phone and nothing has been sent yet. Filing starts again the moment you’re back on a connection.";

/** Frame 19. */
export const ERROR_EYEBROW = "Filing didn’t go through";
export const ERROR_BACK = 'Back to closet';

/** Frame 18. */
export const RESUME_TITLE = 'You were partway through';
export const RESUME_CTA = 'Carry on filing them';
export const RESUME_NEW = 'Start a new batch';
export function resumeBody(held: number): string {
  return `${pieces(held, 'upper')} are still here, waiting to be filed. Nothing was lost when Cinch closed.`;
}
export function resumeDiscard(held: number): string {
  return `Discard ${held === 1 ? 'this one' : `these ${spell(held)}`}`;
}

/** Frame 17's headline, which counts photographs rather than pieces. */
export function waitingTitle(held: number): string {
  return `${spell(held, 'upper')} ${held === 1 ? 'photograph' : 'photographs'} waiting`;
}

// ---------------------------------------------------------------------------
// The filing rows
// ---------------------------------------------------------------------------

/**
 * What a row's ground and status word say about one piece.
 *
 * Four tones and no more, because the artifact's own failure-separation card
 * asks for exactly four outcomes that "none masquerades as another": filed,
 * still moving, waiting its turn, and stopped with something to do about it.
 * `held` is the offline reading of `waiting` and takes the same ground, because
 * offline is a fact about the batch (stated once, in the plate above the rows)
 * and not a different fate for each piece.
 */
export type RowTone = 'filed' | 'filing' | 'waiting' | 'trouble';

export type FilingRow = {
  id: string;
  /** The garment's own name once the tagger has one, its stage until then. */
  label: string;
  /** The word on the right of the row. */
  status: string;
  tone: RowTone;
};

/**
 * The frames' status words, per tone.
 *
 * "Filed" and "Filing" are the frames'. "Waiting" is the frames'. "Needs
 * another photo" is the frames' word for a settled cut-out failure, and it is
 * deliberately not "Failed": the piece IS filed — `cutout-failure.ts` refuses
 * to raise the notice over anything that is not — and the only thing missing is
 * a better photograph.
 */
export const ROW_STATUS: Record<RowTone, string> = {
  filed: 'Filed',
  filing: 'Filing',
  waiting: 'Waiting',
  trouble: 'Needs another photo',
};

/** Frame 17's row word. Every piece is held, so the plate says why once. */
export const ROW_STATUS_HELD = 'Held';

/**
 * A queue, as the rows the frames draw.
 *
 * Pure, and deliberately taking the narrowest shape of a job it can — an id, a
 * stage, an optional label, the cut-out flag and whether the row was written —
 * so a test can build one without the store and without a photograph. The
 * ORDER is the queue's own: the drain works front to back, so filed pieces sit
 * at the top and what is still coming reads down, which is exactly what frames
 * 07 and 08 draw.
 *
 * A job that failed OUTRIGHT is not a row tone. It is the amber plate below the
 * rows (frame 19) and the row itself stays at the tone its stage earned, because
 * the artifact's separation card says a request failure and a cut-out failure
 * must not read as the same thing.
 */
export type RowSource = {
  id: string;
  stage: string;
  label?: string;
  cutoutFailed?: boolean;
  itemId?: string;
};

export function filingRows(jobs: readonly RowSource[], opts?: { held?: boolean }): FilingRow[] {
  return jobs.map((job) => {
    const tone = toneFor(job);
    return {
      id: job.id,
      // Named the moment it is true and never before — the same rule
      // `upload-queue-list.tsx` has always held: a garment has no truthful
      // name until the tagger has said what it is.
      label: job.label?.trim() ? job.label.trim() : 'Photograph',
      status: opts?.held && tone !== 'filed' ? ROW_STATUS_HELD : ROW_STATUS[tone],
      tone,
    };
  });
}

function toneFor(job: RowSource): RowTone {
  // CP-05's condition, unchanged: a lost cut-out is only ever reported over a
  // piece that really was filed. See `cutoutFailures` in cutout-failure.ts.
  if (job.cutoutFailed === true && job.itemId) return 'trouble';
  if (job.stage === 'done') return 'filed';
  if (job.stage === 'queued' || job.stage === 'failed') return 'waiting';
  return 'filing';
}

/**
 * The subline under the filing headline — a count, never a percentage.
 *
 * "Two filed · four to go", and "Four filed · one needs another photo · one to
 * go" when a cut-out has stopped short. Segments with nothing in them are not
 * printed: zero is quiet, which is the same refusal `queueCards` makes.
 */
export function filingSubline(rows: readonly FilingRow[]): string | null {
  const filed = rows.filter((r) => r.tone === 'filed').length;
  const trouble = rows.filter((r) => r.tone === 'trouble').length;
  const togo = rows.filter((r) => r.tone === 'filing' || r.tone === 'waiting').length;

  const parts: string[] = [];
  if (filed > 0) parts.push(`${spell(filed, 'upper')} filed`);
  if (trouble > 0) {
    parts.push(
      trouble === 1
        ? 'one needs another photo'
        : `${spell(trouble)} need another photo`,
    );
  }
  if (togo > 0) parts.push(`${spell(togo)} to go`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// The celebration
// ---------------------------------------------------------------------------

/**
 * The count the celebration is named for.
 *
 * The direction is literal — "10 pieces in" — and ten is not a number this
 * module is entitled to invent: it is The Ten, the starter closet the whole
 * onboarding run counts down to, and it is already law elsewhere in the app.
 * Kept as a named constant here rather than typed into a template so the two
 * cannot drift, and asserted against `ten-spec`'s own grid in the layout test.
 */
export const CELEBRATION_AT = 10;

/**
 * Whether the settled batch celebrates, and with what number.
 *
 * The artifact's own card is the whole rule and every clause of it is a
 * refusal: it "appears only when the batch has fully settled — never while
 * anything is still filing and never after a partial failure that has not been
 * resolved."
 *
 * And one clause the artifact does not state but the app must: it fires when
 * the closet CROSSES the threshold, not every time a batch settles on a closet
 * that is already large. A celebration that arrives on the fortieth import is
 * not a celebration, it is a screen in the way.
 *
 * Returns the closet count to print, or null for no celebration. The count is
 * the CLOSET's, not the batch's — "10 pieces in" is a claim about what the user
 * now owns, and printing the batch size there would be a claim about six.
 */
export function celebrationFor(facts: {
  /** Nothing queued and nothing in flight. */
  settled: boolean;
  /** Anything that stopped short and has not been dealt with. */
  unresolved: number;
  /** The closet's real size, from the wardrobe query. */
  closetCount: number;
  /** What it was before this batch landed. Null while that is unknown. */
  closetBefore: number | null;
}): number | null {
  if (!facts.settled) return null;
  if (facts.unresolved > 0) return null;
  if (facts.closetCount < CELEBRATION_AT) return null;
  // Unknown "before" means the app cannot prove this is a crossing, and an
  // unprovable celebration is not one worth firing.
  if (facts.closetBefore === null) return null;
  if (facts.closetBefore >= CELEBRATION_AT) return null;
  return facts.closetCount;
}
