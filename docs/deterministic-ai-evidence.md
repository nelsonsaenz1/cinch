# Deterministic AI — execution ledger

The durable record Workstream 0.3 asks for: what each packet changed, what was
run, what was applied and deployed, and what is still owed. Appended to, never
rewritten — a checklist that gets tidied stops being evidence.

Authoritative sources, in order: shipping code and production Supabase
configuration; the accepted CPV2 handoff; `docs/deterministic-ai-implementation-plan.md`;
current Expo SDK 57 / Supabase / Apple documentation.

---

## Baseline — 2026-08-13, at commit `6144665` (CPV2 closure)

Captured before Packet 1 so every later claim has something to be measured
against.

| Check | Command | Baseline |
| --- | --- | --- |
| Unit suite | `node scripts/run-tests.mjs` | 1258 pass, 0 fail |
| Types | `npx tsc --noEmit -p tsconfig.json` | 0 lines (excluding `handoff/`, `use-social-terms`) |
| Lint | `rm -rf .expo/cache/eslint && npx expo lint` | 11 problems, 0 errors, 11 warnings |
| Deno | `deno check` per changed function | exit 0 |
| Migration replay | `supabase db reset --local` | clean from empty |
| pgTAP | `supabase test db --local` | 16 files, 277 tests, PASS |
| Fingerprint | `npm run check:fingerprint` | `414c789dbc3e634e635204771090183175c624ff` |
| OTA in production | — | `019ffcc2-cedc-745f-a105-ac6021a5cd6d` |

**Production AI configuration before Packet 1** — four workloads, all
`openrouter`, all enabled:

| workload | model | max tokens | timeout |
| --- | --- | --- | --- |
| tagging | `google/gemini-3.1-flash-lite` | 1024 | 45000 |
| outfit_generation | `google/gemini-3.1-flash-lite` | 3072 | 30000 |
| stylist_chat | `z-ai/glm-5.2` | 8192 | 30000 |
| garment_search | `qwen/qwen3-vl-235b-a22b-instruct` | 2048 | 30000 |

**Production `ai_calls` before Packet 1** — 108 rows total:

| workload | calls | succeeded | avg latency | cost | rows with `attempts` |
| --- | --- | --- | --- | --- | --- |
| outfit_generation | 58 | 46 | 8611 ms | $0.0469 | 11 |
| tagging | 31 | 31 | 7550 ms | $0.0185 | 1 |
| garment_search | 17 | 17 | 6286 ms | $0.0876 | 0 |
| stylist_chat | 2 | 2 | 6520 ms | $0.0046 | 0 |

Three facts worth keeping from that table. **ASR is absent entirely** — it wrote
no ledger row at all. **`attempts` is null on 96 of 108 rows**, so no
retry-rate question could be answered. And **`stylist_chat`'s two calls include
packing briefs**, because packing had no workload of its own.

---

## Packet 1 — Workstreams 0–2 · control plane and demand aggregate

**Migration** `20260813203052_ai_control_plane_and_demand` — applied to
`dugizuswuebrmcmvinmi`, `{"success":true}`. Local filename and remote version
agree.

**Deployed** (`--project-ref dugizuswuebrmcmvinmi --use-api`): `garment-search`,
`transcribe-intake`, `parse-closet`, `packing-brief`.

**Seeded as data, not schema** — three `ai_config` rows. `ALTER TYPE … ADD
VALUE` may run in a transaction on Postgres 17 but the new label cannot be
*used* in that same transaction, and a migration is one transaction. Every
caller falls back to a compiled default when no row exists, so a replay from
empty is correct without the seed.

### Production readback

```
policies on catalogue_demand_daily : 0
row level security                 : true
anon    select                     : false
authenticated select               : false
authenticated execute (counter)    : false
service_role  execute (both)       : true
record_catalogue_demand prosecdef  : false
```

`ai_config` after seeding — seven workloads, all `validator_policy = 'strict'`,
all `rescue_model_id = null`:

| workload | model | max tokens | timeout |
| --- | --- | --- | --- |
| voice_transcription | `openai/whisper-large-v3` | 1024 | 120000 |
| closet_parsing | `deepseek/deepseek-v4-flash-0731` | 16000 | 60000 |
| packing_brief | `z-ai/glm-5.2` | 2048 | 30000 |

**Advisors:** one new INFO, `rls_enabled_no_policy` on
`catalogue_demand_daily` — which is the design, not a finding: RLS on with no
policy plus an explicit revoke is how the table is made unreachable. No new WARN
or ERROR. Every ERROR present (`security_definer_view` ×9) predates this packet.

### The line that does the work

