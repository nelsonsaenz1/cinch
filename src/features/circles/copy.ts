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

import { CIRCLE_MAX_MEMBERS, type InviteIneligibility } from './types';

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
  title: 'New group',
  fieldLabel: 'Name',
  /**
   * The atlas's own example. A place and a day, not a sentence — which is why
   * the schema caps the name at 60 characters rather than an event title's 80.
   */
  placeholder: 'Sunday tennis',
  helper: 'Only members see this name.',
  /**
   * ONE WORD, BECAUSE IT SITS IN THE NAV BAR.
   *
   * PC-02 puts Cancel and Create at the top, in iOS's own create-sheet grammar,
   * and there is no second commit anywhere on the frame. A nav-bar control is
   * read against the title beside it ("New group" · "Create"), so the article
   * the old full-width button needed — "Create the group" — is furniture here.
   * The spoken label restores the noun; see `CREATE.actionSpoken`.
   */
  action: 'Create',
  /** What VoiceOver hears, since "Create" alone is a verb with no object. */
  actionSpoken: 'Create group',
  cancel: 'Cancel',
  /**
   * PC-02's second half: the three facts, in a card, before anybody commits.
   *
   * ── ONE DEVIATION FROM THE FRAME, AND IT IS DELIBERATE ─────────────────────
   *
   * The atlas's third line reads "You own it. You can rename, remove, or delete
   * it." Renaming has no surface in the shipped app — `useRenameCircle` is
   * wired to nothing, by the accepted record's own decision — so printing the
   * word here would be the create screen promising a control the owner then
   * cannot find. The clause is dropped rather than the line, because the other
   * two facts (ownership, and the two things an owner really can do) are the
   * ones that make the following screens legible. Restore the word in the same
   * commit that ships the rename surface, and not before.
   */
  aboutHeading: 'What a group is',
  about: [
    'Two to twelve people.',
    'Only friends you both added can be invited.',
    'You own it. You can remove people, or delete it.',
  ],
} as const;

// ---------------------------------------------------------------------------
// PC-03 · Choosing who
// ---------------------------------------------------------------------------

export const PICKER = {
  /** Plural. The picker is a multi-select and PC-03 sends three at a time. */
  title: 'Invite friends',
  /**
   * States the mutual rule before anybody taps, because it is the reason the
   * list is as short as it is — and states the other half, which is the one
   * people actually wonder about: nothing here is a suggestion. Checked once,
   * at the invitation, and never again on read — an unfollow must not be a
   * second, invisible exit.
   *
   * Set as the footnote UNDER the list rather than as a lead paragraph over it,
   * exactly where PC-03 draws it: it explains a list somebody is already
   * looking at, and above the list it would be explaining nothing yet.
   */
  body: 'Only friends you both added appear here. Cinch never suggests anyone else.',
  cancel: 'Cancel',
} as const;

/**
 * "Mutual friends only · 3 of 12 chosen" — the line under the title.
 *
 * The count is `chosen of the cap`, not `chosen of the candidates`: what the
 * reader needs is how close they are to filling the room, and the room is the
 * thing with a number on it. PC-10 draws the same line with the group's name in
 * front and the seats exhausted ("Sunday tennis · 12 of 12"), which is
 * `groupSeatLine` below — a different sentence for a different question.
 */
export function pickerSubtitle(chosen: number): string {
  const n = Number.isFinite(chosen) ? Math.max(Math.floor(chosen), 0) : 0;
  return `Mutual friends only · ${n} of ${CIRCLE_MAX_MEMBERS} chosen`;
}

/** PC-10's version: whose group, and that every seat in it is spoken for. */
export function groupSeatLine(name: string, seatsTaken: number): string {
  const n = Number.isFinite(seatsTaken) ? Math.max(Math.floor(seatsTaken), 0) : 0;
  return `${name.trim()} · ${n} of ${CIRCLE_MAX_MEMBERS}`;
}

/**
 * THE SEND BUTTON COUNTS WHAT IT IS ABOUT TO DO.
 *
 * "Send 3 invitations", verbatim from PC-03 — and the atlas is right that the
 * number belongs on the control rather than beside it: this is the one tap in
 * the flow that writes to other people's accounts, and a button that said only
 * "Send" would leave the reader to remember how many rows they ticked.
 *
 * At zero it is PC-10's label — the button is inert, and a "Send 0 invitations"
 * would be arithmetic where a state belongs.
 */
