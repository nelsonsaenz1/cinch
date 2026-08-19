/**
 * The event detail page at large Dynamic Type (LP-09).
 *
 * Acceptance shot `dev-lp04-detail` at AX5 and found production content
 * clipped: the long title lost its continuation, When and Where were cut off,
 * the look's name and both actions clipped, and the rows below the fold went
 * off the bottom of the screen. Four separate-looking symptoms, three of them
 * one cause — a ScrollView measuring against its own content instead of the
 * viewport, so the page had no scroll left to give — and the rest single-line
 * geometry applied to text that no longer fits on one line.
 *
 * The rule this file exists to hold is the accessibility note's own: at every
 * setting composition changes and HEIGHT IS ALLOWED. Nothing is capped,
 * truncated, ellipsised, or scaled below its documented size. So each test
 * below asks one question — does this decision still let the content grow? —
 * and every one of them fails against the constants that shipped.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

import {
  detailTitleTrimmed,
  lookActionsStacked,
  lookTextMaxLines,
} from '@/features/events/detail-layout';

/**
 * iOS's real ladder, as `fontScale` reports it. The standard sizes run to
 * about 1.35 and the five accessibility steps continue past it; AX5 is the
 * setting acceptance shot.
 */
const DEFAULT = 1;
const LARGEST_STANDARD = 1.35;
const AX1 = 1.64;
const AX3 = 2.35;
const AX5 = 3.12;

const AX_SIZES = [AX1, AX3, AX5];

// ---------------------------------------------------------------------------
// The title
// ---------------------------------------------------------------------------

test('the title keeps its cap-trim at the sizes where it is one line', () => {
  // The default composition is not a casualty of the fix: below the threshold
  // the page draws exactly what LP-04 accepted.
  assert.equal(detailTitleTrimmed(DEFAULT), true);
  assert.equal(detailTitleTrimmed(1.2), true);
});

test('the title sheds its cap-trim once it wraps', () => {
  // `trim` subtracts a margin sized for ONE line. Applied to a title holding
  // three, it pulls the continuation under whatever follows — which is how a
  // 60-character title loses its end. This is the same switch the Today
  // greeting already rides, at the same threshold.
  for (const scale of [LARGEST_STANDARD, ...AX_SIZES]) {
    assert.equal(detailTitleTrimmed(scale), false, `still trimmed at ${scale}`);
  }
});

// ---------------------------------------------------------------------------
// The look's own words
// ---------------------------------------------------------------------------

test('the look name and descriptor keep their two-line clamp at standard sizes', () => {
  assert.equal(lookTextMaxLines(DEFAULT), 2);
  assert.equal(lookTextMaxLines(1.2), 2);
});

test('the clamp lifts entirely at the accessibility sizes', () => {
  // `undefined`, not a bigger number: a clamp of three is the same bug two
  // steps further up, and the packet's rule is that nothing is truncated. The
  // card grows and the page scrolls.
  for (const scale of AX_SIZES) {
    assert.equal(lookTextMaxLines(scale), undefined, `still clamped at ${scale}`);
  }
});

// ---------------------------------------------------------------------------
// The two actions
// ---------------------------------------------------------------------------

test('the look actions share a row while two labels fit one measure', () => {
  assert.equal(lookActionsStacked(DEFAULT), false);
  assert.equal(lookActionsStacked(1.35), false);
});

test('the look actions stack at the app’s one stacking threshold and above', () => {
  // Half a measure each is where "Share another" stops fitting its ground.
  // Stacked, each pill has the full width and wraps inside itself.
  for (const scale of [1.5, ...AX_SIZES]) {
    assert.equal(lookActionsStacked(scale), true, `still side by side at ${scale}`);
  }
});

test('no decision on this page ever answers by shrinking text', () => {
  // The whole surface of the module, checked for the one answer that is
  // forbidden: every function returns a composition or a clamp, never a font
  // size or a scale factor.
  const source = readFileSync('src/features/events/detail-layout.ts', 'utf8');
  assert.doesNotMatch(source, /fontSize|maxFontSizeMultiplier|scaleFactor|adjustsFontSize/);
});

// ---------------------------------------------------------------------------
// The scroll itself
// ---------------------------------------------------------------------------
//
// A ScrollView's flex cannot be expressed as a pure function, and this is the
// cause of most of what acceptance saw — so it is pinned at source level, in
// both the page and the fixture that photographs it. Item detail records the
// same hazard in its own comment: with no flex in a flex column, a ScrollView
// measures against its content rather than the viewport, and a page that
// outgrows the screen is then clipped with nothing to scroll.

/**
 * The props of every `<ScrollView …>` opening tag in a file.
 *
 * Parsed rather than pattern-matched across a window: a distance bound between
 * the tag and the prop is a guess about how much COMMENTARY sits between them,
 * and the first draft of this file guessed 600 characters and failed the
 * moment the fix was explained in place. Comments are stripped and the tag is
 * read to its own `>`, so the assertion is about the props themselves and
 * stays true however the file is documented.
 */
function scrollViewTags(source: string): string[] {
  return source
    .split('<ScrollView')
    .slice(1)
    .map((rest) => {
      const withoutComments = rest
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      const end = withoutComments.indexOf('>');
      return end === -1 ? withoutComments : withoutComments.slice(0, end);
    });
}

