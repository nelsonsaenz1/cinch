/**
 * CP-03 — the queue is two counted cards, and the bar is gone.
 *
 * ── WHAT THIS FILE IS DEFENDING ───────────────────────────────────────────
 *
 * A `ProgressTrack` rendered at `capture.tsx:1025`, filled by settled/total.
 * The constitution refuses it in one line — "Progress is a count, never a bar
 * or percentage" — and CP-03's annotation is "Queue is a count".
 *
 * But counting is not enough, and a first pass at this got exactly that wrong:
 * it printed "1 piece / Ready to review" and "2 pieces / In the queue", which
 * counts honestly and says nothing. The frame draws two cards whose difference
 * IS the design — the first names the garment ("Linen blouse"), because the
 * notice sits over a captured frame and the user has to know which piece it
 * belongs to; the second is a semantic remainder ("Two more"), which is what a
 * person says about a queue they are not looking at.
 *
 * So the assertions below are about SEMANTICS: that the first card carries the
 * real name of the first ready garment, that the remainder is spelled the way a
 * sentence spells it, and that zero stays quiet. A test that only checked "a
 * count rendered" would have passed the rejected draft.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { queueAnnouncement, queueCards } from '../src/features/ingest/queue-count';

test('the frame, exactly: the garment by name, then the remainder', () => {
  // CP-03 as drawn — one finished blouse, two still being worked.
  assert.deepEqual(queueCards({ ready: 1, waiting: 2, firstReadyName: 'Linen blouse' }), [
    { lead: 'Linen blouse', state: 'Ready to review' },
    { lead: 'Two more', state: 'In the queue' },
  ]);
});

test('the first card is the REAL name, never a generic unit', () => {
  const [first] = queueCards({ ready: 1, waiting: 0, firstReadyName: 'Shearling coat' });
  assert.equal(first.lead, 'Shearling coat');
  assert.ok(!/piece/.test(first.lead), 'a named garment must not be reduced to "1 piece"');
});

test('several ready pieces still name the first one', () => {
  // The rest are on the queue rail immediately below, each with its own name
  // and tick, so naming one loses nothing.
  const [first] = queueCards({ ready: 4, waiting: 1, firstReadyName: 'Mohair sweater' });
  assert.deepEqual(first, { lead: 'Mohair sweater', state: 'Ready to review' });
});

test('a nameless finished piece falls back to a count — never an invented name', () => {
  // A piece can be filed and reviewable before the tagger has said what it is.
  assert.deepEqual(queueCards({ ready: 1, waiting: 0, firstReadyName: null }), [
    { lead: '1 piece', state: 'Ready to review' },
  ]);
  assert.deepEqual(queueCards({ ready: 3, waiting: 0 }), [
    { lead: '3 pieces', state: 'Ready to review' },
  ]);
  // Whitespace is not a name either.
  assert.deepEqual(queueCards({ ready: 1, waiting: 0, firstReadyName: '   ' }), [
    { lead: '1 piece', state: 'Ready to review' },
  ]);
});

test('the remainder is SEMANTIC — spelled small, singular at one', () => {
  const spelled = (waiting: number) => queueCards({ ready: 0, waiting })[0].lead;
  assert.equal(spelled(1), 'One more');
  assert.equal(spelled(2), 'Two more');
  assert.equal(spelled(9), 'Nine more');
  assert.equal(spelled(12), 'Twelve more');
  // Past twelve the digit is quicker to read than the word.
  assert.equal(spelled(13), '13 more');
  assert.equal(spelled(48), '48 more');
});

test('zero is quiet — a nought count produces no card at all', () => {
  assert.deepEqual(queueCards({ ready: 0, waiting: 3 }), [
    { lead: 'Three more', state: 'In the queue' },
  ]);
  assert.deepEqual(queueCards({ ready: 2, waiting: 0, firstReadyName: 'Linen blouse' }), [
    { lead: 'Linen blouse', state: 'Ready to review' },
  ]);
  // Nothing to say, so nothing is said — not "0 pieces", not an empty card.
  assert.deepEqual(queueCards({ ready: 0, waiting: 0 }), []);
});

test('a count is never negative or fractional, whatever it is handed', () => {
  // Cannot arise from the store, but a count is the one thing on that screen a
  // person is entitled to believe.
  assert.deepEqual(queueCards({ ready: -1, waiting: -2 }), []);
  assert.deepEqual(queueCards({ ready: 1.7, waiting: 0, firstReadyName: null }), [
    { lead: '1 piece', state: 'Ready to review' },
  ]);
});

test('VoiceOver hears one sentence, not one per card per tick', () => {
  assert.equal(
    queueAnnouncement({ ready: 1, waiting: 2, firstReadyName: 'Linen blouse' }),
    'Linen blouse, ready to review, Two more, in the queue',
  );
  assert.equal(queueAnnouncement({ ready: 0, waiting: 0 }), null);
});

test('no Group 3 surface renders a progress bar', () => {
  // The census is the point. `ProgressTrack` is not deleted — retiring the
  // component is the integrator's call — but nothing this lane owns may reach
  // for it, and this is what fails the moment somebody does.
  const surfaces = [
    'src/app/capture.tsx',
    'src/app/add-clothes.tsx',
    'src/dev-fixtures/dev-capture.tsx',
    'src/app/item/[id].tsx',
    'src/components/review/review-card.tsx',
    'src/components/ingest/garment-search-sheet.tsx',
    'src/components/ingest/upload-queue-list.tsx',
    'src/components/closet/item-card.tsx',
  ];
  const offenders = surfaces.filter((f) => {
    const src = readFileSync(f, 'utf8')
      // Comments are stripped first: this file's own prose, and capture.tsx's
      // note explaining WHY the bar is gone, must not count as bringing it back.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    return /ProgressTrack/.test(src);
  });
  assert.deepEqual(offenders, [], `progress bar re-introduced in:\n${offenders.join('\n')}`);
});
