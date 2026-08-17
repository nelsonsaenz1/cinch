/**
 * EVERY WORD THE PRIVATE-GROUPS FLOW SAYS, INCLUDING THE SPOKEN ONES.
 *
 * A `.ts` and not a component, for the reason every copy module in this
 * codebase is one: a sentence that makes a promise about who can see something
 * is worth a test, and a test should not have to render React to read it.
 * `features/privacy/visibility-copy.ts` and `features/daily-social/copy.ts`
 * made the same split for the same reason.
 *
 * ══ THE VOCABULARY CONTRACT, AND THIS FILE IS WHERE IT WOULD BREAK ══════════
 *
 * **The word "circle" must never appear in a string below.** Not in a headline,
 * not in a footnote, not in a VoiceOver label, not in a button. The contract
 * (docs/design/private-circles-preparation.md §0) is: identifiers say circle,
 * strings say group. "Private Circles" is the internal programme label and has
 * never been on a screen.
 *
 * The reason is not tidiness. **"Your circle" is already live copy meaning
 * something else** — your mutual friends — on five shipped surfaces: the
 * standing link at the foot of Explore, the row-menu action, the `screen-header`
 * colophon, the Plan surface, and Daily Social's "You’re caught up with your
 * circle." If a private group also shipped as a "circle", the app would say the
 * same word for two different populations on adjacent screens.
 *
 * So: this file never says "circle", and it never renames, restyles or echoes
 * the five surfaces that do. `tests/private-circles-copy.test.ts` asserts both
 * halves — the second matters as much as the first, because the risk after a
 * decision like this is not only that the new flow says the old word but that a
 * well-meaning sweep renames the old flow to the new one.
 *
 * ══ WHAT MAY NEVER APPEAR HERE ═════════════════════════════════════════════
 *
 * · **Nothing that suggests discoverability.** No search, no suggestions, no
 *   "people you may know", no "popular", no "nearby". Groups are invite-only:
 *   nobody can search for one and no one outside sees that it exists, and that
 *   is a property of the RLS policy, not a promise the copy is making on its
 *   own recognisance.
 * · **No count that identifies anyone.** No followers, no likes, no views. The
 *   member count is a scalar the schema hands out deliberately
 *   (`circle_member_count`) and says how many, never who — which is the exact
 *   line PC-04 draws for a person who has not accepted yet.
 * · **Nothing that names who removed somebody.** PC-07: "They are told they were
 *   removed, not who removed them." No string here may narrow it.
 * · **The word "blocked" never appears as a reason.** A block severs both follow
 *   edges permanently, so a blocked pair simply stop being mutual friends and
 *   the row says so. Saying "blocked" would disclose the block.
 */

import { CIRCLE_MAX_MEMBERS, type InviteIneligibility } from './contract-types';

// ---------------------------------------------------------------------------
// Numbers, spelled so a sentence reads like one
// ---------------------------------------------------------------------------

/**
 * Zero to twelve, spelled.
 *
 * Twelve is the cap, so the table covers every number any sentence here can
 * reach — there is no fall-through to a numeral in practice, and one is kept
 * anyway rather than letting an out-of-range count throw inside a headline.
 *
 * Lower case: every use is mid-sentence. `friend-rows.ts` keeps a capitalised
 * copy for a line that STARTS with the number ("Six people can see your
 * closet."), and the two are deliberately not shared — a table that had to
 * serve both would need a casing flag, and a casing flag is how "All Four
 * members" ships.
 */
const SPELLED = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
] as const;

export function spelledCount(n: number): string {
  const i = Number.isFinite(n) ? Math.max(Math.floor(n), 0) : 0;
  return i < SPELLED.length ? SPELLED[i]! : String(i);
}

/** The cap, in the words the atlas uses for it: "A group holds twelve people." */
export const CAP_SPELLED = spelledCount(CIRCLE_MAX_MEMBERS);

// ---------------------------------------------------------------------------
// PC-01 · No groups yet
// ---------------------------------------------------------------------------

/** The screen's own title. One word, and it is the customer's word. */
export const GROUPS_TITLE = 'Groups';

/**
 * The empty state, verbatim from PC-01.
 *
 * The footnote is the load-bearing sentence and it is TRUE by construction
 * rather than by promise: `circles`' select policy is `can_see_circle(id)`, so
 * a non-member's query returns nothing at all — there is no listing, no search
 * index and no existence oracle to search against.
 *
 * The action is an invitation to start, not an instruction. It never suggests
 * finding people: a group is made of friends you already have, and the mutual
 * check happens at the invitation.
 */
