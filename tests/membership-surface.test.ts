/**
 * ONE membership state, and the four sentences it is allowed to produce.
 *
 * ── WHY THIS TEST EXISTS ──────────────────────────────────────────────────
 *
 * The founder's 2026-09-02 audit opened on a contradiction: the Membership
 * page said "There is no membership on this account to manage" while the
 * Upgrade route, for the same account in the same session, said "This account
 * is already on Pro". Both pages read `usePlan()`. Both computed their answer
 * correctly. They disagreed because they asked different questions of a folded
 * value — `plan !== 'free'` on one page, `canUpgrade(plan)` on the other — and
 * a legacy-trial account (a `free` row with a live `trial_ends_at`, which the
 * fold lifts to `pro`) falls through those two in opposite directions.
 *
 * So the assertions below are mostly about AGREEMENT, not about copy. A state
 * machine with one implementation cannot contradict itself, and that is the
 * whole claim `membership-surface.ts` makes.
 *
 * Pure: no renderer, no session, no clock. Every input is written out.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PLANS } from '../src/features/billing/plans';
import { canUpgrade, planDelta, upgradeDelta } from '../src/features/billing/upgrade-delta';
import {
  freeLead,
  membershipSurface,
  NOTHING_STARTED,
  PLANS_CTA,
  THANKS_UNVERIFIED_BODY,
  THANKS_UNVERIFIED_TITLE,
  thanksVerified,
  trialEndsBody,
  trialEndsTitle,
  upgradeSurface,
  type MembershipSurfaceInput,
} from '../src/features/membership/membership-surface';

const SEPTEMBER = new Date('2026-09-03T14:00:00Z');

/** A settled read of a plain free account — every case below is a delta of it. */
const FREE: MembershipSurfaceInput = {
  plan: 'free',
  paid: false,
  trialing: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  loading: false,
  unconfirmed: false,
};

/**
 * THE ACCOUNT THE AUDIT WAS LOOKING AT. A `free` row carrying a live
 * `trial_ends_at`, which `usePlan()` folds to `pro` for every ceiling in the
 * app while the account owns nothing at all.
 */
const TRIALING: MembershipSurfaceInput = {
  ...FREE,
  plan: 'pro',
  trialing: true,
  trialEndsAt: SEPTEMBER,
};

const PAID_STANDARD: MembershipSurfaceInput = {
  ...FREE,
  plan: 'standard',
  paid: true,
  currentPeriodEnd: SEPTEMBER,
};

const PAID_PRO: MembershipSurfaceInput = { ...PAID_STANDARD, plan: 'pro' };

// ---------------------------------------------------------------------------
// 1 · The five states
// ---------------------------------------------------------------------------

test('a read in flight is its own state and names no tier', () => {
  const surface = membershipSurface({ ...PAID_PRO, loading: true });
  assert.equal(surface.kind, 'reading');
  // Nothing is drawn from a read that has not landed — no manage rows, no
  // comparison, no door.
  assert.equal(surface.manageable, false);
  assert.equal(surface.comparison, false);
  assert.equal(surface.restorable, false);
});

test('a failed read is never collapsed into free', () => {
  // Telling a paying member they have no membership is the worst available lie
  // on a billing page, and `usePlan()` keeps `unconfirmed` apart from `free`
  // for exactly this branch to exist.
  const surface = membershipSurface({ ...FREE, unconfirmed: true });
  assert.equal(surface.kind, 'unconfirmed');
  assert.equal(surface.comparison, false);
});

test('a confirmed free account gets the comparison and a door, never a dead end', () => {
  const surface = membershipSurface(FREE);
  assert.equal(surface.kind, 'free');
  assert.equal(surface.comparison, true);
  // It owns nothing, so there is nothing to manage or cancel…
  assert.equal(surface.manageable, false);
  assert.equal(surface.upgradable, false);
  // …but a membership bought on another device is exactly what it might be
  // missing, so the restore check is still offered.
  assert.equal(surface.restorable, true);
});

test('a legacy trial is a trial, not a Pro membership', () => {
  const surface = membershipSurface(TRIALING);
  assert.equal(surface.kind, 'trialing');
  // The fold still says `pro` — every ceiling in the app depends on that — and
  // this state still knows the account bought nothing.
  assert.equal(surface.plan, 'pro');
  assert.equal(surface.manageable, false);
  assert.equal(surface.trialEndsAt, SEPTEMBER);
  // No billing period is carried into a state that has no billing.
  assert.equal(surface.currentPeriodEnd, null);
});

test('a paying member manages, and only a Standard one can move up', () => {
  const standard = membershipSurface(PAID_STANDARD);
  assert.equal(standard.kind, 'paid');
  assert.equal(standard.manageable, true);
  assert.equal(standard.upgradable, true);
  assert.equal(standard.currentPeriodEnd, SEPTEMBER);

  const pro = membershipSurface(PAID_PRO);
  assert.equal(pro.kind, 'paid');
  assert.equal(pro.upgradable, false);
});

