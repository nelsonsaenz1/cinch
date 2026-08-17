/**
 * One `activity_events` row → its mark, its sentence, its stamp and its
 * actions.
 *
 * This is the piece of the Activity Center most likely to drift, so it is the
 * piece with no React in it: seven live event types × (a glyph, a bolded
 * sentence, a subtitle, up to two affordances) is a table, and a table belongs
 * in a pure module with a test beside it rather than in seven branches of JSX.
 * `features/activity/sentence.ts` made the same call for the AV taxonomy and
 * this file is its sibling, deliberately down to the shape of `Segment`, so a
 * single row renderer can draw either one.
 *
 * `now` is injectable for the same reason it is in `explore/timeline.ts`: the
 * day and week boundaries are exactly what cannot be tested by waiting.
 */

import {
  ACCEPTED_SUBTITLE,
  inviteAccepted,
  inviteDeclined,
  inviteRow,
  memberJoined,
  memberLeft,
  NEUTRAL_CIRCLE,
  NEUTRAL_NAME,
  REACTION_SUBTITLE,
  reactionRow,
  rowAccessibilityLabel,
  selfLeft,
} from './copy';
import { routeFor, type ActivityActor, type ActivityEvent, type ActivityEventType } from './types';

// ---------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------

/**
 * "A person's face when a person did it; the group's glyph when the news is
 * about the room."
 *
 * The split is the atlas's own, drawn row by row in AC-02: the two invitation
 * rows and the arrival row wear the group mark (a rounded square), the reaction
 * and acceptance rows wear a circular avatar. The rule behind the drawing is
 * whose SENTENCE it is — "Maya invited you to the circle Sunday Roasts" is
 * about the circle, "Ruth accepted your invitation" is about Ruth — and it is
 * written as a table rather than inferred, because inference here produces a
 * mark that flips when copy is edited.
 */
export type ActivityMark = { kind: 'person'; name: string | null } | { kind: 'circle' };

const MARK_FOR: Record<ActivityEventType, 'person' | 'circle'> = {
  'circle.invite.received': 'circle',
  'circle.invite.accepted': 'person',
  'circle.invite.declined': 'person',
  'circle.member.joined': 'circle',
  'circle.member.left': 'circle',
  'circle.self.left': 'circle',
  'daily.reaction.received': 'person',
  // Never produced. Present so the record is total and a missing key is a
  // compile error rather than an undefined mark at runtime.
  'outfit.saved.shared': 'person',
};

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

/**
 * Every affordance this surface has, and it is five.
 *
 * `accept` and `decline` WRITE — they move a `circle_members` row through the
 * transition trigger, and the other person finds out. `view` and `mute`
 * navigate or reuse an existing Circles control. `dismiss` touches nothing but
 * the reader's own inbox.
 *
 * There is no "mark read", no "mark all read", and no reply. Opening the screen
 * is the whole of being read, and there is nothing here to answer with words.
 */
export type ActivityActionId = 'accept' | 'decline' | 'view' | 'mute' | 'dismiss';

/**
 * Which actions a row carries INLINE, in the timeline.
 *
 * Only the pending invitation, which is AC-02's `InlineInviteRow`, and only
 * while it is live. Everything else is a fact: the row opens a detail or it
 * opens nothing, and a row of buttons under a sentence that reports something
 * already finished is furniture pretending to be a decision.
 *
 * A revoked row carries NOTHING inline — its only affordance is Remove, and
 * that lives in Edit mode where every row's does.
 */
