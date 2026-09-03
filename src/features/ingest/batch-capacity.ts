/**
 * How many of a batch may go to the queue, decided BEFORE any photograph is
 * encoded, cut out or written — CMO ledger A28.
 *
 * ── THE DEFECT THIS REPLACES ────────────────────────────────────────────
 *
 * `capture.tsx` used to gate a batch of N on `capacity.full`, a boolean that
 * answers "is there room for ONE more?". On 2026-09-01 a new user with an
 * empty free closet picked 27 photographs, then 29: `full` was false both
 * times, so all 56 went to the queue, 10 landed, and `items_enforce_limit`
 * refused the other 46 — three attempts each, a native Vision pass per
 * attempt, and 46 identical "couldn't add your clothes" errors in 44 seconds.
 * Her third pick of 30 produced no failures at all, because by then `full`
 * was true and the closet-full sheet held them. The guard worked; it could
 * not see past the first photograph.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────
 *
 * Mirrors the catalogue import's `refuse()` (garment-search/import-batch.ts):
 * compare the COUNT against the room, admit what fits, hold the rest. The
 * total ceiling is checked before the active one, in the same order as
 * `capacityState` (closet-spec.ts) — an account at its total is fixed only by
 * deleting or upgrading, and offering "make room" there is the dead end the
 * two-ceiling design exists to remove.
 *
 * Never refuse on an unread count. A capacity that is still loading admits
 * the whole batch: the trigger stays the authority and the queue's own
 * stop-on-refusal (upload-queue.ts) catches what a stale count lets through.
 * Being wrong in that direction costs one refused insert; being wrong in the
 * other holds photographs that had room.
 *
 * Pure — no React, no store — so the regression that produced the 46 events
 * is a one-line test.
 */

export type BatchCapacity = {
  /** Active garments, as `useCapacity` reports them. */
  readonly used: number;
  /** The plan's active ceiling. */
  readonly limit: number;
  /** Every row the account holds, stored pieces included. */
  readonly stored: number;
  /** The plan's total ceiling. */
  readonly storedLimit: number;
  /** True while the counts are unread. */
  readonly loading: boolean;
  /**
   * Photographs already in the queue that have not yet become rows — they
   * are invisible to every server count and will take a slot each. Jobs that
   * already hold an `itemId` are NOT in this number: their row exists and the
   * count query will see it.
   */
  readonly pendingRows?: number;
};

export type BatchAdmission =
  /** Everything fits. */
  | { readonly kind: 'all'; readonly accept: number }
  /** Some fit; `hold` photographs wait behind the wall that bounded the room. */
  | {
      readonly kind: 'partial';
      readonly accept: number;
      readonly hold: number;
      readonly used: number;
      readonly limit: number;
      readonly wall: 'active' | 'total';
    }
  /** Nothing fits. `wall` says which ceiling, because they have different remedies. */
  | {
      readonly kind: 'none';
      readonly accept: 0;
      readonly hold: number;
      readonly used: number;
      readonly limit: number;
      readonly wall: 'active' | 'total';
    };

export function admitBatch(count: number, capacity: BatchCapacity): BatchAdmission {
  const requested = Math.max(0, Math.trunc(count));
  if (requested === 0 || capacity.loading) return { kind: 'all', accept: requested };

  const pending = Math.max(0, Math.trunc(capacity.pendingRows ?? 0));

  // Total first — the ceiling where storing a piece does not help.
  const totalRoom = capacity.storedLimit - capacity.stored - pending;
  if (totalRoom <= 0) {
    return {
      kind: 'none',
      accept: 0,
      hold: requested,
      used: capacity.stored,
      limit: capacity.storedLimit,
      wall: 'total',
    };
  }

  // `max(0, …)` because a grandfathered closet may already sit above its
  // ceiling (migration 20260808190000): the room is then zero, never negative.
  const activeRoom = Math.max(0, capacity.limit - capacity.used - pending);
  const room = Math.min(activeRoom, totalRoom);
  // Which ceiling is the binding one — the wall the remainder waits behind.
  // On an exact tie both ceilings bind, and storing a piece frees an active
  // slot without freeing a total one — so the honest remedy is the total's.
  const wall: 'active' | 'total' = totalRoom <= activeRoom ? 'total' : 'active';

  if (room <= 0) {
    return {
      kind: 'none',
      accept: 0,
      hold: requested,
      used: capacity.used,
      limit: capacity.limit,
      wall: 'active',
    };
  }
  if (requested <= room) return { kind: 'all', accept: requested };
  return {
    kind: 'partial',
    accept: room,
    hold: requested - room,
    used: wall === 'total' ? capacity.stored : capacity.used,
    limit: wall === 'total' ? capacity.storedLimit : capacity.limit,
    wall,
  };
}
