/**
 * The six trigger lines, word for word against
 * docs/design/membership-packing-contract.md §3.1.
 *
 * Pure `.ts`, never a `.tsx` import — the test bundler runs esbuild and
 * cannot parse React Native's Flow source.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contextLineFor } from '../src/features/billing/context-lines';
import { PLANS } from '../src/features/billing/plans';
import { Placement } from '../src/features/billing/placements';

test('open_stylist names the question the user actually asked', () => {
  assert.equal(
    contextLineFor(Placement.OpenStylist),
    "You asked what to wear to the rehearsal dinner. The stylist has an answer — it's part of Standard.",
  );
});

test('add_garment_over_limit is ten, not fifty', () => {
  assert.equal(
    contextLineFor(Placement.AddGarmentOverLimit),
    'Ten pieces is where the free closet stops — and ten is enough to dress a fortnight. You have ten, and a coat in the camera roll.',
  );
});

test('generate_outfit_over_limit is this week, not today', () => {
  assert.equal(
    contextLineFor(Placement.GenerateOutfitOverLimit),
    "That's this week's three outfits. Members get a new set whenever the day changes on them.",
  );
});

test('trial_expired reassures nothing was deleted', () => {
  assert.equal(
    contextLineFor(Placement.TrialExpired),
    'Your two weeks are up. Nothing has been deleted — the closet is exactly where you left it.',
  );
});

test('event_hosting_over_limit names Standard, not Pro', () => {
  assert.equal(
    contextLineFor(Placement.EventHostingOverLimit),
    "You can join any event you're invited to. Hosting one — and inviting the table — is Standard.",
  );
});

test('repeat_upsell has no line — MB-01 collapses the block', () => {
  assert.equal(contextLineFor(Placement.RepeatUpsell), null);
});

test('packing_access falls back to the cityless line before any trip is answered', () => {
  assert.equal(
    contextLineFor(Placement.PackingAccess),
    'Pro packs the bag — day by day, from the closet you already own.',
  );
  // Explicit null/undefined opts read the same as omitting opts entirely —
  // neither invents a city.
  assert.equal(
    contextLineFor(Placement.PackingAccess, {}),
    'Pro packs the bag — day by day, from the closet you already own.',
  );
  assert.equal(
    contextLineFor(Placement.PackingAccess, { trip: null }),
    'Pro packs the bag — day by day, from the closet you already own.',
  );
});

test('packing_access interpolates the destination and duration once a trip is answered', () => {
  // Digits, not the atlas's spelled-out "Four" — matching trip.ts's own
  // tripColophon ("4 days"), and robust to a trip longer than the small
  // word-form table packing-math.ts keeps for its own, unrelated sentence.
  assert.equal(
    contextLineFor(Placement.PackingAccess, { trip: { destinationName: 'Lisbon', days: 4 } }),
    '4 days in Lisbon. Pro packs the bag — day by day, from the closet you already own.',
  );
});

test('a one-day trip says "day", not "days"', () => {
  const line = contextLineFor(Placement.PackingAccess, { trip: { destinationName: 'Porto', days: 1 } });
  assert.equal(line, '1 day in Porto. Pro packs the bag — day by day, from the closet you already own.');
});

test('every placement is accounted for — nothing falls through to undefined behaviour', () => {
  for (const placement of Object.values(Placement)) {
    // Every call must return a string or an explicit null; neither undefined
    // nor a throw is acceptable, because a broken line renders as
    // "undefined" above the headline instead of collapsing.
    const line = contextLineFor(placement);
    assert.ok(line === null || typeof line === 'string', `${placement}: ${String(line)}`);
  }
});

// ---------------------------------------------------------------------------
// The paid ceilings
//
// Campaign 100436 targets "no active entitlements", which excluded Standard
// subscribers from every upgrade offer. Widening it was blocked on exactly
// these lines: without them a Standard user who fills a 150-piece closet is
// told "Ten pieces is where the free closet stops. You have ten."
// ---------------------------------------------------------------------------

test('a Standard subscriber is never told the free-tier story', () => {
  for (const placement of [
    Placement.AddGarmentOverLimit,
    Placement.GenerateOutfitOverLimit,
    Placement.OpenStylist,
    Placement.EventHostingOverLimit,
  ] as const) {
    const free = contextLineFor(placement, { plan: 'free' });
    const standard = contextLineFor(placement, { plan: 'standard' });

    assert.ok(standard, `${placement} has no Standard line`);
    assert.notEqual(standard, free, `${placement} reuses the free line`);
    assert.ok(
      !standard!.toLowerCase().includes('free closet'),
      `${placement} tells a paying subscriber about the free closet: ${standard}`,
    );
  }
});

test('the Standard lines quote the real ceilings, not a frozen copy of them', () => {
  const garments = contextLineFor(Placement.AddGarmentOverLimit, { plan: 'standard' })!;
  assert.ok(garments.includes(String(PLANS.standard.items)), garments);
  assert.ok(garments.includes(PLANS.pro.items.toLocaleString('en-US')), garments);

  const events = contextLineFor(Placement.EventHostingOverLimit, { plan: 'standard' })!;
  assert.ok(events.includes(String(PLANS.standard.eventHosting)), events);
  assert.ok(events.includes(String(PLANS.pro.eventHosting)), events);
});

test('no plan given reads as free — the tier almost every paywall is shown to', () => {
  for (const placement of Object.values(Placement)) {
    assert.equal(contextLineFor(placement), contextLineFor(placement, { plan: 'free' }), placement);
  }
});

test('trial expiry and packing read the same on every plan', () => {
  // A subscriber never meets `trial_expired` — it fires when a trial lapsed to
  // free. And packing is Pro, so "why can't I pack" has one answer whether you
  // pay for Standard or nothing at all.
  for (const placement of [Placement.TrialExpired, Placement.PackingAccess] as const) {
    assert.equal(
      contextLineFor(placement, { plan: 'standard' }),
      contextLineFor(placement, { plan: 'free' }),
      placement,
    );
  }
});
