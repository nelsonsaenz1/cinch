/**
 * C-02 and C-03 — the sentence that states what the grid is showing.
 *
 * C-02 draws `4 tops matching “wool”` while the All chip beside it reads 7.
 * Those are two true numbers about two different sets, and the only thing that
 * makes them legible together is a sentence naming the composition. The closet
 * used to print `7 pieces` there, which is the second number with none of the
 * meaning.
 *
 * C-03 is the same derivation with no query: `8 accessories`.
 *
 * None of this is visible in a screenshot of the happy path — a wrong noun or a
 * silently-dropped chip reads perfectly well and says the wrong thing — which is
 * why it is asserted here rather than left to a capture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { searchSummary } from '../src/features/closet/search-summary';

test('C-02, exactly as drawn: the chip and the query compose', () => {
  assert.equal(
    searchSummary({ count: 4, category: 'Tops', query: 'wool' }),
    '4 tops matching “wool”',
  );
});

test('C-03, exactly as drawn: a held chip with no query', () => {
  assert.equal(searchSummary({ count: 8, category: 'Accessories', query: '' }), '8 accessories');
});

test('a query with no chip held is about pieces, not a category', () => {
  assert.equal(
    searchSummary({ count: 7, category: 'All', query: 'wool' }),
    '7 pieces matching “wool”',
  );
});

test('ZERO IS QUIET — the empty state carries it, not this line', () => {
  // Not "0 tops matching", not "No pieces". The grid's own empty state is
  // already naming which filter emptied it, and saying it twice is nagging.
  assert.equal(searchSummary({ count: 0, category: 'Tops', query: 'wool' }), null);
  assert.equal(searchSummary({ count: 0, category: 'All', query: 'zzz' }), null);
});

test('the unfiltered, unsearched grid gets no sentence at all', () => {
  // C-01 prints its total under the title. Repeating it above the grid would be
  // the same fact twice on one screen.
  assert.equal(searchSummary({ count: 148, category: 'All', query: '' }), null);
});

test('NO NOUN IS INVENTED IN THE SINGULAR', () => {
  // The frames only ever draw plurals. For a count of one the sentence reaches
  // for the neutral unit rather than a singular this module would have to make
  // up: "1 shoe" for a filed pair and "1 outerwear" for a mass noun are both
  // claims about the garment that nothing in the data supports.
  assert.equal(searchSummary({ count: 1, category: 'Shoes', query: 'boot' }), '1 piece matching “boot”');
  assert.equal(searchSummary({ count: 1, category: 'Outerwear', query: '' }), '1 piece');
  assert.equal(searchSummary({ count: 1, category: 'Tops', query: '' }), '1 piece');
});

test('outerwear is a mass noun and is not pluralised as one', () => {
  assert.equal(
    searchSummary({ count: 12, category: 'Outerwear', query: '' }),
    '12 outerwear pieces',
  );
});

test('the query is trimmed, and whitespace alone is not a query', () => {
  assert.equal(searchSummary({ count: 4, category: 'Tops', query: '  wool  ' }), '4 tops matching “wool”');
  // A field holding only spaces is a field nobody has typed in yet.
  assert.equal(searchSummary({ count: 4, category: 'Tops', query: '   ' }), '4 tops');
});

test('the quotation marks are the frame’s curly pair, never straight ones', () => {
  const line = searchSummary({ count: 2, category: 'All', query: 'linen' })!;
  assert.ok(line.includes('“linen”'), `straight quotes crept in: ${line}`);
  assert.ok(!line.includes('"'), `straight quotes crept in: ${line}`);
});
