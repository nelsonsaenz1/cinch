/**
 * Today, as drawn. Redesign 11.
 *
 * The decisions are `tests/today-spec.test.ts` and the payloads are
 * `tests/today-analytics.test.ts`. What is left — and what this file holds — is
 * the PAGE: the carousel, the order VoiceOver reads it in, the one haptic, and
 * the several things the accepted frames say Today must never become.
 *
 * Asserted as text, because esbuild cannot parse React Native's Flow source and
 * there is no renderer in this harness. Every regex below is written against a
 * line somebody would have to deliberately delete.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROUTE = readFileSync('src/app/(tabs)/index.tsx', 'utf8');
const PLATE = readFileSync('src/components/today/today-plate.tsx', 'utf8');
const CHIPS = readFileSync('src/components/today/context-chips.tsx', 'utf8');
const FLOOR = readFileSync('src/components/today/closet-floor.tsx', 'utf8');

/** Comments are prose about the code, not the code. Strip them before grepping. */
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ROUTE_CODE = stripped(ROUTE);
const PLATE_CODE = stripped(PLATE);

// ---------------------------------------------------------------------------
// The carousel — three cards side by side, never a stack
// ---------------------------------------------------------------------------

test('the plates are a paged row, not a vertical list and not a stack', () => {
  assert.match(ROUTE_CODE, /<FlatList[\s\S]{0,400}horizontal[\s\S]{0,200}pagingEnabled/);
  // A stack with parallax hides the second and third looks behind the first
  // and asks a reader to discover them. Explicitly absent.
  assert.doesNotMatch(ROUTE_CODE, /parallax/i);
  assert.doesNotMatch(PLATE_CODE, /parallax|rotate|scale:/i);
});

test('a page is the full screen width, so a swipe cannot rest between two cards', () => {
  assert.match(ROUTE_CODE, /const pageWidth = screenWidth;/);
  // The gutter lives INSIDE the page. Padding the container instead would
  // leave the page width and the snap interval disagreeing by 40pt.
  assert.match(ROUTE_CODE, /width: pageWidth, paddingHorizontal: GUTTER/);
  assert.match(ROUTE_CODE, /width=\{pageWidth - GUTTER \* 2\}/);
});

test('the dots are decorative and hidden from VoiceOver', () => {
  assert.match(PLATE_CODE, /export function PlateDots[\s\S]{0,400}accessibilityElementsHidden/);
  assert.match(PLATE_CODE, /importantForAccessibility="no-hide-descendants"/);
});

test('the outfit is one element, and it speaks its own position', () => {
  // An outfit heard as three separate garments is not an outfit.
  assert.match(PLATE_CODE, /accessible\s*\n\s*accessibilityRole="image"/);
  assert.match(PLATE_CODE, /const spoken = \[view\.name, view\.piecesLine, view\.positionLabel\]/);
  assert.match(ROUTE_CODE, /positionLabel: positionLabel\(\(i \+ 1\) as PlateIndex\)/);
});

// ---------------------------------------------------------------------------
// The order VoiceOver reads the page in
// ---------------------------------------------------------------------------

test('the reading order is context, then outfit, then wear, then taste, then invite', () => {
  const at = (needle: string) => {
    const i = ROUTE_CODE.lastIndexOf(needle);
    assert.ok(i > -1, `${needle} is not on the page`);
    return i;
  };
  const chips = at('<ContextChips');
  const plate = at('<TodayPlate');
  const wear = at('TODAY_COPY.wear}');
  const taste = at('<TasteMark');
  const invite = at('<InviteLine');
  assert.ok(chips < plate, 'the context is read after the outfit');
  assert.ok(plate < wear, 'the action is read before the outfit it acts on');
  assert.ok(wear < taste, 'the taste mark is read before the wear action');
  assert.ok(taste < invite, 'the invite line is read before the taste mark');
});

