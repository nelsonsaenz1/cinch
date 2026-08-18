/**
 * New Event — the composer's decisions, as data. Redesign 02, accepted
 * 2026-08-17 (`design-refs/redesign-2026-08/02-new-event/`).
 *
 * Same split, and the same reason, as `people-search-spec.ts`: the screen is a
 * rendering problem and this repo's runner has no React renderer in it on
 * purpose. What CAN be asserted is every decision the composer makes before it
 * draws anything — which rows read as answered, what an answered row prints,
 * when the CTA is live, how a guest list is abbreviated into four discs and one
 * line, and at what type size the sheet becomes its large-type self.
 *
 * The artifact's own geometry lives here too. Every number below is read off
 * the accepted frames rather than eyeballed, and none of them is a `height`:
 * this page has a clipping history (the launch-polish bug), so a row states a
 * FLOOR and grows under whatever Dynamic Type does to the text inside it.
 */

import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * The exact visible strings, so no component types one from memory.
 *
 * The names in the frames ("Alexandria's birthday dinner at Contramar",
 * "Contramar, Calle Durango 200", the four guest discs) are design fixtures and
 * are deliberately NOT here — they are somebody's data at render time.
 */
export const COPY = {
  /** The chrome mark. Uppercased by `variant="eyebrow"`, not by the caller. */
  eyebrow: 'New event',
  cancel: 'Cancel',

  /** The serif prompt, standing where the name will be. */
  prompt: 'What’s the occasion?',
  /** The one tray row that is a text field rather than a door. */
  name: 'Name the event',

  date: 'Date',
  time: 'Time',
  venue: 'Venue',
  guests: 'Who’s going',
  note: 'Note',

  /** The right-hand mark on the two rows an event may float without. */
  optional: 'Optional',

  create: 'Create event',
  creating: 'Creating…',
  tryAgain: 'Try again',

  errorTitle: 'Couldn’t create the event',
  errorBody: 'Your draft is saved on this device.',

  /** Spoken, never drawn: the frame's Time row is drawn identically whether or
   *  not a date exists, and a control that cannot act must say why. */
  timeNeedsDate: 'Pick a date first.',
} as const;

// ---------------------------------------------------------------------------
// Geometry — the artifact's numbers
// ---------------------------------------------------------------------------

/**
 * A row's FLOOR, never its height. 56 is the brief's "generous 56pt tappable
 * row" and the artifact's `min-height:56px`; the text inside decides the rest.
 */
export const ROW_MIN_HEIGHT = 56;
/** `border-radius:16px` on every row, answered or not. */
export const ROW_RADIUS = 16;
/** The 10pt gap the artifact sets between rows, 12 at the accessibility sizes. */
export const ROW_GAP = 10;
export const ROW_GAP_LARGE = 12;

/** The answered mark: a 20pt oxblood square with a 6pt radius. A MARK, not a
 *  ground — the page's one oxblood ground is the CTA. */
export const CHECK_TILE = 20;
export const CHECK_RADIUS = 6;

/** A guest disc, and how many are drawn before the overflow tile takes over. */
export const GUEST_DISC = 34;
export const GUEST_DISCS_SHOWN = 3;
/** How many names the line beside the discs prints before it counts the rest. */
export const GUEST_NAMES_SHOWN = 2;

/** The full-width CTA — a floor and the same 16pt radius as the rows. */
export const CTA_MIN_HEIGHT = 56;
export const CTA_RADIUS = 16;

/** The serif title: 40 while it is the prompt, 34 once it is somebody's name. */
export const TITLE_SIZE_PROMPT = 40;
export const TITLE_SIZE_NAMED = 34;

/** The name cap. 60, not the schema's 80 — mirrored in `mutations.ts`, which
 *  is the boundary that actually enforces it. */
