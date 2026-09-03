/**
 * Redesign 21 — The Ten's geometry, its two recompositions, and the band and
 * foot the frames added.
 *
 * These are the rules a component would otherwise state as magic numbers. The
 * directive is explicit that larger type is solved "with height, wrapping and
 * recomposition — never by capping the scale further or adding ellipses", and a
 * rule stated only inside a `<View style>` is a rule nothing can hold.
 *
 * The five grid rules here succeed the five in `w3-g1-ten-layout.test.ts`; see
 * the header of that file for what moved and why.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import {
  tenActionLabel,
  tenBandCopy,
  tenSecondaryLabel,
  tenSubtitle,
  tenthWellLabel,
  TEN_TITLE,
  type TenPhase,
} from '../src/features/onboarding/ten-copy';
import { emptyTen } from '../src/features/onboarding/ten-slots';
import {
  BAND_HEIGHT,
  BAND_PAD_H,
  CTA_HEIGHT,
  PIP_GAP,
  PLATE_ACTION_HEIGHT,
  SHORT_DEVICE_HEIGHT,
  TEN,
  TEN_AX_FONT_SCALE,
  TRAY_COLUMNS,
  TRAY_COLUMNS_AX,
  TRAY_GAP,
  TRAY_ROW_GAP,
  bandTone,
  isAccessibilityScale,
  pipWidth,
  tenMeasure,
  tenthHeight,
  trayRows,
  wellFillIndex,
  wellHeight,
  wellWidth,
} from '../src/features/onboarding/ten-spec';
import { contrastRatio } from '../src/theme/contrast';
import { light } from '../src/theme/palette';
import { MIN_TAP_TARGET } from '../src/theme/metrics';

/** The frames' own phone: 393pt wide, 20pt gutters. */
const CONTENT = 393 - 40;
const STANDARD = tenMeasure({ fontScale: 1, height: 852 });
const LARGE = tenMeasure({ fontScale: 1.8, height: 852 });
const SHORT = tenMeasure({ fontScale: 1, height: 667 });

const SPACING = [1, 8, 12, 20, 24, 28, 44];
const AA_TEXT = 4.5;

/**
 * The source with its prose removed.
 *
 * Every assertion below that forbids a construct — a hex literal, a
 * `flexBasis` — has to read the CODE, because the comments in these files
 * discuss both by name: the dialect note quotes the frame's amber so a reader
 * can see which value was refused, and the tray note quotes the flex bug it
 * forecloses. A census that counts those is a rule nobody can document.
 */
const code = (raw: string) =>
  raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const PARTS_RAW = readFileSync('src/components/onboarding/ten-parts.tsx', 'utf8');
const BODY_RAW = readFileSync('src/components/onboarding/ten-body.tsx', 'utf8');
const SPEC_RAW = readFileSync('src/features/onboarding/ten-spec.ts', 'utf8');
const ROUTE_RAW = readFileSync('src/app/the-ten.tsx', 'utf8');

// ---------------------------------------------------------------------------
// The tray
// ---------------------------------------------------------------------------

test('the tray is three-up at every ordinary type size, two-up above the threshold', () => {
  for (const scale of [1, 1.1, 1.2, 1.34]) {
    assert.equal(tenMeasure({ fontScale: scale, height: 852 }).columns, TRAY_COLUMNS, `at ${scale}`);
    assert.equal(isAccessibilityScale(scale), false, `at ${scale}`);
  }
  // The threshold itself crossed over from `ten-layout.ts` unchanged: iOS's five
  // accessibility sizes begin exactly here on the current device table, and the
  // boundary must not have gone unpinned when the module was replaced.
  for (const scale of [TEN_AX_FONT_SCALE, 1.5, 1.8]) {
    assert.equal(
      tenMeasure({ fontScale: scale, height: 852 }).columns,
      TRAY_COLUMNS_AX,
      `at ${scale}`,
    );
    assert.equal(isAccessibilityScale(scale), true, `at ${scale}`);
  }
});