`_shared/demand-intent.ts` stores a brand **only** when `parseQuery` reports
`brandSource === 'known'`. The other branch, `'leading-run'`, returns whatever
the user typed first — a fragment of their sentence wearing a brand's name. That
single condition is what makes the aggregate structurally unable to hold a
phrase; the column constraints (`brand_slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'`) are
the second line of defence, not the first.

### Operational queries

Run as `postgres` or `service_role`. Neither role is available to the app.

```sql
-- Count, success rate, p50/p95 latency and cost, by workload, last 30 days.
select workload::text,
       count(*)                                          as calls,
       round(100.0 * count(*) filter (where succeeded) / count(*), 1) as success_pct,
       percentile_cont(0.5) within group (order by latency_ms)  as p50_ms,
       percentile_cont(0.95) within group (order by latency_ms) as p95_ms,
       round(sum(cost_usd)::numeric, 4)                  as cost_usd,
       round(avg(attempts)::numeric, 2)                  as avg_attempts
  from public.ai_calls
 where created_at > now() - interval '30 days'
 group by 1 order by calls desc;

-- Retry rate: how often a call needed more than one attempt.
select workload::text,
       round(100.0 * count(*) filter (where attempts > 1) / nullif(count(*), 0), 1) as retry_pct
  from public.ai_calls
 where created_at > now() - interval '30 days' and attempts is not null
 group by 1;

-- Rescue rate: calls that ran on a model other than the configured primary.
select c.workload::text,
       round(100.0 * count(*) filter (where c.model_id <> f.model_id)
             / nullif(count(*), 0), 1) as rescue_pct
  from public.ai_calls c
  join public.ai_config f using (workload)
 where c.created_at > now() - interval '30 days'
 group by 1;

-- Validator-rejection rate. The marker is written by callers that validate;
-- see VALIDATOR_REJECTED in _shared/ai-config.ts.
select workload::text,
       round(100.0 * count(*) filter (where error like 'validator_rejected%')
             / nullif(count(*), 0), 1) as rejected_pct
  from public.ai_calls
 where created_at > now() - interval '30 days'
 group by 1;

-- Top demand, last 30 days.
select brand_slug, garment_class, audience, colour_family,
       sum(searches) as searches, sum(import_successes) as imports
  from public.catalogue_demand_daily
 where day > current_date - 30
 group by 1,2,3,4 order by searches desc limit 25;

-- Worst zero-result intents — what people ask for that the feed cannot answer.
select brand_slug, garment_class, audience,
       sum(searches) as searches, sum(zero_result_searches) as empty_answers,
       round(100.0 * sum(zero_result_searches) / nullif(sum(searches), 0), 1) as empty_pct
  from public.catalogue_demand_daily
 where day > current_date - 30
 group by 1,2,3 having sum(searches) >= 3
 order by empty_pct desc, searches desc limit 25;

-- Highest import conversion.
select brand_slug, garment_class,
       sum(searches) as searches, sum(import_successes) as imports,
       round(100.0 * sum(import_successes) / nullif(sum(searches), 0), 1) as conversion_pct
  from public.catalogue_demand_daily
 where day > current_date - 30
 group by 1,2 having sum(searches) >= 3
 order by conversion_pct desc limit 25;

-- Latency shape per intent, since an average over a day hides the tail.
select brand_slug, garment_class, latency_fast, latency_medium, latency_slow
  from public.catalogue_demand_daily
 where day = current_date order by latency_slow desc limit 25;
```

### Deliberate deviations

**Quota did not move.** The plan says stop accounting these calls as `tagging`
and `stylist_chat`; it does not say change what they cost. `claim_ai_quota`
takes `p_kind text` and reads `PLAN_LIMITS`, so the ledger name and the
allowance were always separate values. `packing_brief` still spends
`stylist_chat` — where free is *excluded*, not rationed, which is the server
half of the Pro boundary — and `closet_parsing` still spends `tagging`. Giving
either its own allowance is a pricing decision with a real number attached, and
`tests/ai-control-plane.test.ts` fails if a ledger workload appears in
`PLAN_LIMITS`.

**Validator policy is configured but nothing rejects yet.** `validator_policy`
and `rescue_model_id` exist, are constrained (a `rescue` policy without a rescue
model is refused), and every row is `strict`. The deterministic validators that
would exercise them belong to Workstreams 5–7. The columns are here now because
they are schema, and schema is what this packet is for.

### Still owed

- **A real spoken single-item catalogue query on a device.** CPV2's one open
  founder item. No host microphone can be driven from this environment; the
  typed path is proven live, the spoken one is proven only by tests.
- `attempts` remains null on the 96 historical rows. Not backfilled — there is
  no evidence of what those calls actually did, and inventing a 1 would make the
  column lie in a new way.
