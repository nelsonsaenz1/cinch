// tests/plans.test.ts
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

// tests/plans.test.ts
var EDGE_ITEM_LIMITS = { free: 10, standard: 150, pro: 1e3 };
var EDGE_STORED_ITEM_LIMITS = { free: 30, standard: 450, pro: 3e3 };
var EDGE_OUTFIT_CEILINGS = {
  free: { limit: 5, period: "week" },
  standard: { limit: 15, period: "day" },
  pro: { limit: 60, period: "day" }
};
test("client plan copy agrees with the edge/database item limits", () => {
  for (const plan of ["free", "standard", "pro"]) {
    assert.equal(
      PLANS[plan].items,
      EDGE_ITEM_LIMITS[plan],
      `${plan}: client says ${PLANS[plan].items}, edge/database say ${EDGE_ITEM_LIMITS[plan]}`
    );
    assert.equal(
      PLANS[plan].storedItems,
      EDGE_STORED_ITEM_LIMITS[plan],
      `${plan}: client stores ${PLANS[plan].storedItems}, edge/database say ${EDGE_STORED_ITEM_LIMITS[plan]}`
    );
  }
});
test("the outfit promise sits below the enforced ceiling, in the same period", () => {
  for (const plan of ["free", "standard"]) {
    const promise = PLANS[plan].outfitPromise;
    assert.ok(promise, `${plan} must promise a number \u2014 context-lines.ts quotes it`);
    assert.equal(promise.period, EDGE_OUTFIT_CEILINGS[plan].period, plan);
    assert.ok(
      promise.count < EDGE_OUTFIT_CEILINGS[plan].limit,
      `${plan}: promises ${promise.count} per ${promise.period} against a ceiling of ${EDGE_OUTFIT_CEILINGS[plan].limit}`
    );
  }
});
test("Pro promises no outfit number, because its copy says Unlimited", () => {
  assert.equal(PLANS.pro.outfitPromise, null);
  assert.equal(PLANS.pro.outfits, "Unlimited");
});
test("the total ceiling leaves real room above the active one", () => {
  for (const plan of ["free", "standard", "pro"]) {
    assert.ok(
      PLANS[plan].storedItems > PLANS[plan].items,
      `${plan}: storing must free an active slot, so the total ceiling has to sit above the active one`
    );
  }
});
