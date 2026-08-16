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
import { NON_TEXT_TOKENS } from '../src/theme/contrast';
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
 * The low-contrast census. UX-01 widened it; the shape is unchanged.
 *
 * It began as one token. The constitution says "NEVER #8A8578 as text" and the
 * refusal list says "no faint text"; on canvas `faint` is 3.52:1, which is the
 * whole reason. The census that produced the original list found 20 files and
 * 45 uses, so the rule was being broken widely and quietly.
 *
 * What it never covered was the two tokens BELOW `faint`. `byline` is 2.61:1
 * and `ghost` is 1.72:1, and both were set as type in files this test reported
 * clean on — it looked only for the token it had been told about, which is the
 * same failure mode Lane G3 caught when `placeholderTextColor` turned out to be
 * missing from the patterns. So the census is no longer a hard-coded token: it
 * is driven by `NON_TEXT_TOKENS` in `src/theme/contrast.ts`, which is the role
 * table DE-01 asked for. A role declared `text: false` there is scanned for
 * here, automatically, and the two files cannot disagree.
 *
 * The lists below are DEBT, not permission. Anything not on them fails. Delete
 * entries as lanes burn them down; never add one — a lane that needs a new
 * entry is a lane that should have used `muted`.
 */

/**
 * The three ways this codebase can set a colour as type: the utility class, the
 * inline escape hatch a class-precedence bug would otherwise hide, and the
 * placeholder — which is text even though it does not look like a `<Text>`.
 *
 * `color:` is lower-case on purpose and it matters: `backgroundColor`,
 * `borderColor` and `tintColor` all end in `Color:` with a capital C, so a fill
 * or a border drawn in `faint` is correctly ignored. Those are not text.
 */
const asText = (token: string, utility: string) => [
  new RegExp(`text-${utility}\\b`),
  new RegExp(`color:\\s*theme\\.${token}\\b`),
  new RegExp(`placeholderTextColor=\\{theme\\.${token}\\}`),
];

/** JS key → Tailwind utility name, for the two that differ. */
const UTILITY: Record<string, string> = {
  accentWarm: 'accent-warm',
  ruleStrong: 'rule-strong',
};

const CENSUS = NON_TEXT_TOKENS.map((token) => ({
  token,
  patterns: asText(token, UTILITY[token] ?? token),
}));

/**
 * Files that set a forbidden token as type TODAY, by token.
 *
 * `faint` frozen 2026-08-12 at the Wave 3 shared-system checkpoint and reduced
 * since; `byline` and `ghost` frozen 2026-08-15 at the UX-01 checkpoint, from
 * the census that first looked for them.
 *
 * The UX-01 integration pass burned five `faint` entries down — the three
 * placeholder sheets and the two `__DEV__` fixtures — and stopped there
 * deliberately. Every remaining entry belongs to a surface another lane is
 * rebuilding in this same program, and a global sweep into those files would
 * collide with the frame that is about to redraw them. Their colour gets
 * decided by that frame, which is the same argument the original list made
 * about `review-card` and `item-edit-sheet`.
 */