test('the well is PORTRAIT — the reversal redesign 21 turns on', () => {
  const w = wellWidth(CONTENT, STANDARD.columns);
  assert.equal(Math.round(w), 110, 'the frames’ own measured column');
  // Taller than it is wide, which the shipped 86/111 cell was not. The height
  // that costs is bought back by the tenth well spanning the tray instead of
  // taking a cell with two holes beside it — so the whole tray still lands
  // above the fold, which was the only argument for the landscape cell.
  assert.ok(wellHeight(w, STANDARD) > w);
  assert.equal(wellHeight(w, STANDARD), Math.round(w * (127 / 110)));
  // And the spanning tenth is shorter than the nine above it, so it reads as a
  // closing band rather than as a second tray.
  assert.ok(tenthHeight(wellHeight(w, STANDARD)) < wellHeight(w, STANDARD));
});

test('at accessibility sizes the well flattens rather than filling the screen', () => {
  const wide = wellWidth(CONTENT, LARGE.columns);
  assert.ok(wide > wellWidth(CONTENT, STANDARD.columns));
  // Two columns make each well 60% wider; at the portrait ratio that is a
  // 195pt-tall cell and one well per screenful. The frames flatten it instead —
  // recomposition, not a cap, and nothing is scaled below its documented size.
  assert.ok(wellHeight(wide, LARGE) < wide);
});

test('both gaps are on the spacing scale, and the column arithmetic accounts for them', () => {
  assert.ok(SPACING.includes(TRAY_GAP), `TRAY_GAP ${TRAY_GAP}`);
  assert.ok(SPACING.includes(TRAY_ROW_GAP), `TRAY_ROW_GAP ${TRAY_ROW_GAP}`);
  assert.equal(wellWidth(CONTENT, 3) * 3 + TRAY_GAP * 2, CONTENT);
  assert.equal(wellWidth(CONTENT, 2) * 2 + TRAY_GAP, CONTENT);
});

test('the tray is REAL ROWS, and the tenth spans the last of them', () => {
  const rows = trayRows(10, STANDARD);
  assert.deepEqual(rows, [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9],
  ]);
  // Every index exactly once, in order — a row-builder that drops or repeats a
  // well is the one bug this shape can still have.
  assert.deepEqual(rows.flat(), [...Array(10).keys()]);
});

test('at accessibility sizes the tenth stops spanning, because there is no remainder to close', () => {
  const rows = trayRows(10, LARGE);
  assert.equal(rows.length, 5);
  for (const row of rows) assert.equal(row.length, 2);
  assert.equal(LARGE.wideTenth, false);
  assert.deepEqual(rows.flat(), [...Array(10).keys()]);
});

test('the row builder holds for a tray of any length', () => {
  // Ten is never typed into the geometry: `trayRows` takes the slot list's own
  // length, so a tier that moved would relayout rather than mislay a well.
  for (const total of [1, 2, 4, 7, 10, 13]) {
    const rows = trayRows(total, STANDARD);
    assert.deepEqual(rows.flat(), [...Array(total).keys()], `total ${total}`);
  }
  // And the slot list IS the free closet, so the ten the frames draw is real.
  assert.equal(emptyTen().length, PLANS.free.items);
});

test('the two sand steps alternate by ROW, never by cell', () => {
  // Per cell it makes a chequerboard, which the eye reads as meaning something.
  assert.equal(wellFillIndex(0), 0);
  assert.equal(wellFillIndex(1), 1);
  assert.equal(wellFillIndex(2), 0);
  assert.notEqual(TEN.wellFilled, TEN.wellFilledAlt);
  // And an empty well is LIGHTER than the tray it sits on — a hole, not a tile.
  assert.notEqual(TEN.wellEmpty, light.tray);
});

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

test('the pips are derived, so ten of them fill the band on any device width', () => {
  for (const width of [320, 353, 393, 440]) {
    const inner = width - BAND_PAD_H * 2;
    const pip = pipWidth(inner, 10);
    assert.ok(pip > 0, `at ${width}`);
    // Ten pips plus their nine gaps, to a floating-point hair.
    assert.ok(Math.abs(pip * 10 + PIP_GAP * 9 - inner) < 1e-9, `at ${width}`);
  }
});

