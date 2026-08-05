/**
 * Membership tiers — the single definition of what each plan may do.
 *
 * These numbers are FINAL for launch. They are reassessed against real usage
 * once `ai_calls` has a month of data in it, not before; see
 * docs/ai-models-and-tiers.md for how each was derived.
 *
 * TWO KINDS OF NUMBER LIVE HERE, and confusing them is the trap:
 *
 *   The PRODUCT promise — "a few outfit suggestions a week" — is what marketing
 *   says and what the UI counts down. It is generous, round, and human.
 *
 *   The ENFORCED ceiling below is an ABUSE control. It sits above the product
 *   promise on purpose. `claim_ai_quota` does not refund a unit when the
 *   provider call then fails (a refund path hands an attacker a free retry loop
 *   by deliberately provoking failures), so a ceiling set exactly at the promise
 *   would spend a free user's whole week on one flaky network. The gap is the
 *   slack that makes the promise deliverable.
 *
 * The worst case one account can cost per month, at these ceilings and the
 * models in `ai_config`:
 *
 *   free      ~$0.19      standard  ~$1.98      pro  ~$7.58
 *
 * against $0.00 / $6.79 / $12.74 of net revenue. The free number is the one to
 * watch — it is the only line that scales with people who never pay, so 10,000
 * free accounts is ~$1,900/month of exposure even if every one of them is
 * honest.
 *
 * Those figures grew when `garment_search` was added: a web search costs about
 * $0.008 all-in against a tagging call's ~$0.0005, so it dominates the ceiling
 * even at a fraction of the allowance. It is a ceiling, not a forecast — the
 * expected user searches once per described garment during onboarding and then
 * effectively never again — but the exposure is real and is the first number to
 * revisit once `ai_calls` has a month of `garment_search` rows in it.
 */

export type Plan = 'free' | 'standard' | 'pro';

export type QuotaPeriod = 'day' | 'week' | 'month';

export interface Allowance {
  readonly limit: number;
  readonly period: QuotaPeriod;
}

export type AiQuotaKind =
  | 'tagging'
  | 'outfit_generation'
  | 'stylist_chat'
  | 'garment_search';

/**
 * Per-plan ceilings.
 *
 * `tagging` is MONTHLY rather than daily, which is the one non-obvious choice.
 * Photographing a wardrobe is a one-sitting event, so a daily cap has to be
 * large enough for a complete import — and a daily cap that large, repeated
 * thirty times, is the single most expensive thing an abusive account can do.
 * A monthly bucket sized for one full import plus re-tags gives onboarding all
 * the room it needs and closes that door.
 *
 * `stylist_chat` at 0 on free is a plan boundary, not exhaustion. The database
 * function reports it as `plan_excluded` so the client can offer an upgrade
 * rather than saying "try again tomorrow", which would never come true.
 *
 * `garment_search` is monthly for the same reason as `tagging` and sized quite
 * differently. It is the same onboarding burst — somebody describing their
 * wardrobe in one sitting — but each call costs roughly sixteen times a tagging
 * call, because a web search is billed per request on top of the tokens. So the
 * ceiling is sized to the burst that actually happens rather than to the closet:
 * photographing is unlimited and free, and describing is the accelerant, not the
 * only road in. Nobody describes a thousand garments; they describe the twenty
 * they cannot be bothered to photograph and shoot the rest.
 */
export const PLAN_LIMITS: Record<Plan, Record<AiQuotaKind, Allowance>> = {
  free: {
    // 30-garment closet + head-room for re-tagging a bad photograph.
    tagging: { limit: 60, period: 'month' },
    // The promise is three a week. Five is the ceiling that makes three
    // deliverable through a failed call or two.
    outfit_generation: { limit: 5, period: 'week' },
    stylist_chat: { limit: 0, period: 'month' },
    // Two thirds of a 30-garment closet, described. Deliberately short of the
    // whole thing: the free tier should be able to *feel* this — it is the
    // fastest way to a closet that isn't empty — without a scripted account
    // turning the free tier into a web-search API. ~$0.16/month at the ceiling.
    garment_search: { limit: 20, period: 'month' },
  },
  standard: {
    // 150-garment closet, imported in one sitting, with room to redo ~250.
    tagging: { limit: 400, period: 'month' },
    // A fresh outfit every morning plus real re-rolling, not a token allowance.
    outfit_generation: { limit: 15, period: 'day' },
    stylist_chat: { limit: 30, period: 'month' },
    // A 150-garment closet described end to end, plus a re-search for a third
    // of them — the realistic shape, since the first phrasing of "that navy
    // dress" often isn't the one that finds it. ~$1.60/month at the ceiling.
    garment_search: { limit: 200, period: 'month' },
  },
  pro: {
    // 1000-garment closet plus 500 re-tags in the same month.
    tagging: { limit: 1500, period: 'month' },
    outfit_generation: { limit: 60, period: 'day' },
    // "Unlimited" in the listing. 100 messages in one day is far past any real
    // styling conversation and still only ~$1.17/month at the ceiling.
    stylist_chat: { limit: 100, period: 'day' },
    // NOT the 1000-garment closet limit, which is the number the eye expects
    // here. At $0.008 a call that would be $8/month of exposure per pro account
    // for a path nobody uses that way — a 1000-piece wardrobe is photographed
    // over months, not typed in one evening. 600 is twenty a day for a month.
    garment_search: { limit: 600, period: 'month' },
  },
} as const;

/**
 * Closet size per plan.
 *
 * Mirrors `item_limit_for_plan()` in migration 20260805160000. The database is
 * the enforcing copy — items are inserted by the client, so a cap checked only
 * here is a cap the client skips by not calling us. This copy exists so the
 * Edge Functions can *explain* the limit without a round trip.
 *
 * Change one, change the other. There is a test that asserts they agree.
 */
export const PLAN_ITEM_LIMITS: Record<Plan, number> = {
  free: 30,
  standard: 150,
  pro: 1000,
} as const;

export function allowanceFor(plan: Plan, kind: AiQuotaKind): Allowance {
  return PLAN_LIMITS[plan][kind];
}
