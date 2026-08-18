/**
 * CI-01…CI-03 — the Closet at exactly zero pieces, as the person's profile.
 *
 * The one product change in this packet is an ORDER: identity, then the
 * example closet, then the starter card. Order is the hardest thing to keep,
 * because nothing type-checks it and every later edit to the branch can quietly
 * move a block — so most of what is asserted here is sequence and separation,
 * read out of the source rather than out of a render.
 *
 * Source rather than rendered, like the rest of this suite: the screen imports
 * `@shopify/flash-list`, `expo-symbols` and React Native, and the test bundler
 * cannot parse React Native's Flow source. What that costs is real — none of
 * this proves a layout pass — and it is why CI-01/CI-02 are also shot on the
 * simulator at 393×852 and 375×667.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CLOSET_COPY } from '../src/features/closet/closet-spec';

// Leaf modules — no React Native anywhere in either graph, so the arithmetic
// below is checked for real rather than asserted about as text.
import { leading } from '../src/theme/font-metrics.js';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '../src/theme/type-scale.ts';
import { PLANS } from '../src/features/billing/plans.ts';
// The zero block's copy and its line-box arithmetic — a leaf module precisely
// so this file can import it. The component beside it imports React Native and
// is read as source below, like every other screen in this suite.
import {
  EDIT_PROFILE_LABEL,
  EDIT_TAP_TARGET_LARGE,
  ZERO_BIO_CUE,
  ZERO_NAME_FALLBACK,
  zeroLeading,
} from '../src/features/closet/zero-identity.ts';

const code = (p: string) => readFileSync(p, 'utf8');
/** Source with comments stripped — a rule quoted in prose is not a rule kept. */
const stripped = (p: string) =>
  code(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const CLOSET = 'src/app/(tabs)/closet.tsx';
const HEADER = 'src/components/closet/zero-identity-header.tsx';
const EMPTY = 'src/components/closet/empty-closet.tsx';

/**
 * Just the zero branch of the screen — from its `items.length === 0` test to
 * the selection branch that follows it.
 *
 * Scoped deliberately: every assertion below is about what the EMPTY closet
 * draws, and a whole-file search would happily pass on a `ZeroIdentityHeader`
 * that had drifted into the 1–9 masthead instead.
 */
const zeroBranch = () => {
  const src = stripped(CLOSET);
  const from = src.indexOf('screen.items.length === 0');
  const to = src.indexOf('} else if (selecting)');
  assert.ok(from > -1 && to > from, 'the zero branch moved or was renamed');
  return src.slice(from, to);
};

// ---------------------------------------------------------------------------
// CI-01 · the person is the first thing on the page
// ---------------------------------------------------------------------------

test('CI-01 — the zero closet draws the identity block and the real editor', () => {
  const branch = zeroBranch();
  assert.match(branch, /<ZeroIdentityHeader/);
  // The SAME sheet the rest of the app opens. `setEditing` is what mounts
  // `EditProfileSheet` at the bottom of this screen; a second editor, or an
  // inline form, would not go through it.
  assert.match(branch, /onEditProfile=\{\(\) => screen\.setEditing\(true\)\}/);
  assert.doesNotMatch(branch, /TextInput/);
});

test('CI-01 — the identity is the account’s own, never a fixture', () => {
  const branch = zeroBranch();
  for (const prop of ['name', 'handleLine', 'bio', 'avatarUrl']) {
    // Each field reads off `screen`, which reads off the profile row. A string
    // literal on any of these props would be a fictional person.
    assert.match(
      branch,
      new RegExp(`${prop}=\\{screen\\.`),
      `${prop} must come from the signed-in account`,
    );
  }
});

test('CI-01 — the four figures are numbers, and never an em dash', () => {
  const branch = zeroBranch();
  // C-01's strip renders `undefined` as an em dash, which means "not known
  // yet". This state is pre-activation, not loading: the two figures that
  // arrive asynchronously are coalesced so a first launch shows four zeroes
  // rather than four dashes — while an account that genuinely has friends
  // still prints the number it has.
  assert.match(branch, /outfits: screen\.stats\.outfits \?\? 0/);
  assert.match(branch, /followers: screen\.stats\.followers \?\? 0/);
  // And the two that are already numbers are passed straight through, not
  // hard-coded to nought.
  assert.match(branch, /pieces: screen\.stats\.pieces/);
  assert.match(branch, /unworn: screen\.stats\.unworn/);
});

test('CI-01 — the strip is the same four columns the filled closet uses', () => {
  // Reused, not reimplemented: a reader who fills their closet must watch
  // these numbers move rather than watch a different component replace them.
  const header = stripped(HEADER);
  assert.match(header, /import \{ StatRow \}/);
  assert.match(header, /<StatRow/);
  // CI-03's readable stats, opted into here and nowhere else.
  assert.match(header, /growWithType/);
});

test('CI-03 — the strip’s scaled line boxes are opt-in, and off by default', () => {
  const row = stripped('src/components/closet/stat-row.tsx');
  // Default off is what keeps the filled closet's masthead out of this packet:
  // at scale 1 the two paths are identical anyway, and above it they differ.
  assert.match(row, /growWithType = false/);
  // Under `grow`, both lines take a computed box and the fixed trim table
  // comes off the figure — a scaled subtraction from an unscaled box is not
  // the same thing as a scaled box.
  assert.match(row, /trim=\{!grow\}/);
  assert.match(row, /lineHeight: figureBox/);
  assert.match(row, /lineHeight: grow \? labelBox : 12/);
  // Derived from the same helper the variant is built with, capped per role.
  assert.match(row, /leading\('instrument', 24, 1\.08\)/);
  assert.match(row, /Math\.min\(fontScale, MAX_DISPLAY_SCALE\)/);
  assert.match(row, /Math\.min\(fontScale, MAX_TEXT_SCALE\)/);
});

// ---------------------------------------------------------------------------
// CI-01 · the order, and the separation
// ---------------------------------------------------------------------------

test('CI-01 — identity, then the example, then the starter card', () => {
  const branch = zeroBranch();
  const identity = branch.indexOf('<ZeroIdentityHeader');
  const example = branch.indexOf('<ExampleCloset');
  const starter = branch.indexOf('<EmptyCloset');
  assert.ok(identity > -1 && example > -1 && starter > -1, 'a block left the zero branch');
  assert.ok(identity < example, 'the person comes before the example closet');
  assert.ok(example < starter, 'the example comes before the invitation');
});

test('CI-01 — the example and the starter are each separated by the same stated gap', () => {
  const branch = zeroBranch();
  // Both gaps, by name rather than by a repeated literal: they are one
  // decision, and two numbers that happen to agree today will not tomorrow.
  const gaps = branch.match(/marginTop: ZERO_BLOCK_GAP/g) ?? [];
  assert.equal(gaps.length, 2, 'both the example and the starter card take the block gap');
  assert.match(code(CLOSET), /const ZERO_BLOCK_GAP = 26;/);
});

test('CI-01 — the starter card is stacked, so the gap above it is the one stated', () => {
  // Centred, `EmptyCloset`'s own `flex-1` absorbs the leftover height and the
  // 26pt above it becomes whatever is left over instead.
  assert.match(zeroBranch(), /<EmptyCloset\s+flow="stacked"/);
});

test('CI-01 — the starter card keeps its approved words and its existing route', () => {
  const branch = zeroBranch();
  // Read as source: the card imports React Native. The words are unchanged
  // from CX-03, and the body is still composed from the free tier's own
  // ceiling rather than a typed ten.
  const empty = code(EMPTY);
  // Redesign 14 aligned this to the activation copy: Today's floor, The Ten
  // and the free plan all say TEN, and this screen — the one place somebody
  // arrives with nothing — said a number-free encouragement instead. It is
  // derived from `CLOSET_COPY` now, so the two cannot drift.
  assert.match(empty, /EMPTY_TITLE = CLOSET_COPY\.emptyTitle/);
  assert.equal(CLOSET_COPY.emptyTitle, 'Start with ten pieces');
  assert.match(empty, /EMPTY_ACTION = 'Add your first piece'/);
  assert.match(empty, /`Add \$\{PLANS\.free\.items\} pieces and Cinch can start building outfits from what you own\.`/);
  assert.equal(PLANS.free.items, 10);
  assert.match(branch, /router\.push\('\/add-clothes'\)/);
});

// ---------------------------------------------------------------------------
// CI-01 · the example stays the example
// ---------------------------------------------------------------------------

test('CI-01 — the example is the bundled full variant, and says so once', () => {
  assert.match(zeroBranch(), /<ExampleCloset variant="full" \/>/);

  const example = stripped('src/components/closet/example-closet.tsx');
  // The visible badge and the grouped VoiceOver summary are the two places the
  // fixture names itself as fiction. A third — the caption that used to sit
  // under the photographs — took space from the closet without adding clarity,
  // and CI-01 keeps it retired.
  assert.match(example, /EXAMPLE_LABEL = 'EXAMPLE'/);
  assert.doesNotMatch(example, /An example closet, not yours/);
  // The grouped label may still say it, because it is spoken rather than seen.
  assert.match(code('src/components/closet/example-closet.tsx'), /Example closet, not yours\./);

  // Still inert. A photograph of a garment nobody owns must not be tappable.
  assert.doesNotMatch(example, /Pressable|onPress/);
  assert.match(example, /pointerEvents="none"/);
});

test('CI-01 — the badge and the heading come BEFORE the photographs', () => {
  // The defect this closes: the full variant drew the grid first and the badge
  // underneath it, so four photographs of clothes arrived with nothing above
  // them saying whose. On the one screen where the reader owns nothing, that
  // can read for a beat as their own closet. A label that arrives after the
  // thing it labels is a correction, not a caption.
  const example = stripped('src/components/closet/example-closet.tsx');
  const render = example.slice(example.indexOf('export function ExampleCloset'));

  const badge = render.indexOf('<ExampleBadge');
  const heading = render.indexOf('EXAMPLE_TITLE');
  const grid = render.indexOf('accessibilityLabel={GROUPED_LABEL}');
  assert.ok(badge > -1 && heading > -1 && grid > -1, 'a block left the example');
  assert.ok(badge < heading, 'the badge names the block before the heading does');
  assert.ok(heading < grid, 'the heading arrives before the photographs');

  // ONE badge, in one place, for both variants — the second one under the full
  // grid is gone rather than moved, and neither variant may branch on it.
  assert.equal((render.match(/<ExampleBadge/g) ?? []).length, 1);
  assert.doesNotMatch(render, /compact \? \(\s*<>\s*<ExampleBadge/);
});

test('CI-01 — the heading is one string, shared by both variants', () => {
  assert.match(
    code('src/components/closet/example-closet.tsx'),
    /EXAMPLE_TITLE = 'What your closet can become'/,
  );
  // Renamed from `EXAMPLE_TITLE_COMPACT`: it is no longer the compact
  // variant's alone, and a name that says otherwise is the next reader's bug.
  // Comments stripped — the old name survives in the docblock that records
  // the rename, which is exactly where it should survive.
  assert.doesNotMatch(stripped('src/components/closet/example-closet.tsx'), /EXAMPLE_TITLE_COMPACT/);
});

// ---------------------------------------------------------------------------
// CI-02 · every optional field is allowed to be missing
// ---------------------------------------------------------------------------

test('CI-02 — the fallbacks are exactly the ones the correction names', () => {
  assert.equal(ZERO_NAME_FALLBACK, 'Your closet');
  assert.equal(ZERO_BIO_CUE, 'Add your name and photo so friends recognise you.');

  const header = stripped(HEADER);
  // Falsy name and falsy bio both fall back; a whitespace-only bio is not a bio.
  assert.match(header, /name\?\.trim\(\) \|\| ZERO_NAME_FALLBACK/);
  assert.match(header, /bio\?\.trim\(\) \|\| ZERO_BIO_CUE/);
  // The monogram, never a stock face — and an absent handle draws no row at all
  // rather than an empty one holding space.
  assert.match(header, /<Avatar[\s\S]*?fallback="\?"/);
  assert.match(header, /handleLine \? \(/);
});

test('CI-02 — the way to fix a bare profile stays findable and tappable', () => {
  const header = stripped(HEADER);
  assert.equal(EDIT_PROFILE_LABEL, 'Edit profile');
  // Full width, labelled, and never below the 44pt floor.
  assert.match(header, /minHeight: large \? EDIT_TAP_TARGET_LARGE : MIN_TAP_TARGET/);
  assert.equal(EDIT_TAP_TARGET_LARGE, 56);
  assert.match(header, /className="mx-gutter[^"]*"/);
});

// ---------------------------------------------------------------------------
// CI-03 · nothing clips at accessibility sizes
// ---------------------------------------------------------------------------

test('CI-03 — every hand-set size carries a line box that scales with it', () => {
  const header = stripped(HEADER);

  // React Native scales `fontSize` with Dynamic Type and leaves an explicit
  // numeric `lineHeight` exactly where it found it. A literal here would be a
  // line box built for the standard size, and at AX3 the glyphs overflow it and
  // wrapped lines overlap — the defect this whole guard exists to prevent.
  assert.doesNotMatch(header, /lineHeight:\s*\d/);

  // Every `<Text>` in the block takes one of the three computed boxes.
  const texts = header.match(/<Text[\s\S]*?>/g) ?? [];
  assert.ok(texts.length >= 3, 'the identity block lost its type');
  for (const tag of texts) {
    if (!/fontSize:/.test(tag)) continue;
    assert.match(
      tag,
      /lineHeight: lh\.(name|handle|bio)/,
      `a hand-sized line with no scaled line box:\n${tag}`,
    );
  }
});

test('CI-03 — `trim` is never combined with a size override', () => {
  // The trim table holds cap-height margins computed for each variant's OWN
  // size. Trimming a line set at a different size subtracts the wrong margin
  // from the wrong box, which is how a 30pt name ends up clipped at the top.
  // The JSX prop only — `name?.trim()` is a different word that happens to be
  // spelled the same, so the lookarounds exclude a method call and a longer
  // identifier.
  const header = stripped(HEADER);
  assert.doesNotMatch(header, /(?<![.\w])trim(?![(\w])/);
});

test('CI-03 — the line boxes are derived, capped per role, and identity at 1', () => {
  // Derived from the same helper `tailwind.config.js` computes the variants
  // with, at the same ratios — so a change to the font metrics moves both.
  const base = {
    name: leading('instrument', 30, 1.08),
    handle: leading('helvetica', 14, 1.4),
    bio: leading('helvetica', 15, 1.5),
  };

  // At the standard size the design is untouched to the pixel. CI-01/CI-02 are
  // approved at standard size, so this is the assertion that keeps this fix
  // from being a redesign.
  assert.deepEqual(zeroLeading(1), {
    name: Math.round(base.name),
    handle: Math.round(base.handle),
    bio: Math.round(base.bio),
  });

  // The name is display type and `Text` caps the serif variants at 1.4; handle
  // and bio are running text and cap at 1.8. Capping a box with a different
  // number than the glyph would reintroduce the overflow from the other side.
  const ax3 = zeroLeading(2.35);
  assert.equal(ax3.name, Math.round(base.name * MAX_DISPLAY_SCALE));
  assert.equal(ax3.handle, Math.round(base.handle * MAX_TEXT_SCALE));
  assert.equal(ax3.bio, Math.round(base.bio * MAX_TEXT_SCALE));

  // Past the ceiling nothing grows further — the glyphs have stopped too.
  assert.deepEqual(zeroLeading(9), ax3);

  // And every box is taller than the glyphs it holds, at both ends of the range.
  assert.ok(ax3.name > 30 * MAX_DISPLAY_SCALE);
  assert.ok(ax3.handle > 14 * MAX_TEXT_SCALE);
  assert.ok(ax3.bio > 15 * MAX_TEXT_SCALE);
});

test('CI-03 — the name column can grow, so a wrapped name cannot be clipped', () => {
  const header = stripped(HEADER);
  // `flex-1` is flexBasis 0: a child with a zero basis contributes nothing to
  // its row's intrinsic height, so the row collapses to the avatar and clips
  // the wrapped name. Same trap as the first-ten chooser's rows.
  assert.doesNotMatch(header, /className="[^"]*\bflex-1\b/);
  assert.match(header, /flexBasis: 'auto'/);
  // Nothing in the block truncates: a handle is how somebody is found, so a
  // second line costs less than an ellipsis.
  assert.doesNotMatch(header, /numberOfLines/);
});

// ---------------------------------------------------------------------------
// The states this packet must NOT have touched
// ---------------------------------------------------------------------------

test('1–9 keeps the compact example below the owned grid, unchanged', () => {
  const src = stripped(CLOSET);
  // The band is still the free tier's ceiling, still counted over everything
  // owned rather than what a chip is showing, and still drawn as the FOOTER of
  // the real grid — never as a header and never inside it.
  assert.match(src, /screen\.items\.length > 0 && screen\.items\.length < PLANS\.free\.items/);
  assert.match(src, /PLANS\.free\.items - screen\.items\.length/);
  assert.match(src, /ListFooterComponent=\{[\s\S]*?<ExampleCloset variant="compact" remaining=\{exampleRemaining\}/);
});

test('the identity block belongs to zero alone', () => {
  const src = stripped(CLOSET);
  // One call site. If it ever appears in `Masthead`, the filled closet has
  // silently grown a second identity header above its own.
  assert.equal((src.match(/<ZeroIdentityHeader/g) ?? []).length, 1);
  const masthead = src.slice(src.indexOf('function Masthead'));
  assert.doesNotMatch(masthead, /ZeroIdentityHeader/);
});

test('the filled closet keeps its em dashes', () => {
  const src = stripped(CLOSET);
  const masthead = src.slice(src.indexOf('function Masthead'));
  // C-01 passes the raw `undefined` through so an in-flight query reads as a
  // dash. The zero state's coalescing must not have leaked up here.
  assert.match(masthead, /outfits=\{screen\.stats\.outfits\}/);
  assert.match(masthead, /followers=\{screen\.stats\.followers\}/);
  // And its strip keeps the geometry it was approved with — the new scaled
  // line boxes are the zero state's alone until somebody scopes that packet.
  const its = masthead.slice(masthead.indexOf('<StatRow'));
  assert.doesNotMatch(its.slice(0, its.indexOf('/>')), /growWithType/);
});

test('the centred starter card survives for every other caller', () => {
  // `flow` defaults to the C-05 behaviour, so the two Wave 3 dev frames that
  // render this card on its own are unchanged by the new mode.
  const empty = stripped(EMPTY);
  assert.match(empty, /flow = 'centred'/);
  assert.match(empty, /flex-1 justify-center px-gutter/);
});
