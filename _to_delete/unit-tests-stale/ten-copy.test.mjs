// tests/ten-copy.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/billing/plans.ts
var PLANS = {
  free: {
    name: "Free",
    items: 10,
    storedItems: 30,
    outfits: "A few each week",
    // Three a week, against an enforced five — see the field's own note.
    outfitPromise: { count: 3, period: "week" },
    stylist: "Not included",
    eventHosting: 2,
    monthlyPriceHint: null,
    annualPriceHint: null
  },
  standard: {
    name: "Standard",
    items: 150,
    storedItems: 450,
    outfits: "A fresh outfit every day",
    outfitPromise: { count: 1, period: "day" },
    stylist: "30 messages a month",
    eventHosting: 15,
    monthlyPriceHint: "$7.99",
    annualPriceHint: "$59"
  },
  pro: {
    name: "Pro",
    items: 1e3,
    storedItems: 3e3,
    outfits: "Unlimited",
    outfitPromise: null,
    stylist: "Unlimited",
    eventHosting: 100,
    monthlyPriceHint: "$14.99",
    annualPriceHint: "$119"
  }
};

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
function articleFor(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// src/features/onboarding/ten-slots.ts
function canonicalTen() {
  const kinds = [
    "tops",
    "tops",
    "tops",
    "bottoms",
    "bottoms",
    "dresses",
    "shoes",
    "shoes",
    "outerwear",
    "bag"
  ];
  return kinds.map((kind, i) => ({
    id: i + 1,
    originalKind: kind,
    kind,
    status: "empty",
    garmentId: null
  }));
}
function settledCount(slots) {
  return slots.filter((s) => s.status !== "empty").length;
}
function nextSlot(slots) {
  return slots.find((s) => s.status === "empty") ?? null;
}
function fillSlot(slots, slotId, garmentId) {
  return slots.map(
    (s) => s.id === slotId && s.status === "empty" ? { ...s, status: "filled", garmentId } : s
  );
}
function declineSlot(slots, slotId, decision) {
  return slots.map((s) => {
    if (s.id !== slotId || s.status !== "empty") return s;
    if ("open" in decision) return { ...s, status: "open" };
    return { ...s, kind: decision.to };
  });
}

// src/features/onboarding/ten-copy.ts
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function tenProgressLine(slots) {
  const total = slots.length;
  const remaining = total - settledCount(slots);
  if (remaining === total) {
    return `${cap(numberWord(total))} pieces is enough for Cinch to style you properly. Photograph them, or pick them from your camera roll \u2014 in any order.`;
  }
  if (remaining === 1 && nextSlot(slots)?.kind === "bag") {
    return "One left. Cinch can't style you until the bag is in \u2014 every outfit it builds finishes with one.";
  }
  if (remaining === 0) {
    return `That\u2019s all ${numberWord(total)}. Nothing here is final \u2014 you can swap any piece later.`;
  }
  return `${remaining} to go. Nothing here is final \u2014 you can swap any piece later.`;
}
function stopSheetCopy(total, count) {
  const word = numberWord(total);
  const next = ordinalWord(total + 1);
  return {
    eyebrow: `${cap(word)} of ${word}`,
    title: `That\u2019s the ${word}. There\u2019s room for ${articleFor(next)} ${next} on a larger closet.`,
    body: `Your ${word} make ${count} outfit${count === 1 ? "" : "s"}. Nothing you\u2019ve photographed goes anywhere \u2014 you can swap a piece out whenever you like.`
  };
}

// tests/ten-copy.test.ts
test("the slot list IS the free closet \u2014 the two numbers may never drift", () => {
  assert.equal(canonicalTen().length, PLANS.free.items);
});
test("T-01 \u2014 the opening line names the free closet, not a typed ten", () => {
  assert.equal(
    tenProgressLine(canonicalTen()),
    "Ten pieces is enough for Cinch to style you properly. Photograph them, or pick them from your camera roll \u2014 in any order."
  );
});
test("T-01 offers the camera roll, not only the camera", () => {
  assert.match(tenProgressLine(canonicalTen()), /camera roll/);
});
test("the remaining count is the slot list less what is settled", () => {
  let slots = canonicalTen();
  slots = fillSlot(slots, 1, "g-1");
  assert.match(tenProgressLine(slots), /^9 to go\./);
  slots = declineSlot(slots, 6, { open: true });
  assert.match(tenProgressLine(slots), /^8 to go\./);
});
test("the bag sentence appears only when the bag is genuinely what is left", () => {
  const bagLast = canonicalTen().reduce(
    (slots, slot) => slot.kind === "bag" ? slots : fillSlot(slots, slot.id, `g-${slot.id}`),
    canonicalTen()
  );
  assert.match(tenProgressLine(bagLast), /Cinch can't style you until the bag is in/);
  const topLast = canonicalTen().reduce(
    (slots, slot) => slot.id === 3 ? slots : fillSlot(slots, slot.id, `g-${slot.id}`),
    canonicalTen()
  );
  assert.equal(topLast.filter((s) => s.status === "empty").length, 1);
  assert.doesNotMatch(tenProgressLine(topLast), /bag/);
  assert.match(tenProgressLine(topLast), /^1 to go\./);
});
test('a complete ten never prints "0 to go" behind the stop sheet', () => {
  const full = canonicalTen().reduce(
    (slots, slot) => fillSlot(slots, slot.id, `g-${slot.id}`),
    canonicalTen()
  );
  assert.equal(tenProgressLine(full), "That\u2019s all ten. Nothing here is final \u2014 you can swap any piece later.");
});
test("T-06 \u2014 the stop sheet, including the eleventh, is derived", () => {
  const copy = stopSheetCopy(PLANS.free.items, 14);
  assert.equal(copy.eyebrow, "Ten of ten");
  assert.equal(copy.title, "That\u2019s the ten. There\u2019s room for an eleventh on a larger closet.");
  assert.equal(
    copy.body,
    "Your ten make 14 outfits. Nothing you\u2019ve photographed goes anywhere \u2014 you can swap a piece out whenever you like."
  );
});
test("the eleventh moves with the tier, and takes its article with it", () => {
  assert.equal(
    stopSheetCopy(12, 20).title,
    "That\u2019s the twelve. There\u2019s room for a thirteenth on a larger closet."
  );
  assert.equal(stopSheetCopy(12, 20).eyebrow, "Twelve of twelve");
});
test("the outfit count is never a constant \u2014 one outfit is singular", () => {
  assert.match(stopSheetCopy(PLANS.free.items, 1).body, /make 1 outfit\./);
  assert.match(stopSheetCopy(PLANS.free.items, 0).body, /make 0 outfits\./);
});
