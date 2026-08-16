/**
 * UX-07's press half — the shared primitive's contract, pinned as source facts.
 *
 * Same argument `button-spec.test.ts` makes at length and does not need
 * repeating: rendering `<PressableSurface>` in Node would need a mock for every
 * RN primitive, NativeWind's jsx transform, Reanimated and expo-haptics — a
 * large, brittle harness that would faithfully render the wrong behaviour and
 * pass. The bugs this component can actually ship are structural, and structure
 * is what a source assertion catches:
 *
 *   · the animated layer ending up OUTSIDE the Pressable, which puts the
 *     compression on the touch target's parent and makes the whole row shrink;
 *   · the haptic firing on `onPressIn`, promising an action the press may not
 *     keep;
 *   · a disabled control still ticking;
 *   · the 44pt floor quietly dropping off.
 *
 * The Reduce Motion half is genuinely not asserted here, and deliberately: it is
 * a property of `spring.snappy` and `withTiming`, both of which carry
 * `ReduceMotion.System`, and `tokens.ts` is where that is pinned. The test below
 * checks that this component uses the shared hook rather than hand-rolling a
 * second animation — which is the thing that would route AROUND that guarantee.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MIN_TAP_TARGET, PRESSED_OPACITY } from '../src/theme/metrics';

const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const surface = () => code('src/components/ui/pressable-surface.tsx');
const hook = () => code('src/components/ui/use-press-feedback.ts');

test('the primitive composes the shared hook rather than a second animation', () => {
  const src = surface();
  assert.match(src, /import \{ usePressFeedback \}/);
  assert.match(src, /usePressFeedback\(!inert\)/);
  // A hand-rolled tween here would bypass the ReduceMotion.System guarantee
  // that lives in the hook's `withTiming` and `spring.snappy`.
  assert.ok(!/withTiming|withSpring|useSharedValue/.test(src), 'animate through the hook, not beside it');
});

test('the pressed response is still one compression and one dim', () => {
  // The hook is the single definition, and `PRESSED_OPACITY` is why: the app
  // had four pressed opacities across 86 call sites before it existed. A second
  // one entering through this component would undo that quietly.
  const src = hook();
  assert.match(src, /1 - progress\.value \* \(1 - PRESSED_OPACITY\)/);
  assert.match(src, /1 - progress\.value \* \(1 - PRESSED_SCALE\)/);
  assert.equal(PRESSED_OPACITY, 0.8);
  // The scale is a local constant on purpose — Apple's filled controls sit
  // around 3% and it has no other consumer — but it must stay subtle.
  const scale = Number(/const PRESSED_SCALE = ([\d.]+);/.exec(src)?.[1]);
  assert.ok(scale >= 0.95 && scale < 1, `${scale} is not a compression, it is a toy`);
});

test('the animated layer is inside the Pressable, not around it', () => {
  // Outside, the compression scales the touch target itself and every adopting
  // row visibly shrinks. Inside, the caller's `className` keeps painting the
  // ground exactly as it did — which is the whole reason this is a drop-in.
  const src = surface();
  const pressable = src.indexOf('<Pressable');
  const animated = src.indexOf('<Animated.View');
  assert.ok(pressable !== -1 && animated !== -1);
  assert.ok(animated > pressable, 'the animated layer must be a CHILD of the Pressable');
});

test('the haptic fires on press, never on press-in, and never when inert', () => {
  const src = surface();
  // In `handlePress`, guarded by `inert`, and after the guard.
  assert.match(src, /if \(inert\) return;\s*if \(haptic\) haptics\[haptic\]\(\);/);
  // `onPressIn` does the animation and nothing else.
  const pressIn = /onPressIn=\{\(event\) => \{([\s\S]*?)\}\}/.exec(src)?.[1] ?? '';
  assert.ok(!/haptics/.test(pressIn), 'a tick before the action promises what the press may not keep');
});

test('busy and disabled are both announced and both inert', () => {
  // "Maintain visible disabled/busy states" is UX-07's line; announcing them is
  // the same requirement one layer down. `busy` is distinct from `disabled`
  // because a control the user already pressed must not take a second press.
  const src = surface();
  assert.match(src, /const inert = Boolean\(disabled\) \|\| busy;/);
  assert.match(src, /disabled=\{inert\}/);
  assert.match(src, /accessibilityState=\{\{ disabled: inert, busy, \.\.\.accessibilityState \}\}/);
});

test('the 44pt floor is the default and opting out is named', () => {
  const src = surface();
  assert.match(src, /fill \? null : \{ minHeight: MIN_TAP_TARGET \}/);
  assert.equal(MIN_TAP_TARGET, 44);
  // `fill` and not `noMinHeight`: it is for a surface whose geometry a grid
  // already fixes past 44, not a way to make something small.
  assert.match(src, /fill = false/);
});

test('the primitive owns no paint of its own', () => {
  // No padding, no radius, no ground. A shared press that also had opinions
  // about shape would be a second Button, and `button-spec.ts` is where that
  // contract lives.
  const src = surface();
  assert.ok(!/borderRadius|padding|backgroundColor/.test(src), 'this is press, not paint');
});

test('the layout the animated layer imposes is a prop, not a fixed cost', () => {
  // The one thing adoption costs: the animated layer is a real box between the
  // Pressable and its children, so a call site whose `className` arranged those
  // children is now arranging one child. `contentStyle` is where that moves —
  // as a STYLE, because NativeWind's interop is not registered for Reanimated's
  // wrappers and a class there would silently do nothing.
  const src = surface();
  assert.match(src, /contentStyle\?: StyleProp<ViewStyle>;/);
  assert.match(src, /style=\{\[contentStyle \?\? \{ flex: 1 \}, press\.style\]\}/);
});
