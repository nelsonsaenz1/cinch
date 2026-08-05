/**
 * Colour conversion, family classification and harmony scoring.
 *
 * The conversions are checked by round-trip and against the published OKLab
 * reference values rather than against numbers copied out of the current
 * implementation — otherwise the test would happily ratify a broken matrix.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzePalette,
  deltaE,
  fitToPalette,
  hexToOklch,
  hueDistance,
  hueFamily,
  isMetallicName,
  neutrality,
  oklchToHex,
  pairHarmony,
  parseHex,
  resolveColorName,
  toGarmentColors,
  type GarmentColor,
} from '../src/lib/color';

const color = (name: string, weight = 0.5): GarmentColor => {
  const c = toGarmentColors([{ name }])[0];
  assert.ok(c, `fixture colour "${name}" did not resolve`);
  return { ...c, weight };
};

// ---------------------------------------------------------------------------
// sRGB / OKLCH
// ---------------------------------------------------------------------------

test('parseHex accepts 3- and 6-digit forms, with or without the hash', () => {
  assert.deepEqual(parseHex('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(parseHex('ffffff'), { r: 1, g: 1, b: 1 });
  assert.deepEqual(parseHex('#fff'), parseHex('#ffffff'));
  assert.deepEqual(parseHex('  #FFF  '), parseHex('#ffffff'));
});

test('parseHex rejects anything it cannot parse rather than guessing', () => {
  for (const bad of ['', '#', 'xyz', '#12345', '#1234567', 'rgb(1,2,3)', '#ggg']) {
    assert.equal(parseHex(bad), null, `parseHex(${JSON.stringify(bad)}) should be null`);
  }
});

test('hex -> OKLCH -> hex round-trips inside one 8-bit step', () => {
  const samples = [
    '#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff',
    '#1f2a44', '#b58f5f', '#6a6b3d', '#5e2233', '#e0479a', '#2549b8',
  ];
  for (const hex of samples) {
    const back = oklchToHex(hexToOklch(hex)!);
    const a = parseHex(hex)!;
    const b = parseHex(back)!;
    for (const ch of ['r', 'g', 'b'] as const) {
      const delta = Math.abs(a[ch] - b[ch]) * 255;
      assert.ok(delta <= 1.5, `${hex} -> ${back}: ${ch} drifted ${delta.toFixed(2)}/255`);
    }
  }
});

test('OKLab anchors match the published reference values', () => {
  // Ottosson's own worked examples: white is L=1, and pure sRGB primaries sit
  // where the paper says they do. Getting these wrong means a bad matrix.
  const white = hexToOklch('#ffffff')!;
  assert.ok(Math.abs(white.L - 1) < 0.002, `white L = ${white.L}`);
  assert.ok(white.C < 0.005, `white should be achromatic, C = ${white.C}`);

  const black = hexToOklch('#000000')!;
  assert.ok(Math.abs(black.L) < 0.002, `black L = ${black.L}`);

  const red = hexToOklch('#ff0000')!;
  assert.ok(Math.abs(red.L - 0.6279) < 0.01, `red L = ${red.L}`);
  assert.ok(Math.abs(red.h - 29.23) < 1, `red h = ${red.h}`);

  const blue = hexToOklch('#0000ff')!;
  assert.ok(Math.abs(blue.L - 0.4520) < 0.01, `blue L = ${blue.L}`);
  assert.ok(Math.abs(blue.h - 264.05) < 1, `blue h = ${blue.h}`);
});

test('near-grey has a defined, non-jittering hue of zero', () => {
  const grey = hexToOklch('#808080')!;
  assert.equal(grey.h, 0);
  assert.ok(grey.C < 1e-6);
});

test('hueDistance is circular, symmetric, and capped at 180', () => {
  assert.equal(hueDistance(350, 10), 20);
  assert.equal(hueDistance(10, 350), 20);
  assert.equal(hueDistance(0, 180), 180);
  assert.equal(hueDistance(0, 190), 170);
  assert.equal(hueDistance(45, 45), 0);
  assert.equal(hueDistance(-10, 10), 20);
  assert.equal(hueDistance(370, 10), 0);

  for (let a = 0; a < 360; a += 37) {
    for (let b = 0; b < 360; b += 53) {
      const d = hueDistance(a, b);
      assert.ok(d >= 0 && d <= 180, `hueDistance(${a},${b}) = ${d}`);
      assert.equal(d, hueDistance(b, a));
    }
  }
});

test('deltaE is zero for identical colours and symmetric otherwise', () => {
  const navy = hexToOklch('#1f2a44')!;
  const camel = hexToOklch('#b58f5f')!;
  assert.equal(deltaE(navy, navy), 0);
  assert.ok(Math.abs(deltaE(navy, camel) - deltaE(camel, navy)) < 1e-12);
  assert.ok(deltaE(navy, camel) > 0.14, 'navy and camel should be clearly different');
});

// ---------------------------------------------------------------------------
// Neutrality and families
// ---------------------------------------------------------------------------

test('achromatics are fully neutral and vivid colours are not', () => {
  for (const n of ['black', 'white', 'grey', 'charcoal']) {
    assert.ok(neutrality(resolveColorName(n)!) > 0.9, `${n} should read as neutral`);
  }
  for (const n of ['hot pink', 'cobalt', 'lime green']) {
    assert.ok(neutrality(resolveColorName(n)!) < 0.4, `${n} should not read as neutral`);
  }
});

test('wardrobe neutrals carrying real chroma still behave as neutrals', () => {
  // The whole point of the darkness and earth-tone corridors — without them the
  // engine refuses to pair navy with olive.
  for (const n of ['navy', 'olive', 'camel', 'beige', 'chocolate', 'taupe']) {
    assert.ok(neutrality(resolveColorName(n)!) > 0.6, `${n} should behave as a neutral`);
  }
});

test('neutrality stays inside 0..1 across the whole colour table', () => {
  for (const name of ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'sage', 'mustard']) {
    const n = neutrality(resolveColorName(name)!);
    assert.ok(n >= 0 && n <= 1, `${name} neutrality = ${n}`);
  }
});

test('hue families land where OKLCH puts them, not where the RGB wheel does', () => {
  assert.equal(hueFamily(resolveColorName('cobalt')!), 'blue');
  assert.equal(hueFamily(resolveColorName('scarlet')!), 'red');
  assert.equal(hueFamily(resolveColorName('hot pink')!), 'pink');
  assert.equal(hueFamily(resolveColorName('emerald')!), 'green');
  assert.equal(hueFamily(resolveColorName('turquoise')!), 'teal');
  // Neutrality wins over hue — navy is structurally a neutral, not a blue.
  assert.equal(hueFamily(resolveColorName('navy')!), 'neutral');
  assert.equal(hueFamily(resolveColorName('black')!), 'neutral');
});

// ---------------------------------------------------------------------------
// Name resolution
// ---------------------------------------------------------------------------

test('unresolvable and empty names return null rather than a default colour', () => {
  assert.equal(resolveColorName(''), null);
  assert.equal(resolveColorName('   '), null);
  assert.equal(resolveColorName('zzzz'), null);
});

test('multi-word names beat their single-word substrings', () => {
  const light = resolveColorName('light blue')!;
  const plain = resolveColorName('blue')!;
  assert.ok(light.L > plain.L, 'light blue should be lighter than blue');
});

test('modifiers the table cannot enumerate are applied to the anchor word', () => {
  const indigo = resolveColorName('indigo')!;

  const washed = resolveColorName('washed indigo')!;
  assert.ok(washed.L > indigo.L && washed.C < indigo.C, 'washed should lighten and desaturate');

  const deep = resolveColorName('deep indigo')!;
  assert.ok(deep.L < indigo.L, 'deep should darken');

  const neon = resolveColorName('neon pink')!;
  assert.ok(neon.C > resolveColorName('pink')!.C, 'neon should raise chroma');

  const dusty = resolveColorName('dusty rose')!;
  assert.ok(dusty.C < resolveColorName('rose')!.C, 'dusty should cut chroma');
});

test('modified colours stay inside the physical bounds of the space', () => {
  for (const n of ['light white', 'dark black', 'neon fuchsia', 'pale cream', 'deep espresso']) {
    const c = resolveColorName(n)!;
    assert.ok(c.L >= 0 && c.L <= 1, `${n} L = ${c.L}`);
    assert.ok(c.C >= 0 && c.C <= 0.4, `${n} C = ${c.C}`);
  }
});

test('metallics are recognised by name', () => {
  assert.ok(isMetallicName('gold'));
  assert.ok(isMetallicName('Rose Gold hardware'));
  // Word-boundary anchored, so a colour that merely contains the letters is not
  // mistaken for a metallic.
  assert.ok(!isMetallicName('golden'));
  assert.ok(!isMetallicName('navy'));
});

// ---------------------------------------------------------------------------
// toGarmentColors
// ---------------------------------------------------------------------------

test('garment colour weights decay and sum to one', () => {
  const cs = toGarmentColors([{ name: 'navy' }, { name: 'white' }, { name: 'camel' }]);
  assert.equal(cs.length, 3);
  const total = cs.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
  assert.ok(cs[0]!.weight > cs[1]!.weight && cs[1]!.weight > cs[2]!.weight, 'weights must decay');
});

test('a single colour carries the whole weight', () => {
  const [only] = toGarmentColors([{ name: 'navy' }]);
  assert.equal(only!.weight, 1);
});

test('hex beats the name when both are present', () => {
  const [c] = toGarmentColors([{ hex: '#ff0000', name: 'navy' }]);
  assert.equal(c!.family, 'red');
});

test('unresolvable colours are dropped, not defaulted', () => {
  assert.deepEqual(toGarmentColors([]), []);
  assert.deepEqual(toGarmentColors(null), []);
  assert.deepEqual(toGarmentColors(undefined), []);
  assert.deepEqual(toGarmentColors([{ name: 'zzzz' }]), []);

  const kept = toGarmentColors([{ name: 'navy' }, { name: 'zzzz' }]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.weight, 1, 'weights must renormalise after a drop');
});

// ---------------------------------------------------------------------------
// Pair harmony
// ---------------------------------------------------------------------------

test('pair harmony is symmetric', () => {
  const names = ['navy', 'camel', 'black', 'rust', 'olive', 'hot pink', 'grey', 'burgundy'];
  for (const a of names) {
    for (const b of names) {
      const ab = pairHarmony(color(a), color(b));
      const ba = pairHarmony(color(b), color(a));
      assert.equal(ab.score, ba.score, `${a}+${b} scored asymmetrically`);
      assert.equal(ab.label, ba.label, `${a}+${b} labelled asymmetrically`);
    }
  }
});

test('pair harmony always returns a score inside 0..1', () => {
  const names = ['navy', 'camel', 'black', 'white', 'rust', 'olive', 'hot pink', 'grey',
    'burgundy', 'mustard', 'sage', 'cobalt', 'lime green', 'gold', 'red'];
  for (const a of names) {
    for (const b of names) {
      const { score } = pairHarmony(color(a), color(b));
      assert.ok(score >= 0 && score <= 1, `${a}+${b} = ${score}`);
    }
  }
});

test('near-miss is caught before the neutral rule can wave it through', () => {
  // The two cases the ordering exists for. Both would otherwise score ~0.7.
  assert.equal(pairHarmony(color('navy'), color('black')).label, 'near-miss');
  assert.equal(pairHarmony(color('charcoal'), color('navy')).label, 'near-miss');
  assert.ok(pairHarmony(color('navy'), color('black')).score < 0.4);
});

test('the classic reliable pairings score well', () => {
  for (const [a, b] of [
    ['navy', 'camel'],
    ['black', 'white'],
    ['grey', 'burgundy'],
    ['olive', 'camel'],
  ] as const) {
    const { score } = pairHarmony(color(a), color(b));
    assert.ok(score >= 0.7, `${a} + ${b} scored only ${score.toFixed(2)}`);
  }
});

test('the discord zone is actively penalised, not merely unremarkable', () => {
  const { score } = pairHarmony(color('red'), color('lime green'));
  assert.ok(score < 0.5, `red + lime green scored ${score.toFixed(2)}`);
});

test('metallics short-circuit the clash calculation entirely', () => {
  for (const other of ['hot pink', 'lime green', 'navy', 'black']) {
    const { label, score } = pairHarmony(color('gold'), color(other));
    assert.equal(label, 'metallic-accent');
    assert.ok(score > 0.5, `gold + ${other} = ${score}`);
  }
});

test('a small vivid accent is allowed to be louder than a full panel', () => {
  // Both sides must clear the VIVID threshold for the relief term to engage;
  // cobalt and mustard are a genuinely loud complementary pair.
  const accent = pairHarmony(color('cobalt', 0.05), color('mustard', 0.95));
  const panel = pairHarmony(color('cobalt', 0.5), color('mustard', 0.5));
  assert.ok(accent.score > panel.score, 'a belt should be allowed to shout; a coat should not');
});

test('monochrome reads better when the values separate', () => {
  const flat = pairHarmony(color('navy'), color('indigo'));
  const separated = pairHarmony(color('light blue'), color('navy'));
  assert.ok(separated.score >= flat.score, 'value separation should not be punished');
});

// ---------------------------------------------------------------------------
// Whole-outfit palette
// ---------------------------------------------------------------------------

const piece = (name: string, visualWeight: number) => ({
  colors: toGarmentColors([{ name }]),
  visualWeight,
});

test('palette analysis is bounded and handles degenerate outfits', () => {
  assert.equal(analyzePalette([]).score, 0.6);
  assert.equal(analyzePalette([piece('navy', 0.3)]).score, 0.6);
  // A colourless garment collapses to the same "not enough to judge" branch.
  assert.equal(analyzePalette([piece('zzzz', 0.3), piece('zzzz', 0.3)]).score, 0.6);

  for (const outfit of [
    [piece('navy', 0.3), piece('camel', 0.3)],
    [piece('hot pink', 0.3), piece('lime green', 0.3), piece('cobalt', 0.3), piece('mustard', 0.3)],
    [piece('black', 0.4), piece('white', 0.3), piece('grey', 0.2), piece('charcoal', 0.1)],
  ]) {
    const a = analyzePalette(outfit);
    assert.ok(a.score >= 0 && a.score <= 1, `score ${a.score}`);
    assert.ok(a.cohesion >= 0 && a.cohesion <= 1, `cohesion ${a.cohesion}`);
    assert.ok(a.valueContrast >= 0 && a.valueContrast <= 1, `valueContrast ${a.valueContrast}`);
    assert.ok(a.chromaDiscipline >= 0 && a.chromaDiscipline <= 1, `discipline ${a.chromaDiscipline}`);
  }
});

test('four loud colours are disciplined harder than one', () => {
  const one = analyzePalette([piece('navy', 0.34), piece('grey', 0.26), piece('cobalt', 0.22)]);
  const four = analyzePalette([
    piece('cobalt', 0.34), piece('hot pink', 0.26), piece('lime green', 0.22), piece('mustard', 0.2),
  ]);
  assert.equal(one.chromaDiscipline, 1);
  assert.ok(four.chromaDiscipline < 0.6, `four loud colours scored ${four.chromaDiscipline}`);
  assert.ok(one.score > four.score);
});

test('a neutral anchor is detected only when it is a substantial piece', () => {
  const anchored = analyzePalette([piece('navy', 0.34), piece('rust', 0.26)]);
  assert.ok(anchored.hasNeutralAnchor);

  const trimOnly = analyzePalette([piece('cobalt', 0.34), piece('black', 0.04)]);
  assert.ok(!trimOnly.hasNeutralAnchor, 'a black belt is not an anchor');
});

test('fitToPalette falls back to neutral for an empty wardrobe and stays bounded', () => {
  assert.equal(fitToPalette(hexToOklch('#1f2a44')!, []), 0.6);
  for (const hex of ['#1f2a44', '#b58f5f', '#e0479a', '#000000', '#ffffff']) {
    const v = fitToPalette(hexToOklch(hex)!, [color('navy'), color('camel'), color('white')]);
    assert.ok(v >= 0 && v <= 1, `${hex} => ${v}`);
  }
});
