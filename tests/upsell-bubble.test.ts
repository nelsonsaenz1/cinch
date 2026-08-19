/**
 * The membership bubble — what it says, to whom, and how often.
 *
 * Founder order, 2026-08-18: a free account opening the app is told once what
 * its membership is and what changing it would do. Everything difficult about
 * that instruction is HONESTY, and honesty is exactly the property a screenshot
 * cannot verify — a bubble reading "13 days left in your trial" looks correct
 * whether the number came off the account's own `trial_ends_at` or out of a
 * literal somebody typed while the copy was being drafted.
 *
 * So the decision and the copy are pure functions over the plan state
 * (`src/features/billing/upsell-bubble.ts`) and this file is what holds them to
 * the membership law: every number from `plans.ts`, no typed price, no trial
 * claimed without a trial, no urgency, and nothing at all said about a plan that
 * has not been read.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PLANS } from '../src/features/billing/plans.ts';
import { Placement } from '../src/features/billing/placements.ts';
import {
  UPSELL_COPY,
  claimUpsellBubble,
  resetUpsellBubble,
  trialDaysLeft,
  upsellBubbleFor,
  type UpsellBubbleInput,
} from '../src/features/billing/upsell-bubble.ts';

const NOW = new Date('2026-08-18T09:00:00.000Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const state = (over: Partial<UpsellBubbleInput> = {}): UpsellBubbleInput => ({
  plan: 'free',
  trialing: false,
  trialEndsAt: null,
  unknown: false,
  now: NOW,
  ...over,
});

/** Comments are prose about the code, not the code. */
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SPEC = readFileSync('src/features/billing/upsell-bubble.ts', 'utf8');
const SPEC_CODE = stripped(SPEC);
const CARD_CODE = stripped(readFileSync('src/components/today/upsell-bubble.tsx', 'utf8'));

// ---------------------------------------------------------------------------
// 1 · Who sees nothing
// ---------------------------------------------------------------------------

test('an unread plan is told nothing at all', () => {
  // `usePlan` answers `free` while loading AND after a failed read, which is the
  // right default for a GATE (refuse nothing on an outage) and the wrong one for
  // a SENTENCE. `CapacityNote` draws the same distinction for the same reason: a
  // Standard closet would otherwise be shown a claim that is false for it.
  assert.equal(upsellBubbleFor(state({ unknown: true })), null);
  assert.equal(upsellBubbleFor(state({ unknown: true, plan: 'pro', trialing: true })), null);
});

test('a paying member is never shown an upgrade', () => {
  assert.equal(upsellBubbleFor(state({ plan: 'standard' })), null);
  assert.equal(upsellBubbleFor(state({ plan: 'pro' })), null);
});

test('“already paying” is not the same question as “which plan”', () => {
  // `usePlan` folds a live trial into `pro`, so a check on the plan alone would
  // silence the trial bubble for every account in the product —
  // `handle_new_subscription()` (migration 20260805160000) starts everyone on a
  // 14-day trial at signup. Trialing pro and paid pro are the same `plan` and
  // must not be the same answer.
  const trialingPro = upsellBubbleFor(
    state({ plan: 'pro', trialing: true, trialEndsAt: inDays(9) }),
  );
  assert.equal(trialingPro?.kind, 'trial');
  assert.equal(upsellBubbleFor(state({ plan: 'pro', trialing: false })), null);
});

// ---------------------------------------------------------------------------
// 2 · The trial branch — a real trial, with a real end date
// ---------------------------------------------------------------------------

test('no trial copy is drawn without a trial end date to count from', () => {
  // THE REFUSAL THAT MATTERS MOST ON THIS SURFACE. A `trialing` flag with no
  // timestamp behind it produces NOTHING, not a bubble with a plausible
  // fortnight in it. There is no default here and there must never be one.
  assert.equal(upsellBubbleFor(state({ plan: 'pro', trialing: true, trialEndsAt: null })), null);
  // Nor from one that has already passed — `usePlan` would have cleared
  // `trialing` by then, and this is the belt to that brace.
  assert.equal(
    upsellBubbleFor(state({ plan: 'pro', trialing: true, trialEndsAt: inDays(-1) })),
    null,
  );
});