test('the band takes three grounds, and `complete` fires on the COUNT, not on readiness', () => {
  assert.equal(bandTone(0, 10), 'empty');
  assert.equal(bandTone(1, 10), 'filling');
  assert.equal(bandTone(9, 10), 'filling');
  assert.equal(bandTone(10, 10), 'complete');
  // Ten wells taken is a fact about the tray. Whether those ten make an outfit
  // is a different claim, made by the subtitle and the repair plate — conflating
  // them is how the shipped screen once told ten watches it was ready.
  assert.equal(bandTone(10, 10), bandTone(10, 10));
});

test('the band writes its count in WORDS, and never types a ten', () => {
  assert.equal(tenBandCopy(0, 10, 'filling').label, 'NONE OF TEN');
  assert.equal(tenBandCopy(4, 10, 'filling').label, 'FOUR OF TEN');
  assert.equal(tenBandCopy(10, 10, 'ready').label, 'TEN OF TEN');
  // `zero` is a quantity in an arithmetic sentence; an untouched tray is naming
  // an absence, and the frames write it as one.
  assert.doesNotMatch(tenBandCopy(0, 10, 'filling').label, /ZERO/);
  // A grid of a different size prints a different word rather than a lie.
  assert.equal(tenBandCopy(3, 6, 'filling').label, 'THREE OF SIX');
  assert.doesNotMatch(tenBandCopy(3, 6, 'filling').label, /TEN/);
});

test('the trailing status names the phase, and `unready` gets no word at all', () => {
  assert.equal(tenBandCopy(4, 10, 'filling').trailing, 'Six to go');
  assert.equal(tenBandCopy(9, 10, 'filling').trailing, 'One to go');
  assert.equal(tenBandCopy(4, 10, 'settling').trailing, 'Settling');
  assert.equal(tenBandCopy(10, 10, 'ready').trailing, 'Ready');
  assert.equal(tenBandCopy(10, 10, 'swapped').trailing, 'Swapped');
  // Every candidate for it is a verdict, and the verdict is the repair plate's
  // to deliver in a full sentence directly underneath.
  assert.equal(tenBandCopy(10, 10, 'unready').trailing, null);
});

test('the band speaks as one object, in a sentence', () => {
  // Read as twelve elements it is the same fact three times, the last of it as
  // "dimmed, dimmed, dimmed".
  const copy = tenBandCopy(4, 10, 'filling');
  assert.match(copy.announcement, /Four of ten filed/);
  assert.match(copy.announcement, /Six to go/);
  assert.doesNotMatch(copy.announcement, /\d/, 'no numerals in the spoken band');
});

// ---------------------------------------------------------------------------
// The masthead and the foot
// ---------------------------------------------------------------------------

test('the title is the frames’ own, spelled', () => {
  assert.equal(TEN_TITLE, 'The ten');
  // The numeral it replaced had nothing left to agree with: the count beside it
  // is now written in words on the band.
  assert.doesNotMatch(TEN_TITLE, /\d/);
});

test('the supporting line moves with the tray, and is one sentence', () => {
  const at = (filled: number, phase: TenPhase = 'filling') =>
    tenSubtitle({ filled, total: 10, phase });
  assert.equal(at(0), 'Ten pieces is enough to start.');
  assert.equal(at(4), 'Ten pieces is enough to start.');
  // Near the end it stops being about the plan and starts being about the gap.
  assert.equal(at(9), 'One well still open.');
  assert.equal(at(8), 'Two wells still open.');
  assert.equal(at(10, 'ready'), 'Enough to dress you tomorrow.');
  assert.equal(at(10, 'unready'), 'Every well is taken.');
  for (const filled of [0, 4, 9, 10]) {
    for (const phase of ['filling', 'settling', 'ready', 'unready', 'swapped'] as TenPhase[]) {
      const line = tenSubtitle({ filled, total: 10, phase });
      assert.equal(line.split('. ').length, 1, `${filled}/${phase}: ${line}`);
      assert.doesNotMatch(line, /\d/, `${filled}/${phase} types a numeral`);
    }
  }
});

