/**
 * The §7 tripwire — no piece count is ever written into prose again.
 *
 * `docs/design/positioning-contract.md` §7 catalogued eleven hard-coded counts
 * across six files. Fixing them is a one-afternoon job; keeping them fixed is
 * not, because every one of them was introduced by somebody writing a perfectly
 * good sentence. The regression looks like an improvement in review.
 *
 * So this file asserts the DERIVATION rather than the wording. Every test here
 * fails if a literal comes back, and none of them fails when the copy is
 * legitimately rewritten — which is the only way a copy tripwire survives
 * contact with an editor.
 *
 * Three of the surfaces are `.tsx` and cannot be imported: esbuild cannot parse
 * React Native's Flow source, which is the same constraint `articles.ts` and
 * `context-lines.ts` are written to. Those three are checked as TEXT, and the
 * assertion is positive — "this file still contains the interpolation" — rather
 * than a hunt for spelled numbers, which would false-positive on every
 * explanatory comment in the file.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS } from '../src/features/billing/plans';
import { contextLineFor } from '../src/features/billing/context-lines';
import { Placement } from '../src/features/billing/placements';
import { HELP_ARTICLES, articleById } from '../src/features/help/articles';
import { numberWord } from '../src/features/onboarding/reveal-copy';

/** Relative to the runner's cwd, which is the repository root. */
const read = (p: string) => readFileSync(p, 'utf8');

const bodyOf = (id: string) => articleById(id)!.body.join('\n');

// ── The help articles ─────────────────────────────────────────────────────

test('the closet-size article quotes the free tier, not a copy of it', () => {
  const body = bodyOf('closet-size');

  assert.ok(body.includes(`${PLANS.free.items} pieces in rotation`), body);
  assert.ok(body.includes(`${PLANS.free.storedItems} in total`), body);

  // The spoken register, still spelled, still derived. If `PLANS.free.items`
  // moved to twelve this would read "Twelve, to begin with." on its own.
  assert.ok(body.startsWith(`${numberWord(PLANS.free.items).replace(/^./, (c) => c.toUpperCase())},`), body);
});

test('the tier article quotes all six ceilings from PLANS', () => {
  const body = bodyOf('what-paying-buys');

  for (const plan of ['free', 'standard', 'pro'] as const) {
    const { items, storedItems, eventHosting } = PLANS[plan];
    assert.ok(body.includes(items.toLocaleString('en-US')), `${plan} active ceiling missing: ${body}`);
    assert.ok(body.includes(storedItems.toLocaleString('en-US')), `${plan} stored ceiling missing: ${body}`);
    assert.ok(body.includes(eventHosting.toLocaleString('en-US')), `${plan} hosting ceiling missing: ${body}`);
  }

  // Standard's allowance is the display string itself, not a paraphrase of it.
  assert.ok(body.includes(PLANS.standard.stylist), body);
});

test('no tier ceiling is spelled out in words anywhere in the help copy', () => {
  // The exact wordings §7 catalogued, plus the ones the same sentence would
  // reach for next. A ceiling spelled out is a ceiling that cannot move.
  const spelled = [
    /\bthirty in total\b/i,
    /\ba hundred and fifty\b/i,
    /\bfour hundred and fifty\b/i,
    /\ba thousand and three thousand\b/i,
    /\bthirty messages\b/i,
    /\bfifteen on Standard\b/i,
    /\btwo occasions\b/i,
  ];
  const prose = HELP_ARTICLES.flatMap((a) => a.body).join('\n');
  for (const pattern of spelled) {
    assert.ok(!pattern.test(prose), `a ceiling is spelled into the prose again: ${pattern}`);
  }
});

test('the two number registers never share a clause', () => {
  // The rule the module docblock states, mechanised: within one clause, a
  // number is either spelled or a numeral. The failure this catches is the
  // mechanical `numberWord()`-everywhere fix, which produces "ten pieces in
  // rotation, 30 in total" — correct, derived, and unreadable.
  const small = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/i;
  for (const article of HELP_ARTICLES) {
    for (const paragraph of article.body) {
      for (const clause of paragraph.split(/[;:]|,\s|\s—\s|\.\s/)) {
        if (!/\d/.test(clause)) continue;
        assert.ok(
          !small.test(clause),
          `${article.id} mixes a spelled number and a numeral in one clause: "${clause.trim()}"`,
        );
      }
    }
  }
});

test('the eight in the closet-size article is the engine floor, not a guess', () => {
  // `MIN_CLOSET_FOR_OUTFITS` cannot be imported here for the same reason
  // `articles.ts` cannot import it — `queries.ts` pulls in react-query and
  // `@/lib/supabase`, and esbuild would then have to parse React Native. So the
  // constant is read out of the source as text, which is enough to fail if
  // either side moves. When somebody lifts the constant into a leaf module,
  // delete this and import it.
  const source = read('src/features/styling/queries.ts');
  const match = source.match(/MIN_CLOSET_FOR_OUTFITS\s*=\s*(\d+)/);
  assert.ok(match, 'MIN_CLOSET_FOR_OUTFITS is gone or renamed — the article still spells it');

  const floor = Number(match![1]);
  const body = bodyOf('closet-size');
  assert.ok(
    body.includes(`at ${numberWord(floor)} pieces`),
    `queries.ts says ${floor} and the article says something else:\n${body}`,
  );
});

// ── The paywall context line ──────────────────────────────────────────────

test('the free paywall line names the cap once and derives it', () => {
  const line = contextLineFor(Placement.AddGarmentOverLimit)!;
  assert.deepEqual(
    line.match(/\d+/g),
    [String(PLANS.free.items)],
    `the cap is quoted more than once, or a second number crept in: ${line}`,
  );
  assert.ok(!/\bten\b/i.test(line), `the cap is spelled out again: ${line}`);
});

// ── The three components, checked as text ─────────────────────────────────

test('the .tsx surfaces still interpolate rather than spell', () => {
  const cases: { path: string; must: string[] }[] = [
    // C-05's ask is `PIECES_ASKED`, the constant that also draws the pips —
    // deliberately not `PLANS.free.items`; see the constant's own note.
    {
      path: 'src/components/closet/example-closet.tsx',
      must: ['numberWord(PIECES_ASKED)', 'length: PIECES_ASKED'],
    },
    // P-03's empty week and S-09's too-small closet both ask for the free cap.
    { path: 'src/app/(tabs)/plan.tsx', must: ['numberWord(PLANS.free.items)'] },
    { path: 'src/components/stylist/stylist-states.tsx', must: ['numberWord(PLANS.free.items)'] },
  ];

  for (const { path, must } of cases) {
    const source = read(path);
    for (const needle of must) {
      assert.ok(source.includes(needle), `${path} no longer derives its count: expected ${needle}`);
    }
    // The literal wordings §7 catalogued, in a rendered string rather than a
    // comment: a JSX text node or a template literal, never `// ten pieces`.
    for (const line of source.split('\n')) {
      const code = line.trim();
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue;
      assert.ok(
        !/(Photograph six pieces|about ten pieces)/i.test(code),
        `${path} spells its count again: ${code}`,
      );
    }
  }
});
