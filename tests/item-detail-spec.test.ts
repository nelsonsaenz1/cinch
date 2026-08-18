/**
 * Item detail — what the screen decides. Redesign 15.
 *
 * The contracts this file holds, in the order the brief names them: cost per
 * wear is omitted when there is no price OR no wears, pairings prefer real
 * co-wear and label a suggestion as one, the image fallback is identical for
 * every reason, storage is reversible, and delete names what it costs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { costPerWear } from '../src/schemas/item';
import {
  BAND_RADIUS,
  DELETE_FAILURE_COPY,
  HERO_HEIGHT,
  HERO_HEIGHT_AX,
  ITEM_COPY,
  LENDING_FAILURE,
  LENDING_PRIVATE_NOTE,
  MIN_TARGET,
  MIN_TARGET_AX,
  NO_PAIRING_COPY,
  RAIL_HEADING,
  RAIL_QUALIFIER,
  ROW_MIN,
  SHEET_PRIMARY,
  SHEET_SECONDARY,
  coWearLabel,
  costPerWearValue,
  deleteConsequence,
  heroHeight,
  heroPathOrder,
  lendingShows,
  priceCell,
  railMode,
  sheetLocked,
  showsPricePrompt,
  storeConsequence,
  targetHeight,
  usesFallback,
  type ImageState,
} from '../src/features/item/item-spec';

// ---------------------------------------------------------------------------
// Price: never estimated, never divided by zero
// ---------------------------------------------------------------------------

test('no price means the cost cell is ABSENT, not blank and not dashed', () => {
  assert.equal(priceCell(null, 14), null);
  assert.equal(priceCell(null, 0), null);
  assert.equal(costPerWearValue(null, 14), null);
});

test('no wears means no cost per wear, whatever the price', () => {
  // Dividing by zero wears would be a fiction, and the price over ONE wear is
  // the price dressed as a judgement.
  assert.equal(costPerWearValue(240, 0), null);
  assert.equal(priceCell(240, 0), 'paid', 'the price itself was withheld too');
});

test('a price and wears together produce the rate', () => {
  assert.equal(priceCell(240, 20), 'rate');
  assert.equal(costPerWearValue(240, 20), 12);
});

test('the two independent statements of the rule agree at every input', () => {
  // `schemas/item.ts` owns one and `item-spec.ts` owns the other. Two
  // statements a test forces to agree are worth more than one statement two
  // callers trust.
  for (const price of [null, 0, 1, 240, 9999.99]) {
    for (const wears of [0, 1, 2, 14, 1000]) {
      assert.equal(
        costPerWearValue(price, wears),
        costPerWear({ purchasePrice: price, wearCount: wears }),
        `${String(price)} / ${wears}`,
      );
    }
  }
});

test('a negative or nonsense wear count cannot produce a figure', () => {
  assert.equal(costPerWearValue(240, -3), null);
});

test('the price prompt exists only when there is no price', () => {
  assert.equal(showsPricePrompt(null), true);
  assert.equal(showsPricePrompt(240), false);
  // Zero is a price somebody typed — a gift, a hand-me-down — and is not the
  // same as never having said.
  assert.equal(showsPricePrompt(0), false);
  assert.equal(priceCell(0, 4), 'rate');
});

test('the prompt never promises an estimate', () => {
  const words = `${ITEM_COPY.noPriceTitle} ${ITEM_COPY.noPriceBody} ${ITEM_COPY.addPrice}`;
  assert.doesNotMatch(words, /estimat|about|roughly|average|typical|market|retail/i, words);
  assert.match(ITEM_COPY.noPriceBody, /Add what you paid/);
});

// ---------------------------------------------------------------------------
// Pairings: history first, suggestions labelled, nothing invented
// ---------------------------------------------------------------------------

test('real co-wear always wins over colour harmony', () => {
  assert.equal(railMode(3, 8), 'coWear');
  assert.equal(railMode(1, 0), 'coWear');
});

test('colour harmony appears only when there is no co-wear at all', () => {
  assert.equal(railMode(0, 8), 'harmony');
  // One real pairing is enough to keep suggestions out.
  assert.equal(railMode(1, 8), 'coWear');
});

test('neither means the no-data state, not a hidden section', () => {
  assert.equal(railMode(0, 0), 'none');
  assert.ok(NO_PAIRING_COPY.title.length > 0);
  // And it says outright that there is nothing true to show.
  assert.match(NO_PAIRING_COPY.body, /nothing to show that would be true/);
});

test('the heading changes with the claim', () => {
  assert.equal(RAIL_HEADING.coWear, 'Wears well with');
  assert.equal(RAIL_HEADING.harmony, 'Pairs by colour');
  assert.notEqual(RAIL_HEADING.coWear, RAIL_HEADING.harmony);
});

test('a colour suggestion is QUALIFIED as one, in prose', () => {
  // A heading is easy to skim past, so the claim is made again.
  assert.match(RAIL_QUALIFIER.harmony!, /not worn together yet/);
  assert.match(RAIL_QUALIFIER.coWear!, /Worn together before/);
  assert.equal(RAIL_QUALIFIER.none, null);
});

test('a co-wear tile carries its real frequency', () => {
  assert.equal(coWearLabel(4), 'Worn together 4×');
  assert.equal(coWearLabel(1), 'Worn together 1×');
});

// ---------------------------------------------------------------------------
// Images: one fallback, three reasons, no inference
// ---------------------------------------------------------------------------

test('the hero prefers the listing photograph, then the owner’s', () => {
  assert.deepEqual(heroPathOrder({ listingPath: 'a', cutoutPath: 'b', thumbPath: 'c' }), [
    'a',
    'b',
    'c',
  ]);
});

test('missing, expired and unauthorized are ONE appearance', () => {
  // Any visible difference would let somebody infer that a piece exists but is
  // not theirs to see.
  const states: ImageState[] = ['missing', 'expired', 'unauthorized'];
  for (const s of states) assert.equal(usesFallback(s), true, s);
  assert.equal(usesFallback('ok'), false);
  // And the three are indistinguishable to the caller: one boolean, no reason.
  assert.equal(new Set(states.map(usesFallback)).size, 1);
});

// ---------------------------------------------------------------------------
// Storage and delete
// ---------------------------------------------------------------------------

test('storage says it is reversible and keeps the wears', () => {
  const body = storeConsequence(14);
  assert.match(body, /keeps the piece and its 14 wears/);
  assert.match(body, /restore it any time/);
  // The fact that makes storing a real alternative rather than a softer word
  // for deleting.
  assert.match(body, /hides it from the closet grid/);
});

test('storage reads correctly for one wear and for none', () => {
  assert.match(storeConsequence(1), /its 1 wear,/);
  assert.doesNotMatch(storeConsequence(0), /\bwears?\b/);
});

test('DELETE NAMES THE WEAR HISTORY IT TAKES', () => {
  // The part nobody expects to lose, because it is the part they never see a
  // file for.
  const body = deleteConsequence(14);
  assert.match(body, /the 14 wears logged against it/);
  assert.match(body, /removes the piece and its photographs from Cinch/);
});

test('DELETE SAYS THE CAMERA ROLL IS UNTOUCHED', () => {
  for (const wears of [0, 1, 14]) {
    assert.match(
      deleteConsequence(wears),
      /Pictures in your own camera roll stay where they are/,
      `${wears} wears`,
    );
  }
});

test('a never-worn piece is not told it loses wears', () => {
  assert.doesNotMatch(deleteConsequence(0), /logged against it/);
});

test('a failed delete states that NOTHING was partly removed', () => {
  assert.match(DELETE_FAILURE_COPY.body, /Nothing was partly removed/);
  assert.match(DELETE_FAILURE_COPY.body, /all still here/);
  // And it is retryable without losing the piece.
  assert.equal(DELETE_FAILURE_COPY.retry, 'Try again');
  assert.equal(DELETE_FAILURE_COPY.dismiss, 'Keep it for now');
});

test('a sheet is locked exactly while a write is open', () => {
  // Covers both: a second tap starting a duplicate destructive write, and a
  // dismissal leaving one in flight with nobody watching for its answer.
  assert.equal(sheetLocked(true), true);
  assert.equal(sheetLocked(false), false);
});

// ---------------------------------------------------------------------------
// Lending: private, friend-scoped, and never about another person
// ---------------------------------------------------------------------------

test('a lending failure says nothing about anybody else', () => {
  assert.doesNotMatch(
    LENDING_FAILURE,
    /block|mute|unavailable|not found|no longer|friend|they|them|their|account|reach/i,
    LENDING_FAILURE,
  );
  // It is about the write, and it says the state did not move.
  assert.match(LENDING_FAILURE, /Nothing changed/);
});

test('the switch never leads the write', () => {
  // A switch that flips optimistically and flips back has told somebody their
  // piece is lendable when it is not, and that is the state they remember.
  assert.equal(lendingShows(false), false);
  assert.equal(lendingShows(true), true);
});

test('lending is described as friend-scoped and never public', () => {
  assert.match(LENDING_PRIVATE_NOTE, /Only friends can ask/);
  assert.match(LENDING_PRIVATE_NOTE, /never public/i);
});

// ---------------------------------------------------------------------------
// Geometry and Dynamic Type
// ---------------------------------------------------------------------------

test('the hero yields height at an accessibility size', () => {
  assert.equal(heroHeight(false), HERO_HEIGHT);
  assert.equal(heroHeight(true), HERO_HEIGHT_AX);
  // So the type can have it. Text never shrinks; the picture does.
  assert.ok(HERO_HEIGHT_AX < HERO_HEIGHT);
});

test('every target clears 44pt, and 56pt at an accessibility size', () => {
  assert.equal(targetHeight(false), MIN_TARGET);
  assert.equal(targetHeight(true), MIN_TARGET_AX);
  assert.ok(MIN_TARGET >= 44);
  assert.ok(MIN_TARGET_AX >= 56);
  assert.ok(ROW_MIN >= 44, `${ROW_MIN}pt row`);
  assert.ok(SHEET_PRIMARY >= 56, `${SHEET_PRIMARY}pt primary`);
  assert.ok(SHEET_SECONDARY >= 44, `${SHEET_SECONDARY}pt secondary`);
});

test('the stats band is a designed object rather than two rules', () => {
  assert.ok(BAND_RADIUS > 0, 'the band lost its radius');
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

test('the listing source is a colophon, never a merchant pitch', () => {
  assert.equal(ITEM_COPY.listingPrefix, 'From');
  const words = Object.values(ITEM_COPY).join(' ');
  assert.doesNotMatch(words, /buy|shop|deal|sale|discount|offer|£|€|\$/i, words);
});

test('no copy on this page quotes a price, a plan or a trial', () => {
  const words = [
    ...Object.values(ITEM_COPY),
    ...Object.values(DELETE_FAILURE_COPY),
    ...Object.values(NO_PAIRING_COPY),
    LENDING_FAILURE,
    LENDING_PRIVATE_NOTE,
  ].join(' ');
  // Word boundaries on both sides: "remember the pairing" is not a membership
  // pitch, and a regex that thinks it is would be a gate nobody can satisfy.
  assert.doesNotMatch(words, /\bmembers?\b|\bupgrade\b|\bpro\b|\btrial\b|\bplans?\b/i, words);
});