test('a paid row with a stale trial date is paying, not trialing', () => {
  // `usePlan()`'s own fold settled this in the same direction — a paid row
  // wins, and the trial lifts only a free one — and this file must not
  // disagree with it. Before, the account read as "trialing" on Settings'
  // delete card and lost the clause about the subscription that keeps billing.
  const surface = membershipSurface({ ...PAID_STANDARD, trialing: true, trialEndsAt: SEPTEMBER });
  assert.equal(surface.kind, 'paid');
  assert.equal(surface.manageable, true);
});

test('no signed-in account is ever told there is no membership to manage', () => {
  // The finding, as an assertion. Every settled state has something to draw:
  // a subscription to manage, or plans to compare.
  for (const input of [FREE, TRIALING, PAID_STANDARD, PAID_PRO]) {
    const surface = membershipSurface(input);
    assert.ok(
      surface.manageable || surface.comparison,
      `${surface.kind} has neither a membership nor a comparison`,
    );
  }
});

test('the deleted refusal string is gone from the code, not merely unused', () => {
  // A dead constant is a dead constant until somebody imports it again. Both
  // files still discuss the sentence in prose — the reasoning for removing it
  // is worth more than the removal — so comments are stripped before the sweep.
  const code = (path: string) =>
    readFileSync(path, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  assert.doesNotMatch(
    code('src/features/membership/manage-membership-spec.ts'),
    /no membership on this account/i,
  );
  assert.doesNotMatch(code('src/components/membership/membership-body.tsx'), /NO_MEMBERSHIP_LINE/);
});

// ---------------------------------------------------------------------------
// 2 · The two pages cannot disagree
// ---------------------------------------------------------------------------

test('the upgrade route refuses only the account the refusal is true of', () => {
  // THE AUDIT'S OWN CONTRADICTION, both halves in one assertion.
  assert.equal(upgradeSurface(PAID_PRO).kind, 'at-top');
  for (const input of [FREE, TRIALING]) {
    assert.equal(upgradeSurface(input).kind, 'plans');
  }
  assert.equal(upgradeSurface(PAID_STANDARD).kind, 'delta');
});

test('every account that sees a comparison on one page sees one on the other', () => {
  for (const input of [FREE, TRIALING, PAID_STANDARD, PAID_PRO]) {
    const membership = membershipSurface(input);
    const upgrade = upgradeSurface(input);
    if (membership.comparison) {
      assert.equal(upgrade.kind, 'plans', `${membership.kind} disagreed across the two pages`);
    }
    if (membership.upgradable) {
      assert.equal(upgrade.kind, 'delta');
    }
  }
});

test('an unread subscription is not an upgrade decision on either page', () => {
  for (const flag of ['loading', 'unconfirmed'] as const) {
    assert.equal(upgradeSurface({ ...FREE, [flag]: true }).kind, 'reading');
  }
});

test('the eligibility rule still has exactly one implementation', () => {
  // A copy of `canUpgrade` in a presentation module is the drift bug that
  // ships as a row offered to somebody who cannot take it.
  const src = readFileSync('src/features/membership/membership-surface.ts', 'utf8');
  assert.match(src, /import \{ canUpgrade \}/);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ''), /=== 'standard'/);
  assert.equal(membershipSurface(PAID_STANDARD).upgradable, canUpgrade('standard'));
});

// ---------------------------------------------------------------------------
// 3 · What the two new states may say
// ---------------------------------------------------------------------------

test('the trial names the date the server wrote, and what happens after it', () => {
  const title = trialEndsTitle(SEPTEMBER);
  assert.match(title, /ends on/);
  assert.match(title, /2026/);
  // A report of `subscriptions.trial_ends_at`, never an offer — correction 06,
  // and independently true of the products (all four are
  // `trial_period_days: null`).
  assert.doesNotMatch(title, /start|free trial|days free|try|offer/i);

  const body = trialEndsBody();
  assert.match(body, new RegExp(`Cinch ${PLANS.free.name}`));
  assert.match(body, /Nothing is deleted/);
  // The free ceilings, quoted from PLANS rather than typed.
  assert.ok(body.includes(`${PLANS.free.items} active and ${PLANS.free.storedItems} stored`));
});

test('a trial with no stored date still says something true', () => {
  // Unreachable through `usePlan()` — `trialing` is derived from the date —
  // and written anyway, because "undefined" interpolated onto a billing page
  // is not a state worth leaving to an invariant two modules away.
  assert.doesNotMatch(trialEndsTitle(null), /undefined|null|NaN|Invalid/i);
});

test('the free lead states the two ceilings and asks for nothing', () => {
  const lead = freeLead();
  assert.ok(lead.includes(`Cinch ${PLANS.free.name}`));
  assert.ok(lead.includes(`${PLANS.free.items} active and ${PLANS.free.storedItems} stored`));
  assert.doesNotMatch(lead, /upgrade now|only|just|limited|hurry/i);
});

test('a decline confirms and does not ask again, on a page with no tier to name', () => {
  // "Still on Standard" is MB-09's line and is wrong on a free or trialing
  // page. This one names no tier at all.
  assert.doesNotMatch(
    `${NOTHING_STARTED.title} ${NOTHING_STARTED.body}`,
    /are you sure|instead|last chance|before you go|standard|pro\b/i,
  );
  assert.match(NOTHING_STARTED.body, /nothing was charged/i);
});

