/**
 * The Ten's derived copy.
 *
 * These are the sentences catalogued in docs/design/positioning-contract.md §7
 * — every one of them used to have the number ten typed into it, and one of
 * them had the word "eleventh". The point of this file is that changing
 * `PLANS.free.items` moves the words, so the copy cannot quietly go on
 * describing a tier the database no longer enforces.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import {
  TEN_SUPPORT,
  TEN_TITLE,
  filledTileLabel,
  noRoomCopy,
  repairCopy,
  replaceFailureLine,
  replaceSheetCopy,
  replacedAnnouncement,
  starterCardCopy,
  stopSheetCopy,
} from '../src/features/onboarding/ten-copy';
import {
  starterReadiness,
  starterSuggestion,
} from '../src/features/onboarding/starter-readiness';
import { emptyTen } from '../src/features/onboarding/ten-slots';
import type { Garment } from '../src/lib/styling';

test('the slot list IS the free closet — the two numbers may never drift', () => {
  // The grid's own eyebrow ("3 of 10", from the slot list) and `stopSheetCopy`
  // (from PLANS) both print the size of the free closet, on the same screen,
  // minutes apart. If these ever disagree the user is told two different
  // limits.
  assert.equal(emptyTen().length, PLANS.free.items);
});

test('the ten-piece surface carries the accepted headline and its one support line', () => {
  // Straight off the accepted copy table. The headline was `Your first 10`,
  // then `First 10`, and redesign 21's frames set it as a spelled phrase — see
  // `tests/w3-g1-hallway-copy.test.ts` for why the numeral argument expired
  // rather than being overruled. The support line is untouched.
  assert.equal(TEN_TITLE, 'The ten');
  assert.equal(TEN_SUPPORT, 'Build the ten pieces you reach for most.');
});

test('LP-06 · the support line is one line, and promises no outcome', () => {
  // One editorial headline and at most one supporting line before an action.
  assert.equal(TEN_SUPPORT.split('. ').length, 1);

  // The masthead once read "Ten pieces is enough for Cinch to style you
  // properly". Ten watches IS ten pieces, and `starterReadiness` correctly
  // refuses that closet — so the loudest line on the first screen of the app
  // asserted something the model contradicts. Held against the model rather
  // than against a string.
  const tenWatches = starterReadiness(repeat('accessory', 10).map((slot) => ({ slot })));
  assert.equal(tenWatches.pieces, 10);
  assert.ok(!tenWatches.ready, 'ten pieces alone is not enough — so do not say it is');
  assert.doesNotMatch(TEN_SUPPORT, /is enough|style you properly/);
});

// ---------------------------------------------------------------------------
// The adaptive card
// ---------------------------------------------------------------------------

const card = (...slots: Garment['slot'][]) => {
  const r = starterReadiness(slots.map((slot) => ({ slot })));
  return starterCardCopy(r, starterSuggestion(r));
};

const repeat = (slot: Garment['slot'], n: number): Garment['slot'][] =>
  Array.from({ length: n }, () => slot);

test('the card names the cause when the closet makes nothing', () => {
  const copy = card(...repeat('base_top', 5), ...repeat('bottom', 5));
  assert.equal(copy.title, 'Add a pair of shoes.');
  // 5 tops × 5 bottoms × 1 pair — computed, and printed as the real figure.
  assert.match(copy.body, /25 outfits/);
});

test('the card never quotes a projection that has not moved', () => {
  // The simulator defect, held as a test. Ten watches need shoes AND a top AND
  // a bottom, so a pair of shoes gains nothing — the card names the whole set
  // instead of printing "takes this closet to 0 outfits".
  const copy = card(...repeat('accessory', 10));
  assert.equal(copy.title, 'Add a pair of shoes.');
  assert.match(copy.body, /still needs a pair of shoes, a top and a bottom/);
  assert.doesNotMatch(copy.body, /\b0 outfits?\b/);
  assert.doesNotMatch(copy.body, /takes (this closet|it) to/);
});

test('the first screen of the app invites rather than directs', () => {
  const copy = card();
  assert.equal(copy.eyebrow, 'Start');
  assert.equal(copy.title, 'Start with whatever’s nearest.');
  // It must not contradict the masthead directly above it, which has just
  // said the ten can be photographed in any order.
  assert.match(copy.body, /Order is yours/);
  assert.doesNotMatch(copy.body, /\b0 outfits?\b/);
});

test('the card quotes the real count once the closet makes something', () => {
  const copy = card(
    'base_top', 'base_top', 'mid_layer',
    'bottom', 'bottom',
    'footwear', 'footwear',
    'accessory', 'outerwear',
  );
  // Nine pieces, twelve computed cores — only the count is short, so no kind
  // is named and the sentence says so.
  assert.equal(copy.title, 'One more to go.');
  assert.match(copy.body, /9 pieces already make 12 outfits/);
  assert.match(copy.body, /a coat, a bag, a watch/);
});

test('a ready closet gets a statement, not a suggestion', () => {
  const copy = card(
    'base_top', 'base_top', 'base_top', 'mid_layer',
    'bottom', 'bottom',
    'footwear', 'footwear',
    'accessory', 'outerwear',
  );
  assert.equal(copy.eyebrow, 'Ready');
  assert.equal(copy.title, 'Your 10 pieces make 16 outfits.');
});

test('the repair card names exactly what is absent', () => {
  const noShoes = repairCopy(
    starterReadiness([...repeat('base_top', 4), ...repeat('outerwear', 6)].map((slot) => ({ slot }))),
  );
  assert.match(noShoes.body, /a pair of shoes or a bottom/);
  assert.match(noShoes.title, /^That’s ten pieces/);
  // It never blames the reader, and it always offers the way back.
  assert.match(noShoes.body, /read it again|swap it/);
  assert.match(noShoes.body, /Nothing you’ve photographed goes anywhere/);

  // A closet whose shape is fine but whose arithmetic is thin says the other
  // thing — and quotes both real figures.
  const thin = repairCopy(
    starterReadiness(
      [
        { slot: 'base_top' as const },
        { slot: 'bottom' as const },
        { slot: 'footwear' as const },
        ...repeat('outerwear', 7).map((slot) => ({ slot })),
      ],
    ),
  );
  assert.match(thin.body, /These 10 pieces make 1 outfit —/);
});

test('T-06 — the stop sheet, including the eleventh, is derived', () => {
  const copy = stopSheetCopy(PLANS.free.items, 14);
  assert.equal(copy.eyebrow, 'Ten of ten');
  assert.equal(copy.title, 'That’s the ten. There’s room for an eleventh on a larger closet.');
  assert.equal(
    copy.body,
    'Your ten make 14 outfits. Nothing you’ve photographed goes anywhere — you can swap a piece out whenever you like.',
  );
});

test('the eleventh moves with the tier, and takes its article with it', () => {
  // A twelve-piece free closet has room for a thirteenth, not an eleventh —
  // and "a thirteenth", not "an".
  assert.equal(
    stopSheetCopy(12, 20).title,
    'That’s the twelve. There’s room for a thirteenth on a larger closet.',
  );
  assert.equal(stopSheetCopy(12, 20).eyebrow, 'Twelve of twelve');
});

test('the outfit count is never a constant — one outfit is singular', () => {
  // positioning-contract.md §3: the piece count may be a constant in prose,
  // the outfit count may never be. It is an argument here for exactly that
  // reason, and the grammar around it has to survive every value.
  assert.match(stopSheetCopy(PLANS.free.items, 1).body, /make 1 outfit\./);
  assert.match(stopSheetCopy(PLANS.free.items, 0).body, /make 0 outfits\./);
});

test('LP-02 · the replace sheet offers four actions, and Edit details is third', () => {
  // The accepted correction to the atlas: the shipping path to `/item/{id}`
  // survives inside the new sheet rather than being replaced by it. Order is
  // the assertion, because the order IS the correction.
  const copy = replaceSheetCopy(4, 'Knit');
  assert.deepEqual(
    [copy.retake, copy.library, copy.edit, copy.cancel],
    ['Retake photo', 'Choose from library', 'Edit details', 'Cancel'],
  );

  // The affected slot and item are announced — an icon-free sheet still has to
  // say which of ten positions it is about.
  assert.match(copy.announcement, /Slot 4/);
  assert.match(copy.announcement, /Knit/);
  assert.equal(copy.title, 'Knit');

  // Untagged, and the position is the only true thing left to say.
  assert.match(replaceSheetCopy(4, null).announcement, /Slot 4/);
});

test('LP-02 · every failure line names the slot and says it did not change', () => {
  for (const failure of [
    'camera-denied',
    'library-denied',
    'no-room',
    'processing-failed',
    'restore-failed',
  ] as const) {
    const line = replaceFailureLine(failure, 6);
    assert.ok(line, `${failure} said nothing`);
    assert.match(line, /Slot 6/);
    assert.match(line, /unchanged|didn’t change/, `${failure} did not say the slot is intact`);
  }

  // A cancel is not news: the reader chose it, and the grid in front of them
  // already shows the answer.
  assert.equal(replaceFailureLine('cancelled', 6), null);

  // Storage, never deletion — the one failure whose remedy is not obvious is
  // the one that has to name where the piece went.
  assert.match(replaceFailureLine('restore-failed', 2)!, /Storage/);
  assert.match(replaceFailureLine('restore-failed', 2)!, /Nothing has been deleted/);

  assert.match(replacedAnnouncement(3), /Slot 3/);
});

test('LP-02 · "try again in a moment" is never said to an account that is full', () => {
  // The transient cause: the archive write failed. Trying again is the right
  // advice and the closet has room for the result.
  const transient = replaceFailureLine('no-room', 6, false)!;
  assert.match(transient, /try again in a moment/);

  // The permanent cause: `item_total_limit_for_plan` counts stored pieces too,
  // so at the total ceiling archiving succeeds and the incoming photograph is
  // refused anyway. There is no moment to try again in, and saying so was a
  // lie — this is the whole point of the second branch.
  const full = replaceFailureLine('no-room', 6, true)!;
  assert.doesNotMatch(full, /try again/);
  assert.doesNotMatch(full, /in a moment/);

  // It still says the two things every failure line says: which slot, and that
  // nothing was taken away.
  assert.match(full, /Slot 6/);
  assert.match(full, /unchanged/);
  assert.match(full, /nothing has been removed/i);

  // THE REST IS NOW A PLATE, not a 44-word paragraph in a system alert. The
  // cause and both remedies the trigger's own hint names ("Delete a stored
  // piece, or upgrade.") are drawn — and the line above is that plate's note,
  // so the two cannot say different things about the same refusal.
  const plate = noRoomCopy(6);
  assert.equal(full, plate.note);
  assert.match(plate.headline, /Storage/);
  assert.equal(plate.storage, 'Open Storage');
  assert.equal(plate.plans, 'See plans');

  // A reader who cannot see the plate hears the whole refusal instead — the
  // paragraph the alert used to carry, unchanged, remedies included.
  assert.match(plate.announcement, /Slot 6/);
  assert.match(plate.announcement, /Storage/);
  assert.match(plate.announcement, /delete/i);
  assert.match(plate.announcement, /upgrade/i);
  assert.match(plate.announcement, /Nothing you’ve photographed has been removed/);
  assert.doesNotMatch(plate.announcement, /try again/);

  // No price and no figure anywhere on it: `AddGarmentOverLimit` is the surface
  // that quotes a tier, and `plans.ts` is the only place a number lives.
  for (const line of [plate.eyebrow, plate.headline, plate.note, plate.storage, plate.plans]) {
    assert.doesNotMatch(line, /\$|\d+ ?(pieces|items)/);
  }

  // The free tier really does hold more rows than it styles, which is what
  // makes the two branches distinct states rather than a distinction on paper.
  assert.ok(PLANS.free.storedItems > PLANS.free.items);
});

test('LP-02 · a filled tile names the piece, then its position', () => {
  // The accepted correction: the garment's name FIRST, because that is what a
  // VoiceOver reader is looking for, then `piece N of 10` so they know where
  // in the grid they are, then what the tile is for.
  assert.equal(filledTileLabel(3, 10, 'Knit'), 'Knit, piece 3 of 10, double-tap for actions.');

  // Ten is never typed — the total is the grid's own length, so a grid of a
  // different size cannot make the sentence lie.
  assert.equal(filledTileLabel(2, 6, 'Coat'), 'Coat, piece 2 of 6, double-tap for actions.');
});

test('LP-02 · an unnamed piece falls back to its position alone', () => {
  // A tile is nameless for an ordinary reason — the classifier has not
  // finished reading the photograph. The position is true from the first
  // frame, and the fallback is the same sentence with its first clause
  // missing rather than an invented name.
  assert.equal(filledTileLabel(3, 10, null), 'Piece 3 of 10, double-tap for actions.');
  // Whitespace is not a name.
  assert.equal(filledTileLabel(3, 10, '   '), 'Piece 3 of 10, double-tap for actions.');
  for (const empty of [null, '', '  ']) {
    assert.doesNotMatch(filledTileLabel(3, 10, empty), /undefined|null|Untitled/);
  }
});

test('LP-02 · the well speaks that label and nothing of its own', () => {
  // Source rather than rendered: the cell imports React Native and expo-image,
  // and the test bundler cannot parse React Native's Flow source. Comments are
  // stripped first — a sentence quoted in prose is not a sentence spoken.
  //
  // REDESIGN 21 moved the cell from `ten-tile.tsx` into `ten-parts.tsx` and
  // renamed it `TenWell`. Nothing this test is about moved with it: the label is
  // still the copy module's, the name is still spoken and never printed, and the
  // empty cell still names its position. Only the file did.
  const well = readFileSync('src/components/onboarding/ten-parts.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  // One wording, owned by the copy module above, reached through the garment
  // name the tray passes down. A literal here would be a second wording.
  assert.match(
    well,
    /accessibilityLabel=\{[\s\S]*?filledTileLabel\(slot\.id, total, garmentName \?\? null\)/,
  );
  assert.doesNotMatch(well, /Look \$\{slot\.id\} of/);

  // The name is SPOKEN, never printed: a filled well still draws no caption.
  assert.doesNotMatch(well, /\{garmentName\}/);

  // The empty well's label is untouched by the correction and stays as it was.
  assert.match(well, /slot \$\{slot\.id\}, empty/);
});
