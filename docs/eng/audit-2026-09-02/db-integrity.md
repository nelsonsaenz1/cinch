# Database integrity audit — Cinch

**Date:** 2026-09-02 · **Scope:** `supabase/migrations/*.sql` (112 files, 14 784 lines, all read in order), `supabase/tests/*.sql`, `supabase/functions/_shared/`, `supabase/functions/*/index.ts`, `src/types/database.ts`, `src/schemas/item.ts`, and every `.rpc(`/`.from(`/`.insert(`/`.update(`/`.delete(`/`.upsert(` call site in `src/`.

**Method:** read-only. No production statement was issued, no file under `src/`, `supabase/`, `tests/` or `scripts/` was modified. Every claim below cites the file and line it rests on. Where the evidence is consistent with two readings, both are stated with the fact that discriminates them.

**Overall posture.** This schema is materially better than most production Postgres I audit. RLS is on for all 63 tables in `public`; `anon` holds zero table privileges and exactly two EXECUTEs; every projection view is column-explicit; the concurrency-sensitive paths that were fixed (`apply_outfit_reaction`, `claim_support_send`, `claim_stylist_chat`, `claim_ai_quota`, `claim_superwall_event`) are genuinely correct, and the migration comments are unusually honest about what they do *not* do. The findings below are therefore concentrated in three places: the billing state machine, the plan-limit triggers that were never given the treatment the stylist counters got, and a handful of index and grant residues.

---

## Findings, ranked

| # | Sev | Finding | Where |
|---|---|---|---|
| C1 | **Critical** | The subscription-expiry revocation is classified `stale` and dropped. A churned subscriber keeps `plan='standard'`/`'pro'` indefinitely. | `_shared/superwall-plan.ts:96-102`, `superwall-webhook/index.ts:314`, `asc-notifications/index.ts:307` |
| C2 | **Critical** | Nothing anywhere reads `current_period_end` to decide entitlement, and no cron reconciles it. Entitlement is a one-way ratchet: only an event can lower it, and C1 eats the event. | `20260901000000_storekit_trial_transition.sql:98-118` |
| H1 | High | `commit_intake_session` re-raises on `storage_limit_reached`, aborting the whole voice-intake commit — the exact failure the staging table exists to prevent. | `20260811022953_intake_ceiling_resolve.sql:93-99` |
| H2 | High | Every plan-limit trigger except the stylist ones is `SELECT count(*)` then insert, with no lock. TOCTOU on closet size, stored size, hosting, lifetime event joins, circle seats, social rate limits, export throttle. | `20260808190100:69-87`, `20260808130000:55-57`, `20260826000000:94-99`, `20260818000000:292-299`, `20260807103000:189-226`, `20260810120400:32-39` |
| H3 | High | `apply_outfit_reaction` is not idempotent, and the retry its own header prescribes double-inserts the reaction row and double-increments `feedback_count`. | `20260804202000_reaction_concurrency.sql:22-23, 58-61` |
| H4 | High | `authenticated` holds `INSERT/UPDATE/DELETE` on `ai_calls` and `ai_usage_counters` — the quota ledger. Blocked only by the absence of a write policy. The migration's own header asserts the opposite. | `20260819000000_normalise_client_grants.sql:76-92` |
| M1 | Medium | Client and server now disagree about what a legacy trial means. `usePlan` still folds any live trial to `pro`; `effective_plan` stopped doing that on 2026-09-01. | `src/features/billing/use-plan.ts:141` vs `20260901000000:106-113` |
| M2 | Medium | The account-deletion path does not walk the `exports` bucket. A user's full personal-data archive survives deletion with nothing left naming it. | `delete-account/index.ts:67`, `20260810120250_exports_bucket.sql:18-20` |
| M3 | Medium | `invite_card` and `apply_invite` match `p.username = lower(...)`. Any handle containing an uppercase letter has a dead invite link. | `20260810120300:23`, `20260810120100:99` |
| M4 | Medium | Five uncapped, unmoderated text columns on `items` plus `outfits.name` cross the friend and event boundary. | `20260803154431:85-97, 150`, `20260808110000:42-45` |
| M5 | Medium | Four index gaps on hot paths: username prefix search, `outfit_reactions.item_ids`, the Daily feed's `outfits.worn_at`, the review deck. | see §7 |
| M6 | Medium | `friend_items` and `friend_worn_outfits` are read with no `user_id` filter, so the definer predicate runs per row over the whole table. | `src/features/explore/queries.ts:71`, `src/features/daily-social/queries.ts:82` |
| M7 | Medium | `effective_plan(uuid)`, `blocked_between`, `is_friend` and friends are SECURITY DEFINER taking another user's id. Only `effective_plan` is a real leak, and it is closed. | `20260805220000:49` |
| L1 | Low | `unwear_outfit_tx` never writes `command_log.result_id`, so its idempotency key does nothing; a retry errors instead of succeeding. | `20260810100000:234-291` |
| L2 | Low | `current_social_terms_version()` created with a mutable `search_path` — the exact defect `20260805213000:123` pinned on its sibling. | `20260808101000:28-32` |
| L3 | Low | `item_limit_for_plan` / `event_limit_for_plan` / `item_total_limit_for_plan` have no `ELSE`, so a future enum value silently means "unlimited". | `20260808190000:28-32` |
| L4 | Low | `superwall_events` and `asc_notifications` retain transaction identifiers and user ids past account deletion, without the explicit charter `ai_calls` was given. | `20260811205359:35`, `20260826150000:16` |
| L5 | Low | Migration hygiene: no down-migrations exist at all; two `cron.schedule` calls lack the unschedule guard their siblings have; one column dropped without backfill. | see §9 |

---

## 1 · Row-level security

### 1.1 Coverage

RLS is `enable`d on every table created in `public`. I verified this file by file; the pgTAP suite asserts it as a catalogue invariant rather than a name list (`supabase/tests/01_rls_baseline.sql`, and `20_grant_matrix.sql:29-36` for the grant half), which is the right shape — the table somebody forgets to protect is the table they also forget to add to the test.

Three access shapes are in use, all deliberate:

**(a) Owner-scoped, four per-command policies.** `profiles`, `items`, `outfits`, `outfit_items`, `outfit_calendar`, `chat_sessions`, `style_profiles`, `wardrobe_gaps`, `wishlist_items`, `trips`, `boards`, `push_tokens`, `notification_prefs`, `intake_sessions`, `intake_drafts`, `saved_looks`. All use `(select auth.uid())` in a subselect and `to authenticated`, per the convention stated at `20260803154431:3-9`. All UPDATE policies carry both `using` and `with check`, so no row can be updated out of its owner's name. I found no exception.

**(b) RLS on, zero policies — deny-all, service-role only.** `moderation_terms` (`20260808100000:47-49`), `push_sends` (`20260810100300:137-144`), `support_sends` (`20260810120200:27-33`), `waitlist` + `waitlist_throttle` (`20260810130000:57-64, 89-91`), `catalog_merchants`, `catalog_products` (`20260811114245:137-148`), `catalog_lookups`, `catalog_quota` (`20260811154242:90-93, 119`), `commerce_joined_programmes` (`20260811170648:40-44`), `commerce_health` (`20260811174411:35-37`), `commerce_alert_sends` (`20260811174717:25-26`), `superwall_events` (`20260811195856:65-67`), `push_receipts` (`20260811210345:47-49`), `catalogue_demand_daily` (`20260813203052:178-179`), `stylist_chat_reservations` (`20260824010000:71-72`), `asc_notifications` (`20260826150000:30`), `pinterest_oauth_states` (`20260830120000:93-94`). Each pairs the empty policy set with an explicit `revoke all … from anon, authenticated`, which is the correct belt-and-braces: RLS-with-no-policy is the deny, the revoke is what still holds if someone later adds a policy without thinking.

**(c) Definer projection views.** `public_profiles`, `public_items`, `public_outfits`, `public_outfit_items`, `public_like_counts`, `social_profiles`, `friend_items`, `friend_closet_meta`, `event_post_items`, `event_vote_counts`, `friend_worn_outfits`, `friend_worn_outfit_items`, `superwall_unreconciled`. All are `security_invoker = false` deliberately — the base tables are owner-only, so under invoker rights a visitor would see nothing, and the view's own WHERE clause is the access control. This is documented at length at `20260805213000:35-46` and is the correct call. **The write side is closed**: `20260805213000:85-95` revokes all privileges on all five original views and then sets `alter default privileges in schema public revoke all on tables from anon, authenticated`, so a later view is born unwritable. Every subsequent view grant in the tree is `grant select … to authenticated` and nothing else (`20260807103000:80-89`, `20260807120000:141`, `20260808110000:99`, `20260817000000:223-224`, `20260821000000:371-374`).

The one `security_invoker = true` view is `saved_looks_resolved` (`20260821000000:341-342`), and that is right: the caller's own RLS on `saved_looks` applies unchanged, and the definer-ness that is genuinely needed lives in one narrow function.

### 1.2 Policies that are too broad

**None currently.** The three that were are all closed:

