/**
 * The first-run tour's copy and its once-ever predicate, held against the
 * exact wording and rules in design-refs/html/36 First-Run Tour Atlas.dc.html
 * and docs/design/diary-boards-activity-contract.md §1 (the TR- renaming).
 *
 * ── WHAT REDESIGN 20 MOVED, AND WHAT IT DID NOT ─────────────────────────────
 *
 * Nothing in this file changed shape. The deck, the once-ever predicate and the
 * exit matrix are the shipped machinery — redesign 20 restyled the frames and
 * left every decision they turn on alone, which is why the assertions below are
 * the same ones that shipped.
 *
 * What is NEW here is the sample data the redrawn plates print. The frames
 * split TR-03's one weather sentence into a card header — "Wednesday" on the
 * left, "63°F · Grey" on the right — so `TOUR_SAMPLE_SKY` moved from "and grey"
 * to "Grey", and the miniature grew a footer row and a result card that print
 * four more sample strings. They are pinned here for the same reason the body
 * copy is: they are words a new user reads, and a silent change to them is a
 * silent change to what the app claims it does.
 *
 * The LAYOUT contract — skippability at every size, the permission-free module
 * graph, the gate living in the handoff rather than in the route — lives in
 * `tests/tour-layout.test.ts`. It is not duplicated here.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import {
  TOUR_CLOSET_TARGET,
  TOUR_FRAMES,
  TOUR_SAMPLE_ITEM,
  TOUR_SAMPLE_ITEM_CATEGORY,
  TOUR_SAMPLE_ITEM_COLOUR,
  TOUR_SAMPLE_LAST_WORN,
  TOUR_SAMPLE_LOOK,
  TOUR_SAMPLE_SKY,
  TOUR_SAMPLE_WEEKDAY,
  TOUR_UNITS,
} from '../src/features/onboarding/tour-copy';
import {
  exitDestination,
  frameAt,
  indexOfFrame,
  isLastFrame,
  nextIndex,
  shouldShowTour,
  skipVisible,
  TOUR_FRAME_COUNT,
} from '../src/features/onboarding/tour-state';

test('three frames, hard limit — and they are TR-, not T-', () => {
  assert.equal(TOUR_FRAMES.length, TOUR_FRAME_COUNT);
  assert.deepEqual(
    TOUR_FRAMES.map((f) => f.id),
    ['TR-01', 'TR-02', 'TR-03'],
  );
});

test('TR-01 — the promise, on the one dark ground', () => {
  const f = frameAt(0);
  assert.equal(f.eyebrow, 'One · The promise');
  assert.equal(f.headline, 'Your whole closet, on one page.');
  // "No shop" was replaced 2026-08-11: it was true when the tour was drawn and
  // stopped being true when the commerce surfaces shipped. This assertion is
  // what caught the copy change, which is the point of pinning drawn strings —
  // the promise a new user reads first is not something to alter silently.
  assert.equal(
    f.body,
    'Cinch keeps a record of what you own and what you wore. Your closet first. Shop only when something is genuinely missing. No strangers, no feed to keep up with.',
  );
  assert.equal(f.ground, 'ink');
  assert.equal(f.action, 'Next');
  assert.equal(f.secondary, null);
});

test('the dark ground is spent once', () => {
  assert.deepEqual(
    TOUR_FRAMES.map((f) => f.ground),
    ['ink', 'canvas', 'canvas'],
  );
});

test('TR-02 — the camera, and the ten is the free closet, not a typed number', () => {
  const f = frameAt(1);
  assert.equal(f.eyebrow, 'Two · The camera');
  assert.equal(f.headline, 'Photograph it once.');
  assert.equal(
    f.body,
    'Lay a piece flat, take one picture, and Cinch cuts it out, names the color and files it. Ten pieces is enough to start; the rest can come slowly.',
  );
  // The sentence is derived. If the free tier ever moves, the word moves with
  // it rather than the copy quietly going wrong.
  assert.equal(TOUR_CLOSET_TARGET, PLANS.free.items);
});

test('TR-03 — the ritual, and two real ways out', () => {
  const f = frameAt(2);
  assert.equal(f.eyebrow, 'Three · The ritual');
  assert.equal(f.headline, 'Then, every morning, one page.');
  assert.equal(
    f.body,
    'Today opens on the weather, what you wore last, and a look built from what is clean and in the wardrobe. Confirm it, or change it, and get on with the day.',
  );
  assert.equal(f.action, 'Start with the camera');
  assert.equal(f.secondary, 'I’ll look around first');
});

test('the sample data on the plates is sample data, and says so', () => {
  // Redesign 20's plates print more than a temperature: a filed piece with a
  // name and a colour·category line on TR-02, and a look plus a wear line under
  // TR-03's miniature. Every one is furniture on a drawing — the plates are
  // announced to VoiceOver as samples — but they are still sentences a first
  // user reads, so they are pinned rather than left to drift.
  assert.equal(TOUR_SAMPLE_WEEKDAY, 'Wednesday');
  // "and grey" until the header split it off the temperature. It opens its own
  // phrase now, so it is capitalised.
  assert.equal(TOUR_SAMPLE_SKY, 'Gray');
  assert.equal(TOUR_UNITS, 'F');
  assert.equal(TOUR_SAMPLE_LOOK, 'Blouse, skirt, loafers');
  assert.equal(TOUR_SAMPLE_LAST_WORN, 'Last worn Friday');
  assert.equal(TOUR_SAMPLE_ITEM, 'Camel shirt');
  assert.equal(TOUR_SAMPLE_ITEM_COLOUR, 'Camel');
  assert.equal(TOUR_SAMPLE_ITEM_CATEGORY, 'Tops');
  // The card illustrates the sentence above it — "cuts it out, names the colour
  // and files it" — so its colour word has to be the colour in its own name.
  assert.ok(TOUR_SAMPLE_ITEM.toLowerCase().startsWith(TOUR_SAMPLE_ITEM_COLOUR.toLowerCase()));
});

test('skip is on every frame but the last, where the two choices replace it', () => {
  assert.equal(skipVisible(0), true);
  assert.equal(skipVisible(1), true);
  assert.equal(skipVisible(2), false);
  // The frame that drops Skip is exactly the frame that grows a secondary.
  TOUR_FRAMES.forEach((f, i) => {
    assert.equal(f.skippable, !isLastFrame(i));
    assert.equal(f.secondary == null, !isLastFrame(i));
  });
});

test('the deck walks forward and then stops', () => {
  assert.equal(nextIndex(0), 1);
  assert.equal(nextIndex(1), 2);
  assert.equal(nextIndex(2), null);
  assert.equal(indexOfFrame('TR-03'), 2);
  assert.throws(() => frameAt(3));
});

test('every headline is two or three words a line — none runs long', () => {
  for (const f of TOUR_FRAMES) {
    assert.ok(f.headline.split(' ').length <= 6, `${f.id} headline too long`);
    // 17/1.55 and never past three lines: about 200 characters at this measure.
    assert.ok(f.body.length <= 200, `${f.id} body too long: ${f.body.length}`);
  }
});

test('once, ever — the tour shows only for an account that has never been toured', () => {
  assert.equal(shouldShowTour({ status: 'ready', touredAt: null }), true);
  assert.equal(shouldShowTour({ status: 'ready', touredAt: '2026-08-09T09:41:00Z' }), false);
});

test('D1 — the camera exit lands in The Ten, which is what gives it an entrance', () => {
  // The whole of the wedge: before this, `/the-ten` was reachable only from
  // the Reveal's own repair loop, so no new user could get to it at all.
  assert.equal(exitDestination('camera', 0), '/the-ten');
  assert.equal(exitDestination('camera', 3), '/the-ten');
  assert.equal(exitDestination('camera', PLANS.free.items - 1), '/the-ten');
});

test('a closet already past the free ten gets the plain camera, not a guided ten', () => {
  // `toured_at` is newer than the app, so an established account meets the
  // tour once. Sending it into a screen that would stop on "That's the ten"
  // over sixty garments is a false statement, not an onboarding.
  assert.equal(exitDestination('camera', PLANS.free.items), '/capture');
  assert.equal(exitDestination('camera', 60), '/capture');
});

test('the escape stays an escape, whatever is in the closet', () => {
  assert.equal(exitDestination('tabs', 0), '/(tabs)');
  assert.equal(exitDestination('tabs', 60), '/(tabs)');
  assert.equal(exitDestination('tabs', null), '/(tabs)');
});

test('an unread closet falls to The Ten — the new account is the likely one', () => {
  assert.equal(exitDestination('camera', null), '/the-ten');
});

test('an unresolved or failed read never shows the tour', () => {
  // Better a new account meets the empty states cold — a screen the app
  // designs for — than a user of six months gets the promise again because
  // the network blinked.
  assert.equal(shouldShowTour({ status: 'loading' }), false);
  assert.equal(shouldShowTour({ status: 'unavailable' }), false);
});