export function sendInvitationsLabel(chosen: number): string {
  const n = Number.isFinite(chosen) ? Math.max(Math.floor(chosen), 0) : 0;
  if (n === 0) return 'Send invitations';
  if (n === 1) return 'Send 1 invitation';
  return `Send ${n} invitations`;
}

/**
 * The disabled send button, spoken — PC-10's own VoiceOver row.
 *
 * `accessibilityState.disabled` says the control is off; only these words say
 * why, and a reader who cannot see the notice above the list is exactly the
 * reader who needs them.
 */
export const SEND_UNAVAILABLE_FULL = 'Send invitations, unavailable, this group is full';

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
 * Why a row cannot be chosen — PC-03's three and PC-10's fourth, verbatim.
 *
 * `not_mutual` is what a block looks like from here, and it is the honest thing
 * to say: the block deleted both follow edges, so the pair genuinely are no
 * longer mutual friends. A "blocked" reason would disclose the block; a greyed
 * row with no words at all would disclose nothing and explain nothing, which is
 * the failure the row-level reason exists to prevent.
 *
 * `already_member` and `invite_pending` are the two the picker used to answer
 * by DELETING THE ROW. That was the same failure one channel further out: a
 * friend who is simply not in the list is indistinguishable from a friend the
 * app has never heard of, and the reader's question — "why can I not ask Ellis?"
 * — went unanswered. Neither string names a group, a date or a third party;
 * each says only what is true of the reader's own relationship to this room.
 */
