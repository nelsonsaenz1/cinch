/**
 * The gate that decides which gap slots are allowed to suggest anything.
 *
 * WHY THIS FILE EXISTS
 *
 * On 2026-08-11 `gap-shop-match` shipped a version that answered a gap by
 * searching the catalogue for the slot's own word. It was live for about
 * fifteen minutes and it returned, for "coat", a wooden coat STAND from
 * Wayfair. The fix was a merchant allowlist plus `relevance.ts`, but the fix is
 * not the lesson — the lesson is that nobody looked at the rows before it
 * shipped. `docs/commerce/incident-2026-08-11-junk-results.md` records it.
 *
 * So this test is the looking, written down. It holds 2,558 real catalogue rows
 * recorded from the 82 allowlisted merchants across nine slots and three
 * colours, and it pins exactly how many survive `admitProduct`. A change to the
 * filter that readmits junk moves a number here and fails, which forces the
 * person making the change to go and read the rows again.
 *
 * WHAT THE NUMBERS ARE NOT
 *
 * They are not a correctness proof. They are a record of a measurement made on
 * a specific day against a specific catalogue, and their whole value is that
 * changing one is deliberate rather than accidental. The named cases below
 * carry the actual arguments; the counts only stop them being quietly undone.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { admitProduct, type RelevanceSlot } from '../supabase/functions/gap-shop-match/relevance.ts';

type FixtureRow = { id: number; name: string; merchant: string; brand: string | null };

// Relative to the runner's cwd, which is the repository root — the same rule
// `push-channels.test.ts` and `migration-replay.test.ts` follow, and for the
// same reason `tests/node-test-runtime.d.ts` gives: `scripts/run-tests.mjs`
// bundles each test into `node_modules/.cache/unit-tests/`, so a path relative
// to THIS module would point at the cache directory instead of at `tests/`.
const fixture: Record<string, FixtureRow[]> = JSON.parse(
  readFileSync('tests/fixtures/slot-relevance.json', 'utf8'),
);

/** The noun each slot is searched with. Mirrors `SLOT_QUERY` in index.ts, which
 *  cannot be imported here — it pulls in `npm:@supabase/server` and Deno. The
 *  final test in this file reads that file as text and checks the two agree. */
const NOUN: Record<RelevanceSlot, string> = {
  top: 'shirt',
  bottom: 'trousers',
  outerwear: 'coat',
  footwear: 'shoes',
  dress: 'dress',
  accessory: 'scarf',
  bag: 'handbag',
  headwear: 'hat',
  jewelry: 'necklace',
};

/**
 * How many of the recorded rows per cell are the garment that was asked for.
 *
 * Recorded 2026-08-11 against Datafeedr, merchant set = `ALLOWED_MERCHANTS`.
 * A cell far below its neighbours is not necessarily a bug — "cream coat" is a
 * rarer garment than "black trousers" and the catalogue reflects that.
 */
const EXPECTED: Record<string, number> = {
  'top|black': 71,
  'top|navy': 84,
  'top|cream': 82,
  'bottom|black': 89,
  'bottom|navy': 90,
  'bottom|cream': 59,
  'outerwear|black': 35,
  'outerwear|navy': 71,
  'outerwear|cream': 59,
  'footwear|black': 58,
  'footwear|navy': 61,
  'footwear|cream': 83,
  'dress|black': 43,
  'dress|navy': 46,
  'dress|cream': 75,
  'accessory|black': 53,
  'accessory|navy': 63,
  'accessory|cream': 54,
  'bag|black': 86,
  'bag|navy': 98,
  'bag|cream': 32,
  'headwear|black': 86,
  'headwear|navy': 84,
  'headwear|cream': 93,
  'jewelry|black': 94,
  'jewelry|navy': 50,
  'jewelry|cream': 44,
};

function cells(): [string, RelevanceSlot, string, FixtureRow[]][] {
  return Object.entries(fixture).map(([key, rows]) => {
    const [slot, colour] = key.split('|');
    return [key, slot as RelevanceSlot, colour, rows];
  });
}

function admitted(slot: RelevanceSlot, colour: string, rows: FixtureRow[]): FixtureRow[] {
  return rows.filter(
    (r) => admitProduct(r.name, { slot, noun: NOUN[slot], colour, brand: r.brand }).admitted,
  );
}

// ---------------------------------------------------------------------------
// The named cases. Every one of these is a real title from the recorded rows,
// and every one of them satisfied the Datafeedr query exactly.
// ---------------------------------------------------------------------------