export function inlineActionsFor(event: ActivityEvent): ActivityActionId[] {
  if (event.revokedAt) return [];
  return event.type === 'circle.invite.received' ? ['accept', 'decline'] : [];
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The trailing column: `2h` · `5h` · `Tue` · `Aug 1`.
 *
 * Deliberately NOT `sinceLabel` from `explore/timeline`, and the difference is
 * the atlas's. That one says "2h ago" / "Yesterday" / "3d ago", which is a
 * sentence fragment and reads as a second clause of the row it sits beside.
 * AC-02 draws a right-aligned STAMP — the shortest form that is still
 * unambiguous — because it is a column, and a column of prose is noise. The
 * spoken form below is where the long version lives, since a screen reader has
 * no column to align.
 *
 * Weekday names stop at six days out: a bare "Tue" beyond one week is
 * ambiguous, and anything past that takes the dated form.
 */
export function stamp(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const then = at.getTime();
  if (Number.isNaN(then)) return '';

  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);

  if (days <= 0) {
    const elapsed = Math.max(0, now.getTime() - then);
    if (elapsed < MINUTE) return 'Now';
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
    return `${Math.max(1, Math.floor(elapsed / HOUR))}h`;
  }
  if (days < 7) return at.toLocaleDateString('en-US', { weekday: 'short' });
  return at.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/**
 * The long form, for VoiceOver and for the detail screens' own byline —
 * "2 hours ago", "5 hours ago", "3 days ago", "1 Aug".
 *
 * Whole words because it is read aloud: "2h" is announced as "two h" by
 * VoiceOver, which is not a duration.
 */
export function spokenElapsed(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const then = at.getTime();
  if (Number.isNaN(then)) return '';

  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);

  if (days <= 0) {
    const elapsed = Math.max(0, now.getTime() - then);
    if (elapsed < MINUTE) return 'just now';
    if (elapsed < HOUR) {
      const m = Math.floor(elapsed / MINUTE);
      return `${m} minute${m === 1 ? '' : 's'} ago`;
    }
    const h = Math.max(1, Math.floor(elapsed / HOUR));
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return at.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

/**
 * A run of the sentence. `bold` marks a PROPER NOUN — the actor's name, the
 * group's name, the reaction word — and never a verb.
 *
 * Two bold runs per row is the atlas's own drawing ("**Maya** invited you to
 * the circle **Sunday Roasts**"), which is a deliberate departure from the AV
 * page's one-emphasis rule and is argued in `describeActivity` below.
 */
export interface Segment {
  text: string;
  bold?: boolean;
}

export interface ActivityLine {
  key: string;
  event: ActivityEvent;
  mark: ActivityMark;
  segments: Segment[];
  /** The second line under the sentence, or null when the row has none. */
  subtitle: string | null;
  /** The trailing column. */
  stamp: string;
  actions: ActivityActionId[];
  /** The plain sentence — bold is not a thing a screen reader says. */
  spoken: string;
  /** The whole composed `accessibilityLabel`, sentence + elapsed + unread. */
  label: string;
  /** Where a tap goes, or null when the row is inert. */
  href: string | null;
}

function actorName(actor: ActivityActor): string {
  return actor.name?.trim() || NEUTRAL_NAME;
}

function circleName(event: ActivityEvent): string {
  return event.payload.circle_name?.trim() || NEUTRAL_CIRCLE;
}

/**
 * Split a finished sentence into bold and plain runs by locating the proper
 * nouns inside it.
 *
 * WHY THIS AND NOT SEVEN HAND-BUILT SEGMENT ARRAYS. The strings live in
 * `copy.ts` as whole sentences, because that is what makes them reviewable as
 * copy and assertable as copy. Rebuilding each one here out of fragments would
 * put half of every sentence in this file and guarantee that an edit to one
 * copy of it drifts from the other. So the sentence is authored once, and the
 * emphasis is applied to it by finding the substrings that were interpolated
 * into it — which is exactly the set of runs that should be bold.
 *
 * First occurrence only, and nouns are matched longest-first so that a group
 * called "Maya" inside a sentence that also names Maya cannot swallow the
 * actor's run. A noun that does not appear (the neutral fallbacks, which are
 * common nouns and should not be emphasised) simply contributes nothing.
 */
function emphasise(sentence: string, nouns: readonly (string | null)[]): Segment[] {
  const marks: { start: number; end: number }[] = [];

  for (const noun of [...nouns].sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))) {
    if (!noun) continue;
    let from = 0;
    // Skip past any span already claimed, so two identical nouns each get
    // their own run rather than both landing on the first occurrence.
    for (;;) {
      const at = sentence.indexOf(noun, from);
      if (at < 0) break;
      const clash = marks.some((m) => at < m.end && at + noun.length > m.start);
      if (!clash) {
        marks.push({ start: at, end: at + noun.length });
        break;
      }
      from = at + 1;
    }
  }

  marks.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) segments.push({ text: sentence.slice(cursor, mark.start) });
    segments.push({ text: sentence.slice(mark.start, mark.end), bold: true });
    cursor = mark.end;
  }
  if (cursor < sentence.length) segments.push({ text: sentence.slice(cursor) });

  return segments.length > 0 ? segments : [{ text: sentence }];
}