export const NO_GROUPS = {
  symbol: 'person.2',
  title: 'No groups yet.',
  body: 'A private group is a small space for friends you both added. Two to twelve people.',
  action: 'Create a group',
  footnote:
    'Groups are invite-only. Nobody can search for one, and no one outside sees that it exists.',
} as const;

// ---------------------------------------------------------------------------
// PC-02 · Making one
// ---------------------------------------------------------------------------

export const CREATE = {
  title: 'Name the group',
  fieldLabel: 'Name',
  /**
   * The atlas's own example. A place and a day, not a sentence — which is why
   * the schema caps the name at 60 characters rather than an event title's 80.
   */
  placeholder: 'Sunday tennis',
  helper: 'Only the people in it will ever see this name.',
  /**
   * "The group", not "a group": PC-01's button offers to start something and
   * this one commits the thing on screen. Two different acts, two different
   * articles, and a shared string would have made the second read as a repeat
   * of the first.
   */
  action: 'Create the group',
  cancel: 'Cancel',
} as const;

// ---------------------------------------------------------------------------
// PC-03 · Choosing who
// ---------------------------------------------------------------------------

export const PICKER = {
  title: 'Invite a friend',
  /**
   * States the mutual rule before anybody taps, because it is the reason the
   * list is as short as it is. Checked once, at the invitation, and never again
   * on read — an unfollow must not be a second, invisible exit.
   */
  body: 'You can invite anyone you have both added. They choose whether to join.',
  action: 'Send the invitation',
  cancel: 'Cancel',
} as const;

/**
 * THE RULE PC-10 STATES ABOUT ITSELF, RECORDED RATHER THAN PRINTED.
 *
 * This sentence is an annotation on the frame — the atlas telling its reader
 * how the unavailable rows behave — not a line the app says to a customer. A
 * screen that explained its own accessibility strategy to the person using it
 * would be the design talking about itself in front of the user.
 *
 * So it is exported as a constant and `tests/private-circles-ax.test.ts`
 * enforces it against the components instead: every unavailable row prints its
 * reason as text on the row, and no meaning anywhere is carried by colour
 * alone. That is the sentence kept as a property rather than as a paragraph.
 */
export const COLOUR_INDEPENDENCE_RULE =
  'Every unavailable row states its reason on the row itself. Nothing is hidden and nothing is explained by colour alone.';

/**
 * Why a row cannot be chosen — PC-10's two, and there is no third.
 *
 * `not_mutual` is what a block looks like from here, and it is the honest thing
 * to say: the block deleted both follow edges, so the pair genuinely are no
 * longer mutual friends. A "blocked" reason would disclose the block; a greyed
 * row with no words at all would disclose nothing and explain nothing, which is
 * the failure the row-level reason exists to prevent.
 */
export const INELIGIBILITY_REASONS: Record<Exclude<InviteIneligibility, null>, string> = {
  group_full: 'Group is full',
  not_mutual: 'No longer a mutual friend',
};

export function ineligibilityReason(reason: InviteIneligibility): string | null {
  return reason ? INELIGIBILITY_REASONS[reason] : null;
}

/**
 * How many seats are left, as a sentence.
 *
 * Seats, not people: the number counts outstanding invitations as well as
 * members, because `circle_seats_taken` does and a client that counted only
 * members would offer a seat the database is about to refuse.
 */
export function seatsLeftLine(free: number): string {
  const n = Number.isFinite(free) ? Math.max(Math.floor(free), 0) : 0;
  if (n === 0) return 'No seats left.';
  if (n === 1) return 'One seat left.';
  return `${spelledCount(n).replace(/^./, (c) => c.toUpperCase())} seats left.`;
}

// ---------------------------------------------------------------------------
// PC-04 · An invitation, received
// ---------------------------------------------------------------------------

/**
 * "4 members · private" — the line above the promise, and the only fact about
 * the group an invitee is given.
 *
 * A NUMBER AND NEVER A NAME. `circle_member_count` is a scalar and deliberately
 * not a view, because a view is joinable back to the membership table and names
 * people while a scalar cannot be decomposed. It counts `joined` only:
 * counting invitations would tell an invitee that three other people are "in" a
 * group none of them has agreed to join yet.
 *
 * Numerals rather than spelled words, matching the frame — this is a data line
 * under a heading, not prose.
 */
export function memberLine(memberCount: number): string {
  return `${memberCountPhrase(memberCount)} · private`;
}

/**
 * The same fact without the typographic furniture, for the spoken labels.
 *
 * A middle dot is a drawn separator; spoken, it is either silence or the words
 * "middle dot", and neither is what the row means. Every VoiceOver label below
 * composes from this and joins with sentences instead.
 */
