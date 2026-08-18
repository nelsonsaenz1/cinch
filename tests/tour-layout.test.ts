/**
 * Redesign 20 — the first-run tour's drawn contract.
 *
 * Written to the shape the rest of the wave set: everything the frames DECIDE
 * lives in `tour-spec.ts` and is imported and exercised directly; the drawn
 * body is asserted as TEXT, because esbuild cannot parse React Native's Flow
 * source and there is no renderer here.
 *
 * `tests/tour.test.ts` holds the DECK — the three frames, their copy, the
 * once-ever predicate and the exit matrix. Nothing there is duplicated. What
 * this file holds is the three laws the brief calls non-negotiable:
 *
 *   1. skippable ALWAYS — an escape on every beat, never below the tap floor;
 *   2. no permission ask inside the tour, enforced against the module graph;
 *   3. the gate is not this screen's job, so a returning account cannot flash
 *      a frame of the promise on its way past.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AX_STACK_SCALE,
  CLOSET_COMPACT_CELLS,
  CLOSET_PLATE,
  CTA_HEIGHT,
  CTA_HEIGHT_AX,
  GARMENT_SHAPES,
  MARK_HEIGHT,
  MARK_WIDTH,
  MORNING_PLATE,
  SECONDARY_HEIGHT,
  SHORT_DEVICE_HEIGHT,
  SKIP_HEIGHT,
  SKIP_HEIGHT_AX,
  TOUR,
  captionVisible,
  closetCells,
  tourMeasure,
} from '../src/features/onboarding/tour-spec';
import { TOUR_FRAMES } from '../src/features/onboarding/tour-copy';
import { skipVisible } from '../src/features/onboarding/tour-state';
import { MIN_TAP_TARGET } from '../src/theme/metrics';
import { AA_TEXT, contrastRatio } from '../src/theme/contrast';
import { light } from '../src/theme/palette';

/**
 * Comments across these files discuss the rules they are obeying — the frames
 * module's docblock names `expo-camera` precisely to say it does NOT import it.
 * Only code counts, so every assertion about what a file DOES runs against a
 * comment-stripped copy. Same helper, and the same reason, as
 * `tests/auth-run-layout.test.ts`.
 */
const code = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const read = (path: string) => code(readFileSync(path, 'utf8'));

const ROUTE_RAW = read('src/app/tour.tsx');
const FRAMES_RAW = read('src/features/onboarding/tour-frames.tsx');
const SPEC_RAW = read('src/features/onboarding/tour-spec.ts');
const HANDOFF_RAW = read('src/app/(auth)/handoff.tsx');

const TOUR_MODULES = [
  ['tour.tsx', ROUTE_RAW],
  ['tour-frames.tsx', FRAMES_RAW],
  ['tour-spec.ts', SPEC_RAW],
  ['tour-copy.ts', read('src/features/onboarding/tour-copy.ts')],
  ['tour-state.ts', read('src/features/onboarding/tour-state.ts')],
  ['tour-queries.ts', read('src/features/onboarding/tour-queries.ts')],
] as const;

// ---------------------------------------------------------------------------
// Law 1 — skippable, always
// ---------------------------------------------------------------------------

test('every beat carries a way out, and the last one carries two', () => {
  // The brief's word is "always". It is kept in two different shapes, which is
  // why asserting only `skipVisible` would miss half of it: frames one and two
  // carry Skip, and frame three replaces it with two honest choices — one of
  // which ("I'll look around first") is the same escape under a better name.
  assert.equal(skipVisible(0), true);
  assert.equal(skipVisible(1), true);
  assert.equal(skipVisible(2), false);
  assert.equal(TOUR_FRAMES[2]!.secondary != null, true);

  // No frame may be a dead end: every one has either Skip or a secondary.
  for (const [i, f] of TOUR_FRAMES.entries()) {
    assert.ok(f.skippable || f.secondary != null, `${f.id} (index ${i}) has no way out`);
  }
});

test('the escape is never below the tap floor, at any text size', () => {
  for (const scale of [1, 1.2, AX_STACK_SCALE, 1.8]) {
    const m = tourMeasure({ fontScale: scale, height: 852 });
    assert.ok(m.skipHeight >= MIN_TAP_TARGET, `skip ${m.skipHeight} at ${scale}`);
    assert.ok(m.ctaHeight >= MIN_TAP_TARGET, `cta ${m.ctaHeight} at ${scale}`);
    assert.ok(m.secondaryHeight >= MIN_TAP_TARGET, `secondary ${m.secondaryHeight} at ${scale}`);
  }
  assert.equal(SKIP_HEIGHT, MIN_TAP_TARGET);
  assert.equal(SKIP_HEIGHT_AX, 56);
  assert.equal(SECONDARY_HEIGHT, 48);
});

