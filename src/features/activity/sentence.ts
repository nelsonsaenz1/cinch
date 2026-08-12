/**
 * One feed row → its mark, its sentence, its elapsed label and its answer.
 *
 * This is the piece of the Activity page most likely to drift, so it is the
 * piece with no React in it: seven kinds × (a glyph, a bolded sentence, up to
 * two affordances) is a table, and a table belongs in a pure module with a
 * test beside it rather than in seven branches of JSX.
 *
 * Everything the sentence cannot derive from the row — the actor's name, the
 * garment's noun, the occasion's title and date — arrives as `ActivitySubjects`
 * from the query layer. `now` is injectable for the same reason it is in
 * `explore/timeline.ts`: the day boundaries are exactly what cannot be tested
 * by waiting.
 */

import { sinceLabel } from '@/features/explore/timeline';

import type { ActivityFeedRow, ActivityKind, ActivitySubjects } from './types';

// ---------------------------------------------------------------------------
// The mark.
// ---------------------------------------------------------------------------

/**
 * "A person's initials when a person did it; the tray-coloured glyph of the
 * object when the app did."
 *
 * The split is the atlas's own, drawn row by row: a friend reaching for you
 * (a follow either way, an ask to borrow) wears her face; everything the app
 * is reporting about an object — a calendar invitation, a returned garment,
 * a tally of votes, a compliment — wears the object's glyph. A returned coat
 * takes the hanger and not the returner's initials because the news is the
 * coat being back, which is the sentence's subject too.
 */
export type ActivityGlyph = 'calendar' | 'hanger' | 'bars' | 'heart';

export type ActivityMark =
  | { kind: 'person'; name: string | null }
  | { kind: 'glyph'; glyph: ActivityGlyph };

const GLYPH_FOR: Partial<Record<ActivityKind, ActivityGlyph>> = {
  event_invite: 'calendar',
  borrow_returned: 'hanger',
  votes: 'bars',
  compliment: 'heart',
};

// ---------------------------------------------------------------------------
// The answer.
// ---------------------------------------------------------------------------

/**
 * The seven affordances, and what each one actually does.
 *
 * `answer` writes; `destination` navigates. The distinction is load-bearing on
 * this page, because an answer has three visible states (pending, done, failed)
 * and a destination has none.
 *
 * **There is no "Decline".** `follows` is unilateral and publicly readable, so
 * a friend request has no pending record to reject: declining would either do
 * nothing or imply a rejection was transmitted. `not-now` takes the row off
 * your page and tells nobody. See the contract §4.3.
 *
 * "Not this time" on a borrow is a different animal and keeps its bite: a
 * `borrow_requests` row IS pending, the requester IS waiting, and declining it
 * is the answer she asked for. The two buttons look alike and mean different
 * things, so their outcome lines say which.
 */
export type ActivityActionId =
  | 'add-back'
  | 'not-now'
  | 'lend'
  | 'not-this-time'
  | 'open-event'
  | 'see-votes'
  | 'see-closet';

export interface ActivityAction {
  id: ActivityActionId;
  label: string;
  /**
   * AUDIT 90. Exactly one `solid` action per row, and its width is set by its
   * own word — Add back, Lend it — with a `quiet` text alternative beside it.
   * Informational rows carry a quiet action only. Nothing here is a 48pt
   * full-width pair: a page of paired blocks reads as a stack of badges, not
   * as sentences with a decision at the end.
   *
   * Solid is INK, never oxblood. A page of rows each carrying an affirmative is
   * exactly where the one-accent-per-screen rule gets broken.
   *
   * `quiet` replaced `outline`: two outlined pills side by side is the paired
   * shape the audit is against, and an outline on a destination made "See
   * board" look like a decision when it is a door.
   */
  tone: 'solid' | 'quiet';
  role: 'answer' | 'destination';
}

const ACTIONS: Record<ActivityActionId, ActivityAction> = {
  'add-back': { id: 'add-back', label: 'Add back', tone: 'solid', role: 'answer' },
  'not-now': { id: 'not-now', label: 'Not now', tone: 'quiet', role: 'answer' },
  lend: { id: 'lend', label: 'Lend it', tone: 'solid', role: 'answer' },
  'not-this-time': {
    id: 'not-this-time',
    label: 'Not this time',
    tone: 'quiet',
    role: 'answer',
  },
  'open-event': { id: 'open-event', label: 'Open the event', tone: 'quiet', role: 'destination' },
  // "See board" — the shared rail is where the votes are, and the shorter word
  // is the atlas's. "See the votes" implied a tally screen, which is exactly
  // the scoring this page refuses.
  'see-votes': { id: 'see-votes', label: 'See board', tone: 'quiet', role: 'destination' },
  'see-closet': { id: 'see-closet', label: 'See her closet', tone: 'quiet', role: 'destination' },
};

/**
 * What an answer says while it is in flight and once it has landed.
 *
 * The done line is the whole point of AV-05: the row keeps its place and
 * states the outcome in words rather than vanishing, so the reader can see
 * what they just did. Each one names its consequence honestly — "nothing was
 * sent" for the dismissal, "she has been told" for the two answers that really
 * do reach the other person.
 */