const TEXT_DEBT: Record<string, string[]> = {
  faint: [
    // Group 5 and beyond. The four gap-feed entries, `ProfileRow` and
    // `friends/[userId]` came off this list when Group 5 rebuilt those surfaces;
    // what is left here is what Group 5 did not own.
    // `explore.tsx` came off this list in UX-04: people search moved into a
    // dedicated sheet and the remaining feed copy uses the meaningful `muted`
    // role rather than inheriting low-contrast text debt.
    // `EventCard.tsx` came off this list in the launch-polish packet: LP-10 gave
    // its quietest line real information to carry, so it moved to `muted`.
    'src/features/explore/new-addition-row.tsx',
    // Placeholders — see the note on `placeholderTextColor` above the scanner.
    // `CorrectionSheet`, `ReportFlowSheets` and `sheet-parts` came off here at
    // UX-01; these four are owned by lanes A, B and C in this program.
    'src/app/item/[id].tsx',
    'src/components/event-outfits/PostComposer.tsx',
    'src/components/events/occasion-field.tsx',
    'src/components/events/place-field.tsx',
    'src/features/profile/edit-profile-sheet.tsx',
    'src/features/profile/handle-field.tsx',
  ],
  byline: [
    // The Lately attribution voice, set in the token named after it. These are
    // meaningful credit lines — whose piece a row is, when it landed — so they
    // belong on `muted`, and the lanes rebuilding Explore, the social sheets and
    // Profile in this program are the ones that will move them.
    'src/app/profile.tsx',
    'src/components/item/tagging-header.tsx',
    'src/components/social/FriendOverflowSheet.tsx',
    'src/components/social/friend-sheets.tsx',
    'src/features/explore/new-addition-row.tsx',
    // Button's `filled` disabled tone — a `byline` label on `sand`. NOT debt:
    // WCAG 2.2 exempts an inactive control, and N-07 prints the reason
    // underneath at full strength. Listed because the scanner cannot tell a
    // disabled label from a live one, and `ROLES.disabled` is where the
    // exemption is actually argued.
    'src/components/ui/button.tsx',
    // `__DEV__` fixture route — never shipped.
    'src/app/dev-account.tsx',
  ],
  ghost: [
    // Example content drawn as example content — the Plan atlas's ghost weekday
    // and ghost trip label, and the unpickable past days in the date sheet.
    // Also not debt: `ROLES.example` is the argument, and `tests/example-
    // content.test.ts` is what keeps these from ever carrying real data.
    'src/components/boards/board-edit-sheet.tsx',
    'src/components/boards/keep-sheet.tsx',
    'src/components/events/date-sheet.tsx',
  ],
};

/** Strip the comments a census must not punish. See the note inside. */
const scannable = (path: string) =>
  readFileSync(path, 'utf8')
    // Block comments and WHOLE-LINE `//` comments go first: several files
    // explain in prose why they avoid these exact classes, and a rule that
    // punishes its own documentation teaches people to stop writing it down. A
    // TRAILING `// …` comment is NOT stripped, so writing one of these patterns
    // after code on the same line still trips this. That is deliberate —
    // stripping trailing comments means finding `//` in a string, and every URL
    // in the codebase contains one. It fails closed.
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const sourceFiles = () => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) out.push(path);
    }
  };
  walk('src');
  return out;
};

test('no NEW surface sets a sub-AA token as text', () => {
  // Scanned rather than asserted about: the failure mode is a call site
  // somebody adds next week, not a value in a config.
  const files = sourceFiles().map((path) => ({ path, src: scannable(path) }));
  const added: string[] = [];

  for (const { token, patterns } of CENSUS) {
    for (const { path, src } of files) {
      if (!patterns.some((re) => re.test(src))) continue;
      if (TEXT_DEBT[token]?.includes(path)) continue;
      added.push(`${token}: ${path}`);
    }
  }

  assert.deepEqual(added, [], `a sub-AA token set as text off the debt list:\n${added.join('\n')}`);
});

test('the text debt lists have no stale entries', () => {
  // A debt list nobody prunes becomes a permanent allowlist. This fails when a
  // lane fixes a file, which is the moment to delete its line.
  const stale: string[] = [];
  for (const [token, paths] of Object.entries(TEXT_DEBT)) {
    const patterns = asText(token, UTILITY[token] ?? token);
    for (const path of paths) {
      if (!patterns.some((re) => re.test(scannable(path)))) stale.push(`${token}: ${path}`);
    }
  }
  assert.deepEqual(stale, [], `fixed — delete from TEXT_DEBT:\n${stale.join('\n')}`);
});

test('the census covers every token the role table forbids', () => {
  // The link between the two files, asserted rather than assumed. Adding a
  // `text: false` role to `contrast.ts` must widen this scan; if this ever
  // drifts, a new low-contrast token could be introduced with no census at all.
  assert.deepEqual(
    CENSUS.map((c) => c.token).sort(),
    [...NON_TEXT_TOKENS].sort(),
  );
  // And the three that actually have debt are the three the palette ramps down
  // through. `positive`, `warning`, `accentWarm` and `ruleStrong` are forbidden
  // as text and used as text NOWHERE — which is the state the other three are
  // being moved toward.
  assert.deepEqual(Object.keys(TEXT_DEBT).sort(), ['byline', 'faint', 'ghost']);
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