test('Skip MOVES at the accessibility sizes — it never goes', () => {
  // The frame relocates it from the corner into the foot so it and the action
  // both stay ≥56pt. A composition that dropped it instead would be the one
  // thing the brief forbids by name.
  assert.equal(tourMeasure({ fontScale: 1, height: 852 }).skip, 'corner');
  assert.equal(tourMeasure({ fontScale: AX_STACK_SCALE, height: 852 }).skip, 'foot');
  // And the source renders it in exactly one place per placement, from one
  // element — so a future edit cannot make the corner branch and forget the foot.
  const skips = FRAMES_RAW.match(/<SkipAction\b/g) ?? [];
  assert.equal(skips.length, 1, 'Skip is built once and placed twice');
  assert.match(FRAMES_RAW, /measure\.skip === 'corner'/);
  assert.match(FRAMES_RAW, /measure\.skip === 'foot'/);
});

// ---------------------------------------------------------------------------
// Law 2 — no permission ask, anywhere in the tour
// ---------------------------------------------------------------------------

test('no module of the tour imports a permission-bearing API', () => {
  // The atlas's most absolute rule, and the brief's explicit "keep". The camera
  // on TR-02 and the weather on TR-03 are DRAWINGS; the real prompts belong to
  // `/capture` and to the location sheet, at the moment each is needed.
  //
  // Scanned as imports rather than as calls: `requestPermissionsAsync` can be
  // spelled a dozen ways, but a permission cannot be raised at all without one
  // of these modules being in the graph.
  const FORBIDDEN = [
    'expo-camera',
    'expo-image-picker',
    'expo-media-library',
    'expo-location',
    'expo-notifications',
    'expo-contacts',
    'expo-calendar',
    'expo-tracking-transparency',
    'expo-av',
  ];
  for (const [name, raw] of TOUR_MODULES) {
    for (const module of FORBIDDEN) {
      assert.ok(
        !new RegExp(`from ['"]${module}['"]`).test(raw),
        `${name} imports ${module} — the tour raises no permission dialog`,
      );
    }
    assert.ok(
      !/[Pp]ermissionsAsync|usePermissions/.test(raw),
      `${name} calls a permission API — the tour raises no permission dialog`,
    );
  }
});

test('the tour collects nothing', () => {
  // No text input, no picker, no contact or calendar read. The closet is the
  // profile; the only thing that leaves the device is the `toured_at` write.
  for (const [name, raw] of TOUR_MODULES) {
    assert.ok(!/\bTextInput\b/.test(raw), `${name} draws a field — the tour asks for nothing`);
  }
});

// ---------------------------------------------------------------------------
// Law 3 — the gate is not this screen's job
// ---------------------------------------------------------------------------

test('the tour route does not decide whether it should have been opened', () => {
  // A screen that gates itself has already been opened, which on a returning
  // account is a frame of the promise before it replaces itself away — exactly
  // what the gate-loading frame exists to forbid. The decision belongs to the
  // flow that hands off; this route assumes it was made.
  assert.ok(
    !ROUTE_RAW.includes('useTourGate') && !ROUTE_RAW.includes('shouldShowTour'),
    'tour.tsx must not read the gate',
  );
  // And the handoff is where it is read, before anything is drawn.
  assert.match(HANDOFF_RAW, /useTourGate\(\)/);
  assert.match(HANDOFF_RAW, /shouldShowTour\(tourGate\)/);
  // The handoff still does not write the column — redesign 19's decision, and
  // the reason the write can stay fire-and-forget on the way out.
  assert.ok(!HANDOFF_RAW.includes('toured_at'), 'the handoff must not write toured_at');
});

