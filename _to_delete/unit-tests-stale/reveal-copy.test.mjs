// tests/reveal-copy.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/closet/outfit-count.ts
function countOutfits(t) {
  return t.tops * t.bottoms * t.shoes + t.dresses * t.shoes;
}
function missingForFirstOutfit(t) {
  if (countOutfits(t) > 0) return [];
  const missing = [];
  if (t.shoes === 0) missing.push("shoes");
  if (t.dresses === 0) {
    if (t.tops === 0) missing.push("tops");
    if (t.bottoms === 0) missing.push("bottoms");
  }
  return missing;
}

// src/features/onboarding/reveal-copy.ts
var WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty"
];
function numberWord(n) {
  return WORDS[n] ?? String(n);
}
var ORDINAL_WORDS = [
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
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth"
];
function ordinalWord(n) {
  return ORDINAL_WORDS[n] ?? `${n}th`;
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function defaultDerivation(tally) {
  const core = tally.tops * tally.bottoms * tally.shoes;
  const fromDress = tally.dresses * tally.shoes;
  const parts = [`${cap(numberWord(core))} from your tops, bottoms and shoes.`];
  if (fromDress > 0) {
    parts.push(`${cap(numberWord(fromDress))} more from the dress.`);
  }
  parts.push("Counted from what you photographed, not an estimate.");
  return parts.join(" ");
}
function substitutionDerivation(tally, redirectedTo) {
  const kindWord = redirectedTo === "bottoms" ? "bottom" : redirectedTo.slice(0, -1);
  const count = tally[redirectedTo];
  const other = redirectedTo === "tops" ? "bottoms" : "tops";
  return `You swapped the dress for a ${ordinalWord(count)} ${kindWord}, so the maths changed: ${numberWord(tally[redirectedTo])} ${redirectedTo} across ${numberWord(tally[other])} ${other} and ${numberWord(tally.shoes)} pair${tally.shoes === 1 ? "" : "s"} of shoes.`;
}
function compositionChips(tally, hasOuterwear, hasBag) {
  const chips = [];
  if (tally.tops) chips.push(`${tally.tops} top${tally.tops === 1 ? "" : "s"}`);
  if (tally.bottoms) chips.push(`${tally.bottoms} bottom${tally.bottoms === 1 ? "" : "s"}`);
  if (tally.dresses) chips.push(`${tally.dresses} dress${tally.dresses === 1 ? "" : "es"}`);
  if (tally.shoes) chips.push(`${tally.shoes} shoe${tally.shoes === 1 ? "" : "s"}`);
  if (hasOuterwear) chips.push("1 coat");
  if (hasBag) chips.push("1 bag");
  return chips;
}
function headline(pieceCount, tally) {
  const outfits = countOutfits(tally);
  return `${cap(numberWord(pieceCount))} piece${pieceCount === 1 ? "" : "s"}. ${cap(numberWord(outfits))} outfit${outfits === 1 ? "" : "s"}.`;
}
function zeroHeadline(pieceCount) {
  return `${cap(numberWord(pieceCount))} piece${pieceCount === 1 ? "" : "s"}. No outfits yet.`;
}
var NEEDED_NAME = {
  tops: "a top",
  bottoms: "a bottom",
  dresses: "a dress",
  shoes: "shoes"
};
var NEEDED_ORDER = ["bottoms", "dresses", "tops", "shoes"];
function neededList(missing) {
  const named = NEEDED_ORDER.filter((k) => missing.includes(k)).map((k) => NEEDED_NAME[k]);
  return named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}
function zeroBody(tally) {
  const missing = missingForFirstOutfit(tally);
  if (missing.length === 0) return "";
  return `Nothing you photographed goes anywhere. Cinch won\u2019t put a look together without something to wear with it \u2014 ${neededList(missing)} is all it needs.`;
}
function missingRows(tally) {
  const missing = new Set(missingForFirstOutfit(tally));
  const rows = [];
  const row = (kind, label) => {
    const count = tally[kind];
    const needed = missing.has(kind);
    if (count === 0 && !needed) return;
    rows.push({ label, value: needed ? "0 \u2014 needed" : String(count), needed });
  };
  row("tops", "Tops");
  row("dresses", "Dresses");
  row("bottoms", "Bottoms");
  row("shoes", "Shoes");
  return rows;
}
function smallestFix(tally) {
  const missing = missingForFirstOutfit(tally);
  if (missing.length === 0) return null;
  const list = neededList(missing);
  const CANONICAL_TOPS = 3;
  const surplus = tally.tops - CANONICAL_TOPS;
  if (!missing.includes("tops") && surplus >= missing.length) {
    const n = Math.min(missing.length, surplus);
    return `Swap ${numberWord(n)} top${n === 1 ? "" : "s"} for ${list}`;
  }
  return `Add ${list} to build your first outfit`;
}

// tests/reveal-copy.test.ts
var closet = (tops, bottoms, dresses, shoes) => ({
  tops,
  bottoms,
  dresses,
  shoes
});
test("R-02: the canonical ten", () => {
  const t = closet(3, 2, 1, 2);
  assert.equal(headline(10, t), "Ten pieces. Fourteen outfits.");
  assert.equal(
    defaultDerivation(t),
    "Twelve from your tops, bottoms and shoes. Two more from the dress. Counted from what you photographed, not an estimate."
  );
  assert.deepEqual(compositionChips(t, true, true), [
    "3 tops",
    "2 bottoms",
    "1 dress",
    "2 shoes",
    "1 coat",
    "1 bag"
  ]);
});
test("R-04: the dress redirected to a fourth top", () => {
  const t = closet(4, 2, 0, 2);
  assert.equal(headline(10, t), "Ten pieces. Sixteen outfits.");
  assert.equal(
    substitutionDerivation(t, "tops"),
    "You swapped the dress for a fourth top, so the maths changed: four tops across two bottoms and two pairs of shoes."
  );
  assert.deepEqual(compositionChips(t, true, true), ["4 tops", "2 bottoms", "2 shoes", "1 coat", "1 bag"]);
});
test("R-05: ten tops and nothing else", () => {
  const t = closet(10, 0, 0, 0);
  assert.equal(zeroHeadline(10), "Ten pieces. No outfits yet.");
  assert.deepEqual(missingRows(t), [
    { label: "Tops", value: "10", needed: false },
    { label: "Bottoms", value: "0 \u2014 needed", needed: true },
    { label: "Shoes", value: "0 \u2014 needed", needed: true }
  ]);
  assert.equal(smallestFix(t), "Swap two tops for a bottom and shoes");
  assert.equal(
    zeroBody(t),
    "Nothing you photographed goes anywhere. Cinch won\u2019t put a look together without something to wear with it \u2014 a bottom and shoes is all it needs."
  );
});
test("R-05 generalises past the ten-tops example \u2014 a lone missing kind names only itself", () => {
  const t = closet(3, 2, 1, 0);
  assert.deepEqual(missingRows(t), [
    { label: "Tops", value: "3", needed: false },
    { label: "Dresses", value: "1", needed: false },
    { label: "Bottoms", value: "2", needed: false },
    { label: "Shoes", value: "0 \u2014 needed", needed: true }
  ]);
  assert.equal(smallestFix(t), "Add shoes to build your first outfit");
  assert.equal(
    zeroBody(t),
    "Nothing you photographed goes anywhere. Cinch won\u2019t put a look together without something to wear with it \u2014 shoes is all it needs."
  );
});
test("a closet that already makes something has no fix to offer", () => {
  assert.equal(smallestFix(closet(3, 2, 1, 2)), null);
});
test("zero pieces is still handled honestly", () => {
  assert.equal(zeroHeadline(0), "Zero pieces. No outfits yet.");
});
