/**
 * The Activity page's wire shapes.
 *
 * `activity_feed()` (20260810100100) returns seven kinds out of five tables,
 * newest first, thirty days, block-filtered and dismissal-filtered. The
 * generated types call every column non-nullable — the RPC's `returns table`
 * declaration carries no nullability, and five of the nine columns are null on
 * most rows — so the honest shape is written here and asserted at the read
 * edge, the same move `features/events/queries.ts` makes for the social views.
 */

/**
 * The seven sentences this page can say.
 *
 * `follow_in` and `follow_back` are one table read two ways: if you already
 * follow her back it is news, and if you do not it is answerable. The union is
 * closed by a CHECK constraint on `activity_dismissals.kind`, so a kind added
 * later is a compile error here rather than a blank row.
 */
export type ActivityKind =
  | 'follow_in'
  | 'follow_back'
  | 'borrow_request'
  | 'borrow_returned'
  | 'event_invite'
  | 'votes'
  | 'compliment';

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'follow_in',
  'follow_back',
  'borrow_request',
  'borrow_returned',
  'event_invite',
  'votes',
  'compliment',
];

/** Narrow an untyped `kind` off the wire. Unknown kinds are dropped, not rendered. */
export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === 'string' && (ACTIVITY_KINDS as readonly string[]).includes(value);
}

/**
 * One row of `activity_feed()`.
 *
 * `subjectKey` is the synthetic identity the migration chose deliberately —
 * two of the seven kinds have no single-column primary key — and it is what a
 * dismissal is written against, so it travels with the row rather than being
 * re-derived anywhere.
 */
export interface ActivityFeedRow {
  kind: ActivityKind;
  subjectKey: string;
  /** Null on `votes`: the aggregate names no single voter, by design. */
  actorId: string | null;
  occurredAt: string;
  itemId: string | null;
  outfitId: string | null;
  eventId: string | null;
  postId: string | null;
  /** How many friends voted. Only `votes` carries one; a real count, never an estimate. */
  tally: number | null;
}

/** A stable list key. `kind` + `subjectKey` is the row's primary key server-side. */
export function activityRowKey(row: Pick<ActivityFeedRow, 'kind' | 'subjectKey'>): string {
  return `${row.kind}:${row.subjectKey}`;
}

/**
 * Everything a sentence needs that the feed row does not carry: the actor's
 * name, the garment's noun, the occasion's title and date.
 *
 * Resolved by `queries.ts` in three batched reads and handed to the pure
 * sentence builder, so the builder can be tested without a database and the
 * page cannot accidentally grow a per-row fetch.
 */
export interface ActivitySubjects {
  /** Full display name — the only bold in the sentence. Null when unresolved. */
  actorName: string | null;
  /** The garment's noun, lower case and mid-sentence: "shearling coat". */
  garment: string | null;
  /** The occasion's own title: "Sunday lunch". */
  eventTitle: string | null;
  /** The occasion's start, ISO. Null for a dateless occasion — the clause is dropped. */
  eventStartsAt: string | null;
}

export const NO_SUBJECTS: ActivitySubjects = {
  actorName: null,
  garment: null,
  eventTitle: null,
  eventStartsAt: null,
};
