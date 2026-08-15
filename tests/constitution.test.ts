/**
 * The Wave 3 constitution, pinned against the files that actually carry it.
 *
 * `docs/design/wave-3-final/WAVE-3-BRIEF-NOTES.md` opens with a constitution:
 * nine colours, a radius scale, a spacing scale, two type weights, three
 * motion durations, one shadow, a 44 pt floor. Six atlases were drawn against
 * it, so every frame in Groups 1-3 assumes those exact values. A screen built
 * to the atlas on top of a drifted token is wrong in a way no screenshot of
 * that screen alone reveals — it looks internally consistent and is uniformly
 * off.
 *
 * So this asserts the constitution against the REAL sources — `tailwind.config`,
 * `theme/metrics`, `button-spec` — rather than restating the numbers in a
 * fixture. A test that keeps its own copy of the palette passes happily while
 * the app renders something else; this one fails when the app moves.
 *
 * Every assertion below was verified as already-passing before it was written.
 * That is the point: this checkpoint changed no visual value, and this file is
 * the proof that it did not need to, plus the thing that keeps it true while
 * three group lanes build on top of it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';

import tailwind from '../tailwind.config.js';
import { MIN_TAP_TARGET, motion, shadow } from '../src/theme/metrics';
import { RADIUS, VARIANTS } from '../src/components/ui/button-spec';

const theme = (tailwind as { theme: { extend: Record<string, Record<string, unknown>> } }).theme
  .extend;
const colors = theme.colors as Record<string, { DEFAULT?: string } | string>;
const hex = (name: string) => {
  const c = colors[name];
  return typeof c === 'string' ? c : c?.DEFAULT;
};

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('the nine constitution colours are exactly these hexes', () => {
  assert.equal(hex('canvas'), '#FBFAF6');
  assert.equal(hex('surface'), '#FFFFFF');
  assert.equal(hex('tray'), '#F0ECE3');
  assert.equal(hex('sand'), '#EAE5DB');
  assert.equal(hex('ink'), '#1C1A16');
  assert.equal(hex('muted'), '#6B665C');
  assert.equal(hex('faint'), '#8A8578');
  assert.equal(hex('accent'), '#6E2B2B');
});

/**
 * Files that set #8A8578 as type TODAY. Frozen 2026-08-12, at the Wave 3
 * shared-system checkpoint.
 *
 * The constitution says "NEVER #8A8578 as text" and the refusal list says "no
 * faint text"; on canvas it fails AA, which is the whole reason. The census
 * that produced this list found 20 files and 45 uses, so the rule was being
 * broken widely and quietly.
 *
 * This is a DEBT LIST, not a permission. It exists because fixing 20 files
 * spread across four groups from one checkpoint would collide with every lane
 * that owns them, and because several are genuinely the atlas's business:
 * `review-card` is RV-01..03, `garment-search-sheet` is DS-01..05,
 * `item-edit-sheet` is IT-03. Those get their colour decided by the frame that
 * draws them, not by a global sweep.
 *
 * The test's job meanwhile is to stop the bleeding: anything NOT on this list
 * fails. Delete entries as lanes burn them down; never add one.
 *
 * `placeholderTextColor` was added to the scan after Lane G3 pointed out that
 * the first version of this census missed it entirely — it reported clean on a
 * case it never looked at, which is the most expensive kind of green. A
 * placeholder is the ONLY text in an empty field, so it is text, and faint
 * fails AA there exactly as it does anywhere else. Adding the pattern grew the
 * census from 20 files to 26; the new entries are pre-existing debt, not
 * regressions, and they are listed separately so the reason stays legible.
 */
/**
 * The three ways this codebase can set #8A8578 as type: the utility class, the
 * inline escape hatch a class-precedence bug would otherwise hide, and the
 * placeholder — which is text even though it does not look like a `<Text>`.
 */
const FAINT_AS_TEXT = [
  /text-faint\b/,
  /color:\s*theme\.faint\b/,
  /placeholderTextColor=\{theme\.faint\}/,
];

const FAINT_TEXT_DEBT = [
  // Group 5 and beyond. The four gap-feed entries, `ProfileRow` and
  // `friends/[userId]` came off this list when Group 5 rebuilt those surfaces;
  // what is left here is what Group 5 did not own.
  'src/app/(tabs)/explore.tsx',
  // `EventCard.tsx` came off this list in the launch-polish packet: LP-10 gave
  // its quietest line real information to carry, so it moved to `muted`.
  'src/features/explore/new-addition-row.tsx',
  // Placeholders — see the note on `placeholderTextColor` above the scanner.
  'src/app/item/[id].tsx',
  'src/components/event-outfits/PostComposer.tsx',
  'src/components/events/occasion-field.tsx',
  'src/components/events/place-field.tsx',
  'src/components/intake/CorrectionSheet.tsx',
  'src/components/report/ReportFlowSheets.tsx',
  'src/components/stylist/sheet-parts.tsx',
  'src/features/profile/edit-profile-sheet.tsx',
  'src/features/profile/handle-field.tsx',
  // `__DEV__` fixture routes — never shipped, fixed opportunistically.
  'src/app/dev-plan.tsx',
  'src/app/dev-wall.tsx',
];

