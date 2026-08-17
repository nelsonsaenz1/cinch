/**
 * What the Activity Center is allowed to tell the analytics store.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 *
 * §8: product analytics may record **that** a class of thing happened, never
 * **what**. Concretely, and these are the whole of it:
 *
 *   LOGGED           `event_type` (the enum, verbatim), `surface`
 *                    ('activity' | 'detail'), the booleans `had_unseen`,
 *                    `was_grouped`, `is_revoked`, the action enum, a latency
 *                    BUCKET, an error CLASS.
 *   NEVER LOGGED     actor or recipient identity, any handle or display name,
 *                    the reaction word, the group's name, the look's title,
 *                    any subject id, any raw error text, any free text at all.
 *
 * ── WHY A SERIALIZER AND NOT A CONVENTION ─────────────────────────────────
 *
 * Because the shape that leaks is the shape that is convenient. Every call site
 * here has an `ActivityEvent` in hand at the moment it wants to emit, and an
 * `ActivityEvent` carries `actorId`, `subjectId`, `circleId` and a `payload`
 * holding a group name — four fields that would each be a disclosure and all
 * four of which are one careless spread away from the wire. So no builder below
 * accepts an `ActivityEvent`. They accept the two or three bounded values the
 * event happens to contain, extracted at the call site where the narrowing is
 * visible in the diff, and `activityEventProps` re-derives nothing.
 *
 * `tests/activity-center-analytics.test.ts` executes every builder here against
 * events carrying planted identifiers and fails if any key or value could carry
 * one — the same property test `tests/private-circles-client.test.ts` runs over
 * `features/circles/analytics.ts`.
 *
 * ── WHY THIS FILE HAS NO `track` IMPORT ───────────────────────────────────
 *
 * `@/lib/posthog` pulls in expo-updates and the PostHog React Native SDK, and a
 * module that imports it cannot be executed by the node suite. The property
 * shapes are the part worth testing — they are where an id would leak in — so
 * they are built by pure functions here and handed to `track()` in
 * `queries.ts`. Same split, same reason, as `features/circles/analytics.ts`.
 */

import type { ActivityEventType } from './types';

/**
 * The four event names. Each is also a member of `AppEvent` in
 * `lib/posthog.tsx`, which is the closed union that makes a typo a compile
 * error rather than a second event that looks real and splits the funnel.
 *
 * There is deliberately no `activity_row_viewed` and no per-row impression
 * event. An event per row seen would, with a device id beside it, rebuild a
 * record of who is in somebody's groups and who reacts to their looks — inside
 * a third-party store, which is worse than doing it in the database. The four
 * below answer whether the surface is opened, whether it is opened because
 * something was waiting, what people do when they get there, and whether it
 * fails; none of them needs to know about a single row.
 */
export const ACTIVITY_EVENTS = {
  opened: 'activity_opened',
  itemOpened: 'activity_item_opened',
  action: 'activity_action',
  failed: 'activity_failed',
} as const;

/**
 * Where it happened. Two values, and coarse on purpose: 'detail' covers AC-03,
 * AC-04 and AC-05 together, because separating them would let a reader of the
 * data infer which subject a person landed on.
 */
export type ActivitySurface = 'activity' | 'detail';

/**
 * What was done. §8's own list, with no member that is not already a control
 * the reader can see.
 *
 * `open` is here as well as `activity_item_opened` because it is the one action
 * that also happens from a deep link, where there is no list to have opened it
 * from.
 */
export type ActivityAction =
  | 'open'
  | 'accept'
  | 'decline'
  | 'dismiss'
  | 'undo'
  | 'clear_all'
  | 'retry';

/**
 * Latency, as a band.
 *
 * Never milliseconds. A duration to the millisecond is close to a fingerprint,
 * and every decision this number informs — is the inbox fast enough — is
 * answered by four buckets.
 */
export type LatencyBucket = 'under_300ms' | '300ms_1s' | '1_3s' | 'over_3s';

