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

test('add_garment_over_limit is the free closet, not fifty', () => {
  assert.equal(
    contextLineFor(Placement.AddGarmentOverLimit),
    `${PLANS.free.items} pieces is where the free closet stops. Outfits come out of the combinations rather than the count, which is why a closet grows faster than it fills. There's a coat in your camera roll.`,
  );
});

test('add_garment_over_limit does not publish an outfit count as a duration', () => {
  // Founder ruling, 2026-08-10. §3.1's line said "ten is enough to dress a
  // fortnight", which is the canonical ten's FOURTEEN OUTFITS restated as
  // fourteen days — the outfit count as a marketing constant with a duration
  // worn over it, which positioning-contract.md §3 forbids outright. It is
  // forbidden precisely because it is true of one particular ten: ten tops
  // make no outfits at all and would have been promised a fortnight.
  //
  // Asserting the sentence above would not catch a *different* duration
  // sneaking back in ("a fortnight" → "two weeks" → "a month"), so this
  // asserts the class.
  const line = contextLineFor(Placement.AddGarmentOverLimit)!;
  const durations = /\bfortnight|\bweeks?\b|\bmonths?\b|\bdays?\b|\bevery (morning|day)\b/i;
  assert.ok(!durations.test(line), `promises a span of time it cannot know: ${line}`);

  // The only number in the line is the free cap. Any second one is either an
  // outfit count (banned by §3) or a duplicate of the cap, which is what the
  // mechanical §7 fix produced: "10 … 10 … 10".
  const numbers = line.match(/\d+/g) ?? [];
  assert.deepEqual(numbers, [String(PLANS.free.items)], `more than the cap is quoted: ${line}`);
});

test('generate_outfit_over_limit is this week, not today', () => {
  assert.equal(
    contextLineFor(Placement.GenerateOutfitOverLimit),
    `That's this week's ${PLANS.free.outfitPromise.count} outfits. Members get a new set whenever the day changes on them.`,
  );
});

test('the free lines quote PLANS rather than a frozen copy of it', () => {
  // positioning-contract.md §7: these two spelled "Ten" and "three" out in
  // words until 2026-08-10, while STANDARD_LINES two screens below already
  // interpolated. Asserting the shape above would pass either way — this is
  // the test that fails if the literals come back.
  const garments = contextLineFor(Placement.AddGarmentOverLimit)!;
  assert.ok(garments.includes(String(PLANS.free.items)), garments);
  assert.ok(!/\bTen\b|\bten\b/.test(garments), `still spells the piece count out: ${garments}`);

  const outfits = contextLineFor(Placement.GenerateOutfitOverLimit)!;
  assert.ok(outfits.includes(String(PLANS.free.outfitPromise.count)), outfits);
  assert.ok(!/\bthree\b/.test(outfits), `still spells the outfit promise out: ${outfits}`);
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

// ---------------------------------------------------------------------------
// reveal_complete
//
// The one line that quotes the user's own arithmetic. positioning-contract.md
// §3 makes the outfit count a per-user computed result and forbids it as a
// constant anywhere — so the tests that matter most here are the ones proving
// the number came from the caller and that nothing is invented without one.
// ---------------------------------------------------------------------------

test('reveal_complete interpolates the count it was given, and only that count', () => {
  const fourteen = contextLineFor(Placement.RevealComplete, { outfitCount: 14 })!;
  const six = contextLineFor(Placement.RevealComplete, { outfitCount: 6 })!;

  assert.ok(fourteen.startsWith('14 outfits'), fourteen);
  assert.ok(six.startsWith('6 outfits'), six);
  assert.notEqual(fourteen, six);
  // A closet of six must not be told about fourteen, in either direction.
  assert.ok(!six.includes('14'), six);
});

test('reveal_complete says "outfit" for a closet that makes one', () => {
  const line = contextLineFor(Placement.RevealComplete, { outfitCount: 1 })!;
  assert.ok(line.startsWith('1 outfit from'), line);
  assert.ok(!line.includes('1 outfits'), line);
});

test('reveal_complete invents no number when it is given none', () => {
  // R-05 is a real state — a ten-piece closet with no wearable combination —
  // and a missing count is a caller that has not computed one yet. Neither may
  // become a plausible-looking figure.
  for (const opts of [{}, { outfitCount: null }, { outfitCount: 0 }, { outfitCount: Number.NaN }]) {
    const line = contextLineFor(Placement.RevealComplete, opts)!;
    assert.ok(typeof line === 'string' && line.length > 0, JSON.stringify(opts));
    assert.ok(!/outfit/.test(line), `claims outfits it never counted: ${line}`);
    assert.ok(!/NaN|null|undefined/.test(line), line);
  }
});

test('reveal_complete tells a trialing user about the trial, not the free ceiling', () => {
  // Every account is fourteen days into a trial when the Reveal fires
  // (handle_new_subscription(), migration 20260805160000), and usePlan folds a
  // live trial into `pro` — so this is the ordinary case, not the edge one.
  const line = contextLineFor(Placement.RevealComplete, {
    plan: 'pro',
    trialing: true,
    outfitCount: 14,
  })!;
  assert.ok(line.startsWith('14 outfits'), line);
  assert.ok(line.includes('trial'), line);
  assert.ok(!line.includes('free'), `promises a free ceiling to a user who has Pro: ${line}`);
});

test('reveal_complete says nothing at all to somebody already paying', () => {
  // No honest version of this sentence exists for a subscriber, and the
  // Standard ceiling lines are about limits a Reveal has not gone near.
  // MB-01 collapses the block, which is the right answer.
  for (const plan of ['standard', 'pro'] as const) {
    assert.equal(contextLineFor(Placement.RevealComplete, { plan, outfitCount: 14 }), null, plan);
  }
});

test('reveal_complete on a lapsed trial names what stays free', () => {
  const line = contextLineFor(Placement.RevealComplete, {
    plan: 'free',
    trialing: false,
    outfitCount: 14,
  })!;
  assert.ok(line.includes(String(PLANS.free.items)), line);
  assert.ok(line.includes('free'), line);
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