test('a coat is not a coated jean', () => {
  const v = admitProduct('L\'AGENCE Marguerite Coated Skinny Jean In Black Coated', {
    slot: 'outerwear',
    noun: 'coat',
    colour: 'black',
    brand: "L'AGENCE",
  });
  // `name LIKE black coat` matched this because LIKE is substring-ish across
  // words. It was the TOP result for the outerwear slot in two of three colours.
  assert.equal(v.admitted, false);
});

test('a dress is not a dress pant', () => {
  const v = admitProduct("Lucky Brand Men's Navy Dress Pant, Navy Blue, 31 x 32", {
    slot: 'dress',
    noun: 'dress',
    colour: 'navy',
    brand: 'Lucky Brand',
  });
  assert.equal(v.admitted, false);
  assert.equal(v.admitted === false && v.reason, 'other_garment');
});

test('cream is a colour, ice cream is a flavour', () => {
  const v = admitProduct('Baby & Toddler Ice Cream Dress', {
    slot: 'dress',
    noun: 'dress',
    colour: 'cream',
    brand: 'Gap',
  });
  assert.equal(v.admitted, false);
});

test('shoe polish is not a shoe', () => {
  const v = admitProduct('Black Shoe Polish Cream 75ml Tube', {
    slot: 'footwear',
    noun: 'shoes',
    colour: 'black',
    brand: 'Dr. Martens',
  });
  assert.equal(v.admitted, false);
  assert.equal(v.admitted === false && v.reason, 'noun_is_modifier');
});

test('a scarf-printed dress is not a scarf', () => {
  const v = admitProduct('Halston Satin V-neck Maxi Dress in Navy Scarf Print', {
    slot: 'accessory',
    noun: 'scarf',
    colour: 'navy',
    brand: 'HALSTON',
  });
  assert.equal(v.admitted, false);
});

test('a swimsuit is not a scarf, however the words fall', () => {
  const v = admitProduct("Women's Indra Crochet Detail One-Piece Swimsuit - Cream Scarf Floral", {
    slot: 'accessory',
    noun: 'scarf',
    colour: 'cream',
    brand: null,
  });
  assert.equal(v.admitted, false);
  assert.equal(v.admitted === false && v.reason, 'other_garment');
});

test('a brand called Black Clover does not make a hat black', () => {
  const v = admitProduct('Black Clover Inner Luck 4 Adjustable Hat Baseball Caps', {
    slot: 'headwear',
    noun: 'hat',
    colour: 'black',
    brand: 'Black Clover',
  });
  assert.equal(v.admitted, false);

  // …but a genuinely black hat from that brand still gets through. The rule is
  // about where the word sits, not about refusing the brand.
  const ok = admitProduct('Black Clover Nation Adjustable Black Hat', {
    slot: 'headwear',
    noun: 'hat',
    colour: 'black',
    brand: 'Black Clover',
  });
  assert.equal(ok.admitted, true);
});

test('furniture for a garment is not the garment', () => {
  for (const title of [
    'Velvet Necklace Jewelry Display Bust Stand - Freestanding',
    'Modern Matte Black Shoe Cabinet with Gold Round Knobs',
    'SSWBasics Black Dressmaker Torso - Black Dress Form',
    'Minimalist Black Hat Hook Rack - Traceless Hat Hook',
  ]) {
    const slot: RelevanceSlot = title.includes('Necklace')
      ? 'jewelry'
      : title.includes('Shoe')
        ? 'footwear'
        : title.includes('Dress')
          ? 'dress'
          : 'headwear';
    const v = admitProduct(title, { slot, noun: NOUN[slot], colour: 'black', brand: null });
    assert.equal(v.admitted, false, `admitted furniture: ${title}`);
  }
});

test('parts and trimmings are not the garment', () => {
  for (const [title, slot] of [
    ['Amosfun 10Pcs Black Handbag Belt Buckles Bag Chains Buckles', 'bag'],
    ['LOLIPPYY 10Pcs Black Hat Brim Insert Accessories', 'headwear'],
    ['REGALWOVEN Waxed Necklace Cord Bulk Black Necklace String', 'jewelry'],
  ] as const) {
    const v = admitProduct(title, { slot, noun: NOUN[slot], colour: 'black', brand: null });
    assert.equal(v.admitted, false, `admitted a part: ${title}`);
  }
});

