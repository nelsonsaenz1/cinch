/**
 * The lines an event surface prints, as pure functions — LP-04 and LP-10.
 *
 * ── Why this module exists ─────────────────────────────────────────────────
 *
 * The hierarchy the launch-polish brief specifies for the event card ("title +
 * actionable state, date/time, venue or honest missing-state, one compact
 * people/look signal") and for the event detail's two scannable rows is a
 * DECISION about which facts appear and in what order. That decision was
 * previously spelled inline inside `EventCard.tsx` and `event/[id]/index.tsx`,
 * both of which import React Native and are therefore unreachable by the test
 * bundler — esbuild cannot parse React Native's Flow source. So the rules could
 * only ever be asserted as source text.
 *
 * Everything here is pure and RN-free, so `tests/event-lines.test.ts` can check
 * the real functions the screens call: the coarse/precise split, the honest
 * missing states, and the fact that a redundant line is absent rather than
 * blank.
 *
 * The four date helpers below were moved here from `EventCard.tsx` unchanged,
 * for the same reason and with the same behaviour. `EventCard` re-exports them
 * so every existing importer (`event/new.tsx`, `event/[id]/invite.tsx`,
 * `features/events/occasion-weather.ts`) keeps its import path.
 */

/** True when the occasion starts and ends on one calendar day. A dateless
 *  occasion spans nothing, so it is trivially one day. */
export function isSameDay(startsAt: Date | null, endsAt: Date | null): boolean {
  return (
    !startsAt ||
    !endsAt ||
    (endsAt.getFullYear() === startsAt.getFullYear() &&
      endsAt.getMonth() === startsAt.getMonth() &&
      endsAt.getDate() === startsAt.getDate())
  );
}

/** The one sentence the app says about an undated occasion, everywhere. */
export const NO_DATE_LINE = 'No date yet';

/** The one sentence the app says about a placeless occasion, everywhere. */
export const NO_VENUE_LINE = 'No place yet';

/**
 * "Fri 8 Aug", "12–16 Sep" for a multi-day occasion, or "No date yet".
 *
 * The dateless case says so rather than falling back to today: a placeholder
 * date is a claim about when something is happening, and the whole point of
 * an undated occasion is that nobody has made that claim yet.
 */
export function whenLabel(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt) return NO_DATE_LINE;
  if (isSameDay(startsAt, endsAt)) {
    return startsAt.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return startsAt.getMonth() === endsAt!.getMonth()
    ? `${startsAt.getDate()}–${endsAt!.getDate()} ${month(endsAt!)}`
    : `${startsAt.getDate()} ${month(startsAt)} – ${endsAt!.getDate()} ${month(endsAt!)}`;
}

/** "4:00pm" — set close and lowercase, the atlas's register; 24-hour locales
 *  come through untouched ("16:00" has no dayPeriod to fold). Null in, null
 *  out: no date means no time, and callers drop the segment rather than
 *  printing an hour nobody chose. */
export function timeLabel(d: Date | null): string | null {
  if (!d) return null;
  return d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();
}

/**
 * Mirrors `WEEK_DAYS` in plan.tsx — the Plan tab fetches a seven-day
 * forecast, so any day past that horizon has no honest weather to print.
 */
export const FORECAST_WINDOW_DAYS = 7;

/** Whole days between today and `d`, local calendar. A dateless occasion is
 *  -1 — the same answer as a day already gone, and for the same reason: both
 *  are outside every forecast, so every caller's `>= 0` gate refuses them. */
