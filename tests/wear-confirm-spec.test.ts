/**
 * The wear confirmation — what the commit step decides. Redesign 13.
 *
 * Every function here is pure and imported directly. The SHEET's contract is
 * `tests/wear-confirm-sheet.test.ts`; the write itself belongs to
 * `useWearOutfit` and `wear_outfit_tx` and is asserted where it lives.
 *
 * The contracts this file exists to hold, in the order they matter:
 * unrated is legal, cancel writes nothing, pending cannot dismiss, a double tap
 * is swallowed, a retry is idempotent, and the favourite is never social.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { WearFailureKind } from '../src/features/styling/wear-failure';
import {
  CANCEL_HEIGHT,
  COLLAGE_HEIGHT,
  COLLAGE_HEIGHT_TIGHT,
  CTA_HEIGHT,
  CTA_HEIGHT_AX,
  HEART_ROW,
  HEART_ROW_AX,
  SHORT_DEVICE_HEIGHT,
  STARS,
  STAR_GLYPH,
  STAR_GLYPH_AX,
  STAR_TARGET,
  STAR_TARGET_AX,
  WEAR_COPY,
  collageHeight,
  collageLabel,
  favoriteOverridesRating,
  mayConfirm,
  mayDismiss,
  mayEdit,
  piecesSummary,
  ratingHint,
  starFilled,
  tasteSignal,
  toggleStar,
  wearErrorView,
  type Star,
  type WearPhase,
} from '../src/features/today/wear-confirm-spec';

const PHASES: WearPhase[] = ['idle', 'confirming', 'settled', 'failed'];
const KINDS: WearFailureKind[] = [
  'signed_out',
  'session_unavailable',
  'network',
  'rejected',
  'unexpected',
];

// ---------------------------------------------------------------------------
// Pending cannot dismiss, cannot edit, cannot double-submit
// ---------------------------------------------------------------------------

test('the sheet cannot be dismissed while the write is in flight', () => {
  // A dismissal accepted mid-write leaves a transaction in the air with nobody
  // watching for its answer — which is how a wear comes to exist that the app
  // believes was cancelled.
  assert.equal(mayDismiss('confirming'), false);
  for (const p of PHASES.filter((p) => p !== 'confirming')) {
    assert.equal(mayDismiss(p), true, `${p} refused a dismissal`);
  }
});

test('a failed write dismisses freely, because nothing was written', () => {
  assert.equal(mayDismiss('failed'), true);
  assert.equal(mayEdit('failed'), true, 'the selections were lost on failure');
});

test('nothing can be edited while the write is in flight', () => {
  // A star tapped mid-flight would be a selection the transaction never
  // carried, sitting on screen looking as though it had been saved.
  assert.equal(mayEdit('confirming'), false);
  assert.equal(mayEdit('settled'), false, 'a settled wear was still editable');
});

test('a second tap during the write is swallowed', () => {
  assert.equal(mayConfirm('confirming'), false);
  // And a settled sheet cannot be confirmed again at all.
  assert.equal(mayConfirm('settled'), false);
  assert.equal(mayConfirm('idle'), true);
  // A retry from `failed` IS allowed — that is the whole point of the state.
  assert.equal(mayConfirm('failed'), true);
});

test('every phase answers all three guards, with no gap', () => {
  for (const p of PHASES) {
    assert.equal(typeof mayDismiss(p), 'boolean', p);
    assert.equal(typeof mayEdit(p), 'boolean', p);
    assert.equal(typeof mayConfirm(p), 'boolean', p);
  }
  // Editable and confirmable move together: any state that can be changed can
  // be submitted, and any state that cannot be changed cannot be submitted.
  for (const p of PHASES) assert.equal(mayEdit(p), mayConfirm(p), p);
});

// ---------------------------------------------------------------------------
// Rating — null is not zero
// ---------------------------------------------------------------------------

test('tapping a star chooses it', () => {
  for (const s of STARS) assert.equal(toggleStar(null, s), s);
});

test('tapping the chosen star again clears to null, never to zero', () => {
  // Zero is a rating somebody gave; null is a rating nobody gave. The RPC's
  // range is 1–5 precisely so zero can never be read as the low end.
  for (const s of STARS) {
    const cleared = toggleStar(s, s);
    assert.equal(cleared, null, `${s} cleared to ${cleared}`);
    assert.notEqual(cleared, 0);
  }
});

test('tapping a different star moves the choice rather than clearing it', () => {
  assert.equal(toggleStar(2, 5 as Star), 5);
  assert.equal(toggleStar(5, 1 as Star), 1);
});

test('the fill runs up to the choice and stops', () => {
  assert.deepEqual(STARS.map((s) => starFilled(3, s)), [true, true, true, false, false]);
  assert.deepEqual(STARS.map((s) => starFilled(null, s)), [false, false, false, false, false]);
  assert.deepEqual(STARS.map((s) => starFilled(5, s)), [true, true, true, true, true]);
});

test('an untouched sheet says Optional and a cleared one says Cleared', () => {
  assert.equal(ratingHint(null, false), WEAR_COPY.ratingOptional);
  assert.equal(ratingHint(null, true), WEAR_COPY.ratingCleared);
  // A chosen rating needs no hint about being optional.
  assert.equal(ratingHint(4, true), WEAR_COPY.ratingOptional);
});

// ---------------------------------------------------------------------------
// Unrated is legal, and teaches nothing
// ---------------------------------------------------------------------------

test('an unrated wear produces NO taste signal at all', () => {
  // The contract's sharpest line: a wear with no opinion attached must not
  // drift the model in either direction. Null means the learner is never
  // called — not called with a neutral value.
  assert.equal(tasteSignal(null, false), null);
});

test('three stars is neutral — recorded, and teaching nothing', () => {
  assert.equal(tasteSignal(3, false), null);
});

test('four and five are positive, one and two are negative', () => {
  assert.equal(tasteSignal(4, false), true);
  assert.equal(tasteSignal(5, false), true);
  assert.equal(tasteSignal(1, false), false);
  assert.equal(tasteSignal(2, false), false);
});

test('a favourite is positive and overrides every conflicting rating', () => {
  // Somebody who gives two stars and keeps the outfit anyway has said something
  // stronger than the stars did.
  for (const r of [null, 1, 2, 3, 4, 5]) {
    assert.equal(tasteSignal(r, true), true, `rating ${r} beat the favourite`);
  }
});

test('the override is explained only when the two genuinely disagree', () => {
  assert.equal(favoriteOverridesRating(2, true), true);
  assert.equal(favoriteOverridesRating(1, true), true);
  // Not over a five-star favourite — that would be the app narrating an
  // argument nobody was having.
  assert.equal(favoriteOverridesRating(5, true), false);
  assert.equal(favoriteOverridesRating(3, true), false);
  assert.equal(favoriteOverridesRating(null, true), false);
  assert.equal(favoriteOverridesRating(2, false), false);
});

test('the taste mapping is total over every legal pair', () => {
  for (const r of [null, 1, 2, 3, 4, 5]) {
    for (const f of [true, false]) {
      const s = tasteSignal(r, f);
      assert.ok(s === true || s === false || s === null, `${r}/${f} → ${String(s)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Failure, told apart — and every one of them says nothing was written
// ---------------------------------------------------------------------------

test('every failure states plainly that nothing was written', () => {
  for (const k of KINDS) {
    for (const offline of [true, false]) {
      const v = wearErrorView(k, offline);
      assert.match(
        `${v.title} ${v.body}`,
        /Nothing was written|Nothing is held|nothing/i,
        `${k}/${offline}: ${v.body}`,
      );
    }
  }
});

test('no failure ever promises a queue', () => {
  // This app has no wear queue. Promising one is a lie the next screen exposes.
  for (const k of KINDS) {
    for (const offline of [true, false]) {
      const v = wearErrorView(k, offline);
      const words = `${v.title} ${v.body} ${v.action}`;
      assert.doesNotMatch(words, /will sync|syncs when|saved here|when you.re back online|queued/i, words);
    }
  }
  // The offline copy names the absence outright.
  assert.match(wearErrorView('network', true).body, /Nothing is held in a queue/);
});

test('a session that ended is not retryable in place', () => {
  const v = wearErrorView('signed_out', false);
  assert.equal(v.retryable, false);
  assert.equal(v.action, 'Sign in');
  // A "Try again" that will fail identically is the dead control every refusal
  // in this app forbids.
  assert.notEqual(v.action, 'Try again');
});

test('offline and a dropped connection are told apart', () => {
  const off = wearErrorView('network', true);
  const dropped = wearErrorView('network', false);
  assert.notEqual(off.title, dropped.title);
  assert.match(off.title, /You are offline/);
  assert.match(dropped.body, /dropped before it saved/);
  // Both retryable, both preserving the selections.
  assert.equal(off.retryable, true);
  assert.equal(dropped.retryable, true);
  assert.match(dropped.body, /your stars are still here/);
});

test('a server rejection is retryable and never blames the wearer', () => {
  for (const k of ['rejected', 'unexpected'] as WearFailureKind[]) {
    const v = wearErrorView(k, false);
    assert.equal(v.retryable, true);
    assert.doesNotMatch(v.body, /you (did|entered|chose)|invalid|your fault/i, v.body);
  }
});

test('no failure surfaces a raw service message or an error code', () => {
  for (const k of KINDS) {
    for (const offline of [true, false]) {
      const v = wearErrorView(k, offline);
      const words = `${v.title} ${v.body}`;
      assert.doesNotMatch(words, /\b\d{3}\b|PGRST|22003|postgres|sql|exception/i, words);
    }
  }
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

test('the favourite is described as owner-private wherever it appears', () => {
  assert.equal(WEAR_COPY.favoritePrivate, 'Only you can see this');
  assert.match(WEAR_COPY.privacyNote, /rating, favorite/);
  // The note names each field rather than saying "private", because a reader
  // cannot check a word and can check a list.
  for (const field of ['rating', 'favorite', 'occasion', 'weather', 'notes', 'cost-per-wear']) {
    assert.ok(WEAR_COPY.privacyNote.includes(field), `${field} is not named`);
  }
});

test('the settled line reports the fact and celebrates nothing', () => {
  assert.equal(WEAR_COPY.settled, 'Logged. Wear counts updated.');
  assert.doesNotMatch(WEAR_COPY.settled, /nice|great|well done|🎉|congrat/i);
});

test('a retry that found the original says so', () => {
  // The one moment the idempotency guarantee is visible to a person.
  assert.equal(WEAR_COPY.settledIdempotent, 'Logged once. Nothing was duplicated.');
  assert.notEqual(WEAR_COPY.settled, WEAR_COPY.settledIdempotent);
});

test('no copy on this sheet mentions money, membership or a trial', () => {
  const words = Object.values(WEAR_COPY).join(' ');
  assert.doesNotMatch(words, /\$|£|€|member|upgrade|pro\b|trial|plan|price/i, words);
});

// ---------------------------------------------------------------------------
// The outfit, said once
// ---------------------------------------------------------------------------

const piece = (subcategory: string | null, colour: string | null, category = 'top') => ({
  category,
  subcategory,
  colors: colour ? [{ name: colour }] : [],
});

test('a short outfit names its colours', () => {
  assert.equal(
    piecesSummary([piece('coat', 'wool'), piece('shirt', 'linen'), piece('ankle boots', null)]),
    'Wool coat, linen shirt, ankle boots',
  );
});

test('a long outfit drops the colours rather than becoming a paint chart', () => {
  const five = [
    piece('coat', 'charcoal'),
    piece('shirt', 'oatmeal'),
    piece('trousers', 'black'),
    piece('skirt', 'navy'),
    piece('boots', 'brown'),
  ];
  assert.equal(piecesSummary(five), 'Coat, shirt, trousers, skirt, boots');
});

test('the line never truncates and never says "and 2 more"', () => {
  const many = Array.from({ length: 8 }, (_, i) => piece(`piece${i}`, 'grey'));
  const line = piecesSummary(many);
  assert.doesNotMatch(line, /…|\.\.\.|more/, line);
  assert.equal(line.split(', ').length, 8);
});

test('an untagged piece still gets a word, never a blank or a null', () => {
  const line = piecesSummary([piece(null, null, 'other'), piece('shirt', 'linen')]);
  assert.doesNotMatch(line, /null|undefined/, line);
  assert.ok(line.length > 0);
});

test('the collage speaks as one outfit, not as five cells', () => {
  assert.equal(collageLabel('The quiet Wednesday', 3), 'The quiet Wednesday, 3 pieces');
  assert.equal(collageLabel('One thing', 1), 'One thing, 1 piece');
});

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

test('every target clears 44pt, and 56pt at an accessibility size', () => {
  for (const [small, big] of [
    [STAR_TARGET, STAR_TARGET_AX],
    [HEART_ROW, HEART_ROW_AX],
    [CTA_HEIGHT, CTA_HEIGHT_AX],
  ]) {
    assert.ok(small >= 44, `${small}pt target`);
    assert.ok(big >= 56, `${big}pt target at AX`);
    assert.ok(big > small, 'a target did not grow at AX');
  }
  assert.ok(CANCEL_HEIGHT >= 44, `${CANCEL_HEIGHT}pt cancel`);
});

test('a star glyph always fits inside its own target', () => {
  assert.ok(STAR_GLYPH < STAR_TARGET, `${STAR_GLYPH} in ${STAR_TARGET}`);
  assert.ok(STAR_GLYPH_AX < STAR_TARGET_AX, `${STAR_GLYPH_AX} in ${STAR_TARGET_AX}`);
});

test('the collage gives up height on a short screen and at AX', () => {
  // Both for the same reason: the CTA must stay above the home indicator and
  // the type must not clip, and the collage is the only thing here that can
  // afford to be smaller.
  assert.equal(collageHeight(932, false), COLLAGE_HEIGHT);
  assert.equal(collageHeight(667, false), COLLAGE_HEIGHT_TIGHT);
  assert.equal(collageHeight(932, true), COLLAGE_HEIGHT_TIGHT);
  assert.equal(collageHeight(667, true), COLLAGE_HEIGHT_TIGHT);
  assert.ok(COLLAGE_HEIGHT_TIGHT < COLLAGE_HEIGHT);
  assert.equal(SHORT_DEVICE_HEIGHT, 700);
});
