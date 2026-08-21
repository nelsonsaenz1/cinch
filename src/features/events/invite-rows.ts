/**
 * Pure logic behind the Invite Friends State Atlas (IF-01…IF-06).
 *
 * The picker is a batch checklist over the friends graph, never a directory
 * search — event-social-contract.md and the atlas's own §03 are explicit:
 * "invites ride the friendship graph", "nobody is asked twice", "a word or a
 * checkbox, never both". This module is the row classification, the
 * partition into "Already invited" / "Your friends", the filter, and the
 * per-person send-result copy — kept out of the `.tsx` screen so the rules
 * that decide what a row LOOKS like are testable without a React renderer.
 */

/** The roster standing the invite sheet cares about. `removed` is deliberately
 *  absent — a host who removed someone may invite them again exactly as if
 *  they were never on the list; the invite sheet is not where a removal is
 *  remembered. */
export type InviteRosterState = 'joined' | 'invited' | 'declined' | 'host';

export interface InviteFriend {
  userId: string;
  name: string;
  username: string | null;
}

export interface InviteRosterEntry {
  userId: string;
  state: InviteRosterState;
}

/** IF-04's row inventory, resolved for one friend. */
export interface InviteRow {
  userId: string;
  name: string;
  username: string | null;
  /** The word printed where a checkbox would be, or null when this row takes
   *  a checkbox instead. Never both — "a word or a checkbox, never both". */
  standing: 'Hosting' | 'Going' | 'Still deciding' | "Can’t make it" | null;
  /** True when the row ends in a checkbox: a plain friend, or someone who
   *  declined (re-invitable once, the decline stated on their own row). */
  selectable: boolean;
  /** True once this person already has a roster row of any kind — they
   *  belongs in "Already invited", not "Your friends". */
  alreadyInvited: boolean;
}

const STANDING: Record<InviteRosterState, InviteRow['standing']> = {
  host: 'Hosting',
  joined: 'Going',
  invited: 'Still deciding',
  declined: "Can’t make it",
};

/** One friend + their roster row (if any) → the row the sheet draws for them. */
export function inviteRowFor(friend: InviteFriend, roster: InviteRosterEntry | undefined): InviteRow {
  if (!roster) {
    return { ...friend, standing: null, selectable: true, alreadyInvited: false };
  }
  return {
    ...friend,
    standing: STANDING[roster.state],
    // Declined is the one already-invited state that stays selectable: asking
    // again is a decision the host makes deliberately, with the decline still
    // printed on the row rather than hidden by a fresh checkbox.
    selectable: roster.state === 'declined',
    alreadyInvited: true,
  };
}

/** Every friend, resolved to a row — alphabetical order preserved (the same
 *  order the Friends page already sorts to; this function does not re-sort). */
export function buildInviteRows(
  friends: readonly InviteFriend[],
  roster: readonly InviteRosterEntry[],
): InviteRow[] {
  const byUser = new Map(roster.map((r) => [r.userId, r]));
  return friends.map((f) => inviteRowFor(f, byUser.get(f.userId)));
}

/** IF-01/IF-02's two sections. "Already invited" keeps its roster order (the
 *  order the members query already returns — host, joined, still-deciding);
 *  "Your friends" is whatever order the rows arrived in (alphabetical). */
export function partitionInviteRows(rows: readonly InviteRow[]): {
  alreadyInvited: InviteRow[];
  yourFriends: InviteRow[];
} {
  return {
    alreadyInvited: rows.filter((r) => r.alreadyInvited),
    yourFriends: rows.filter((r) => !r.alreadyInvited),
  };
}

/** "Filter your friends" — a substring match over the list already fetched,
 *  never a directory query (IF-03: "it never queries the directory"). */
export function filterInviteRows(rows: readonly InviteRow[], query: string): InviteRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(
    (r) => r.name.toLowerCase().includes(q) || (r.username ?? '').toLowerCase().includes(q),
  );
}

/** True once every friend the host has is already on the list — IF-03's
 *  "Everyone is already invited" state, which replaces the whole picker
 *  rather than showing an empty checkbox list. */
export function everyoneAlreadyInvited(rows: readonly InviteRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.alreadyInvited);
}

/** "Four are going, one is still deciding, one can't make it." — the summary
 *  sentence IF-03 prints once every friend is already on the list. Omits any
 *  clause whose count is zero, and is silent about the host row (there is
 *  exactly one host and stating it adds nothing the reader doesn't know). */
export function standingSummary(rows: readonly InviteRow[]): string {
  const going = rows.filter((r) => r.standing === 'Going').length;
  const deciding = rows.filter((r) => r.standing === 'Still deciding').length;
  const declined = rows.filter((r) => r.standing === "Can’t make it").length;

  const numWord = (n: number): string =>
    (['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] ?? String(n))!;

  const clauses: string[] = [];
  if (going > 0) clauses.push(`${numWord(going)} ${going === 1 ? 'is' : 'are'} going`);
  if (deciding > 0) clauses.push(`${numWord(deciding)} still deciding`);
  if (declined > 0) clauses.push(`${numWord(declined)} can’t make it`);

  if (clauses.length === 0) return '';
  const sentence = clauses.join(', ') + '.';
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ---------------------------------------------------------------------------
// Sending — IF-05. Reported per person, never rolled up into one error.
// ---------------------------------------------------------------------------

export interface SendOutcome {
  userId: string;
  name: string;
  ok: boolean;
}

/** "Deji, Iris and Noor" — the Oxford-less house join the atlas's own
 *  confirmation copy uses. Empty input is the empty string. */
export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Three invitations sent." / "Two of three went out" — the send result's
 *  headline, singular-aware. */
export function sendResultTitle(outcomes: readonly SendOutcome[]): string {
  const total = outcomes.length;
  const sent = outcomes.filter((o) => o.ok).length;
  if (sent === total) {
    return sent === 1 ? 'One invitation sent.' : `${countWord(sent)} invitations sent.`;
  }
  return `${sent} of ${total} went out`;
}

/** "Deji, Iris and Noor are on the list." — always the succeeded names, never
 *  a bare count: a partial failure still gets to say who made it. Empty
 *  string when nobody succeeded. */
export function sendResultBody(outcomes: readonly SendOutcome[]): string {
  const sentNames = outcomes.filter((o) => o.ok).map((o) => o.name);
  if (sentNames.length === 0) return '';
  const names = joinNames(sentNames);
  return sentNames.length === 1
    ? `${names} is on the list.`
    : `${names} are on the list.`;
}

/** The people who still need a retry — IF-05's "Partly failed" rows. */
export function failedSends(outcomes: readonly SendOutcome[]): SendOutcome[] {
  return outcomes.filter((o) => !o.ok);
}

const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'] as const;
function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}
