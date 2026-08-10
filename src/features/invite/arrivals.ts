/**
 * "Came in from your link" — the rows of IV-01's second section.
 *
 * WHY THIS SECTION EXISTS AT ALL
 *
 * The atlas drew a "Waiting on" list here: named recipients with send times,
 * "Maya · sent 2 days ago · not opened". It cannot be built, and the reason is
 * printed on the same page — the rules panel says "one link per person,
 * forever, no per-invite codes to track" and "no contact upload". With no code
 * and no address book the app has no way to know a link was sent to anybody,
 * let alone when, so every row of that list would have been invented. See the
 * contract, §3.5.
 *
 * What the app CAN know is who arrived: `apply_invite()` writes
 * `profiles.invited_by` once, at the moment of arrival, and `invite_arrivals()`
 * reads it back. Same position on the page, same restraint, real data.
 *
 * Kept in a `.ts` with no React in it for the reason `link.ts` states: the test
 * runner bundles with esbuild and cannot parse React Native's Flow source.
 */

import { sinceLabel } from '@/features/explore/timeline';

/** One person who arrived through the caller's link. */
export type InviteArrival = {
  userId: string;
  /** The name they chose, or null when they have not written one. */
  displayName: string | null;
  /** Their handle, without the `@`, or null when unclaimed. */
  username: string | null;
  /** When `apply_invite` ran for them. Null-tolerant; see `toArrival`. */
  joinedAt: string | null;
};

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Narrow one `invite_arrivals()` row, or drop it.
 *
 * A `returns table` carries no nullability, so the generated type declares all
 * four columns non-null while three of them genuinely can be — a profile with
 * no display name and no handle is an ordinary new account. Only `user_id` is
 * load-bearing: a row without one has no identity, cannot be opened, and is
 * dropped rather than rendered as a blank line in someone's list.
 */
export function toArrival(raw: Record<string, unknown>): InviteArrival | null {
  const userId = str(raw.user_id);
  if (!userId) return null;

  return {
    userId,
    displayName: str(raw.display_name),
    username: str(raw.username),
    joinedAt: str(raw.joined_at),
  };
}

/**
 * What the row is called.
 *
 * Falls through name → handle → "Someone new", never to an empty line. The
 * last case is real: a person can accept an invite, land in the app and add a
 * piece before they have written a name or claimed a handle, and they are
 * still somebody who arrived.
 */
export function arrivalName(arrival: InviteArrival): string {
  return arrival.displayName ?? (arrival.username ? `@${arrival.username}` : 'Someone new');
}

/**
 * The first word of a name — "Sophie" from "Sophie Meyer", "@sophie" from
 * "@sophie".
 *
 * IV-06 says the inviter's name four times (headline, body, reassurance card,
 * button) and the atlas sets all four as a first name. A full "See Sophie
 * Meyer's closet" wraps the button on a 393pt screen, and a headline set from
 * a three-word name loses the serif measure entirely. Nothing else in the app
 * shortens a name, so this stays local to the invite rather than becoming a
 * general rule about how people are addressed.
 */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/**
 * The quiet line under the name — "Arrived yesterday", "Arrived 3d ago".
 *
 * "Arrived", not "Joined": `invited_at` is stamped when the link is applied,
 * which for an account that already existed is not the day they joined Cinch.
 * Saying "joined" would be a small, checkable lie on a page whose whole
 * correction was about not inventing facts.
 *
 * Null when the timestamp is missing rather than guessed — the name alone is a
 * complete row, and "Arrived recently" would be prose standing in for data.
 */
export function arrivalSubtitle(arrival: InviteArrival, now: Date = new Date()): string | null {
  if (!arrival.joinedAt) return null;
  const label = sinceLabel(arrival.joinedAt, now);
  if (!label) return null;
  // `sinceLabel` is written in sentence case for exactly this — it is set in
  // `colophon` on Explore, which upper-cases it, and read plainly here.
  return `Arrived ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}
