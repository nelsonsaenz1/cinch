/**
 * The email shape check behind the sign-in flow's Continue button.
 *
 * The contract under test: `isValidEmail` decides when the pill arms and when
 * the label line swaps to "That address is missing something" (W-05/W-06), and
 * `normalizeEmail` is what `sendEmailCode` actually sends. The check is
 * deliberately cheap — the real validation is the code arriving — so these
 * assertions pin the obvious typo class, not RFC 5321.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isValidEmail, normalizeEmail } from '../src/features/auth/email';

test('a plain address parses', () => {
  assert.equal(isValidEmail('maya@hey.com'), true);
});

test('the atlas’s own malformed example does not parse', () => {
  // W-06 draws exactly this string over the oxblood underline.
  assert.equal(isValidEmail('maya@hey'), false);
});

test('surrounding whitespace and case do not count against an address', () => {
  assert.equal(isValidEmail('  Maya@Hey.com  '), true);
  assert.equal(normalizeEmail('  Maya@Hey.com  '), 'maya@hey.com');
});

test('the empty and hopeless shapes do not parse', () => {
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('maya'), false);
  assert.equal(isValidEmail('@hey.com'), false);
  assert.equal(isValidEmail('maya@'), false);
  assert.equal(isValidEmail('maya@hey.c'), false); // TLD needs two characters
  assert.equal(isValidEmail('maya ellison@hey.com'), false);
  assert.equal(isValidEmail('maya@hey com'), false);
});

test('subdomains, plus-tags and long TLDs parse', () => {
  assert.equal(isValidEmail('maya+cinch@mail.hey.com'), true);
  assert.equal(isValidEmail('maya@hey.fashion'), true);
});