- No live demand row exists yet: the aggregate is written by a real search, and
  none has run against the deployed function since deploy.

---

## Packet 2 — Workstreams 3–4 · deterministic packing memo, stable Today policy

**No migration. No function deployed. No release published.**

Client-only, and deliberately so: the one Edge Function this packet makes
redundant (`packing-brief`) is still reachable by every device running the
current production OTA, and taking it away before those devices have the
deterministic memo would replace working prose with a 404. See "Retiring
packing-brief" below for the order.

### Workstream 3 — the memo stopped being a model call

`features/plan/packing-memo.ts` gained `buildPackingMemo`, a pure function over
proven fields: the forecast (or the seasonal normals, labelled as normals), the
tapped vibes' formality, the capsule `buildPackingList` produced, the repeat
count per piece, the worn piece, and the looks the closet could not fill.
`use-packing-brief.ts` is now a `useMemo` — no `supabase`, no `functions.invoke`,
no consent branch, no allowance.

Three reasons the model was removed rather than kept as a fallback:

1. It was the only part of packing that could be wrong. The forecast, closet
   read and capsule are arithmetic; the prose on top had no source and was set
   in the largest type.
2. It made a local feature need a network, a consent and an allowance — and the
   allowance it spent was the STYLIST's, so a heavy month of chat could take the
   memo away from a trip.
3. It invented the one thing nobody can check. "Lisbon is smart-casual in
   September" arrived with the same confidence as the temperature. The plan says
   remove those claims rather than guess them, so there is no destination
   sentence at all — not a hedged one.

**Copy corrected where source truth changed.** `WITHOUT_CONSENT_WORKS` now names
packing; `WITHOUT_CONSENT_LOST` no longer does. The four memo failure cards are
deleted, including the one that told the user packing draws on the stylist's
allowance. `tests/w3-g4-consent-privacy.test.ts` had an assertion pinning the OLD
truth ("packing cannot be in the works list") — it is inverted, and the
inversion checks the CLIENT rather than the Edge Function, because the function's
consent gate is still correct for builds that have not updated.

### Workstream 4 — Today asks only when there is a question

`features/styling/should-enhance.ts` is the policy, pure and testable:

| reason | fires when | does not fire when |
| --- | --- | --- |
| `complex_note` | two clauses ("dinner then drinks"), or ≥4 unrecognised words | a note the occasion vocabulary already read ("work") |
| `event_conflict` | two events ≥2 apart in formality | one event, or a 3 and a 4 |
| `near_tie` | top and (visible+1)th scores within 2% | a clear winner; a tie below the fold |

Ordinary mornings now make **zero** AI calls. Two things followed from that:

**The merge was reordering the screen, and now cannot.** `useOutfits` built the
visible list FROM the model's picks, in the model's order — so a response
landing fifteen seconds after the cards appeared could reorder them, drop one
the person was looking at, and promote a candidate they had never seen, with the
swap and wear buttons under their thumb. The base list is now authoritative and
the model's words are matched onto visible outfits by candidate id; anything
naming a candidate that is not visible is discarded.

**`'local'` was added to `StylingStatus`.** With no call made, the old code
reported `'offline'` — a network problem where there is none.

### Checks

```
node scripts/run-tests.mjs   1285 pass, 0 fail   (1258 → 1285)
npx tsc --noEmit             0 lines
npx expo lint                11 problems, 0 errors  (baseline)
deno check packing-brief     exit 0 (unchanged source)
npm run check:fingerprint    414c789dbc3e… unchanged
```

`tsc` caught a real defect the runtime tests did not: the memo fixtures used
`'day'` where `DayPartKey` is `'daytime'`, and `dayPartOf` falls back to the
first day part for an unknown key — so the part-note assertions had been passing
against the fallback.

### Runtime and OTA eligibility

Fingerprint **unchanged** (`414c789dbc3e634e635204771090183175c624ff`). No
native dependency, permission, entitlement, Expo config-plugin or Apple
framework change; no Expo API surface is touched by the diff at all. This packet
is **same-runtime and OTA-eligible**, and is deliberately **not published**.

**Pending OTA receipts, to be published together:**

- Packet 1 — the client carries the catalogue intent key on import, so
  `import_attempts` / `import_successes` are not being counted from devices yet.
- Packet 2 — the deterministic memo and the Today enhancement gate.

### Retiring `packing-brief`

In this order, and not before:

1. Publish the combined same-runtime OTA (Packets 1 + 2).
2. Confirm no `packing-brief` invocations from the deployed functions' logs.
3. Then delete the function, its `ai_config` row, and the deprecated
   `PackingBriefError` class kept for one dev fixture route.

Deleting it now would break the memo for every device on the current bundle.
