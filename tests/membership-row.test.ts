/**
 * PR-02 and MB-08 — the four reads, and the things none of them may say.
 *
 * The honesty rules on these two surfaces are all of the same shape: a value
 * that has not been read is not a value, and the screen may not fill the gap.
 * So the tests are mostly about ABSENCE — no price, no guessed date, no Free
 * claim on a failed read — which is exactly the kind of rule that rots
 * silently unless something asserts it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANCELLATION_NOTE,
  cancellationConsequence,
  entitlementBand,
  freeCeilingMark,
  isManageablePlan,
  paidAccessLine,
  paidThroughMark,
} from '../src/features/billing/manage-membership';
import { membershipRowFor, type MembershipRowInput } from '../src/features/billing/membership-row';
import { PLANS } from '../src/features/billing/plans';

const base: MembershipRowInput = {
  plan: 'free',
  trialing: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  loading: false,
  unconfirmed: false,
};

const MARCH = new Date('2027-03-03T00:00:00Z');

test('a read in flight says so, and claims nothing', () => {
  const row = membershipRowFor({ ...base, loading: true });
  assert.equal(row.state, 'reading');
  assert.equal(row.value, 'Checking…');
  assert.equal(row.chevron, false);
  assert.equal(row.retry, false);
  // Never "Free". The silent fallback is indistinguishable from a real answer.
  assert.doesNotMatch(row.label, /free/i);
});

test('a failed read offers a retry and no date at all', () => {
  const row = membershipRowFor({ ...base, unconfirmed: true, currentPeriodEnd: MARCH });
  assert.equal(row.state, 'failed');
  assert.match(row.label, /can’t be confirmed/);
  assert.equal(row.retry, true);
  assert.equal(row.chevron, false);
  // A guessed date on a failed read is worse than none — and even a date the
  // hook happens to be holding is a date this state has not confirmed.
  assert.doesNotMatch(row.value, /March/);
});

test('a confirmed plan names its term and its ceiling, never a renewal', () => {
  const row = membershipRowFor({ ...base, plan: 'standard', currentPeriodEnd: MARCH });
  assert.equal(row.state, 'confirmed');
  assert.equal(row.label, 'Cinch Standard');
  assert.match(row.value, /^Through /);
  assert.match(row.value, /150 active pieces/);
  // "Through", never "Renews": renewal is the store's to decide and this app
  // has never read a renewal intent.
  assert.doesNotMatch(row.value, /renew/i);
  assert.equal(row.chevron, true);
});

test('an unknown period end drops the term rather than computing one', () => {
  const row = membershipRowFor({ ...base, plan: 'pro', currentPeriodEnd: null });
  assert.equal(row.value, '1,000 active pieces');
});

test('a trial is drawn only when the read returns one, and always with its end', () => {
  const trial = membershipRowFor({
    ...base,
    plan: 'pro',
    trialing: true,
    trialEndsAt: new Date('2026-09-12T00:00:00Z'),
  });
  assert.equal(trial.state, 'trialing');
  assert.match(trial.value, /Trial through /);

  // And nothing assumes one exists: the settled free account is not a trial.
  assert.equal(membershipRowFor(base).state, 'confirmed');
});

/**
 * REPLACES 'a settled free account draws no row' (2026-09-02).
 *
 * Correction 30 hid the free row because there was no Free membership object
 * for one to be about, and because `/membership` refused a free account with a
 * single sentence. Both halves of that have changed: the page now draws the
 * comparison and a door, and the founder's audit found the hidden row was
 * leaving free accounts with no way to reach it from Settings while Today and
 * Closet were selling to them.
 *
 * The objection the old test encoded — that printing "Free" presents
 * `usePlan()`'s least-privilege default as a confirmed fact — is answered by
 * where the branch sits rather than by hiding it: `loading` and `unconfirmed`
 * are both ruled out above it, which is what makes this answer confirmed. The
 * two states that have genuinely read nothing still name no tier, and the test
 * above still holds them to it.
 */