test("a child's garment is never an adult's gap", () => {
  const v = admitProduct('Boys Girls 3-12 Months Holiday Bucket Hat', {
    slot: 'headwear',
    noun: 'hat',
    colour: 'black',
    brand: null,
  });
  assert.equal(v.admitted, false);
  assert.equal(v.admitted === false && v.reason, 'refused_term');
});

test('the real garments still get through', () => {
  for (const [title, slot, colour] of [
    ["Indochino Men's Custom Hyde Black Shirt 100% Cotton", 'top', 'black'],
    ['Acne Studios SSENSE Exclusive Black Trousers', 'bottom', 'black'],
    ['Everlane Mac Coat In Black, Size Medium, Cotton', 'outerwear', 'black'],
    ["Kenneth Cole Women's Little Black Dress Asymmetrical-Hem", 'dress', 'black'],
    ['Merino Wool Black Scarf', 'accessory', 'black'],
    ['Mutayo Ekiye The Adora Mini Handbag in Black', 'bag', 'black'],
    ['Adornia Gold Black Floral Station Necklace - Black', 'jewelry', 'black'],
    ['FFORME - Jamie Wool Coat - Cream', 'outerwear', 'cream'],
    ['Twill Check Navy Scarf', 'accessory', 'navy'],
  ] as const) {
    const v = admitProduct(title, { slot, noun: NOUN[slot], colour, brand: null });
    assert.equal(v.admitted, true, `refused a real garment: ${title}`);
  }
});

// ---------------------------------------------------------------------------
// The corpus. Pins the measurement so the named cases cannot be satisfied by a
// filter that has quietly stopped refusing everything else.
// ---------------------------------------------------------------------------

test('every fixture cell keeps the number of rows it kept when measured', () => {
  const drift: string[] = [];
  for (const [key, slot, colour, rows] of cells()) {
    const kept = admitted(slot, colour, rows).length;
    const want = EXPECTED[key];
    if (want === undefined) {
      drift.push(`${key}: no pinned count (measured ${kept}/${rows.length})`);
    } else if (kept !== want) {
      drift.push(`${key}: pinned ${want}, measured ${kept} of ${rows.length}`);
    }
  }
  assert.deepEqual(
    drift,
    [],
    `Relevance changed. Read the rows before re-pinning:\n  ${drift.join('\n  ')}`,
  );
});

test('a verified slot can still fill three merchants', () => {
  // A filter tight enough to empty a slot is its own kind of failure: the row
  // silently disappears from the Gap Feed and nobody hears about it. Measured
  // per slot rather than per colour, because a genuinely rare garment — a cream
  // coat — legitimately returns less than a black one.
  const thin: string[] = [];
  for (const [key, slot, colour, rows] of cells()) {
    const merchants = new Set(admitted(slot, colour, rows).map((r) => r.merchant));
    if (merchants.size < 3) thin.push(`${key}: ${merchants.size} merchant(s)`);
  }
  // `footwear` is the known exception and is listed rather than hidden: the
  // colour+"shoes" phrasing collides with sizing text ("Boys", "Kids") across
  // the allowlist, so it clears the junk bar but rarely fills three shops. It
  // ships anyway — three correct rows is the cap, not the requirement, and one
  // right answer beats three wrong ones.
  assert.deepEqual(
    thin.filter((t) => !t.startsWith('footwear|')),
    [],
  );
});

test('every slot index.ts marks verified is covered by this fixture', () => {
  // Read as TEXT rather than imported: index.ts pulls in `npm:@supabase/server`
  // and the Deno globals, neither of which exists in the Node test runner. This
  // is the seam that makes `verified: true` mean "a fixture backs it" instead
  // of "somebody typed true".
  const source = readFileSync('supabase/functions/gap-shop-match/index.ts', 'utf8');
  const table = source.slice(
    source.indexOf('const SLOT_QUERY'),
    source.indexOf('other: null'),
  );

  const verified = [...table.matchAll(/^\s*(\w+): \{ word: '([^']+)', verified: (true|false) \}/gm)]
    .filter((m) => m[3] === 'true')
    .map((m) => ({ slot: m[1] as RelevanceSlot, word: m[2] }));

  assert.ok(verified.length > 0, 'parsed no slots out of SLOT_QUERY — has its shape changed?');

  for (const { slot, word } of verified) {
    assert.equal(word, NOUN[slot], `${slot}: index.ts searches '${word}', fixture used '${NOUN[slot]}'`);
    const covered = Object.keys(fixture).filter((k) => k.startsWith(`${slot}|`));
    assert.ok(covered.length >= 3, `${slot} is verified but has ${covered.length} fixture cells`);
  }
});
