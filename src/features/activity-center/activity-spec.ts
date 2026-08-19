/**
 * ACTIVITY, REDESIGN 28 — what the page decides before it draws.
 *
 * A `.ts` with no React and no `.tsx` import, on the wave's rule: the node test
 * bundler cannot parse React Native's Flow source, so anything a test needs to
 * read has to live where no component can reach it. Same split as
 * `features/item/item-spec.ts` and `features/explore/explore-spec.ts`.
 *
 * ── WHAT REDESIGN 28 CHANGED, AND WHAT IT DID NOT ──────────────────────────
 *
 * It changed the DRAWING. A row is now a 44pt face, one sentence, the day under
 * it, and a warm dot at the trailing edge; the sections are oxblood eyebrows;
 * the colophon is pinned to the foot of the screen in every state rather than
 * appearing only under a populated list.
 *
 * It changed NOTHING about what the surface is allowed to know. The taxonomy,
 * the sentence grammar, the recipient-only read, the boolean unseen model and
 * the thirty-day window are all exactly where they were — `sentence.ts`,
 * `grouping.ts`, `merge.ts` and the migration are untouched by this wave, and
 * `tests/activity-center-*.test.ts` still pin every one of them unmodified.
 *
 * ── THE ONE NUMBER THAT IS NOT HERE ───────────────────────────────────────
 *
 * A count. There is no `unseenCount`, no badge value and no section length
 * exported from this file, for the same reason there is none in `grouping.ts`:
 * the unseen signal is a dot, and a dot cannot be accidentally rendered as a
 * number if no number exists on the path.
 */

/**
 * The Dynamic Type scale at which the row recomposes.
 *
 * 1.35 is the app's standing threshold (`components/today/reaction-spec.ts`
 * names it for the reaction bar, and every surface that recomposes uses the
 * same one). Restated here rather than imported so this module stays free of
 * anything under `components/`, and `tests/activity-layout.test.ts` asserts the
 * two agree — a second threshold on one page is how two halves of a row come
 * to recompose at different sizes.
 */
export const AX_SCALE = 1.35;

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

/**
 * The face, at 44 — and 50 once type is at accessibility size.
 *
 * 44 rather than the 36 the surface shipped with, which is the redesign's most
 * visible single change: at 36 the mark read as an icon beside a sentence, and
 * the brief asks for a row that is a FACE and a sentence. It is also exactly
 * the tap-target floor, so the mark and the minimum row height are the same
 * number and cannot drift apart.
 */
export const ROW_AVATAR = 44;
export const ROW_AVATAR_AX = 50;

/** Face → sentence. The gutter's own step, so the column lines up with nothing else on the page. */
export const ROW_GAP = 12;

/** Above and below the row's content. The hairline is drawn by the row, not by a card. */
export const ROW_PAD_Y = 14;

/**
 * The sentence: 15.5/22, and 18/26 at accessibility size.
 *
 * Half a point above the app's 15, and it is the artifact's measurement rather
 * than a rounding: this page is a column of running sentences with no
 * photograph to carry it, and 15.5 is where a two-line sentence stops reading
 * as a caption. The line height is 1.42 of it, which is the artifact's ratio.
 */
export const SENTENCE_SIZE = 15.5;
export const SENTENCE_LEADING = 22;
export const SENTENCE_SIZE_AX = 18;
export const SENTENCE_LEADING_AX = 26;

/** The day, under the sentence. Never beside it — see `stampPlacement` below. */
export const META_SIZE = 12.5;
export const META_LEADING = 17;
/** The step between the sentence and the day under it. */
export const META_GAP = 3;

/**
 * The unseen dot: nine points of oxblood at the trailing edge.
 *
 * NINE, and it is the same nine `PresenceDot` draws on the entry glyph — the
 * mark that says "there is something here" is one mark in two places, not two
 * marks that happen to be round. It carries no ring on a row, because a row's
 * ground is paper rather than a photograph and a ring there reads as a hole.
 */
export const UNSEEN_DOT = 9;

/**
 * The dot's top inset, so it sits on the sentence's first line rather than on
 * the row's vertical centre. A two-line sentence must not push it downwards —
 * that is what made the old trailing stamp drift out of true.
 */
export const dotOffset = (leading: number): number => Math.round((leading - UNSEEN_DOT) / 2);

/**
 * The stamp moved OUT of the trailing column and UNDER the sentence.
 *
 * The shipped row set the elapsed mark right-aligned on the row's first line,
 * which is a table's arrangement: it needs the sentence to be one line to stay
 * level, and on this surface most sentences are two. Redesign 28 puts the day
 * under the sentence — where `components/activity/ActivityRow.tsx` had already
 * put it for the legacy half — and gives the freed trailing column to the dot.
 * Exported as a value so a test can assert it rather than reading a comment.
 */
