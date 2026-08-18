/**
 * People Search — the overlap defect, and the properties that keep it closed.
 *
 * The directive lists this page as "P0 — has a live visual defect the founder
 * sees — overlapping text", and says the fix must be verified rather than
 * assumed. A screenshot verifies it for the data that was on screen; these
 * assertions verify it for data nobody has tried yet, which is the half a
 * photograph cannot cover.
 *
 * The old row declared one of the three parts a flex row needs: the text
 * column was `flex-1`, and neither the avatar nor the trailing control said
 * anything about shrinking. RN's default `flexShrink` is 0, so a long name
 * and an "Add" pill negotiated the same points and the loser was drawn over.
 * The three parts are stated explicitly now, and this is what says so.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PAGE_FOCUS_BORDER,
  PAGE_HEIGHT,
  PAGE_INPUT_FONT_SIZE,
  PAGE_RADIUS,
  showsFocusRing,
} from '../src/components/ui/search-field-spec';

const BODY = readFileSync('src/components/social/people-search-body.tsx', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const CODE = code(BODY);

test('a text column that can grow is a text column that can shrink', () => {
  // `flex: 1` alone does not permit a text node to go narrower than its
  // content in every RN layout path; `minWidth: 0` is what makes the shrink
  // actually available. Every flexible column on this page states both.
  const flexColumns = CODE.match(/flex: 1[^}]*}/g) ?? [];
  assert.ok(flexColumns.length >= 3, 'expected the name, invite and title columns');
  for (const column of flexColumns) {
    assert.match(column, /minWidth: 0/, `a flexible column without minWidth: 0 — ${column}`);
  }
});

test('the avatar and the trailing control keep their points explicitly', () => {
  // The other half of the same bargain: if the fixed parts do not say they
  // are fixed, the text column is not the one that gives.
  assert.match(CODE, /flexShrink: 0/, 'nothing on this page declares itself unshrinkable');
  assert.ok(
    (CODE.match(/flexShrink: 0/g) ?? []).length >= 3,
    'the disc, the trailing control and the masthead action each need it',
  );
});

test('at standard size both lines of a person are single-line and truncate', () => {
  // A name longer than its column ellipsises. It does not wrap into the row
  // below it, and it does not paint over the control beside it.
  assert.match(CODE, /numberOfLines=\{large \? undefined : 1\}/);
  assert.ok(
    (CODE.match(/numberOfLines=\{large \? undefined : 1\}/g) ?? []).length >= 3,
    'the name, the handle and the invite subtitle each truncate at standard size',
  );
});

test('at the accessibility sizes composition changes instead of truncating', () => {
  // The governing contract, verbatim: "In every case composition changes and
  // height is allowed. Nothing is capped, truncated, ellipsised or scaled
  // below its documented size." `undefined` above is that clause — the same
  // lines stop truncating and are allowed to wrap.
  assert.match(CODE, /alignSelf: large \? 'stretch' : 'auto'/, 'the control goes full width');
  assert.match(CODE, /large \? 'column' : 'row'/, 'rows stack');
  assert.match(CODE, /if \(large\)/, 'the masthead drops Cancel onto its own line');
});

test('every control on the page clears the 44pt floor', () => {
  // `PressableSurface` applies MIN_TAP_TARGET itself; the two hand-rolled
  // Pressables have to say it, and the error actions are taller still.
  assert.ok(
    (CODE.match(/minHeight: MIN_TAP_TARGET/g) ?? []).length >= 3,
    'a control was drawn without a floor',
  );
  assert.match(CODE, /minHeight: 56/, 'the error actions are the frame’s full-width pair');

  // A floor, never a fixed height — a label that grows with Dynamic Type has
  // to be able to take the room. The loading skeleton is the one exception
  // and is allowed its literal: it stands in for a control's geometry and
  // carries no text to grow.
  const controls = CODE.replace(/function LoadingState[\s\S]*?\n}\n/, '');
  assert.doesNotMatch(controls, /\bheight: MIN_TAP_TARGET/, 'a fixed 44 under a label');
});

test('waiting is drawn with skeletons, never a spinner', () => {
  // A spinning thing cannot reproduce itself in a screenshot, and `Skeleton`
  // already parks its sweep under Reduce Motion — so the page inherits the
  // accessibility requirement instead of re-implementing it.
  assert.match(CODE, /<Skeleton/);
  assert.doesNotMatch(CODE, /ActivityIndicator|<Spinner/, 'a spinner reached the search page');
});

test('the page spends one oxblood ground per state', () => {
  // The constitution's rule, and the frames obey it: the resting state's
  // primary invite row, the no-results CTA, and the error retry are each the
  // single accent on their own screen. The secondary is always blush.
  const grounds = CODE.match(/primary \? theme\.accent : theme\.blush/g) ?? [];
  assert.equal(grounds.length, 2, 'the invite row and the error action pair');
});

test('the field this page draws is opt-in, so the other three are untouched', () => {
  // `SearchField` exists because Closet, Lately and Friends drifted while
  // hand-typing the same eight lines. The redesign's taller, ringed field is
  // a prop on that component rather than a fourth copy of it — and it is off
  // by default, so those three screens render exactly as they did.
  const field = readFileSync('src/components/ui/search-field.tsx', 'utf8');
  assert.match(field, /size = 'door'/, 'the page field must not become the default');
  assert.match(BODY, /size="page"/);

  assert.equal(PAGE_INPUT_FONT_SIZE, 17, 'reading size — the field is the page’s subject');
  assert.equal(PAGE_HEIGHT, 50);
  assert.equal(PAGE_RADIUS, 15);
  assert.equal(PAGE_FOCUS_BORDER, 1.5);
});

test('the focus ring tracks the caret and nothing else', () => {
  // A ring that also tracked emptiness would flick on at the first keystroke
  // of a field that was already the user's subject.
  assert.equal(showsFocusRing(true), true);
  assert.equal(showsFocusRing(false), false);

  // Drawn as an always-present border that is only sometimes coloured, so the
  // field's inner width does not jump 3pt when the caret lands.
  const field = readFileSync('src/components/ui/search-field.tsx', 'utf8');
  assert.match(field, /borderColor: ringed \? theme\.accent : 'transparent'/);
});

test('the OFFLINE pill is derived from the palette, not eyedropped', () => {
  // `warning` is a FILL and the contrast record says ink goes on it; the pill
  // takes the token at an alpha for its ground rather than introducing a
  // fourth amber nobody can trace.
  assert.match(CODE, /warningAlpha\(0\.22\)/);
  assert.match(CODE, /backgroundColor: theme\.warning/);
  assert.doesNotMatch(CODE, /#F5E4C8|#7A5312|#B98A2A/, 'a hex from the artifact reached the app');
});

test('no colour on this page is a literal', () => {
  // Every fill and every type colour comes from `useTheme()` or a derived
  // alpha helper. The artifact's hexes ARE the tokens' hexes, which is why
  // typing one would be invisible until the palette moved.
  assert.doesNotMatch(CODE, /#[0-9a-fA-F]{3,8}\b/, 'a hardcoded colour');
  assert.doesNotMatch(CODE, /rgba\(/, 'a hand-composited colour');
});