test('the settling line names the piece when it can, and generalises when it cannot', () => {
  assert.equal(
    tenSubtitle({ filled: 4, total: 10, phase: 'settling', name: 'Camel shirt' }),
    'Filing the camel shirt.',
  );
  // The classifier not having a name yet is ordinary, not an error — so the
  // fallback is the same sentence with its subject generalised.
  assert.equal(
    tenSubtitle({ filled: 4, total: 10, phase: 'settling' }),
    'Filing the newest piece.',
  );
});

test('the capsule’s LABEL is the argument, and it changes four times across the run', () => {
  const at = (filled: number, phase: TenPhase = 'filling') =>
    tenActionLabel({ filled, total: 10, phase });
  assert.equal(at(0), 'Photograph a piece');
  assert.equal(at(4), 'Add the next');
  assert.equal(at(9), 'Add the last one');
  assert.equal(at(10, 'ready'), 'See your first outfits');
  assert.equal(at(4, 'settling'), 'Filing…');
  // Ten filed and not styleable draws NO page action: `TenRepair` is on screen
  // with the only action that helps, and a second capsule beside it would be
  // offering an eleventh photograph to a closet whose problem is not the number
  // of photographs in it.
  assert.equal(at(10, 'unready'), null);
});

test('there is one quiet action under it, never a second capsule', () => {
  assert.equal(tenSecondaryLabel({ filled: 4, total: 10, phase: 'filling' }), 'Choose from your library');
  assert.equal(tenSecondaryLabel({ filled: 10, total: 10, phase: 'ready' }), 'Add another piece');
  assert.equal(tenSecondaryLabel({ filled: 4, total: 10, phase: 'settling' }), null);
  assert.equal(tenSecondaryLabel({ filled: 10, total: 10, phase: 'unready' }), null);
});