export function memberCountPhrase(memberCount: number): string {
  const n = Number.isFinite(memberCount) ? Math.max(Math.floor(memberCount), 0) : 0;
  return n === 1 ? '1 member' : `${n} members`;
}

export const INVITATION = {
  /**
   * The strictest promise on the surface, and the schema keeps it rather than
   * the client remembering to: the membership select policy is "your own row,
   * always; everyone else's only if you are joined" — a deliberate departure
   * from `event_members`, whose `can_see_event` hands an invitee the whole
   * participant list before they have agreed to anything.
   */
  body: 'You will see who else is in it after you accept. Nothing of yours is shared until then.',
  accept: 'Accept',
  decline: 'Decline',
} as const;

/** Who asked. Falls back to the group when a display name never arrived. */
export function invitationFrom(inviterName: string | null): string {
  const name = inviterName?.trim();
  return name ? `From ${name}.` : 'From someone you have both added.';
}

/**
 * What declining does, and what it does not do — PC-04, verbatim.
 *
 * Both halves are true and both are load-bearing. The inviter learns the answer
 * and nothing else. And declining is reversible in the schema, not merely in
 * the copy: `can_see_circle` includes `declined` precisely so a turned-down
 * invitation stays reachable, and the transition trigger permits
 * `declined → joined` and `declined → invited` both.
 */
export function declineNote(inviterName: string | null): string {
  const name = inviterName?.trim() || 'them';
  return `Declining tells ${name} only that you declined. You can be invited again later.`;
}

/**
 * THE SEAT THAT WAS GONE BY THE TIME YOU ANSWERED.
 *
 * Reachable, and only recently: the cap now guards UPDATE as well as INSERT, so
 * an invitee who declined, watched the owner refill their seat, and then came
 * back to accept is refused by `enforce_circle_size`. Before that guard the
 * group could quietly overrun twelve, so this state is the price of the cap
 * actually being a cap.
 *
 * It says what happened, does not blame the reader, and does not throw the
 * invitation away — the row is still `invited` or `declined`, `can_see_circle`
 * still admits both, and accepting later is one tap if a seat comes back. It
 * names nobody: who took the seat is a roster fact and the reader is not on the
 * roster.
 */
export const ACCEPT_REFUSED_FULL = {
  title: 'The group filled up.',
  body: `A group holds ${CAP_SPELLED} people, and every seat was taken while this invitation waited. Nothing was lost — the invitation stays here, and you can accept it if a seat opens.`,
} as const;

// ---------------------------------------------------------------------------
// PC-05 · Invited, waiting
// ---------------------------------------------------------------------------

export const PENDING = {
  /** The section over the outstanding invitations on the owner's manage page. */
  heading: 'Invitations',
  /**
   * The status under a name that has not answered. A fact, not a nudge: there
   * is no reminder, no chaser and no "waiting 3 days" — an invitation that
   * pressured somebody would be the opposite of what an invite-only room is
   * for.
   */
  status: 'Invited · waiting for an answer',
  /** The same fact spoken. See `memberCountPhrase` for why the dot goes. */
  spokenStatus: 'Invited, waiting for an answer',
  /** The owner's own way back out of an invitation they sent. */
  withdraw: 'Withdraw',
} as const;

/** "Invitations · 2 waiting" — the count beside the section heading. */
export function invitationsWaiting(n: number): string {
  const count = Number.isFinite(n) ? Math.max(Math.floor(n), 0) : 0;
  return count === 1 ? '1 waiting' : `${count} waiting`;
}

// ---------------------------------------------------------------------------
// PC-06 · The overview, and the one-member state under it
// ---------------------------------------------------------------------------

/** What a group row says about itself under its name. */
export function groupRowLine(memberCount: number, isOwner: boolean): string {
  return isOwner ? `${memberLine(memberCount)} · you own it` : memberLine(memberCount);
}

/**
 * A GROUP WITH ONE MEMBER IS NOT AN EMPTY STATE AND NOT AN ERROR.
 *
 * It is where every group begins. `handle_new_circle` inserts the owner as
 * `joined` in the same transaction that creates the group, and the schema
 * enforces no floor of two on purpose: a minimum would make creation
 * impossible, and enforced on departure it would trap the second-to-last person
 * in a room they want to leave. "Two to twelve" is a liveness property the
 * client draws, and this is the drawing.
 *
 * It shares no sentence with PC-01 — deliberately, and the copy test asserts
 * it. The two look alike from the data (a page with no other people on it) and
 * are different problems with different actions: one is "you have no groups",
 * this one is "you have a group and it is waiting for somebody".
 */
