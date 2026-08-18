import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  fieldValueMaxLines,
  TIME_CONTROL_MIN_WIDTH,
  whenControlsStacked,
} from '../src/features/events/new-layout.ts';
import { ROW_GAP, ROW_MIN_HEIGHT } from '../src/features/events/new-event-spec.ts';

/**
 * The New Event form's geometry, after the reface that removed its truncation.
 *
 * Two kinds of assertion, and the split matters. The predicates are called for
 * real, at the type sizes they were measured at — that is the part with
 * behaviour in it. The source scans below are guards on the three shapes that
 * WERE the truncation, each of which is a constant in markup that no runtime
 * check can reach: a fixed width, a one-line clamp on somebody else's text, and
 * a hard-coded pad standing in for a measured footer. They are cheap and they
 * fail loudly if one of them is written back in.
 */

/** Comments stripped, so a file may explain in prose what it avoids in code. */
const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SCREEN = 'src/app/event/new.tsx';
const BODY = 'src/components/events/new-event-body.tsx';
const OCCASION_FIELD = 'src/components/events/occasion-field.tsx';
const NOTE_SHEET = 'src/components/events/note-sheet.tsx';
const PLACE_FIELD = 'src/components/events/place-field.tsx';

/**
 * ── SUPERSEDED BY REDESIGN 02, 2026-08-17 ─────────────────────────────────
 *
 * The two-across When row is gone. The accepted composer
 * (`design-refs/redesign-2026-08/02-new-event/`) asks Date and Time as two
 * separate full-width rows, each opening its own sheet, so there is no row for
 * a fixed-width time control to overflow and nothing for `TIME_CONTROL_MIN_
 * WIDTH` to floor. The predicates below are still called for real — the module
 * is still the app's answer for controls that share a measure, and
 * `place-field.tsx` still reads `fieldValueMaxLines` — but the assertions that
 * scanned `event/new.tsx` for them have no subject any more and are replaced
 * by the row assertions in `tests/new-event-layout.test.ts`.
 */
test('the When predicates still answer, though this page no longer asks them', () => {
  // Measured on the 393pt design width with the time control on its floor: the
  // date control keeps 158.9pt of text at 1.5 against the 127.5pt its widest
  // honest value needs, and 133.7 against 153.0 at 1.8.
  assert.equal(whenControlsStacked(1.0), false);
  assert.equal(whenControlsStacked(1.35), false, 'the standard range must not relayout');
  assert.equal(whenControlsStacked(1.5), true);
  assert.equal(whenControlsStacked(1.8), true);

  assert.equal(TIME_CONTROL_MIN_WIDTH, 118);

  // The composer draws Date and Time as separate rows, so neither the shared
  // row nor the fixed width can come back by accident.
  assert.doesNotMatch(
    body(BODY),
    /width: *118|width=\{118\}/,
    'the time control is pinned to a fixed width again',
  );
});

test('a field value is clamped only where the clamp is never reached', () => {
  assert.equal(fieldValueMaxLines(1.0), 2);
  assert.equal(fieldValueMaxLines(1.34), 2);
  // At and above the threshold there is no clamp at all: the row grows.
  assert.equal(fieldValueMaxLines(1.35), undefined);
  assert.equal(fieldValueMaxLines(1.8), undefined);
});

test('the place panel never clamps a name to one line again', () => {
  const src = body(PLACE_FIELD);
  // The bug: `numberOfLines={1}` on a Text with no flex reports its full
  // intrinsic width, so the ROW grew and the panel's overflow-hidden cut the
  // overrun off with no ellipsis to show for it.
  assert.doesNotMatch(src, /numberOfLines=\{1\}/, 'a one-line clamp is back in the place panel');
  assert.match(src, /numberOfLines=\{maxLines\}/);
  assert.match(src, /fieldValueMaxLines\(fontScale\)/);
  // And the row stacks rather than sharing a baseline, so neither line is
  // competing with the other for one measure.
  assert.doesNotMatch(src, /flex-row items-baseline gap-2 px-4/);
});