export const NAME_MAX = 60;
/** The note cap, likewise inside the column's 1000. */
export const NOTE_MAX = 280;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * Whether the sheet draws itself the large-type way: rows stack their label
 * over a value that is allowed to wrap, and the answered mark stands down.
 *
 * `AX_STACK_SCALE` (1.5) and not a threshold of this page's own — the closet
 * settled that number and People Search reuses it, so the app has ONE moment
 * where it visibly becomes its large-type self rather than three.
 */
export function newEventStacked(fontScale: number): boolean {
  return fontScale >= AX_STACK_SCALE;
}

export { AX_STACK_SCALE as NEW_EVENT_STACK_SCALE } from '@/features/closet/dynamic-type';

/**
 * Whether the composer may be committed.
 *
 * The ONLY required answer is the name, and whitespace is not a name. The date
 * is deliberately absent from this check: the brief's first Keep is "optional
 * date (events can float)", and the accepted default frame showing a date
 * answered is a frame, not a requirement.
 */
export function canCreateEvent(name: string, pending: boolean): boolean {
  return name.trim().length > 0 && !pending;
}

// ---------------------------------------------------------------------------
// What an answered row prints
// ---------------------------------------------------------------------------

/**
 * "Saturday, 12 September" — the artifact's own register for the DATE row.
 *
 * The long weekday and month, and no year: the composer is about something
 * being planned, and a year on a date three weeks out is chrome. Locale
 * decides the order, so an en-US reader gets "Saturday, September 12" and
 * neither string is hand-assembled here.
 */
export function dateRowValue(day: Date | null): string | null {
  if (!day) return null;
  return day.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * The initials on a guest disc — first and last, exactly as `initialsFor`
 * derives them app-wide, restated here only so the overflow arithmetic below
 * can be tested without pulling a React component into the runner.
 */
export function guestInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return ((last ? `${first[0] ?? ''}${last[0] ?? ''}` : first.slice(0, 2)) || '?').toUpperCase();
}

/**
 * The discs, as the frame draws them: three people, then one tile counting
 * whoever else is coming. `+2` is a tile and not a person, so it is returned
 * as a string beside the initials rather than as a fourth name.
 */
export function guestDiscs(names: readonly string[]): {
  initials: string[];
  overflow: string | null;
} {
  const shown = names.slice(0, GUEST_DISCS_SHOWN);
  const rest = names.length - shown.length;
  return {
    initials: shown.map(guestInitials),
    overflow: rest > 0 ? `+${rest}` : null,
  };
}

/**
 * The line beside the discs — "Priya, Marisol +2 friends".
 *
 * Given names only: a guest list is people the host already knows, and a row
 * of full legal names is a list of strangers. Null for nobody, because the row
 * is then unanswered and prints its label instead.
 */
export function guestSummary(names: readonly string[]): string | null {
  if (names.length === 0) return null;

  const given = names.map((name) => name.trim().split(/\s+/)[0] ?? name.trim()).filter(Boolean);
  const shown = given.slice(0, GUEST_NAMES_SHOWN);
  const rest = given.length - shown.length;
  if (rest <= 0) return shown.join(', ');
  return `${shown.join(', ')} +${rest} ${rest === 1 ? 'friend' : 'friends'}`;
}

/**
 * The venue row's value — the name, with the address behind a comma when the
 * pick resolved to one ("Contramar, Calle Durango 200"). A place typed by hand
 * carries no address and prints as itself.
 */
export function venueRowValue(name: string, address: string | null): string | null {
  const trimmed = name.trim();
  if (!trimmed) return address?.trim() || null;
  const line = address?.trim();
  return line ? `${trimmed}, ${line}` : trimmed;
}

/**
 * Which rows read as answered, in the order the sheet draws them.
 *
 * A single predicate per row rather than five `Boolean(x)` scattered through
 * the markup: "answered" is what decides a row's ground, its label grammar and
 * its mark, and it is the one thing about this page that must not drift.
 */
export type NewEventRowKey = 'name' | 'date' | 'time' | 'venue' | 'guests' | 'note';

export const ROW_ORDER: readonly NewEventRowKey[] = [
  'name',
  'date',
  'time',
  'venue',
  'guests',
  'note',
] as const;