test('the door names the act and never a figure', () => {
  assert.equal(PLANS_CTA, 'See plans');
  for (const s of [PLANS_CTA, freeLead(), trialEndsBody(), trialEndsTitle(SEPTEMBER)]) {
    assert.doesNotMatch(s, /[$£€¥]\s?\d/, `currency literal in: ${s}`);
    assert.doesNotMatch(s, /\b\d+\.\d{2}\b/, `price-shaped figure in: ${s}`);
    assert.doesNotMatch(s, /per month|a month|per year|a year|monthly|annually/i, s);
  }
});

// ---------------------------------------------------------------------------
// 4 · The comparison the free states draw
// ---------------------------------------------------------------------------

test('the comparison is computed from PLANS, in both directions', () => {
  const toStandard = planDelta('free', 'standard');
  assert.deepEqual(toStandard[0], {
    label: 'Active pieces',
    from: PLANS.free.items.toLocaleString('en-US'),
    to: PLANS.standard.items.toLocaleString('en-US'),
  });
  const toPro = planDelta('free', 'pro');
  assert.equal(toPro[0]!.to, PLANS.pro.items.toLocaleString('en-US'));
});

test('a row where nothing changes is dropped rather than drawn as a pair', () => {
  // Packing is Pro-only, so free → Standard does not change it. "Not included
  // → Not included" is a row that costs a line and says nothing.
  const labels = planDelta('free', 'standard').map((r) => r.label);
  assert.ok(!labels.includes('Packing memos'), labels.join(', '));
  assert.ok(planDelta('free', 'pro').some((r) => r.label === 'Packing memos'));
  assert.deepEqual(planDelta('pro', 'pro'), []);
});

test('MB-09 keeps the exact three rows it shipped with', () => {
  // `planDelta` was added BESIDE `upgradeDelta` rather than replacing it, so
  // that widening the free comparison could not change a settled page as a
  // side effect. This is the tripwire on that decision.
  assert.equal(upgradeDelta('standard').length, 3);
});

test('no comparison row carries a price, a period or a trial promise', () => {
  const strings = (['standard', 'pro'] as const).flatMap((tier) =>
    planDelta('free', tier).flatMap((r) => [r.label, r.from, r.to]),
  );
  for (const s of strings) {
    assert.doesNotMatch(s, /[$£€¥]/, `currency symbol in: ${s}`);
    assert.doesNotMatch(s, /\d+\s*\.\s*\d{2}/, `price-shaped figure in: ${s}`);
    assert.doesNotMatch(s, /trial|free for|days free/i, `trial language in: ${s}`);
  }
});

// ---------------------------------------------------------------------------
// 5 · MB-06 — a receipt needs a transaction
// ---------------------------------------------------------------------------

test('navigation alone never earns the success state', () => {
  // The whole finding: `/membership-thanks` is a path in the route tree, and a
  // deep link or a restored navigation state reaches it with nothing behind
  // it. It opened saying "Your purchase went through" on both.
  assert.equal(thanksVerified(null), false);
});

test('a recorded purchase or restore does', () => {
  assert.equal(thanksVerified({ result: 'purchased' }), true);
  assert.equal(thanksVerified({ result: 'restored' }), true);
});

test('the record is written on a real result and on nothing else', () => {
  // `settle()` is the only writer, and it is guarded on `target.purchase`,
  // which `onDismiss` sets only for a `purchased` / `restored` result — never
  // for a silent skip, which is the campaign letting an already-entitled user
  // through with no paywall drawn and no money moved.
  const gate = readFileSync('src/features/billing/use-gate.ts', 'utf8');
  assert.match(gate, /if \(outcome === 'granted' && target\.purchase\)/);
  assert.equal(gate.match(/recordPaywallOrigin\(/g)?.length, 1);
  assert.match(gate, /result: target\.purchase/);
});

test('the unverified screen reconciles rather than congratulates', () => {
  const all = `${THANKS_UNVERIFIED_TITLE} ${THANKS_UNVERIFIED_BODY}`;
  assert.match(THANKS_UNVERIFIED_TITLE, /Checking your membership/);
  // No receipt, no purchase, no congratulation — and no alarm either: nothing
  // has gone wrong, there is simply nothing to confirm.
  assert.doesNotMatch(all, /you.{0,3}re in|went through|thank|welcome|congratul/i);
  assert.doesNotMatch(all, /error|problem|failed|wrong/i);
});

test('the screen asks the record, not the plan', () => {
  // A member who subscribed last month reads `pro` on every launch, so the
  // plan can never be the evidence — and this is the assertion that stops
  // somebody restoring the shortcut.
  const screen = readFileSync('src/app/membership-thanks.tsx', 'utf8');
  assert.match(screen, /thanksVerified\(origin\)/);
  assert.match(screen, /verified=\{verified\}/);
  // Cleared on the way out however the reader leaves, so a later, unrelated
  // visit cannot inherit a purchase that has already been reported.
  assert.match(screen, /useEffect\(\(\) => clearPaywallOrigin, \[\]\)/);
});
