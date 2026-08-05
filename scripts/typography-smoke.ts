/**
 * Typography smoke test. Run with:
 *   npm run smoke:type
 *
 * Guards one specific, hard-to-see bug: a line height below the font's own line
 * box makes CoreText slice the tops off glyphs. It does not look like clipping —
 * it looks like a spacing mistake — so it survived review and shipped.
 *
 * Every fontSize token is checked against the floor for the family it is
 * actually set in. If you add a token, add it to FACE_OF or this fails loudly,
 * which is the point.
 */

import { FACES, capTrim, minLineHeight, type FaceName } from '../src/theme/font-metrics';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tw = require('../tailwind.config.js');

/** Which family each token is rendered in. See src/components/ui/text.tsx. */
const FACE_OF: Record<string, FaceName> = {
  wordmark: 'instrument',
  display: 'instrument',
  title: 'instrument',
  plate: 'instrument',
  // `figure` is the serif data number now — see text.tsx.
  figure: 'instrument',
  heading: 'helvetica',
  body: 'helvetica',
  callout: 'helvetica',
  label: 'helvetica',
  caption: 'helvetica',
  eyebrow: 'helvetica',
  colophon: 'helvetica',
};

const sizes = tw.theme.extend.fontSize as Record<string, [string, { lineHeight: string }]>;
const px = (v: string) => Number.parseFloat(v);

console.log('\n=== Font line boxes ===\n');
for (const [name, m] of Object.entries(FACES)) {
  console.log(`${name.padEnd(9)} line box ${m.leading.toFixed(3)}em   cap height ${m.capHeight.toFixed(3)}em`);
}

console.log('\n=== Token line heights vs clipping floor ===\n');
console.log('token       size   leading   ratio   floor   verdict');

let failures = 0;
for (const [token, [sizeRaw, meta]] of Object.entries(sizes)) {
  const face = FACE_OF[token];
  if (!face) {
    console.log(`${token.padEnd(11)} — no family declared in FACE_OF`);
    failures++;
    continue;
  }

  const size = px(sizeRaw);
  const lh = px(meta.lineHeight);
  const floor = minLineHeight(face, size);
  const ok = lh >= floor;
  if (!ok) failures++;

  console.log(
    `${token.padEnd(11)} ${String(size).padStart(4)}   ${String(lh).padStart(6)}   ` +
      `${(lh / size).toFixed(2)}   ${String(floor).padStart(5)}   ` +
      `${ok ? 'ok' : `CLIPS — needs ${floor}px, tops of ascenders will be cut`}`,
  );
}

console.log('\n=== Cap trim: box collapses to exactly the cap height ===\n');
for (const token of ['wordmark', 'display', 'title', 'plate']) {
  const [sizeRaw, meta] = sizes[token]!;
  const size = px(sizeRaw);
  const lh = px(meta.lineHeight);
  const t = capTrim('instrument', size, lh);
  const laidOut = lh + t.marginTop + t.marginBottom;
  const cap = Math.round(size * FACES.instrument.capHeight);
  // Rounding each margin separately can land 1px off the rounded cap height;
  // anything beyond that means the trim math is broken.
  const ok = Math.abs(laidOut - cap) <= 1;
  if (!ok) failures++;
  console.log(
    `${token.padEnd(11)} lh ${String(lh).padStart(3)}  trim ${t.marginTop}/${t.marginBottom}` +
      `  -> ${laidOut}px laid out vs cap ${cap}px  ${ok ? 'ok' : 'BROKEN'}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} failure(s). Use leading()/capTrim() from font-metrics.\n`);
  process.exit(1);
}
console.log('\nAll tokens clear their floor; all trims land on the cap height.\n');
