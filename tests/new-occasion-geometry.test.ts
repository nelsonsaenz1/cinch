import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  fieldValueMaxLines,
  TIME_CONTROL_MIN_WIDTH,
  whenControlsStacked,
} from '../src/features/events/new-layout.ts';

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
const OCCASION_FIELD = 'src/components/events/occasion-field.tsx';
const PLACE_FIELD = 'src/components/events/place-field.tsx';

test('the When row stays across the sizes that hold it and stacks above them', () => {
  // Measured on the 393pt design width with the time control on its floor: the
  // date control keeps 158.9pt of text at 1.5 against the 127.5pt its widest
  // honest value needs, and 133.7 against 153.0 at 1.8.
  assert.equal(whenControlsStacked(1.0), false);
  assert.equal(whenControlsStacked(1.35), false, 'the standard range must not relayout');
  assert.equal(whenControlsStacked(1.5), true);
  assert.equal(whenControlsStacked(1.8), true);

  // The atlas's number survives — as a floor. A `width` here is what cut
  // `12:30pm` in half from 1.35 upward.
  assert.equal(TIME_CONTROL_MIN_WIDTH, 118);
  assert.doesNotMatch(
    body(SCREEN),
    /width: *118|width=\{118\}/,
    'the time control is pinned to a fixed width again',
  );
  assert.match(body(SCREEN), /minWidth: TIME_CONTROL_MIN_WIDTH/);
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

test('the scroll clears the docked footer by measuring it, not by guessing', () => {
  const src = body(SCREEN);
  assert.doesNotMatch(src, /pb-32/, 'the footer clearance is a constant again');
  assert.match(src, /onLayout=\{\(event\) => setFooterHeight\(event\.nativeEvent\.layout\.height\)\}/);
  assert.match(src, /paddingBottom: footerHeight \+ GUTTER/);
});

test('the copy the reface cut stays cut, and the sentences doing work stay', () => {
  const screen = body(SCREEN);
  const field = body(OCCASION_FIELD);
  const place = body(PLACE_FIELD);

  // Cut: the counter restated a cap the keyboard was already enforcing, in a
  // sentence that wrapped to two lines at the top of the scale.
  assert.doesNotMatch(field, /Names cap at|Caps at \$\{cap\}/);
  assert.match(field, /`\$\{remaining\} left`/);
  // Cut: the note placeholder's second clause, and the forecast clause on the
  // place-lookup failure.
  assert.doesNotMatch(screen, /before they pick a look/);
  assert.match(screen, /placeholder="Anything they should know"/);
  // Cut for a measured reason: a single-line TextInput scrolls its placeholder
  // rather than wrapping it, and three examples ran 429.6pt past a 323pt field.
  assert.doesNotMatch(screen, /a wedding, a birthday/);
  assert.match(screen, /placeholder="Dinner, a wedding…"/);
  assert.doesNotMatch(place, /won’t carry a\s+forecast|just won’t carry a forecast/);
  assert.match(place, /What you typed is kept\./);

  // Kept: the sentence that explains a button which is off, and the one that
  // promises nothing typed was lost. Neither is chrome.
  assert.match(screen, /Give it a name and Cinch can plan it\./);
  assert.match(screen, /Everything you typed is still here/);

  // Kept: the two When controls read as actions rather than as empty inputs.
  assert.match(screen, /placeholder="Pick a date"/);
  assert.match(screen, /placeholder="Pick a time"/);
});

test('the form lands its vertical rhythm on the named spacing scale', () => {
  const screen = body(SCREEN);
  // `mt-4` (16) was off the scale and gave the fields only a 2:1 ratio against
  // the 8pt label gap. 20 is `gutter`, and 24 under the headline puts the title
  // a step clear of the eyebrows beneath it.
  assert.doesNotMatch(screen, /className="mt-4"|className="mt-4 |mt-4"/);
  assert.equal((screen.match(/mt-gutter/g) ?? []).length, 4, 'the four fields below Name');
  assert.match(screen, /pb-bare pt-bezel/);
});
