/**
 * Audit 66 and audit 100, as assertions rather than as a reading.
 *
 * Both are copy items, and copy items are the ones a screenshot review misses:
 * a retired word survives in one fixture, or an absolute about shopping creeps
 * into a sentence six weeks later, and every frame still LOOKS right.
 *
 * Audit 66's acceptance line: "The voice door is Describe by voice; 'Talk it
 * in' appears nowhere in the group."
 *
 * Audit 100's: "no absolute about shopping appears anywhere in the group",
 * against the approved positioning line.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** The chooser and its fixture — the two places the doors are named. */
const DOOR_SURFACES = ['src/app/add-clothes.tsx', 'src/app/dev-add-clothes.tsx'];

/** Comments stripped: the history of a rename is worth writing down. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('audit 66 — the voice door is named "Describe by voice"', () => {
  for (const f of DOOR_SURFACES) {
    assert.match(code(f), /name="Describe by voice"/, `${f} does not draw the voice door`);
  }
});

test('audit 66 — "Talk it in" appears in no rendered string in the group', () => {
  const offenders = DOOR_SURFACES.filter((f) => /Talk it in/.test(code(f)));
  assert.deepEqual(offenders, [], `the retired name is still drawn in:\n${offenders.join('\n')}`);
});

test('audit 66 — the two Describe doors are named as one act in two media', () => {
  // The relationship IS the audit item. A pair named "Search for it" and
  // "Describe by voice" is not a pair, which is what this catches.
  for (const f of DOOR_SURFACES) {
    assert.match(code(f), /name="Describe it"/, `${f} does not draw the typed Describe door`);
  }
});

test('audit 100 — no absolute about shopping appears in the intake group', () => {
  // The positioning line is "Your closet first. Shop only when something is
  // genuinely missing." An absolute — "never shop", "stop shopping", "you don't
  // need to buy anything" — is a different and unsupportable claim, and the
  // sweep covers the surfaces this lane draws.
  const surfaces = [
    'src/app/add-clothes.tsx',
    'src/app/capture.tsx',
    'src/components/ingest/garment-search-sheet.tsx',
    'src/components/closet/item-card.tsx',
    'src/components/review/review-card.tsx',
  ];
  const ABSOLUTES = [/never shop/i, /stop shopping/i, /don['’]t (?:ever )?buy/i, /no need to buy/i];
  const offenders: string[] = [];
  for (const f of surfaces) {
    const src = code(f);
    if (ABSOLUTES.some((re) => re.test(src))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `an absolute about shopping appears in:\n${offenders.join('\n')}`);
});

test('DS-02 — no affiliate language on the intake path', () => {
  // "No 'Paid link' — nothing affiliate." Commerce lives in the Gap Feed
  // recommendation and an opted-in friend's piece; describing a piece you
  // already own is not commerce, and a Paid-link marker here would say it was.
  const src = code('src/components/ingest/garment-search-sheet.tsx');
  assert.ok(!/Paid link/i.test(src), 'affiliate marker on the Describe surface');
  assert.ok(!/affiliate/i.test(src), 'affiliate language on the Describe surface');
});

// ---------------------------------------------------------------------------
// AC-03 — the ceiling
// ---------------------------------------------------------------------------

test('AC-03 — no door is disabled at the ceiling', () => {
  // The frame was corrected on 2026-08-12 against this exact file, and the
  // correction inverted it: "all four doors stay available, in the same order
  // and at the same weight as AC-01, because capacity is decided after the
  // photograph or description exists, never before."
  //
  // The failure this guards is somebody re-reading the OLD frame and wiring
  // `capacity.full` to a door's `disabled`/`condition`, which would let a user
  // lose a photograph they had already taken to a door that refused to open.
  const src = code('src/app/add-clothes.tsx');
  const doorBlocks = src.match(/<DoorPlate[\s\S]*?\/>/g) ?? [];
  assert.ok(doorBlocks.length >= 4, 'the four doors are still drawn');
  for (const block of doorBlocks) {
    assert.ok(!/capacity\.full/.test(block), 'a door is gated on capacity');
    assert.ok(!/disabled/.test(block), 'a door is disabled');
    assert.ok(!/Opens once there is room/.test(block), 'a door carries the superseded copy');
  }
});

test('AC-03 — the recovery is free: no tier, no price, no paywall on the chooser', () => {
  // "No tier name, price or upgrade action appears; membership is reached from
  // Profile, which keeps this frame free of a second, competing decision."
  const src = code('src/app/add-clothes.tsx');
  for (const forbidden of [
    /\bStandard\b/,
    /\bPro\b/,
    /\$\d/,
    /See plans/i,
    /upgrade/i,
    /useGate/,
    /Placement\./,
  ]) {
    assert.ok(!forbidden.test(src), `AC-03 must not name ${forbidden}`);
  }
  assert.match(src, /See stored/, 'the free recovery is the affordance offered');
});

test('AC-03 — the repository word is "active", never "awake"', () => {
  // Vocabulary follows the repository, per the corrected frame. Two names for
  // one count across two screens is how a number stops being believed.
  const src = code('src/app/add-clothes.tsx');
  assert.match(src, /active pieces filed/);
  assert.match(src, /The active shelf is full/);
  assert.ok(!/awake/i.test(src), '"awake" is the atlas\'s word, not this app\'s');
});
