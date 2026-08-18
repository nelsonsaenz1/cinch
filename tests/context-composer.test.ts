/**
 * UX-03 — Today's context, disclosed progressively.
 *
 * The composer is the only permission-free path the day's plans have into the
 * styling engine, so the thing this file guards is not the affordance but what
 * the affordance must not cost: the sentence, the commit, and the lifecycle
 * that was already shipping.
 *
 * Two refusals are asserted as hard as the behaviour. The screen must not have
 * grown a clock — the implementation plan refuses the atlas's local-midnight
 * persistence rule explicitly — and it must not have grown a permission.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ADD_CONTEXT_LABEL,
  EMPTY_COMPOSER,
  appliedLine,
  clearComposer,
  commitComposer,
  composerFace,
  openComposer,
} from '../src/components/today/context-composer-state.ts';

const code = (p: string) => readFileSync(p, 'utf8');
const stripped = (p: string) =>
  code(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const TODAY = 'src/app/(tabs)/index.tsx';
const COMPOSER = 'src/components/today/context-composer.tsx';
const STATE = 'src/components/today/context-composer-state.ts';

// ---------------------------------------------------------------------------
// The three faces
// ---------------------------------------------------------------------------

test('a screen that has been told nothing shows one quiet affordance', () => {
  assert.equal(composerFace(EMPTY_COMPOSER), 'add');
  assert.equal(ADD_CONTEXT_LABEL, 'Add context');
});

test('the field opens only on intent, and closes onto the applied sentence', () => {
  const opened = openComposer(EMPTY_COMPOSER);
  assert.equal(composerFace(opened), 'editing');

  const typed = { ...opened, draft: 'dinner at 7 then drinks' };
  const committed = commitComposer(typed);
  assert.equal(composerFace(committed), 'applied');
  assert.equal(committed.committed, 'dinner at 7 then drinks');
  assert.equal(appliedLine(committed.committed), 'Styling for “dinner at 7 then drinks”.');
});

// ---------------------------------------------------------------------------
// "Preserve entered context" — the brief's own phrase
// ---------------------------------------------------------------------------

test('re-opening an applied context is an edit, not a retype', () => {
  const applied = commitComposer({ open: true, draft: 'dinner at 7', committed: '' });
  const reopened = openComposer(applied);
  assert.equal(reopened.draft, 'dinner at 7', 'the sentence had to be typed again');
  assert.equal(composerFace(reopened), 'editing');
});

test('a half-typed draft wins over what is committed', () => {
  // It is the newer of the two things the reader said.
  const state = { open: false, draft: 'dinner at 8', committed: 'dinner at 7' };
  assert.equal(openComposer(state).draft, 'dinner at 8');
});

// ---------------------------------------------------------------------------
// Committing nothing is clearing
// ---------------------------------------------------------------------------

test('a blank field un-says the context rather than styling for nothing', () => {
  const emptied = commitComposer({ open: true, draft: '   ', committed: 'dinner at 7' });
  assert.equal(emptied.committed, '');
  assert.equal(composerFace(emptied), 'add', 'the screen was left applying an empty sentence');
});

test('what is committed is what is quoted', () => {
  // A screen styling for "dinner " and printing "dinner" would be two facts
  // about one word. Trimmed once, at the commit.
  const committed = commitComposer({ open: true, draft: '  brunch  ', committed: '' });
  assert.equal(committed.committed, 'brunch');
  assert.equal(committed.draft, 'brunch');
});

test('the ✕ clears everything', () => {
  assert.deepEqual(clearComposer(), EMPTY_COMPOSER);
});

// ---------------------------------------------------------------------------
// What the disclosure must not have cost
// ---------------------------------------------------------------------------

// ── REDESIGN 11 REPLACED THE FIELD ON TODAY ────────────────────────────────
//
// This file used to assert that the composer's committed sentence reached the
// engine as `note`. It reached the engine, and the engine did NOTHING with it:
// `StyleContext.note` is read by the naming hash and the enhancement gate and
// by no scorer at all, so an occasion typed into the field re-rolled three
// names and changed no outfit. The test was true and the promise was not.
//
// Today now asks the same question as a closed list, and the answer lands on
// the two inputs the scorer actually reads. The assertion moves with it: the
// question is no longer "does the sentence survive the trip" but "does the
// chip reach the scorer", which is the thing that was broken.
//
// The composer itself is untouched below — it still ships, on the surfaces
// that still mount it, and the rest of this file still guards it.
test('the chip reaches the scorer, which the field never did', () => {
  const src = stripped(TODAY);
  assert.match(src, /targetOccasion: engineOccasion\(context11\.occasion\)/);
  assert.match(src, /targetFormality: engineFormality\(context11\.feel\)/);
  // And the free-text path is gone from this route entirely: nothing typed can
  // be sent anywhere from Today, because there is nothing to type into.
  assert.doesNotMatch(src, /<ContextComposer/, 'the free-text field is back on Today');
  assert.doesNotMatch(src, /committedNote/);
});

test('the field itself survives — only its permanence goes', () => {
  const src = stripped(COMPOSER);
  assert.match(src, /<TextInput/, 'the free-text composer was deleted rather than collapsed');
  assert.match(src, /placeholder="What’s on today\?"/, 'the placeholder changed');
  assert.match(src, /accessibilityLabel="Describe your plans today"/);
  // Opened on intent, so the keyboard comes with it: an affordance that opens a
  // field and then waits for a second tap is two taps.
  assert.match(src, /autoFocus/);
});

test('blur still commits, exactly as the always-open field did', () => {
  assert.match(stripped(COMPOSER), /onBlur=\{\(\) => onChange\(commitComposer\(state\)\)\}/);
});

test('the affordance and the applied sentence are both real targets', () => {
  const src = stripped(COMPOSER);
  // 34pt drawn, padded past the 44pt floor by hit slop — the arithmetic every
  // other quiet control on these screens uses.
  assert.equal((src.match(/hitSlop=/g) ?? []).length, 3, 'a control lost its padded hit region');
  assert.match(src, /accessibilityRole="button"/);
  assert.match(src, /accessibilityLiveRegion="polite"/, 'the applied sentence stopped announcing');
});

test('no clock was added to the context', () => {
  // The implementation plan: "preserve the existing Today-context lifecycle
  // rather than adding a new local-midnight persistence rule. The accepted
  // contribution is visual hierarchy and progressive disclosure, not new
  // product state."
  const src = stripped(STATE) + stripped(COMPOSER);
  assert.doesNotMatch(src, /new Date|Date\.now|midnight|AsyncStorage|SecureStore/);
});

test('no permission was added to the context', () => {
  const src = stripped(STATE) + stripped(COMPOSER);
  assert.doesNotMatch(src, /expo-location|expo-calendar|requestPermission/);
});

test('the refusal state still draws no context control', () => {
  // T-12 — a day the engine could not dress has a different next action, and
  // context is not it. Same gate, new control: `nothingWorks` still decides,
  // and offering chips over a refusal would invite somebody to restyle a
  // morning that has nothing to restyle.
  assert.match(stripped(TODAY), /\{!nothingWorks \? \([\s\S]{0,200}<ContextChips/);
});