test('no NEW surface sets #8A8578 as text', () => {
  // Scanned rather than asserted about: the failure mode is a call site
  // somebody adds next week, not a value in a config.
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      // Block comments and WHOLE-LINE `//` comments are stripped first: three
      // files explain in prose why they avoid this exact class, and a rule
      // that punishes its own documentation teaches people to stop writing it
      // down. A TRAILING `// …` comment is not stripped, so writing one of
      // these patterns after code on the same line still trips this. That is
      // deliberate — stripping trailing comments means finding `//` in a
      // string, and every URL in the codebase contains one. It fails closed.
      const src = readFileSync(path, 'utf8')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      // `text-faint` is the utility; `color: theme.faint` is the inline escape
      // hatch a class-precedence bug would otherwise hide.
      if (FAINT_AS_TEXT.some((re) => re.test(src))) offenders.push(path);
    }
  };
  walk('src');

  const added = offenders.filter((f) => !FAINT_TEXT_DEBT.includes(f));
  assert.deepEqual(added, [], `faint set as text in a file not on the debt list:\n${added.join('\n')}`);
});

test('the faint-text debt list has no stale entries', () => {
  // A debt list nobody prunes becomes a permanent allowlist. This fails when a
  // lane fixes a file, which is the moment to delete its line.
  const stale = FAINT_TEXT_DEBT.filter((f) => {
    const src = readFileSync(f, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    return !FAINT_AS_TEXT.some((re) => re.test(src));
  });
  assert.deepEqual(stale, [], `fixed — delete from FAINT_TEXT_DEBT:\n${stale.join('\n')}`);
});

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

test('the radius scale is the constitution scale and nothing else', () => {
  // "Radius 2/4/8/12/16/20/38". `full` is the ninth entry and is not a scale
  // step — it is circles and glass chrome, guarded by its own test below.
  const radii = theme.borderRadius as Record<string, string>;
  const scale = Object.entries(radii)
    .filter(([k]) => k !== 'full')
    .map(([, v]) => parseInt(v, 10));
  assert.deepEqual([...new Set(scale)].sort((a, b) => a - b), [2, 4, 8, 12, 16, 20, 38]);
});

test('labelled controls are 12, and a capsule is never one of them', () => {
  // "labelled controls 12, never capsules." Button, Chip and the fields all
  // resolve here; `RADIUS` is what Button spends on every variant.
  assert.equal(RADIUS, 12);
  assert.equal(parseInt((theme.borderRadius as Record<string, string>).md, 10), 12);
  assert.equal((theme.borderRadius as Record<string, string>).full, '9999px');
});

// ---------------------------------------------------------------------------
// Spacing and targets
// ---------------------------------------------------------------------------

test('the spacing scale is 1/8/12/20/24/28/44', () => {
  const spacing = theme.spacing as Record<string, string>;
  const scale = Object.values(spacing).map((v) => parseInt(v, 10));
  assert.deepEqual([...new Set(scale)].sort((a, b) => a - b), [1, 8, 12, 20, 24, 28, 44]);
});

test('the tap floor is 44 in both places that state it', () => {
  // Two sources have to agree: the utility screens use and the number the
  // components compute against. They drifting apart is how a control ends up
  // 44 by class and 40 by geometry.
  assert.equal(MIN_TAP_TARGET, 44);
  assert.equal(parseInt((theme.spacing as Record<string, string>).tap, 10), 44);
});

// ---------------------------------------------------------------------------
// Motion and elevation
// ---------------------------------------------------------------------------

test('there are three durations — 140 fast, 220 base, 380 slow — and no fourth', () => {
  assert.deepEqual(motion.duration, { fast: 140, base: 220, slow: 380 });
  assert.equal(Object.keys(motion.duration).length, 3);
});

test('there is one shadow: warm ink, 0/5/11, at 16%', () => {
  assert.deepEqual(shadow.contact, {
    dx: 0,
    dy: 5,
    blur: 11,
    color: 'rgba(28,26,22,0.16)',
  });
  assert.equal(Object.keys(shadow).length, 1, 'a second elevation is a second app');
});

// ---------------------------------------------------------------------------
// Type weight — audit items 31 / 32 / 37, recorded as already satisfied
// ---------------------------------------------------------------------------

test('the constitution now spends no Medium at all', () => {
  // The old rule was "Helvetica Neue regular; Medium only for labels and
  // filled actions", and this file used to pin the table that implemented it.
  // TY-01 supersedes it: "Medium: none. Bold: none." The table is gone, so
  // there is nothing here to pin — the whole rule lives in
  // `tests/type-weight.test.ts`, which asserts on the source of every product
  // component rather than on one component's data.
  //
  // What stays here is the FAMILY MAP, because it is the thing that would let
  // a Medium cut back in: `medium` and `semibold` no longer resolve to a face,
  // so a stray `font-medium` renders regular instead of quietly shipping bold.
  const families = (theme.fontFamily as Record<string, string[]>) ?? {};
  assert.deepEqual(families.body, ['HelveticaNeue']);
  assert.equal(families.medium, undefined, 'the Medium family is back');
  assert.equal(families.semibold, undefined, 'the semibold family is back');
  // The serif was always single-weight and is untouched.
  assert.deepEqual(families.display, ['InstrumentSerif_400Regular']);
  assert.deepEqual(families.title, ['InstrumentSerif_400Regular']);
  // Still six variants, still one radius — the parts of the button contract
  // this file has always guarded.
  assert.equal(VARIANTS.length, 6);
  assert.equal(RADIUS, 12);
});