- `follows: readable` and `closet_likes: readable`, both `using (true)` to `anon` (`20260803210000:314-315, 337-338`) → dropped and replaced with participant/owner scoping at `20260804200000:103-116`.
- `profiles: public are readable` / `items` / `outfits` / `outfit_items`, all `to anon, authenticated` on base tables (`20260803210000:253-298`) → dropped at `20260804200000:30-42`, replaced with projection views.
- `ai_config: readable by authenticated` with `using (true)` (`20260803180000:27-28`) → grant revoked and policy dropped at `20260813224003:30-34`.

The only remaining `to anon` reachable surface in the whole schema is two functions (§1.4) and the `garments` storage policy at `20260804200000:139-155` — which, as `20260806100000:17-23` records, is a dead letter anyway because its `exists (select … from public.items …)` subquery executes as the caller and `anon` has no grant on `items`. That is a correct-by-accident state, but it is a documented one and the tests assert the refusal.

**Policies keyed on a column the client can set.** I looked for the classic shape and found it in one place, correctly handled: `profiles.worn_outfits_shared_since` is the visibility boundary for `friend_worn_outfits`, it sits on a table with a plain owner-UPDATE policy, and a client could therefore have backdated it to 2020 and exposed its whole history. `enforce_worn_outfits_boundary` (`20260817000000:51-81`) overwrites whatever the client sent with `now()` on the off→on edge. That is the right instrument and the reasoning at `20260817000000:28-32` is exactly correct.

Two related cases are *not* server-controlled and are worth a decision rather than a fix:

- `profiles.ai_consent_version` and `social_terms_version` are written by the client from a client-side constant (`src/features/auth/use-consent.ts:83-87`, `use-social-terms.ts:71-72`), and are the columns five edge functions gate on. A patched client can write `999` and pass every consent gate forever. The exposure is bounded — it defeats a compliance record, not another user's data — but the version is the server's fact, not the client's, and a `before update` trigger clamping it to `current_ai_consent_version()` would cost three lines.
- `daily_social_reactions.owner_id` is supplied by the client (`src/features/daily-social/reactions.ts:119`). The INSERT policy at `20260817000000:167-173` does check `exists (select 1 from friend_worn_outfits f where f.id = outfit_id and f.user_id = owner_id)`, so a forged `owner_id` is refused. Correct, but it is the one place a denormalised owner column is trusted from the client and it survives only because the policy joins on both columns.

### 1.3 Write grants to client roles

`anon` holds **zero** privileges of any type on any table in `public`. That was 104 privileges before `20260819000000` and is asserted by `supabase/tests/20_grant_matrix.sql:29-36`.

For `authenticated`, the verb list per table is written down explicitly (`20260806100000`, then per-feature at the foot of each later migration). **Eleven of those grants have no corresponding RLS policy and are dead letters** — and the migration that added them claims the reverse:

> `20260819000000_normalise_client_grants.sql:76-80` — *"These are real product operations that the RLS policies already admit — the policies define which rows, these grants define which verbs, and the two have to agree or the policy is dead letter."*

Checked against the policy set, that sentence is inverted for every table it introduces:

| Grant | Line | Policies that exist | Verdict |
|---|---|---|---|
| `insert, update, delete on ai_calls` | `:82` | SELECT only (`20260803180000:84-85`) | **no write policy** |
| `insert, update, delete on ai_usage_counters` | `:83` | SELECT only (`20260804200000:557-558`) | **no write policy** |
| `insert, update, delete on subscriptions` | `:84` | SELECT only (`20260805160000:46-47`) | revoked `20260826010000:15-16` |
| `update, delete on tag_corrections` | `:85` | SELECT, INSERT only | no write policy |
| `delete on command_log` | `:86` | SELECT, INSERT, UPDATE | no DELETE policy |
| `delete on item_inquiries` | `:87` | SELECT, INSERT, UPDATE | no DELETE policy |
| `update on chat_messages` | `:88` | SELECT, INSERT, DELETE | no UPDATE policy |
| `update on closet_likes` | `:89` | SELECT, INSERT, DELETE | no UPDATE policy |
| `update on follows` | `:90` | SELECT, INSERT, DELETE | no UPDATE policy |
| `update on outfit_reactions` | `:91` | SELECT, INSERT, DELETE | no UPDATE policy |
| `update on style_feedback` | `:92` | SELECT, INSERT, DELETE | no UPDATE policy |

The 2026-08-21 "no work-arounds" audit caught the `subscriptions` row and revoked it (`20260826010000`), with a header that names the danger precisely: *"the grants were one dropped policy away from a signed-in client writing itself a plan, and TRUNCATE is not governed by RLS at all."* That reasoning applies verbatim to `ai_calls` and `ai_usage_counters` — the quota ledger every AI gate spends against — and they were left behind. **Finding H4.** The remedy is the same two lines that fixed `subscriptions`.

**Two explanations fit.** Either the eighteen verbs were measured in production and genuinely correspond to policies I cannot see from the migration tree (a policy created out of band), or the migration's author generalised from the tables where the claim *is* true and did not re-check the rest. The discriminator is one read-only query: `select tablename, cmd, roles from pg_policies where schemaname='public' and tablename in ('ai_calls','ai_usage_counters') and cmd <> 'SELECT'`. From the tree alone, the second reading is the one supported.

### 1.4 SECURITY DEFINER functions taking a user id

The house rule — stated at `20260810100100:20-25` and `20260813194202:136-138` — is that a definer function takes its subject from `auth.uid()` and never from an argument. It is honoured almost everywhere: `activity_feed()`, `invite_arrivals()`, `import_capacity()`, `activity_has_unseen()`, `friends_sharing_worn_outfits_count()`, `has_accepted_social_terms()`, `request_data_export()`, `circle_member_count()`, `can_save_source()` all take either nothing or a subject id, and derive the caller from the JWT.

The exceptions, and their status:

| Function | Signature | Reachable by `authenticated`? |
|---|---|---|
| `claim_ai_quota(uuid,text,integer,text)` | takes `p_user_id` | **No** — `20260805220000:47`, `grant … to service_role` only |
| `effective_plan(uuid)` | takes `p_user_id` | **No** — `20260805220000:49`, restated `20260901000000:120` |
| `claim_stylist_chat/complete/release` | take `p_user_id` | **No** — `20260824010000:308-315` |
| `claim_support_send(uuid,text)` | takes `p_user_id` | **No** — `20260811211042:91` |
| `claim_superwall_alias(text,uuid)` | takes `p_user_id` | **No** — `20260811205418:53` |
| `blocked_between(uuid,uuid)` | takes both ids | **Yes** — `20260807100000:117`, by design (policies call it) |
| `is_friend(uuid)`, `is_event_member/host`, `can_see_event`, `is_circle_*`, `item_is_published`, `item_owned_by_friend`, `item_posted_to_my_event`, `event_is_open`, `username_available` | subject id only, caller from JWT | **Yes**, deliberately — policy expressions evaluate with the caller's privileges |
| `claim_command(uuid,uuid,text)` | takes `p_user_id` | **Yes** — `20260805231500:39`. But it is SECURITY **INVOKER**, so `command_log`'s own `with check ((select auth.uid()) = user_id)` (`20260804204000:21-23`) refuses a forged id. Its internal `if v_owner <> p_user_id` check at `20260804200000:378-380` is therefore unreachable dead code under RLS. Harmless. |

`blocked_between(a, b)` granted to `authenticated` is a genuine (if trivial) oracle — any signed-in user can ask whether any two arbitrary user ids have blocked each other. It has to be granted for the policies to work, and the information is minimal, but it is worth knowing it exists.

### 1.5 Did the revoke stick across later `CREATE OR REPLACE`?

This is the question the brief asks, and the answer needs the Postgres semantics stated precisely, because the premise in the question is the opposite of the truth:

- **`CREATE OR REPLACE FUNCTION` preserves the ACL.** It does not reset grants. The migrations rely on this correctly and say so — `20260808120000:30-36` and `20260808130000:44-48` both spell it out.
- **`DROP FUNCTION` + `CREATE FUNCTION` *does* reset the ACL** to the default, which is `EXECUTE TO PUBLIC` unless `ALTER DEFAULT PRIVILEGES` says otherwise.

So the exposure is confined to drop-and-recreate. The defence is `alter default privileges in schema public revoke execute on functions from public` (`20260805220000:58`, extended to `anon` and given a `service_role` grant at `20260819000000:129-131`). That covers new functions **created by the same role that ran the ALTER**. Migrations here run as `postgres` on both paths (CLI push and MCP `apply_migration`), so it holds.

I traced every drop-and-recreate in the tree after the revoke landed:

| Function | Dropped/recreated at | Grant restated? |
|---|---|---|
| `plan_outfit_tx` | `20260804203000:27-29` | Yes — `20260805231500:37` |
| `wear_outfit_tx` (8-arg) | `20260810100000:124-126` | Yes — `20260810100000:211-216` |
| `wear_outfit_tx` (10-arg) | `20260816190545:23-27` | Yes — `20260816190545:108-113` |
| `commit_intake_session` | `20260811022953:24-26` | Yes — `20260811022953:191-192` |
| `claim_ai_quota(uuid,text,integer)` | dropped, not recreated — `20260805231500:43` | n/a |
| `claim_stylist_success` / `release_stylist_success` | dropped, not recreated — `20260824010000:48-49` | n/a |
| `reap_intake_audio()` | dropped, not recreated — `20260825140000:57` | n/a |
| **`claim_superwall_event`** | **`20260901000000:162-206`** | **revoke only, `:208-210`** |

