// Hand-written row shapes for `circles` and `circle_members`, in the
// `src/features/social/db-rows.ts` style: snake_case, mirroring the wire
// format, mapped to camelCase by the feature that reads them.
//
// WHY BY HAND. `src/types/database.ts` and `src/lib/database.types.ts` are
// generated from the LIVE database with `npm run gen:types`, and
// 20260818000000_private_circles.sql has not been applied there yet — so the
// generated types name neither table, neither enum, nor the
// `circle_member_count` RPC. Hand-editing either generated file would be
// silently reverted by the next regen without anybody noticing, which is the
// failure `useFriendClosetMeta` already documents. These declarations are the
// interim, and the regen makes the cast in `client.ts` a no-op rather than a
// lie.

import type { CircleMemberRole, CircleMemberState } from './types';

/**
 * `circles` — five columns, and there is no sixth to add.
 *
 * No `visibility`: `events` needs one because it has two kinds, a private
 * group has exactly one, and a single-valued enum is a public mode nobody
 * approved. No member count either — that is the RPC's answer, not a column,
 * because a stored count would be a number the roster policy could contradict.
 */
export interface CircleRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * `circle_members` — the composite-key membership row.
 *
 * `invited_by` is nullable in the schema (`on delete set null`) and is
 * unreachable as null through any row this client can read: it is always the
 * owner, and `circles.owner_id` cascades on account deletion, so an owner
 * whose account is gone takes the group and every membership row with them.
 * The read path falls back to `circles.owner_id` anyway — provably the same
 * person, since the insert policy forces `invited_by = auth.uid()` and only
 * the owner may insert.
 *
 * There is no `joined_at`. `updated_at` is when the row entered the state it
 * is currently in, which is the fact both `joinedAt` and `invitedAt` want.
 */
export interface CircleMemberRow {
  circle_id: string;
  user_id: string;
  role: CircleMemberRole;
  state: CircleMemberState;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}
