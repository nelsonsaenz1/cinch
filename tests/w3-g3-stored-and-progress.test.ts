/**
 * Two refusals that only exist in the code, and would survive any screenshot.
 *
 * ── C-07: the storing date is omitted, never substituted ──────────────────
 *
 * The frame's metadata line is `Stored in March · worn 7 times`. There is no
 * storing date in the database — `items` records when a garment was FILED
 * (`created_at`) and whether it is archived, never when it was archived. The
 * constitution's refusal covers exactly this: figures are "printed when known or
 * omitted — never estimated, never a dash". A `created_at` printed under the
 * storing date's name is the substitution that refusal is about, and it would
 * look completely correct on a capture.
 *
 * ── RV-03 and CP-03: progress is a count, never a bar ─────────────────────
 *
 * A segmented pip row used to sit beside the review deck's ordinal. It is the
 * same refusal `ProgressTrack` fell to on the capture screen, and RV-01's
 * annotation restates it: "Progress reads 2 of 3 to review, a count with its
 * denominator, never a bar." The derivations went with the row rather than being
 * kept "just in case", because a derived value nobody renders is how a refused
 * treatment finds its way back onto a screen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { storedMetaLine } from '../src/features/closet/piece-meta';

/** Comments stripped: a file EXPLAINING a refusal must not read as breaking it. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

// ── C-07 ──────────────────────────────────────────────────────────────────

test('the stored line prints the half that is known, and only that', () => {
  assert.equal(storedMetaLine({ wearCount: 7 }), 'Worn 7 times');
  assert.equal(storedMetaLine({ wearCount: 3 }), 'Worn 3 times');
  assert.equal(storedMetaLine({ wearCount: 1 }), 'Worn 1 time');
});

test('NEVER WORN IS WORDS — a 0 in this line would read as a score', () => {
  assert.equal(storedMetaLine({ wearCount: 0 }), 'Never worn');
  assert.ok(!/0/.test(storedMetaLine({ wearCount: 0 })));
});

test('the storing date is absent, not faked — no month, no dash, no placeholder', () => {
  for (const wearCount of [0, 1, 7, 58]) {
    const line = storedMetaLine({ wearCount });
    assert.ok(!/Stored in/.test(line), `a storing date was invented: ${line}`);
    assert.ok(!line.includes('—'), `an em dash stood in for the missing date: ${line}`);
    assert.ok(!line.includes('·'), `an empty clause was left joined on: ${line}`);
  }
});

test('C-07 never mentions cost per wear — the frame swaps it out', () => {
  for (const wearCount of [0, 7]) {
    assert.ok(!/a wear/.test(storedMetaLine({ wearCount })));
  }
});

test('the stored screen names no tier and no price', () => {
  // "No price or upgrade is mentioned on this frame; the ceiling is stated and
  // the paywall is reached from the membership row in Profile."
  const src = code('src/app/storage.tsx');
  // `$` alone is every template literal in the file, so the pattern is a
  // currency FIGURE — a dollar sign against a digit or an interpolation.
  for (const forbidden of [/\$\d/, /\bupgrade\b/i, /\bStandard\b/, /\bPro\b/, /paywall/i]) {
    assert.ok(!forbidden.test(src), `storage.tsx names a tier or a price: ${forbidden}`);
  }
});

test('the stored screen draws no delete — the frame has one control', () => {
  const src = code('src/app/storage.tsx');
  assert.ok(!/delete/i.test(src), 'a delete control survived on the stored-pieces screen');
});

// ── RV-03 / RV-01 ─────────────────────────────────────────────────────────

/** Both surfaces: the deck and the fixture that has to mirror it. */
const DECKS = ['src/app/review.tsx', 'src/app/dev-review.tsx'];

test('the review deck prints its progress as a count with its denominator', () => {
  for (const f of DECKS) {
    assert.match(
      code(f),
      /Review · \$\{[^}]+\} of \$\{[^}]+\} to review/,
      `${f} no longer prints RV-01's count`,
    );
  }
});

test('THE PIP BAR IS GONE, and so are the values that fed it', () => {
  for (const f of DECKS) {
    const src = code(f);
    assert.ok(!/PIP_LIMIT/.test(src), `${f} still holds the pip cap`);
    assert.ok(!/activePip|pipCount/.test(src), `${f} still derives a pip position`);
    // The shape itself: a row of `h-1` pills in ink and sand.
    assert.ok(!/bg-sand/.test(src), `${f} still draws the pip track`);
  }
});

test('RV-03’s failed save is a notice on the card, never an alert', () => {
  const card = code('src/components/review/review-card.tsx');
  assert.match(card, /That correction has not saved yet/, 'the notice heading is gone');
  assert.match(card, /held on this phone/, 'the notice no longer says the change is kept');
  assert.match(card, /Send it now/, 'the immediate retry is gone');

  // And the banner it replaced is not still sitting above the deck.
  const deck = code('src/app/review.tsx');
  assert.ok(
    !/bg-warning\/15/.test(deck),
    'the warning banner above the deck survived the move onto the card',
  );
});

test('the empty closet carries the approved positioning line verbatim', () => {
  // Audit 100 sweeps C-05 by name. The line is a constant so the surface and the
  // fixture cannot drift; this asserts the constant's own wording.
  const src = readFileSync('src/components/closet/empty-closet.tsx', 'utf8');
  assert.match(
    src,
    /'Your closet first\. Shop only when something is genuinely missing\.'/,
    'the approved positioning line has been reworded',
  );
});

test('C-05 draws no example grid — the frame refuses an illustrated one', () => {
  for (const f of ['src/app/(tabs)/closet.tsx', 'src/app/dev-empty-closet.tsx']) {
    assert.ok(
      !/ExampleCloset/.test(code(f)),
      `${f} still draws the illustrated example closet C-05 refuses`,
    );
  }
});
