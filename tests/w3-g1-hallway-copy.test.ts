/**
 * Wave 3 Group 1 — the first-run hallway's derived copy.
 *
 * Every sentence checked here prints a number, and the whole point of the
 * checks is that none of those numbers is typed into a layout: they come from
 * `PLANS`, from the slot list, from `countOutfits`, or from a duration the
 * recorder measured. A figure that stops being derived stops being true the
 * next time the tier moves, which is the failure this file exists to catch.
 *
 * The refusals these enforce, in the atlas's own words:
 *   · "Prices/temps/counts printed when known or omitted — never estimated,
 *      never a dash."
 *   · "Nothing is silently lost: every drop, decline, cancellation and failure
 *      names what is kept."
 *   · "Progress is a count, never a bar or percentage."
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import { countOutfits } from '../src/features/closet/outfit-count';
import {
  ceilingCopy,
  ceilingRows,
  failureCopy,
  heardChips,
  heardHeadline,
  readingBackHeadline,
  unmatchedTitle,
} from '../src/features/intake/walkthrough-copy';
import {
  CAMERA_DENIED,
  cameraDeniedKeepLine,
  resumeCardCopy,
  TEN_TITLE,
} from '../src/features/onboarding/ten-copy';
import { starterReadiness } from '../src/features/onboarding/starter-readiness';

// ---------------------------------------------------------------------------
// TR-05 / TR-06
// ---------------------------------------------------------------------------

test('the ten-piece surface has one title, and it is not the flow’s codename', () => {
  // TR-05, TR-06, T-01 and T-02 all print this. "The Ten" was the spec's
  // name for the flow showing through onto the screen.
  //
  // CX-01/CX-02 fix the numeral. An eyebrow is a label, not prose, so it takes
  // the same register as the "0 of 10 pieces" count rather than the spelled
  // form the sentences use.
  //
  // LP-06's accepted copy table then dropped the possessive: `Your first 10`
  // became `First 10`. Both surfaces move together because both read this
  // constant.
  //
  // REDESIGN 21 SPELLED IT BACK OUT, and the numeral argument above expired
  // rather than being overruled. It rested on the count beside the title being
  // written as `0 of 10` — same register, both labels. The approved frames
  // replace that count with a designed band reading `NONE OF TEN` in words, so
  // the numeral had nothing left to agree with and was the only figure on the
  // page. The one thing this test has always been for still holds: it is not
  // the flow's codename, `The Ten`, and the two surfaces still move together.
  assert.equal(TEN_TITLE, 'The ten');
  assert.notEqual(TEN_TITLE, 'The Ten');
});

test('TR-06 — resume is a count, never a bar', () => {
  const copy = resumeCardCopy(23, 4, 5, 'Tuesday');
  assert.equal(copy.title, '23 pieces heard, 4 confirmed');
  assert.equal(copy.action, 'Carry on from 5 of 23');
  // No percentage anywhere in the card.
  assert.doesNotMatch(`${copy.title} ${copy.body} ${copy.action}`, /%/);
});

test('TR-06 — nothing on the card implies the recording is discarded', () => {
  const copy = resumeCardCopy(23, 4, 5, 'Tuesday');
  assert.match(copy.body, /Nothing you said has gone anywhere/);
  // "Start again instead" names what it does, not what it destroys — the
  // confirm sheet on the other side is where a deletion would be stated.
  assert.equal(copy.secondary, 'Start again instead');
});

test('TR-06 — a one-piece walkthrough is not pluralised', () => {
  assert.match(resumeCardCopy(1, 0, 1, 'Tuesday').title, /^1 piece heard/);
});

// ---------------------------------------------------------------------------
// T-04 is gone
// ---------------------------------------------------------------------------
//
// The substitution sheet ("No dress? Spend the slot elsewhere") was the whole
// of T-04, and it only ever made sense because the position was ASKING for a
// dress. The grid draws generic cells now, so there is nothing to decline and
// nothing to spend a decline on — the sheet, its five copy helpers and their
// tests went with the template. What replaced it is T-07, the state a full
// grid stands in when the arithmetic has not arrived; its copy is held in
// tests/ten-copy.test.ts and its model in tests/starter-readiness.test.ts.

// ---------------------------------------------------------------------------
// T-05 — the camera is switched off
// ---------------------------------------------------------------------------

test('T-05 — the loudest action is the one that needs no permission', () => {
  assert.equal(CAMERA_DENIED.library, 'Choose from your camera roll');
  assert.match(CAMERA_DENIED.body, /needs no permission/);
});

test('T-05 — the closing sentence names what is kept, and is silent at zero', () => {
  assert.equal(cameraDeniedKeepLine(0), null);
  assert.equal(
    cameraDeniedKeepLine(1),
    'The piece you have already photographed is safe in your closet.',
  );
  assert.equal(
    cameraDeniedKeepLine(2),
    'The two pieces you have already photographed are safe in your closet.',
  );
});

// ---------------------------------------------------------------------------
// V-04 / V-05
// ---------------------------------------------------------------------------

test('V-04 — the duration is printed when known and dropped when it is not', () => {
  assert.equal(
    readingBackHeadline(4 * 60 * 1000),
    'Four minutes of wardrobe, being written down.',
  );
  assert.equal(readingBackHeadline(59_000), 'One minute of wardrobe, being written down.');
  // Never estimated, never a dash — the figure simply leaves.
  assert.equal(readingBackHeadline(null), 'Your wardrobe, being written down.');
  assert.doesNotMatch(readingBackHeadline(null), /—|-|\d/);
});

test('V-05 — the chips are present kinds only, and a zero kind is omitted', () => {
  const chips = heardChips({ tops: 7, bottoms: 5, dresses: 2, shoes: 4, outerwear: 3, bag: 2 });
  assert.deepEqual(chips, ['7 tops', '5 bottoms', '2 dresses', '4 shoes', '3 coats', '2 bags']);
  assert.deepEqual(heardChips({ tops: 1, bottoms: 0 }), ['1 top']);
});

test('V-05 — unmatched phrases are named as kept, and zero is quiet', () => {
  assert.equal(unmatchedTitle(0), null);
  assert.equal(unmatchedTitle(1), 'One phrase Cinch could not place');
  assert.equal(unmatchedTitle(6), 'Six phrases Cinch could not place');
});

test('V-05 — the headline counts what was heard', () => {
  assert.equal(heardHeadline(23), '23 pieces, in your own words.');
  assert.equal(heardHeadline(1), '1 piece, in your own words.');
});

// ---------------------------------------------------------------------------
// V-13 — five named causes
// ---------------------------------------------------------------------------

test('V-13 — every cause has its own screen, its own action, and no shared copy', () => {
  const causes = ['denied', 'silent', 'unparsed', 'offline', 'signed_out'] as const;
  const headlines = new Set<string>();
  const primaries: string[] = [];
  for (const cause of causes) {
    const copy = failureCopy(cause);
    assert.ok(copy.headline.length > 0);
    assert.ok(copy.body.length > 0);
    assert.ok(copy.primary.length > 0);
    headlines.add(copy.headline);
    primaries.push(copy.primary);
  }
  // Five distinct screens, never one generic failure with swapped copy.
  assert.equal(headlines.size, causes.length);
  // "Try again" belongs to the offline branch and to nothing else: it is the
  // only cause where the SAME audio can succeed.
  assert.deepEqual(
    primaries.filter((p) => p === 'Try again'),
    ['Try again'],
  );
  assert.equal(failureCopy('offline').primary, 'Try again');
  assert.equal(failureCopy('silent').primary, 'Record again');
});

test('V-13a — a denied prompt says nothing was recorded', () => {
  // Without it, a denial after a Start tap reads as a lost take.
  assert.match(failureCopy('denied').body, /^Nothing was recorded\./);
});

test('V-13d — the saved recording is quoted when its length is known, dropped when not', () => {
  assert.match(
    failureCopy('offline', 4 * 60 * 1000).body,
    /^Your four-minute recording is saved on this phone\./,
  );
  assert.match(failureCopy('offline', null).body, /^Your recording is saved on this phone\./);
});

test('V-13d — "Leave it for later" is the other end of TR-06’s promise', () => {
  assert.deepEqual(failureCopy('offline').secondaries, ['Leave it for later']);
});

// ---------------------------------------------------------------------------
// M-07 — the ceiling
// ---------------------------------------------------------------------------

test('M-07 — every figure comes from the free tier, not from a sentence', () => {
  const heard = 23;
  const copy = ceilingCopy(heard, PLANS.free.items, PLANS.free.storedItems);
  assert.equal(copy.eyebrow, 'Twenty-three heard');
  assert.equal(copy.headline, 'Your closet holds ten active at a time.');
  assert.match(copy.body, /All twenty-three are saved\./);
  assert.match(copy.body, /the other thirteen wait in storage/);
  assert.equal(copy.primary, 'Choose which ten stay active');

  const rows = ceilingRows(heard, PLANS.free.items, PLANS.free.storedItems);
  assert.deepEqual(rows, [
    { label: 'Active now', value: String(PLANS.free.items), quiet: false },
    { label: 'In storage', value: String(heard - PLANS.free.items), quiet: false },
    { label: 'Storage holds', value: String(PLANS.free.storedItems), quiet: true },
  ]);
});

test('M-07 — a capacity fact, never an upsell', () => {
  // The deviation ledger records this deliberately: no tier is named, no price
  // appears and no upgrade action is drawn. The paywall comes after the Reveal.
  const copy = ceilingCopy(23, PLANS.free.items, PLANS.free.storedItems);
  const everything = [copy.eyebrow, copy.headline, copy.body, copy.primary, copy.secondary, copy.footer].join(' ');
  assert.doesNotMatch(everything, /\$|Standard|Pro|upgrade|trial|month|year/i);
  // And nothing is silently lost.
  assert.equal(copy.footer, 'Either way, nothing you said is deleted.');
});

// ---------------------------------------------------------------------------
// The arithmetic behind T-06
// ---------------------------------------------------------------------------

test('the stop sheet quotes a count computed from the real closet', () => {
  // Not a marketing figure, and no longer a figure about a PLAN either: the
  // template used to assert fourteen outfits over ten positions nobody had
  // filled. `countOutfits` now only ever runs over garments that exist.
  const nelson = starterReadiness(
    (
      [
        'base_top', 'base_top', 'base_top', 'mid_layer',
        'bottom', 'bottom',
        'footwear', 'footwear',
        'accessory', 'outerwear',
      ] as const
    ).map((slot) => ({ slot })),
  );
  assert.equal(nelson.outfits, countOutfits(nelson.tally));
  assert.equal(nelson.outfits, 16);
});
