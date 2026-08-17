/**
 * The Activity Center's shared vocabulary — the one module every other part of
 * the unit binds to.
 *
 * ── WHY THIS IS NOT `features/activity` ───────────────────────────────────
 *
 * `features/activity` is the AV atlas: seven kinds derived at read time out of
 * `follows`, `borrow_requests`, `event_members`, `event_votes` and
 * `closet_likes` by the `activity_feed()` RPC. Its taxonomy and this one do
 * not overlap in a single member — no follow, no borrow, no vote, no
 * compliment appears here, and no circle or Daily Social reaction appears
 * there. They are two DATA SOURCES for one screen, not two screens, and
 * `src/app/activity.tsx` merges them into a single reverse-chronological
 * timeline. Folding this taxonomy into that module would have meant one
 * `ActivityKind` union whose members came from two completely different
 * security models — one derived under the caller's own RLS, one materialised
 * per recipient at write time — and no reader of the union could have told
 * which rule applied to which member.
 *
 * ── NOTHING HERE HAS A RUNTIME DEPENDENCY ─────────────────────────────────
 *
 * No React, no react-native, no Supabase client. The presentational layer and
 * the node test suite both import it, and a shared vocabulary that drags a
 * native module into a test runner is not shared. The wire shapes live in
 * `db-rows.ts` and are mapped here at the read boundary — the `circles/types`
 * pattern, which is the `closet/queries.ts` pattern before it.
 */

/**
 * The taxonomy, and it is closed.
 *
 * These eight strings are `activity_event_type` in
 * `20260820000000_activity_center.sql:§1`, label for label and in the same
 * order. `tests/activity-center-taxonomy.test.ts` reads the enum back out of
 * that file and fails if the two ever disagree — which is the only way a union
 * transcribed by hand stays honest.
 *
 * `outfit.saved.shared` IS DECLARED AND NEVER PRODUCED. §13 of the design
 * record ships it disabled: no trigger emits one, and `EVENT_TEMPLATES` in
 * `sentence.ts` therefore has no template for it. It exists so that a future
 * save/share feature which genuinely creates a recipient-directed event can
 * emit it without a migration, and so that this union is a complete
 * transcription of the enum rather than a filtered one.
 */
export type ActivityEventType =
  | 'circle.invite.received'
  | 'circle.invite.accepted'
  | 'circle.invite.declined'
  | 'circle.member.joined'
  | 'circle.member.left'
  | 'circle.self.left'
  | 'daily.reaction.received'
  | 'outfit.saved.shared';

export const ACTIVITY_EVENT_TYPES: readonly ActivityEventType[] = [
  'circle.invite.received',
  'circle.invite.accepted',
  'circle.invite.declined',
  'circle.member.joined',
  'circle.member.left',
  'circle.self.left',
  'daily.reaction.received',
  'outfit.saved.shared',
];

/**
 * Narrow an untyped `event_type` off the wire.
 *
 * Unknown types are DROPPED, not rendered. A row whose type this build does
 * not know is a row from a newer server, and the honest thing to do with a
 * sentence you cannot form is not to say it — a blank row in an inbox reads as
 * data loss.
 */
export function isActivityEventType(value: unknown): value is ActivityEventType {
  return (
    typeof value === 'string' && (ACTIVITY_EVENT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * The two things an event can be about. `subject_type` in the schema, with the
 * same CHECK domain.
 *
 * It decides the detail route: a `circle` subject opens
 * `/activity/invitation/:id`, an `outfit` subject opens
 * `/activity/reaction/:id`. Both routes take the EVENT's id, never the
 * subject's — see `routeFor` below.
 */
export type ActivitySubjectType = 'circle' | 'outfit';

/**
 * The denormalised half of a row.
 *
 * Two fields, both bounded, both there because the row has to outlive its
 * subject: `can_see_circle` stops showing a removed person the room they were
 * removed from, so AC-05 could not name the group otherwise, and a reaction
 * that has been taken back has no word left to quote.
 *
 * `reaction` is `DailyReaction` from `features/daily-social/types` by value
 * but is typed as a bare string here on purpose — this module must not import
 * from another feature to describe its own wire shape, and the migration's
 * CHECK domain on `daily_social_reactions.reaction` is the thing that actually
 * bounds it. `sentence.ts` is where the three words become copy.
 */
export interface ActivityPayload {
  circle_name?: string | null;
  reaction?: string | null;
}

/** One row of `activity_events`, as the client uses it. */
export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  /**
   * Who did it. Null is legal and not exceptional — `circle.self.left` has no
   * third party in it — and it is ALSO what an unresolvable actor looks like,
   * because `actor_id` is `on delete set null`.
   */
  actorId: string | null;
  subjectType: ActivitySubjectType;
  subjectId: string;
  /** Null on a reaction: it has no group. */
  circleId: string | null;
  payload: ActivityPayload;
  occurredAt: string;
  /**
   * When the reader last opened the timeline with this row on it. Drives the
   * unread presentation and the entry dot, and is visible to NOBODY else —
   * there is no policy under which the actor of an event can read it.
   */
  seenAt: string | null;
  /** The subject went away. Renders AC-05 and carries no live action. */
  revokedAt: string | null;
}

/**
 * Everything a sentence needs that the row does not carry.
 *
 * Only a name, and it is nullable for the same reason `CircleMemberEntry`'s is:
 * `social_profiles` names people the caller is already related to, and a group
 * co-member who is the OWNER's mutual friend but a stranger to the reader
 * resolves to no name. A nameless row is the honest answer; borrowing one from
 * `public_profiles` would undo `20260810150100`.
 */
export interface ActivityActor {
  name: string | null;
  avatarUrl: string | null;
}

export const NO_ACTOR: ActivityActor = { name: null, avatarUrl: null };

/**
 * Where a row's detail lives.
 *
 * THE PARAM IS THE EVENT ID, NEVER THE SUBJECT ID, and that is what makes
 * "a deep link to a revoked item resolves to AC-05, never a dead end" true by
 * construction. An event id is readable exactly as long as the row is — RLS
 * says so — and it carries `revoked_at` with it, so the detail screen can
 * always answer. A subject id would not: `cinch://activity/invitation/<circle>`
 * points at a group the reader may have lost the right to see, and the only
 * possible answer at that point is a 404, which is the dead end the rule
 * forbids.
 *
 * Returns null for the types that have no detail. A `circle.member.left` is a
 * fact, not a place — there is nothing on the other side of a tap.
 */
export function routeFor(event: ActivityEvent): string | null {
  switch (event.type) {
    case 'circle.invite.received':
      return `/activity/invitation/${event.id}`;
    case 'daily.reaction.received':
      return `/activity/reaction/${event.id}`;
    default:
      return null;
  }
}

/** Unread means unseen, and nothing else. Never "not yet acted on". */
export function isUnread(event: ActivityEvent): boolean {
  return event.seenAt === null;
}
