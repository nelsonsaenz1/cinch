import { describeActivity, type ActivityLine } from './sentence';
import { NO_SUBJECTS, type ActivityFeedRow, type ActivityKind, type ActivitySubjects } from './types';

/**
 * The rows AV-01 and AV-02 are drawn from.
 *
 * FIXED CLOCK. `AV_NOW` is a literal, and every `occurredAt` is a literal
 * offset from it, so "2 hours ago" and "Three days ago" are the same strings on
 * every run and the day groupings never straddle a real midnight.
 *
 * FIVE KINDS, NOT SIX. The atlas's AV-01 draws a comment row ("Tomás commented
 * on the birthday dinner · Read"), and `activity_feed()` has no comment branch:
 * its union is `follows`, `borrow_requests`, `event_members`, `event_votes` and
 * `closet_likes` (`20260810100100_activity_feed.sql`). A row the backend cannot
 * produce is not drawn here — the compliment row takes its place, which is a
 * real fifth kind with a real read behind it.
 */

export const AV_NOW = new Date('2026-08-12T09:41:00');

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const at = (msAgo: number) => new Date(AV_NOW.getTime() - msAgo).toISOString();

function row(
  kind: ActivityKind,
  subjectKey: string,
  occurredAt: string,
  over: Partial<ActivityFeedRow> = {},
): ActivityFeedRow {
  return {
    kind,
    subjectKey,
    actorId: null,
    occurredAt,
    itemId: null,
    outfitId: null,
    eventId: null,
    postId: null,
    tally: null,
    ...over,
  };
}

const subjects = (over: Partial<ActivitySubjects> = {}): ActivitySubjects => ({
  ...NO_SUBJECTS,
  ...over,
});

/** One resolved line, built by the shipping sentence builder. */
function line(feedRow: ActivityFeedRow, over: Partial<ActivitySubjects> = {}): ActivityLine {
  return describeActivity(feedRow, subjects(over), AV_NOW);
}

// ---------------------------------------------------------------------------
// AV-01 · the five kinds this backend can actually produce
// ---------------------------------------------------------------------------

export const AV_PRIYA = line(
  row('follow_in', 'u-priya', at(2 * HOUR), { actorId: 'u-priya' }),
  { actorName: 'Priya' },
);

export const AV_INVITE = line(
  row('event_invite', 'e-birthday', at(DAY + HOUR), { actorId: 'u-sarah', eventId: 'e-birthday' }),
  {
    actorName: 'Sarah',
    eventTitle: 'her birthday dinner',
    eventStartsAt: new Date('2026-08-14T20:00:00').toISOString(),
  },
);

export const AV_BORROW = line(
  row('borrow_request', 'br-1', at(DAY + 2 * HOUR), { actorId: 'u-ana', itemId: 'i-overshirt' }),
  { actorName: 'Ana', garment: 'overshirt jacket' },
);

export const AV_VOTES = line(
  row('votes', 'p-friday', at(2 * DAY), { eventId: 'e-friday', postId: 'p-friday', tally: 2 }),
  { eventTitle: 'Friday' },
);

export const AV_COMPLIMENT = line(
  row('compliment', 'like-1', at(3 * DAY), { actorId: 'u-tomas', itemId: 'i-coat' }),
  { actorName: 'Tomás', garment: 'shearling coat' },
);

export const AV_LINES: ActivityLine[] = [
  AV_PRIYA,
  AV_INVITE,
  AV_BORROW,
  AV_VOTES,
  AV_COMPLIMENT,
];

// ---------------------------------------------------------------------------
// AV-02 · the row states
// ---------------------------------------------------------------------------

/** The dismissal is posed on Marguerite, so the frame's copy names a person. */
export const AV_MARGUERITE = line(
  row('follow_in', 'u-marguerite', at(4 * HOUR), { actorId: 'u-marguerite' }),
  { actorName: 'Marguerite' },
);

export const AV_STATE_LINES: ActivityLine[] = [AV_PRIYA, AV_BORROW, AV_MARGUERITE];
