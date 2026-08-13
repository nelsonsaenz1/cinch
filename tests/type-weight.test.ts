/**
 * TY-01 / TY-02 — no product component carries weight.
 *
 * The correction file states it as one implementation rule: "delete every
 * fontWeight declaration from product components. The sans inherits 400;
 * Instrument Serif is single-weight. Hierarchy comes from size, colour, case
 * and space." Two acceptance checks turn on it — "No `fontWeight` above 400 in
 * any product component" and "Medium count is zero" — and neither can be
 * proved by rendering, because a weight that shipped renders perfectly.
 *
 * So this asserts on the SOURCE of every file under `src/`, which is where a
 * weight can actually be reintroduced, and on the two shared tables (the type
 * variants and the button contract) that used to hand one to every screen.
 *
 * ── THE ONE EXCLUSION, NAMED ──────────────────────────────────────────────
 *
 * `src/components/share/**` is the paper share artifact — a card rasterised to
 * an image and handed to another app, with its own drawn geometry and its own
 * governance. It is not app chrome, no TY frame draws it, and restyling it
 * silently would change a shipped artifact on the authority of a rule written
 * about screens. Excluded here, recorded as a deviation, and left for a
 * founder call rather than assumed either way.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

import tailwind from '../tailwind.config.js';

/** The share artifact — see the header. Everything else is product. */
const EXCLUDED = 'src/components/share/';

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * Comments across the app discuss the weight rule they are obeying — several
 * of them say the words "font-medium" while setting nothing. Only code counts.
 */
const code = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const PRODUCT = sources('src').filter((p) => !p.startsWith(EXCLUDED));

test('the sweep covers the whole app, so a passing run means something', () => {
  // A guard on the guard: if `sources()` ever returns a handful of files
  // because a path changed, every assertion below would pass vacuously.
  assert.ok(PRODUCT.length > 200, `only ${PRODUCT.length} files scanned`);
  assert.ok(PRODUCT.includes('src/components/ui/text.tsx'));
  assert.ok(PRODUCT.includes('src/components/ui/button.tsx'));
});

test('no product component names a weight utility', () => {
  const offenders = PRODUCT.filter((p) =>
    /(?<![-\w])font-(?:medium|semibold|bold)(?![-\w])/.test(code(readFileSync(p, 'utf8'))),
  );
  assert.deepEqual(offenders, [], 'font-medium / font-semibold / font-bold in product code');
});

test('no product component declares a numeric fontWeight', () => {
  // `fontWeight: '500'` is the other door into the same room, and it is the
  // one a `style` prop opens — five components had walked through it.
  const offenders = PRODUCT.filter((p) => /fontWeight\s*:/.test(code(readFileSync(p, 'utf8'))));
  assert.deepEqual(offenders, [], 'inline fontWeight in product code');
});

test('no product component asks for the Medium face by name', () => {
  // The third door: `fontFamily: 'HelveticaNeue-Medium'` sets the same weight
  // without going near either of the words above. The weekday strip, the tab
  // bar and five auth screens were all reaching for it.
  const offenders = PRODUCT.filter((p) =>
    /HelveticaNeue-Medium/.test(code(readFileSync(p, 'utf8'))),
  );
  assert.deepEqual(offenders, [], "fontFamily: 'HelveticaNeue-Medium' in product code");
});

test('the family map no longer resolves a Medium cut', () => {
  // Belt to the braces above: even if a `font-medium` came back, there is no
  // family behind it, so it would render regular rather than ship a weight.
  const families = (
    tailwind as { theme: { extend: { fontFamily: Record<string, string[]> } } }
  ).theme.extend.fontFamily;
  assert.deepEqual(families.body, ['HelveticaNeue']);
  assert.equal(families.medium, undefined);
  assert.equal(families.semibold, undefined);
});

test('every text variant is set in one of the two regular cuts', () => {
  // The shared table is the highest-leverage place a weight can hide: five of
  // its variants carried Medium, so every label, caption, eyebrow, colophon
  // and 20 pt heading in the app was heavier than the atlas drew it.
  const src = code(readFileSync('src/components/ui/text.tsx', 'utf8'));
  const classes = [...src.matchAll(/^\s*\/?\*?\s*(\w+):\s*'([^']+)'/gm)].map((m) => m[2]);
  assert.ok(classes.length >= 18, `only ${classes.length} variants read`);
  for (const value of classes) {
    const family = value.split(/\s+/).find((c) => c.startsWith('font-'));
    assert.ok(family, `a variant names no family: ${value}`);
    assert.ok(
      family === 'font-body' || family === 'font-display' || family === 'font-title',
      `${value} is not one of the two regular cuts`,
    );
  }
});