export interface AnswerCopy {
  /**
   * AV-02: a pending action is a present participle on a tray-filled label,
   * never a spinner replacing the row. A spinner says "wait" and nothing else;
   * a participle says which verb is in flight, and it holds still.
   */
  pending: string;
  done: string;
  /** A second, quieter line under `done`. Only the dismissal has one. */
  doneDetail?: string;
  /**
   * AV-02's failure line. It names what did NOT happen — above all whether the
   * other person was told — because that is the reader's real question. A bare
   * "Couldn't answer just now" leaves them unable to tell whether a friend is
   * now waiting on a reply they never sent.
   */
  failed: string;
}

/** The neutral name, for a row whose actor could not be hydrated. */
const SOMEONE = 'The other person';

function copyFor(id: ActivityActionId, who: string): AnswerCopy | null {
  switch (id) {
    case 'add-back':
      return {
        pending: 'Adding back…',
        done: 'Added back · her closet is open to you',
        failed: `Adding back did not go through. ${who} has not been told anything.`,
      };

    // THE SUBTLEST CASE IN THE GROUP. `useDismissActivity` inserts one row into
    // `activity_dismissals`, which `activity_feed()` filters on and nothing
    // else reads. The friend request itself is a `follows` edge and is
    // untouched — so it is still in Friends, and the sender cannot detect any
    // of this. Every one of those three facts is printed, and the word
    // "declined" appears nowhere, because no decline was written.
    case 'not-now':
      return {
        pending: 'Setting it aside…',
        done: `Request from ${who} set aside`,
        doneDetail: `Still waiting in Friends. ${who} was not told.`,
        failed: `Setting it aside did not go through. It is still in your list, and ${who} was not told.`,
      };

    case 'lend':
      return {
        pending: 'Lending…',
        done: `Lent · ${who} has been told`,
        failed: `Lending did not go through. ${who} has not been told anything.`,
      };

    case 'not-this-time':
      return {
        pending: 'Answering…',
        done: `Answered · ${who} has been told`,
        failed: `Answering did not go through. ${who} has not been told anything.`,
      };

    default:
      // Destinations navigate. They have no state to narrate.
      return null;
  }
}

export function answerCopy(id: ActivityActionId, actorName?: string | null): AnswerCopy | null {
  return copyFor(id, actorName?.trim() || SOMEONE);
}

/**
 * Which answers can be taken back, and how.
 *
 * Only the dismissal, and only because the reversal EXISTS:
 * `activity_dismissals` carries an owner delete policy and its grant
 * (`20260810100100_activity_feed.sql:79-82`), so `useUndoDismissActivity`
 * deletes the row and the feed row returns. Everything else here reaches
 * another person, and un-telling somebody is not a thing this app can do — so
 * no other row is drawn with an undo.
 */
export function isUndoable(id: ActivityActionId): boolean {
  return id === 'not-now';
}

export const ANSWER_UNDO = 'Undo';

/** Kept for the row's retry affordance. The sentence itself is `AnswerCopy.failed`. */
export const ANSWER_RETRY = 'Retry';

// ---------------------------------------------------------------------------
// Words.
// ---------------------------------------------------------------------------

/** The neutral noun for a garment the read path can no longer name. */
const NEUTRAL_GARMENT = 'piece';

/** The neutral name, matching `profileName`'s own fallback. */
const NEUTRAL_NAME = 'A Cinch member';

const DAY = 24 * 60 * 60_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * When an occasion is: "today" · "tomorrow" · "Friday" · "14 Aug".
 *
 * Calendar days, like every other date in the app, so the word never disagrees
 * with a wall clock across midnight. Weekday names stop at six days out — a
 * bare "Friday" is ambiguous beyond one week — and anything past that, or in
 * the past, falls through to the dated form.
 */
export function occasionWhen(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1 && days < 7) return at.toLocaleDateString('en-US', { weekday: 'long' });
  return `${at.getDate()} ${at.toLocaleDateString('en-US', { month: 'short' })}`;
}

/**
 * A tally, in words up to nine and in figures after.
 *
 * Printed, never estimated: `tally` is `count(*)` out of the aggregate branch
 * of `activity_feed()`. A row that somehow arrives without one says "Friends
 * voted", which is true, rather than inventing a number.
 */
