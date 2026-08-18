/**
 * Event Detail — the poster. Its copy, its geometry, and the decisions it makes
 * before it draws. Redesign 03.
 *
 * A `.ts`, not a `.tsx`, for the reason `plan-week-spec.ts` and `event-lines.ts`
 * both give: the node test bundler cannot parse React Native's Flow source, so
 * anything worth PINNING must not reach a component file. Everything here is a
 * pure function of its arguments — no hooks, no ambient clock — which is what
 * lets `tests/event-detail-layout.test.ts` exercise the real functions the page
 * calls instead of inferring them from a render nobody can run here.
 *
 * ── WHAT THE FRAMES ASK FOR ───────────────────────────────────────────────
 *
 * The event as a POSTER. A warm tinted band carrying the serif event name with
 * venue and date set small beneath it; the reader's own planned look as the
 * dominant image plate, tappable to change; the roster as avatar CHIPS rather
 * than rows; the logistics collapsed into one quiet line; and the RSVP as two
 * tinted buttons at the foot. Comments and outfit voting are one tap down.
 *
 * ── WHAT THIS MODULE REFUSES TO DECIDE ────────────────────────────────────
 *
 * Who is on the roster. That is `event_members`' policy and `useEventMembers`'
 * query, and this module only ever RE-SHAPES a list it is handed — it cannot
 * fetch, it cannot filter a state back in, and `rosterChips` throws away
 * everything it is not given. The page shows exactly the set it showed before
 * the redesign; the chips are a different drawing of the same people.
 */

/**
 * The gutter the poster's type sits in. Wider than the app's 20pt `GUTTER`
 * inside the band, where the frames inset the name and its line by 22 so the
 * 38pt serif does not touch the 44pt back button's optical edge.
 */
export const HERO_TEXT_INSET = 22;

/** The band's own tail below the date line. */
export const HERO_PAD_BOTTOM = 22;
export const HERO_PAD_BOTTOM_AX = 20;

/**
 * The two round-rect buttons in the band — back, and the overflow menu that
 * holds everything the poster no longer prints as a row.
 *
 * 44 is the tap floor and the frame's own measure at standard sizes; the AX
 * frame grows both to 48 because the glyphs inside them grow.
 */
export const HERO_BUTTON = 44;
export const HERO_BUTTON_AX = 48;
export const HERO_BUTTON_RADIUS = 14;
export const HERO_BUTTON_RADIUS_AX = 15;

/**
 * The look plate — one tall well beside two stacked ones, edge to edge, with
 * the ground showing through as the gaps.
 *
 * ONE ROW HEIGHT, where the artifact draws four (90 default, 96 empty, 98
 * error, 112 loading). Those four differ because each frame is a fixed 852pt
 * canvas and the plate absorbed whatever height that frame's other blocks left
 * over — there is no state in which the plate MEANS something different by
 * being eight points taller. On a real device the region above it scrolls, so
 * the four collapse to the one the frames cluster around. Listed as a
 * deviation in the build report.
 */
export const PLATE_ROW = 96;
/** The AX frame's single row: the third well stands down, so one row is all. */
export const PLATE_ROW_AX = 88;
export const PLATE_GAP = 3;

/** The roster chip. Grows at large type rather than clipping the name. */
export const CHIP_RADIUS = 14;
export const CHIP_RADIUS_AX = 16;
export const CHIP_MIN_HEIGHT_AX = 56;
export const CHIP_AVATAR = 28;
export const CHIP_AVATAR_AX = 40;
export const CHIP_GAP = 8;

/** The clay bead that opens the logistics line. A mark, never type. */
export const DOT = 7;

/** The RSVP pair, and the row under it. */
export const CTA_MIN_HEIGHT = 56;
export const CTA_SECONDARY_MIN_HEIGHT = 52;
export const CTA_MIN_HEIGHT_AX = 60;
export const CTA_RADIUS = 16;
/** "Comments & outfit votes" — a row, not a button, so it sits a step lower. */
export const NAV_ROW_MIN_HEIGHT = 52;

/** The RSVP failure band. */
export const NOTICE_RADIUS = 15;
export const NOTICE_DOT = 9;

/**
 * How many people are named before the rest become one "+n" chip.
 *
 * Four, from the frame: `Priya · Marisol · Theo · Alexandria · +2`. The
 * overflow chip is a COUNT and never a list — it names nobody, which is the
 * same coarse-attendance rule the page has always kept.
 */
export const ROSTER_CHIP_LIMIT = 4;