test('the day count is the account’s own arithmetic, rounded in its favour', () => {
  assert.equal(trialDaysLeft(inDays(13.2), NOW), 14);
  assert.equal(trialDaysLeft(inDays(1.25), NOW), 2);
  // Thirty hours left is one full day and a bit. Rounding down would understate
  // what the account holds, which is the flattering direction and the wrong one.
  assert.equal(trialDaysLeft(new Date(NOW.getTime() + 30 * 3_600_000), NOW), 2);
  assert.equal(trialDaysLeft(inDays(0), NOW), 0);
  assert.equal(trialDaysLeft(null, NOW), 0);
});

test('one day is not “1 days”', () => {
  const view = upsellBubbleFor(state({ plan: 'pro', trialing: true, trialEndsAt: inDays(0.5) }));
  assert.equal(view?.headline, '1 day left in your trial');
  const many = upsellBubbleFor(state({ plan: 'pro', trialing: true, trialEndsAt: inDays(6.1) }));
  assert.equal(many?.headline, '7 days left in your trial');
});

test('the trial line says what lapsing pauses, and what it does not touch', () => {
  const view = upsellBubbleFor(state({ plan: 'pro', trialing: true, trialEndsAt: inDays(4) }))!;
  // The ceiling comes from plans.ts, never from prose.
  assert.match(view.body, new RegExp(`${PLANS.free.items} active pieces`));
  // The two things free genuinely loses — `stylist: 'Not included'`, and packing,
  // which `usePackingAccess` refuses outright.
  assert.match(view.body, /stylist/i);
  assert.match(view.body, /packing/i);
  // And the promise `trial_expired`'s own line already makes. Contradicting it a
  // fortnight early would make one of the two a lie.
  assert.match(view.body, /Nothing you have added goes anywhere/);
});

// ---------------------------------------------------------------------------
// 3 · The free branch — the constraint leads
// ---------------------------------------------------------------------------

test('a free account is led with the constraint, not with the offer', () => {
  const view = upsellBubbleFor(state())!;
  assert.equal(view.kind, 'free');
  assert.equal(view.headline, `Your closet holds ${PLANS.free.items} active pieces on Free`);
  // "active" is load-bearing: `PLANS.free.items` mirrors `item_limit_for_plan()`
  // and excludes archived pieces, so a flat "10 pieces" would understate what
  // the account may actually hold (`storedItems` is three times it).
  assert.match(view.headline, /active/);
});

test('what upgrading opens is read from plans.ts, both halves of it', () => {
  const view = upsellBubbleFor(state())!;
  assert.match(view.body, new RegExp(`${PLANS.standard.items}`));
  assert.match(view.body, new RegExp(`${PLANS.standard.eventHosting}`));
  // Trips are Pro, and the line says Pro. Attributing packing to Standard would
  // be selling a tier the feature is not on.
  assert.match(view.body, /Pro packs a trip/);
});

// ---------------------------------------------------------------------------
// 4 · The membership law, over every state at once
// ---------------------------------------------------------------------------