export const INELIGIBILITY_REASONS: Record<Exclude<InviteIneligibility, null>, string> = {
  group_full: 'Group is full',
  not_mutual: 'No longer a mutual friend',
  already_member: 'Already a member',
  invite_pending: 'Invite pending',
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
  /** The screen's own title, when an invitation is the whole of what is on it. */
  title: 'Invitation',
  /**
   * The section over invitations addressed to the READER, on their own list.
   *
   * Deliberately not `PENDING.heading`. That one is "Invitations" and sits over
   * the owner's OUTGOING invitations on the manage surface — the same noun for
   * the opposite direction. On the reader's list the distinction is the whole
   * point: these are the ones waiting on THEM, and the two headings can appear
   * within a couple of taps of each other.
   */
  heading: 'Waiting for you',
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

/**
 * Who asked — PC-04's own phrase, and it leads the card.
 *
 * "Maya Okonkwo" over "invited you · 2 hours ago" is the frame's order, and the
 * order is the argument: the first question anybody has about an invitation is
 * who sent it, and the second is to what. The old "From Maya." read as a
 * postmark under a headline about a group the reader has never heard of.
 *
 * The nameless fallback says how the pair are related rather than "someone",
 * because `social_profiles` withholding a name does not withhold the fact that
 * the two of them added each other — the INSERT policy would have refused the
 * invitation otherwise.
 */
export function invitationFrom(inviterName: string | null): string {
  const name = inviterName?.trim();
  return name ? `${name} invited you` : 'Someone you have both added invited you';
}

/**
 * HOW LONG AGO, IN THE COARSEST UNIT THAT IS STILL TRUE.
 *
 * Minutes for the first hour, hours for the first day, then days — and never a
 * clock time, which would be a second fact about somebody's habits printed
 * beside their name. Rounded DOWN, so nothing ever claims more elapsed time
 * than has actually passed.
 *
 * Shared by PC-04's "invited you · 2 hours ago" and PC-05's "Invited 2 days
 * ago", so an owner and their invitee are never looking at two different
 * accounts of the same moment.
 */
export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * "invited you · 2 hours ago", and the same fact without the drawn separator.
 *
 * Two returns rather than one string the label strips, for the reason
 * `memberCountPhrase` exists: a middle dot spoken is either silence or the
 * words "middle dot", and a regex that removed it afterwards would be a second
 * place the sentence is assembled.
 */
export function invitationMetaLine(
  inviterName: string | null,
  invitedAt: string | null,
  now: Date = new Date(),
): {
  drawn: string;
  spoken: string;
} {
  const when = timeAgo(invitedAt, now);
  const who = invitationFrom(inviterName);
  // The name leads the card on its own line, so this line is the verb phrase.
  const drawn = when ? `invited you · ${when}` : 'invited you';
  return { drawn, spoken: when ? `${who} ${when}.` : `${who}.` };
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
  /** PC-05's two sections: who has not answered, and who is no longer waiting. */
  waitingHeading: 'Waiting',
  closedHeading: 'Closed',
  /**
   * The status under a name that has not answered, when no timestamp arrived.
   * A fact, not a nudge: there is no reminder, no chaser and no "waiting 3
   * days" — an invitation that pressured somebody would be the opposite of what
   * an invite-only room is for. `invitedLabel` is the dated version PC-05 draws.
   */
  status: 'Invited · waiting for an answer',
  /** The same fact spoken. See `memberCountPhrase` for why the dot goes. */
  spokenStatus: 'Invited, waiting for an answer',
  /**
   * The owner's own way back out of an invitation they sent — PC-05's word.
   *
   * "Revoke" rather than the old "Withdraw" because the frame says so, and
   * because it is the word the lifecycle table uses for the state the row lands
   * in (`pending → revoked`). One word for one transition, on the screen and in
   * the record.
   */
  withdraw: 'Revoke',
  /** PC-05's second control: the door back open, on a row that closed. */
  inviteAgain: 'Invite again',
  /** The status on a closed row the reader turned down. */
  declined: 'Declined',
  /**
   * PC-05's footnote, and it is a promise about the OTHER invitees.
   *
   * True by construction: nothing in this feature ever hands one invitee
   * another's row. The membership select policy is "your own row, always;
   * everyone else's only if you are joined", so an invitee querying the roster
   * gets exactly themselves.
   */
  footnote:
    'Only you can see who was invited. Nobody is told who else received an invitation.',
} as const;

/**
 * "Invited today", "Invited 2 days ago" — PC-05's row status.
 *
 * A date rather than a standing "waiting" label, which is the difference
 * between a fact and a nudge: the row states when the owner asked and stops.
 *
 * COARSER THAN `timeAgo` ON PURPOSE, and PC-04 and PC-05 are drawn that way.
 * The invitee is answering a thing that just arrived and the hour matters to
 * them; the owner is looking down a list of people who have not replied, and
 * "Invited 6 hours ago" invites exactly the arithmetic — is that long? should I
 * ask again? — that this feature has no chaser for. Days, and nothing finer.
 *
 * Falls back to `PENDING.status` when no timestamp arrived, so the row is never
 * a name with nothing under it.
 */
export function invitedLabel(invitedAt: string | null, now: Date = new Date()): string {
  if (!invitedAt) return PENDING.status;
  const at = new Date(invitedAt);
  if (Number.isNaN(at.getTime())) return PENDING.status;

  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  if (days <= 0) return 'Invited today';
  if (days === 1) return 'Invited yesterday';
  return `Invited ${days} days ago`;
}

/** The same, spoken — no middle dot, and it says what it is waiting for. */
export function invitedSpokenLabel(invitedAt: string | null, now: Date = new Date()): string {
  const drawn = invitedLabel(invitedAt, now);
  return drawn === PENDING.status ? PENDING.spokenStatus : drawn;
}

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
 * PC-06's line under the group's name — "4 members · you own this group".
 *
 * Not `memberLine`, and the difference is the second half. On a LIST row the
 * useful second fact is that the group is private, because the row sits beside
 * other things in an app that has public surfaces. On the group's OWN screen
 * the reader is already inside a room whose invite-only nature the footnote
 * states in full at the foot; what they do not otherwise know is which of the
 * two sets of controls below belongs to them. So the role goes here, in words,
 * exactly as the access matrix requires ("every role is stated in words on the
 * relevant screen").
 */
export function groupSubtitle(memberCount: number, isOwner: boolean): string {
  return isOwner
    ? `${memberCountPhrase(memberCount)} · you own this group`
    : memberLine(memberCount);
}

/**
 * PC-06's own strings: the two sections, the way in, and the closing promise.
 */
export const OVERVIEW = {
  membersHeading: 'Members',
  waitingHeading: 'Waiting',
  /**
   * "Invite someone", and not `ALONE.action`'s "Invite a friend".
   *
   * The liveness state is asking for THE first person and says so; this control
   * sits under a roster that already has people on it, where "a friend" would
   * imply the ones already there were something else. Same act, two rooms.
   */
  invite: 'Invite someone',
  /**
   * The closing footnote, and it is the sentence that makes the feature
   * legible. True by construction, not by promise: `circles`' select policy is
   * `can_see_circle(id)`, so a non-member's query returns nothing at all —
   * there is no listing to find it in and no existence oracle to ask.
   */
  footnote:
    'Invite-only. Members see each other and nothing beyond this group. There is no way to find it from outside.',
} as const;

/** "2 invitations waiting" — the row that leads to the outgoing invitations. */
export function invitationsWaitingRow(n: number): string {
  const count = Number.isFinite(n) ? Math.max(Math.floor(n), 0) : 0;
  return count === 1 ? '1 invitation waiting' : `${count} invitations waiting`;
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
  /**
   * The label on the way IN to this surface, from the group's own screen.
   *
   * Its own word rather than a second use of `heading`: the link sits directly
   * beneath the roster, and a control labelled "Members" under a list of
   * members reads as a heading for the list rather than a door out of it. It is
   * also honest about the difference — the screen it opens is where somebody is
   * removed, an invitation is withdrawn, and a group is left or deleted, none
   * of which the word "Members" prepares anybody for.
   */
  link: 'Manage',
  /** Spoken, where "Manage" alone is a verb with no object — PC-06's own label. */
  manageSpoken: 'Manage group',
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
  /** The row labels, PC-07 and PC-07b. Bare verbs: they sit inside a card. */
  leave: 'Leave group',
  delete: 'Delete group',
  /** PC-07's own title, and PC-07b's — two screens, two different subjects. */
  ownerTitle: 'Manage',
  memberTitle: 'This group',
  /** The nav-bar control that closes the surface without doing anything. */
  done: 'Done',
  /** PC-07's second section, over the group-level controls. */
  groupHeading: 'Group',
  /** PC-07b's, over the one control a member has. */
  memberHeading: 'What you can do',
} as const;

/** "Sunday tennis · you are the owner" — PC-07's line under the title. */
export function manageOwnerSubtitle(name: string): string {
  return `${name.trim()} · you are the owner`;
}

/**
 * "Sunday tennis · Maya Okonkwo owns it" — PC-07b's.
 *
 * Names the owner because a member's whole question on this screen is who the
 * controls they cannot see belong to. Falls back when `social_profiles` gave no
 * name: a co-member who is the owner's mutual friend but a stranger to the
 * reader resolves to nothing, and "undefined owns it" is how that ships.
 */
export function manageMemberSubtitle(name: string, ownerName: string | null): string {
  const owner = ownerName?.trim();
  return owner
    ? `${name.trim()} · ${owner} owns it`
    : `${name.trim()} · somebody else owns it`;
}

/**
 * PC-07b's footnote — the permission boundary, stated rather than implied by an
 * absence of buttons.
 *
 * The atlas's version lists renaming among the owner's powers; renaming has no
 * surface in the shipped app, so the word is dropped here for the same reason
 * it is dropped from `CREATE.about` — a member should not be told about a
 * control that does not exist, in either direction.
 */
export function memberPermissionNote(ownerName: string | null): string {
  const owner = ownerName?.trim() || 'The owner';
  return `Only ${owner} can invite, remove members, or delete this group. You can leave at any time.`;
}

/** "Members · 4" — PC-07's section heading, which counts as well as names. */
export function membersHeading(memberCount: number): string {
  const n = Number.isFinite(memberCount) ? Math.max(Math.floor(memberCount), 0) : 0;
  return `${MANAGE.heading} · ${n}`;
}

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
// PC-09b · The group that is not there any more
// ---------------------------------------------------------------------------

/**
 * A READ THAT SUCCEEDED AND CAME BACK WITH NOTHING, WHICH IS NOT AN ERROR.
 *
 * Before this the screen drew its ordinary frame around a name that was the
 * empty string and a member line reading "0 members · private" — a page
 * asserting facts about a group that no longer exists.
 *
 * ── WHY IT NAMES NOBODY, WHERE THE FRAME DOES ─────────────────────────────
 *
 * PC-09b's body reads "Maya deleted it." The client cannot say that and must
 * not learn how: `useCircle` answers `null` for a group that was deleted AND
 * for one the reader was removed from, deliberately and identically — a client
 * that could tell those apart would be telling somebody they were ejected,
 * which is the fact PC-07 spends a whole sentence refusing to disclose. So the
 * notice keeps the frame's second half, which is the load-bearing one, and
 * drops the attribution it cannot make honestly.
 *
 * "Nothing of yours was affected" is a claim this state IS entitled to: no
 * write was attempted, and a group's deletion cascades over its own rows only.
 */
export const GROUP_GONE = {
  title: 'This group no longer exists.',
  body: 'Nothing of yours was affected.',
  action: 'Back to groups',
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
  /**
   * The remedy, as a control rather than only as a clause.
   *
   * The sentence above already names it — "Remove someone before inviting
   * another" — and PC-10 draws a way to go and do it, because the alternative
   * is an owner reading an instruction and then hunting for the screen it
   * refers to. It is a link, not a filled button: the page's one commitment is
   * the (disabled) Send beneath, and nothing here is the act.
   */
  action: 'Manage members',
} as const;

// ---------------------------------------------------------------------------
// When a write is refused
// ---------------------------------------------------------------------------

/**
 * THE REFUSALS THAT HAVE NOWHERE ELSE TO GO.
 *
 * `classifyCircleError` names eight failures. Four of them already have a
 * surface and are deliberately absent from this table: `group_full` is PC-10's
 * notice, `not_mutual` is a reason printed on a picker row, `terms_required`
 * raises the app's existing terms sheet, and `stale` is SILENT ON PURPOSE — the
 * row moved, which is the interface's problem and not something to explain.
 * These four are the remainder, and until they were written the flow answered
 * an ordinary failed write with nothing at all.
 *
 * ── THE CLAIM DISCIPLINE, WHICH IS THE WHOLE DIFFICULTY HERE ────────────────
 *
 * The house rule is that a failed write SAYS SO and claims nothing about what
 * became of the data. `OFFLINE.body` may end "Nothing changed." because a
 * failed READ genuinely changed nothing. A failed WRITE is not entitled to that
 * sentence, and the two halves of this table are split on exactly that line:
 *
 * · `blockedText` and `invalidName` are refusals of the group NAME, raised by
 *   `assert_clean_ugc` and by `check (char_length(name) between 1 and 60)`.
 *   Both fire BEFORE the row exists, so "wasn't created" is a fact and may be
 *   stated. They belong beside the field, not in a banner: the thing to change
 *   is the name, and the name is in the box above.
 * · `rateLimited` and `unknown` may have landed. `enforce_social_rate_limits`
 *   refuses cleanly, but `unknown` covers the network never answering — which
 *   includes the server having committed and the reply having been lost. So
 *   neither claims nothing happened, and `unknown` sends the reader to look
 *   rather than telling them a state it cannot know.
 *
 * None of them blames the reader, none names a person, and none says "blocked".
 */
export const WRITE_FAILED = {
  /**
   * The catch-all, including the network never answering.
   *
   * It does NOT say "nothing was sent" or "try again" on its own: a retry of a
   * write that may already have landed is how somebody ends up with two of
   * something. Looking first is the honest instruction.
   */
  unknown: 'Cinch couldn’t finish that. Check the group before trying it again.',
  /**
   * `enforce_social_rate_limits` — 100 invitations a day, per inviter.
   *
   * States the boundary as a property of the day rather than an accusation.
   * The number is not printed: it is a server-side limit that may be tuned,
   * and a sentence naming 100 would be a second place it has to be changed.
   */
  rateLimited: 'That’s as many invitations as Cinch sends in one day. You can invite more tomorrow.',
} as const;

/**
 * The two refusals of the NAME, for the line under the field.
 *
 * Both say the group was not created, because at the moment either fires the
 * insert has definitively not happened — and a person staring at a name they
 * just typed needs to know whether to change it or to walk away believing they
 * have a group.
 */
export const NAME_REFUSED = {
  /**
   * `assert_clean_ugc`. Says the name cannot be used and stops — it does not
   * quote the offending word back, does not explain which rule was hit, and
   * does not call the reader anything.
   */
  blockedText: 'That name can’t be used. The group wasn’t created — try a different name.',
  /**
   * The length check. The field caps at 60 characters so the long end is
   * unreachable from the app; the reachable half is a name that is empty once
   * trimmed, and one sentence covers both ends without arithmetic.
   */
  invalidName: 'A group needs a name of 60 characters or fewer. The group wasn’t created.',
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

/** PC-05's "Invite Dana Lin again" — the label spelled as a sentence. */
export function inviteAgainAccessibilityLabel(name: string): string {
  return `Invite ${name.trim()} again`;
}

/**
 * An invitation still out, spoken with its status rather than only its name.
 *
 * The status is composed in rather than left to VoiceOver's traversal for the
 * reason `groupRowAccessibilityLabel` gives: the row is a name over a quiet
 * line, and swiping through two fragments of one fact is worse than hearing it
 * once. `invitedAt` is optional so the undated fallback still reads.
 */
export function pendingRowAccessibilityLabel(name: string, invitedAt: string | null = null): string {
  return `${name.trim()}. ${invitedSpokenLabel(invitedAt)}.`;
}

/** A closed invitation, spoken with the status printed on it. */
export function closedRowAccessibilityLabel(name: string, status: string): string {
  return `${name.trim()}. ${status}.`;
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
