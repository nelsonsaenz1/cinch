import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';

/**
 * The dead-press shape, banned app-wide.
 *
 * A `Pressable` that carries no `style`/`className` of its own and whose only
 * child is a Reanimated `Animated.View` stops receiving presses entirely —
 * found live on 2026-08-31: every category chip in the item editor (and every
 * filter chip in the closet) sat dead under a tap, which is how the funnel
 * run's "category stayed top" happened, and production `closet_filter` events
 * stop within hours of the 2026-08-20 compression pass (dc26774) that
 * introduced the shape. `Button` never lost its presses; the difference was
 * that its Pressable keeps its own style and its animated fill layer opts out
 * of hit-testing.
 *
 * The rule: every `<Pressable` whose opening tag is immediately followed by an
 * `<Animated.View` child must carry a `style=` or `className=` of its own, so
 * the native press view owns a frame regardless of what the wrapper does.
 * (`pointerEvents="none"` on the wrapper is the belt the repaired sites also
 * wear, but it is not required here: styled-Pressable sites with live wrappers
 * — the closet's item cards, the activity rows — demonstrably receive presses,
 * and forcing the wrapper inert would break wrappers that contain their own
 * interactive children.)
 */

const ROOT = 'src';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

test('no Pressable hands its whole body to a bare Reanimated wrapper', () => {
  const offenders: string[] = [];
  for (const file of walk(ROOT)) {
    const source = readFileSync(file, 'utf8');
    // Opening tag of each Pressable, then the first JSX child that follows.
    const re = /<Pressable\b([\s\S]*?)>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)*<Animated\.View\b([^>]*)>/g;
    for (const match of source.matchAll(re)) {
      const openingTag = match[1];
      const wrapperAttrs = match[2];
      void match[2];
      const pressableStyled = /\b(style|className)=/.test(openingTag);
      if (!pressableStyled) {
        offenders.push(`${file}: bare Pressable handing its body to an Animated.View`);
      }
    }
  }
  assert.deepEqual(offenders, [], `dead-press shapes found:\n${offenders.join('\n')}`);
});
