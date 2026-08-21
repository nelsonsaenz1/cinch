# Paywall boundaries — where each gate is actually enforced

Audited 2026-08-21 against production (policies, grants, triggers read from
the live database), per the founder's directive: no work-arounds for any hard
gate. The rule every row obeys: **a screen may explain a boundary; only the
server may BE one.** A patched client skips screens; it cannot skip these.

| Boundary | Limit (free/std/pro) | Server enforcement |
|---|---|---|
| Active closet pieces | 10 / 150 / 1000 | `items_enforce_limit` trigger (insert) + `items_enforce_limit_on_restore` (unarchive) |
| Total pieces incl. stored | 30 / 450 / 3000 | same triggers, `item_total_limit_for_plan()` |
| Event hosting (concurrent) | 2 / 15 / 100 | `events_enforce_limit` trigger |
| **Event joins (lifetime)** | **3 / ∞ / ∞** | `event_members_enforce_join_cap` trigger over `event_join_ledger` — insert-once, no event FK, so leaving or deleting events never refunds a slot (migration 20260826000000) |
| Travel / packing | Pro only | `packing-brief` returns 402 `plan_upgrade_required`; also spends `stylist_chat` quota. The Plan tab's locked plate is UX only, by design |
| Stylist chat | none / 5⁄mo / unlimited | `claim_ai_quota` (`plan_excluded` on free) + reservation ledger, all server-side |
| AI outfit re-rank | 5⁄wk / 15⁄day / 60⁄day | `claim_ai_quota('outfit_generation')` in generate-outfits. The on-device engine is deliberately free |
| Vision tagging | 60 / 400 / 1500 ⁄mo | `claim_ai_quota('tagging')` in tag-item |
| Garment search | 20 / 200 / 600 ⁄mo | `claim_ai_quota('garment_search')` |
| Recreate-a-look analysis | 4 / 60 / 200 ⁄mo | `claim_ai_quota('inspiration')` in analyze-inspiration |
| AI consent (5.1.2i) | — | checked server-side in every AI function |

**The plan itself** is the root of every gate: `subscriptions`, written only by
the service role (Superwall webhook + reconcile), read-only to the client —
the stray default write grants found in this audit were revoked (migration
20260826010000; RLS already refused the writes, but TRUNCATE is not
RLS-governed and belts want braces). `effective_plan()` folds the trial in
server-side, so a client cannot claim a trial it does not have.

**Client-side walls that are NOT boundaries, on purpose**: the Packing locked
plate, quota/upsell copy, and every Superwall presentation. All of them fail
CLOSED — access is read from the entitlement, never from whether a paywall
appeared (`use-packing-access.ts` states the rule; every gate follows it).

When adding a gate: trigger or Edge-Function check first, screen second, and
add the client↔migration tripwire test (`tests/plans.test.ts` /
`tests/lifestyle-profile.test.ts` show the shape).
