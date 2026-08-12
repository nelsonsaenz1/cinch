/**
 * Wave 3 Group 1 — TD-00 and TR-04, the two states the hallway hands into.
 *
 * TD-00 is "Paywall dismissed — Today, free closet intact", and everything the
 * atlas refuses about it is a refusal a screenshot review cannot catch: a price
 * or a tier name creeping into the capacity band, an action appearing under it,
 * or the count quietly becoming a literal that stops moving when the free
 * closet does. Those are the checks here.
 *
 * TR-04 is Skip's destination, and its acceptance is behavioural rather than
 * visual — "Skip lands on Today's empty state, not on a dead end". The routing
 * half is already held by `tests/tour.test.ts`; what this file adds is the
 * other half of the same sentence: that the destination prints no count, and
 * that both intake doors survive the skip.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

import {
  capacityNoteApplies,
  capacityNoteBody,
  capacityNoteHeading,
} from '../src/components/today/capacity-note-copy';
import { missingPhrase } from '../src/components/today/closet-floor-copy';
import { PLANS } from '../src/features/billing/plans';
import { exitDestination } from '../src/features/onboarding/tour-state';

/** Comments stripped: a file explaining why it avoids something is not doing it. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------
// TD-00 — the capacity note
// ---------------------------------------------------------------------------

test('TD-00 — the note is drawn at the free ceiling, in the free closet’s own words', () => {
  const active = PLANS.free.items;
  assert.equal(capacityNoteApplies('free', active), true);
  assert.equal(capacityNoteHeading(active), 'Your closet holds ten active pieces');
  assert.equal(
    capacityNoteBody(active),
    'That is what these outfits are built from. Add an eleventh whenever you want a bigger closet.',
  );
});

test('TD-00 — every figure in the note is derived from PLANS, never typed', () => {
  // The failure this catches is a tier change leaving the sentence quoting last
  // month's ceiling. Both numbers have to move with `PLANS.free.items`, so the
  // check is stated against a DIFFERENT count than the shipping one.
  assert.equal(capacityNoteHeading(12), 'Your closet holds twelve active pieces');
  assert.equal(
    capacityNoteBody(12),
    'That is what these outfits are built from. Add a thirteenth whenever you want a bigger closet.',
  );
  // …and the shipping sentence is genuinely the free ceiling's, not a
  // coincidence of the word "ten" appearing in a string.
  assert.match(capacityNoteHeading(PLANS.free.items), new RegExp(`\\b${'ten'}\\b`));
});

test('TD-00 — the note is a fact about a whole free closet and nothing else', () => {
  // Below the ceiling there is nothing to state: the closet is not at a
  // boundary, and a note about capacity would be an upsell wearing a fact's
  // clothes.
  assert.equal(capacityNoteApplies('free', PLANS.free.items - 1), false);
  // Above it — a downgraded account, whose closet stays whole per dependency
  // D-3 — "add an eleventh" would name an action the database refuses.
  assert.equal(capacityNoteApplies('free', PLANS.free.items + 37), false);
  // A closet that has not loaded is not a closet at its ceiling.
  assert.equal(capacityNoteApplies('free', 0), false);
  // Paid tiers have no free ceiling to state, and Pro has nothing above it.
  assert.equal(capacityNoteApplies('standard', PLANS.free.items), false);
  assert.equal(capacityNoteApplies('pro', PLANS.free.items), false);
});

test('TD-00 — an unread tier prints nothing rather than assuming free', () => {
  // `usePlan()` answers `free` while its query is in flight and again when the
  // read failed. That default is right for a gate and wrong for a sentence, so
  // the caller passes null and the note omits itself — a known-unknown is
  // omitted, never estimated.
  assert.equal(capacityNoteApplies(null, PLANS.free.items), false);

  const screen = code('src/app/(tabs)/index.tsx');
  assert.match(screen, /planState\.loading \|\| planState\.unconfirmed \? null : planState\.plan/, screen);
});

test('TD-00 — no price, no tier name, and no action in the capacity band', () => {
  // "The capacity note is a fact in tray, not an upgrade prompt — no price and
  // no tier name one screen after a dismissed paywall."
  const sentences = [
    capacityNoteHeading(PLANS.free.items),
    capacityNoteBody(PLANS.free.items),
  ].join(' ');

  assert.doesNotMatch(sentences, /\$|price|month|year|trial/i, sentences);
  for (const tier of [PLANS.free.name, PLANS.standard.name, PLANS.pro.name]) {
    assert.doesNotMatch(sentences, new RegExp(`\\b${tier}\\b`), `${tier} named in the band`);
  }
  assert.doesNotMatch(sentences, /upgrade|subscribe|unlock|see plans/i, sentences);

  // And the component carries no control at all — a Pressable, a Button or an
  // `onPress` here would be the second attempt to persuade after a decline.
  const component = code('src/components/today/capacity-note.tsx');
  assert.doesNotMatch(component, /Pressable|Button|onPress|accessibilityRole="button"/, component);
});

test('TD-00 — the band spends no accent; the frame’s one oxblood is the plate’s', () => {
  const component = code('src/components/today/capacity-note.tsx');
  assert.doesNotMatch(component, /bg-accent|theme\.accent|text-accent/, component);
  // Tray ground and the label cut, at the constitution's 12 — never a capsule.
  assert.match(component, /bg-tray/, component);
  assert.match(component, /rounded-md/, component);
  assert.doesNotMatch(component, /rounded-full/, component);
});

test('TD-00 — the note sets no faint text', () => {
  const component = code('src/components/today/capacity-note.tsx');
  assert.doesNotMatch(component, /text-faint|theme\.faint/, component);
});

// ---------------------------------------------------------------------------
// TR-04 — where Skip lands
// ---------------------------------------------------------------------------

test('TR-04 — Skip lands on Today, whatever the closet’s size', () => {
  // "Skip lands on Today's empty state, not on a dead end." The closet size
  // argument steers the CAMERA exit only; the escape stays an escape.
  assert.equal(exitDestination('tabs', null), '/(tabs)');
  assert.equal(exitDestination('tabs', 0), '/(tabs)');
  assert.equal(exitDestination('tabs', PLANS.free.items), '/(tabs)');
  assert.equal(exitDestination('tabs', 400), '/(tabs)');
});

test('TR-04 — zero is quiet: the destination prints no count', () => {
  // An empty closet has no missing-kind phrase to print, so the empty branch
  // cannot reach the "Add a bottom and a pair of shoes" sentence at all — and
  // the screen states the free tier's ten rather than the reader's nought.
  assert.equal(missingPhrase([]), null);

  const floor = code('src/components/today/closet-floor.tsx');
  assert.doesNotMatch(floor, /0 pieces|items\.length\} pieces/, floor);
  // The ten is `PLANS.free.items` through `numberWord`, never a word typed in.
  assert.match(floor, /numberWord\(PLANS\.free\.items\)/, floor);
});

test('TR-04 — both intake doors survive the skip, in the hallway’s order', () => {
  const floor = code('src/components/today/closet-floor.tsx');
  const photograph = floor.indexOf('Start your closet');
  const describe = floor.indexOf('Describe it out loud instead');
  assert.ok(photograph > -1, 'the camera door is not drawn');
  assert.ok(describe > -1, 'the voice door is not drawn');
  assert.ok(photograph < describe, 'the doors are not in the choice screen’s order');
  // And the voice door is drawn on the EMPTY branch specifically — TR-04 is the
  // frame that has to keep it, and a closet already under way does not.
  assert.match(floor, /\{empty \? \(/, floor);
});

test('TR-04 — no absolute about shopping reaches Skip’s destination (audit 100)', () => {
  const floor = code('src/components/today/closet-floor.tsx');
  assert.doesNotMatch(floor, /No shop|No affiliate|never shows products/i, floor);
});
