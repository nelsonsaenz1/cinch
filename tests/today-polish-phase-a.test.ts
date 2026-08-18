import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { tasteSignal } from '../src/features/today/wear-confirm-spec';

import {
  classifyWearSessionFailure,
  classifyWearFailure,
  wearFailureCopy,
  WearMutationError,
} from '../src/features/styling/wear-failure.ts';

const code = (path: string) => readFileSync(path, 'utf8');
const body = (path: string) =>
  code(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('People Search keeps the task UI without repeating mutual-friendship lessons', () => {
  // Redesign 09 (2026-08-17) rebuilt this page to an accepted atlas and split
  // it in two — the route holds the wiring, `people-search-body.tsx` the
  // drawing, and the strings moved into `people-search-spec.ts` where
  // `tests/people-search-spec.test.ts` pins them verbatim.
  //
  // Two of the assertions below were the OLD copy and are now the accepted
  // copy: "Couldn’t search just now" became "Search couldn’t reach Cinch" and
  // "No one by that username" became "No one goes by that username". What this
  // test is actually for is untouched, and is the last line: the page states
  // its task and does not re-teach the friendship model somebody already read
  // on Friends.
  const src = [
    body('src/app/people-search.tsx'),
    body('src/components/social/people-search-body.tsx'),
    body('src/features/social-graph/people-search-spec.ts'),
  ].join('\n');

  assert.match(src, /Find people/);
  assert.match(src, /<SearchField/);
  assert.match(src, /autoFocus/);
  assert.match(src, /Close search/);
  assert.match(src, /Search couldn’t reach Cinch/);
  assert.match(src, /No one goes by that username/);
  assert.doesNotMatch(src, /friendship is mutual|closet opens to you/i);
});

test('Stylist header keeps its action and structure without the redundant promise', () => {
  const src = body('src/components/stylist/sheet-parts.tsx');
  assert.match(src, /Stylist/);
  assert.match(src, /New question/);
  assert.match(src, /border-b border-hairline/);
  assert.doesNotMatch(src, /Only your clothes/);
});

test('New Event single-line fields share their text geometry contract', () => {
  const occasion = body('src/components/events/occasion-field.tsx');
  const place = body('src/components/events/place-field.tsx');
  for (const src of [occasion, place]) {
    assert.match(src, /className="flex-1 font-body text-body"|multiline \? 'w-full' : 'flex-1'/);
    assert.match(src, /style=\{\{ color: theme\.ink, \.\.\.INPUT_RESET \}\}/);
  }
});

test('Wear failures retain safe, distinct categories and never promise durable capture', () => {
  assert.equal(classifyWearFailure(new WearMutationError('signed_out')), 'signed_out');
  assert.equal(classifyWearFailure(new Error('Network request timed out')), 'network');
  assert.equal(
    classifyWearSessionFailure(new Error('Sign-in check did not respond. Check your connection.')),
    'session_unavailable',
  );
  assert.equal(classifyWearSessionFailure(new Error('Network request failed')), 'network');
  assert.equal(classifyWearFailure({ code: 'PGRST301' }), 'signed_out');
  assert.equal(classifyWearFailure({ code: '42501', message: 'private detail' }), 'rejected');
  assert.equal(classifyWearFailure({ code: '22004', message: 'private detail' }), 'rejected');
  assert.equal(classifyWearFailure(new Error('unknown private detail')), 'unexpected');

  const kinds = [
    'signed_out',
    'session_unavailable',
    'network',
    'rejected',
    'unexpected',
  ] as const;
  for (const kind of kinds) {
    const copy = wearFailureCopy(kind);
    assert.ok(copy.title);
    assert.ok(copy.body);
    assert.equal(copy.retryLabel, 'Try again');
    assert.doesNotMatch(`${copy.title} ${copy.body}`, /will not lose|saved on this phone/i);
  }
});

test('A rated wear teaches taste only on explicit feedback, and only once the wear has landed', () => {
  const src = body('src/app/(tabs)/index.tsx');
  const start = src.indexOf('const confirmWear');
  assert.ok(start > 0);
  const scope = src.slice(start, src.indexOf('const weatherClause', start));

  const wearAt = scope.indexOf('wear.mutate(');
  const successAt = scope.indexOf('onSuccess:');
  const likedAt = scope.indexOf('const liked =');
  const reactAt = scope.indexOf('react.mutate(');
  const errorAt = scope.indexOf('onError:');
  assert.ok(wearAt >= 0 && wearAt < successAt);
  assert.ok(successAt < likedAt && likedAt < reactAt && reactAt < errorAt);
  assert.match(scope, /if \(liked !== null\) \{/);
  assert.match(scope, /reason: favorite \? 'favorite' : `wear_rating_\$\{rating\}`/);

  // ── REDESIGN 13 MOVED THE POLICY OUT OF THE TERNARY ────────────────────
  //
  // It used to be an inline expression, and this test read it back out with a
  // regex and evaluated it through `new Function` — which worked, and was as
  // close to executing the shipping code as a string can get. It is now
  // `tasteSignal` in `features/today/wear-confirm-spec.ts`, so the same ten
  // assertions run against the REAL function instead of a reconstruction of
  // it, and `tests/wear-confirm-spec.test.ts` extends them.
  //
  // The invariant is unchanged and is now stronger: the route must call the
  // policy rather than reimplement it, which is what the assertion above pins.
  assert.match(scope, /const liked = tasteSignal\(rating, favorite\)/);
  const liked = (favorite: boolean, rating: number | null) => tasteSignal(rating, favorite);

  assert.equal(liked(true, null), true);
  assert.equal(liked(true, 1), true);
  assert.equal(liked(true, 2), true);
  assert.equal(liked(true, 3), true);
  assert.equal(liked(false, 5), true);
  assert.equal(liked(false, 4), true);
  assert.equal(liked(false, 3), null);
  assert.equal(liked(false, null), null);
  assert.equal(liked(false, 2), false);
  assert.equal(liked(false, 1), false);

  const mutation = body('src/features/styling/mutations.ts');
  assert.match(mutation, /supabase\.rpc\('apply_outfit_reaction'/);
  assert.match(mutation, /p_wear_rating: rating \?\? undefined/);
  assert.match(mutation, /p_favorite: favorite/);
});

test('Wear preserves one operation id through failure and settles it only on success', () => {
  const mutation = body('src/features/styling/mutations.ts');
  assert.match(mutation, /p_op_id: opIds\.for\(actionKey\)/);
  assert.match(mutation, /opIds\.settle\(actionKey\)/);
  assert.equal((mutation.match(/opIds\.settle\(actionKey\)/g) ?? []).length, 1);
  assert.doesNotMatch(mutation, /finally\s*\{[\s\S]*?opIds\.settle/);
});