export const ALONE = {
  title: 'Just you, so far.',
  body: 'The group exists and it is yours. Ask one person and it starts — until then nobody else knows it is here.',
  action: 'Invite a friend',
} as const;

// ---------------------------------------------------------------------------
// PC-07 · Managing it
// ---------------------------------------------------------------------------

export const MANAGE = {
  heading: 'Members',
  /** The word on the badge. Never a colour, never a crown — a word. */
  ownerBadge: 'Owner',
  remove: 'Remove',
  /**
   * PC-07, verbatim, and the second clause is the promise.
   *
   * "Not who removed them" is kept by there being nothing to keep: the removed
   * person's row records `state = 'removed'` and `invited_by`, which can only
   * ever have been the owner who invited them, and the schema surfaces no
   * remover column at all. There is no field for the client to leak.
   */
  removalNote:
    'Removing someone ends their access immediately. They are told they were removed, not who removed them.',
  /**
   * The owner cannot leave — the transition trigger refuses `owner → left` in
   * as many words. Transfer is unresolved in the design record, so this states
   * the conservative default rather than inventing one, and says plainly that
   * handing the group on is not a thing yet instead of implying it might be.
   */
  ownerCannotLeave:
    'You made this group, so you cannot leave it. Deleting it is the way out, and there is no way to hand it to someone else yet.',
  leave: 'Leave the group',
  delete: 'Delete the group',
} as const;

/** "Joined Mar 4" — the quiet line under a name on the roster. */
export function joinedLabel(joinedAt: string | null): string {
  if (!joinedAt) return '';
  const at = new Date(joinedAt);
  if (Number.isNaN(at.getTime())) return '';
  const month = at.toLocaleDateString('en-US', { month: 'short' });
  return `Joined ${month} ${at.getDate()}`;
}

// ---------------------------------------------------------------------------
// PC-08 · The two departures, and they are not the same act
// ---------------------------------------------------------------------------

/** `Delete “Sunday tennis”?` — the name in the question, so nothing is ambiguous. */
export function deleteGroupHeading(name: string): string {
  return `Delete “${name.trim()}”?`;
}

/**
 * WHAT IS LOST, NAMED, AT ANY NUMBER.
 *
 * Three sentences and each one is a separate fact: everyone loses access, the
 * outstanding invitations are canceled, and it cannot be undone. All three are
 * true of the schema — `circle_members` is `on delete cascade`, so the members
 * and every unanswered invitation go with the row, and nothing anywhere keeps a
 * copy.
 *
 * The count is spelled and the sentence rebuilds around it, because "All one
 * members lose access" is how a headline ships broken. One member is the
 * owner alone — the liveness state — and there the honest sentence is that
 * nobody else is affected at all.
 */
export function deleteGroupBody(memberCount: number): string {
  const n = Number.isFinite(memberCount) ? Math.max(Math.floor(memberCount), 0) : 0;
  const tail = 'Invitations still waiting are canceled. This cannot be undone.';

  if (n <= 1) return `You are the only member, so nobody else loses anything. ${tail}`;
  if (n === 2) return `Both members lose access immediately. ${tail}`;
  return `All ${spelledCount(n)} members lose access immediately. ${tail}`;
}

export const DELETE_GROUP = {
  confirm: 'Delete the group',
  /**
   * The calm outcome, first in reading order. `DeleteBoardSheet` set this
   * grammar and the reason holds here: the destructive action is the one that
   * has to be chosen deliberately, so it is not the one the eye lands on.
   */
  keep: 'Keep the group',
} as const;

export function leaveGroupHeading(name: string): string {
  return `Leave “${name.trim()}”?`;
}

/**
 * LEAVING IS NOT BEING REMOVED, AND THE ROSTER SAYS SO.
 *
 * This is the whole reason `circle_member_state` has five values where
 * `event_member_state` has four. Someone who walked out must not appear to have
 * been thrown out, so the copy states which record is written — anything vaguer
 * would leave the reader to guess how it looks to the people still in the room,
 * which is the actual question somebody leaving a small group has.
 *
 * It does not promise silence, because the schema does not deliver silence: the
 * `left` row stays on the roster and the people still in it can read it. Copy
 * that claimed more than the trigger does is the exact failure
 * `block_retracts_votes` was written to correct.
 */
export const LEAVE_GROUP = {
  body: 'You lose access straight away. The roster shows that you left, not that you were removed — and the owner can invite you back later.',
  confirm: 'Leave the group',
  stay: 'Stay in the group',
} as const;

