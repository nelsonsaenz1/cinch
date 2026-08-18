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

import {
  SHELF_FULL_TITLE,
  capacityColophon,
} from '../src/features/ingest/add-clothes-spec';
import {
  CATALOGUE_ROUTE_NAME,
  INTAKE_ROUTES,
} from '../src/features/ingest/intake-routes';

/** The chooser and its fixture — the two places the doors are named. */
const DOOR_SURFACES = ['src/app/add-clothes.tsx', 'src/dev-fixtures/dev-add-clothes.tsx'];

/** Comments stripped: the history of a rename is worth writing down. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('AC-C1 — every surface draws the four routes from the one table', () => {
  // SUPERSEDES the old form of this test, which matched `name="Describe by
  // voice"` as a literal in each file. That was the right assertion for a
  // screen that retyped its own copy, and it is the wrong one now: the doors
  // are read from `INTAKE_ROUTES`, which is what stopped The Ten from drifting
  // to two doors while Add clothes had four. Matching literals again would
  // require the drift back.
  for (const f of DOOR_SURFACES) {
    assert.match(code(f), /INTAKE_ROUTES/, `${f} does not read the shared route table`);
    assert.doesNotMatch(code(f), /name="(Camera|Photo library|Describe)/, `${f} retypes a door name`);
  }
  // CX-01 supersedes AC-C1's order. The catalogue leads, because the fastest
  // route to ten pieces is the one a beginner should meet first; the rule that
  // survives is that ONE order serves every surface.
  assert.deepEqual(
    INTAKE_ROUTES.map((r) => r.key),
    ['catalogue', 'camera', 'library', 'voice'],
  );
  assert.equal(INTAKE_ROUTES.find((r) => r.key === 'voice')?.name, 'Describe by voice');
});

test('audit 66 — "Talk it in" appears in no rendered string in the group', () => {
  const offenders = DOOR_SURFACES.filter((f) => /Talk it in/.test(code(f)));
  assert.deepEqual(offenders, [], `the retired name is still drawn in:\n${offenders.join('\n')}`);
});

test('AC-C1 supersedes audit 66 — the catalogue route is named for what it fetches', () => {
  // Audit 66 paired the typed and spoken doors as "one act in two media" and
  // required both to be called Describe. AC-C1 reverses it, and the reasoning
  // is on `INTAKE_ROUTES`: they are not one act. Voice files the reader's own
  // words; this one queries a licensed product feed and returns a shop's
  // photograph. It is the only route of the four that reaches a third party,
  // which is why it is named for that and why the disclosure travels with it.
  assert.equal(CATALOGUE_ROUTE_NAME, 'Find a product photo');
  assert.equal(INTAKE_ROUTES.find((r) => r.key === 'catalogue')?.name, CATALOGUE_ROUTE_NAME);
  // The retired names are gone from every surface, fixtures included — a
  // fixture posing a retired name gets screenshotted as evidence it shipped.
  for (const f of DOOR_SURFACES) {
    assert.doesNotMatch(code(f), /Describe it|Search for it|Talk it in/, `${f} draws a retired name`);
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
  //
  // READ FROM THE SPEC, NOT FROM THE SCREEN. Redesign 23 moved this page's
  // sentences into `features/ingest/add-clothes-spec.ts` — the same split every
  // redesigned page in this wave makes, and the reason `ten-copy.ts` exists —
  // so a literal-match against `add-clothes.tsx` now checks the wrong file and
  // would pass vacuously the day somebody renamed the constant. The assertion
  // that survives is about the WORDS, wherever they are, plus the fact that the
  // screen still renders them.
  //
  // The colophon's wording changed with the frame: "12 of 30 active pieces
  // filed." became "12 OF 30 ACTIVE PIECES", set as a tracked colophon rather
  // than a sentence. "Active" is what is being pinned and "active" is still
  // there; "filed" was never the contested word.
  assert.match(capacityColophon(12, 30), /^12 of 30 active pieces$/);
  assert.equal(SHELF_FULL_TITLE, 'The active shelf is full');

  const src = code('src/app/add-clothes.tsx');
  assert.match(src, /capacityColophon\(capacity\.used, capacity\.limit\)/);
  assert.match(src, /\{SHELF_FULL_TITLE\}/);

  // Comments stripped on both, as ever: the history of the correction is worth
  // writing down, and both files write it down.
  const spec = code('src/features/ingest/add-clothes-spec.ts');
  for (const [where, text] of [
    ['the screen', src],
    ['the spec', spec],
  ] as const) {
    assert.ok(!/awake/i.test(text), `"awake" is the atlas's word, not this app's — in ${where}`);
  }
});
