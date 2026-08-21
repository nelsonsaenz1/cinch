# Research · the catalogue, the upload seam, and the road to the next binary

*Written 2026-08-21. Companion documents: `2026-08-21-action-plan.md` (what to do)
and `2026-08-21-execution-plan.md` (how to build it). Everything below was read
from the repository, the production database, EAS, and GitHub on this date —
none of it is remembered or assumed.*

---

## 1 · The product catalogue: what actually exists

### 1.1 One live supplier, queried per request, never imported

Cinch's entire commerce surface is answered by **Datafeedr**, a licensed
aggregator over 44,027 merchants, hit live at `POST api.datafeedr.com/search`
(`supabase/functions/_shared/catalog.ts:248`). The plan meters **requests, not
rows**, so every call asks for the maximum 100 rows (`BATCH_SIZE`,
`catalog.ts:273`). Results are filtered to seven US network instances
(`US_SOURCE_IDS`, `catalog.ts:266`).

Quota, from the production ledger (`catalog_quota`): **108 of 10,000 requests
used** this cycle (bill day 11, 500 held in reserve). The ceiling is not a
constraint on anything proposed in the action plan; the constraint is design
discipline about when a request is worth spending.

Caching: `catalog_lookups` holds normalised results keyed on
sha256(provider‖mode‖query), 7-day TTL on hits, 24-hour on cached misses.
17 entries exist. A cache hit costs zero quota. This is the lever the browse
proposal stands on.

### 1.2 The empty tables are empty on purpose

`catalog_merchants` and `catalog_products` (0 rows each) belong to the **Awin
bulk-feed path** — the redundancy supplier. `sync-feeds` is deployed and
deliberately unscheduled because Awin feeds require per-advertiser programme
approval and `commerce_joined_programmes` has zero active rows
(`docs/commerce/sync-feeds-dormant.md`). Filling these tables is **not** the
route to a comprehensive portfolio today; the route is Datafeedr plus the cache.

### 1.3 Coverage: search is wide, suggestion is narrow, browse is absent

- **`garment-search`** (find a product photo) queries the full 44,027-merchant
  pool — measured 93% coverage.