export function removeMemberHeading(name: string): string {
  return `Remove ${name.trim()}?`;
}

export const REMOVE_MEMBER = {
  body: `${MANAGE.removalNote} You can invite them again later.`,
  keep: 'Keep them in the group',
} as const;

export function removeMemberConfirm(name: string): string {
  return `Remove ${name.trim()}`;
}

// ---------------------------------------------------------------------------
// PC-09 · Offline
// ---------------------------------------------------------------------------

/**
 * Two sentences, and the second is the one that matters.
 *
 * "Nothing changed" is the claim an empty state would have got wrong: the read
 * failed, and a failed read says nothing whatever about what is or is not
 * there. No kicker here, unlike Daily Social's — the headline already says
 * OFFLINE in its first word, and a caps lead-in above it would be the same
 * announcement twice.
 */
export const OFFLINE = {
  title: 'You’re offline.',
  body: 'Cinch couldn’t load your groups. Nothing changed.',
  action: 'Try again',
} as const;

// ---------------------------------------------------------------------------
// PC-10 · Full
// ---------------------------------------------------------------------------

/**
 * The cap, stated where the owner can act on it.
 *
 * At the invitation and not at the acceptance — which is the whole reason the
 * seat count includes outstanding invitations. Counting only members would push
 * this sentence onto the twelfth person to tap Accept, who cannot see the cause
 * and could not have avoided it.
 */
export const FULL = {
  title: 'This group is full.',
  body: `A group holds ${CAP_SPELLED} people. Remove someone before inviting another.`,
} as const;

// ---------------------------------------------------------------------------
// What VoiceOver hears
// ---------------------------------------------------------------------------

/**
 * A group row, as one sentence.
 *
 * Composed rather than left to VoiceOver's default traversal because the row is
 * a name over a quiet data line, and swiping through two fragments of that is
 * worse than hearing the fact once.
 */
export function groupRowAccessibilityLabel({
  name,
  memberCount,
  isOwner,
}: {
  name: string;
  memberCount: number;
  isOwner: boolean;
}): string {
  const owned = isOwner ? ' You own it.' : '';
  return `${name.trim()}. ${memberCountPhrase(memberCount)}. Private.${owned}`;
}

/**
 * A roster row: who, what they are, and since when.
 *
 * The Owner badge is spoken as a word here because it is drawn as a word there
 * — a badge whose meaning lived in its fill would be inaudible, and a badge
 * whose meaning lived in an icon would be unreadable to anyone who does not
 * already know the icon.
 */
export function memberRowAccessibilityLabel({
  name,
  isOwner,
  joinedAt,
}: {
  name: string;
  isOwner: boolean;
  joinedAt: string | null;
}): string {
  const parts = [name.trim()];
  if (isOwner) parts.push(MANAGE.ownerBadge);
  const joined = joinedLabel(joinedAt);
  if (joined) parts.push(joined);
  return `${parts.join(', ')}.`;
}

/** The destructive control names its target, so it can never be a blind tap. */
export function removeAccessibilityLabel(name: string): string {
  return `${MANAGE.remove} ${name.trim()} from the group`;
}

/** An invitation still out, spoken with its status rather than only its name. */
export function pendingRowAccessibilityLabel(name: string): string {
  return `${name.trim()}. ${PENDING.spokenStatus}.`;
}

/**
 * A picker row, with its reason inside the label when it has one.
 *
 * The reason rides in the SPOKEN string as well as the drawn one, because a
 * reader who cannot see the row is exactly the reader who cannot see why it did
 * nothing. `accessibilityState.disabled` says that it is off; only the words
 * say why.
 *
 * Whether the row is CHOSEN is carried by `accessibilityState.selected`, not by
 * the label — a label that changed to "…, selected" would announce the change
 * twice for a reader who has both.
 */
export function pickerRowAccessibilityLabel({
  name,
  reason,
}: {
  name: string;
  reason: InviteIneligibility;
}): string {
  const why = ineligibilityReason(reason);
  return why ? `${name.trim()}. ${why}.` : name.trim();
}

/** The hint under a selectable picker row. States what a tap does, and no more. */
export const PICKER_HINT = 'Choose who to invite. Nothing is sent until you confirm.';

export function acceptAccessibilityLabel(groupName: string): string {
  return `${INVITATION.accept} the invitation to ${groupName.trim()}`;
}

export function declineAccessibilityLabel(groupName: string): string {
  return `${INVITATION.decline} the invitation to ${groupName.trim()}`;
}
