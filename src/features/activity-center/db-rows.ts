// Hand-written row shape for `activity_events`, in the
// `src/features/circles/db-rows.ts` style: snake_case, mirroring the wire
// format, mapped to camelCase by the feature that reads it.
//
// WHY BY HAND. `src/types/database.ts` and `src/lib/database.types.ts` are
// generated from the LIVE database with `npm run gen:types`, and
// 20260820000000_activity_center.sql has not been applied there yet — so the
// generated types name neither the table, nor the `activity_event_type` enum,
// nor `activity_has_unseen`. Hand-editing either generated file would be
// silently reverted by the next regen without anybody noticing, which is the
// failure `useFriendClosetMeta` already documents. This declaration is the
// interim, and the regen makes the cast in `client.ts` a no-op rather than a
// lie.

import type { ActivityEventType, ActivitySubjectType } from './types';

/**
 * `activity_events` — eleven columns, and four of them are timestamps that
 * answer four different questions.
 *
 * `seen_at`   the reader looked. Feeds the dot. Nobody else can read it.
 * `dismissed_at` the reader removed it. The select policy hides it; the update
 *              policy does not, which is the five-second undo.
 * `revoked_at` the SUBJECT went away. Written by a definer, refused to a
 *              client by `assert_activity_event_update`.
 * `created_at` when it happened. The only sort key there is.
 *
 * `recipient_id` is deliberately absent from every SELECT this feature makes.
 * It is always `auth.uid()` — the policy guarantees it — so reading it back
 * would be asking the server to confirm who you are, and it would be one more
 * id sitting in a cache for a serializer to trip over.
 */
export interface ActivityEventRow {
  id: string;
  event_type: ActivityEventType;
  actor_id: string | null;
  subject_type: ActivitySubjectType;
  subject_id: string;
  circle_id: string | null;
  /** `jsonb` arrives parsed. Bounded by the schema: a group name and a reaction word. */
  payload: Record<string, unknown> | null;
  created_at: string;
  seen_at: string | null;
  dismissed_at: string | null;
  revoked_at: string | null;
}
