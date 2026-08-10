/**
 * The five channels, restated for Deno.
 *
 * There are three copies of this list and they are not allowed to drift:
 *
 *   1. `notification_prefs`' columns and `push_sends.channel`'s CHECK
 *      constraint — migration 20260810100300. THE AUTHORITY. A channel that is
 *      not in that CHECK cannot have a ledger row, so it cannot be sent at all.
 *   2. `src/features/push/channels.ts` — the preferences screen's copy, which
 *      is what the reader is actually promised.
 *   3. this file — the sender's dispatch table.
 *
 * (2) and (3) cannot import each other. An edge function resolves `npm:`
 * specifiers and no `@/*` aliases; the app resolves the aliases and not the
 * `npm:` specifiers. So each is pinned to (1) by a test instead, and the two
 * tests meet in the middle at the schema: `tests/push-channels.test.ts` holds
 * this file against the migration, and Unit N's
 * `tests/notification-channels.test.ts` holds `channels.ts` against the same
 * migration. Rename a channel anywhere and something fails.
 *
 * This module is deliberately import-free — no `npm:` specifiers, no `Deno`
 * globals — so the Node test runner can bundle it directly rather than
 * asserting against a hand-copied literal.
 *
 * Season in review is absent, and that is not an omission: atlas 34 is deferred
 * (contract §3), `notification_prefs` has no column for it, and the CHECK would
 * reject its ledger row.
 */

export const PUSH_CHANNELS = [
  'morning_edit',
  'friend_activity',
  'borrow_requests',
  'event_reminders',
  'votes_comments',
] as const;

export type PushChannel = (typeof PUSH_CHANNELS)[number];

/**
 * Which claim function answers "who is owed one of these right now".
 *
 * Named here rather than derived by string concatenation so that grepping for a
 * function name finds both ends of the call, and so an unknown channel cannot
 * be turned into an RPC name by an attacker who got past the shared secret.
 */
export const CLAIM_FUNCTION: Record<PushChannel, string> = {
  morning_edit: 'push_claim_morning_edit',
  friend_activity: 'push_claim_friend_activity',
  borrow_requests: 'push_claim_borrow_requests',
  event_reminders: 'push_claim_event_reminders',
  votes_comments: 'push_claim_votes_comments',
};

export function isPushChannel(value: unknown): value is PushChannel {
  return typeof value === 'string' && (PUSH_CHANNELS as readonly string[]).includes(value);
}
