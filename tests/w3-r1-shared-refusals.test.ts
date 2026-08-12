/**
 * Wave 3 · lane R1 — the shared primitives, and the refusals they were still
 * breaking after every screen above them had been corrected.
 *
 * ── WHY THESE ARE ONE FILE ────────────────────────────────────────────────
 *
 * Four unrelated-looking defects with one shape. A screen-level lane fixes the
 * surface it owns and leaves the primitive standing, because the primitive is
 * somebody else's file; the primitive then keeps the retired treatment alive as
 * something the NEXT screen can reach for. A bar nobody renders is still a bar
 * on the shelf. So these tests are about reachability, not about pixels: the
 * assertions are that the retired thing cannot be picked up again.
 *
 * The one behavioural test is `platedCostPerWear` against `outfitCostPerWear`,
 * because that defect was not a shape — it was a number that was wrong in a
 * flattering direction, and the dash it printed was the least of it.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';

import { outfitCostPerWear, platedCostPerWear } from '../src/components/today/cost-per-wear';
import { garment, resetIds } from './helpers';

/** Source with comments stripped — a file EXPLAINING a retirement is not one. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * "Is this file there?" via `readdirSync`, not `existsSync`.
 *
 * `tests/node-test-runtime.d.ts` declares only the handful of `node:fs` calls
 * the suite already uses, on purpose — widening it puts Node's surface into the
 * app's type space, which React Native does not have. That file belongs to the
 * integrator, so this lane answers the question with a call already declared
 * rather than raising a change to a shared file for one predicate.
 */
function has(dir: string, name: string): boolean {
  return readdirSync(dir).includes(name);
}

