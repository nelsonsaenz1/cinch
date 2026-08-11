// tests/tour.test.ts
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

// src/features/onboarding/tour-copy.ts
var TOUR_CLOSET_TARGET = PLANS.free.items;
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
var TOUR_FRAMES = [
  {
    id: "TR-01",
    eyebrow: "One \xB7 The promise",
    headline: "Your whole closet, on one page.",
    body: "Cinch keeps a record of what you own and what you wore. No shop, no strangers, no feed to keep up with.",
    ground: "ink",
    plate: "closet",
    action: "Next",
    secondary: null,
    skippable: true
  },
  {
    id: "TR-02",
    eyebrow: "Two \xB7 The camera",
    headline: "Photograph it once.",
    body: `Lay a piece flat, take one picture, and Cinch cuts it out, names the colour and files it. ${cap(numberWord(TOUR_CLOSET_TARGET))} pieces is enough to start; the rest can come slowly.`,
    ground: "canvas",
    plate: "transformation",
    action: "Next",
    secondary: null,
    skippable: true
  },
  {
    id: "TR-03",
    eyebrow: "Three \xB7 The ritual",
    headline: "Then, every morning, one page.",
    body: "Today opens on the weather, what you wore last, and a look built from what is clean and in the wardrobe. Confirm it, or change it, and get on with the day.",
    ground: "canvas",
    plate: "morning",
    action: "Start with the camera",
    // Both ways out are real: begin capturing, or land on an app you have
    // already been told how to read.
    secondary: "I\u2019ll look around first",
    skippable: false
  }
];

// src/features/onboarding/tour-state.ts
var TOUR_FRAME_COUNT = 3;
function shouldShowTour(gate) {
  return gate.status === "ready" && gate.touredAt === null;
}
function frameAt(index) {
  const frame = TOUR_FRAMES[index];
  if (!frame) throw new Error(`No tour frame at index ${index}`);
  return frame;
}
function indexOfFrame(id) {
  return TOUR_FRAMES.findIndex((f) => f.id === id);
}
function isLastFrame(index) {
  return index === TOUR_FRAMES.length - 1;
}
function nextIndex(index) {
  return isLastFrame(index) ? null : index + 1;
}
function skipVisible(index) {
  return frameAt(index).skippable;
}
function exitDestination(exit, closetSize) {
  if (exit === "tabs") return "/(tabs)";
  if (closetSize !== null && closetSize >= PLANS.free.items) return "/capture";
  return "/the-ten";
}

// tests/tour.test.ts
test("three frames, hard limit \u2014 and they are TR-, not T-", () => {
  assert.equal(TOUR_FRAMES.length, TOUR_FRAME_COUNT);
  assert.deepEqual(
    TOUR_FRAMES.map((f) => f.id),
    ["TR-01", "TR-02", "TR-03"]
  );
});
test("TR-01 \u2014 the promise, on the one dark ground", () => {
  const f = frameAt(0);
  assert.equal(f.eyebrow, "One \xB7 The promise");
  assert.equal(f.headline, "Your whole closet, on one page.");
  assert.equal(
    f.body,
    "Cinch keeps a record of what you own and what you wore. No shop, no strangers, no feed to keep up with."
  );
  assert.equal(f.ground, "ink");
  assert.equal(f.action, "Next");
  assert.equal(f.secondary, null);
});
test("the dark ground is spent once", () => {
  assert.deepEqual(
    TOUR_FRAMES.map((f) => f.ground),
    ["ink", "canvas", "canvas"]
  );
});
test("TR-02 \u2014 the camera, and the ten is the free closet, not a typed number", () => {
  const f = frameAt(1);
  assert.equal(f.eyebrow, "Two \xB7 The camera");
  assert.equal(f.headline, "Photograph it once.");
  assert.equal(
    f.body,
    "Lay a piece flat, take one picture, and Cinch cuts it out, names the colour and files it. Ten pieces is enough to start; the rest can come slowly."
  );
  assert.equal(TOUR_CLOSET_TARGET, PLANS.free.items);
});
test("TR-03 \u2014 the ritual, and two real ways out", () => {
  const f = frameAt(2);
  assert.equal(f.eyebrow, "Three \xB7 The ritual");
  assert.equal(f.headline, "Then, every morning, one page.");
  assert.equal(
    f.body,
    "Today opens on the weather, what you wore last, and a look built from what is clean and in the wardrobe. Confirm it, or change it, and get on with the day."
  );
  assert.equal(f.action, "Start with the camera");
  assert.equal(f.secondary, "I\u2019ll look around first");
});
test("skip is on every frame but the last, where the two choices replace it", () => {
  assert.equal(skipVisible(0), true);
  assert.equal(skipVisible(1), true);
  assert.equal(skipVisible(2), false);
  TOUR_FRAMES.forEach((f, i) => {
    assert.equal(f.skippable, !isLastFrame(i));
    assert.equal(f.secondary == null, !isLastFrame(i));
  });
});
test("the deck walks forward and then stops", () => {
  assert.equal(nextIndex(0), 1);
  assert.equal(nextIndex(1), 2);
  assert.equal(nextIndex(2), null);
  assert.equal(indexOfFrame("TR-03"), 2);
  assert.throws(() => frameAt(3));
});
test("every headline is two or three words a line \u2014 none runs long", () => {
  for (const f of TOUR_FRAMES) {
    assert.ok(f.headline.split(" ").length <= 6, `${f.id} headline too long`);
    assert.ok(f.body.length <= 200, `${f.id} body too long: ${f.body.length}`);
  }
});
test("once, ever \u2014 the tour shows only for an account that has never been toured", () => {
  assert.equal(shouldShowTour({ status: "ready", touredAt: null }), true);
  assert.equal(shouldShowTour({ status: "ready", touredAt: "2026-08-09T09:41:00Z" }), false);
});
test("D1 \u2014 the camera exit lands in The Ten, which is what gives it an entrance", () => {
  assert.equal(exitDestination("camera", 0), "/the-ten");
  assert.equal(exitDestination("camera", 3), "/the-ten");
  assert.equal(exitDestination("camera", PLANS.free.items - 1), "/the-ten");
});
test("a closet already past the free ten gets the plain camera, not a guided ten", () => {
  assert.equal(exitDestination("camera", PLANS.free.items), "/capture");
  assert.equal(exitDestination("camera", 60), "/capture");
});
test("the escape stays an escape, whatever is in the closet", () => {
  assert.equal(exitDestination("tabs", 0), "/(tabs)");
  assert.equal(exitDestination("tabs", 60), "/(tabs)");
  assert.equal(exitDestination("tabs", null), "/(tabs)");
});
test("an unread closet falls to The Ten \u2014 the new account is the likely one", () => {
  assert.equal(exitDestination("camera", null), "/the-ten");
});
test("an unresolved or failed read never shows the tour", () => {
  assert.equal(shouldShowTour({ status: "loading" }), false);
  assert.equal(shouldShowTour({ status: "unavailable" }), false);
});