test('no view anywhere carries a price, a discount or a deadline', () => {
  const views = [
    upsellBubbleFor(state())!,
    upsellBubbleFor(state({ plan: 'pro', trialing: true, trialEndsAt: inDays(1) }))!,
    upsellBubbleFor(state({ plan: 'pro', trialing: true, trialEndsAt: inDays(14) }))!,
  ];
  for (const view of views) {
    const prose = `${view.eyebrow} ${view.headline} ${view.body}`;
    // A price typed into a layout is wrong in every country but one; the app has
    // no StoreKit and every price it has shown was Superwall's own document.
    assert.doesNotMatch(prose, /[$£€]\s?\d|\/mo\b|\/yr\b|per month|per year/i);
    // Manufactured urgency, in all the shapes it takes.
    assert.doesNotMatch(prose, /hurry|act now|last chance|don't miss|expires|ends soon|only \d/i);
    assert.doesNotMatch(prose, /free trial|start your trial|% off|save \d|limited/i);
    assert.doesNotMatch(prose, /!/, 'no exclamation belongs on a membership sentence');
  }
});

test('the module types no ceiling of its own — every digit derives', () => {
  // The §7 rule, enforced structurally: the only numerals allowed in this file's
  // code are the day arithmetic. Anything else would be a ceiling that could
  // quietly disagree with `plans.ts` after a tier change.
  const copy = SPEC_CODE.slice(SPEC_CODE.indexOf('export function upsellBubbleFor'));
  assert.doesNotMatch(copy, /\b\d{2,}\b/, 'a two-digit literal in the copy branch');
  assert.match(SPEC_CODE, /PLANS\.free\.items/);
  assert.match(SPEC_CODE, /PLANS\.standard\.items/);
  assert.doesNotMatch(SPEC_CODE, /monthlyPriceHint|annualPriceHint/);
});

// ---------------------------------------------------------------------------
// 5 · Once per app open — a session flag, not a nag and not a marker
// ---------------------------------------------------------------------------

test('the slot is claimed once and then gone for the life of the process', () => {
  resetUpsellBubble();
  assert.equal(claimUpsellBubble(), true);
  assert.equal(claimUpsellBubble(), false);
  assert.equal(claimUpsellBubble(), false);
  resetUpsellBubble();
  assert.equal(claimUpsellBubble(), true, 'a cold start is a fresh slot');
});

test('the latch is module state, deliberately, and never storage', () => {
  // `use-trial-expired.ts` correctly uses `AsyncStorage` for a once-per-LAPSE
  // guarantee that has to outlive the process. This is the opposite requirement
  // — once per app OPEN — and a persisted marker would turn it into a card the
  // user dismisses forever exactly once, with a key to migrate and account state
  // to leak between sign-ins.
  assert.doesNotMatch(SPEC_CODE, /AsyncStorage|SecureStore|localStorage/);
  assert.doesNotMatch(CARD_CODE, /AsyncStorage|SecureStore|localStorage/);
  assert.match(SPEC_CODE, /let claimed = false/);
});

test('the slot is spent only on a bubble that is actually drawn', () => {
  // Claimed after the decision, never before it: an account with nothing to be
  // told must not burn the session's one showing, or a member who downgrades
  // mid-session would meet silence on the next open.
  const claim = SPEC_CODE.indexOf('claimUpsellBubble');
  const decide = SPEC_CODE.indexOf('export function upsellBubbleFor');
  assert.ok(decide > -1 && claim > decide, 'the latch is declared before the decision');
  assert.match(CARD_CODE, /next && claimUpsellBubble\(\)/);
});

// ---------------------------------------------------------------------------
// 6 · The door it opens
// ---------------------------------------------------------------------------

test('the CTA opens an existing placement and names no new one', () => {
  // `repeat_upsell` is this app's "the user asked to upgrade from a prompt"
  // moment — `placements.ts` describes it as the door offered "once the copy has
  // honestly explained why", with nothing refused by any server. A new placement
  // would be an unmatched campaign, which is a control that silently does
  // nothing; a duplicate would split one campaign's numbers in two.
  assert.equal(Placement.RepeatUpsell, 'repeat_upsell');
  const route = stripped(readFileSync('src/app/(tabs)/index.tsx', 'utf8'));
  assert.match(route, /onSeePlans=\{openRepeatUpsell\}/);
  // The card knows nothing about billing internals — it is handed a callback.
  assert.doesNotMatch(CARD_CODE, /useGate|registerPlacement|Superwall|usePlacement/);
});

test('the two controls are a filled door and a quiet word', () => {
  assert.equal(UPSELL_COPY.cta, 'See plans');
  assert.equal(UPSELL_COPY.dismiss, 'Not now');
  // "Upgrade now" is a verb with a deadline behind it, and there is no deadline.
  assert.doesNotMatch(UPSELL_COPY.cta, /now|today|upgrade/i);
});

test('every target on the card clears the 44pt floor', () => {
  // The card's two full-width controls take `MIN_TAP_TARGET` outright; the X is
  // drawn at 28 and compensates with `hitSlop`, the Remove disc's arrangement.
  assert.equal((CARD_CODE.match(/minHeight: MIN_TAP_TARGET/g) ?? []).length, 2);
  assert.match(CARD_CODE, /hitSlop=\{\(MIN_TAP_TARGET - 28\) \/ 2\}/);
});

test('the card carries no weight and reaches for no colour of its own', () => {
  // TY-01: there is one sans cut, and hierarchy is size, colour, case and space.
  assert.doesNotMatch(CARD_CODE, /fontWeight/);
  // Tokens only — no hex, no rgba, anywhere on the surface.
  assert.doesNotMatch(CARD_CODE, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});