test('the wear action sits inside the page it belongs to', () => {
  // A single shared action under the row would change meaning as you scroll,
  // and VoiceOver — which never scrolls — would announce it against whichever
  // card it happened to be next to.
  const list = ROUTE_CODE.slice(ROUTE_CODE.indexOf('renderItem={({ item: outfit'));
  assert.match(list.slice(0, 4000), /TODAY_COPY\.wear/);
});

// ---------------------------------------------------------------------------
// Targets and Dynamic Type
// ---------------------------------------------------------------------------

test('every target on this page is 44pt, and 56pt at an accessibility size', () => {
  for (const [label, src] of [
    ['route', ROUTE_CODE],
    ['chips', CHIPS],
  ] as const) {
    // Both spellings count: the route writes the numbers inline, the chips
    // write them as named constants — and the constants are pinned to the same
    // two numbers by the test below.
    const inline = src.match(/minHeight: (?:ax|large) \? (\d+) : (\d+)/g) ?? [];
    const named = src.match(/minHeight: (?:ax|large) \? \w+_AX : \w+/g) ?? [];
    assert.ok(inline.length + named.length > 0, `${label} declares no adaptive targets`);
    for (const h of inline) {
      const [, big, small] = h.match(/\? (\d+) : (\d+)/) as RegExpMatchArray;
      assert.ok(Number(small) >= 44, `${label} draws a ${small}pt target`);
      assert.ok(Number(big) >= 56, `${label} draws a ${big}pt target at AX`);
    }
  }
});

test('the chips state their own measures, and they clear the floor', () => {
  assert.match(CHIPS, /export const CHIP_HEIGHT = 44;/);
  assert.match(CHIPS, /export const CHIP_HEIGHT_AX = 56;/);
});

test('the collage shrinks at an accessibility size so the words have room', () => {
  // Not the other way round. At AX-XXXL every line of type grows, and a fixed
  // 236pt collage is what pushes the name and the pieces off a 667pt screen.
  assert.match(PLATE_CODE, /COLLAGE_HEIGHT = 236/);
  assert.match(PLATE_CODE, /COLLAGE_HEIGHT_AX = 168/);
  assert.match(PLATE_CODE, /large \? COLLAGE_HEIGHT_AX : COLLAGE_HEIGHT/);
});

test('the plate’s two lines stop being clamped at an accessibility size', () => {
  // `numberOfLines` at AX is how a name becomes an ellipsis nobody can read.
  assert.match(PLATE_CODE, /numberOfLines=\{large \? undefined : 2\}/);
});

test('the floor scrolls, because at AX-XXXL its composition is taller than a phone', () => {
  assert.match(ROUTE_CODE, /<ScrollView[\s\S]{0,400}<ClosetFloor/);
});

// ---------------------------------------------------------------------------
// Motion and haptics
// ---------------------------------------------------------------------------

test('the page transition honours Reduce Motion explicitly', () => {
  // The layout-animation builders do NOT inherit the setting the `spring`
  // presets in `theme/tokens.ts` bake in, so an undeclared fade keeps playing
  // for somebody who asked the system for less.
  assert.match(ROUTE_CODE, /FadeIn\.duration\([^)]*\)\.reduceMotion\(ReduceMotion\.System\)/);
  assert.match(ROUTE_CODE, /FadeOut\.duration\([^)]*\)\.reduceMotion\(ReduceMotion\.System\)/);
});

