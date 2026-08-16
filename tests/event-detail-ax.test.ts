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

/** The tag that draws the page body — the one holding the content padding. */
function bodyScrollView(source: string): string | undefined {
  return scrollViewTags(source).find((tag) => tag.includes('contentContainerClassName'));
}

test('the event detail page scrolls against the viewport, not its content', () => {
  const body = bodyScrollView(readFileSync('src/app/event/[id]/index.tsx', 'utf8'));
  assert.ok(body, 'no body ScrollView found on the event detail page');
  assert.match(body, /className="flex-1"/);
});

test('the LP-04 capture route scrolls the same way the page does', () => {
  // Otherwise the fixture is a picture of a screen that does not exist, and
  // the next acceptance pass photographs a clip the product does not have —
  // or worse, misses one it does.
  const fixture = readFileSync('src/dev-fixtures/dev-lp04-detail.tsx', 'utf8');
  const body = bodyScrollView(fixture);
  assert.ok(body, 'no body ScrollView found in the LP-04 fixture');
  assert.match(body, /className="flex-1"/);
  assert.match(body, /contentContainerClassName="px-gutter pb-16"/);
  // The scenario rail's 48pt cap clipped its own pills at AX5.
  assert.doesNotMatch(fixture, /max-h-12/);
});

test('the page reads the reader’s setting rather than assuming one', () => {
  const page = readFileSync('src/app/event/[id]/index.tsx', 'utf8');
  assert.match(page, /useWindowDimensions\(\)/);
  assert.match(page, /trim=\{detailTitleTrimmed\(fontScale\)\}/);
  // The bare `trim` that shipped is the regression; it must not come back.
  assert.doesNotMatch(page, /<Text\s+variant="title"\s+trim\s/);
});