test('a settled free account names its tier and opens the page', () => {
  const row = membershipRowFor(base);
  assert.equal(row.visible, true);
  assert.equal(row.state, 'confirmed');
  assert.equal(row.label, `Cinch ${PLANS.free.name}`);
  assert.equal(row.chevron, true);
  assert.equal(row.retry, false);
  // The ceiling it actually holds, from PLANS — and still no price, no offer
  // and no upgrade word on the row itself.
  assert.ok(row.value.includes(String(PLANS.free.items)));
  assert.doesNotMatch(`${row.label} ${row.value}`, /\$|price|renew|upgrade|subscribe/i);
});

test('no membership surface prints a price or a duration', () => {
  // A settings row is a layout, and a price typed into a layout is wrong in
  // every country but one. The duration rule is correction 06: no default
  // trial is drawn, and "14 days" may never reach shipping copy.
  const strings = [
    ...['reading', 'failed', 'confirmed', 'trialing'].map((_s, i) =>
      membershipRowFor(
        [
          { ...base, loading: true },
          { ...base, unconfirmed: true },
          { ...base, plan: 'standard' as const, currentPeriodEnd: MARCH },
          { ...base, plan: 'pro' as const, trialing: true, trialEndsAt: MARCH },
        ][i]!,
      ),
    ).flatMap((r) => [r.label, r.value]),
    paidAccessLine(PLANS.standard, MARCH),
    paidAccessLine(PLANS.standard, null),
    cancellationConsequence(MARCH),
    cancellationConsequence(null),
    paidThroughMark(MARCH),
    freeCeilingMark(),
    CANCELLATION_NOTE,
  ];
  for (const s of strings) {
    assert.doesNotMatch(s, /\$|\d+\s*\/\s*(month|year)|per month/i, `price in: ${s}`);
    assert.doesNotMatch(s, /14[- ]day|free trial/i, `trial term in: ${s}`);
  }
});

test('the entitlement band draws only counts that were actually read', () => {
  assert.deepEqual(entitlementBand({ copy: PLANS.standard, used: null, stored: null }), []);
  assert.deepEqual(entitlementBand({ copy: PLANS.standard, used: 148, stored: 12 }), [
    { label: 'Active pieces', value: '148 of 150' },
    { label: 'Stored pieces', value: '12 of 450' },
  ]);
});

test('cancellation promises no automatic downgrade, and quotes the real free ceilings', () => {
  const line = cancellationConsequence(MARCH);
  assert.match(line, /nothing is deleted/);
  assert.match(line, new RegExp(`${PLANS.free.items} active pieces`));
  assert.match(line, new RegExp(`${PLANS.free.storedItems} in total`));
  // Correction 35: no job moves overflow into storage, and no chooser flow
  // exists to be promised either (dependency C).
  assert.doesNotMatch(line, /will ask|move .* to storage|automatic/i);
});

test('the masthead and the rule line set the same facts as marks, never guesses', () => {
  // The tier is the plate and the term is the colophon under it. No date read
  // means no colophon at all — the same refusal the prose made, in type.
  assert.match(paidThroughMark(MARCH), /^PAID THROUGH /);
  assert.equal(paidThroughMark(null), '');

  // The ceilings moved out of the paragraph and into the mark, so this is now
  // the surface that has to keep quoting PLANS.free rather than a literal.
  const mark = freeCeilingMark();
  assert.match(mark, new RegExp(`${PLANS.free.items} ACTIVE`));
  assert.match(mark, new RegExp(`${PLANS.free.storedItems} STORED`));

  // And the one sentence left on screen still leads with the good news.
  assert.match(CANCELLATION_NOTE, /Nothing is deleted/);
});

test('free never reaches the management page', () => {
  assert.equal(isManageablePlan('free'), false);
  assert.equal(isManageablePlan('standard'), true);
  assert.equal(isManageablePlan('pro'), true);
});
