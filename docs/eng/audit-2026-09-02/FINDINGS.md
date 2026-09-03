# Full-app audit 2026-09-02 — durable findings & state

Orchestrator notes. This file is the only thing that survives context compaction.
Directive: docs/eng/full-audit-prompt.md. Read METHODOLOGY.md + LEDGER.md first.

## State of the world at start (2026-09-02 ~13:00Z)
- HEAD 2042de2 on main, clean tree except untracked docs/eng/.
- Baseline: `npm run typecheck` clean; `npm test` 3761 pass / 1 skipped; `npm run lint` 0 errors 6 warnings
  (index.tsx duplicate import of upload-queue; use-gap-feed useMemo deps; questionnaire.ts unused OccasionOption).
- Store: 1.2.3 build 47, runtime 4e646ba0 (fingerprint.json). Three live runtimes: 4e646ba0 (1.2.3), ccfa8345 (1.2.2), 813c6d34 (1.2.1).
  Side-cut branches for older fleets: ota/ccfa8345-a15a16, ota/813c-a15a16 (see memory cinch-ota-release-rail).
- Release rail: `npm run release:ota -- "msg"` (clean tree, on main, pushed, fingerprint match). Keyed Release sim boot gate before every OTA.
- Edge functions deploy: `supabase functions deploy <name> --use-api` (brew CLI).
- Migrations: apply via Supabase MCP apply_migration with the file's exact statements; never `supabase db push`.

## Founder-only decisions (DO NOT act)
1. The 29/31 gifted trials (A27 executed: end 2026-09-03 14:00Z; notes sent 09-02 14:00Z).
2. Prices/products/plan gating; store-listing copy (promotionalText under test).
3. Irreversible migrations / anything deleting user data — write the down-migration or don't.

## Open ledger rows to fold in
A28 closet cap as write failure (46 row_write_failed after active_full) · A15 row_write_failed Ludlow cause unknown ·
A16 10-min paywall grace suspected wrong · A9 outfit_reactions never read · A24 daily_social 100% empty ·
A19 paywall_impressions incomplete · A20 AASA components · A23 invite prompts · A18 Today before closet ·
A14 push tokens (BINARY) · A8/A12 Superwall campaign config (founder).

## Findings (append as they land; tag severity S1..S4, lane OTA/EDGE/DB/BINARY/CONFIG/FOUNDER)

## Fixes shipped (commit → OTA ids per runtime → verified how)

## Nearly got wrong / what I broke


### F-DATA-1 (S1, OTA) — FOUR fleets have active users, not three; the biggest one missed A15/A16
PostHog, Application Opened, 14d, excluding $app_build='1' (persons / returning persons / last open):
- 813c6d34 (build 45, 1.2.1): 22 / 11 / 09-02
- c5f00773 (builds 43-44, 1.2.0): 21 / 10 / 09-02   ← frozen at OTA 01a049c3 (8/31). NEVER received A15 code instrumentation or A16 grace.
- 18938ff9 (builds 40-41): 11 / 10 / 08-27  ← stale, last open 7 days ago; skip unless it reappears
- ccfa8345 (build 46, 1.2.2): 6 / 2 / 09-01
- 4e646ba0 (build 47, 1.2.3, STORE-CURRENT): 5 / 2 / 09-02
Implication: every OTA fix in this audit must be cut for 4 runtimes: 4e646ba0 (main), ccfa8345 (ota/ccfa8345-a15a16), 813c6d34 (ota/813c-a15a16), c5f00773 (ota/c5f00773-review-prompt + cherry-picks). Verify each via u.expo.dev manifest fetch AND wait for a production Application Opened carrying the new update_id.
Also: many persons run the EMBEDDED bundle (update_id not 01a0…) = first-launch-only installs; not an OTA failure. update_failed (51 ev) is 50/51 build '1' dev harness.