/** The sentence and its emphasised nouns, per type. */
function sentenceFor(
  event: ActivityEvent,
  actor: ActivityActor,
): { text: string; nouns: (string | null)[]; subtitle: string | null } {
  const who = actorName(actor);
  const named = actor.name?.trim() || null;
  const circle = circleName(event);
  const namedCircle = event.payload.circle_name?.trim() || null;

  switch (event.type) {
    case 'circle.invite.received':
      return { text: inviteRow(who, circle), nouns: [named, namedCircle], subtitle: null };

    case 'circle.invite.accepted':
      return {
        text: inviteAccepted(who, circle),
        nouns: [named, namedCircle],
        subtitle: ACCEPTED_SUBTITLE,
      };

    case 'circle.invite.declined':
      return { text: inviteDeclined(who), nouns: [named], subtitle: null };

    case 'circle.member.joined':
      return { text: memberJoined(who, circle), nouns: [named, namedCircle], subtitle: null };

    case 'circle.member.left':
      return { text: memberLeft(who, circle), nouns: [named, namedCircle], subtitle: null };

    case 'circle.self.left':
      // "You" is bold in AC-08's drawing, and it is a proper noun here in the
      // only sense that matters — it is the subject the row is about.
      return { text: selfLeft(circle), nouns: ['You', namedCircle], subtitle: null };

    case 'daily.reaction.received': {
      const word = reactionLabel(event.payload.reaction);
      return {
        text: reactionRow(who, word),
        nouns: [named, word],
        subtitle: REACTION_SUBTITLE,
      };
    }

    case 'outfit.saved.shared':
      // Declared, never produced — see `types.ts`. If a producer is ever added
      // it arrives with its own copy key and this branch is where it lands;
      // until then the row would be dropped by `isActivityEventType`'s caller
      // long before reaching here, and this keeps the switch total.
      return { text: '', nouns: [], subtitle: null };
  }
}

/**
 * The reaction word, title-cased, from the three the schema allows.
 *
 * Mirrors `REACTION_LABELS` in `features/daily-social/copy.ts` by value without
 * importing it: this module is the Activity Center's own vocabulary and must
 * not take a dependency on another feature's copy file to render its own row.
 * The shared authority both files answer to is the CHECK constraint on
 * `daily_social_reactions.reaction`, and `tests/activity-center-copy.test.ts`
 * asserts the two agree.
 */
export function reactionLabel(reaction: string | null | undefined): string {
  switch (reaction) {
    case 'sharp':
      return 'Sharp';
    case 'cozy':
      return 'Cozy';
    case 'noted':
      return 'Noted';
    default:
      // A word this build does not know. "reacted to a look you shared" is
      // still true and is what AC-08's collapsed rows say anyway.
      return '';
  }
}

/**
 * The whole row, resolved. One call per event, memoised by the screen.
 *
 * ON TWO BOLD RUNS. `features/activity/sentence.ts` spends emphasis exactly
 * once per row, on the actor, and argues it well: two emphases in one sentence
 * is two emphases and therefore none. That rule is not carried over here, and
 * the reason is that these sentences carry a second proper noun that the reader
 * genuinely needs to find — WHICH GROUP. "Maya invited you to the circle
 * Sunday Roasts" is two facts, and a reader with four groups scanning a
 * timeline is looking for the room at least as often as for the person. The AV
 * page has no such second noun in any of its seven sentences, which is why its
 * rule costs it nothing and would cost this one the thing rows are scanned for.
 * AC-02 and AC-09 both draw both runs bold.
 */
export function describeActivity(
  event: ActivityEvent,
  actor: ActivityActor,
  now: Date = new Date(),
): ActivityLine {
  const { text, nouns, subtitle } = sentenceFor(event, actor);
  const unread = event.seenAt === null && !event.revokedAt;

  return {
    key: event.id,
    event,
    mark:
      MARK_FOR[event.type] === 'circle'
        ? { kind: 'circle' }
        : { kind: 'person', name: actor.name },
    segments: emphasise(text, nouns),
    subtitle,
    stamp: stamp(event.occurredAt, now),
    actions: inlineActionsFor(event),
    spoken: text,
    label: rowAccessibilityLabel(text, spokenElapsed(event.occurredAt, now), unread),
    // A revoked row still opens: AC-05 is a destination, not a dead end, and
    // it is the only place the reader is told what happened.
    href: routeFor(event),
  };
}
