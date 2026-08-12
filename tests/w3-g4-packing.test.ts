/**
 * Wave 3 · Group 4 — the packing memo's bag.
 *
 * Atlas frames PK-02, PK-03, PK-04 (audit 81, 82, 83).
 *
 * PK-01 and PK-01/AX are NOT covered here and nothing in this file asserts
 * anything about a tier, a price, a period or a renewal sentence. They are
 * stopped by D-5: no StoreKit module is installed, `features/billing/plans.ts`
 * marks price null and says it is "filled from StoreKit once billing ships, not
 * hard-coded", and open Claim 9 — which tier gates packing — is unresolved. A
 * test that pinned any of those would be the guess the ledger forbids, written
 * down where it looks authoritative.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { packedPieceChip } from '../src/features/plan/packing-math';
import { restateTrip } from '../src/features/plan/trip';

// ---------------------------------------------------------------------------
// PK-03 — the count sits on the piece, and its unit is derived
// ---------------------------------------------------------------------------

test('the chip’s unit follows the parts of the day the piece is packed for', () => {
  // "The boots handle every evening" — six looks, all of them evenings.
  assert.equal(
    packedPieceChip({ parts: ['evening', 'evening', 'evening'], count: 6, worn: false }),
    '6 nights',
  );

  // "The linen blouse carries three of the six days" — nothing in the evening.
  assert.equal(
    packedPieceChip({ parts: ['daytime', 'daytime', 'travel'], count: 3, worn: false }),
    '3 days',
  );

  // Both. "Looks" is the memo's own word for a dressed moment and the only
  // unit that is true of a piece doing daytime AND evening duty — calling it
  // days or nights would be picking one and printing the other's count.
  assert.equal(
    packedPieceChip({ parts: ['daytime', 'evening'], count: 2, worn: false }),
    '2 looks',
  );
});

test('the departure shoe reads Worn, and never a count', () => {
  // It is on your feet on the plane, so it never enters the bag; a repeat
  // count would be describing space it does not take.
  assert.equal(packedPieceChip({ parts: ['travel'], count: 1, worn: true }), 'Worn');
  // Even when it also does other duty, "Worn" is the fact about the bag.
  assert.equal(packedPieceChip({ parts: ['travel', 'daytime'], count: 4, worn: true }), 'Worn');
});

test('a piece that does not repeat gets no chip at all', () => {
  // PK-03 names these in prose under the grid rather than padding it with a
  // chip that says "1".
  assert.equal(packedPieceChip({ parts: ['daytime'], count: 1, worn: false }), null);
  assert.equal(packedPieceChip({ parts: [], count: 0, worn: false }), null);
});

// ---------------------------------------------------------------------------
// PK-02 — the trip restated under the question
// ---------------------------------------------------------------------------

test('the restatement is answers already given, or nothing', () => {
  assert.equal(
    restateTrip({
      destination: { name: 'Lisbon' },
      startsOn: '2026-09-09',
      endsOn: '2026-09-15',
    }),
    'Lisbon, 9–15 Sep · 7 days.',
  );

  // Half-answered: the missing fragment is dropped, never filled with a
  // placeholder or a guessed length.
  assert.equal(restateTrip({ destination: { name: 'Lisbon' } }), 'Lisbon.');
  assert.equal(
    restateTrip({ startsOn: '2026-09-09', endsOn: '2026-09-15' }),
    '9–15 Sep · 7 days.',
  );

  // Nothing answered yet: no line at all, rather than an empty one.
  assert.equal(restateTrip({}), null);
  assert.equal(restateTrip({ destination: null, startsOn: null, endsOn: null }), null);
});
