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
  paid: false,
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
  // The trial body was tightened by audit finding 6 as well: it opened on
  // "Until then everything is open.", which the headline ("4 days left in your
  // trial") had just said. Every FACT below is unchanged and still required.
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

test('a free account is led with the OUTCOME, and the ceiling follows it', () => {
  // ── CHANGED 2026-09-02 · AUDIT FINDING 6 ────────────────────────────────
  //
  // WAS: headline `Your closet holds ${PLANS.free.items} active pieces on Free`,
  // asserted verbatim, with `/active/` on top of it.
  //
  // The audit: "membership copy is feature-dense and plan-centric. Lead with
  // the user outcome and defer tier arithmetic to Membership." A headline whose
  // subject is the reader's PLAN, on the screen whose subject is what to wear
  // today, is the plan-centric half of that.
  //
  // The constraint did not disappear — it moved one line down, into the body,
  // where it is still read from `plans.ts` and still says "active". What the
  // headline says now is what changes for the reader.
  const view = upsellBubbleFor(state())!;
  assert.equal(view.kind, 'free');
  assert.equal(view.headline, 'Style from more of your closet');
  // No plan name and no figure in the headline: that is the whole point of it.
  assert.doesNotMatch(view.headline, /\d|Free|Standard|Pro\b/);
  // "active" is load-bearing wherever the ceiling is stated: `PLANS.free.items`
  // mirrors `item_limit_for_plan()` and excludes archived pieces, so a flat "10
  // pieces" would understate what the account may actually hold (`storedItems`
  // is three times it).
  assert.match(view.body, new RegExp(`${PLANS.free.items} active pieces`));
});

test('the tier arithmetic is deferred to Membership, and no tier is mis-sold', () => {
  // ── CHANGED 2026-09-02 · AUDIT FINDING 6 ────────────────────────────────
  //
  // WAS: `what upgrading opens is read from plans.ts, both halves of it` —
  //   assert.match(view.body, new RegExp(`${PLANS.standard.items}`));
  //   assert.match(view.body, new RegExp(`${PLANS.standard.eventHosting}`));
  //   assert.match(view.body, /Pro packs a trip/);
  // i.e. the body had to enumerate two of Standard's figures and one of Pro's
  // features. That is precisely the "tier arithmetic" the audit asks to defer:
  // three tiers, four figures and two feature names in two sentences.
  //
  // NOTHING ABOUT ANY PLAN CHANGED — `plans.ts` is untouched, and Membership
  // still states every figure in full beside the price only Superwall renders.
  // What this test holds now is that the row does not do Membership's job, and
  // that the one feature it DOES name is one every paid tier actually carries.
  const view = upsellBubbleFor(state())!;
  assert.doesNotMatch(
    view.body,
    new RegExp(`\\b(${PLANS.standard.items}|${PLANS.pro.items}|${PLANS.standard.eventHosting})\\b`),
    'a tier ceiling is being compared on Today again',
  );
  // The stylist is Standard AND Pro (`plans.ts`: "5 chats a month" /
  // "Unlimited"), and free is "Not included" — so naming it here is true of
  // membership as such rather than of one tier.
  assert.match(view.body, /stylist/i);
  assert.equal(PLANS.free.stylist, 'Not included');
  assert.notEqual(PLANS.standard.stylist, 'Not included');
  assert.notEqual(PLANS.pro.stylist, 'Not included');
  // Trip packing is PRO ALONE. The free row must not name it: `usePackingAccess`
  // refuses Standard outright, and a Standard purchase made on the strength of
  // this sentence would have bought a feature it does not carry. (The TRIAL
  // branch may still name it — that reader has it today and is being told what
  // pauses.)
  assert.doesNotMatch(view.body, /pack/i);
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
  //
  // CHANGED 2026-09-02 · FINDING 6: `PLANS.standard.items` is no longer
  // referenced, because the free branch no longer compares tiers (see above).
  // The rule itself is unchanged and now rests entirely on `PLANS.free.items`,
  // which is the only ceiling this module still states.
  const copy = SPEC_CODE.slice(SPEC_CODE.indexOf('export function upsellBubbleFor'));
  assert.doesNotMatch(copy, /\b\d{2,}\b/, 'a two-digit literal in the copy branch');
  assert.match(SPEC_CODE, /PLANS\.free\.items/);
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

test('there is one action and one way out, and the action names no deadline', () => {
  // ── CHANGED 2026-09-02 · AUDIT FINDING 7 ────────────────────────────────
  //
  // WAS: `the two controls are a filled door and a quiet word` —
  //   assert.equal(UPSELL_COPY.dismiss, 'Not now');
  // The card actually carried THREE controls: a filled oxblood CTA, a "Not now"
  // text button under it, and a dismiss disc beside the headline. "The first
  // viewport has four simultaneous asks... establish one primary action per
  // visual zone."
  //
  // The row has one action — the row itself — and one dismissal, the disc.
  // `UPSELL_COPY.dismiss` went with the button that spoke it, which is why the
  // constant is gone rather than merely unused.
  assert.equal(UPSELL_COPY.cta, 'See plans');
  assert.equal(UPSELL_COPY.close, 'Dismiss');
  assert.deepEqual(Object.keys(UPSELL_COPY), ['cta', 'close'], 'a third control returned');
  // "Upgrade now" is a verb with a deadline behind it, and there is no deadline.
  assert.doesNotMatch(UPSELL_COPY.cta, /now|today|upgrade/i);
});

test('every target on the row clears the 44pt floor', () => {
  // CHANGED 2026-09-02 · FINDING 7: this counted TWO `minHeight: MIN_TAP_TARGET`
  // for the card's two full-width controls. There is one full-width control
  // now. The X is still drawn at 28 and still compensates with `hitSlop`, the
  // Remove disc's arrangement — that half is untouched.
  assert.equal((CARD_CODE.match(/minHeight: MIN_TAP_TARGET/g) ?? []).length, 1);
  assert.match(CARD_CODE, /hitSlop=\{\(MIN_TAP_TARGET - 28\) \/ 2\}/);
});

test('the row stands in the page, not over it', () => {
  // FINDING 5, held structurally. The card used to be an absolutely-positioned
  // overlay pinned 96pt off the bottom of the screen, which is how it arrived
  // over the morning's outfit; `tests/today-redesign-11.test.ts` pinned the
  // `box-none` that stopped it eating every touch on the way past. A row that
  // occupies its own space needs neither, and must not grow either back.
  assert.doesNotMatch(CARD_CODE, /position: 'absolute'|pointerEvents/);
  assert.doesNotMatch(CARD_CODE, /bottom: \d/);
});

test('the card carries no weight and reaches for no colour of its own', () => {
  // TY-01: there is one sans cut, and hierarchy is size, colour, case and space.
  assert.doesNotMatch(CARD_CODE, /fontWeight/);
  // Tokens only — no hex, no rgba, anywhere on the surface.
  assert.doesNotMatch(CARD_CODE, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});