export function friendCount(tally: number | null): string | null {
  if (tally === null || !Number.isFinite(tally) || tally < 1) return null;
  const n = Math.floor(tally);
  const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const word = n <= 9 ? words[n - 1] : String(n);
  return `${word} friend${n === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// The sentence.
// ---------------------------------------------------------------------------

/**
 * A run of the sentence. `bold` marks THE ACTOR, and nothing else — audit 91.
 * The verb, the object, the occasion's title and the timestamp are all regular,
 * so each row spends its emphasis exactly once.
 */
export interface Segment {
  text: string;
  bold?: boolean;
}

export interface ActivityLine {
  key: string;
  row: ActivityFeedRow;
  mark: ActivityMark;
  segments: Segment[];
  /** Uppercased by the `colophon` variant at render; written sentence-case here. */
  elapsed: string;
  actions: ActivityAction[];
  /** The plain string, for `accessibilityLabel` — bold is not a thing a screen reader says. */
  spoken: string;
}

function name(subjects: ActivitySubjects): string {
  return subjects.actorName || NEUTRAL_NAME;
}

function garment(subjects: ActivitySubjects): string {
  return subjects.garment || NEUTRAL_GARMENT;
}

/**
 * The row's sentence, as segments.
 *
 * Subject first, plain register, no exclamation marks. Where a second clause
 * survives — "Adding back opens your closet to each other", "It is back in your
 * closet" — it is the atlas's own copy and it is doing work: it says what the
 * affirmative will actually cause, which is the whole reason the button beside
 * it is safe to tap. Nothing editorial has been added.
 */
function segmentsFor(row: ActivityFeedRow, subjects: ActivitySubjects, now: Date): Segment[] {
  const who: Segment = { text: name(subjects), bold: true };

  switch (row.kind) {
    case 'follow_in':
      return [who, { text: ' wants to be friends. Adding back opens your closet to each other.' }];

    case 'follow_back':
      return [who, { text: ' added you back. Her closet is open to you.' }];

    case 'borrow_request': {
      const when = occasionWhen(subjects.eventStartsAt, now);
      // "for Friday" only when the ask is pinned to an occasion. A borrow with
      // no event has no date to promise, and inventing one would be a deadline
      // the requester never set.
      return [who, { text: ` asked to borrow the ${garment(subjects)}${when ? ` for ${when}` : ''}.` }];
    }

    case 'borrow_returned':
      return [who, { text: ` returned the ${garment(subjects)}. It is back in your closet.` }];

    case 'event_invite': {
      const when = occasionWhen(subjects.eventStartsAt, now);
      // An untitled occasion cannot happen — `events.title` is NOT NULL — but
      // an unreadable one can, if the invitation was revoked between the feed
      // read and the hydration. "an occasion" keeps the sentence true.
      const title = subjects.eventTitle;
      // AUDIT 91 — EMPHASIS ONCE PER ROW, ON THE ACTOR. The occasion's title
      // used to be bold too; two bold runs in one sentence is two emphases and
      // therefore none, and the reader's eye should land on who is asking.
      const head: Segment[] = title
        ? [who, { text: ' invited you to ' }, { text: title }]
        : [who, { text: ' invited you to an occasion' }];
      return [...head, { text: `${when ? `, ${when}` : ''}.` }];
    }

    case 'votes': {
      const count = friendCount(row.tally);
      const subject = count ? `${count} voted` : 'Friends voted';
      const title = subjects.eventTitle;
      // The atlas's "The linen blouse is ahead" is not printed. `activity_feed`
      // aggregates to one tally per look and carries no per-garment split, and
      // a page that fetched every vote to name a leader would be doing exactly
      // the scoring this page refuses. The row still says who voted on what.
      return title
        ? [{ text: `${subject} on your look for ` }, { text: title }, { text: '.' }]
        : [{ text: `${subject} on your look.` }];
    }

    case 'compliment':
      // Either an item or an outfit was liked; `closet_likes` allows both.
      return [
        who,
        {
          text: subjects.garment
            ? ` called your ${subjects.garment} a good call.`
            : ' called your look a good call.',
        },
      ];
  }
}

/** Which affordances a kind carries, and which of those have a destination to reach. */
function actionsFor(row: ActivityFeedRow): ActivityAction[] {
  switch (row.kind) {
    case 'follow_in':
      return row.actorId ? [ACTIONS['add-back'], ACTIONS['not-now']] : [];
    case 'follow_back':
      return row.actorId ? [ACTIONS['see-closet']] : [];
    case 'borrow_request':
      return [ACTIONS.lend, ACTIONS['not-this-time']];
    case 'event_invite':
      return row.eventId ? [ACTIONS['open-event']] : [];
    case 'votes':
      return row.eventId ? [ACTIONS['see-votes']] : [];
    case 'borrow_returned':
    case 'compliment':
      return [];
  }
}

/**
 * The whole row, resolved. One call per feed row, memoised by the page.
 *
 * `key` is `kind:subjectKey` — the same pair `activity_dismissals` is keyed on,
 * so a row and its dismissal cannot disagree about which row they are.
 */
export function describeActivity(
  row: ActivityFeedRow,
  subjects: ActivitySubjects,
  now: Date = new Date(),
): ActivityLine {
  const segments = segmentsFor(row, subjects, now);
  return {
    key: `${row.kind}:${row.subjectKey}`,
    row,
    mark: GLYPH_FOR[row.kind]
      ? { kind: 'glyph', glyph: GLYPH_FOR[row.kind]! }
      : { kind: 'person', name: subjects.actorName },
    segments,
    elapsed: sinceLabel(row.occurredAt, now),
    actions: actionsFor(row),
    spoken: segments.map((s) => s.text).join(''),
  };
}