- **`gap-shop-match`** (the Gap Feed's three merchant rows) is restricted to a
  founder-reviewed allowlist of **83 US apparel retailers**
  (`_shared/merchants.ts`, reviewed 2026-08-11, expires 2026-11-11 with a
  `commerce-health` alert on lapse). The allowlist exists because the raw pool
  once returned a wooden coat *stand* for "coat"
  (`docs/decisions/2026-08-11-gap-shop-junk-results.md`).
- **Browse does not exist.** `use-catalogue-search.ts` / `use-catalogue-flow.ts`
  is a query-only funnel. A user who cannot name what they want has no door.
  This is the single largest genuine gap in "everyone can use it".

The slot vocabulary is 10 values mirroring the `item_category` enum
(`src/features/commerce/slot.ts`); **nine have a verified shopping term**
(`gap-shop-match/policy.ts:69`), `other` is deliberately unsearchable. Nine
verified terms × one request each = a seeded, browsable, zero-marginal-cost
category grid inside existing budget.

### 1.4 The privacy sentence that constrains all of it

Three shipped surfaces print that **typed catalogue search is not sent to an AI
model** (`CATALOGUE_DISCLOSURE`, the search sheet, `web/privacy.html`), pinned
by `tests/catalogue-fail-closed.test.ts`, and the search path fails closed if
Datafeedr secrets are absent (`garment-search/catalog-wiring.ts:76-100`).
Anything new must keep typed queries on the non-AI path. Photo-based matching
is a different, already-consented path (§2.2) and is unaffected — but the two
must never be routed through each other.

---

## 2 · The upload seam: suggesting stock photos for the user's own clothes

### 2.1 The upload pipeline as it stands

`src/features/ingest/upload-queue.ts`, concurrency 3: downscale → thumbnail →
on-device background removal (`src/lib/bg-removal.ts`) → three objects to the
`garments` bucket → `items` row insert → client-driven `tag-item` (3 attempts,
visible failure, foreground re-drive via `sweepPendingTags`). Four intake doors
(`intake-routes.ts`): catalogue, camera, library, voice.

Nothing in this pipeline consults the catalogue today.

### 2.2 The match machinery already exists — it is aimed at the wrong moment

`garment-search` action `match` → `matchListing`
(`garment-search/index.ts:1365`): signed URL of the user's
`cutout_path ?? thumb_path ?? image_path` → vision model → brand guesses +
candidate product listings, with an explicit **`lookalike: true`** widening pass
when the brand-scoped search returns nothing. `attach` writes the chosen
product photo to `listing_path` (+ source URL/label/confirmed-at,
`20260808150000_listing_imagery.sql`); `detach` reverses it.

The client half (`src/features/match/use-match.ts`, `match-sheet.tsx`) is
reachable **only from item detail** (`src/app/item/[id].tsx:534`) — a door the
user finds days later, if ever. The feature Nelson described — *"when people
upload clothes, suggest stock images that look like theirs"* — is, mechanically,
moving this trigger to the moment the upload settles, and surfacing the offer
on the surfaces the user is actually looking at right then.

An important existing distinction to preserve: `listing_path` **accompanies**
the user's photo (a clean product shot alongside their own); the catalogue
import path (`import-batch`) *is* the item's photo. The upload suggestion is the
former — the user photographed their real garment; the stock photo is an
upgrade offer, not a replacement of the record.

### 2.3 What does not exist

No embeddings, no pgvector, no image-similarity index anywhere in the schema —
the only similarity machinery is `matchListing`'s vision pass plus rule ranking
(`families.ts`, `relevance.ts`). For launch scale (99 items in production
today) the vision pass is the right tool; building an embedding index now would
be premature infrastructure.

### 2.4 Cost and consent

Each match call is one vision-model call (spend recorded in `ai_calls`, model
from `ai_config` keyed by workload) plus 1–3 Datafeedr requests. Auto-running it
on every upload multiplies both by every photo of a 10-item batch — so the
design must be **offer, then run**: a quiet affordance per settled item, vision
spent only when tapped. This also keeps it clean under the 5.1.2(i) consent
gate that `match` already sits behind.

---

## 3 · GitHub Actions: why CI has been dead since Aug 17

- Repo `nelsonsaenz1/cinch` is **private**, billed to the personal account.
  All three jobs of every run since 2026-08-17 16:24 UTC die in ~2s with
  "recent account payments have failed or your spending limit needs to be
  increased."
- Actions is enabled and unrestricted at the repo level, so it is purely a
  billing state. The pattern (hard mid-cycle cliff after ~25 runs/day × 3 jobs)
  is the classic signature of **included minutes exhausted with a $0 spending
  limit**; an expired card shows the same message (dunning email would be in
  the founder's inbox if so).
- **Fix (founder-only, one page):** github.com/settings/billing → update
  payment info if flagged, else raise the Actions spending limit above $0.
  Afterwards `gh run rerun <latest>` revives CI; failed runs stay re-runnable
  for 30 days.
- Real cost of the outage: `supabase/tests/23_friends_presence.sql` (and the
  rest of `npm run test:db`) has **never executed** — the friends privacy
  predicates were verified only by reading live view definitions, which the
  build ledger records as weaker evidence.

---

## 4 · The scroll flourish: where it belongs and why

Candidate analysis (full detail in the agent survey, summarised):

- **Today** (`src/app/(tabs)/index.tsx`) wins. Its masthead is the app's only
  genuine two-register header — eyebrow (date · place · weather + chips) over
  a 30/32pt serif greeting — rendered inside a plain `ScrollView` with **no
  existing scroll handler**. A collapse (greeting fades/translates, eyebrow
  persists) lands in one component and inherits across every screen state.
- **Closet** is second and riskier: FlashList v2 `ListHeaderComponent` plus a
  search field already deliberately exiled from the header.
- **Explore** has nothing to collapse and already owns a JS `onScroll`.
- Constraints discovered: the masthead's `onTextLayout` rung ladder
  (`index.tsx:436-466`) must not be animated — parallax the greeting block
  only; NativeWind classes do not reach `Animated.*` components (use `style`);
  the repo has **zero** `useAnimatedScrollHandler` usage today, so this
  prototype sets the idiom; Reduce Motion must be hand-gated in the
  `useAnimatedStyle` (neither existing pattern applies automatically —
  `the-ten.tsx:870` warns this is where it gets forgotten); the masthead's
  "96pt cap" exists only as prose and needs encoding as a constant.

---

## 5 · The release rails: what ships how, and in what order

- **OTA now, binary later** (founder decision 2026-08-21). Build 41 (v1.1.0,
  submission 0a229e4b) is delivered to ASC and deliberately **held** — not
  submitted for review — until the next binary's native changes are worth the
  review cycle.
- **ProMotion 120Hz** (`CADisableMinimumFrameDurationOnPhone: true` in
  `app.config.ts` → `ios.infoPlist`) must land **in the same commit sequence
  as the binary cut**: `app.config.ts`'s git blob id is a fingerprint-gate
  input (`tests/fingerprint-gate.test.ts`), so touching it any earlier breaks
  the OTA rail against the fielded build. Gate ids get re-taken at cut time.
  Full instructions: `docs/ops/promotion-build-41.md`.
- **Phone sign-in** is complete, verified end-to-end against the Supabase test
  OTP (2026-08-21), and dark behind `PHONE_SIGN_IN_ENABLED = false`. Twilio
  toll-free verification is in review. The flag flip + welcome door is
  OTA-able the moment approval lands and rides whichever vehicle is next.
- Everything in the action plan except ProMotion is **OTA-shippable** (client
  code + edge functions + additive SQL, no native module changes).