The last row is the only one worth attention. `claim_superwall_event` is recreated with a new eight-argument signature and then explicitly revoked from `public, anon, authenticated` — but it is **never explicitly granted to `service_role`**. It relies entirely on `alter default privileges … grant execute on functions to service_role` (`20260819000000:131`) having been in force under the applying role. Every other service-role RPC in the tree carries an explicit `grant … to service_role`. If that default privilege did not apply — because the migration was applied by a role other than the one that set it, which is exactly the divergence `docs/ops/supabase-migration-reconciliation-20260817.md` documents for the MCP path — the Superwall webhook would fail at its very first call with `permission denied for function claim_superwall_event`.

**Two explanations fit.** Either the default privilege applied and the webhook works, or it did not and every Superwall delivery since 2026-09-01 has returned 500. The discriminator is one read-only query: `select has_function_privilege('service_role', 'public.claim_superwall_event(text,text,text,text,text,timestamptz,text,boolean)', 'EXECUTE')`. Whatever it returns, adding the explicit grant is a one-line, zero-risk hardening that brings this function in line with its eleven siblings.

---

## 2 · Plan-limit triggers

### 2.1 Inventory

| Trigger | Function | Message raised | SQLSTATE | Hint | Race-safe? |
|---|---|---|---|---|---|
| `items_enforce_limit` | `enforce_item_limit` `20260808190100:52-91` | `closet_limit_reached: % of % garments` | `check_violation` (23514) | *Store a piece to make room, or upgrade for a larger closet.* | **No** |
| " | " | `storage_limit_reached: % of % stored` | `check_violation` | *Delete a stored piece, or upgrade.* | **No** |
| `items_enforce_limit_on_restore` | `enforce_item_limit_on_restore` `:100-126` | `closet_limit_reached: % of % garments` | `check_violation` | *Store another piece first, or upgrade for a larger closet.* | **No** |
| `events_enforce_limit` | `enforce_event_limit` `20260808130000:50-63` | `event_limit_reached: % of % upcoming events` | `check_violation` | *Upgrade to host more events.* | **No** |
| `event_members_enforce_join_cap` | `enforce_event_join_cap` `20260826000000:70-107` | `event_join_limit_reached: % of % lifetime events` | `check_violation` | *Upgrade to join more events.* | **No** |
| `circle_members_enforce_size` | `enforce_circle_size` `20260818000000:305-333` | `circle_full: % of 12 seats taken` | `check_violation` | *This group is full.* | **No** (acknowledged) |
| 5× `*_rate_limit` | `enforce_social_rate_limits` `20260818000000:544-590` | `rate_limited: comments\|invites\|follows\|reports\|borrow requests` | `54000` | *You are commenting very fast. Take a breath.* (comments only) | **No** |
| — (RPC) | `request_data_export` `20260810120400:18-47` | `you can ask for one export a day` | `22023` | — | **No** |
| — (RPC) | `claim_ai_quota` `20260805160000:151-205` | returns `{allowed:false, reason:'exhausted'\|'plan_excluded'}` | — | — | **Yes** |
| — (RPC) | `claim_stylist_chat` `20260824030000:33-126` | returns `{allowed:false, reason:'exhausted'\|'capacity_held'}` | — | — | **Yes** |
| — (RPC) | `claim_support_send` `20260811211042:36-89` | returns `refused='hour'\|'day'` | — | — | **Yes** |
| — (RPC) | `claim_catalog_request` `20260811160015:28-81` | returns `false` | — | — | **Yes** |

### 2.2 The TOCTOU class — H2

Seven of the eight enforcement paths follow the identical unsafe shape:

```sql
select count(*) into v_count from public.items where user_id = new.user_id;   -- 20260808190100:69-72
if v_count >= v_limit then raise exception ... end if;
return new;                                                                    -- insert proceeds
```

Under `READ COMMITTED` — Supabase's default — two concurrent inserts each take a snapshot before the other's row is visible, both count `limit - 1`, and both are admitted. There is no row lock (nothing exists to lock), no advisory lock, and no `SERIALIZABLE`. The ceiling is therefore `limit + (concurrent writers - 1)`.

This is not theoretical for `items`: the ingest queue writes items in parallel (`src/features/ingest/upload-queue.ts:739, 797`), and the catalogue batch import writes N colourways for one tap. A free user importing three colourways into two remaining slots gets all three.

**The project already owns the correct instrument and applied it twice.** `claim_support_send` uses `pg_advisory_xact_lock` keyed on the user's uuid bits (`20260811211042:59-62`) with a header that diagnoses this exact class in full:

> *"you cannot take a row lock on a row you are about to insert. `insert … select … where (count) < n` does not close it either: under READ COMMITTED each transaction evaluates its subquery against a snapshot taken before the other's insert is visible, so both still find room. So the serialization has to be on the USER, not on a row."* — `20260811211042:16-31`

`claim_stylist_chat` uses `pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))` for the same reason (`20260824030000:58`). And `20260818000000:282-289` states the gap explicitly and declines to close it:

> *"two concurrent transactions can each count eleven and each insert. Neither is reachable from the client, which invites one person at a time, and both are exactly the limits `enforce_event_limit` and `enforce_social_rate_limits` have carried since they shipped — so this uses the same instrument rather than introducing an advisory lock that the other two would then be missing."*

That reasoning is sound for circle seats (one invitation at a time) and wrong for `items` (parallel by construction). The remedy is one line at the top of `enforce_item_limit`: `perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));`. Adding it to the other five costs the same line each and removes the "then the other two would be missing" objection entirely.

Severity is bounded — over-admission is by one or two garments, not unbounded — but the founder directive quoted at `20260826000000:38-40` is *"no work-arounds for any of our hard paywall gates"*, and a race is a work-around that needs no patched client.

### 2.3 What the client can read to pre-check, and whether it agrees

| Limit | Server rule | Client pre-check | Consistent? |
|---|---|---|---|
| Active closet | `item_limit_for_plan(effective_plan(uid))` — `20260808190000:22-33` | `import_capacity()` RPC — `20260813194202:140-168`, granted to `authenticated` at `:175` | **Yes** — same three functions, same `auth.uid()` |
| " | " | `useCapacity` counts `items` twice and reads `PLANS[plan].items` — `src/features/billing/use-capacity.ts:73-81` | **No** — see M1 |
| Stored closet | `item_total_limit_for_plan` — `20260808190100:30-41` | same two paths | same |
| Hosting | `event_limit_for_plan` — `20260828170000:9-12` (free = **1**) | none; `event_limit_for_plan` revoked from `authenticated` at `20260807103000:261`. Client copy in `src/features/billing/plans.ts` | manual sync, tripwired by `tests/plans.test.ts` |
| Lifetime joins | `event_join_limit_for_plan` — `20260826000000:65-68` (free = 3) | `event_join_ledger` **is** owner-readable (`:59-63`) so the count is honest; the limit is a client constant | count honest, limit duplicated |
| AI quotas | `plans.ts` `PLAN_LIMITS`, spent via `claim_ai_quota` | `ai_usage_counters` is `select`-granted (`20260806100000:49`) so `calls` is readable; the limit is a client constant | count honest, limit duplicated |
| Stylist chats | `claim_stylist_chat` | nothing readable — `stylist_chat_reservations` is deny-all (`20260824010000:71-72`). The count arrives in the edge-function response | consistent by construction |

**`import_capacity()` is the right answer and the client does not call it.** It exists precisely so the boundary is computed once, in SQL, from the same three functions the trigger uses — its header at `20260813194202:50-62` says so. The only caller in the tree is `supabase/functions/garment-search/index.ts:1449`. The React client instead reassembles the rule from a raw `subscriptions` read plus a client-side limit table, which is where M1 comes from.

### 2.4 M1 — the client's plan rule diverged from the server's on 2026-09-01

`20260901000000:98-118` changed `effective_plan` from "any live trial → pro" to:

```
plan in ('standard','pro')  → that plan          (paid wins outright)
plan = 'free' + live trial  → 'pro'              (legacy promotional access)
otherwise                   → the row's plan
```

`src/features/billing/use-plan.ts:141` still reads:

```ts
const plan: Plan = foldPlan(trialing ? 'pro' : (data?.plan ?? 'free'), sdkPlan);
```

— the unconditional fold, and `trialing` is computed at `:128` as `trialEnds !== null && new Date(trialEnds).getTime() > Date.now()`.

They disagree for exactly one cohort: a row with `plan = 'standard'` **and** a live `trial_ends_at`. Server says `standard`; client says `pro`. The user is shown Pro copy and Pro ceilings (1000 items, 60 generations/day, 100 chats/day) while the database enforces Standard (150 / 15 / 8), and every refusal is unexplainable from the screen.

The cohort is not empty by construction. `20260805160000:56-59` backfilled `trial_ends_at = now() + 14 days` onto **every** pre-existing account, and `handle_new_subscription` did the same for every new account until 2026-09-01. `20260901000000:26-27` puts the count of still-live trials at 33. Any of those 33 who buys Standard lands in the divergence.