test('both text controls carry the app’s own Dynamic Type ceiling', () => {
  // `Text` applies these; a raw `TextInput` does not, and type-scale.ts names
  // this exact call site. Uncapped, the field's text ran past 3× while its
  // label and counter stopped at 1.8.
  for (const path of [OCCASION_FIELD, PLACE_FIELD]) {
    assert.match(
      body(path),
      /maxFontSizeMultiplier=\{MAX_TEXT_SCALE\}/,
      `${path} lets its TextInput scale past the app's ceiling`,
    );
  }
});

test('the scroll cannot end underneath the docked footer', () => {
  // SUPERSEDED BY REDESIGN 02 — and settled harder than it was.
  //
  // The old page overlaid a measured footer and paid for the clearance in
  // scroll padding, which is why it had to measure at all: a footer whose
  // height is the sum of a wrapping label, a helper sentence and a failure
  // line measured past 170pt at the top of the type scale, and a constant
  // could not follow it. The composer's footer is a SIBLING of the scroll in
  // one flex column, so it takes its own height out of the layout and there is
  // nothing left to measure or to guess. The scroll's `flex-1` is what makes
  // that true, and its absence is what would silently restore the bug.
  const src = body(BODY);
  assert.doesNotMatch(src, /pb-32/, 'the footer clearance is a constant again');
  assert.doesNotMatch(src, /footerHeight/, 'the footer is being measured again');
  assert.match(src, /<KeyboardAwareScrollView\s+className="flex-1"/);
});

test('the copy the reface cut stays cut, and the sentences the redesign wrote', () => {
  const screen =
    body(SCREEN) +
    body(BODY) +
    body(NOTE_SHEET) +
    readFileSync('src/features/events/new-event-spec.ts', 'utf8');
  const field = body(OCCASION_FIELD);
  const place = body(PLACE_FIELD);

  // Cut, and still cut: the counter restated a cap the keyboard was already
  // enforcing, in a sentence that wrapped to two lines at the top of the scale.
  assert.doesNotMatch(field, /Names cap at|Caps at \$\{cap\}/);
  assert.match(field, /`\$\{remaining\} left`/);
  // Cut, and still cut: the note placeholder's second clause, and the forecast
  // clause on the place-lookup failure. The note itself moved into its own
  // sheet and took its placeholder with it, unchanged.
  assert.doesNotMatch(screen, /before they pick a look/);
  assert.match(screen, /placeholder="Anything they should know"/);
  assert.doesNotMatch(place, /won’t carry a\s+forecast|just won’t carry a forecast/);
  assert.match(place, /What you typed is kept\./);

  // ── SUPERSEDED BY REDESIGN 02 ──────────────────────────────────────────
  //
  // Four strings the accepted frames replace outright, each with what now
  // stands in its place:
  //
  //   "Dinner, a wedding…"                  → the serif prompt is the field's
  //                                           own placeholder
  //   "Give it a name and Cinch can plan it." → no helper line at all; the
  //                                           empty frame's CTA is simply
  //                                           inactive and the prompt asks
  //   "Everything you typed is still here"  → the amber notice, which says the
  //                                           same promise in the artifact's
  //                                           own words
  //   "Pick a date" / "Pick a time"         → two labelled rows that open two
  //                                           sheets, marked `Optional`
  assert.match(screen, /prompt: 'What’s the occasion\?'/);
  assert.match(screen, /errorBody: 'Your draft is saved on this device\.'/);
  assert.match(screen, /date: 'Date'/);
  assert.match(screen, /time: 'Time'/);
  assert.match(screen, /optional: 'Optional'/);

  // The one thing the old sentence was load-bearing about survives as
  // behaviour rather than as prose: a failed create keeps the draft, and the
  // notice is what says so.
  assert.match(screen, /errorTitle: 'Couldn’t create the event'/);
});

test(`the composer spends its rhythm on the artifact's numbers`, () => {
  // SUPERSEDED BY REDESIGN 02. The old page's `mt-gutter` between five fields
  // and `pb-bare pt-bezel` under the headline are gone with the fields
  // themselves; the composer's rhythm is the artifact's 10pt row gap and its
  // 56pt row floor, and both live in `new-event-spec.ts` where a test can read
  // them rather than in the markup where one could not.
  assert.equal(ROW_GAP, 10);
  assert.equal(ROW_MIN_HEIGHT, 56);
  assert.doesNotMatch(body(BODY), /className="mt-4"/, 'a spacing value off the scale');
});