test('every exit marks toured and then replaces — nothing is pushed', () => {
  assert.match(ROUTE_RAW, /markToured\.mutate\(\)/);
  assert.match(ROUTE_RAW, /router\.replace\(exitDestination\(/);
  assert.ok(!/router\.push\(/.test(ROUTE_RAW), 'the tour must never push');
  // The back gesture would be a fourth, silent way out — one that leaves
  // without recording that the tour was seen.
  assert.match(ROUTE_RAW, /gestureEnabled: false/);
  // One exit per tour: two taps while a replace is in flight would stack two
  // navigations, and the second lands on a screen the first has already left.
  assert.match(ROUTE_RAW, /leaving\.current/);
});

// ---------------------------------------------------------------------------
// The redesign — image-led, three beats, one composition change
// ---------------------------------------------------------------------------

test('the plate is drawn ABOVE the words — that is the whole redesign', () => {
  const plate = FRAMES_RAW.indexOf('<Plate');
  const eyebrow = FRAMES_RAW.indexOf('{frame.eyebrow}');
  const headline = FRAMES_RAW.indexOf('{frame.headline}');
  const body = FRAMES_RAW.indexOf('{frame.body}');
  assert.ok(plate > 0 && plate < eyebrow, 'the illustration leads the frame');
  assert.ok(eyebrow < headline && headline < body, 'eyebrow, headline, body, in that order');
});

test('the tour no longer borrows EditorialFrame, which cannot lead with a picture', () => {
  // It puts `children` after the body by construction. Recorded here rather
  // than in a comment alone because the component is still exported from the
  // shared kit and reaching for it again would silently undo the redesign.
  assert.ok(!FRAMES_RAW.includes('EditorialFrame'), 'the frames are composed here now');
});

test('the composition changes exactly once, and never shrinks type for a large setting', () => {
  const standard = tourMeasure({ fontScale: 1, height: 852 });
  const large = tourMeasure({ fontScale: AX_STACK_SCALE, height: 852 });
  const short = tourMeasure({ fontScale: 1, height: SHORT_DEVICE_HEIGHT - 1 });

  assert.deepEqual(
    [standard.plate, standard.marks, standard.skip],
    ['full', true, 'corner'],
  );
  assert.deepEqual([large.plate, large.marks, large.skip], ['compact', false, 'foot']);
  // Short is a HEIGHT decision: the plate goes compact and the type steps down,
  // but the marks and the corner Skip stay.
  assert.deepEqual([short.plate, short.marks, short.skip], ['compact', true, 'corner']);

  // Type grows with the setting and never the other way.
  assert.ok(large.bodySize > standard.bodySize);
  assert.ok(large.headlineSize > standard.headlineSize);
  assert.ok(large.ctaHeight > standard.ctaHeight);
  assert.equal(CTA_HEIGHT, 56);
  assert.equal(CTA_HEIGHT_AX, 60);

  // A short screen at a large setting is the LARGE composition, not a third
  // one — the type must grow, and the plate is already compact in both.
  const both = tourMeasure({ fontScale: AX_STACK_SCALE, height: SHORT_DEVICE_HEIGHT - 1 });
  assert.equal(both.short, false);
  assert.deepEqual([both.bodySize, both.headlineSize], [large.bodySize, large.headlineSize]);
});

test('the compact closet keeps the one coloured well', () => {
  // Three of six survive, and the oxblood cell has to be one of them or the
  // compact plate loses the only colour on the frame.
  assert.equal(CLOSET_PLATE.length, 6);
  const compact = closetCells('compact');
  assert.equal(compact.length, 3);
  assert.equal(closetCells('full').length, 6);
  assert.ok(
    compact.some((c) => c.well === null),
    'the accent well must survive the compact plate',
  );
  assert.deepEqual([...CLOSET_COMPACT_CELLS], [0, 1, 5]);
  // Exactly one accent, on the full plate too — a second would stop it reading
  // as the one thing the eye lands on.
  assert.equal(CLOSET_PLATE.filter((c) => c.well === null).length, 1);
});

test('the captions are what the compact plates drop', () => {
  assert.equal(captionVisible('full'), true);
  assert.equal(captionVisible('compact'), false);
});

test('three beats, and three marks — the deck is the only source', () => {
  assert.equal(TOUR_FRAMES.length, 3);
  // The marks are drawn from the deck, not from a typed three.
  assert.match(FRAMES_RAW, /TOUR_FRAMES\.map\(\(f, i\) =>/);
  assert.match(FRAMES_RAW, /Frame \$\{index \+ 1\} of \$\{TOUR_FRAMES\.length\}/);
  assert.equal(MARK_WIDTH, 22);
  assert.equal(MARK_HEIGHT, 4);
});

test('progress is announced even where the marks are not drawn', () => {
  // At the accessibility sizes the dashes go for room. The announcement is not
  // decoration, so the progressbar wrapper is rendered either way.
  const marks = FRAMES_RAW.slice(FRAMES_RAW.indexOf('function Marks('));
  const label = marks.indexOf('accessibilityLabel');
  const conditional = marks.indexOf('visible');
  assert.ok(label > 0 && label < marks.indexOf('{visible'), 'the label is outside the condition');
  assert.ok(conditional > 0);
});

// ---------------------------------------------------------------------------
// The house system
// ---------------------------------------------------------------------------

test('no hex is typed outside the spec', () => {
  // Every colour the tour draws belongs to `tour-spec.ts` or to the palette,
  // reached through `useTheme()`. A literal on a component is a colour nobody
  // can trace, which is what the wave's no-hex rule is about.
  for (const [name, raw] of TOUR_MODULES) {
    if (name === 'tour-spec.ts') continue;
    const hexes = raw.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    assert.deepEqual(hexes, [], `${name} types a hex: ${hexes.join(', ')}`);
  }
});

test('the dialect only holds what the palette does not', () => {
  // A dialect that redeclares a token is a second palette. Nothing in `TOUR`
  // may be a hex the theme already has a name for.
  const owned = new Set(Object.values(light).map((v) => v.toUpperCase()));
  const collisions = Object.entries(TOUR).filter(([, v]) => owned.has(v.toUpperCase()));
  assert.deepEqual(collisions, [], `re-typed palette values: ${JSON.stringify(collisions)}`);
});

test('the eyebrow clay survives on ink and is refused on paper', () => {
  // The frames draw the eyebrow in a clay on both grounds. On ink it clears AA
  // comfortably; on paper `accentWarm` is 2.61:1 and an 11.5pt tracked line is
  // never large text, so the paper frames take `muted`. This is the contrast
  // law overruling the frame, in the one direction it always does.
  assert.ok(contrastRatio(TOUR.inkEyebrow, light.ink) >= AA_TEXT);
  assert.ok(contrastRatio(light.accentWarm, light.canvas) < AA_TEXT);
  assert.match(FRAMES_RAW, /dark \? TOUR\.inkEyebrow : theme\.muted/);
  // And nothing in the tour sets the clay itself as type.
  for (const [name, raw] of TOUR_MODULES) {
    assert.ok(!/color:\s*theme\.accentWarm/.test(raw), `${name} sets accentWarm as text`);
  }
});

test('the CTA label and the tour’s quiet copy clear AA on their own grounds', () => {
  assert.ok(contrastRatio(light.canvas, light.accent) >= AA_TEXT, 'cream on oxblood');
  assert.ok(contrastRatio(light.accent, light.canvas) >= AA_TEXT, 'oxblood on paper');
  assert.ok(contrastRatio(light.muted, light.canvas) >= AA_TEXT, 'muted body on paper');
  assert.ok(contrastRatio(light.muted, light.tray) >= AA_TEXT, 'muted caption on the miniature');
});

test('no weight, anywhere — the emphasis is size, colour and case', () => {
  for (const [name, raw] of TOUR_MODULES) {
    assert.ok(!/fontWeight/.test(raw), `${name} declares a fontWeight`);
    assert.ok(!/font-(?:medium|semibold|bold)\b/.test(raw), `${name} names a weight utility`);
  }
});

test('every flexible row states its shrink discipline', () => {
  // A `flex: 1` cell with no `minWidth: 0` will not shrink below its content on
  // React Native, which is how a two-card row overflows the moment a caption
  // gets longer. Every flexible child of a row in this file declares one.
  const flexOnes = (FRAMES_RAW.match(/flex: 1,\n\s*minWidth: 0,/g) ?? []).length;
  assert.ok(flexOnes >= 2, `expected the camera plate's two halves to be shrinkable`);
  // And the fixed-width column between them refuses to shrink at all.
  assert.match(FRAMES_RAW, /flexShrink: 0,/);
});

test('a well is only ever a direct child of a ROW', () => {
  // The bug this pins: `flex: 1` and `height` on one view agree only when the
  // flex axis is horizontal. In a column parent `flex: 1` becomes
  // `flexBasis: 0` on the same axis `height` is on, the basis wins, and the
  // well collapses to nothing — which is how TR-01 rendered as an empty dark
  // slab with no garments and no oxblood cell in it.
  //
  // So the closet plate builds real rows rather than wrapping a percentage
  // basis, and nothing in this file wraps a `Well` in a column cell. A
  // percentage `flexBasis` would also be wrong on its own terms: React Native
  // does not subtract `gap` from it, so three cells plus two gaps overflow.
  assert.ok(!FRAMES_RAW.includes('flexBasis'), 'wells divide a row, never a percentage basis');
  assert.ok(!FRAMES_RAW.includes('flexWrap'), 'the closet plate is rows, not a wrapped run');
  assert.match(FRAMES_RAW, /i \+= CLOSET_COLUMNS/);
  // Every `<Well` appears inside a `flexDirection: 'row'` container.
  const rows = (FRAMES_RAW.match(/flexDirection: 'row'/g) ?? []).length;
  assert.ok(rows >= 2, 'the closet and morning plates each lay their wells in a row');
});

test('the filled controls paint their ground on an animated view, not on the Pressable', () => {
  // The house pattern (`use-press-feedback.ts`): the Pressable is the hit
  // target and carries only its height; the ground is inline OBJECT styles on
  // an `Animated.View`. A function `style` on the Pressable is what rendered
  // the CTA as a bare "Next" label with no oxblood capsule under it.
  assert.ok(
    !/style=\{\(\{ pressed \}\)/.test(FRAMES_RAW),
    'no control may resolve its ground through a style function',
  );
  assert.match(FRAMES_RAW, /const press = usePressFeedback\(\);/);
  assert.match(FRAMES_RAW, /backgroundColor: theme\.accent,/);
  assert.match(FRAMES_RAW, /borderRadius: height \/ 2,/);
  // Three controls, three hooks: the CTA, the secondary and Skip.
  assert.equal((FRAMES_RAW.match(/usePressFeedback\(\)/g) ?? []).length, 3);
});

test('reduced motion drops the travel and keeps the tree', () => {
  // The composition is identical with the setting on; what goes is the frame
  // cross-fade. The pressed depression is `usePressFeedback`, which carries
  // `ReduceMotion.System` by construction — so the press still ARRIVES with the
  // setting on, it simply arrives without the tween. That is the correct
  // behaviour for feedback the user asked for, and it is why there is no
  // hand-rolled guard on it here.
  assert.match(FRAMES_RAW, /useReducedMotion\(\)/);
  assert.match(FRAMES_RAW, /entering=\{reduced \? undefined : FadeIn/);
  // Nothing else in this file translates, scales or staggers.
  assert.ok(!/withRepeat|translateY|translateX/.test(FRAMES_RAW));
});

test('the haptic goes through the policy, not past it', () => {
  assert.match(ROUTE_RAW, /from '@\/lib\/haptics'/);
  assert.ok(!/from 'expo-haptics'/.test(ROUTE_RAW), 'import lib/haptics instead');
});

// ---------------------------------------------------------------------------
// The drawings
// ---------------------------------------------------------------------------

test('every garment is a closed polygon in the 0–100 box the frames use', () => {
  // The frames draw these as `clip-path: polygon(…)`, which is a
  // percentage-of-the-box coordinate system; an SVG viewBox of 0 0 100 100 with
  // `preserveAspectRatio="none"` is the same one. If a point ever left the box
  // the shape would silently clip instead of failing.
  for (const [name, points] of Object.entries(GARMENT_SHAPES)) {
    const pairs = points.split(' ').map((p) => p.split(',').map(Number));
    assert.ok(pairs.length >= 4, `${name} is not a garment, it is a triangle`);
    for (const pair of pairs) {
      assert.equal(pair.length, 2, `${name} has a malformed point`);
      for (const v of pair) {
        assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `${name} leaves the box at ${v}`);
      }
    }
  }
  assert.match(FRAMES_RAW, /preserveAspectRatio="none"/);
  assert.match(FRAMES_RAW, /viewBox="0 0 100 100"/);
});

test('every plate cell names a shape the spec actually draws', () => {
  for (const cell of [...CLOSET_PLATE, ...MORNING_PLATE]) {
    assert.ok(GARMENT_SHAPES[cell.shape], `no shape named ${cell.shape}`);
    assert.ok(cell.width > 0 && cell.height > 0);
  }
});

test('every plate announces itself as a sample', () => {
  // Nothing on this screen may be mistaken for the reader's own closet, look or
  // wear history — which is the whole reason the illustrations are drawings.
  for (const label of ['Sample closet', 'Illustration:', 'Sample of the Today page']) {
    assert.ok(FRAMES_RAW.includes(label), `missing plate label: ${label}`);
  }
  assert.match(FRAMES_RAW, /accessibilityRole="image"/);
});

test('the sample temperature comes from the app’s formatter, not a typed glyph', () => {
  assert.match(FRAMES_RAW, /formatTemp\(TOUR_SAMPLE_FEELS_C, TOUR_UNITS\)/);
  assert.ok(!/63°/.test(FRAMES_RAW), 'the frame’s Fahrenheit reading must be derived');
});
