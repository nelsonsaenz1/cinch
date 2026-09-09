/**
 * Today's floor at the free ceiling — A59 (2026-09-08).
 *
 * Two real closets reached ten through the import door and could not be
 * dressed: `a874512d` (ten bottoms) and `bae15db5` (ten tops). The floor they
 * met printed "Ten pieces in. Zero more pieces to go." and its one action,
 * "Add a top", opened the add door — which at ten is `add_garment_over_limit`,
 * a paywall. These pin the sentence and the label that replaced both.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import {
  floorPrimaryLabel,
  floorProgressLine,
  missingPhrase,
} from '../src/components/today/closet-floor-copy';
import { missingForFirstOutfit, tallyOf } from '../src/features/closet/outfit-count';

const FIRST = 'Photograph your first piece';

test('under ten, the floor counts and names the missing half', () => {
  const line = floorProgressLine(3, 7, 'a top');
  assert.equal(line, 'Three pieces in. Seven more pieces to go. A top is what turns this into outfits.');
  assert.equal(floorProgressLine(9, 1, null), 'Nine pieces in. One more piece to go.');
  assert.equal(floorPrimaryLabel(false, false, 'a top', FIRST), 'Add a top');
  assert.equal(floorPrimaryLabel(false, false, null, FIRST), 'Add more pieces');
  assert.equal(floorPrimaryLabel(true, false, null, FIRST), FIRST);
});

test('ten bottoms: the count is met, the shape is named, nothing counts to nought', () => {
  const tally = tallyOf(Array.from({ length: 10 }, () => ({ slot: 'bottom' as const })));
  const missing = missingPhrase(missingForFirstOutfit(tally));
  assert.equal(missing, 'a top');
  const line = floorProgressLine(10, 0, missing);
  assert.equal(
    line,
    'Ten pieces in — but an outfit needs a top with a bottom, or a dress. A top is what turns this into outfits.',
  );
  assert.doesNotMatch(line, /zero|nought|0 /i);
  assert.doesNotMatch(line, /\d/, 'no digit on the floor');
  // At the ceiling the action is a swap, because the add door is a paywall.
  assert.equal(floorPrimaryLabel(false, true, missing, FIRST), 'Swap a piece for a top');
});

test('ten tops: the missing half is the bottom', () => {
  const tally = tallyOf(Array.from({ length: 10 }, () => ({ slot: 'base_top' as const })));
  const missing = missingPhrase(missingForFirstOutfit(tally));
  assert.equal(missing, 'a bottom');
  assert.match(floorProgressLine(10, 0, missing), /^Ten pieces in — but an outfit needs/);
  assert.equal(floorPrimaryLabel(false, true, missing, FIRST), 'Swap a piece for a bottom');
});

test('the swap door is The Ten’s repair plate, not the add door', () => {
  // Today owns the destination; the floor owns the label. Both must agree
  // that a full, undressable closet does not meet a paywall.
  const route = readFileSync('src/app/(tabs)/index.tsx', 'utf8');
  assert.match(route, /undressable \? '\/the-ten\?door=photograph' : '\/add-clothes'/);
  assert.match(route, /const full = items\.length >= PLANS\.free\.items/);
  const floor = readFileSync('src/components/today/closet-floor.tsx', 'utf8');
  assert.match(floor, /const atCeiling = items\.length >= PLANS\.free\.items/);
  assert.match(floor, /floorPrimaryLabel\(empty, atCeiling, missing, TODAY_COPY\.floorAction\)/);
  assert.equal(PLANS.free.items, 10);
});