### F-DATA-2 — import failures: zero since the code OTA; Chicago 46 (build 47) + Ludlow 20 (build 46) both have code=null
Prior reasons: quota_exhausted (17, 8/20-8/26), consent_missing (31, 8/20-21). So row_write_failed is only 2 persons ever. A15's discriminator still has no data.

### F-DATA-3 — subscriptions now: 50 rows; free 47 (31 trialing), pro 2 (1 trialing), standard 1. 29 trials end 2026-09-03 14:00Z (A27, founder's — do not touch).

### F-DATA-4 — Supabase advisors: 12 ERROR security_definer_view (public_* / friend_* / social_profiles / event_* views) — likely deliberate public-boundary design (check migration 20260804200000 + 20260805213000 comments before "fixing"); 25 WARN SECURITY DEFINER fns exec by authenticated; 2 anon-exec (invite_card, join_waitlist — intentional); 1 mutable search_path: current_social_terms_version; leaked-password protection off (no password auth in app → moot). Perf: 24 unindexed FKs, closet_likes no PK, daily_social_reactions duplicate permissive SELECT policies.

### F-DATA-5 — declared-vs-fired: fired list saved in posthog-fired-events-60d.txt (analytics agent will diff). Notables: closet_filter 3 ever; daily_social_opened 25 = daily_social_empty 25 (100%); paywall_eligible 3; outfit_reacted 49/8 people; $exception 2 (no crash capture — check docs/ops/crash-reporting.md).

### F-DATA-6 (FOUNDER) — Daily Social 100% empty = the social graph is empty, not a bug
PostHog 30d: every daily_social_empty is reason=nobody_sharing (S-1b), 4 people/25 events. DB: profiles with worn_outfits_shared_since set = 1 of 50; follows = 6 rows / 5 people; outfit_calendar = 2 rows; daily_social_reactions = 0.
S-1b already renders a hero with a "go first" action (Explore tab also carries the additions timeline + shop shelves, so the tab is not blank). The only lever that changes the number is the sharing DEFAULT (privacy constitution: OFF by default) → founder decision. Recommend: keep the surface, stop counting daily_social_empty/nobody_sharing as a defect; A24 → founder ruling on default-on or hide the Day section until ≥1 friend shares (already effectively the case: it shows S-1b hero).

### F-DATA-7 (OTA/web, low) — A20 AASA: emails link to apps.apple.com, not cinchstyle.com/{open,closet,membership}; no consumer exists yet. AASA covers only /i/*. Adding components is cheap but pointless until an email uses them → defer, note in report.

### Agent reports landed: controls.md (clean), analytics.md
- F-AN-1 (S2, OTA): explore_shop_feed_loaded fires inside a react-query queryFn (use-shop-feed.ts:61, use-partner-feed.ts:48) ungated by useTabVisited → fires on launch for every entitled user + on every refetch. FIX: gate on visited / fire from effect once per visit. Extend tests/tab-visit-gating.test.ts.
- F-AN-2 (S3, OTA): 8 dead declared events: context_opened, context_set, chat_error, local_fact_answered, saved_plan_started, saved_plan_missing_action, stylist_question_answered, stylist_questionnaire_completed. FIX: delete declarations + dead prop builders (or wire chat_error — check stylist error path).
- F-AN-3 (S3, OTA): plan.tsx tab has zero events; outfit_planned mutation has no failure event. FIX: add plan_opened (focus-gated) + outfit_plan_failed.
- Controls: 391 Pressables, 0 dead. Two SUSPECT: explore.tsx:483 context-menu if-chain non-exhaustive; CommentComposer double-submit relies on setDraft('') only, `disabled` never wired by callers.

### routes.md landed
- F-RT-1 (S3, OTA): repeat-outfit.tsx ~213-235 no back/exit in empty/loading states (stale deep link strands). Also orphaned (only reachable by hand / future push tap). No push tap handler exists anywhere (A14 binary lane).
- F-RT-2 (S3, OTA): walkthrough/ceiling.tsx:112,192 no exit affordance either phase; resolveIntakeCeiling failure (79-87) has no error UI. Voice intake is behind CINCH_VOICE_INTAKE; still reachable? check before fixing.
- Clean: no dangling targets (typed routes), no duplicate routes, dev-fixtures disconnected (tested), AASA matches real web routes.

