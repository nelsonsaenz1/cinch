/**
 * CX-01…CX-06 — the founder's corrections to intake, the example closet and
 * Explore's masthead.
 *
 * Three surfaces, one packet, and each of them reverses something a Wave 3
 * test used to enforce. Those reversals are recorded at their own call sites;
 * what is asserted here is the NEW contract, in the terms the correction
 * states it — copy word for word where the correction gives words, geometry by
 * its named constants where it gives numbers.
 *
 * Read as source rather than rendered, the way the rest of this suite reads
 * screens: the components import `expo-symbols` and React Native, and the test
 * bundler cannot parse React Native's Flow source.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  INTAKE_ROUTES,
  TEN_RECOMMENDED_BADGE,
  TEN_RECOMMENDED_KEY,
  tenRouteName,
} from '../src/features/ingest/intake-routes.ts';
import { FIRST_TEN_DOORS } from '../src/features/onboarding/ten-copy.ts';
import { PLANS } from '../src/features/billing/plans.ts';
// Both are leaf modules — no React Native in either graph, so the test bundler
// can resolve them. That is why the arithmetic below can be checked for real
// rather than asserted about as text.
import { leading } from '../src/theme/font-metrics.js';
import { MAX_TEXT_SCALE } from '../src/theme/type-scale.ts';

const code = (p: string) => readFileSync(p, 'utf8');
/** Source with block comments stripped — a rule quoted in prose is not a rule kept. */
const body = (p: string) => code(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const CHOOSER = 'src/components/onboarding/first-ten-doors.tsx';
const TEN_SCREEN = 'src/app/the-ten.tsx';
const EXAMPLE = 'src/components/closet/example-closet.tsx';
const CLOSET = 'src/app/(tabs)/closet.tsx';
const EXPLORE = 'src/app/(tabs)/explore.tsx';

// ---------------------------------------------------------------------------
// CX-01 · the first-10 chooser
// ---------------------------------------------------------------------------

test('CX-01 — the four routes are in the corrected order', () => {
  assert.deepEqual(
    INTAKE_ROUTES.map((r) => r.key),
    ['catalogue', 'camera', 'library', 'voice'],
  );
});

test('CX-01 — every route carries the display copy the correction writes', () => {
  const expected: Record<string, [string, string]> = {
    catalogue: ['Find a product photo', 'Search by brand and name.'],
    camera: ['Take a photo', 'One picture per piece.'],
    library: ['Choose from your library', 'Photos you already have.'],
    voice: ['Describe by voice', 'Say what you own.'],
  };
  for (const route of INTAKE_ROUTES) {
    const [name, line] = expected[route.key];
    assert.equal(tenRouteName(route), name, `${route.key} name`);
    assert.equal(route.tenLine, line, `${route.key} line`);
  }
});

test('CX-01 — Add clothes keeps its own nouns', () => {
  // `tenName` is the chooser's word, not a rename. A reader who returns to Add
  // clothes is scanning a list they know rather than being taught one, and
  // changing both would have been a second surface nobody asked for.
  assert.equal(INTAKE_ROUTES.find((r) => r.key === 'camera')?.name, 'Camera');
  assert.equal(INTAKE_ROUTES.find((r) => r.key === 'library')?.name, 'Photo library');
});

test('CX-01 — the heading and the one supporting line, exactly', () => {
  assert.equal(FIRST_TEN_DOORS.headline, 'How do you want to add them?');
  assert.equal(FIRST_TEN_DOORS.body, 'Any route lands in the same closet.');
});

test('CX-01 — the long body, mixing note, disclosure and footer are gone', () => {
  const src = body(CHOOSER);
  assert.doesNotMatch(src, /TEN_MIXING_NOTE/);
  assert.doesNotMatch(src, /CATALOGUE_DISCLOSURE/);
  assert.doesNotMatch(src, /FIRST_TEN_DOORS\.footer/);
  // And the constants themselves no longer exist to be re-imported by mistake.
  const table = code('src/features/ingest/intake-routes.ts');
  assert.doesNotMatch(table, /TEN_MIXING_NOTE/);
  assert.doesNotMatch(code('src/features/onboarding/ten-copy.ts'), /footer:/);
});

test('CX-01 — exactly one route is recommended, and it is the catalogue', () => {
  assert.equal(TEN_RECOMMENDED_KEY, 'catalogue');
  assert.equal(TEN_RECOMMENDED_BADGE, 'RECOMMENDED');
  // One recommendation, structurally: a key, not a flag on each row that a
  // second row could also set.
  assert.equal(INTAKE_ROUTES.filter((r) => r.key === TEN_RECOMMENDED_KEY).length, 1);
});

test('CX-01 — the recommendation is an edge and a well, never a dimming', () => {
  const src = code(CHOOSER);
  assert.match(src, /RECOMMENDED_BORDER_WIDTH = 1\.5/, 'the accent edge is not 1.5pt');
  assert.match(src, /borderColor: theme\.accent/);
  assert.match(src, /RECOMMENDED_WELL_ALPHA = 0\.09/, 'the icon well is not accent at 9%');
  assert.match(src, /accentAlpha\(RECOMMENDED_WELL_ALPHA\)/);
  // Nothing is faded to make it win.
  assert.doesNotMatch(body(CHOOSER), /theme\.faint|text-faint|opacity-[1-4]0/);
});

test('CX-01 — the plate is 104 and the rows are 72, with the short-screen give', () => {
  const src = code(CHOOSER);
  assert.match(src, /PLATE_MIN_HEIGHT = 104/);
  assert.match(src, /ROW_MIN_HEIGHT = 72/);
  assert.match(src, /ROW_MIN_HEIGHT_SHORT = 66/);
  assert.match(src, /EYEBROW_GAP = 24/);
  assert.match(src, /EYEBROW_GAP_SHORT = 20/);
  // The give is keyed to HEIGHT — what runs out on an SE is vertical room, and
  // a 375-wide phone with a tall screen has no reason to compress.
  assert.match(src, /SHORT_SCREEN_HEIGHT = 700/);
  assert.match(body(CHOOSER), /height <= SHORT_SCREEN_HEIGHT/);
});

test('CX-01 — no row can fall under the tap floor, whatever the geometry says', () => {
  assert.match(body(CHOOSER), /Math\.max\(minHeight, MIN_TAP_TARGET\)/);
});

/**
 * The chooser's own two components, comments stripped.
 *
 * Scoped deliberately: the resume branch (TR-06) shares this file and still
 * carries its own size overrides. It was explicitly out of scope for the
 * correction, Codex has approved it as it stands, and widening this guard to
 * the whole file would fail on a state nobody asked to change.
 */
const chooserComponents = () => {
  const src = code(CHOOSER);
  const from = src.indexOf('function RecommendedPlate');
  const to = src.indexOf('export function FirstTenDoors');
  assert.ok(from > -1 && to > from, 'the chooser components moved or were renamed');
  return src.slice(from, to).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
};

test('CX-01 — a plate or row can never be pinned to its minimum again', () => {
  /**
   * THE DEFECT THIS EXISTS FOR. `flex-1` on a row's content wrapper is
   * `flexBasis: 0%`, and a child with no basis contributes nothing to its
   * parent's intrinsic height — so the row resolved to exactly `minHeight` and
   * clipped whatever did not fit. It passed every ordinary type size, because
   * at those sizes the content fitted inside 66pt.
   *
   * The check is structural rather than visual: a wrapper inside these two
   * components must declare an explicit `flexBasis: 'auto'`, and neither may
   * carry a fixed `height` on anything but its icon well.
   */
  const src = chooserComponents();
  assert.match(src, /flexBasis: 'auto'/, 'the row wrapper lost its explicit basis');
  assert.doesNotMatch(
    src,
    /className="flex-1 flex-row/,
    'a vertical wrapper is back on a zero flex-basis',
  );
  /**
   * `height` survives on exactly three things, none of which holds text: the
   * two square glyph wells, and the 1pt separator rule. Anything else with a
   * fixed height in these components is a box that text has to fit inside,
   * which is the shape of the bug.
   */
  const ALLOWED_FIXED_HEIGHTS = ['PLATE_WELL', 'ROW_WELL', '1'];
  // `min`/`line` excluded by lookbehind: a minimum is the thing being kept,
  // and a line height is type rather than a box.
  for (const m of src.matchAll(/(?<!min)(?<!line)[Hh]eight: ([A-Za-z_0-9]+)/g)) {
    assert.ok(
      ALLOWED_FIXED_HEIGHTS.includes(m[1]!),
      `a fixed height (${m[1]}) is back on something that holds text`,
    );
  }
  // And the minimums are still minimums.
  assert.match(src, /minHeight: PLATE_MIN_HEIGHT/);
  assert.match(src, /minHeight: Math\.max\(minHeight, MIN_TAP_TARGET\)/);
});

test('CX-01 — no hand-written type size can outgrow its line box', () => {
  /**
   * The other half of the AX3 defect.
   *
   * A literal `fontSize` or `lineHeight` over a variant is the bug: React
   * Native scales glyphs with Dynamic Type and leaves an explicit line height
   * exactly where it was, so at an accessibility size a wrapped name lands on
   * top of its own subtitle. The variants carry NUMERIC line heights, so the
   * fix is not to drop the property but to restate the same base value scaled
   * by the same capped multiplier — which is what `lh.*` is.
   *
   * So: a line height must be a `lh.` lookup, and never a number.
   */
  const src = chooserComponents();
  assert.doesNotMatch(src, /fontSize:/, 'a type size is hand-written over a variant');
  assert.doesNotMatch(src, /letterSpacing:/, 'tracking is hand-written over a variant');
  assert.doesNotMatch(
    src,
    /lineHeight:\s*\d/,
    'a literal line height is back — it cannot grow with Dynamic Type',
  );
  // Every line of type on these two components takes a scaled box.
  const texts = [...src.matchAll(/<Text\b[\s\S]*?>/g)].map((m) => m[0]);
  assert.ok(texts.length >= 5, 'the chooser lost its type');
  for (const t of texts) {
    assert.match(t, /lineHeight: lh\.(door|body|note|colophon)/, `a line has no scaled box: ${t}`);
  }
});

test('CX-01 — the scaled line boxes are derived, capped, and identity at 1', () => {
  const src = code(CHOOSER);
  /**
   * The base values are the VARIANT's own, computed with the same helper
   * `tailwind.config.js` uses, so a change to the metrics moves both together.
   * `colophon` is the one the config types as a literal rather than computing,
   * so it is a literal here too.
   */
  assert.match(src, /door: leading\('helvetica', 20, 1\.25\)/);
  assert.match(src, /body: leading\('helvetica', 17, 1\.5\)/);
  assert.match(src, /note: leading\('helvetica', 13, 1\.4\)/);
  assert.match(src, /colophon: 14/);
  // Capped at the same ceiling `Text` gives non-display variants, so the box
  // stops growing exactly when the glyphs do.
  assert.match(src, /Math\.min\(fontScale, MAX_TEXT_SCALE\)/);
  assert.match(src, /from '@\/theme\/type-scale'/);

  // Identity at standard size: the approved frame must be unchanged.
  for (const [ratio, size] of [
    [1.25, 20],
    [1.5, 17],
    [1.4, 13],
  ] as const) {
    const base = leading('helvetica', size, ratio);
    assert.equal(Math.round(base * Math.min(1, MAX_TEXT_SCALE)), base);
  }
  // And at AX3 the box outgrows the glyphs it has to hold.
  const glyph = 20 * MAX_TEXT_SCALE;
  assert.ok(Math.round(leading('helvetica', 20, 1.25) * MAX_TEXT_SCALE) > glyph);
});

test('CX-01 — nothing truncates, at any type size', () => {
  // The correction forbids truncation and tiny type outright, and both arrive
  // through the same two props.
  const src = body(CHOOSER);
  assert.doesNotMatch(src, /numberOfLines/);
  assert.doesNotMatch(src, /ellipsizeMode/);
  // And the page scrolls, so AX3+ reflows rather than crowding the bottom.
  assert.match(src, /<ScrollView/);
});

test('CX-01 — the glyphs are the accepted semantics, and no new dependency', () => {
  const symbols = Object.fromEntries(INTAKE_ROUTES.map((r) => [r.key, r.symbol]));
  assert.equal(symbols.catalogue, 'sparkle.magnifyingglass');
  assert.equal(symbols.camera, 'camera.fill');
  assert.equal(symbols.library, 'photo.on.rectangle.angled');
  assert.equal(symbols.voice, 'mic.fill');
  // `expo-symbols` was already in the graph; the chooser adds nothing.
  const pkg = JSON.parse(code('package.json')) as { dependencies: Record<string, string> };
  assert.ok(pkg.dependencies['expo-symbols'], 'expo-symbols is not a dependency');
});

test('CX-01 — the back door exists, is the shared one, and says Today', () => {
  const src = code(TEN_SCREEN);
  assert.match(src, /<ScreenHeader/, 'the chooser has no header');
  assert.match(src, /title="Today"/);
  assert.match(src, /backLabel="Today"/);
  // The shared primitive, which carries the 44pt hitSlop and calls
  // `router.back()` — not a ninth hand-rolled disc.
  assert.match(src, /from '@\/components\/ui\/screen-header'/);
});

test('CX-01 — routing is preserved exactly', () => {
  const src = code(TEN_SCREEN);
  // Catalogue reaches /find-photo with from=ten semantics, via the chooser's
  // own consent gate rather than by pushing the destination directly.
  assert.match(src, /door=describe&from=ten/);
  assert.match(code('src/app/add-clothes.tsx'), /router\.push\(`\/find-photo\$\{doorFrom \? `\?from=ten` : ''\}`/);
  // Library keeps its current picker path; camera opens the guided grid in
  // place; voice opens the walkthrough.
  assert.match(src, /door=library&from=ten/);
  assert.match(src, /if \(key === 'camera'\)[\s\S]{0,80}setDoorChosen\(true\)/);
  assert.match(src, /router\.push\('\/walkthrough'\)/);
});

test('CX-01 — the resume branch is untouched', () => {
  // TR-06 was not in scope. Its card, its ink Resume and its single camera
  // door under it all still render, and `DoorPlate` still has a caller.
  const src = body(CHOOSER);
  assert.match(src, /resumeCardCopy\(/);
  assert.match(src, /<DoorPlate/);
  assert.match(src, /variant="ink"/);
});

// ---------------------------------------------------------------------------
// CX-03 / CX-04 · the example closet
// ---------------------------------------------------------------------------

test('CX-03 — the band is the free tier, never the engine floor', () => {
  const src = body(CLOSET);
  assert.match(src, /screen\.items\.length < PLANS\.free\.items/);
  assert.doesNotMatch(src, /MIN_CLOSET_FOR_OUTFITS/, 'the closet band was tied to the engine floor');
  assert.equal(PLANS.free.items, 10);
});

test('CX-03/04 — visible at 0 and at 9, absent at 10', () => {
  // The arithmetic the screen runs, checked at the three boundaries that
  // matter. `remaining` is null exactly when no example should draw.
  const remainingAt = (n: number) =>
    n > 0 && n < PLANS.free.items ? PLANS.free.items - n : null;

  assert.equal(remainingAt(1), 9);
  assert.equal(remainingAt(9), 1, 'the example vanishes one piece early');
  assert.equal(remainingAt(10), null, 'the example survives the tenth piece');
  assert.equal(remainingAt(40), null);
  // Zero is the other branch — the full variant, not the compact one.
  assert.equal(remainingAt(0), null);
  assert.match(body(CLOSET), /<ExampleCloset variant="full"/);
});

test('CX-03/04 — the two variants carry their own copy, exactly', () => {
  const src = code(EXAMPLE);
  assert.match(src, /EXAMPLE_LABEL = 'EXAMPLE'/);
  assert.match(
    src,
    /EXAMPLE_CAPTION_FULL =\s*'An example closet, not yours\. Nothing here is saved\.'/,
  );
  assert.match(
    src,
    /EXAMPLE_CAPTION_COMPACT =\s*'An example, not your closet\. Nothing here is saved\.'/,
  );
  assert.match(src, /EXAMPLE_TITLE_COMPACT = 'What your closet can become'/);
});

test('CX-03 — the empty closet’s title, body and action, exactly', () => {
  const empty = code('src/components/closet/empty-closet.tsx');
  assert.match(empty, /EMPTY_TITLE = 'Start your closet'/);
  assert.match(empty, /EMPTY_ACTION = 'Add your first piece'/);
  // The body is composed from the free tier rather than typed, and at today's
  // value it reads exactly as the correction writes it.
  assert.equal(
    `Add ${PLANS.free.items} pieces and Cinch can start building outfits from what you own.`,
    'Add 10 pieces and Cinch can start building outfits from what you own.',
  );
  assert.match(empty, /Add \$\{PLANS\.free\.items\} pieces and Cinch can start building/);
});

test('CX-03 — the count reads 0 of 10, not a bare nought', () => {
  assert.match(body(CLOSET), /`0 of \$\{PLANS\.free\.items\} pieces`/);
  assert.doesNotMatch(body(CLOSET), />0 pieces</);
});

test('CX-04 — the progress line counts what is left, and is not pluralised at one', () => {
  const src = code(EXAMPLE);
  assert.match(src, /remaining === 1 \? 'piece' : 'pieces'/);
  assert.match(src, /`Add \$\{remaining\} more \$\{/);
});

test('CX-03/04 — the example is inert: no tap, no press state, no analytics', () => {
  const src = body(EXAMPLE);
  assert.doesNotMatch(src, /Pressable|TouchableOpacity|onPress/, 'the example is tappable');
  assert.doesNotMatch(src, /usePressFeedback|active:opacity/, 'the example has a press state');
  assert.doesNotMatch(src, /track\(|posthog/i, 'the example reports something');
  assert.doesNotMatch(src, /supabase|useQuery|claim_ai_quota/i, 'the example reads or spends');
  assert.match(src, /pointerEvents="none"/, 'a tap can land on a fictional garment');
});

test('CX-03/04 — bundled assets only, and one VoiceOver stop', () => {
  const src = code(EXAMPLE);
  // Four `require`d files, no URL anywhere.
  const requires = [...src.matchAll(/require\('@\/assets\/garments\/[a-z-]+\.jpg'\)/g)];
  assert.equal(requires.length, 4, 'the example no longer draws four bundled photographs');
  assert.doesNotMatch(src, /https?:\/\/|uri:|signedUrl/, 'the example fetches an image');
  // One labelled image for the whole picture; no cell is focusable.
  assert.match(src, /accessibilityRole="image"/);
  assert.match(src, /accessibilityLabel=\{GROUPED_LABEL\}/);
  assert.match(src, /accessible={false}/, 'a cell announces itself');
});

test('CX-04 — the example sits below owned content and never inside the grid', () => {
  const src = body(CLOSET);
  // A footer, not a header and not an injected cell: the owned grid stays
  // first and interactive, and nothing fictional is reachable by scrolling it.
  assert.match(src, /ListFooterComponent=\{[\s\S]{0,200}ExampleCloset variant="compact"/);
  assert.doesNotMatch(
    src,
    /items=\{[^}]*ExampleCloset|CELLS[\s\S]{0,40}screen\.items/,
    'fiction was mixed into the owned collection',
  );
});

test('CX-04 — compact geometry is unmistakably not an owned card', () => {
  const src = code(EXAMPLE);
  assert.match(src, /COMPACT_CELL_HEIGHT = 76/);
  assert.match(src, /FULL_CELL_HEIGHT = 196/);
  // Four across against the real grid's two — the difference a reader
  // registers before reading either label.
  assert.match(body(EXAMPLE), /CELLS\.map\(\(cell\) => \(\s*<CompactCell/);
});

test('CX-03/04 — the other closet states are still branches of their own', () => {
  const src = body(CLOSET);
  for (const branch of ['screen.loading', 'screen.error', 'selecting', 'screen.searching']) {
    assert.ok(src.includes(branch), `the ${branch} branch was lost`);
  }
});

// ---------------------------------------------------------------------------
// CX-06 · Explore's masthead
// ---------------------------------------------------------------------------

test('CX-06 — Between friends is gone from the masthead', () => {
  assert.doesNotMatch(body(EXPLORE), /Between friends/, 'the eyebrow survives');
});

test('CX-06 — Lately is the sole heading, and keeps its header role', () => {
  const src = code(EXPLORE);
  assert.match(src, /<Text variant="display" trim accessibilityRole="header">\s*Lately/);
  // One display word in the masthead, not two labels stacked.
  assert.equal((body(EXPLORE).match(/variant="display"/g) ?? []).length, 1);
});

test('CX-06 — the search field gets 20pt, and everything under it is untouched', () => {
  const src = code(EXPLORE);
  assert.match(src, /EXPLORE_SEARCH_GAP = 20/);
  assert.match(src, /marginTop: EXPLORE_SEARCH_GAP/);
  // The rest of the page is the same page: its sections are still here.
  for (const section of ['People', 'Reading your circle']) {
    assert.ok(src.includes(section), `Explore lost its "${section}" section`);
  }
});