The fix is one line, mirroring the SQL:

```ts
const base = data?.plan ?? 'free';
const plan: Plan = foldPlan(base === 'free' && trialing ? 'pro' : base, sdkPlan);
```

The hook's own docblock at `use-plan.ts:76-77` claims *"The trial is then folded in here with the same rule the database uses"* — that sentence became false on 2026-09-01 and is the thing that would keep a later reader from noticing.

---

## 3 · The trial transition and the billing state machine

### 3.1 What writes a `subscriptions` row

| Writer | Columns | Mode | Where |
|---|---|---|---|
| `handle_new_subscription()` trigger on `auth.users` | `user_id, plan='free', trial_ends_at=NULL` | `insert … on conflict do nothing` | `20260901000000:56-73` |
| `20260805160000:56-59` backfill (historical) | `user_id, 'free', now()+14d` | insert | one-time |
| `superwall-webhook` | `user_id, plan, current_period_end, updated_at` | `upsert onConflict:'user_id'` | `superwall-webhook/index.ts:329-340` |
| `asc-notifications` | same four | `upsert onConflict:'user_id'` | `asc-notifications/index.ts:311-322` |
| `superwall-reconcile` | same four | `upsert onConflict:'user_id'` | `superwall-reconcile/index.ts:149-160` |

**No path writes `trial_ends_at` any more.** That is the design (`20260901000000:33-38`) and it is what makes `plan='free' AND trial_ends_at IS NOT NULL` an airtight classifier for legacy promotional access. The claim holds against the code: I grepped every writer and none of the three upserts includes the column.

The upsert-not-update choice is right and the reason is stated at `superwall-webhook/index.ts:319-328` — a PostgREST `.update()` against a missing row is zero-rows-no-error, so a purchase by a user whose signup trigger failed would be silently dropped and Svix told it landed. The `.select('user_id')` that makes the write prove itself (`:340-342`) is the correct companion.

### 3.2 How the plan is folded

`effective_plan(p_user_id)` at `20260901000000:105-117`, quoted in full in §2.4. `current_period_end` is **not consulted**. The header is explicit that this is intentional — expiry is meant to be event-driven — and `_shared/quota.ts:69-76` is the only enforcing consumer, failing closed to `'free'` on any error.

### 3.3 C1 — the expiry revocation is dropped as stale

`_shared/superwall-plan.ts:96-102`:

```ts
export function isStale(eventPeriodEnd, storedPeriodEnd): boolean {
  if (!eventPeriodEnd || !storedPeriodEnd) return false;
  return eventPeriodEnd <= storedPeriodEnd;
}
```

Both webhooks apply it unconditionally, to revoking events as well as granting ones:

- `superwall-webhook/index.ts:314` — `if (isStale(periodEnd, current?.current_period_end)) { await note('stale'); return … applied:false }`
- `asc-notifications/index.ts:307` — `if (isStale(expiresAt, current?.current_period_end)) return { outcome: 'stale', … }`

Trace an ordinary churn on a monthly subscription:

1. `renewal` at T₀ carries `expirationAt = T₁`. Written: `plan='standard'`, `current_period_end = T₁`.
2. The user does not renew. At T₁ Superwall sends `expiration`; Apple sends `EXPIRED`. Both carry the subscription's expiry date, which **is T₁** — the same value already stored, because step 1 stored it.
3. `isStale(T₁, T₁)` → `T₁ <= T₁` → **true**. Outcome `stale`. No write. The user stays on `standard`.

The comment above the check (`superwall-webhook/index.ts:297-299`) says *"Revocations with no `expirationAt` are applied unconditionally — `subscription_paused` has no end date and must not be ignorable."* That is true, and it is the only revocation the guard exempts. `expiration` and Apple's `EXPIRED` / `GRACE_PERIOD_EXPIRED` all carry a date, and the date they carry is the one that is already stored.

The consequence is that **churn is unenforceable**: once a user reaches `standard` or `pro`, no event can lower them, and `effective_plan` returns that plan forever. Refunds (`REFUND`, `REVOKE` via `ASC_REVOKING` at `_shared/asc-plan.ts:46-51`) have the same shape and the same fate.

**Two explanations fit, and one query separates them.** Either (a) Superwall and Apple send the expiry event with `expirationAt` equal to the stored period end — in which case every revocation since the webhook shipped has been classified `stale` and the entitlement ratchet is real — or (b) they send it with a *later* date, or null, in which case the guard passes and revocation works. The discriminator is read-only:

```sql
select event_type, outcome, count(*)
  from superwall_events
 where event_type in ('expiration','subscription_paused')
 group by 1,2;

select notification_type, outcome, count(*)
  from asc_notifications
 where notification_type in ('EXPIRED','GRACE_PERIOD_EXPIRED','REFUND','REVOKE')
 group by 1,2;
```

If either shows `stale` for a revoking type, (a) holds. Note that the memory record for this project says the webhook path has only ever been proven with Apple *TEST* notifications and that "only the plan write awaits a real transaction" — which means this path has very likely never run against a real expiry, in either direction.

The fix is to exempt revocations from the staleness guard, which is what the code's own comment already believes it does:

```ts
const revoking = verdict.plan === 'free';
if (!revoking && isStale(periodEnd, current?.current_period_end)) { … }
```

Ordering is still protected: a `renewal` arriving after an `expiration` carries a strictly later `expirationAt` and wins on its own merits, because the renewal is a granting event and still passes through `isStale`.

### 3.4 C2 — nothing else would catch it

There is no clock-based backstop. `effective_plan` ignores `current_period_end` (§3.2). No cron job touches `subscriptions` — the complete cron inventory is in §6 and none of the ten jobs mentions it. `superwall-reconcile` is user-initiated at sign-in, only claims `unidentified_alias` events, and its own fold (`_shared/superwall-plan.ts:133-166`) can only raise or leave a plan alone.

So C1 has no second line of defence. Even with C1 fixed, a delivery that Svix eventually gives up on leaves a churned user entitled forever, because there is nothing that periodically asks "is `current_period_end` in the past and `plan` not `free`?". A nightly reconciliation — either a cron calling a `downgrade_expired_subscriptions()` sweep, or a `current_period_end < now()` clause in `effective_plan` — closes both.

### 3.5 Can a paying user be left on `free`?

Yes, three ways, and all three are recorded rather than silent — which is the schema's real strength here:

1. **`unidentified_alias`** — a purchase before `identify()` maps to `$SuperwallAlias:<uuid>`, no Supabase user, no plan write (`superwall-webhook/index.ts:255-268`, returns 200 because retrying cannot help). Drained by `claim_superwall_alias` (`20260811205418:11-51`) at next sign-in. What can never be drained — a device that reinstalled and rotated its alias — surfaces in the `superwall_unreconciled` view (`20260811205418:61-75`), whose comment is the correct operational instruction.
2. **`unattributed`** — an Apple notification with no usable `appAccountToken` (`asc-notifications/index.ts:290-298`). Recorded, alarmed on via `commerce_health_report`'s revenue block (`20260826150000:96-108`).
3. **`write_failed`** — a database error on the upsert. Recorded as its own outcome specifically so the id stays claimable (`20260811204335:22-59`) and Svix's retry re-runs the write. Sound.

`unmapped_product` returns 422 and stays claimable — also sound, and the reason the retryable-outcome logic exists at all.

### 3.6 Two smaller observations on the ledgers

- **Write ordering differs between the two pipelines, and one comment is wrong.** `superwall-webhook` claims the ledger row *first*, before the verdict (`:223-226`), explicitly so a refused event is on record. `asc-notifications` writes its ledger **last**, after the subscription upsert (`:336-351`) — while its comment at `:277-278` claims the Superwall ordering. A crash between `:311` (plan applied) and `:336` (ledger) leaves an applied plan with no audit row. Apple redelivers and the path is idempotent, so it converges; the transient state is simply un-auditable. Worth a one-line comment correction at minimum.
- **The two ledgers spell the same outcomes differently.** `superwall_events.outcome` is the `superwall_outcome` enum (`20260811195856:25-32`) using `no_state_change` / `unmapped_product` / `unidentified_alias`; `asc_notifications.outcome` is free text (`20260826150000:20`) using `no_change` / `unmapped` / `unattributed`. Any cross-ledger query has to know both vocabularies.

### 3.7 Down migrations

**There are none, anywhere.** `supabase/migrations/` contains 112 forward-only `.sql` files and no `down/`, `revert/` or paired-inverse convention; a filesystem search for `*down*` and `*rollback*` under `supabase/` returns nothing. This is the Supabase CLI's own model and is not a defect by itself, but it has three consequences worth writing down:

1. Every correction in this tree is a **forward** correction, and the tree says so — `20260824010000`, `20260824020000`, `20260824030000` are three successive forward corrections to one stylist feature, each with a header naming the flaw in its predecessor. That is the right discipline given the constraint.
2. The one genuinely irreversible statement in the tree is `alter table catalog_lookups drop column query` (`20260811165146:23`), and the migration justifies it by having verified the table was empty (`:20-21`).
3. `alter type … add value` is irreversible in Postgres. The tree does this eight times (`20260806091000:30`, `20260811204321:7`, `20260811205359:32`, `20260813203052:43-45`, `20260825000000:50`). All are `if not exists`-guarded and none uses the new value in the same transaction — which is correct, and the reason is documented at `20260806091000:14-24`. But an enum label added in error cannot be removed without rewriting every dependent column.

