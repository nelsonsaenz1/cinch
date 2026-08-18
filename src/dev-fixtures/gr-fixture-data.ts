/**
 * The people and rooms the redesign-27 frames draw, as fixture data.
 *
 * Deterministic on purpose: no clock, no random source, no network. The dated
 * copy on this flow (`invitedLabel`, `timeAgo`) takes its `now` from the
 * caller in tests and from the system clock in the app, so a fixture that
 * wanted a stable "Invited 2 days ago" would have to freeze time. It does not
 * try: the frames are checked for COMPOSITION — the table, the bands, the
 * plates, the reflow at AX-XXXL — and a caption that reads "today" one day and
 * "yesterday" the next is still the same composition.
 *
 * Names are the artifact's own, so a side-by-side against the PNGs compares
 * like with like.
 */

/** One seat at the table. */
export interface GrSeat {
  userId: string;
  name: string;
}

/** A seat that is promised rather than taken. */
export interface GrPendingSeat extends GrSeat {
  invitedAt: string | null;
}

export const OWNER: GrSeat = { userId: 'u-priya', name: 'Priya Nandakumar' };

/** The five who are in "Sunday roasts at Priya's". */
export const ROOM_MEMBERS: readonly GrSeat[] = [
  OWNER,
  { userId: 'u-alex', name: 'Alexandria Rivera' },
  { userId: 'u-chris', name: 'Christopher Montgomery' },
  { userId: 'u-marisol', name: 'Marisol Whitfield' },
  { userId: 'u-jonah', name: 'Jonah Okonkwo' },
];

/** The two seats that are promised. `invitedAt` null exercises the fallback. */
export const ROOM_PENDING: readonly GrPendingSeat[] = [
  { userId: 'u-devon', name: 'Devon Kaur', invitedAt: null },
  { userId: 'u-simone', name: 'Simone Nakamura', invitedAt: null },
];

/** Twelve, which is the cap — every seat taken, nothing promised. */
export const FULL_MEMBERS: readonly GrSeat[] = [
  ...ROOM_MEMBERS,
  { userId: 'u-theo', name: 'Theo Barrington' },
  { userId: 'u-lena', name: 'Lena Fitzgerald' },
  { userId: 'u-gabriel', name: 'Gabriel Hurst' },
  { userId: 'u-rosa', name: 'Rosa Villanueva' },
  { userId: 'u-emeka', name: 'Emeka Kalu' },
  ...ROOM_PENDING.map((seat) => ({ userId: seat.userId, name: seat.name })),
];

/** The group's own name, as the frames set it. */
export const ROOM_NAME = 'Sunday roasts at Priya’s';
export const SECOND_ROOM = 'Thursday tennis';
export const THIRD_ROOM = 'Montgomery cousins';
/** The one an invitation is TO. */
export const INVITED_ROOM = 'Cabin weekend';
export const INVITER = 'Marisol Whitfield';