/**
 * The strings, verbatim from the artifact.
 *
 * Typographic apostrophes throughout — "Can’t", "didn’t" — which is the
 * convention the rest of the app sets and the one the frames print. A straight
 * quote here would be a different string from the accepted one.
 */
export const EVENT_DETAIL_COPY = {
  yourLook: 'Your look',
  change: 'Change',
  /** The roster section's label, and the affirmative RSVP. Same word, twice. */
  going: 'Going',
  decline: 'Can’t make it',
  planLook: 'Plan a look',
  emptyLookTitle: 'No look planned yet',
  noReplies: 'Nobody else has replied',
  comments: 'Comments & outfit votes',
  rsvpErrorTitle: 'Your reply didn’t send',
  rsvpErrorBody: 'Nobody has been notified yet.',
  tryAgain: 'Try again',
  /**
   * The poster's own missing-venue line.
   *
   * Deliberately NOT `NO_VENUE_LINE` ("No place yet"), which stays exactly
   * where it is on the event card and in the Where row's descendants. The
   * poster prints its venue inside a sentence-like line under the name, where
   * "No place yet" reads as a status and "Venue to be confirmed" reads as part
   * of the invitation. The artifact chose the second; the card keeps the first.
   */
  venueTbc: 'Venue to be confirmed',
  /** The overflow button's VoiceOver name. The glyph is three dots. */
  menu: 'More',
  back: 'Back',
  /**
   * Why an invitee's poster is coarse. Kept verbatim from LP-04, where it was
   * the honest explanation for a withheld-data rule rather than a caption —
   * the one sentence that must survive the page losing its prose.
   */
  joiningExplains: 'Joining puts it on your Plan — and shows you where and when.',
} as const;

/**
 * The line under `No look planned yet`, or nothing.
 *
 * Three readers, three different true things — and one of them is silence.
 * The frame's "Theo hasn’t said where. Plan something anyway." is not a
 * general-purpose empty-state sentence; it is what is true when the HOST has
 * not named a venue, and printing it over an occasion with a confirmed table
 * would be a small lie. A member who simply has not chosen a look yet gets the
 * headline alone, because there is nothing to add to it.
 */
export function emptyLookBody(input: {
  isMember: boolean;
  hostName: string | null;
  venueKnown: boolean;
}): string | null {
  if (!input.isMember) return EVENT_DETAIL_COPY.joiningExplains;
  if (!input.venueKnown) {
    return `${input.hostName ?? 'Nobody'} hasn’t said where. Plan something anyway.`;
  }
  return null;
}

/** The label under the "+n" chip, singular-aware. */
export function moreFriendsLine(n: number): string {
  return n === 1 ? '1 more friend' : `${n} more friends`;
}

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

/**
 * The band's ground.
 *
 * Two tints, and the frames say which is which: the settled occasion takes
 * oxblood, and the one whose venue nobody has named yet takes clay. That is
 * not decoration — it is the same fact the line beneath it prints, said again
 * in a way that reads before the words do, and it means the poster for a
 * half-planned evening cannot pass for a finished one at a glance.
 *
 * A reader who has only been INVITED sees clay too, and for a reason that is
 * about honesty rather than taste: §7.1 withholds the venue until they join,
 * so their poster genuinely has no venue on it and an oxblood band would be
 * claiming a completeness they cannot see.
 */
export function heroTone(input: {
  venueName: string | null;
  coarse?: boolean;
}): 'accent' | 'clay' {
  return input.venueName && !input.coarse ? 'accent' : 'clay';
}

/**
 * The small line beneath the name — "Contramar · Sat 12 Sep · 8:30 pm".
 *
 * §7.1 lives here, in the `coarse` flag, rather than being assembled twice at
 * the call site: someone who has only been invited gets the DAY and nothing
 * else — no venue, no time — and the venue segment is absent rather than
 * replaced by a missing-state, because an honest missing-state for a fact that
 * exists and is being withheld would be a lie.
 *
 * Takes the already-composed date string rather than the Dates, so that this
 * function and `dateTimeLine` can never disagree about what "Sat 12 Sep · 8:30
 * pm" is.
 */
export function posterLine(input: {
  venueName: string | null;
  dateLine: string;
  coarse?: boolean;
}): string {
  if (input.coarse) return input.dateLine;
  return [input.venueName || EVENT_DETAIL_COPY.venueTbc, input.dateLine].join(' · ');
}

/**
 * The same line, recomposed for the accessibility sizes: the venue on its own
 * line, the date beneath it.
 *
 * A COMPOSITION change, which is the governing clause — "in every case
 * composition changes and height is allowed; nothing is capped, truncated,
 * ellipsised or scaled below its documented size". The dot separator is what
 * goes, not a word.
 */