export function latencyBucket(ms: number): LatencyBucket {
  if (!Number.isFinite(ms) || ms < 300) return 'under_300ms';
  if (ms < 1_000) return '300ms_1s';
  if (ms < 3_000) return '1_3s';
  return 'over_3s';
}

/**
 * Why a read failed, as a class.
 *
 * Never the message. PostgREST error text embeds column names, SQLSTATE hints
 * and occasionally the row it choked on; a network error's text embeds the URL.
 * These four are the only distinctions any fix would turn on.
 */
export type ActivityErrorClass = 'offline' | 'unauthorized' | 'server' | 'unknown';

/**
 * The timeline was opened. `had_unseen` is the boolean the entry dot was drawn
 * from — NOT a count, and there is no count in scope at the call site to send
 * by mistake.
 *
 * `item_count` is deliberately absent, and this is where the Activity Center is
 * stricter than Daily Social. A feed's `item_count` describes a stream; this
 * one would describe how much private traffic a specific person receives, which
 * is a shape, and a shape plus a timestamp plus a device id is identifying in
 * exactly the way `features/circles/analytics.ts` argues at length.
 */
export function activityOpenedProps(input: {
  hadUnseen: boolean;
  latencyMs: number;
}): { had_unseen: boolean; latency_bucket: LatencyBucket; surface: ActivitySurface } {
  return {
    had_unseen: input.hadUnseen,
    latency_bucket: latencyBucket(input.latencyMs),
    surface: 'activity',
  };
}

/**
 * A row was opened. Three bounded values and nothing else.
 *
 * `was_grouped` says whether the reader reached it through a collapsed AC-08
 * summary, which is the only read on whether collapsing helps or hides.
 * `is_revoked` says whether they landed on AC-05, which is the only read on how
 * often a deep link outlives its subject.
 */
export function activityItemOpenedProps(input: {
  eventType: ActivityEventType;
  wasGrouped: boolean;
  isRevoked: boolean;
}): { event_type: ActivityEventType; was_grouped: boolean; is_revoked: boolean } {
  return {
    event_type: input.eventType,
    was_grouped: input.wasGrouped,
    is_revoked: input.isRevoked,
  };
}

/**
 * Something was done. `event_type` is optional because two of the actions —
 * `clear_all` and `retry` — are about the page rather than a row, and sending a
 * type for them would mean picking one arbitrarily.
 */
export function activityActionProps(input: {
  action: ActivityAction;
  surface: ActivitySurface;
  eventType?: ActivityEventType;
}): { action: ActivityAction; surface: ActivitySurface; event_type?: ActivityEventType } {
  return {
    action: input.action,
    surface: input.surface,
    ...(input.eventType ? { event_type: input.eventType } : {}),
  };
}

/** A read failed. The class, and where. */
export function activityFailedProps(input: {
  errorClass: ActivityErrorClass;
  surface: ActivitySurface;
}): { error_class: ActivityErrorClass; surface: ActivitySurface } {
  return { error_class: input.errorClass, surface: input.surface };
}

/**
 * Classify a thrown value into one of the four classes.
 *
 * Reads `code` and `status` where they exist and NOTHING ELSE — in particular
 * never `message`, which is where the free text is. An unrecognised failure is
 * `unknown`, which is a real answer: it says the taxonomy is incomplete, and it
 * says it without shipping a string to find out why.
 */
export function classifyActivityError(error: unknown): ActivityErrorClass {
  const shape = error as { code?: unknown; status?: unknown; name?: unknown } | null;
  const code = typeof shape?.code === 'string' ? shape.code : null;
  const status = typeof shape?.status === 'number' ? shape.status : null;

  // PostgREST hands back a bare `TypeError: Network request failed` with no
  // code and no status; `AbortError` is a timeout we cut ourselves.
  if (shape?.name === 'AbortError' || shape?.name === 'TypeError') return 'offline';
  if (status === 401 || status === 403 || code === '42501') return 'unauthorized';
  if (status !== null && status >= 500) return 'server';
  if (code !== null) return 'server';
  return 'unknown';
}