export function daysFromToday(d: Date | null): number {
  if (!d) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

/**
 * The date/time row — LP-04 row 3a and LP-10 row 2.
 *
 * "Sat 9 Aug · 4:00pm" for someone on the roster; "Sat 9 Aug" for someone who
 * has only been asked. §7.1 is a product rule — coarse before joined, precise
 * after — so the withholding happens where the string is built rather than
 * being remembered at four call sites.
 *
 * Never null. An occasion with no date says `No date yet`, which is the honest
 * missing state and is exactly what a host has to see in order to fix it.
 */
export function dateTimeLine(
  startsAt: Date | null,
  endsAt: Date | null,
  { coarse = false }: { coarse?: boolean } = {},
): string {
  const day = whenLabel(startsAt, endsAt);
  if (!startsAt || coarse) return day;
  const time = isSameDay(startsAt, endsAt) ? timeLabel(startsAt) : null;
  return time ? `${day} · ${time}` : day;
}

/**
 * The venue row — LP-04 row 3b and LP-10 row 3.
 *
 * Two lines at most: the name is what a reader scans for and the address is
 * what they need on the pavement, so the address is SECONDARY rather than
 * glued onto the name with a separator. A place entered by hand carries no
 * address, and a place with an address but no name promotes the address to the
 * primary line rather than printing an empty one above it.
 */
export function venueLines(
  venueName: string | null,
  venueAddress: string | null,
): { value: string; secondary: string | null } {
  if (venueName) return { value: venueName, secondary: venueAddress || null };
  if (venueAddress) return { value: venueAddress, secondary: null };
  return { value: NO_VENUE_LINE, secondary: null };
}

/**
 * The viewer's own standing, as one quiet word — LP-04's "quiet status".
 *
 * The viewer's OWN state and nobody else's, so this can never leak coarse
 * attendance the way a roster-derived label could. Null when there is nothing
 * to say: a stranger looking at a public occasion has no standing in it.
 */
export function viewerStanding(event: {
  isHost: boolean;
  myState: string | null;
  canceledAt?: Date | null;
}): string | null {
  if (event.canceledAt) return 'Cancelled';
  if (event.isHost) return 'Hosting';
  if (event.myState === 'joined') return 'Going';
  if (event.myState === 'invited') return 'Invited';
  return null;
}

/** The structural slice of an `EventSummary` a card actually prints. */
export interface EventCardInput {
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  venueName: string | null;
  occasion: string | null;
  myState: string | null;
  isHost: boolean;
  memberCount: number;
  invitedCount: number;
  myLookState: 'posted' | 'none';
}

/** The four lines a card is allowed, and nothing else — LP-10. */
export interface EventCardModel {
  title: string;
  /** The one ACTIONABLE state, beside the title. Null when there is no
   *  decision waiting: a settled card has nothing to announce up there. */
  state: string | null;
  /** Always present — `No date yet` rather than a blank row. */
  when: string;
  /** Null for someone not yet on the roster: §7.1 withholds the venue until
   *  they join, and an "honest missing state" for a fact that exists but is
   *  being withheld would be a lie. */
  where: string | null;
  /** One compact people/look signal, or nothing. Never a second headcount and
   *  never a weather clause: those were the redundant lines LP-10 removes. */
  signal: string | null;
}

/**
 * The card's whole content model — LP-10's strict hierarchy, in one place.
 *
 * What is DELIBERATELY not here, having been removed:
 *
 * · the weather clause and its "Outside the forecast window" companion. A card
 *   is informational, not a miniature detail page, and the forecast is already
 *   on the occasion's own page beside the date it belongs to.
 * · the second headcount. The card used to print `4 going` beside the title
 *   AND `4 of 6 going` in the context line for an invitee — the same fact, in
 *   two registers, on one card.
 * · the ruled `Your look / Shared` foot. A rule and a sub-box for two words is
 *   the decorative sub-box the brief names; it is now a clause in `signal`.
 */
export function eventCardLines(event: EventCardInput): EventCardModel {
  const isMember = event.isHost || event.myState === 'joined';
  const isInvited = !event.isHost && event.myState === 'invited';

  const when = dateTimeLine(event.startsAt, event.endsAt, { coarse: !isMember });

  // An invitee's third line is the KIND of night rather than the place — the
  // one thing about an occasion §7.1 does not withhold before joining.
  const where = isMember
    ? venueLines(event.venueName, null).value
    : event.occasion
      ? event.occasion[0]!.toUpperCase() + event.occasion.slice(1)
      : null;

  // A headcount of one is the host alone, and "1 going" is not a fact worth
  // printing — the same refusal `occasionInterruptCopy` already makes.
  const going =
    event.invitedCount > event.memberCount
      ? `${event.memberCount} of ${event.invitedCount} going`
      : event.memberCount > 1
        ? `${event.memberCount} going`
        : null;
  const look = isMember && event.myLookState === 'posted' ? 'Your look shared' : null;
  const signal = [going, look].filter(Boolean).join(' · ') || null;

  return {
    title: event.title,
    state: isInvited ? 'Invited' : null,
    when,
    where,
    signal,
  };
}

/**
 * The card's one VoiceOver stop, in the order the card reads.
 *
 * The card is a single button, so its label is the whole cell: a reader who
 * cannot see the hierarchy still gets it in the order the hierarchy puts it.
 */
export function eventCardLabel(model: EventCardModel): string {
  return [model.title, model.state, model.when, model.where, model.signal]
    .filter(Boolean)
    .join('. ');
}
