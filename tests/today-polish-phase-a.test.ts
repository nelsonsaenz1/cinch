import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

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
  const src = body('src/app/people-search.tsx');
  assert.match(src, /Find people/);
  assert.match(src, /<SearchField/);
  assert.match(src, /autoFocus/);
  assert.match(src, /Close search/);
  assert.match(src, /Couldn’t search just now/);
  assert.match(src, /No one by that username/);
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

test('Wear preserves one operation id through failure and settles it only on success', () => {
  const mutation = body('src/features/styling/mutations.ts');
  assert.match(mutation, /p_op_id: opIds\.for\(actionKey\)/);
  assert.match(mutation, /opIds\.settle\(actionKey\)/);
  assert.equal((mutation.match(/opIds\.settle\(actionKey\)/g) ?? []).length, 1);
  assert.doesNotMatch(mutation, /finally\s*\{[\s\S]*?opIds\.settle/);
});