test('there is exactly one haptic on Today, and it fires after a committed wear', () => {
  // The call sites, not the enum members: `NotificationFeedbackType.Success`
  // is an argument to the one call, not a second buzz.
  const haptics = ROUTE_CODE.match(/Haptics\.\w+Async\(/g) ?? [];
  assert.equal(haptics.length, 1, `Today fires ${haptics.length} haptics: ${haptics.join(', ')}`);
  // Not a selection tick on the tap: a tick before the server has answered is
  // the phone congratulating somebody for a write that may still fail.
  assert.match(
    ROUTE_CODE,
    /setWornIds[\s\S]{0,600}Haptics\.notificationAsync\(Haptics\.NotificationFeedbackType\.Success\)/,
  );
});

test('no haptic fires on a swipe, a chip, or the enhancement landing', () => {
  assert.doesNotMatch(ROUTE_CODE, /onMomentumScrollEnd[\s\S]{0,300}Haptics/);
  assert.doesNotMatch(ROUTE_CODE, /onOccasion[\s\S]{0,200}Haptics/);
  assert.doesNotMatch(ROUTE_CODE, /onFeel[\s\S]{0,200}Haptics/);
  assert.doesNotMatch(ROUTE_CODE, /isEnhancing[\s\S]{0,200}Haptics/);
});

// ---------------------------------------------------------------------------
// The context chips — a closed list, and a real steer
// ---------------------------------------------------------------------------

test('the chips are a labelled group with radio options, not a form', () => {
  assert.match(CHIPS, /accessibilityRole="radiogroup"/);
  assert.match(CHIPS, /accessibilityRole="radio"/);
  // No keyboard, no confirm step, no sheet — and therefore no way for free
  // text to leave this screen at all.
  assert.doesNotMatch(CHIPS, /<TextInput|onChangeText|keyboardType/);
});

test('each chip announces its current value', () => {
  assert.match(CHIPS, /`Occasion, \$\{occasionLabel\(view\.occasion\)\}`/);
  assert.match(CHIPS, /`Feel, \$\{feelLabel\(view\.feel\)\}`/);
});

test('a chip steers the scorer, which is the whole reason the field went', () => {
  assert.match(ROUTE_CODE, /targetOccasion: engineOccasion\(context11\.occasion\)/);
  assert.match(ROUTE_CODE, /targetFormality: engineFormality\(context11\.feel\)/);
});

test('changing the context never empties the plate that is already there', () => {
  // The on-device engine has no latency worth a spinner — the plates ARE the
  // new context's plates by the time this render exists — so `applying` only
  // ever changes a LINE on a card that is still standing.
  assert.match(ROUTE_CODE, /applyingLabel: applying \? TODAY_COPY\.applying : null/);
  assert.match(PLATE_CODE, /\{view\.applyingLabel \?\? view\.piecesLine\}/);
  assert.doesNotMatch(ROUTE_CODE, /applying \? null :/, 'the plate is emptied while a context lands');
});

// ---------------------------------------------------------------------------
// Images, and the four things that look identical on purpose
// ---------------------------------------------------------------------------

test('a missing, hidden, unauthorized or unloaded image draws the same neutral fill', () => {
  // A distinct "hidden" treatment would be evidence that a hidden garment
  // exists, which is exactly the inference the closet refuses everywhere else.
  // ONE placeholder component, reached by both paths — the tile with no uri at
  // all, and the tile whose image failed to load. Nothing branches on WHY.
  assert.match(PLATE_CODE, /function PiecePlaceholder\(\)/);
  assert.equal((PLATE_CODE.match(/<PiecePlaceholder \/>/g) ?? []).length, 2);
  assert.match(PLATE_CODE, /uri \? \(/);
  assert.doesNotMatch(PLATE_CODE, /isHidden|hiddenFallback|unauthori[sz]ed/i);
});

// ---------------------------------------------------------------------------
// The wear flow
// ---------------------------------------------------------------------------

test('a wear is confirmed before it is written', () => {
  assert.match(ROUTE_CODE, /<WearConfirmationSheet/);
  assert.match(ROUTE_CODE, /setWearSelection\(outfit\);/);
});

test('cancelling writes nothing at all', () => {
  const cancel = ROUTE_CODE.slice(ROUTE_CODE.indexOf('onCancel={'));
  const body = cancel.slice(0, cancel.indexOf('}}'));
  assert.doesNotMatch(body, /mutate|track\(/, `cancel writes: ${body}`);
  assert.match(body, /setWearSelection\(null\)/);
});

test('a wear goes through the existing mutation, not a new one', () => {
  assert.match(ROUTE_CODE, /const wear = useWearOutfit\(\)/);
  assert.match(ROUTE_CODE, /wear\.mutate\(/);
});

test('rating and favourite still teach the learner they always taught', () => {
  assert.match(ROUTE_CODE, /react\.mutate\(/);
  assert.match(ROUTE_CODE, /liked/);
});

test('a failed wear is retryable, and says nothing was written twice', () => {
  assert.match(ROUTE_CODE, /classifyWearFailure\(error\)/);
  assert.match(ROUTE_CODE, /wearFailureCopy\(failure\)\.body/);
});

test('Undo is offered only once there is a diary entry to undo', () => {
  assert.match(PLATE_CODE, /\{entryId \? \(/);
  assert.match(ROUTE_CODE, /if \(!entryId\) return;/);
});

// ---------------------------------------------------------------------------
// What Today refuses to become
// ---------------------------------------------------------------------------

test('no paywall, gate or access chrome on Today', () => {
  // The verified access model is a 14-day server-side trial. A reader inside
  // it, at its boundary, or past it sees the ordinary page.
  assert.doesNotMatch(ROUTE_CODE, /trial|paywall|locked|upgrade to/i);
});

test('no streak, score, leaderboard or public metric', () => {
  // Stripped, because the route's own prose explains why Activity owns the
  // app's single badge — an explanation of a refusal is not the offence.
  assert.doesNotMatch(ROUTE_CODE, /streak|leaderboard|points\b/i);
  // And no badge is DRAWN on this screen; `calendar.badge.plus` is an SF
  // Symbol's name, which is why the assertion is about the prop and not the
  // word.
  assert.doesNotMatch(ROUTE_CODE, /badgeCount|showBadge|<Badge/i);
});

test('no price, no merchant and no shop word on the day’s screen', () => {
  assert.doesNotMatch(ROUTE_CODE, /\$\{?\d|price|checkout|\bbuy\b|merchant/i);
});

test('the reaction bar is gone, and taste learning is not', () => {
  assert.doesNotMatch(ROUTE_CODE, /<ReactionBar|onReact=|const handleReact/);
  // The learner is still called — from the wear sheet's rating and favourite,
  // which is the one opinion with a day behind it.
  assert.match(ROUTE_CODE, /const react = useReactToOutfit\(\)/);
});

test('the floor says the accepted sentence, and does not print a nought', () => {
  assert.match(FLOOR, /TODAY_COPY\.floorTitle/);
  assert.doesNotMatch(stripped(FLOOR), /0 pieces|\{items\.length\} pieces/);
});

test('the floor gate is the product’s ten, not the engine’s eight', () => {
  assert.match(ROUTE_CODE, /belowActivationFloor\(items\.length, canGenerate\(items\)\)/);
  assert.doesNotMatch(ROUTE_CODE, /MIN_CLOSET_FOR_OUTFITS/);
});

test('offline draws the cards and refuses the write, rather than promising a queue', () => {
  // `useWearOutfit` is a single online RPC with nothing behind it. Drawing a
  // live control over a write that cannot happen is the one thing this lane
  // may not do.
  assert.match(ROUTE_CODE, /accessibilityState=\{\{ disabled: true \}\}[\s\S]{0,200}OFFLINE_ACTIONS_REASON/);
  // Asserted against what is DRAWN. The route's prose quotes the accepted
  // frame's false promise in order to refuse it, and a grep over comments
  // would read the refusal as the promise.
  assert.doesNotMatch(ROUTE_CODE, /will sync|syncs when|sent when you/i);
});

test('the enhancement never blocks the morning', () => {
  // The on-device set is the PRIMARY path. Nothing on this screen waits on a
  // request, and the slow notice is additive rather than a replacement.
  assert.match(ROUTE_CODE, /\{slow && !showWithoutReason && !nothingWorks \?/);
  assert.match(ROUTE_CODE, /onShowAnyway=\{\(\) => setShowWithoutReason\(true\)\}/);
});

test('nothing on Today logs a city, a coordinate or a calendar title', () => {
  const tracks = ROUTE_CODE.match(/track\([\s\S]{0,200}?\)/g) ?? [];
  for (const call of tracks) {
    assert.doesNotMatch(call, /cityLabel|coords|latitude|longitude|events\[|\.title|firstName/, call);
  }
});