---

## 4 · `outfit_reactions` and `apply_outfit_reaction`

### 4.1 Correctness

The current definition is `20260804202000:30-104`. It is `SECURITY INVOKER`, derives the user from `auth.uid()` (`:49`), raises `42501` when unauthenticated, and — correctly — inserts the reaction row **before** taking the profile lock:

```sql
select feedback_count into v_current
  from public.style_profiles
 where user_id = v_user
   for update;                       -- :66-69
```

The `for update` is genuinely load-bearing and the header explains why (`:63-65`): without it two callers both read the same count, both conclude they are current, and both write. With it, the version comparison and the weight write are one critical section per user. This is correct optimistic concurrency and the design reasoning at `:8-19` — that a clobbered weight vector is unrecoverable while a skipped update is replayable from the event log — is right.

### 4.2 H3 — it is not idempotent, and the prescribed retry makes it worse

`:57-61` inserts the reaction unconditionally, with **no dedupe key**: no `op_id`, no unique constraint on `outfit_reactions`, no `on conflict`. The table has exactly one unique constraint — its `id` primary key (`20260803210000:90`) — plus the composite FK from `20260804200000:229-231`.

The header then prescribes:

> `:22-23` — *"New clients pass it and retry on `applied: false`."*

The client does exactly that. But a retry re-enters the function from the top, so it:

1. inserts a **second** `outfit_reactions` row for the same decision, and
2. increments `feedback_count` a **second** time.

Both halves corrupt the thing the table exists to protect. `feedback_count` is the honesty gate — `20260803210000:61-62` says *"below ~8 reactions the engine has learned almost nothing, and the app should say so"* — and it now over-counts by the retry rate. And the replay corpus, which `:107-109` calls the reason the whole model can be recomputed from scratch, acquires duplicate observations that will be weighted twice by any replay.

The same shape applies to an ordinary network timeout: the transaction commits, the response is lost, the client retries, two reactions land.

Every other command in this schema solved this. `wear_outfit_tx` and `plan_outfit_tx` take a client-generated `p_op_id` and route it through `claim_command` (`20260804200000:341-386`) precisely so *"a retry returns the original result instead of doing the work twice"* (`:337-338`). `apply_outfit_reaction` predates that pattern by one day and never got it.

Two fixes, either sufficient:
- add `p_op_id uuid` and the same `claim_command` guard the two `_tx` functions use; or
- separate the retry from the insert — return `applied:false` with the current `feedback_count` and have the client call a second, insert-free function that only rewrites the weights.

The second is cheaper and matches what the retry actually wants: the reaction is already recorded; only the weight write needs redoing.

### 4.3 The `reaction_concurrency` migration itself

`20260804202000` is well-formed. `drop function if exists` with the full old signature (`:26-28`) before `create function` avoids the ambiguous-overload trap that `20260803213000:10-13` documents. Return type changed from `void` to `jsonb`, which is why the drop was required. Grant restated at `20260805231500:33-34`. No issues.

### 4.4 Indexes, and what a ranking read would cost

Existing indexes on `outfit_reactions` — the complete set:

```
outfit_reactions_user_id_idx       btree (user_id)                  20260803210000:118
outfit_reactions_user_created_idx  btree (user_id, created_at desc) 20260803210000:119
```

There is **no index on `item_ids`** and **none on `outfit_id`**.

The client's only read is the dedupe lookup at `src/features/styling/mutations.ts:77-88`:

```
.eq('user_id', …).eq('source', …)
.contains('item_ids', itemIds).containedBy('item_ids', itemIds)
.order('created_at', { ascending: false }).limit(1)
```

`.contains` + `.containedBy` on the same array is set equality — "the reaction whose item set is exactly this outfit". With no GIN index on `item_ids`, the planner uses `outfit_reactions_user_created_idx`, walks that user's reactions newest-first, and applies `@>` and `<@` as filters per row. For a user with one reaction on this signature near the top, the `limit 1` makes it cheap. For a user re-reacting to an outfit they last saw a thousand reactions ago, it walks the whole history.

**Cost of a per-user, per-signature ranking read as things stand:** `O(user's total reactions)` in the worst case, with two array containment checks per row and no early exit. A GIN index closes it:

```sql
create index outfit_reactions_item_ids_idx on outfit_reactions using gin (item_ids);
```

`@>` and `<@` are both GIN-indexable for `anyarray`, so the planner can bitmap-and the GIN result with the `user_id` btree and reduce the candidate set to the handful of reactions that share the signature before any filter runs. This is the single highest-value index in this report: the table grows with every swipe on the Today deck, the query runs on every reaction, and it is currently the only unindexed predicate on a hot write-heavy table.

A `(user_id, source, created_at desc)` index would additionally let the `source` filter and the ordering both be satisfied from one scan, but the GIN is the one that changes the complexity class.

---

## 5 · Deletion

### 5.1 The path

`delete-account/index.ts`, invoked with `withSupabase({ auth: 'user' })` at `:122`, user id from `ctx.userClaims?.id` at `:133` (never the body). Order:

1. read `profiles.deletion_requested_at` (`:144-148`)
2. set it if null, preserving the original timestamp on a retry (`:160-163`) — the resumability marker from `20260804201000:17-28`
3. clear storage, bucket by bucket, recursing and removing in chunks of 100 (`:67`, `:197-203`)
4. `admin.auth.admin.deleteUser(userId)` (`:237`)

Storage before auth is correct and the reason at `:15-19` is exactly right: every table cascades from `auth.users`, so deleting the user first orphans the objects with nothing left naming them.

### 5.2 Cascades

I checked every table that references `auth.users`. **All 40+ carry `on delete cascade`**, with four deliberate exceptions:

| Table.column | Behaviour | Justified? |
|---|---|---|
| `ai_calls.user_id` | `set null`, column nullable | **Yes** — `20260807122000` is a full charter for this: the spend ledger outlives the person, RLS still hides it (`NULL = uid` is `NULL`), and the row becomes an anonymised accounting line |
| `saved_looks.source_owner_id` | `set null` | **Yes** — `20260821000000:105-107`: an account leaving must not reach into a third party's private note |
| `activity_events.actor_id` | `set null` | Yes — the recipient's row survives its actor |
| `superwall_events.reconciled_user_id` | `set null` | **See L4** |
| `outfits.origin_outfit_id`, `outfit_calendar.outfit_id`, `style_feedback.*`, `wishlist_items.*`, `circle_members.invited_by`, `event_members.invited_by`, `items.intake_draft_id`, `boards`→`outfits.board_id` | `set null` | Yes — all intra-user, all argued at the point they appear |

`event_join_ledger.event_id` deliberately has **no** FK (`20260826000000:19-23`) so the lifetime-join fact survives the event's deletion; `user_id` still cascades. Correct.

The "enumerate no tables" choice at `:30-33` is right — *"enumerating tables here means a table added later is silently missed"* — and it demonstrably worked: `pinterest_connections` and `pinterest_oauth_states` were added on 2026-08-30 and were covered on day one without touching the function (`20260830120000:29-32`).

### 5.3 M2 — the `exports` bucket is not walked

`delete-account/index.ts:67`:

```ts
const BUCKETS = ['garments', 'avatars', 'intake-audio'] as const;
```

The `exports` bucket exists (`20260810120250:18-20`) and `build-export` writes a **complete archive of the user's personal data** into it. It is not in the list.

So on deletion: the `data_exports` row cascades away, taking `object_path` with it — and the archive object stays in the bucket permanently, with nothing anywhere naming it. That is precisely the failure the function's own header describes at `:15-19`, applied to the one bucket it does not walk. The bucket is private and reach is by signed URL only (`20260810120250:16-17`), so the exposure is not a live URL; it is undeleted personal data with no index, which is the harder problem to remediate later.

The fix is one array element. The recursive lister at `:84-119` already handles both flat and nested layouts.

### 5.4 What else survives

- **`waitlist.email`** — no FK, no deletion path (`20260810130000:23-43`). An address given on the marketing form outlives the account it later became. Probably correct as a marketing list, but it is personal data with no erasure route and no comment saying so.
- **`superwall_events`** — after `set null` on `reconciled_user_id`, the row still holds `app_user_id` (the raw `originalAppUserId`, which for an identified user **is the Supabase uuid**), `original_transaction_id`, `product_id` and `expiration_at`. `20260811195856:41` keeps `app_user_id` deliberately for alias matching, but nothing nulls it on deletion.
- **`asc_notifications.app_account_token uuid`** — `20260826150000:16`, **no foreign key at all**, so no cascade and no `set null`. It holds the deleted user's uuid, `original_transaction_id` and `product_id` indefinitely.

`ai_calls` got a 35-line charter explaining exactly why its ledger outlives the account and what remains after (`20260807122000`). Neither billing ledger got one. **L4** is not "these are wrong" — a revenue ledger has a legitimate retention argument — it is that the argument has not been written down, so the next person to audit the deletion path finds two tables holding a departed user's identifiers with no recorded reason.

### 5.5 Orphans, checked and clear