export function posterLinesAx(input: {
  venueName: string | null;
  dateLine: string;
  coarse?: boolean;
}): string[] {
  if (input.coarse) return [input.dateLine];
  return [input.venueName || EVENT_DETAIL_COPY.venueTbc, input.dateLine];
}

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

/**
 * One chip. `initials` is left to the drawing layer (`initialsFor`), so this
 * module never has to know what a display name looks like.
 */
export type RosterChip = {
  userId: string;
  name: string;
  /** `false` for a still-deciding guest — the quiet tray chip, host-only. */
  going: boolean;
  /** The host, so the chip can say so the way the frame does: "Theo (host)". */
  host: boolean;
};

/** The overflow chip: a count of people, never a list of them. */
export type RosterOverflow = { count: number; label: string };

/**
 * The chips, from the roster the page already holds.
 *
 * ── The privacy rule, unchanged ──────────────────────────────────────────
 *
 * `members` is whatever `useEventMembers` returned, which is `event_members`
 * filtered to `joined | invited` by the query and by the policy behind it.
 * This function NARROWS and never widens: a guest sees only people who have
 * actually joined, and the still-deciding rows stay the host's own knowledge —
 * exactly the `m.state === 'joined' || event.isHost` filter the page has
 * applied since LP-04, moved here so it can be tested rather than read.
 *
 * A still-deciding chip is drawn quietly and says so to VoiceOver, so the
 * "Going" label above the row is never made to cover somebody who has not
 * answered.
 */
export function rosterChips(
  members: readonly {
    userId: string;
    state: string;
    role: string;
    displayName: string | null;
    username: string | null;
  }[],
  options: { isHost: boolean; me: string | null; limit?: number },
): { chips: RosterChip[]; overflow: RosterOverflow | null } {
  const limit = options.limit ?? ROSTER_CHIP_LIMIT;

  const visible = members.filter((m) => m.state === 'joined' || options.isHost);

  const all: RosterChip[] = visible.map((m) => ({
    userId: m.userId,
    name:
      m.userId === options.me ? 'You' : (m.displayName ?? m.username ?? 'A guest'),
    going: m.state === 'joined',
    host: m.role === 'host',
  }));

  if (all.length <= limit) return { chips: all, overflow: null };

  const rest = all.length - limit;
  return {
    chips: all.slice(0, limit),
    overflow: { count: rest, label: moreFriendsLine(rest) },
  };
}

// ---------------------------------------------------------------------------
// The one quiet line
// ---------------------------------------------------------------------------

/**
 * The logistics, collapsed — "Calle Durango 200 · table under Priya ·
 * bringing the gift".
 *
 * Every fact the page used to spend a row or a colophon on, joined into the
 * one line the frames give them and dropped entirely when there is nothing to
 * say. Null rather than an empty bead: a dot with no sentence after it is a
 * loading state that never finishes.
 *
 * Member-only at the call site, the same as the rest of the precise half.
 */
export function logisticsLine(input: {
  venueAddress?: string | null;
  occasion?: string | null;
  partySize?: number | null;
  dressCode?: string | null;
  note?: string | null;
  /** The forecast, already worded. Last, because it is the softest fact here. */
  weather?: string | null;
}): string | null {
  const bits = [
    input.venueAddress,
    input.occasion,
    input.partySize ? `table for ${input.partySize}` : null,
    input.dressCode,
    input.note,
    input.weather,
  ]
    .map((b) => (typeof b === 'string' ? b.trim() : b))
    .filter((b): b is string => Boolean(b));

  return bits.length > 0 ? bits.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// The foot
// ---------------------------------------------------------------------------

/**
 * Which control on the poster gets the single filled oxblood.
 *
 * The constitution's accent budget, and the frames keep it: the default frame
 * fills the reader's own standing answer, and the empty frame moves the fill
 * up to "Plan a look" and demotes BOTH RSVP buttons to tints — because a
 * screen with two oxblood grounds has no primary action, it has two.
 *
 *   'plan'    — no look chosen yet; planning one is the page's point.
 *   'retry'   — the last reply failed; recovering is the page's point.
 *   'rsvp'    — the standing answer carries it.
 *   'none'    — nothing on the foot claims it (the host of a planned evening,
 *               whose RSVP is not a question anyone is asking).
 */
export function primaryGround(input: {
  failed: boolean;
  hasLook: boolean;
  canRsvp: boolean;
}): 'retry' | 'plan' | 'rsvp' | 'none' {
  if (input.failed) return 'retry';
  if (!input.hasLook) return 'plan';
  return input.canRsvp ? 'rsvp' : 'none';
}