/** Every `.ts`/`.tsx` under `src`, so a census cannot miss a new folder. */
function sources(dir = 'src'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

// ── 1 · ProgressTrack is retired, not deprecated ───────────────────────────

test('the ProgressTrack module is gone from the kit', () => {
  // "Progress is a count, never a bar or percentage." A deprecation comment on
  // a file that still exports a working bar is not a retirement: the import
  // still resolves, and autocomplete still offers it.
  assert.equal(has('src/components/ui', 'progress-track.tsx'), false);
});

test('nothing in the app can import a progress bar any more', () => {
  const offenders = sources().filter((f) => /ProgressTrack|progress-track/.test(code(f)));
  assert.deepEqual(
    offenders,
    [],
    `a progress bar is reachable again from:\n${offenders.join('\n')}`,
  );
});

test('the comments that record WHY it went are not counted as bringing it back', () => {
  // The guard above strips comments precisely so this file's own prose, and
  // `capture.tsx`'s note, stay legal. If stripping ever breaks, this fails
  // loudly rather than the census quietly passing on an empty string.
  const withComments = readFileSync('src/features/ingest/queue-count.ts', 'utf8');
  assert.ok(/ProgressTrack/.test(withComments), 'the record of the retirement was deleted');
  assert.ok(!/ProgressTrack/.test(code('src/features/ingest/queue-count.ts')));
});

// ── 2 · repeat-outfit prints a cost per wear or prints nothing ─────────────

const REPEAT = 'src/app/repeat-outfit.tsx';

test('repeat-outfit prints no dash, in any dialect', () => {
  const src = code(REPEAT);
  // Em dash, en dash, and the hyphen a keyboard reaches for first. The refusal
  // is the placeholder, not one particular glyph.
  for (const dash of ['—', '–', "'-'", '"-"']) {
    assert.ok(!src.includes(dash), `a placeholder dash is back in ${REPEAT}: ${dash}`);
  }
});

test('repeat-outfit uses the STRICT cost per wear', () => {
  const src = code(REPEAT);
  assert.ok(/platedCostPerWear/.test(src), 'the strict function is not the one being called');
  assert.ok(
    !/outfitCostPerWear/.test(src),
    'the lenient sum is back — it prints a confident figure for a look it cannot price',
  );
});

test('the cost cell is BUILT, so an unknown figure removes its column', () => {
  const src = code(REPEAT);
  // The band must be assembled from a list guarded on the null, not laid out
  // as three fixed cells with a ternary inside one of them. IT-02: "Cost cell
  // removed, not blanked."
  assert.ok(/if \(cpw != null\)/.test(src), 'the cost cell is not conditional on the figure');
  assert.ok(/stats\.map\(/.test(src), 'the band is still three hand-placed cells');
});

test('the lenient sum is wrong in the flattering direction — which is the point', () => {
  resetIds();
  const priced = (price: number | null, wearCount: number) =>
    garment('base_top', 'navy', { purchasePrice: price, wearCount });

  // A four-piece look with one unpriced garment. The lenient function prints
  // the three it CAN price, under a heading that says what the outfit costs.
  const look = [priced(100, 4), priced(60, 3), priced(10, 5), priced(null, 2)];
  assert.equal(outfitCostPerWear(look), 47);
  // Not "0", not "—", not 47. Nothing.
  assert.equal(platedCostPerWear(look), null);

  // A never-worn piece is the same kind of unknown: its own rate is undefined.
  assert.equal(platedCostPerWear([priced(100, 4), priced(500, 0)]), null);

  // And when every piece IS priced and worn, the two agree exactly — the strict
  // rule removes figures, it does not change them.
  const whole = [priced(100, 4), priced(60, 3), priced(10, 5)];
  assert.equal(platedCostPerWear(whole), outfitCostPerWear(whole));
  assert.equal(platedCostPerWear(whole), 47);
});

// ── 3 · the retired plate skeleton ─────────────────────────────────────────

test('the kit no longer offers a plate-shaped wait with the old geometry', () => {
  const kit = code('src/components/ui/skeleton.tsx');
  assert.ok(!/export function PlateSkeleton/.test(kit));
  // The 5:4 well is the specific thing that went stale. A placeholder that
  // reserves a shape the real card no longer draws reflows the page at exactly
  // the moment the outfit lands.
  assert.ok(!/aspect-\[5\/4\]/.test(kit), 'the retired 5:4 garment well is back in the kit');
  assert.ok(!/from '@\/components\/ui\/card'/.test(kit), 'the Card import is orphaned');
});

test('the ui barrel exports no PlateSkeleton', () => {
  const barrel = code('src/components/ui/index.ts');
  assert.ok(!/PlateSkeleton/.test(barrel));
  assert.ok(!/ProgressTrack/.test(barrel));
  // The barrel still has to work for the primitives that stayed.
  for (const kept of ['Skeleton', 'ClosetGridSkeleton', 'ListSkeleton', 'RowSkeleton']) {
    assert.ok(new RegExp(`\\b${kept}\\b`).test(barrel), `${kept} was lost with the retirement`);
  }
});

test("Today's own plate skeleton is the one that survived", () => {
  // Not a duplicate of the assertion above: what makes deleting the kit's
  // version safe is that the plate has a wait state of its own, owned by the
  // lane that owns the plate's geometry.
  assert.ok(has('src/components/today', 'plate-skeleton.tsx'));
  assert.ok(/export function PlateSkeleton/.test(code('src/components/today/plate-skeleton.tsx')));
  // And it does not reach back into the kit for the retired one.
  assert.ok(!/from '@\/components\/ui\/skeleton'/.test(code('src/app/(tabs)/index.tsx')));
});

// ── 4 · the door plate names the door the app actually draws ───────────────

test('the shared door plate does not carry the retired voice-door name', () => {
  const raw = readFileSync('src/components/ui/door-plate.tsx', 'utf8');
  assert.ok(/Describe by voice/.test(raw), 'the current name is not stated on the primitive');
  // The retired name never reaches the rendered tree — no default, no example
  // prop, no fallback string.
  assert.ok(!/Talk it in/.test(code('src/components/ui/door-plate.tsx')));
  // In prose it survives only as the thing being retired, and the file has to
  // say so. Audit 66: "The voice door is Describe by voice; 'Talk it in'
  // appears nowhere in the group." A comment on the SHARED primitive is what a
  // new door gets copied from, which is why the stale name mattered more here
  // than on any one screen.
  if (/Talk it in/.test(raw)) {
    assert.ok(
      /nowhere in the group/.test(raw),
      'the retired door name is named without being retired',
    );
  }
});

// ── 5 · the grounded button height did not move ────────────────────────────

test('GROUNDED_HEIGHT stays 52 — the atlas 48 is per-frame, not the default', () => {
  const src = readFileSync('src/components/ui/button-spec.ts', 'utf8');
  assert.ok(/export const GROUNDED_HEIGHT = 52;/.test(src));
  // The reading is recorded next to the value, so the next lane that meets a
  // 48 pt row in the First-Run atlas does not re-open it from scratch. The
  // atlas's own component inventory lists "48 / 52 / 56 pt" for one filled
  // button, which is what makes 48 a frame's choice rather than the default.
  assert.ok(/48 \/ 52 \/ 56 pt/.test(src), 'the atlas reading was dropped from the constant');
});