- **Storage:** `garments`, `avatars`, `intake-audio` walked; `exports` not (§5.3). `intake-audio` additionally has an hourly reaper (`20260825140000:111-112`).
- **Push tokens:** `push_tokens.user_id` cascades (`20260810100300:31`). `push_sends` and `push_receipts` cascade / carry no user FK respectively; `push_receipts` is pruned at 25 hours (`20260811210345:89-98`).
- **Invites:** there is no `invite_links` table — `20260810120100:2-8` explains that the handle *is* the link. `profiles.invited_by` is `on delete set null` (`:16`), so an inviter's departure does not delete the invitee's profile. Correct.
- **`data_exports`:** rows cascade; objects do not (§5.3).

---

## 6 · Cron jobs

Ten scheduled jobs. Every one was traced to a live function.

| Job | Schedule | Calls | Reaches | Credential |
|---|---|---|---|---|
| `cinch-push-morning-edit` | `0,15,30,45 * * * *` | `push_invoke('morning_edit')` | `send-push` | Vault `push_send_url` + `push_cron_secret` |
| `cinch-push-borrow-requests` | `*/5 * * * *` | `push_invoke('borrow_requests')` | " | " |
| `cinch-push-friend-activity` | `5 * * * *` | `push_invoke('friend_activity')` | " | " |
| `cinch-push-votes-comments` | `10 * * * *` | `push_invoke('votes_comments')` | " | " |
| `cinch-push-event-reminders` | `20 * * * *` | `push_invoke('event_reminders')` | " | " |
| `cinch-push-sends-prune` | `40 3 * * *` | `push_sends_prune()` | local | none |
| `cinch-push-receipts` | `7,17,…,57 * * * *` | `push_receipts_invoke()` | `send-push` `{mode:'receipts'}` | reuses the two above |
| `cinch-push-receipts-prune` | `50 3 * * *` | `push_receipts_prune()` | local | none |
| `cinch-export-sweep` | `*/10 * * * *` | `export_invoke()` | `build-export` | Vault `export_build_url`, `export_sweep_secret`, `export_service_key` |
| `cinch-reap-intake-audio` | `17 * * * *` | `intake_reap_invoke()` | `reap-intake-audio` | Vault `intake_reap_url`, `intake_reap_secret` |
| `cinch-catalog-cache-sweep` | `35 4 * * *` | `sweep_catalog_cache()` | local | none |
| `cinch-commerce-health` | `50 * * * *` | `commerce_health_invoke()` | `commerce-health` | Vault `commerce_health_url` + `push_cron_secret` |
| `cinch-purge-activity` | `*/10 * * * *` | `purge_activity_events()` | local | none |
| `cinch-feed-sync` | `25 8 * * *` | `feed_sync_invoke()` | `sync-feeds` | Vault `feed_sync_url`, `feed_sync_secret` |

**No credential appears in any migration file.** Every outbound invoker reads its URL and secret from `vault.decrypted_secrets` by name at call time. The discipline is stated at `20260810110200:8-27` and the reason given there is the right one — a preview database restored from production would otherwise carry production's function URL and ring real people's phones from a test. Every invoker degrades to `raise notice` and `return null` when the secrets are absent, rather than raising, so an unconfigured database logs once per tick instead of burying the explanation.

**No job references a function or column that no longer exists.** I verified each target:

- `push_sends_prune()` — `20260810110100:558-569` ✓
- `push_receipts_prune()` — `20260811210345:89-98` ✓
- `sweep_catalog_cache()` — `20260811154242:184-192` ✓
- `purge_activity_events()` — `20260820000000:600-605` ✓
- `export_invoke()`, `commerce_health_invoke()`, `feed_sync_invoke()`, `intake_reap_invoke()`, `push_invoke()`, `push_receipts_invoke()` — all live ✓

**One historical break, correctly repaired.** `cinch-reap-intake-audio` originally called `public.reap_intake_audio()` (`20260810140300:78-97`), which deleted straight from `storage.objects` — which the platform's `storage.protect_delete()` trigger refuses. The job failed on every tick for 364 ticks while the recordings it existed to remove outlived their 24-hour promise. `20260825140000` split it: `stale_intake_audio()` reads (allowed), the edge function deletes through the storage API, and the broken function was dropped (`:57`) rather than left as an invitation to regress. The diagnosis at `:1-16` is exemplary.

**Schedule stagger is deliberate and correct** — `20260810110200:96-98` explains why five jobs on `:00` would produce nothing but a spikier graph. The one collision is `cinch-reap-intake-audio` and `cinch-push-receipts` both on `:17`; harmless.

**L5(a) — two jobs lack the replay guard their siblings have.** `20260810110200:121-139`, `20260810120500:87-93`, `20260810140300:110-116`, `20260811210359:49-59`, `20260811174717:107-112`, `20260820000000:618-624` and `20260825120000:65-71` all wrap `cron.schedule` in an existence test and `cron.unschedule`. `20260811160015:11-15` (`cinch-catalog-cache-sweep`) does not. In practice `cron.schedule(name, …)` upserts by jobname in pg_cron ≥ 1.4, so both forms replay cleanly — but the inconsistency means the file's author and the seven others disagreed about whether it raises, and only one of them can be right. Worth settling in one direction.

---

## 7 · Indexes

### 7.1 Covered

I matched every client query pattern from the call-site inventory against the index set. These are correctly served:

| Pattern | Index |
|---|---|
| closet grid: `user_id`, `not is_archived`, `created_at desc` | `items_user_active_idx` `20260803154431:118` |
| diary: `outfits` `user_id`, `worn_at not null`, `worn_at desc` | `outfits_user_worn_idx` `20260810100000:107` |
| kept plates: `user_id`, `saved_at not null`, `saved_at desc` | `outfits_user_saved_idx` `:104` |
| favourites: `user_id`, `favorited_at desc` | `outfits_user_favorited_idx` `20260816190545:11` |
| week planner: `outfit_calendar` `user_id` + `planned_date` range | `outfit_calendar_user_date_idx` `20260803154431:220` |
| activity inbox: `recipient_id`, `dismissed_at is null`, `created_at desc` | `activity_events_inbox_idx` `20260820000000:154` |
| saved looks list: `owner_id`, `created_at desc` | `saved_looks_owner_created_idx` `20260821000000:161` |
| boards chips: `user_id`, `name asc` | `boards_user_name_idx` `20260810100000:55` |
| exports page: `user_id`, `requested_at desc` | `data_exports_user_recent_idx` `20260810120000:36` |
| paywall caps: `user_id`, `shown_at desc` | `paywall_impressions_user_recency_idx` `20260901000000:262` |
| trips (recent / saved) | `trips_user_recent_idx`, `trips_user_saved_idx` `20260809100000:98,101` |
| catalogue text search | GIN on `to_tsvector(title ‖ brand)` `20260811114245:121` |
| catalogue import dedupe: `user_id` + `catalog_external_id` | `items_user_catalog_external_id_key` `20260813194202:77` |
| intake resume | `intake_sessions_resumable_idx` `20260810140000:53` |
| intake procession | `intake_drafts_session_ordinal_idx` `20260810140100:98` |
| stylist reservations | `stylist_chat_reservations_user_period_idx` `20260824010000:64` |
| event rosters, votes, comments | the four `20260807101000/102000` indexes |
| circle rosters | PK leading column + `circle_members_joined_idx` `20260818000000:106` |

### 7.2 Missing — M5

**(a) Username prefix search — the worst of the four.**

`src/features/social-graph/queries.ts:268` and `:273` both run `.ilike('username', \`${q}%\`).limit(10)`, against `public_profiles` and `social_profiles` respectively. The only index on the column is:

```sql
create unique index profiles_username_key on profiles (lower(username)) where username is not null;   -- 20260803210000:235
```

`username ILIKE 'q%'` cannot use a `lower(username)` btree — the operator is `~~*`, the expression does not match, and even `LIKE` would need `text_pattern_ops` under a non-C collation. So friend search is a **sequential scan over `profiles`**, and because it goes through a definer view it also evaluates `blocked_between()` and `is_friend()` per surviving row for `social_profiles`. This is the search box on the Add Friends screen.

```sql
create index profiles_username_prefix_idx
  on profiles (lower(username) text_pattern_ops) where username is not null;
```
— and have the client send `lower(q)` against `lower(username)`, or add a `pg_trgm` GIN if `ILIKE '%q%'` is ever wanted.

**(b) `outfit_reactions.item_ids`.** Covered in §4.4. `create index … using gin (item_ids)`.

**(c) The Daily feed's driving predicate.** `friend_worn_outfits` (`20260817000000:93-106`) filters `o.worn_at is not null and o.worn_at >= p.worn_outfits_shared_since and o.worn_at > now() - interval '7 days'` and is read with **no `user_id` filter** at `src/features/daily-social/queries.ts:82`. The only `worn_at` index is `outfits_user_worn_idx (user_id, worn_at desc)` — a composite whose leading column is not in the predicate, so it cannot serve this. The plan is a seq scan on `outfits`.

```sql
create index outfits_worn_recent_idx on outfits (worn_at desc) where worn_at is not null;
```