export const STAMP_PLACEMENT = 'below' as const;

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

/** The back tile: a 44pt rounded square on `tray`, at the artifact's 14pt radius. */
export const BACK_TILE = 44;
export const BACK_TILE_RADIUS = 14;

/**
 * The VISIBLE gap between the back tile's bottom edge and the cap of the serif
 * title under it.
 *
 * Founder defect, 2026-08-18: "the serif 'Activity' title is touching the back
 * button tile". The masthead asked for the gap with `className="mt-3"` — twelve
 * points — and got one, because the title is `variant="display" trim` and
 * `trim` is a NEGATIVE margin: `capTrim('instrument', 40, 52)` collapses the
 * 52pt line box to the cap height with `marginTop: -11`. Twelve points of margin
 * minus eleven points of trim is a single point of air, which is what the
 * founder is looking at.
 *
 * So this is stated as the gap the reader SEES, and the component adds the trim
 * back rather than a call site guessing at a number that happens to look right.
 * Eighteen: comfortably clear at the default size, and still clear at
 * `MAX_DISPLAY_SCALE` (1.4), where the glyph grows into the fixed trim by
 * roughly three points and nothing else moves.
 */
export const MASTHEAD_TITLE_GAP = 18;

/** The tinted note cards — offline, the read failure, the edit-mode explanation. */
export const NOTE_RADIUS = 16;

/** Edit mode's Clear All bar: the artifact's 56pt primary at a 14pt radius. */
export const CLEAR_BAR_HEIGHT = 56;
export const CLEAR_BAR_RADIUS = 14;

/** The per-row Remove disc Edit mode reveals. */
export const REMOVE_DISC = 28;

/** How many skeleton rows the loading page draws. Six, which is the artifact's count. */
export const SKELETON_ROWS = 6;

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/**
 * Whether the page draws its section headings at all.
 *
 * ONE SECTION NEEDS NO HEADING. The artifact's `activity-list-no-unseen` frame
 * is a plain column of rows with no eyebrow over it, and the reason is in its
 * own caption: "no New heading, no dots, and nothing announcing zero". A
 * heading over the whole list labels the list, which the title already did.
 *
 * Two or more sections is a different fact — the reader is being told where
 * the boundary between unseen and seen falls — so the eyebrows come back.
 *
 * This is a presentation rule and lives here rather than in `grouping.ts`,
 * which must go on partitioning the timeline the same way whatever is drawn
 * over it.
 */
export function showsSectionHeadings(sectionCount: number): boolean {
  return sectionCount > 1;
}

/**
 * Which section carries a Show / Hide control on its heading.
 *
 * The oldest one, and only the oldest one — `activity-list-older-month-
 * collapsed` draws the heading with `Show` beside it and nothing beneath. It is
 * the same section `grouping.ts` already collapses runs inside, and for the
 * same reason: thirty days is the floor, so this is the last section that can
 * exist and its rows are the least consequential on the page.
 *
 * Takes the key rather than an index so it cannot start depending on how many
 * sections happen to be present.
 */
export function isCollapsibleSection(key: string): boolean {
  return key === 'month';
}

/**
 * Whether a section starts collapsed.
 *
 * The collapsible one does; nothing else can. Stated as a function rather than
 * read off `isCollapsibleSection` at the call site so that "collapsible" and
 * "collapsed on arrival" stay separable if the oldest section ever stops being
 * the only one that folds.
 */
export function startsCollapsed(key: string): boolean {
  return isCollapsibleSection(key);
}

/**
 * The sentence and face metrics for a given Dynamic Type scale.
 *
 * The row does NOT recompose into a vertical stack at accessibility sizes, and
 * that is a change from what shipped. `activity-list-ax-xxxl` keeps the face,
 * the sentence and the dot in exactly the arrangement they have at default
 * size — the sentence simply wraps further and the row grows taller. A stack
 * was the right answer when a trailing stamp had to escape the sentence's
 * right-hand edge; with the stamp under the sentence there is nothing left to
 * collide, and holding one arrangement at every size is worth more than a
 * second layout to maintain.
 *
 * The inline Accept / Decline pair still stacks — two 44pt pills side by side
 * cannot hold a wrapped label at AX — and that is the caller's branch.
 */
export function rowMetrics(fontScale: number): {
  avatar: number;
  size: number;
  leading: number;
  stacksActions: boolean;
} {
  const ax = fontScale >= AX_SCALE;
  return {
    avatar: ax ? ROW_AVATAR_AX : ROW_AVATAR,
    size: ax ? SENTENCE_SIZE_AX : SENTENCE_SIZE,
    leading: ax ? SENTENCE_LEADING_AX : SENTENCE_LEADING,
    stacksActions: ax,
  };
}