/**
 * SUPERSEDED BY REDESIGN 03 — in owner and in spelling, not in substance.
 *
 * The scroll view moved from the route to `event-detail-body.tsx` when the
 * page was split, and with it the whole reason this test exists: the poster
 * pins a band above and a foot below, and the region between them is the one
 * that has to give. So the flex is now expressed as a `style` on that region
 * rather than a `className` on a full-page scroller, and the property being
 * pinned is the same one — a ScrollView with no flex in a flex column measures
 * against its CONTENT rather than the viewport, and at the accessibility sizes
 * the page then grows past the screen with nothing left to scroll.
 *
 * The LP-04 capture route it also pinned is gone: `dev-lp04-detail` and
 * `dev-event-detail` photographed a composition built from `FactRow`,
 * `NavRow` and `StatePill`, none of which exists any more. The six accepted
 * frames are posed by `dev-ed-01…06` out of `event-detail-fixtures.ts`, and
 * they render the SAME component the route renders — which is a stronger
 * guarantee than a fixture that merely copied the page's scroll props.
 */
test('the event detail page scrolls against the viewport, not its content', () => {
  const body = readFileSync('src/components/events/event-detail-body.tsx', 'utf8');
  const tags = scrollViewTags(body);

  /**
   * TWO SCROLL VIEWS NOW, AND THE SECOND ONE IS HORIZONTAL.
   *
   * This used to assert exactly one, and that number was standing in for the
   * rule rather than being it: the rule is that the page's VERTICAL scrolling
   * region measures against the viewport rather than against its own content,
   * which is the failure that clipped LP-09's page at AX5 and is the failure
   * the founder reported again at the foot. A rail of look options paging
   * sideways inside that region cannot cause it — it scrolls on the other axis
   * and states no vertical flex at all.
   *
   * So the assertion is now the rule: there is exactly one vertical scroll
   * view, it carries the flex bargain, and every other one is `horizontal`.
   */
  const vertical = tags.filter((tag) => !/\bhorizontal\b/.test(tag));
  assert.equal(vertical.length, 1, 'the poster should have exactly one vertical scrolling region');
  assert.match(vertical[0]!, /style=\{\{ flex: 1, minHeight: 0 \}\}/);
  for (const tag of tags.filter((t) => /\bhorizontal\b/.test(t))) {
    assert.doesNotMatch(tag, /flex: 1/, 'a horizontal rail claimed the column’s flex');
  }
});

test('the foot rides the scroll and clears the home indicator', () => {
  // The founder's item 6: "Plan a look" and the door down were pinned under
  // the scroll and partly cut off. A pinned bar can only be right when its
  // height is knowable, and this one holds up to four controls whose labels
  // grow with Dynamic Type — so it is in the scroll, and what keeps it off the
  // home indicator is the content inset rather than a guess.
  const body = readFileSync('src/components/events/event-detail-body.tsx', 'utf8');
  assert.match(body, /paddingBottom: insets\.bottom \+ FOOT_PAD_BOTTOM/);
  assert.match(body, /useSafeAreaInsets\(\)/, 'the foot guesses at the indicator');

  // And the door down is drawn ONCE. It used to be drawn twice — in the pinned
  // bar at standard sizes and in the scroll at the accessibility ones, because
  // the bar had no room — which meant two call sites to keep in step.
  assert.equal(
    (body.match(/<CommentsRow /g) ?? []).length,
    1,
    'the door down is drawn in two places again',
  );
});

test('the accepted frames are posed from the component the route draws', () => {
  // Otherwise a fixture is a picture of a screen that does not exist, and the
  // next acceptance pass photographs a clip the product does not have — or
  // worse, misses one it does.
  for (const frame of ['01-default', '02-empty', '03-loading', '04-error', '06-ax']) {
    const fixture = readFileSync(`src/dev-fixtures/dev-ed-${frame}.tsx`, 'utf8');
    assert.match(fixture, /<EventDetailBody/, `dev-ed-${frame} does not draw the real body`);
    assert.match(fixture, /EVENT_DETAIL_POSES/, `dev-ed-${frame} invents its own pose`);
  }
  // And the AX frame is posed at the AX composition, not merely named for it.
  assert.match(readFileSync('src/dev-fixtures/dev-ed-06-ax.tsx', 'utf8'), /large=\{true\}/);
});

test('the page reads the reader’s setting rather than assuming one', () => {
  const page = readFileSync('src/app/event/[id]/index.tsx', 'utf8');
  assert.match(page, /useWindowDimensions\(\)/);
  // One threshold, the app's own, rather than a number typed on this page.
  assert.match(page, /fontScale >= AX_STACK_SCALE/);

  // THE TRIM IS GONE, and its absence is now the thing being kept.
  //
  // `detailTitleTrimmed` existed because LP-04 set the title as a single line
  // at the default size and the cap-trim was right there. The poster's name
  // WRAPS at the default size — two lines, in the accepted frame — and `trim`
  // subtracts a margin sized for one line, which is precisely the failure the
  // function was written to prevent. The frames replace it with the opposite
  // instruction: a few points of tail so the descenders clear.
  const body = readFileSync('src/components/events/event-detail-body.tsx', 'utf8');
  assert.doesNotMatch(body, /variant="display"[^>]*\btrim\b/, 'the poster name was trimmed');
  assert.match(body, /paddingBottom: large \? 6 : 4/, 'the name lost its descender tail');
});