**(d) The review deck.** `src/features/closet/queries.ts:197` filters `user_id`, `user_verified = false`, `status in ('tagged','needs_review')`, ordering `status asc, created_at asc`. The nearest index is `items_pending_tag_idx on items (user_id) where status in ('pending_tag','needs_review')` (`20260803154431:120`) — a **different status set**: it excludes `'tagged'`, which is the bulk of the deck. So the query falls back to `items_user_id_idx` plus a filter and a sort.

```sql
create index items_review_deck_idx on items (user_id, status, created_at) where not user_verified;
```

**(e) Minor, listed for completeness.** `chat_sessions` ordered by `updated_at desc` with only `(user_id)` indexed (`src/features/stylist/use-chat.ts:244`); `trips` ordered by `starts_on desc` with only `(user_id, created_at desc)` and `(user_id, saved_at desc)` (`use-trips.ts:205`); `borrow_requests` ordered by `created_at desc` with no `created_at` index and an RLS `OR` across two indexed columns (`queries.ts:433`). All three are small per user and bounded by a `limit`; none is worth an index today.

### 7.3 M6 — two unfiltered definer-view reads

Distinct from a missing index, and more expensive than one:

- `src/features/explore/queries.ts:71` reads `friend_items` with **no `user_id` filter**, ordered `created_at desc`, limit N. `friend_items` (`20260811150000:48-62`) has `is_friend(i.user_id)` in its WHERE plus a correlated `select p.shoppable` per row. With nothing to restrict the scan, `is_friend()` — which itself runs `blocked_between()` plus two `exists` over `follows` — is evaluated **once per non-archived item in the entire table** before the sort and the limit.
- `src/features/daily-social/queries.ts:82` reads `friend_worn_outfits` the same way, so `is_friend()` runs per candidate outfit (§7.2(c)).

Both are correct and both degrade linearly with total user count, not with the caller's friend count. The structural fix is to have the caller pass its friend id list (it already has one — `src/features/social-graph/queries.ts:51` fetches the follow graph) and use `.in('user_id', friendIds)`, which turns the definer predicate from a scan filter into a recheck on a small indexed set. The index in §7.2(c) helps the second case regardless.

### 7.4 Redundant

`items_user_active_count_idx on items (user_id) where not is_archived` (`20260808190100:134`) is a strict prefix of `items_user_active_idx on items (user_id, created_at desc) where not is_archived` (`20260803154431:118`) with the same predicate. The composite serves every count the partial does. Droppable.

(The earlier duplicate, `items_user_id_count_idx`, was already caught and dropped at `20260805231500:49` — with a header noting the `if not exists` guard did not fire because the names differed. Same mistake, same table, second occurrence.)

---

## 8 · Constraints

### 8.1 Enum drift: client zod vs database

`src/schemas/item.ts` is the only file in `src/schemas/`. Every enum matches:

| zod | line | Postgres | line | Match |
|---|---|---|---|---|
| `itemCategory` (10 values) | `:17-28` | `item_category` | `20260803154431:15-18` | ✓ exact |
| `itemStatus` (5) | `:31-37` | `item_status` | `:20-26` | ✓ exact |
| `garmentFit` (4) | `:59` | `garment_fit` | `20260803210000:18` | ✓ exact |
| `patternScale` (5) | `:61` | `pattern_scale` | `:19` | ✓ exact |
| `season` (4), `occasion` (8) | `:46-54` | none — columns are `text[]` | `20260803154431:95-96` | UI vocabulary only, correctly documented at `item.ts:39-45` |

**No drift.** The zod schema explicitly stays permissive where the column is (`seasons`/`occasions` as `z.array(z.string())` at `:119-120`), which is the right call and the header explains it.

Three DB check constraints that zod does **not** mirror, because the client never writes them:

- `items.colour_source in ('measured','spoken','catalogue')` — `20260813194202:92-93`
- `items.intake_method in ('photo','voice','manual','catalogue')` — `:120-121`
- `intake_drafts.slot in (…9 values…)` — `20260810140100:46-48`

The client *does* write two of them at `src/features/ingest/use-garment-search.ts:437-438` (`colour_source:'spoken'`, `intake_method:'manual'`) — both legal values, unvalidated on the way out. A typo there is a runtime `23514`, not a type error.

### 8.2 Nullable columns the client assumes non-null

Comparing `src/types/database.ts` against usage, I found **no case where the client dereferences a nullable column as non-null without a guard**. Two shapes are worth naming as latent:

- `profiles.username` and `display_name` are both nullable (`database.ts:2098-2142`), and every renderer coalesces — `push_claim_friend_activity` at `20260810110100:198-199` does `coalesce(nullif(btrim(display_name),''), nullif(username,''), 'Someone')`, `invite_card` falls back to `'@' || username` (`20260810120300:21`). The one place that does not coalesce is `invite_card`'s ultimate fallback: if **both** are null it returns `'@' || NULL` = `NULL`, which the landing page reads as "no such handle". That is the exact bug `20260810120300` was written to fix, reintroduced one level down. Reachable only for a profile with a null username, which the format check permits (`20260803210000:240-241` allows `username is null`).
- `ai_calls.user_id` is nullable by design (`20260807122000:37-38`) and the privacy screen reads it with `.eq('user_id', …)` (`src/features/auth/use-ai-privacy.ts:92`), so anonymised rows are correctly invisible.

### 8.3 M4 — uncapped text on UGC surfaces

`20260808100000` installed `assert_clean_ugc` on five surfaces: `event_comments.body`, `event_outfit_posts.caption`, `events.title/note/dress_code`, `borrow_requests.message`, `profiles.display_name/username/bio` (`:168-188`), later extended to `circles.name` (`20260818000000:604-606`). Every one of those columns also carries a `char_length` check.

**Six columns cross the same boundaries with neither a cap nor a filter:**

| Column | Declared | Crosses to | Via |
|---|---|---|---|
| `items.subcategory` | `text` — `20260803154431:85` | friends, event co-members | `friend_items` `20260808110000:42`, `event_post_items` `20260807103000:60`, `public_items` `20260804200000:64` |
| `items.description` | `text` — `:97` | friends | `friend_items`, `public_items` |
| `items.brand` | `text` — `:89` | friends | " |
| `items.material` | `text` — `:88` | friends | " |
| `items.pattern` | `text` — `:87` | friends | " |
| `outfits.name` | `text` — `:150` | friends, event co-members, public | `friend_worn_outfits` `20260817000000:97`, `public_outfits` `20260804200000:75`, and into `activity_events.payload` |

This is not hypothetical for `subcategory` and `description`. The voice walkthrough writes **the user's own spoken sentence** into `items.description` (`20260811022953:84`, `v_draft.utterance`) and their spoken garment noun into `items.subcategory` (`:72`, `v_draft.name`), and `20260810140200:41-46` explains that `subcategory` *is* the display name because `pieceName()` renders "colour + subcategory". So an arbitrary-length, unfiltered utterance is stored and then shown to friends.

The precedent for the fix is already in the tree — `20260807110000:139-149` capped `bio` at 280 with a defensive `update … set bio = left(bio, 280)` first, and `20260808100000:113` notes that adding a surface to the filter *"is a CREATE TRIGGER and nothing else"*. Six columns, one trigger, five length checks.

Every other UGC-adjacent column *is* bounded: `event_comments.body` 1-1000, `event_outfit_posts.caption` ≤280, `events.title` 1-80, `events.note` ≤1000, `borrow_requests.message` ≤500, `outfits.note` ≤500, `trips.note` ≤2000, `boards.name` 1-60, `circles.name` 1-60, `saved_looks.snap_*` 120/200/2048, `content_reports.reason` 1-100 / `details` ≤2000. The gap is specific and small.

### 8.4 L3 — plan-limit functions with no `ELSE`

```sql
select case p_plan when 'free' then 10 when 'standard' then 150 when 'pro' then 1000 end;  -- 20260808190000:28-32
```

A `CASE` with no `ELSE` returns `NULL`. So if a fourth value is ever added to `subscription_plan`, `v_limit` is `NULL`, `v_count >= NULL` is `NULL`, the `if` does not fire, and **the limit becomes unlimited** for the new tier. Same shape in `event_limit_for_plan` (`20260828170000:11`), `item_total_limit_for_plan` (`20260808190100:36-40`), and `event_join_limit_for_plan` (`20260826000000:67`) — though the last returns `NULL` for non-free *deliberately*, meaning "no lifetime cap", and its caller guards with `if v_limit is not null` (`:93`).

The other three have no such guard. `else 0` would fail closed; `else raise` would fail loudly. Either beats silently uncapping.

### 8.5 Other constraint observations

- `items.borrowable boolean not null default true` (`20260807100000:123`) — **every** existing and new garment is borrowable by default, and `assert_borrow_target` (`:152-181`) will happily resolve any of them for a friend. That is a product decision, not a bug, but it is a default that opts users in rather than out, and it is the only such default in the schema (`shoppable` correctly defaults `false` at `20260811150000:35` with a header explaining why).
- `outfit_calendar` gained a partial unique index for note-only rows (`20260804200000:322-324`) because `unique (user_id, planned_date, outfit_id)` does not constrain NULLs. Correct catch.
- `trips` carries genuinely good closed-vocabulary checks — `vibes <@ array[...]` and `parts <@ array[...]` with cardinality bounds (`20260809100000:61-68`) — and `latitude numeric(5,2)` deliberately clamps stored precision to match the privacy manifest's Coarse Location claim (`:37-38`). That is a constraint doing real compliance work.
- `catalogue_demand_daily`'s shape constraints (`20260813203052:140-154`) are the strongest defensive checks in the schema: a brand must be a slug with no spaces, a class at most three lowercase words, and a row with nothing recognised is refused outright — *"a length cap alone is not enough — 'i own a james perse tee' is 23 characters"*.