test('the spanning tenth names its own position', () => {
  assert.equal(tenthWellLabel(10), 'Tenth piece');
  assert.equal(tenthWellLabel(6), 'Sixth piece');
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

test('the accessibility composition takes both of its decisions together', () => {
  assert.equal(LARGE.large, true);
  assert.equal(LARGE.columns, TRAY_COLUMNS_AX);
  assert.equal(LARGE.wideTenth, false);
  // "Six to go" goes: it is the count said twice, and at AX the two of them
  // collide in a 54pt band. The remaining count survives in the spoken label.
  assert.equal(LARGE.bandTrailing, false);
  assert.match(tenBandCopy(4, 10, 'filling').announcement, /Six to go/);
  // A two-column tray under a band still printing its trailing status is worse
  // than either composition alone — one threshold, one answer.
  assert.equal(STANDARD.bandTrailing, true);
  assert.equal(STANDARD.wideTenth, true);
});

test('a short screen sets its type one step down, and a large one never does', () => {
  assert.equal(SHORT.short, true);
  assert.ok(SHORT.titleSize < STANDARD.titleSize);
  assert.ok(SHORT.subSize < STANDARD.subSize);
  // The short frame keeps the three-up tray and the spanning tenth.
  assert.equal(SHORT.columns, TRAY_COLUMNS);
  assert.equal(SHORT.wideTenth, true);
  // A short screen at a large text size is the LARGE composition, not a third
  // one: shrinking type in response to somebody asking for larger type is the
  // one move the accessibility note forbids outright.
  const both = tenMeasure({ fontScale: 1.8, height: 667 });
  assert.equal(both.short, false);
  assert.ok(both.titleSize > STANDARD.titleSize);
  assert.equal(SHORT_DEVICE_HEIGHT, 700);
});

test('nothing the type scale touches ever shrinks', () => {
  assert.ok(LARGE.titleSize >= STANDARD.titleSize);
  assert.ok(LARGE.subSize > STANDARD.subSize);
  assert.ok(LARGE.ctaLabelSize > STANDARD.ctaLabelSize);
  assert.ok(LARGE.ctaHeight > STANDARD.ctaHeight);
  assert.ok(LARGE.secondaryHeight > STANDARD.secondaryHeight);
});

// ---------------------------------------------------------------------------
// The laws every page in this program is held to
// ---------------------------------------------------------------------------

test('every control clears the 44pt floor, at both compositions', () => {
  for (const m of [STANDARD, LARGE, SHORT]) {
    assert.ok(m.ctaHeight >= MIN_TAP_TARGET, 'the capsule');
    assert.ok(m.secondaryHeight >= MIN_TAP_TARGET, 'the quiet action');
  }
  assert.ok(PLATE_ACTION_HEIGHT >= MIN_TAP_TARGET, 'a plate’s pill');
  // And the capsule is the directive's 56, not a 48 that happens to pass.
  assert.equal(CTA_HEIGHT, 56);
  // The band is not a control and is not held to the floor — it is a report.
  assert.ok(BAND_HEIGHT < MIN_TAP_TARGET + 20);
});

test('no weight, anywhere — the emphasis is size, colour and case', () => {
  for (const [name, raw] of [
    ['ten-parts.tsx', PARTS_RAW],
    ['ten-body.tsx', BODY_RAW],
    ['ten-spec.ts', SPEC_RAW],
  ] as const) {
    assert.ok(!/fontWeight/.test(code(raw)), `${name} declares a fontWeight`);
    assert.ok(!/font-(?:medium|semibold|bold)\b/.test(raw), `${name} names a weight utility`);
  }
});

test('the dialect is four values, and every one of them is a well or a pip', () => {
  // Everything else the frames draw is a palette token reached through
  // `useTheme()`. A dialect that grows is a second palette.
  assert.deepEqual(Object.keys(TEN).sort(), [
    'pipSpent',
    'wellEmpty',
    'wellFilled',
    'wellFilledAlt',
  ]);
  // And no component types a hex of its own.
  for (const [name, raw] of [
    ['ten-parts.tsx', PARTS_RAW],
    ['ten-body.tsx', BODY_RAW],
  ] as const) {
    assert.ok(!/#[0-9A-Fa-f]{6}/.test(code(raw)), `${name} types a hex literal`);
  }
});

test('the contrast law holds on all three band grounds', () => {
  // The label and the trailing status are 13pt and 15pt tracked lines — never
  // large text, so the 4.5 floor applies to every one of them.
  assert.ok(contrastRatio(light.muted, light.tray) >= AA_TEXT, 'empty band label');
  assert.ok(contrastRatio(light.accent, light.blush) >= AA_TEXT, 'filling band label');
  assert.ok(contrastRatio(light.muted, light.blush) >= AA_TEXT, 'filling band trailing');
  assert.ok(contrastRatio(light.canvas, light.accent) >= AA_TEXT, 'complete band label');
  // The empty band is `tray`, NOT the frame's #EAE5DB (`sand`) — on sand the
  // same label is 4.51:1, close enough to the floor that a rounding of either
  // value would break it.
  assert.ok(
    contrastRatio(light.muted, light.tray) > contrastRatio(light.muted, light.sand),
    'tray is the safer of the two grounds',
  );
  // Clay is never type: the tenth well's word is muted or accent, never accentWarm.
  assert.ok(!PARTS_RAW.includes('theme.accentWarm'), 'clay is drawn, never set');
});

test('the filled controls paint their ground on an animated view, not on the Pressable', () => {
  // The house pattern (`use-press-feedback.ts`): the Pressable is the hit target
  // and carries only its height; the ground is inline OBJECT styles on an
  // `Animated.View`. A function `style` on the Pressable is what once rendered
  // the tour's CTA as a bare label with no capsule under it.
  assert.ok(
    !/style=\{\(\{ pressed \}\)/.test(PARTS_RAW),
    'no control may resolve its ground through a style function',
  );
  assert.match(PARTS_RAW, /const press = usePressFeedback\(/);
  assert.match(PARTS_RAW, /backgroundColor: disabled \? theme\.sand : theme\.accent,/);
  assert.match(PARTS_RAW, /borderRadius: measure\.ctaHeight \/ 2,/);
});

test('a well is only ever a direct child of a ROW', () => {
  // The bug this forecloses: `flex: 1` and `height` on one view agree only when
  // the flex axis is horizontal, and React Native does not subtract `gap` from a
  // percentage `flexBasis`, so three cells plus two gaps overflow.
  assert.ok(!code(PARTS_RAW).includes('flexBasis'), 'wells divide a row, never a percentage basis');
  assert.ok(!code(PARTS_RAW).includes("flexWrap: 'wrap'"), 'the tray is rows, not a wrapped run');
  assert.match(PARTS_RAW, /flexDirection: 'row',/);
});

test('reduced motion drops the settle and keeps the tree', () => {
  // The composition is identical with the setting on; what goes is the cutout's
  // fade. The pressed depression is `usePressFeedback`, which carries
  // `ReduceMotion.System` by construction — so the press still ARRIVES with the
  // setting on, it simply arrives without the tween.
  assert.match(PARTS_RAW, /useReducedMotion\(\)/);
  assert.match(PARTS_RAW, /entering=\{reduced \? undefined : FadeIn/);
  // Keyed on the image's PATH so it plays when the cutout first resolves and
  // never again — not on a re-render, and not on the hourly re-sign of the
  // URL either. Keying on the whole URI replayed the fade (and remounted the
  // tile) every time the signed token rotated (2026-09-02 audit).
  assert.match(PARTS_RAW, /key=\{imageUri\.split\('\?'\)\[0\]\}/);
  // Nothing else on this page translates, scales or staggers.
  assert.ok(!/withRepeat|translateY|translateX/.test(PARTS_RAW));
});

// ---------------------------------------------------------------------------
// What redesign 21 was forbidden to touch
// ---------------------------------------------------------------------------

test('the replacement machine is untouched — the route still owns all four writes', () => {
  // The brief lists the slot replacement flow under "keep". The reducer, its
  // phases and the four mutations the route performs for it are the shipped
  // ones; this pins that the restyle did not quietly move a write into a
  // component or drop a phase.
  for (const phase of ['freeing', 'processing', 'retiring', 'restoring']) {
    assert.match(ROUTE_RAW, new RegExp(`replace\\.phase !== '${phase}'`), phase);
  }
  assert.match(ROUTE_RAW, /archive\.mutateAsync/);
  assert.match(ROUTE_RAW, /restore\.mutateAsync/);
  assert.match(ROUTE_RAW, /sweepOrphan/);
  assert.match(ROUTE_RAW, /applyReplace/);
});

test('the storage-full doors still go where they always went', () => {
  // Routing contract, not styling: Storage and the one placement whose whole
  // contract is a closet the server has already refused.
  assert.match(ROUTE_RAW, /router\.push\('\/storage' as Href\)/);
  assert.match(ROUTE_RAW, /gate\.present\(Placement\.AddGarmentOverLimit\)/);
  // And the ceiling is still checked BEFORE the camera opens, so the flow never
  // asks for a photograph it could not keep.
  assert.match(ROUTE_RAW, /if \(capacity\.storageFull\) \{\n\s*dispatchReplace\(\{ type: 'room-refused' \}\);/);
});

test('readiness is still read from the closet, never from the tray', () => {
  // A hoodie shot into the third well is a `mid_layer`; this screen has no
  // opinion of its own to disagree with. The band reports the count and the
  // subtitle reports the verdict, and only the second of those reads this.
  assert.match(ROUTE_RAW, /starterReadiness\(wardrobe\.data \?\? \[\]\)/);
  assert.ok(!BODY_RAW.includes('starterReadiness'), 'the page never computes readiness');
});
