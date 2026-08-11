// tests/gap-feed.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/closet/outfit-count.ts
var COUNTED_KINDS = ["shoes", "bottoms", "tops", "dresses"];
function countOutfits(t) {
  return t.tops * t.bottoms * t.shoes + t.dresses * t.shoes;
}
function withOne(t, kind) {
  return { ...t, [kind]: t[kind] + 1 };
}
function gainFrom(t, kind) {
  const total = countOutfits(withOne(t, kind));
  return { kind, total, gain: total - countOutfits(t) };
}
function rankGaps(t) {
  return COUNTED_KINDS.map((kind) => gainFrom(t, kind)).sort((a, b) => b.gain - a.gain);
}

// src/features/closet/gap-feed.ts
var ORDINALS = [
  "zeroth",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth"
];
function ordinal(n) {
  if (n >= 0 && n < ORDINALS.length) return ORDINALS[n];
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
var NOUN = {
  tops: { singular: "top", plural: "tops" },
  bottoms: { singular: "bottom", plural: "bottoms" },
  dresses: { singular: "dress", plural: "dresses" },
  shoes: { singular: "pair of shoes", plural: "pairs of shoes" }
};
function gapNoun(kind, count = 1) {
  return count === 1 ? NOUN[kind].singular : NOUN[kind].plural;
}
function gapLabel(tally, kind) {
  const position = ordinal(tally[kind] + 1);
  const article = /^[aeiou]/i.test(position) ? "An" : "A";
  return `${article} ${position} ${gapNoun(kind)}`;
}
function nounWithArticle(kind) {
  const noun = gapNoun(kind);
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}
function mostOwnedKind(tally) {
  return [...COUNTED_KINDS].sort((a, b) => tally[b] - tally[a])[0];
}
function swapAdvice(tally, addKind) {
  const fromKind = mostOwnedKind(tally);
  if (fromKind === addKind || tally[fromKind] <= 1) return null;
  return `Swap ${nounWithArticle(fromKind)} for ${nounWithArticle(addKind)}`;
}
function describeGap(tally, gain) {
  const from = countOutfits(tally);
  const arrow = `${from} outfit${from === 1 ? "" : "s"} \u2192 ${gain.total}`;
  switch (gain.kind) {
    case "shoes": {
      const dressNote = tally.dresses > 0 ? ", including the dress" : "";
      return `${arrow}. Pairs with everything you own${dressNote}.`;
    }
    case "bottoms": {
      if (tally.tops > 0) {
        return `${arrow}. Your ${tally.tops} ${tally.tops === 1 ? "top works" : "tops all work"} over it.`;
      }
      return `${arrow}. Opens outfits your dress alone can't reach.`;
    }
    case "tops": {
      if (tally.bottoms > 0) {
        return `${arrow}. Layers over the ${tally.bottoms} ${gapNoun("bottoms", tally.bottoms)} you already own.`;
      }
      return `${arrow}. Needs a bottom or a dress beside it to make anything.`;
    }
    case "dresses":
      return `${arrow}. Its own pairings with the shoes you already own.`;
  }
}
function dominantGaps(ranked) {
  const [first] = ranked;
  if (!first || first.gain <= 0) return null;
  const leaders = ranked.filter((g) => g.gain === first.gain);
  const rest = ranked.filter((g) => g.gain !== first.gain);
  const restMax = rest.reduce((max, g) => Math.max(max, g.gain), 0);
  if (restMax > 0 && restMax * 3 > first.gain) return null;
  return leaders;
}
function pairablePieces(kind, pieces, limit = 3) {
  const relevantKinds = kind === "shoes" ? ["tops", "bottoms", "dresses"] : kind === "dresses" ? ["shoes"] : ["shoes", kind === "tops" ? "bottoms" : "tops"];
  const relevant = pieces.filter((p) => relevantKinds.includes(p.kind)).map((p) => p.piece);
  return { shown: relevant.slice(0, limit), more: Math.max(0, relevant.length - limit) };
}
function corePreviewRows(kind, byKind, gain, limit = 3) {
  const rows = [];
  const pushCross = (a, b) => {
    const total = a.length * b.length;
    const n = Math.min(limit - rows.length, total);
    for (let i = 0; i < n; i++) rows.push([a[Math.floor(i / b.length)], b[i % b.length]]);
  };
  if (kind === "shoes") {
    pushCross(byKind.tops ?? [], byKind.bottoms ?? []);
    for (const d of byKind.dresses ?? []) {
      if (rows.length >= limit) break;
      rows.push([d]);
    }
  } else if (kind === "bottoms") {
    pushCross(byKind.tops ?? [], byKind.shoes ?? []);
  } else if (kind === "tops") {
    pushCross(byKind.bottoms ?? [], byKind.shoes ?? []);
  } else {
    for (const s of byKind.shoes ?? []) {
      if (rows.length >= limit) break;
      rows.push([s]);
    }
  }
  return { shown: rows, more: Math.max(0, gain - rows.length) };
}

// tests/gap-feed.test.ts
var closet = (tops, bottoms, dresses, shoes) => ({
  tops,
  bottoms,
  dresses,
  shoes
});
var THE_TEN = closet(3, 2, 1, 2);
test("ordinal words", () => {
  assert.equal(ordinal(1), "first");
  assert.equal(ordinal(4), "fourth");
  assert.equal(ordinal(11), "eleventh");
  assert.equal(ordinal(13), "13th");
  assert.equal(ordinal(22), "22nd");
  assert.equal(ordinal(23), "23rd");
});
test("gap labels are the literal owned+1 ordinal, for every kind including shoes", () => {
  assert.equal(gapLabel(THE_TEN, "tops"), "A fourth top");
  assert.equal(gapLabel(THE_TEN, "bottoms"), "A third bottom");
  assert.equal(gapLabel(THE_TEN, "dresses"), "A second dress");
  assert.equal(gapLabel(THE_TEN, "shoes"), "A third pair of shoes");
  assert.equal(gapLabel(closet(7, 0, 0, 0), "tops"), "An eighth top");
});
test('gapNoun pluralises only the noun, "pair(s) of shoes" included', () => {
  assert.equal(gapNoun("shoes", 1), "pair of shoes");
  assert.equal(gapNoun("shoes", 2), "pairs of shoes");
  assert.equal(gapNoun("bottoms", 1), "bottom");
  assert.equal(gapNoun("bottoms", 3), "bottoms");
});
test("describeGap states the real arrow and never a fixed count", () => {
  const ranked = rankGaps(THE_TEN);
  const shoes = ranked.find((g) => g.kind === "shoes");
  assert.equal(describeGap(THE_TEN, shoes), "14 outfits \u2192 21. Pairs with everything you own, including the dress.");
  const noDress = closet(3, 2, 0, 2);
  const shoesNoDress = rankGaps(noDress).find((g) => g.kind === "shoes");
  assert.equal(describeGap(noDress, shoesNoDress), "12 outfits \u2192 18. Pairs with everything you own.");
  const bottoms = ranked.find((g) => g.kind === "bottoms");
  assert.equal(describeGap(THE_TEN, bottoms), "14 outfits \u2192 20. Your 3 tops all work over it.");
});
test("dominantGaps is null for a balanced closet \u2014 the ordinary ranked list stands", () => {
  assert.equal(dominantGaps(rankGaps(THE_TEN)), null);
});
test("dominantGaps reports a genuine tie rather than picking a winner for the user", () => {
  const unbalanced = closet(8, 1, 0, 1);
  const ranked = rankGaps(unbalanced);
  const leaders = dominantGaps(ranked);
  assert.ok(leaders);
  assert.deepEqual(
    leaders.map((g) => g.kind).sort(),
    ["bottoms", "shoes"]
  );
  assert.ok(leaders.every((g) => g.gain === 8));
});
test('a runner-up within a third of the leader is not "dominant"', () => {
  const ranked = [
    { kind: "shoes", total: 24, gain: 16 },
    { kind: "bottoms", total: 22, gain: 6 },
    // 6*3=18 <= 16? no: 18>16 -> not dominant
    { kind: "tops", total: 20, gain: 4 },
    { kind: "dresses", total: 18, gain: 2 }
  ];
  assert.equal(dominantGaps(ranked), null);
});
test("pairablePieces samples the real closet and never invents an item", () => {
  const pieces = [
    { id: "1", kind: "tops", piece: { name: "blouse" } },
    { id: "2", kind: "tops", piece: { name: "sweater" } },
    { id: "3", kind: "bottoms", piece: { name: "trousers" } },
    { id: "4", kind: "bottoms", piece: { name: "skirt" } },
    { id: "5", kind: "dresses", piece: { name: "dress" } },
    { id: "6", kind: "shoes", piece: { name: "loafers" } }
  ];
  const shoes = pairablePieces("shoes", pieces);
  assert.equal(shoes.shown.length, 3);
  assert.equal(shoes.more, 2);
  const dresses = pairablePieces("dresses", pieces);
  assert.deepEqual(
    dresses.shown.map((p) => p.name),
    ["loafers"]
  );
  assert.equal(dresses.more, 0);
  const bottoms = pairablePieces("bottoms", pieces);
  assert.equal(bottoms.shown.length, 3);
  assert.equal(bottoms.more, 0);
});
test("mostOwnedKind and nounWithArticle", () => {
  assert.equal(mostOwnedKind(closet(8, 1, 0, 1)), "tops");
  assert.equal(nounWithArticle("shoes"), "a pair of shoes");
  assert.equal(nounWithArticle("bottoms"), "a bottom");
});
test("swapAdvice names the genuinely plentiful kind, never a fixed pair", () => {
  assert.equal(swapAdvice(closet(8, 1, 0, 1), "bottoms"), "Swap a top for a bottom");
  assert.equal(swapAdvice(closet(8, 1, 0, 1), "shoes"), "Swap a top for a pair of shoes");
  assert.equal(swapAdvice(closet(1, 1, 1, 1), "shoes"), null);
});
test('corePreviewRows never fabricates a garment and ties "more" to the real gain', () => {
  const byKind = {
    tops: ["blouse", "sweater", "coat-look"],
    bottoms: ["trousers", "skirt"],
    dresses: ["dress"]
  };
  const { shown, more } = corePreviewRows("shoes", byKind, 7, 3);
  assert.equal(shown.length, 3);
  assert.equal(more, 4);
  for (const row of shown) {
    for (const piece of row) assert.ok(byKind.tops.includes(piece) || byKind.bottoms.includes(piece) || byKind.dresses.includes(piece));
  }
  const dressRows = corePreviewRows("dresses", { shoes: ["loafers", "boots"] }, 2, 3);
  assert.deepEqual(dressRows.shown, [["loafers"], ["boots"]]);
  assert.equal(dressRows.more, 0);
  assert.deepEqual(corePreviewRows("shoes", {}, 3, 3), { shown: [], more: 3 });
});