---

## 9 · Migration hygiene

### 9.1 Idempotency

Most files are replay-safe by construction: `add column if not exists`, `create index if not exists`, `on conflict do nothing` on every seed, `do`-block guards around `add constraint` (`20260808180000:24-34`, `20260813194202:88-93`), and `drop trigger if exists` before `create trigger` — with `20260812120000:118-122` giving the reason in full (*"`create trigger` has no `or replace` and no `if not exists`, so a bare create fails 42710 — and it would fail AFTER the `create or replace function` above, leaving the file half-applied"*).

Files that are **not** idempotent, and would fail on a second application:

| File | Statement | Why |
|---|---|---|
| `20260803154431` | `create type`, `create table`, `create policy` throughout | initial schema; replay is from zero |
| `20260805160000:127-137` | `rename column day to period_start`, `drop constraint`, `add constraint` | one-shot rename |
| `20260807100000`, `20260807101000`, `20260807102000` etc. | `create function` (not `or replace`), `create policy`, `create trigger` | first-creation files |
| `20260811165146:23` | `alter table … drop column query` | irreversible; justified by the table being empty |
| `20260813203052:43-45` | `alter type … add value if not exists` | guarded, but irreversible |
| `20260901000000:147-148` | `alter table superwall_events add column period_type` | **no `if not exists`** — the only unguarded `add column` after 2026-08-08 |

The last is a real (if small) replay hazard, and it is inconsistent with the file's own neighbours: `20260830190000:29-30`, `20260827225825:1-3` and `20260825000000:45-48` all use `if not exists`. Given that `docs/ci/migration-replay.md` exists specifically because unguarded DDL broke a production replay on 2026-08-10 (`20260813194202:83-86`), this one should carry the guard.

### 9.2 Drops and renames

Three, all handled:

- `ai_usage_counters.day → period_start` (`20260805160000:127`) — a rename with the primary key rebuilt around it in the same transaction. No backfill needed; no reader outside `claim_ai_quota`.
- `catalog_lookups.query` dropped (`20260811165146:23`) — verified empty first, and replaced by a strictly narrower `terms text[]` with a cardinality check.
- `ai_calls.attempts` had its default and NOT NULL dropped and every existing value nulled (`20260808180100:18-22`) — deliberately destructive, on a table that had existed for under an hour, with the reasoning at `:6-16` (a column that is sometimes a measurement and sometimes a placeholder cannot be summed).

**No column is dropped or renamed while a reader still exists.** I checked each against the call-site inventory.

### 9.3 The local-vs-production naming divergence

`docs/ops/supabase-migration-reconciliation-20260817.md` documents the mechanism precisely and I found no reason to doubt it:

- Local files carry **round** timestamps (`20260808100000`); the MCP `apply_migration` route stamps its own **clock time** (`20260808150625`). Both paths are in use, so the ledger and the filenames diverge by construction (`:85-99`).
- The `name` column resolves the pairing: 41 of 42 remote-only rows pair 1:1 by name, the 42nd by statement content, **zero remote orphans** (`:88-91`). Two pairs prove the mechanism outright because the remote `name` still embeds the local version it was applied from (`:93-98`).
- `created_by` corroborates: the 42 remote-only rows carry an operator email and one whole-file statement; matched rows carry `created_by = NULL` and a per-statement array (`:100-104`).
- Byte length was tried as an equivalence test and **rejected** — the repo's migrations are heavily commented and the re-applied copies are not (`:106-110`).

**The doc's guidance still holds, with three updates.**

1. **The standing rule is intact and is being followed.** *Never `db push`; the remote ledger is the truth and the local file is the record of its statements* (`:756-758`). Migrations written since the audit obey it and say so in-line: `20260823000000:56-63` records its production ledger version `20260818055848` against filename `20260823000000` and cites this document by name; `20260828170000:6-8` does the same. That is the doc working as intended.
2. **The grant divergence it left open is closed.** The addendum at `:697-750` records `20260819000000_normalise_client_grants.sql` deployed, with before/after measurements (anon DML grants 52 → 0; anon table privileges 104 → 0; anon EXECUTE 7 → 2). §1.3 of this audit confirms the shape in the migration tree. The one residue is H4.
3. **The repair list is now stale as a list, though the method is unchanged.** The doc enumerates 41 pairs plus three specials (`:603-660`). The tree has grown from 92 local files to **112** since 2026-08-17, and at least two of the twenty new ones (`20260823000000`, `20260828170000`) are known MCP-applied and therefore carry their own clock-time ledger rows. Anyone running the repair must re-derive the pair set from a fresh `supabase migration list --linked` rather than using the doc's table.
4. **The precondition is unchanged and still unmet.** The repair needs a dashboard PITR restore point taken immediately before the window, because `migration repair` deletes 42 rows and takes ~374 KB of applied SQL in `statements` with them, and that column exists nowhere else (`:734-748`). Nothing in the schema depends on the repair; it is bookkeeping.

One thing the doc says that is worth re-reading in light of §1.5: the two application paths run as different principals from Postgres's point of view, and `ALTER DEFAULT PRIVILEGES` is per-role. That is the mechanism behind the "verify `claim_superwall_event`'s service_role grant" item.

### 9.4 pgTAP coverage

26 test files. The suite is unusually good — it asserts **catalogue invariants** rather than name lists wherever the invariant is the real requirement (`20_grant_matrix.sql:11-16`: *"the table somebody forgets to protect is the table they also forget to add to the test"*), and spells out an exact allowlist only where one is the actual boundary (the two anon-callable functions).

Coverage maps cleanly onto the feature tree: `01_rls_baseline`, `02_public_boundary`, `03_storage_bucket`, `04_plans`, `05_social_graph_boundary`, `06_event_boundary`, `07_social_storage`, `08_ugc_moderation`, `09_event_block_filter`, `09_friend_closet_privacy`, `10_intake_boundary`, `11_event_lock`, `12_silhouette_intake`, `13_observability_claims`, `14_catalogue_import`, `15_ai_control_plane`, `16_today_ratings_favorites`, `17_closet_visibility`, `18_daily_social`, `19_private_circles`, `20_grant_matrix`, `21_activity_center`, `22_saved_looks`, `23_friends_presence`, `24_invite_arrivals_blocks`, `25_stylist_chat_reservations`, `26_pinterest_connection`.

**What the suite does not cover**, and what would have caught the findings above:

- No test asserts that a **revoking** billing event lowers a plan (C1). `04_plans.sql` covers the limit tables; nothing exercises `isStale` against an equal period end.
- No test exercises **concurrency** on any limit trigger (H2). These are hard in pgTAP — two sessions are needed — but the shape is testable at the function level by asserting an advisory lock is taken.
- No test asserts `commit_intake_session` handles `storage_limit_reached` (H1). `10_intake_boundary.sql` covers the RLS boundary, not the ceiling branch.
- No test asserts `apply_outfit_reaction` is idempotent (H3) — because it isn't.
- `20_grant_matrix.sql` asserts anon holds nothing, but does **not** assert that every `authenticated` write grant has a matching policy (H4). That is one catalogue query joining `information_schema.role_table_grants` to `pg_policies`, and it is exactly the invariant the migration's header claimed to be upholding.

---

## Recommended order

**Before anything else — two read-only queries.** Run the `superwall_events` / `asc_notifications` outcome breakdown from §3.3 and the `has_function_privilege` check from §1.5. Both are `SELECT`s and both discriminate between two readings that lead to different work.

**Then, in order of consequence:**

1. **C1** — exempt revocations from the staleness guard in both webhooks (two lines, `superwall-webhook/index.ts:314`, `asc-notifications/index.ts:307`).
2. **C2** — add a clock-based backstop, either `current_period_end < now()` in `effective_plan` or a nightly sweep. C1 without C2 leaves a dropped delivery permanent.
3. **H4** — `revoke insert, update, delete on ai_calls, ai_usage_counters from authenticated`, mirroring `20260826010000`.
4. **H1** — extend `commit_intake_session`'s exception handler to `storage_limit_reached`.
5. **M2** — add `'exports'` to `BUCKETS` in `delete-account/index.ts:67`.
6. **M1** — one line in `use-plan.ts:141` to match `effective_plan`.
7. **H2** — `pg_advisory_xact_lock` at the top of `enforce_item_limit` first, then the other five.
8. **M5(a)** and **M5(b)** — the username prefix index and the `item_ids` GIN. Both are pure additions with no behaviour change.
9. **H3** — give `apply_outfit_reaction` an `op_id`, or split the retry path.
10. **M3, M4, L1–L5** as convenient.

Items 3, 5, 6, 8 are each a single line or a single array element, carry no behaviour change beyond the one intended, and remove three of the five highest-severity findings between them.
