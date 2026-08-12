/**
 * Event detail's sentences — audit 92 and correction 26.
 *
 * ── Why this file is in `features/event-outfits/` ──────────────────────────
 *
 * It reads as though it belongs in `features/events/`. That folder is not this
 * lane's to write in during Wave 3 Group 5, and inventing a second owner for a
 * shared file mid-wave is how two lanes produce one broken merge. The rule the
 * module has to satisfy is that it is PURE and importable by a test — which
 * this is — so it sits beside the other pure Group-5 logic and says why.
 *
 * ── The privacy rule this file exists to hold ──────────────────────────────
 *
 * "Attendance is coarse in both directions: four have chosen a look, six
 * invited, and nobody is ever named as not going, not responded or declined."
 * Audit 92 restates it as an acceptance criterion — "no absent-attendee
 * behaviour is exposed". That is a privacy rule, not a layout preference, so
 * it is enforced by the SHAPE of these functions: none of them takes a list of
 * people, and none can therefore print one. A caller that wanted to say "Priya
 * hasn't answered" would have to write a new function, which is exactly the
 * amount of friction the rule wants.
 */

/**
 * The host's status sentence — "You are hosting. Six invited, four ready."
 *
 * Two counts and no names, under the title, as a SENTENCE rather than a 56 pt
 * segmented control. The reclaimed height is what buys the composed look its
 * 86 pt tiles.
 *
 * Numbers are printed as digits rather than the atlas's spelled-out "Six"
 * because every other count in this app is a numeral and a spelled-out count
 * cannot be read at a glance against the ready count beside it.
 */
export function hostStatusLine(invited: number, ready: number): string {
  const invitedPart = invited === 1 ? '1 invited' : `${invited} invited`;
  return `You are hosting. ${invitedPart}, ${ready} ready.`;
}

/**
 * The invitee's status sentence — "Sarah invited you. You have not answered
 * yet." The two facts an invitee needs before any control: who asked, and that
 * the ball is still in their court.
 *
 * A joined invitee gets the second half dropped rather than replaced with a
 * cheerful confirmation; "You are going." is the whole of it.
 */
export function inviteeStatusLine(hostName: string | null, answered: boolean): string {
  const who = hostName ? `${hostName} invited you.` : 'You were invited.';
  return answered ? `${who} You are going.` : `${who} You have not answered yet.`;
}

/**
 * "Four have chosen a look" — the coarse readiness line, and the ONLY thing
 * this page says about what other people have done.
 *
 * `null` at zero: a count printed at zero is the constitution's own refusal,
 * and "0 have chosen a look" is also the exact sentence that would make an
 * early guest feel watched.
 */
export function readyLine(ready: number): string | null {
  if (ready <= 0) return null;
  return ready === 1 ? '1 has chosen a look' : `${ready} have chosen a look`;
}

/**
 * What an invitee's empty "Your look" card says — an explanation, not a hole.
 *
 * Names both routes out (suggested, or picked by hand) because the card is
 * drawn BEFORE joining, when neither is reachable yet, and a blush card with
 * nothing in it would read as a failure.
 */
export function noLookYetLine(): string {
  return 'You have not chosen one. Join first and Cinch will suggest three from your closet; you can also pick the pieces yourself.';
}

/**
 * Day-of: exactly what marking it worn will do.
 *
 * Says the number of pieces and both destinations, because "I wore this" is
 * the one control on this page whose effect lands somewhere the user is not
 * looking.
 */
export function dayOfWearLine(pieceCount: number): string {
  const pieces = pieceCount === 1 ? '1 piece' : `${pieceCount} pieces`;
  return `Your look is chosen. Marking it worn adds these ${pieces} to your diary and puts them in tonight’s wear count.`;
}

/**
 * Correction 26 — the cancellation facts, and only the facts.
 *
 * Three things, each verified against the repository before it was written:
 *
 * 1. "shows as canceled in everyone's list" — `useCancelEvent` sets
 *    `events.canceled_at` and nothing else (`features/events/mutations.ts`),
 *    and every list reads that column. Nothing is deleted.
 * 2. "the look, the comments and the votes are kept" — cancelling touches one
 *    column; `event_outfit_posts`, `event_comments` and `event_outfit_votes`
 *    cascade on the EVENT ROW being deleted, which cancelling never does
 *    (migration 20260807102000).
 * 3. "anything you already recorded as worn stays in your diary" — a wear is
 *    an `outfits` row with `worn_at`, owned by `user_id`, with no foreign key
 *    to the occasion at all (migration 20260810100000). A diary entry belongs
 *    to the wearer, not to the occasion.
 *
 * What is deliberately ABSENT, and must stay absent:
 *
 * · Any promise that anyone is notified. The earlier version promised a push
 *   nobody sends.
 * · Any promise about crowns. Crowns are a live unresolved conflict between
 *   the atlas and the shipping board; a cancellation sentence is not the place
 *   to settle it in either direction.
 * · Any mention of who had or had not answered.
 */
export const CANCELLATION_FACTS: readonly string[] = [
  'The occasion shows as canceled in everyone’s list.',
  'The look you chose stays in your saved plates, the comments stay readable to everyone who was invited, and the votes on the board are kept.',
  'Anything you already recorded as worn stays in your diary.',
];

/** The host's own confirmation carries the same facts, plus the one-way door. */
export const HOST_CANCELLATION_FACTS: readonly string[] = [
  ...CANCELLATION_FACTS,
  'It cannot be reopened.',
];

/** "Sarah cancelled the birthday dinner" — the heading, naming the actor. */
export function cancelledHeading(hostName: string | null, title: string): string {
  return hostName ? `${hostName} cancelled ${title}` : `${title} was cancelled`;
}
