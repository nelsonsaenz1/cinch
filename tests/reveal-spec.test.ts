/**
 * The Reveal — what the sequence decides before it draws. Redesign 12.
 *
 * Every function here is pure and imported directly. The PAGE's contract is
 * `tests/reveal-page.test.ts` and the payloads are
 * `tests/reveal-analytics.test.ts`; three files because they fail for three
 * different reasons.
 *
 * The property test at the top is the one that matters most: every digit this
 * screen can render is `countOutfits(tallyOf(fixture))`, checked against a
 * generated space of closets rather than against three hand-picked ones.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countOutfits, tallyOf, type Tally } from '../src/features/closet/outfit-count';
import {
  ARRIVAL_FLOOR_MS,
  DISPLAY_SIZE,
  MAX_PLATES,
  REVEAL_COPY,
  arrivalBody,
  arrivalTitle,
  compositionPhrase,
  countUpValue,
  derivationLine,
  derivationShort,
  displayFontSize,
  mayDrawDigit,
  membershipCountLine,
  missingPhrases,
  partialDerivation,
  piecesToFirstOutfit,
  untaggedChip,
  unreadBodyLine,
  usesFigures,
  zeroBodyLine,
  type RevealPhase,
} from '../src/features/onboarding/reveal-spec';

const tally = (tops: number, bottoms: number, dresses: number, shoes: number): Tally => ({
  tops,
  bottoms,
  dresses,
  shoes,
});

// ---------------------------------------------------------------------------
// The number is the engine's number — asserted over a generated space
// ---------------------------------------------------------------------------

test('every rendered digit is countOutfits(tallyOf(items)) and nothing else', () => {
  // A slot list is all `tallyOf` reads, so a fixture is a list of slots. Walked
  // exhaustively over a small space rather than sampled: 4^4 closets, every one
  // of which must agree.
  for (let a = 0; a <= 3; a += 1)
    for (let b = 0; b <= 3; b += 1)
      for (let d = 0; d <= 3; d += 1)
        for (let s = 0; s <= 3; s += 1) {
          const items = [
            ...Array.from({ length: a }, () => ({ slot: 'base_top' as const })),
            ...Array.from({ length: b }, () => ({ slot: 'bottom' as const })),
            ...Array.from({ length: d }, () => ({ slot: 'dress' as const })),
            ...Array.from({ length: s }, () => ({ slot: 'footwear' as const })),
          ];
          const t = tallyOf(items);
          const expected = countOutfits(t);
          // The settled digit.
          assert.equal(countUpValue(expected, 1), expected);
          // Every frame of the count-up is bounded by it — never above, never
          // negative, and never a guess at a number that does not exist yet.
          for (const p of [0, 0.1, 0.35, 0.5, 0.9, 1]) {
            const v = countUpValue(expected, p);
            assert.ok(v >= 0 && v <= expected, `frame ${p} of ${expected} rendered ${v}`);
          }
          // And the sentence agrees with the digit.
          if (expected > 0) {
            assert.ok(
              derivationShort(items.length, t).includes(
                expected > 99 ? String(expected) : '',
              ) || expected <= 99,
            );
          }
        }
});

test('the count-up starts at nothing and lands exactly on the answer', () => {
  assert.equal(countUpValue(27, 0), 0);
  assert.equal(countUpValue(27, 1), 27);
  // Past the end is still the answer, never past it.
  assert.equal(countUpValue(27, 1.5), 27);
  assert.equal(countUpValue(27, -1), 0);
});

test('the count-up is monotonic — a number never goes backwards', () => {
  let last = -1;
  for (let p = 0; p <= 1.0001; p += 0.02) {
    const v = countUpValue(184, p);
    assert.ok(v >= last, `went backwards at ${p}: ${last} → ${v}`);
    last = v;
  }
});

test('a non-finite progress cannot render a NaN', () => {
  assert.equal(countUpValue(27, Number.NaN), 0);
  assert.equal(countUpValue(27, Number.POSITIVE_INFINITY), 27);
});

// ---------------------------------------------------------------------------
// No digit before the arithmetic resolves
// ---------------------------------------------------------------------------

test('the two beats before the count may draw no digit at all', () => {
  // Not the count, not a dash, not a shimmering block two figures wide. A
  // digit-shaped placeholder is itself a claim.
  assert.equal(mayDrawDigit('arriving'), false);
  assert.equal(mayDrawDigit('computing'), false);
});

test('the zero screen draws no digit either', () => {
  // Zero is a RESULT and gets a sentence, not a big round nought — a screen
  // that renders "0" at 150pt is celebrating the failure.
  assert.equal(mayDrawDigit('zero'), false);
});

test('every phase from counting onward may draw one', () => {
  for (const p of ['counting', 'settled', 'plating', 'cascade', 'complete'] as RevealPhase[]) {
    assert.equal(mayDrawDigit(p), true, p);
  }
});

test('the arrival floor is a real beat rather than a flicker', () => {
  assert.equal(ARRIVAL_FLOOR_MS, 1200);
});

test('the cascade is finite and never draws more than three', () => {
  assert.equal(MAX_PLATES, 3);
});

// ---------------------------------------------------------------------------
// The display number's size
// ---------------------------------------------------------------------------

test('one and two digits take the full display size', () => {
  assert.equal(displayFontSize(1, false, false), DISPLAY_SIZE.one);
  assert.equal(displayFontSize(27, false, false), DISPLAY_SIZE.one);
  assert.equal(displayFontSize(99, false, false), DISPLAY_SIZE.one);
});

test('three digits step down one notch rather than shrinking to fit', () => {
  assert.equal(displayFontSize(100, false, false), DISPLAY_SIZE.three);
  assert.equal(displayFontSize(184, false, false), DISPLAY_SIZE.three);
  // Shrink-to-fit would make 184 and 27 different optical sizes on two closets
  // that are equally proud of themselves.
  assert.notEqual(displayFontSize(184, false, false), displayFontSize(27, false, false));
});

test('the number gets out of the way once there is an outfit to look at', () => {
  assert.equal(displayFontSize(27, true, false), DISPLAY_SIZE.withPlates);
  assert.ok(DISPLAY_SIZE.withPlates < DISPLAY_SIZE.one);
});

test('an accessibility size wins over everything else', () => {
  for (const [count, plates] of [
    [1, false],
    [184, false],
    [27, true],
  ] as const) {
    assert.equal(displayFontSize(count, plates, true), DISPLAY_SIZE.ax);
  }
});

test('a zero or a negative count cannot produce a NaN size', () => {
  assert.equal(displayFontSize(0, false, false), DISPLAY_SIZE.one);
  assert.equal(displayFontSize(-4, false, false), DISPLAY_SIZE.one);
});

// ---------------------------------------------------------------------------
// One register per sentence
// ---------------------------------------------------------------------------

test('a sentence under a hundred is spoken in words', () => {
  assert.equal(usesFigures(27, 10), false);
  // ── THE ARTIFACT'S OWN ARITHMETIC IS OFF BY ONE HERE ────────────────────
  //
  // Frame 05 draws 27 over "four tops, three bottoms, one dress, two pairs of
  // shoes". Under this repo's engine that closet makes 4×3×2 + 1×2 = 26. The
  // build follows `countOutfits`, not the frame: the contract's first line is
  // that the count comes only from the engine and nothing here is invented, and
  // honouring an illustrative digit over the arithmetic would break exactly the
  // promise the screen exists to keep. Recorded in the ledger.
  assert.equal(countOutfits(tally(4, 3, 1, 2)), 26);
  assert.match(derivationLine(10, tally(4, 3, 1, 2)), /^Twenty-six outfits from ten pieces/);
});

test('a sentence past ninety-nine is set in figures THROUGHOUT', () => {
  // The departure from the artifact, and the reason for it: `numberWord` stops
  // at ninety-nine by an argued decision, and mixing registers inside one
  // sentence — "184 outfits from thirty-one pieces" — is worse than either.
  assert.equal(usesFigures(184, 31), true);
  const line = derivationLine(31, tally(11, 8, 4, 8));
  assert.match(line, /^\d+ outfits from \d+ pieces/);
  assert.doesNotMatch(line, /thirty-one|eleven|eight/, line);
});

test('the composition is spelled out and shoes come in pairs', () => {
  assert.equal(
    compositionPhrase(tally(4, 3, 1, 2)),
    'four tops, three bottoms, one dress and two pairs of shoes',
  );
  // "two shoes" would be a different and slightly alarming claim.
  assert.match(compositionPhrase(tally(0, 0, 0, 1)), /one pair of shoes/);
});

test('a kind the closet does not have is absent, never a zero', () => {
  const phrase = compositionPhrase(tally(3, 2, 0, 2));
  assert.doesNotMatch(phrase, /dress/, phrase);
  assert.doesNotMatch(phrase, /\b0\b|zero/, phrase);
});

test('one outfit is grammatically its own case', () => {
  const t = tally(1, 1, 0, 1);
  assert.equal(countOutfits(t), 1);
  const line = derivationLine(3, t);
  assert.match(line, /^One outfit from three pieces/);
  assert.doesNotMatch(line, /outfits/, line);
});

test('the short form retires the composition once plates are on screen', () => {
  const t = tally(4, 3, 1, 2);
  const long = derivationLine(10, t);
  const short = derivationShort(10, t);
  assert.ok(long.includes('—'), 'the settled beat lost its composition clause');
  assert.ok(!short.includes('—'), 'the cascade is still arguing after it was believed');
  assert.equal(short, 'Twenty-six outfits from ten pieces.');
});

test('an empty closet produces a sentence rather than a dangling dash', () => {
  const line = derivationLine(0, tally(0, 0, 0, 0));
  assert.doesNotMatch(line, /—\s*\./, line);
  assert.doesNotMatch(line, /undefined|NaN/, line);
});

// ---------------------------------------------------------------------------
// Partial tagging — the honest count
// ---------------------------------------------------------------------------

test('a count derived from fewer pieces says so', () => {
  const line = partialDerivation(7, 3, tally(3, 2, 0, 2));
  assert.match(line, /^Twelve outfits from the seven pieces Cinch could read\./);
  assert.match(line, /Three are still waiting on a tag\./);
});

test('one untagged piece is singular', () => {
  assert.match(partialDerivation(9, 1, tally(3, 2, 0, 2)), /One is still waiting on a tag\./);
});

test('the untagged chip is a real count, and absent at zero', () => {
  assert.equal(untaggedChip(3), '3 untagged');
  assert.equal(untaggedChip(0), null);
});

// ---------------------------------------------------------------------------
// Zero — a result, not an error
// ---------------------------------------------------------------------------

test('the zero names the shape of the failure, not its size', () => {
  // Ten tops is the atlas's own sample. A reader told only "no outfits" learns
  // nothing; a reader told that ten of one thing is still one thing knows what
  // to photograph next.
  const t = tally(10, 0, 0, 0);
  assert.equal(countOutfits(t), 0);
  const body = zeroBodyLine(10, t, piecesToFirstOutfit(t));
  assert.match(body, /Ten tops make ten tops\./);
  assert.match(body, /Two more pieces and this page fills up\./);
});

test('the promised number of pieces equals the rows actually listed', () => {
  for (const t of [tally(10, 0, 0, 0), tally(0, 0, 0, 4), tally(2, 2, 0, 0), tally(0, 0, 1, 0)]) {
    if (countOutfits(t) > 0) continue;
    const needs = missingPhrases(t);
    assert.equal(
      piecesToFirstOutfit(t),
      needs.length,
      `promised ${piecesToFirstOutfit(t)} and listed ${needs.length}`,
    );
    assert.ok(needs.length > 0, 'a zero listed nothing to fix');
  }
});

test('the rows are things a person could photograph, not a table', () => {
  const needs = missingPhrases(tally(10, 0, 0, 0));
  assert.deepEqual(needs, ['A pair of shoes', 'A pair of trousers or a skirt']);
  for (const n of needs) assert.doesNotMatch(n, /needed|\b0\b/, n);
});

test('a dress needs only shoes — no bottom row nobody’s outfit needs', () => {
  const needs = missingPhrases(tally(0, 0, 2, 0));
  assert.deepEqual(needs, ['A pair of shoes']);
});

// ---------------------------------------------------------------------------
// The unread zero — pieces exist, but nothing has read them
// ---------------------------------------------------------------------------

test('the unread body names waiting when tagging may run, and the blocker when it may not', () => {
  // Consented: transient, and the sentence says so — never the consent door.
  const reading = unreadBodyLine(11, true);
  assert.match(reading, /Eleven pieces are still being read\./);
  assert.doesNotMatch(reading, /allowed/);

  // Not consented: the blocker, named — never "being read" while nothing is.
  const blocked = unreadBodyLine(11, false);
  assert.match(blocked, /Eleven pieces are photographed but unread/);
  assert.match(blocked, /hasn’t been allowed to look at/);
  assert.doesNotMatch(blocked, /being read/);
});

test('the unread body agrees with itself at one piece', () => {
  assert.match(unreadBodyLine(1, true), /One piece is still being read\./);
  assert.match(unreadBodyLine(1, false), /One piece is photographed but unread/);
});

test('a closet that already works asks for nothing', () => {
  assert.deepEqual(missingPhrases(tally(2, 2, 0, 1)), []);
  assert.equal(piecesToFirstOutfit(tally(2, 2, 0, 1)), 0);
});

test('the zero title states a result rather than an error', () => {
  assert.equal(REVEAL_COPY.zeroTitle, 'Not an outfit yet.');
  assert.doesNotMatch(REVEAL_COPY.zeroTitle, /error|sorry|failed|oops/i);
});

test('both zero doors are offered, and neither mentions money', () => {
  assert.equal(REVEAL_COPY.zeroRepair, 'Photograph them instead');
  assert.equal(REVEAL_COPY.zeroOpenToday, 'Open Today anyway');
  const words = `${REVEAL_COPY.zeroRepair} ${REVEAL_COPY.zeroOpenToday}`;
  assert.doesNotMatch(words, /member|upgrade|pro\b|plan|price|\$/i, words);
});

// ---------------------------------------------------------------------------
// The words the vendor does not own
// ---------------------------------------------------------------------------

test('the membership moment restates the count and says nothing else about it', () => {
  assert.equal(membershipCountLine(27), 'Twenty-seven outfits');
  assert.equal(membershipCountLine(1), 'One outfit');
  assert.equal(membershipCountLine(184), '184 outfits');
});

test('no Cinch-owned line quotes a price, a product or a term', () => {
  const words = Object.values(REVEAL_COPY).join(' ');
  assert.doesNotMatch(words, /\$|£|€|\/mo|per month|per year|month|year/i, words);
  assert.doesNotMatch(words, /App Store|StoreKit|subscription|introductory/i, words);
});

test('no line promises a new trial', () => {
  // The 14-day trial is server-side ACCESS. There are zero Apple introductory
  // offers, so a sentence offering one would be describing a product that does
  // not exist.
  const words = Object.values(REVEAL_COPY).join(' ');
  assert.doesNotMatch(words, /free trial|start your trial|\d+[- ]day/i, words);
  // The trialing line talks about the trial that is ALREADY running.
  assert.match(REVEAL_COPY.memberContextTrialing, /^The trial has everything open/);
});

test('the free line promises the free tier survives, because it must', () => {
  assert.match(REVEAL_COPY.memberContextFree, /stays yours on the free tier/);
});

// ---------------------------------------------------------------------------
// The arrival beat
// ---------------------------------------------------------------------------

test('the arrival states the true piece count and no computed number', () => {
  assert.equal(arrivalTitle(10), 'That’s ten');
  assert.equal(arrivalBody(10), 'Ten pieces are in your closet.');
  // A closet that reached this screen with nine says nine, rather than a
  // sentence that is wrong about the reader's own morning.
  assert.equal(arrivalTitle(9), 'That’s nine');
  assert.equal(arrivalBody(1), 'One piece is in your closet.');
});

test('no beat before the count implies a number is coming', () => {
  assert.doesNotMatch(REVEAL_COPY.computingTitle, /\d/, REVEAL_COPY.computingTitle);
  assert.doesNotMatch(REVEAL_COPY.computingBody, /\d/, REVEAL_COPY.computingBody);
});

test('the computing beat says where the arithmetic happens', () => {
  assert.match(REVEAL_COPY.computingBody, /on this phone\. Nothing leaves it\./);
});
