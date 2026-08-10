/**
 * The first-run tour's copy and its once-ever predicate, held against the
 * exact wording and rules in design-refs/html/36 First-Run Tour Atlas.dc.html
 * and docs/design/diary-boards-activity-contract.md §1 (the TR- renaming).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import { TOUR_CLOSET_TARGET, TOUR_FRAMES } from '../src/features/onboarding/tour-copy';
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
  assert.equal(
    f.body,
    'Cinch keeps a record of what you own and what you wore. No shop, no strangers, no feed to keep up with.',
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
    'Lay a piece flat, take one picture, and Cinch cuts it out, names the colour and files it. Ten pieces is enough to start; the rest can come slowly.',
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