### a28-a15-import-failures.md, lifecycle-races.md, edge-functions.md, performance.md landed
- F-A28 (S1, OTA ×4 fleets): BOTH row_write_failed clusters are the closet cap (Ludlow had 11 completions before failing; his stream shows full→delete→room→1 completion→full). capture.tsx:491 gates a batch of N on capacity.full (a boolean). Each refusal = 3 attempts × Vision pass (cutout_result 148 = 46×3+10). stage='cutout' on all 66 events is stale-stage (insert never sets a stage). VERIFIED by me in PostHog 09-03: both paywalls preceded by closet_plans_door_opened ~0.6s (human tap).
- F-A16 (S1, OTA ×4): A16 grace suppresses a paywall the user TAPPED for (every AddGarmentOverLimit presentation in src is a tap: closet door, capture sheet, the-ten, storage, gap-feed, garment-search sheet). Also per-process not per-user. DECISION: revert A16 (delete import-failure-grace.ts + use-gate check); say so in report + ledger.
- F-LC-1 (S1, OTA): getUserId() unbounded inside drainQueue (upload-queue ~769/1067/1208) — a hung getClaims() leaves running>0 & draining=true → drain spins forever, no future drain. withDeadline exists in closet/session.ts.
- F-LC-2 (S2, OTA): capture.tsx "See plans" presents Superwall while ClosetFullSheet <Modal> is up → iOS refuses → 8s no_response. Hide sheet first, present after dismiss.
- F-LC-3 (S2): onGranted commits held photos into a still-full closet (webhook not landed; non-gated paywall grants on dismiss). With queue-level held-on-refusal this degrades gracefully; keep.
- F-LC-4 (S2): refetchOnWindowFocus false + no focusManager → plan never refreshes on focus; three docblocks claim it does. After 09-03 14:00Z a running session keeps trialing:true until a new usePlan observer mounts. FIX: wire focusManager to AppState (standard RN pattern) — but check the cost: every query refetches on foreground. Alternative: invalidate ['subscription'] on foreground only. Choose the narrow one.
- F-LC-5 (S2): client trial fold outranks paid (use-plan.ts:141) vs server (20260901000000:104-115). Self-expires 09-03 14:00Z. Fix the fold to match server (paid > trial).
- F-LC-6 (S2): superwall.tsx:87 failed identify() latched; use-alias-reconcile.ts:75 marker written on reconciled:false → a later purchase never claimed. Check superwall_unreconciled.
- F-LC-7 (S3): provider-order test only pins AnalyticsProperties; UpdateCoordinator sits above <Superwall> — strengthen test.
- F-EF-1: packing-brief function dead (client uses on-device memo) → delete function + deploy removal? (leave deployed, remove source? keep — low value). pinterest.ts no timeouts (fail-closed feature, pending). delete-account client discards structured failure. deno.lock drift. commerce-health non-constant-time secret compare (cron-only, low).
- F-PF: see perf-note.txt. Worth shipping: wears-well-with.tsx + ten-parts.tsx stableImageSource; item/[id].tsx 4s whole-closet invalidation → scoped; Stage C cap in generate.ts (needs styling agent's verdict first).
- F-ST-1 (S1, OTA): repeat.ts:58 possibleCores still requires shoes (countOutfits stopped 09-01, commit 150a7a5) → 12/25 live closets have no shoes; Repeat exhausted state unreachable; docblock says "never diverge".
- F-ST-2 (S1, OTA): generate.ts:96,139 allowsMidLayer (target>=6°C) gates KNIT-ANCHORED CORES; above 24.6°C knits stop being tops while kindOfSlot counts them → 13/25 closets lose outfits; a 5-jumper closet gets 0 at 32°C with copy telling them to buy shoes they own.
- F-ST-3 (S2, OTA): garment.ts:119 pattern_scale ?? infer never re-checks pattern → solid+small reads "solid as the focal point" (4 live rows).
- F-ST-4 (S3 perf): topBy recomputes scoreOutfit per comparison (178k calls vs 10k) — 186ms × 21 passes on Plan; useWardrobe no ORDER BY → row order is tiebreak (nondeterministic third card).
- F-A9: reactions reach ranking only via style_profiles.weights (taste), never "not this outfit". Design: applyReactionMemory keyed on coreIdsOf, ±0.06, 45-day half-life, no migration (index outfit_reactions_user_created_idx exists).
- F-SR: activity/reaction/[id].tsx:107 + activity/invitation/[id].tsx:113 never check isError → failed fetch renders "No longer available". explore.tsx:513 daily block gated on hasFriends not dailyLoading (blank flash). generate-outfits 403 consent branch unreachable client-side. delete.tsx:53 shows supabase-js generic string.
- F-DB-1 (CRITICAL?, EDGE): isStale (_shared/superwall-plan.ts:96-102) applied to REVOKING events (superwall-webhook:314, asc-notifications:307) — an expiration carrying the same expirationAt as the stored renewal → stale → no write → churned user keeps plan forever. effective_plan never reads current_period_end; no cron. MUST VERIFY: query superwall_events outcome by event_type; read the code myself.
- F-DB-2 (HIGH, DB): 20260819000000:82-83 grants INSERT/UPDATE/DELETE on ai_calls + ai_usage_counters to authenticated with NO write policy (RLS denies, so no exploit) — same shape fixed for subscriptions in 20260826010000. Revoke migration (reversible: re-grant).
- F-DB-3 (HIGH, DB): commit_intake_session re-raises on storage_limit_reached (20260811022953:93-99) aborting the whole voice commit. apply_outfit_reaction no dedupe key → retry double-inserts. items limit trigger is count-then-insert with no lock (TOCTOU; parallel queue MAX_CONCURRENCY=3 can overshoot cap by 2).
- F-DB-4 (MED): invite_card/apply_invite compare p.username = lower(...) → capitalised handles have dead invite links. delete-account doesn't walk the exports bucket. Friend-search ILIKE 'q%' unindexed. use-plan.ts:141 trial fold → pro vs server (self-expires 09-03 14:00Z but fix anyway).

## Fix batch 1 written (uncommitted, 2026-09-03 ~02:30Z) — all green: tsc, 3779 tests, lint 0 errors
Files: see git status. Verification agent launched (docs/eng/audit-2026-09-02/verification.md).
Pending after verification: apply migrations 20260903000000 (effective_plan) + 20260903000100 (revoke ai_* grants) via MCP; deploy superwall-webhook + asc-notifications (--use-api); commit; push; boot gate; OTA to 4 fleets (main=4e646ba0; side-cuts ota/ccfa8345-a15a16, ota/813c-a15a16, ota/c5f00773-review-prompt + cherry-pick); manifest-verify each; ledger + briefing + memory notes; final report.
- 2026-09-03 01:20Z: keyed Release sim boot gate PASSED on the batch-1 + A9 tree (build in scratchpad/boot-gate; bundle carries pk_ key + holdQueuedJobs). Rendered Today with the keyed membership band. A9 reaction memory added (reaction-ranking.ts, use-outfit-reactions.ts, use-outfits.ts) after the verifier started — needs its own falsification pass.
- PEER SESSION WARNING: a nightly-briefing session has uncommitted edits in docs/marketing/cmo-briefings (LEDGER.md, METHODOLOGY.md, new 2026-09-02-nightly.md). Do NOT commit or stash those as mine without checking mtimes; release:ota needs a clean tree → use `git stash push -- docs/marketing` only if the files are quiescent, pop immediately after.
- 2026-09-03 ~02:05Z: verifier-1 (verification.md) found 6 CONFIRMED defects in batch 1 (livelock in hold/release; all-held batch rendered as done; total-wall ignored; 'unavailable' outcome stranded the sheet + timer leak; isStale tie made REFUND_REVERSED a one-way door; use-plan mirror gaps). ALL FIXED. Verifier-2 launched on the repairs + A9.
- Migrations APPLIED to production via MCP: effective_plan_honours_period_end, revoke_quota_ledger_writes, revoke_truncate_from_clients (NEW finding: authenticated held TRUNCATE/TRIGGER/REFERENCES on 19 tables — RLS does not govern TRUNCATE; revoked; pgTAP 20_grant_matrix.sql plan 15→17).
- Boot gate re-run on the repaired tree: PASSED (Today, Explore w/ shelves, Plan all render on keyed Release sim build). Shop feed shows "Catalog name unavailable" on two cards — shabby copy, note only.
- 2026-09-03 ~02:50Z: verifier-2 (verification-2.md) found V2-1 identity loop (heldCapture rewritten each run), V2-2 partial storm, V2-3 favourites erased by second re-sort, V2-4 ISO-format string compare made tie unreachable + plan changes dropped, V2-5 partial wall, V2-6 subline, V2-7 deleted-item re-key, V2-8 lapsed-paid trial lift. ALL FIXED: hold rewritten only on accept>0; one combined sort (reactions + favourites); Date.parse compare + plan-aware tie; partial carries wall; "N waiting for room" subline; unknown-id rows skipped; migration 20260903000300 applied. Tests 3795 pass. Verifier-3 + boot-gate build #3 running.

## SHIPPED 2026-09-03 03:2xZ
Commit 200388c (audit) + 498acce (peer's nightly briefing, committed on its behalf). Edge functions superwall-webhook + asc-notifications deployed. Migrations applied (4). OTAs: 4e646ba0→01a06505 · c5f00773→01a06507 · 813c6d34→01a06508 · ccfa8345→01a0650a, all manifest-verified. Device receipt pending (no Application Opened with these ids yet).
Verifier-3 residuals accepted/documented: V3-4 (a stored accessory discards that thumbs-down — safe direction), V3-6 masthead taste, V3-7 stale remedy on an accept-0 verdict (sheet visibility only).

## Phase 2 — founder follow-ups (2026-09-03 02:30–04:20Z)
- Sharing ON by default: migration 20260903010000 applied 02:44:37Z (50/50 profiles now sharing; 49 backfilled). Copy updated (Explore S-1a/S-1b).
- packing-brief function DELETED (prod + source); packing's Pro lock is client-only now (documented in use-packing-access.ts/placements.ts). Pinterest calls bounded 10s (deployed pinterest-oauth/pinterest-api). delete-account client surfaces structured failure. topBy decorate-sort; Stage C capped at 6 layerings per core. Commit bb53d4d + bed2c47, pushed. NOT YET OTA'd (waiting to bundle with the UX directive work).
- Device receipt of the 03:2xZ OTAs: none yet at 04:20Z (US night). Keep polling: Application Opened with update_id in (01a06505, 01a06507, 01a06508, 01a0650a).
- UX directive (69 findings): fan-out launched 04:15Z — 7 implementation agents in worktrees: A membership truth (49/21/50/20), B Explore commerce (16/17/18/19), C AX5 reflow (35/36/37/9/47), D1 copy privacy/account/support (23/24/25/51/53/54/55/43/44/22/41), D2 social copy/layout (26/27/28/29/31/32/57/58/60/61/63/56), E loading/error contract (59/30/52/38/64/62-social), F core tab hierarchy (2/5/6/7/8/10/11/12/13/15/42/45/46/48/62-core), G first-run (39/33/34/40). P0 #1 images: diagnosis agent running (p0-images.md). Marketing items 65-69: founder/assets — surface only.
- Merge plan: merge worktree branches into main one at a time (A, B, E, G, D1, D2, C, F — smallest/least-overlapping first), resolve conflicts, verifier pass, boot gate, OTA ×4.
- P0 #1 (images absent) DIAGNOSED (p0-images.md): QA-fixture defect — simtestf31 ("fay") and sim-test+j00 ("journey") item rows point at sim-test's storage prefix → signing refused by the owner-folder policy → every tile blank. Real users unaffected (0 cross-prefix rows outside those two). Real residue: closet.tsx:864/:909 and packing-trip.tsx:946 drop thumbPath from the resolve chain (43 thumb-only live items, 6 users) → sent to agent F. QA DATA TASK (needs service-role key, not available here): copy garments/195a2399-…/<item>/* to garments/aa6359d8-…/ and 4b827726-…/ or re-seed those closets. Adding a count-only image_sign_failed metric so a signing outage is a number, not a screenshot.
- Merged so far (main, pushed): D1 4958b5b (disclosure primitive, 11 screens), G b7f5a8b (welcome line = positioning-contract Activation line; camera ask before system prompt; quiz progress zone), B 3bdc7e6 (fashion gate client+server — garment-search DEPLOYED; no placeholder titles; 6-card shelf below circle + /shop route; S-1a one CTA), C cb1af92 (AX reflow: Compose footer measured; Today card inline at AX; closet chips wrap; stylist input capped; ErrorState scrolls; explore doors stack; compact nav titles). One conflict (pinterest.tsx) resolved by hand. Founder/taste items flagged by agents: C-03 forbids the chip-rail fade (#9 answered at AX only); Storage box back button kept; Compose tray button removed (showAction prop); Explore doors row hidden while circle empty (Invite lives in the ellipsis sheet).
- Merged A a6c79ca (membership-surface resolver; thanks gated on real purchase; profile example hidden), D2 60de8eb (social copy/layout; board grid bug fixed), F 65848bb (Today membership row in flow after the carousel; closet capacity band to footer w/ useCapacityStateReport; stylist door regimes + lock at top; weather line; GarmentSwatch fallback everywhere; reveal rebalance; review/item/wall-swap; thumbPath residue). 4 conflicts C↔F resolved by hand. Lint 0/0. Tests 3853. UX verifier (verification-ux.md) + boot-gate build #4 running. E (loading contract) pending.
- Device receipt of 03:2xZ OTAs: still none at 06:0xZ.
- Merged E 18b259f (bounded-load contract, RouteState, 18 routes, GarmentFallback on social surfaces; three real traps fixed: blank Skeleton in walkthrough review/ceiling, shimmering deleted saved look, repeat-outfit no error branch). ALL SEVEN CLUSTERS MERGED. Tests 3871, lint clean. Next: UX verifier report → repairs → final boot gate → OTA ×4 → ledger/memory/report.
- UX verifier (verification-ux.md): 40 findings, 11 S1. Repaired in 02e5f59 + 6ea8eb8: membership `owned`/`paid` on all six surfaces; ErrorState flexGrow (no clip); RouteState default error copy; bounded-load `fetching` (retry bounded, no cancel); board/saved gates; swatch label pill; consent record open; Ten library-cancel → ask; fashion gate rewrite both sides (garment-noun-wins, plural-aware, NFKD, head-noun veto, +26 nouns; garment-search REDEPLOYED). Tests 3871, lint 0. verification-ux-2 + boot-gate build #5 running.
- NOTE: a chained `&&` with grep subshells let a red commit (02e5f59, bad test import) through; fixed in 6ea8eb8. Commit only on a real exit code next time.
- 44f4745: isFetching threaded into 13/18 bounded-load sites. 43c2f9a: head-noun-must-be-garment rule on both gates (live shoe-rack-as-"Shoes" on the boot-gate build); garment-search redeployed (3rd deploy tonight). Boot gate on build #5 (6ea8eb8): Today/Explore render; Explore now one CTA + compact shelf. verification-ux-2 running; final build + OTA after it.
