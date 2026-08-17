/**
 * OS-08's matcher — what the reader's own closet can supply, and what it cannot.
 *
 * The failure this exists to prevent is not a mediocre suggestion. A wrong match
 * puts a garment into somebody's plan for Thursday under the words "Matched from
 * your closet", which is a claim — so the rules are deliberately dumb, and these
 * assertions are about the properties that make the mistakes visible and
 * undoable rather than about how clever the pairing is.
 *
 * The three that carry real weight:
 *
 *   · **One closet item answers at most one wanted piece.** A look with two
 *     knits and a closet with one must report one match and one miss, never the
 *     same jumper twice — a plan cannot hold a garment in two places, and
 *     `plan_outfit_tx` would reject the duplicate anyway.
 *   · **Category is a hard gate.** No amount of shared colour or shared naming
 *     promotes a pair of shoes into a top.
 *   · **The answer is stable.** Greedy in wanted order, so re-running over the
 *     same inputs pairs the same things, and a piece further down the list
 *     cannot move a match the reader has already looked at.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canCreatePlan,
  canSkip,
  matchClosetToLook,
  planItemIds,
  type ClosetPiece,
  type WantedPiece,
} from '../src/features/saved-looks/plan-match.ts';

function want(over: Partial<WantedPiece> & { id: string; category: string }): WantedPiece {
  return { name: null, colours: [], optional: false, ...over };
}

function own(over: Partial<ClosetPiece> & { id: string; category: string }): ClosetPiece {
  return { name: null, colours: [], ...over };
}

// ---------------------------------------------------------------------------
// 1 · Category is a hard gate
// ---------------------------------------------------------------------------

test('a piece of the wrong category never matches, whatever else it shares', () => {
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top', name: 'Cream ribbed knit', colours: ['cream'] })],
    [own({ id: 'c1', category: 'shoes', name: 'Cream ribbed boots', colours: ['cream'] })],
  );
  assert.equal(match.matched.length, 0);
  assert.equal(match.missing.length, 1);
  assert.equal(match.missing[0]!.wanted.id, 'w1');
});

test('a category match with nothing else in common is still a match', () => {
  // "You have a pair of shoes" is a true and useful thing to say about a look
  // that wants shoes, and the missing-piece machinery is what the design offers
  // instead of pretending to confidence.
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'shoes' })],
    [own({ id: 'c1', category: 'shoes' })],
  );
  assert.equal(match.matched.length, 1);
  assert.equal(match.matched[0]!.closetItemId, 'c1');
});

// ---------------------------------------------------------------------------
// 2 · The ladder, and the tie-break
// ---------------------------------------------------------------------------

test('colour outranks a bare category match', () => {
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top', colours: ['cream'] })],
    [own({ id: 'plain', category: 'top' }), own({ id: 'cream', category: 'top', colours: ['Cream'] })],
  );
  assert.equal(match.matched[0]!.closetItemId, 'cream');
});

test('colour comparison is case- and whitespace-insensitive, and name-based', () => {
  // `items.colors` carries an optional hex and a required NAME, and the hex is
  // absent on every freshly tagged row — matching on hex would silently never
  // fire for a real closet while looking fine in a fixture.
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top', colours: ['  RUST '] })],
    [own({ id: 'c1', category: 'top', colours: ['rust'] })],
  );
  assert.equal(match.matched.length, 1);
});

test('a shared word breaks a tie between two same-colour candidates', () => {
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top', name: 'Cream ribbed knit', colours: ['cream'] })],
    [
      own({ id: 'other', category: 'top', colours: ['cream'], name: 'Cream silk blouse' }),
      own({ id: 'knit', category: 'top', colours: ['cream'], name: 'Ribbed knit jumper' }),
    ],
  );
  assert.equal(match.matched[0]!.closetItemId, 'knit');
});

test('noise words and short tokens never break a tie on their own', () => {
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top', name: 'The knit' })],
    [own({ id: 'first', category: 'top' }), own({ id: 'the', category: 'top', name: 'The blouse' })],
  );
  // "The" is noise, so `the` scores no higher than `first`, and the closet's own
  // order — newest first — decides.
  assert.equal(match.matched[0]!.closetItemId, 'first');
});

test('equal scores break on the closet’s own order, which is newest first', () => {
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top' })],
    [own({ id: 'newest', category: 'top' }), own({ id: 'older', category: 'top' })],
  );
  assert.equal(match.matched[0]!.closetItemId, 'newest');
});

// ---------------------------------------------------------------------------
// 3 · One item answers one piece
// ---------------------------------------------------------------------------

test('one closet item cannot fill two slots', () => {
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top' }), want({ id: 'w2', category: 'top' })],
    [own({ id: 'only', category: 'top' })],
  );
  assert.equal(match.matched.length, 1);
  assert.equal(match.missing.length, 1);
  assert.equal(match.matched[0]!.wanted.id, 'w1');
  assert.equal(match.missing[0]!.wanted.id, 'w2');
});

test('the item ids handed to a plan are unique, which plan_outfit_tx requires', () => {
  const match = matchClosetToLook(
    [want({ id: 'w1', category: 'top' }), want({ id: 'w2', category: 'top' })],
    [own({ id: 'a', category: 'top' }), own({ id: 'b', category: 'top' })],
  );
  const ids = planItemIds(match);
  assert.deepEqual(ids, ['a', 'b']);
  assert.equal(new Set(ids).size, ids.length);
});

// ---------------------------------------------------------------------------
// 4 · Stability
// ---------------------------------------------------------------------------

test('the same inputs pair the same things, every time', () => {
  const wanted = [
    want({ id: 'w1', category: 'top', colours: ['cream'] }),
    want({ id: 'w2', category: 'bottom', colours: ['rust'] }),
  ];
  const closet = [
    own({ id: 'c1', category: 'top', colours: ['cream'] }),
    own({ id: 'c2', category: 'bottom', colours: ['rust'] }),
  ];
  assert.deepEqual(matchClosetToLook(wanted, closet), matchClosetToLook(wanted, closet));
});

test('a piece further down the list cannot move a match already made', () => {
  const closet = [own({ id: 'shared', category: 'top', colours: ['cream'] })];
  const first = matchClosetToLook([want({ id: 'w1', category: 'top' })], closet);
  const withMore = matchClosetToLook(
    [want({ id: 'w1', category: 'top' }), want({ id: 'w2', category: 'top', colours: ['cream'] })],
    closet,
  );
  // `w2` is the better fit for `shared` on affinity, and it still does not take
  // it: greedy in wanted order is what keeps the first row from moving under
  // somebody who has already scrolled past it.
  assert.equal(first.matched[0]!.closetItemId, 'shared');
  assert.equal(withMore.matched[0]!.wanted.id, 'w1');
  assert.equal(withMore.missing[0]!.wanted.id, 'w2');
});

// ---------------------------------------------------------------------------
// 5 · What the screen is allowed to offer
// ---------------------------------------------------------------------------

test('a plan needs at least one matched piece — plan_outfit_tx refuses zero anyway', () => {
  const nothing = matchClosetToLook([want({ id: 'w1', category: 'top' })], []);
  assert.equal(canCreatePlan(nothing), false);
  assert.deepEqual(planItemIds(nothing), []);
});

test('a partly-matched look CAN be planned — that is the ordinary case', () => {
  const partial = matchClosetToLook(
    [want({ id: 'w1', category: 'top' }), want({ id: 'w2', category: 'bottom' })],
    [own({ id: 'c1', category: 'top' })],
  );
  assert.equal(canCreatePlan(partial), true);
  assert.equal(partial.missing.length, 1);
});

test('only an optional missing piece may be skipped', () => {
  const match = matchClosetToLook(
    [
      want({ id: 'w1', category: 'bottom' }),
      want({ id: 'w2', category: 'accessory', optional: true }),
    ],
    [],
  );
  assert.equal(canSkip(match.missing[0]!), false);
  assert.equal(canSkip(match.missing[1]!), true);
});

test('an empty look and an empty closet are both answers, not crashes', () => {
  assert.deepEqual(matchClosetToLook([], []), { matched: [], missing: [] });
  assert.equal(matchClosetToLook([], [own({ id: 'c1', category: 'top' })]).matched.length, 0);
});
