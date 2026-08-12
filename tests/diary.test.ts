/**
 * The wear diary's selectors.
 *
 * Four of these are rules rather than formatting, and each of them is a rule
 * the app has already broken somewhere else in its life:
 *
 *   * **A piece with no price gets no cost-per-wear line.** `purchase_price` is
 *     nullable and usually null; the atlas gives every piece a figure. Printing
 *     "—", a zero, or an estimate from the category would put a number the user
 *     never typed into a sentence that reads as their own accounting.
 *   * **Months are grouped on the LOCAL calendar.** A wear confirmed at 11pm on
 *     the 31st belongs to that month for the person who wore it, whatever UTC
 *     thinks. Same bug class `dateKey` was written for.
 *   * **Year chips appear only once the record spans years**, and "This year"
 *     only when there is something in it — a chip that filters to nothing is a
 *     control that looks broken.
 *   * **The 24-hour window is read from the clock**, and the server's `22023`
 *     refusal is surfaced as the rule rather than as a generic failure.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ALL_YEARS,
  THIS_YEAR,
  filterByYear,
  groupByMonth,
  isCorrectable,
  monthKey,
  pieceOrigin,
  pieceStat,
  pieceTitle,
  postgresCode,
  rowLine,
  rowMeta,
  unwearRefusal,
  wearsLine,
  yearChips,
  HISTORY_LINE,
} from '../src/features/diary/entry';
import type { DiaryEntry, DiaryPiece } from '../src/features/diary/types';

/** Run `fn` with the process in `tz`, restoring the previous zone afterwards. */
function inZone(tz: string, fn: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

function piece(overrides: Partial<DiaryPiece> = {}): DiaryPiece {
  return {
    id: 'i1',
    kind: 'shearling coat',
    category: 'outerwear',
    colorName: 'cognac',
    brand: 'Toteme',
    wearCount: 6,
    purchasePrice: 348,
    imagePaths: [],
    ...overrides,
  };
}

function entry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'o1',
    wornAt: '2026-08-07T08:12:00.000Z',
    name: null,
    occasion: null,
    note: null,
    savedAt: null,
    originOutfitId: null,
    source: 'ai',
    pieces: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Cost per wear — printed or dropped, never estimated
// ---------------------------------------------------------------------------

test('prints the cost per wear in dollars when there is a price', () => {
  assert.equal(pieceStat(piece()), 'Worn 6 times · $58.00 a wear');
});

test('drops the cost-per-wear half entirely when there is no price', () => {
  const stat = pieceStat(piece({ purchasePrice: null }));
  assert.equal(stat, 'Worn 6 times');
  // Not "—", not a zero, not a middot left dangling.
  assert.ok(!stat.includes('·'), stat);
  assert.ok(!stat.includes('$'), stat);
});

test('drops it for a piece that has never been worn, rather than dividing by zero', () => {
  assert.equal(pieceStat(piece({ wearCount: 0, purchasePrice: 348 })), 'Worn 0 times');
});

test('says "once" rather than "1 times"', () => {
  assert.equal(pieceStat(piece({ wearCount: 1, purchasePrice: 40 })), 'Worn once · $40.00 a wear');
});

test('never prints a sterling glyph, whatever the atlas drew', () => {
  assert.ok(!pieceStat(piece()).includes('£'));
});

// ---------------------------------------------------------------------------
// Piece lines
// ---------------------------------------------------------------------------

test('titles a piece by its own word, capitalised, without the colour', () => {
  assert.equal(pieceTitle(piece()), 'Shearling coat');
});

test('falls back to the category, and refuses to call a piece "Other"', () => {
  assert.equal(pieceTitle(piece({ kind: null, category: 'footwear' })), 'Footwear');
  assert.equal(pieceTitle(piece({ kind: null, category: 'other' })), 'Untagged piece');
});

test('joins colour and maker, and drops the middot when one is missing', () => {
  assert.equal(pieceOrigin(piece()), 'Cognac · Toteme');
  assert.equal(pieceOrigin(piece({ brand: null })), 'Cognac');
  assert.equal(pieceOrigin(piece({ colorName: null })), 'Toteme');
  assert.equal(pieceOrigin(piece({ colorName: null, brand: null })), null);
});

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

test('reads the pieces out in order when the look has no name', () => {
  const e = entry({
    pieces: [
      piece({ id: 'a', kind: 'coat' }),
      piece({ id: 'b', kind: 'trousers' }),
      piece({ id: 'c', kind: 'loafers' }),
    ],
  });
  assert.equal(rowLine(e), 'Coat, trousers, loafers');
});

test("prefers the look's own name when it has one", () => {
  assert.equal(rowLine(entry({ name: 'Monday standard', pieces: [piece()] })), 'Monday standard');
});

/**
 * WD-01 moved the row's second line off the occasion and onto the shape of the
 * look and its cost — audit 77's fix, since the occasion was competing with the
 * name for a width the row does not have. The occasion is not lost: it is the
 * entry page's own subtitle (`entrySubtitle`), which is tested above.
 */
test('the row names the shape of the look, and the cost only when it is computable', () => {
  // Every piece priced: the figure is real arithmetic, 200 spend over 100 wears.
  assert.equal(
    rowMeta(
      entry({
        pieces: [
          piece({ id: 'a', purchasePrice: 120, wearCount: 60 }),
          piece({ id: 'b', purchasePrice: 80, wearCount: 40 }),
        ],
      }),
    ),
    'Outfit of 2 pieces · $2.00 a wear',
  );

  // One unpriced piece and the sentence simply ends. Never a dash, never a
  // figure computed off the priced half alone.
  assert.equal(
    rowMeta(
      entry({
        pieces: [
          piece({ id: 'a', purchasePrice: 120, wearCount: 60 }),
          piece({ id: 'b', purchasePrice: null, wearCount: 40 }),
        ],
      }),
    ),
    'Outfit of 2 pieces',
  );

  // A single garment gets its standing count, which is a fact about it.
  assert.equal(
    rowMeta(entry({ pieces: [piece({ wearCount: 7, purchasePrice: null })] })),
    'Worn on its own · 7th wear',
  );

  // An entry whose pieces are all gone from the closet has nothing to say.
  assert.equal(rowMeta(entry({ pieces: [] })), null);
});

test('counts wears with the singular handled', () => {
  assert.equal(wearsLine(11), '11 wears');
  assert.equal(wearsLine(1), '1 wear');
});

// ---------------------------------------------------------------------------
// The spine
// ---------------------------------------------------------------------------

test('keys months on the local calendar, not on UTC', () => {
  // 01:30Z on 1 September is still 21:30 on 31 August in New York.
  inZone('America/New_York', () => {
    assert.equal(monthKey('2026-09-01T01:30:00.000Z'), '2026-08');
  });
  inZone('Pacific/Auckland', () => {
    // 23:00Z on 31 August is already 11:00 on 1 September in Auckland.
    assert.equal(monthKey('2026-08-31T23:00:00.000Z'), '2026-09');
  });
});

test('groups newest first, with one section per month and its own count', () => {
  inZone('UTC', () => {
    const months = groupByMonth([
      entry({ id: 'a', wornAt: '2026-07-14T09:00:00.000Z' }),
      entry({ id: 'b', wornAt: '2026-08-07T09:00:00.000Z' }),
      entry({ id: 'c', wornAt: '2026-08-03T09:00:00.000Z' }),
      entry({ id: 'd', wornAt: '2026-07-28T09:00:00.000Z' }),
    ]);

    assert.deepEqual(
      months.map((m) => [m.key, m.count]),
      [
        ['2026-08', 2],
        ['2026-07', 2],
      ],
    );
    // Reverse-chronological inside a month as well as across them.
    assert.deepEqual(
      months[0].entries.map((e) => e.id),
      ['b', 'c'],
    );
    assert.deepEqual(
      months[1].entries.map((e) => e.id),
      ['d', 'a'],
    );
    assert.equal(months[0].label, 'August 2026');
  });
});

test('a month that recurs a year later is its own section, never merged', () => {
  inZone('UTC', () => {
    const months = groupByMonth([
      entry({ id: 'a', wornAt: '2026-08-07T09:00:00.000Z' }),
      entry({ id: 'b', wornAt: '2025-08-07T09:00:00.000Z' }),
    ]);
    assert.deepEqual(
      months.map((m) => m.key),
      ['2026-08', '2025-08'],
    );
  });
});

test('groups nothing into nothing', () => {
  assert.deepEqual(groupByMonth([]), []);
});

// ---------------------------------------------------------------------------
// Year chips
// ---------------------------------------------------------------------------

const NOW = new Date('2026-08-09T12:00:00.000Z');

test('a first-year reader sees no chips at all', () => {
  inZone('UTC', () => {
    const chips = yearChips(
      [
        entry({ wornAt: '2026-03-02T09:00:00.000Z' }),
        entry({ wornAt: '2026-08-07T09:00:00.000Z' }),
      ],
      NOW,
    );
    assert.deepEqual(chips, []);
  });
});

test('chips appear once the record spans a year boundary, newest year first', () => {
  inZone('UTC', () => {
    const chips = yearChips(
      [
        entry({ wornAt: '2026-08-07T09:00:00.000Z' }),
        entry({ wornAt: '2025-11-02T09:00:00.000Z' }),
        entry({ wornAt: '2024-01-30T09:00:00.000Z' }),
      ],
      NOW,
    );
    assert.deepEqual(
      chips.map((c) => c.id),
      [ALL_YEARS, THIS_YEAR, '2025', '2024'],
    );
    assert.deepEqual(
      chips.map((c) => c.label),
      ['All', 'This year', '2025', '2024'],
    );
  });
});

test('"This year" is withheld when there is nothing in it', () => {
  inZone('UTC', () => {
    const chips = yearChips([entry({ wornAt: '2025-11-02T09:00:00.000Z' })], NOW);
    assert.deepEqual(
      chips.map((c) => c.id),
      [ALL_YEARS, '2025'],
    );
  });
});

test('the chips actually filter, and an unknown one filters nothing away', () => {
  inZone('UTC', () => {
    const entries = [
      entry({ id: 'now', wornAt: '2026-08-07T09:00:00.000Z' }),
      entry({ id: 'then', wornAt: '2025-11-02T09:00:00.000Z' }),
    ];
    assert.deepEqual(
      filterByYear(entries, ALL_YEARS, NOW).map((e) => e.id),
      ['now', 'then'],
    );
    assert.deepEqual(
      filterByYear(entries, THIS_YEAR, NOW).map((e) => e.id),
      ['now'],
    );
    assert.deepEqual(
      filterByYear(entries, '2025', NOW).map((e) => e.id),
      ['then'],
    );
    assert.deepEqual(
      filterByYear(entries, 'nonsense', NOW).map((e) => e.id),
      ['now', 'then'],
    );
  });
});

// ---------------------------------------------------------------------------
// Editable for a day
// ---------------------------------------------------------------------------

test('an entry is correctable for exactly twenty-four hours', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');
  assert.equal(isCorrectable('2026-08-09T11:59:00.000Z', now), true);
  // The boundary itself is still inside the window, matching `now() - worn_at
  // > interval '24 hours'` in the function.
  assert.equal(isCorrectable('2026-08-08T12:00:00.000Z', now), true);
  assert.equal(isCorrectable('2026-08-08T11:59:59.000Z', now), false);
});

test('an unreadable timestamp is not correctable — the server, not a guess, decides', () => {
  assert.equal(isCorrectable('not a date'), false);
});

test('the 24-hour refusal is surfaced as the rule, not as a connection error', () => {
  assert.equal(unwearRefusal('22023'), HISTORY_LINE);
  assert.notEqual(unwearRefusal('08006'), HISTORY_LINE);
  assert.notEqual(unwearRefusal(undefined), HISTORY_LINE);
});

test('reads the SQLSTATE off a PostgrestError-shaped rejection, and nothing else', () => {
  assert.equal(postgresCode({ code: '22023', message: 'older than a day' }), '22023');
  assert.equal(postgresCode(new Error('boom')), undefined);
  assert.equal(postgresCode({ code: 22023 }), undefined);
  assert.equal(postgresCode(null), undefined);
  assert.equal(postgresCode('22023'), undefined);
});
