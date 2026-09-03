# States and Refusals Audit — 2026-09-02

Scope: `supabase/migrations/*.sql` (112 files), `supabase/functions/*` (25 functions), `src/app/**` (86 screens), `src/features/**`, `src/lib/query-client.ts`. Read-only audit; no files under `src/`, `supabase/`, `tests/`, or `scripts/` were modified.

Calibration incidents:
- **Incident A ("46 in 44s")**: a free-tier user over the 10-item closet cap got 46 consecutive generic "couldn't add your clothes" errors in 44 seconds, then a paywall 10 seconds later. She lost the garments she picked and never came back.
- **Incident B ("Daily Social empty")**: Daily Social opened to an empty screen 100% of the time (10 opens, 10 empties), no error event.

---

## Top 20 findings

1. **Root cause of Incident A, fully traced and still live.** `src/app/capture.tsx:488-498` (`settleCapture`) gates an entire multi-photo batch on the boolean `capacity.full`, never on `assets.length` vs. `capacity.remaining` (`src/features/billing/use-capacity.ts:92-105`). A user with N slots left who multi-selects up to `SELECTION_LIMIT = 60` photos (`src/features/ingest/use-capture.ts:41`) gets the **whole batch** enqueued. Every over-cap photo's insert trips `enforce_item_limit`'s `closet_limit_reached`/`check_violation` (`supabase/migrations/20260808190100_active_and_stored_limits.sql:78`).
2. **The retry loop treats a permanent refusal exactly like a network blip.** `drainQueue`'s catch block (`src/features/ingest/upload-queue.ts:905-935`) never inspects `message`/`error.code` before deciding to requeue — it blindly retries any thrown error up to `MAX_ATTEMPTS = 3` (`upload-queue.ts:63`), with **no backoff**, and nothing stops the rest of the batch. Math: `(B − remaining) × 3` attempts ≈ 45-48 for a 15-16-photo overshoot, consistent with "46 in 44s" (`upload-queue.ts:62-63, 902`, re-running `prepareForUpload`/`runCutout` on every attempt).
3. **The generic fallthrough that hides the real cause.** `userFacingFailure()` (`upload-queue.ts:115-134`) has branches only for consent-withdrawn and unreadable-photo; `closet_limit_reached`/`storage_limit_reached` match neither and fall to **`'That upload didn't finish.'`** (`upload-queue.ts:133`) — the same string shown for five unrelated causes (cap, network, signed-URL failure, row-write failure, storage timeout).
4. **The exact classifier that would fix #3 already exists and is simply not wired in.** `classifyDenial()` (`src/features/billing/use-gate.ts:57`) matches `message.includes('closet_limit_reached')` — used only by `(tabs)/index.tsx` and `stylist/use-chat.ts`, never by `upload-queue.ts`. The sibling "describe a garment" import path does this correctly (`src/features/ingest/use-garment-search.ts:449-453`, dedicated `ClosetFullPanel`).
5. **"Try again" re-triggers the same wall.** Exhausted jobs are marked `retryable: true` unconditionally (`upload-queue.ts:925`), so the failure banner's "Try again" (`capture.tsx:1062-1070`, `canRetry` at `:828`) re-queues every doomed over-cap job into `enforce_item_limit` a second time.
6. **The server already knows how to do this right — twice — and the client photo path is the exception.** `commit_intake_session` (voice-intake batch, `supabase/migrations/20260810140200_intake_commit.sql:154-171`) catches `check_violation`, matches `'closet_limit_reached%'`, sets a `v_ceiling` flag and marks every remaining draft `held` without another insert attempt. The catalogue-import path refuses the **entire batch atomically before downloading anything** via `import_capacity()` preflight (`supabase/migrations/20260813194202_catalogue_imports.sql:140-178`) and `planCatalogueBatch()`/`refuse()` (`supabase/functions/garment-search/import-batch.ts:108-128`). Only the ordinary camera/library pipeline lacks this.
7. **This is a recurrence of a documented, only-partially-fixed prior incident.** `src/features/billing/import-failure-grace.ts:5-21` (CMO ledger A16) records "a production user spent fourteen hours failing to add clothes... twenty times," followed two minutes later by the `add_garment_over_limit` paywall. The shipped fix (`IMPORT_FAILURE_GRACE_MS = 10 * 60 * 1000`) only **suppresses the paywall** for 10 minutes after a terminal failure — its own comment says so explicitly ("The server's refusal is untouched... suppressing the paywall changes what is SHOWN at the refusal, never whether the refusal happens," `:19-21`). The retry storm and generic message are unfixed.
8. **Incident B is a real product cold-start gap, not a code defect, but the codebase itself flags the boundary condition as unfixed.** `worn_outfits_shared_since` is `null` (sharing off) by default for every profile (`supabase/migrations/20260817000000_daily_social.sql:40,102`); `friend_worn_outfits` only returns rows for friends who have explicitly opted in. `nobody_sharing` (S-1b) is therefore the default state for nearly every user with a circle, and `no_circle` (S-1a) is default for everyone else. Both states are correctly designed with distinct copy and a CTA (`src/components/daily-social/state-screens.tsx`, `explore.tsx:707-723`) — this is **not** a blank screen today, but the near-universal emptiness described in the incident is exactly what an opt-in-cascade with no adoption nudge produces.
9. **A live analog of Incident B's exact shape does exist, one hop from Daily Social.** `src/app/activity/reaction/[id].tsx:107` and `src/app/activity/invitation/[id].tsx:113-114` compute `revoked = !loading && (!event.data || ...)` **without ever checking `event.isError`**. A failed fetch (network, RLS, timeout) renders the same "No longer available" / "This reaction was taken back. There's nothing left to open." dead-end (`src/features/activity-center/copy.ts:246,254-255`) as a genuinely-gone reaction — Dismiss only, no retry, no error event, false certainty. Directly verified.
10. **`explore.tsx`'s Daily Social section renders `null` (not even a skeleton) for a beat.** `showsDaily = hasFriends` (`explore.tsx:299,344`) is derived from `friends.data`, which is `undefined` while `friends.isLoading` — so `dailySection` (`:513`) is `null` during that window even though `dailyLoading` (which includes `friends.isLoading`) is simultaneously true. Self-resolving, but the same "opens to nothing" shape as the incident, on the exact same screen.
11. **`generate-outfits`'s 403 consent refusal is structurally unreachable client-side.** `supabase/functions/generate-outfits/index.ts:130-133` returns 403 `ai_consent_required`, but `supabase.functions.invoke()` never populates `data` on a non-2xx — it throws instead — so `use-outfits.ts`'s `ai.data?.error === 'ai_consent_required'` check can never fire; the explicit pull-to-refresh path falls to a generic `'offline'` state (`src/app/(tabs)/index.tsx:1506`) because `classifyDenial` only recognizes 402/429, not 403.
12. **`delete-account` shows a supabase-js internal string, not the server's reason.** `src/features/auth/use-delete-account.ts:18-24` throws the raw `FunctionsHttpError`, whose `.message` is hard-coded by `@supabase/functions-js` to the literal `"Edge Function returned a non-2xx status code"` (confirmed in `node_modules/@supabase/functions-js/dist/module/types.js:69`) — never the JSON body. Rendered verbatim in `src/app/privacy/delete.tsx:53-55` to a user trying to delete their account.
13. **`apply_invite`'s "you need to be signed in" (SQLSTATE `28000`) is a generic, actively misleading fallthrough.** `src/features/invite/mutations.ts:51-54` throws `error.message` with no code inspection; `src/components/invite/arrival-page.tsx:65-66` renders **"Couldn't finish the invite" / "...this device just couldn't reach Cinch... your account [is] fine"** — which is false if the real cause is the signed-out refusal.
14. **React Query itself is not a retry-storm source anywhere in the app.** `src/lib/query-client.ts:19-30` sets `retry: 2` only under `defaultOptions.queries`; no `mutations` block exists, so every `useMutation` defaults to 0 retries (TanStack v5 default). Confirmed: only one `useMutation` in the codebase sets `retry` explicitly (`src/features/invite/mutations.ts:87`, `retry: false`). The 46x pattern is entirely `upload-queue.ts`'s hand-rolled loop.
15. **`wear_outfit_tx`/`plan_outfit_tx`/`unwear_outfit_tx` refusals collapse five distinct SQLSTATEs into one `'rejected'` bucket.** `src/features/styling/wear-failure.ts:57`: `['42501','22004','22023','23503','23514'].includes(code)` all map to a single `WearFailureKind`, losing the distinction between "not authenticated," "an outfit needs at least one item," "not your item," and a genuine constraint violation. Lower severity than #3 (single-shot mutation, not a retrying batch), but the same shape of information loss.
16. **`event-outfits/mutations.ts`'s `default` branch is a minor version of the same problem.** `socialErrorMessage()` (`src/features/event-outfits/mutations.ts:30-53`) correctly enumerates `54000/22023/42501/23505/CL001/CL002`, but any errcode outside that set (a genuine network failure, or a future new errcode) reads as **"That didn't go through. Check your connection and try again."** — conflating real connectivity failures with any unclassified server refusal.
17. **Screens: two confirmed "renders nothing on error" spots beyond Daily Social.** `src/app/event/[id]/invite.tsx` has a loading state (`RowSkeleton`, `:347-351`) but no `isError` branch for `friendsQuery`/`rosterQuery`. `src/app/auth-callback.tsx:80-94` shows a spinner with **no timeout** — if `completeSessionFromUrl` hangs rather than errors, there is no escape hatch, and this is the sign-in screen (a hang here blocks the entire app).
18. **`saved-looks/collections/index.tsx` likely has no empty state for a brand-new user.** Has loading/error (`ListSkeleton`/`SavedErrorState`) but no `EmptyState`/`isEmpty` match found in the file — the zero-collections first-run case (universal for a new user) may render a bare list with no "create your first collection" CTA. Flagged for direct confirmation.
19. **Batch write with no per-user-visible progress: `useInviteMembers`** (`src/features/events/mutations.ts:296-360`) uses `Promise.allSettled` — one attempt each, no retry, correct by design, contrasted here as the model other batches (upload-queue.ts) should follow: report per-item outcome, never blindly repeat.
20. **`packing-brief` edge function is dead code client-side.** `supabase/functions/packing-brief/index.ts` still defines 403/402/429/503 refusal paths, but no file under `src/` calls it any more (`src/features/plan/use-packing-brief.ts:9-38` documents the on-device replacement). Its refusal handling is unreachable in production — worth removing alongside the function itself, per the file's own note.

---

# Part 1 — Server refusals → client surfacing

## 1a. Migration refusal catalog

Methodology: `CREATE OR REPLACE FUNCTION` preserves a function's OID, so a trigger created once stays wired to whatever the current function body is. For every refusal-producing function, the **most recently redefining migration** was located and treated as authoritative; earlier definitions of the same function are superseded and not separately listed.

### Table 1 — Explicit `RAISE`-based refusals

| Refusal | Active definition (file:line) | SQLSTATE | Message | Trigger / RPC | Client trigger |
|---|---|---|---|---|---|
| `apply_outfit_reaction` | `20260804202000_reaction_concurrency.sql:54` | `42501` | `not authenticated` | RPC | `src/features/styling/mutations.ts:180` |
| `assert_like_target_is_public` | `20260804200000_public_boundary_tenant_integrity_and_commands.sql:258,266` | `42501` | `that item is not public` / `that outfit is not public` | trigger on `closet_likes` | **No client write path** — `closet_likes` is never inserted from `src/` in shipped code |
| `assert_inquiry_target` | same file `:299,306` | `42501`/`22023` | `that item is not listed for sale` / `you cannot enquire about your own item` | trigger on `item_inquiries` | **No client write path** — `item_inquiries` never inserted from `src/` |
| `claim_command` | same file `:379` | `42501` | `operation id belongs to another user` | internal, used by the `*_outfit_tx` RPCs | any `wear_outfit_tx`/`plan_outfit_tx`/`unwear_outfit_tx` call |
| `wear_outfit_tx` | `20260816190545_today_ratings_favorites.sql:52-79` | `42501`/`22004`/`22003`/`42501`/`42501` | not authenticated / operation id required / outfit needs ≥1 item / rating 1-5 / items not yours / plate not yours | RPC via `src/lib/commands.ts:32` | `src/features/diary/mutations.ts:64`, `src/features/styling/mutations.ts:333`, `src/features/share-look/mutations.ts:88`, `src/features/styling/compose-own.ts:52` |
| `plan_outfit_tx` | `20260804203000_plan_replaces_the_day.sql:51-73` | `42501`/`22004`×2/`22004`/`42501` | not authenticated / operation id / date required / ≥1 item / items not yours | RPC | `src/features/saved-looks/mutations.ts:534`, `src/features/plan/mutations.ts:94` |
| **`enforce_item_limit` — THE INCIDENT** | `20260808190100_active_and_stored_limits.sql:78,84` | `check_violation` (23514) | `closet_limit_reached: % of % garments` / `storage_limit_reached: % of % stored` | trigger `items_enforce_limit`, `before insert on items` | `src/features/ingest/upload-queue.ts:798` (main), `:744` (local/no-consent) |
| `enforce_item_limit_on_restore` | same file `:118` | `check_violation` | `closet_limit_reached: % of % garments` | trigger, `before update of is_archived` | `src/features/closet/storage.ts:229-234` |
| `assert_borrow_target` | `20260807100000_social_graph_blocks_borrow.sql:160-178` | `42501`/`22023`/`42501`×2 | not borrowable / you own this / friends-or-co-attendees only / not borrowable | trigger, before insert on `borrow_requests` | `src/features/social-graph/mutations.ts:120` |
| `assert_borrow_transition` | same file `:204-213` | `42501`/`22023`×2 | only status may change / invalid transition | trigger, before update | `src/features/social-graph/mutations.ts:164,188` |
| `assert_member_transition` | `20260807101000_events.sql:162-171` | `42501`/`22023`×2 | only state may change / invalid transition / host may only remove | trigger on `event_members` | `src/features/events/mutations.ts:388,420,440` |
| `assert_post_is_member` | `20260807102000_event_outfits_votes_comments.sql:37` | `42501` | join the event before posting | trigger on `event_outfit_posts` | `src/features/event-outfits/mutations.ts:80` |
| `assert_vote_target` | `20260812120000_close_comments_and_lock_board.sql:152-163` | `42501`/`22023`/`42501`/`CL002` | no such post / can't vote own outfit / join first / board locked | trigger on `event_outfit_votes` | `src/features/event-outfits/mutations.ts:143` |
| `enforce_social_rate_limits` | `20260818000000_private_circles.sql:544-586` | `54000` (all) | `rate_limited: comments/invites/follows/reports/borrow requests` | triggers on `event_comments`, `event_members`, `follows`, `content_reports`, `borrow_requests`, `circle_members` | `event-outfits`, `events`, `social-graph`, `circles` mutation files |
| `enforce_event_limit` | `20260808130000_events_optional_date.sql:50,58` | `check_violation` | `event_limit_reached: % of % upcoming events` | trigger `events_enforce_limit` | `src/features/events/mutations.ts` (create) |
| `assert_clean_ugc` | `20260808100000_ugc_text_filter.sql:118,150` | `23514` | that wording is not allowed here | triggers on `event_comments`, `event_outfit_posts`, `events`, `borrow_requests`, `profiles` | per-surface comment/post/event/borrow/profile mutations |
| `assert_social_terms` | `20260808101000_social_terms_gate.sql:61` | `42501` | `social_terms_required` | triggers on 8 tables (events, event_members, event_outfit_posts/votes, event_comments, borrow_requests, follows, circle_members) | any insert into those tables before terms accepted |
| `unwear_outfit_tx` | `20260810100000_wear_diary_and_boards.sql:246-268` | `42501`/`22004`/`42704`/`22023` | not authenticated / operation id / no such wear / entry older than a day | RPC | `src/features/diary/mutations.ts:135` |
| `profiles_check_time_zone` | `20260810110000_push_local_time.sql:79` | `22023` | `Unknown time zone: %` | trigger on `profiles` | `src/features/push/time-zone.ts:45-46` |
| `request_data_export` | `20260810120400_failed_export_does_not_burn_the_day.sql:29,38` | `28000`/`22023` | you need to be signed in / one export a day | RPC | `src/features/privacy/use-data-export.ts:106` |
| `apply_invite` | `20260810120100_invite_links.sql:93` | `28000` | you need to be signed in | RPC | `src/features/invite/mutations.ts:51` |
| `assert_comment_thread_open` | `20260812120000_close_comments_and_lock_board.sql:111` | `CL001` (custom) | occasion started, thread closed | trigger on `event_comments` | `src/features/event-outfits/mutations.ts:215` |
| `assert_vote_retractable` | same file `:196` | `CL002` | occasion started, board locked | trigger, before delete on `event_outfit_votes` | `src/features/event-outfits/mutations.ts:137-138,177-178` |
| `assert_circle_member_transition` | `20260818000000_private_circles.sql:474-503` | `42501`/`22023`×2/`42501`/`22023` | only state may change / owner can't leave / invalid transition / mutual friend only / owner remove-or-reinvite only | trigger on `circle_members` | `src/features/circles/mutations.ts:397,441,487,534` |
| `enforce_circle_size` | same file `:328` | `check_violation` | `circle_full: % of 12 seats taken` | trigger, before insert/update on `circle_members` | `src/features/circles/mutations.ts:322,366` |
| `assert_activity_event_update` | `20260820000000_activity_center.sql:276` | `42501` | only seen_at/dismissed_at may change | trigger on `activity_events` | never fires — `src/features/activity-center/mutations.ts:82,113,162` already restrict columns correctly |
| `assert_saved_look_immutable` | `20260821000000_saved_looks.sql:307` | `42501` | only note/collection may change | trigger on `saved_looks` | never fires — `src/features/saved-looks/mutations.ts:308,337` already restrict correctly |
| `claim_stylist_chat` (defensive) | `20260824030000_stylist_capacity_held.sql:48` | `P0001` | `p_user_id is required` | RPC, server-only | can't-happen guard; not user-reachable |
| `enforce_event_join_cap` | `20260826000000_event_join_lifetime_cap.sql:97` | `check_violation` | `event_join_limit_reached: % of % lifetime events` | trigger on `event_members` | `src/features/events/mutations.ts:297,347` |

### Table 2 — Caps, quotas, and RPC-returned (non-exception) refusals

| Refusal | Definition | Shape | Trigger / RPC | Client trigger |
|---|---|---|---|---|
| `claim_ai_quota` — real exhaustion | `20260805160000_membership_tiers.sql:189-198` | **not a RAISE** — returns `jsonb {allowed:false, reason:'exhausted'\|'plan_excluded'}` | RPC, `ai_usage_counters` conditional upsert | every AI edge function via `supabase/functions/_shared/quota.ts:103` → mapped to HTTP 402/429/503 (Part 1b) |
| `claim_stylist_chat` — `exhausted` (5 completed/mo) | `20260824030000_stylist_capacity_held.sql:82-91` | soft refusal, `jsonb` | RPC, `stylist_chat_reservations` | `supabase/functions/_shared/stylist-allowance.ts:188` |
| `claim_stylist_chat` — `capacity_held` (slot momentarily reserved) | same file `:93-112` | soft refusal, retryable, `retry_after_seconds` | RPC | `stylist-allowance.ts:190-196`, window mirrored at `:44` (900s) |
| `complete_stylist_chat` — reservation expired | `20260824020000_stylist_allowance_completed_only.sql:106+` | `jsonb {state:'released'}` | RPC | `stylist-allowance.ts:230,238-244` |
| `import_capacity()` — preflight only, never authoritative | `20260813194202_catalogue_imports.sql:140-178` | read-only helper | RPC | `supabase/functions/garment-search/index.ts:1449`, `import-batch.ts:108-128` |
| `catalog_quota` — Datafeedr API budget (operational, not per-user) | `20260811160015_catalog_cache_sweep_and_quota_warning.sql:68` | `RAISE WARNING`, ops-only | RPC | `supabase/functions/_shared/catalog-store.ts:109` |

**Free-tier cap values, for reference**: closet active = 10 / stored total = 30 (`20260808190000_free_closet_is_ten.sql:22`, `20260808190100...:30-40`); events upcoming = 1 (`20260828170000_event_limit_free_one.sql:9-10` — tightened from a prior value); events lifetime join = 3 (`20260826000000...:66`); circle seats = 12 (`20260818000000...:328`); stylist chats = 5/month; social rate limits (comments/invites/follows/reports/borrow) = per-`54000` triggers.

### CHECK / UNIQUE / NOT NULL constraints reachable from client writes (no custom message)

These surface as bare PostgREST errors (23514/23505/23502) with no app-authored text, so any client handling must match `error.code`, not `error.message`:

- **Length/enum CHECKs**: `events.title` (1-80), `events.note` (≤1000), `events.party_size` (1-100), `event_comments.body` (1-1000), `event_outfit_posts.caption` (≤280), `borrow_requests.message` (≤500), `content_reports.reason`/`.details`, board/`outfit_calendar` name (1-60), `circles.name` (1-60), `saved_looks.snap_source_label` (1-120), `trips.place_name` (1-120), `trip_note` (≤2000), `outfits.wear_rating` (1-5, redundant with the RPC's own raise), `intake_drafts.quantity` (1-12).
- **Self-reference CHECKs**: `follows_no_self`, `item_inquiries_no_self`, `user_blocks_no_self`, `borrow_no_self`, `daily_social_reactions_not_self`.
- **UNIQUE constraints**: `profiles_username_key`, `closet_likes_item_key`/`_outfit_key` (dead — no client write path), `event_posts_once`, `one_vote_per_event`, `outfit_calendar_note_only_key`, `saved_looks_once`, `items_user_catalog_external_id_key` (relied on for catalogue-import retry-safety).
- **Composite-PK-as-uniqueness** on client-writable join tables: `follows`, `event_members`, `circle_members`, `event_join_ledger` (service-role-only writer per RLS).

---

## 1b. Edge function non-2xx / in-body-error catalog

Shared helper `supabase/functions/_shared/quota.ts:103-159` (`enforceAiQuota`) is used by 6 functions — `analyze-inspiration`, `generate-outfits`, `packing-brief`, `parse-closet`, `tag-item`, `garment-search`, `stylist-chat`/`transcribe-intake` — and returns:
- **503** (Retry-After) `quota_unavailable` — counter RPC unreachable (fail-closed by design)
- **402** `plan_upgrade_required` — kind not on this plan
- **429** (Retry-After) `ai_quota_exceeded` — period allowance spent

| Function | Status | Code / message | Condition |
|---|---|---|---|
| **stylist-chat** | 500/400/401/403/503 | env missing / bounds / not signed in / `ai_consent_required` / disabled | `index.ts:53,61,74,87,98` |
| | 402/429/503 (quota.ts) | plan/quota family | `index.ts:103-104` |
| | 503/402/503/503/429 | `allowance_unavailable` (plan lookup, ×2) / `plan_upgrade_required` (TOCTOU) / `stylist_capacity_held` / `ai_quota_exceeded` (5 used) | `index.ts:130-206` |
| | **200 (ok:false)** | `{reason:'stylist_offline', error}` — provider failed both attempts | `index.ts:345` |
| | 503/429 | settlement write failed / settlement found exhausted | `index.ts:365-385` |
| **parse-closet** | 500/401/400/503/404/409 | env / unauthenticated / bad_request / session_unavailable / not_found / no_transcript | `index.ts:99-136` |
| | 402/429/503 (quota.ts) | `tagging` kind | `index.ts:200-206` |
| | 502/500 | `parse_failed`/`parse_error` / `drafts_unwritable` | `index.ts:270,396` |
| **tag-item** | 500/400/401/403/404/409 | env / bounds / not signed in / `ai_consent_required` / not found / no image | `index.ts:66-131` |
| | 503/409/503 | claim failed / already tagging / disabled | `index.ts:168-215` |
| | 500/402/429/503 (quota.ts) | image read failed / quota family (`tagging`) | `index.ts:226,237` |
| | **200 (ok:false)** | `{status:'needs_review', error}` — model/validator failed both attempts | `index.ts:396-399` |
| | 500 | `tag_write_failed` | `index.ts:433` |
| **transcribe-intake** | 500/401/400/413 | env / unauthenticated / bad_request / audio too large | `index.ts:59-98` |
| | 503/404 | session_unavailable / not_found | `index.ts:135-136` |
| | 402/429/503 (quota.ts) | `tagging` kind | `index.ts:145` |
| | 404/413/422/500 | `no_audio` / `too_large` / `silent` / `transcript_unwritable` | `index.ts:162-192`, `asr.ts:111-114` |
| | 500/502 | `audio_unreadable` / `transcription_failed` (ASR provider) | `asr.ts:122,232` |
| **pinterest-api** | 401/400×2 | not signed in / malformed JSON / malformed request | `index.ts:111-120` |
| | varies (`failureStatus`) / 503 | `not_connected`/`unauthorized`/`forbidden`/`not_found`/`rate_limited` (bounded) / `provider_down` (unbounded) | `index.ts:139,142` |
| **pinterest-oauth** | 405/401/500/503/500/404 | method / not signed in / could not start / not_configured / could not disconnect / no such route | `index.ts:87-175` |
| **generate-outfits** | 500/400/401/403 | env / bounds / not signed in / `ai_consent_required` (+`requiredVersion`) | `index.ts:90-133` |
| | 503 / 402,429,503 (quota.ts) | disabled / `outfit_generation` kind | `index.ts:143,148-149` |
| **packing-brief** | 403/402/429/503 | consent / plan-excluded / quota family | dead client-side, see Finding #20 |
| **sync-feeds** (cron) | 500/403/500/503 | not_configured / forbidden / awin_not_configured / merchants_unreadable | `index.ts:341-381` |
| **send-push** (cron) | 405/500/401/400/500×2 | method / not_configured / unauthorized / invalid_request / claim/tokens failures | `index.ts:157-368` |
| **commerce-health** (cron) | 503/403/500 | not_configured / forbidden / report_failed | `index.ts:62-80` |
| **asc-notifications** (webhook) | 405/400/401/400/401/400/500/500 | method / malformed body / invalid signature / missing fields / invalid tx signature / wrong bundle / forward failed / ledger unavailable | `index.ts:180-354` |
| **superwall-webhook** (webhook) | 405/401/400/400/500/422/500/500 | method / invalid signature / malformed JSON / missing fields / ledger unavailable / unknown product / read/write failed | `index.ts:132-351` |
| **superwall-reconcile** | 405/401/400/400/500×3 | method / not signed in / malformed body / not a Superwall alias / check/apply failures | `index.ts:47-167` |
| **delete-account** | 405/401/500×4 | method / not signed in / row/storage deletion failures | `index.ts:126-254` |
| **build-export** | 405/401/400/500/404/409/500 | method / unauthorized / invalid_request / lookup_failed / not_found / not_ready / sign_failed | `index.ts:122-270` |
| **gap-shop-match** | 400×2/401 | invalid_request / not_signed_in | `index.ts:77-92` |
| **garment-search** | 403×3 | consent / policy / `source_declined` | `index.ts:222,360,1139` |
| | 402 / 402,429,503 (quota.ts ×3) | plan refusal / `garment_search` kind | `index.ts:1459`, `:492,884,1691` |
| **analyze-inspiration** | 500/400/401/403×2 | insert failure / bounds / not signed in / not your photo / consent | `index.ts:59-103` |
| | 503×2/404 | disabled / no vision model / could not read photo | `index.ts:128-140` |
| | 402,429,503 (quota.ts) / 502 | `inspiration` kind / model failure | `index.ts:144,214` |
| **reap-intake-audio** (cron) | 405/500/403/500×2 | method / not_configured / forbidden / lookup/remove failed | `index.ts:46-86` |

**Plus, outside `supabase/functions/`**: `items_enforce_limit` (Table 1) raises directly to `supabase.from('items').insert(...)` — not routed through any edge function, which is exactly why it was missed by the edge-function-shaped error handling elsewhere in the app.

**200-with-error-body pattern**: `tag-item` and `stylist-chat` both deliberately answer failures with HTTP 200 (`{ok:false, ...}`) so a resolved promise never implies success. Both callers get this right (`upload-queue.ts:239-243`, `use-chat.ts:344`), but it is a footgun for any future caller who trusts `await invoke(...)` resolving.

---

## 1c/1d. Client detection classification and error-copy inventory

Classification key: **(i) pre-check** — prevented before attempting; **(ii) detect-specific** — caught, classified by code, specific message/action; **(iii) generic fallthrough** — reaches an undifferentiated catch, generic string.

### (iii) Generic fallthrough — confirmed findings

| Refusal | Client site | Evidence |
|---|---|---|
| **`closet_limit_reached`/`storage_limit_reached` via photo-capture batch** | `src/features/ingest/upload-queue.ts:115-134` (`userFacingFailure`), `:905-935` (`drainQueue` catch) | THE INCIDENT. No branch for the cap; falls to `'That upload didn't finish.'`; `analyticsFailureReason()` (`:155-174`) buckets it as generic `'row_write_failed'`, no distinct capacity reason. `classifyDenial` (`use-gate.ts:57`) recognizes the exact string and is never called here. |
| **`apply_invite` "not signed in" (28000)** | `src/features/invite/mutations.ts:51-54` | No `error.code`/`.message` inspection; `arrival-page.tsx:65-66` shows copy that explicitly (and, for this cause, falsely) denies an account problem. |
| **`generate-outfits` 403 `ai_consent_required`** | `src/features/styling/use-outfits.ts` / `src/app/(tabs)/index.tsx:1506` | Structurally unreachable — `invoke()` never populates `data` on non-2xx, so the `data?.error==='ai_consent_required'` check is dead code; falls to generic `'offline'`. |
| **`delete-account` any non-2xx** | `src/features/auth/use-delete-account.ts:18-24`, rendered `src/app/privacy/delete.tsx:53-55` | Shows supabase-js's hard-coded `"Edge Function returned a non-2xx status code"`, never the JSON body's real reason. |
| **`wear_outfit_tx`/`plan_outfit_tx`/`unwear_outfit_tx` — 5 SQLSTATEs → 1 bucket** | `src/features/styling/wear-failure.ts:57` (`classifyWearFailure`) | `42501/22004/22023/23503/23514` all collapse to `'rejected'`. Lower severity: single-shot mutation, no retry storm. |
| **`event-outfits/mutations.ts` `default` branch** | `src/features/event-outfits/mutations.ts:51` (`socialErrorMessage`) | Any errcode outside `{54000,22023,42501,23505,CL001,CL002}` reads as "check your connection" — conflates real network failure with any unenumerated server refusal. Minor. |
| **Bulk closet remove/recategorise** | `src/app/features/closet` → `src/features/closet/use-closet-screen.ts:325-331,369-373` | Raw `err.message` (Postgres/Storage) shown verbatim via `Alert.alert` — not masked, but unpredictable copy quality, inconsistent with the rest of the app's translated-copy discipline. |

### (ii) Detect-specific — exemplary patterns (for contrast)

| Area | File | Pattern |
|---|---|---|
| Stylist chat | `src/features/stylist/use-chat.ts:561-688`, `read503`/`isAllowanceUnavailable`/`isCapacityHeld` `:105-147` | Consent, timeout, `classifyDenial` (plan/quota), 3 distinct 503 sub-codes each with own copy; `retryable = !consent && !denial`; paywall opens **only** on an actual denial. **Best-engineered refusal path in the codebase.** |
| Closet cap via "describe a garment" | `src/features/ingest/use-garment-search.ts:449-453,78` | `.includes('closet_limit_reached')` → `GarmentSearchError('closet_limit_reached', 'Your closet is full on this plan.')` → dedicated `ClosetFullPanel` |
| Item re-tag | `src/features/closet/mutations.ts:424-451` (`refusalMessage`) | Full per-HTTP-status copy (403/401/402/429/409/404/503) + optimistic-write rollback |
| Item write-loss detection | `src/features/closet/item-write.ts:89-115` | Receipt pattern: a 0-row RLS-scoped `UPDATE...RETURNING` is explicitly treated as failure, not silent success — built after a real data-loss incident |
| Events | `src/features/events/mutations.ts:46-66` (`classifySocialDenial`/`socialDenialCopy`) | `54000`→rate-limited, message-substring→hosting/join cap, each opens its specific paywall placement |
| Boards/comments | `src/features/event-outfits/mutations.ts:30-53` (`socialErrorMessage`) | Full switch on 6 errcodes incl. custom `CL001`/`CL002`; bounded 1-retry on `23505` vote race |
| Circles | `src/features/circles/errors.ts:42-86` | Exhaustive discriminated union (`group_full`/`not_mutual`/`terms_required`/`stale`/`rate_limited`/`blocked_text`/`invalid_name`/`unknown`); matches `circle_full` message AND hint for stability |
| Wear/outfit session failures | `src/features/styling/wear-failure.ts:35-42` (`classifyWearSessionFailure`) | Distinguishes a bounded auth timeout from genuine offline |
| Pinterest | `src/features/recreate/pinterest.ts:74-91,156-176` | Bounded `PinterestFailure` union, 503→`not_configured` |
| Data export | `src/features/privacy/use-data-export.ts:148-178` | Explicitly reads `error.context`, re-throws the body's real sentence |

### (i) Pre-check — present but flawed for the incident

`src/features/billing/use-capacity.ts:58-106` (`useCapacity`) is a correct, well-documented pre-flight primitive exposing `used`/`limit`/`remaining`/`full`/`stored`/`storedLimit`/`storageFull` — explicitly self-described as "a display and pre-flight helper, never a control." **Every caller reads only the boolean `full`**; none compares a batch size to `remaining`. This is the root mechanical cause of Finding #1. Event hosting/join caps have **no** pre-check at all (purely reactive) — acceptable there only because those are single-shot mutations, not a retrying batch.

### User-facing string inventory (highest-conflation strings)

| String | File:line | Distinct root causes reaching it |
|---|---|---|
| **`"That upload didn't finish."`** | `upload-queue.ts:133`, surfaced `capture.tsx:1062` | Closet/storage cap (permanent), storage-upload HTTP failure, signed-URL failure, row-update failure, any other unmatched thrown error. **"Try again" is correct for 4 of 5 causes and a guaranteed-fail retry storm for the 5th.** |
| `"Couldn't finish the invite" / "...this device just couldn't reach Cinch...your account [is] fine"` | `arrival-page.tsx:65-66` | Any `apply_invite` failure — network, or the `28000` not-signed-in refusal, whose real cause the copy explicitly (and falsely) denies |
| `"That didn't go through. Check your connection and try again."` | `event-outfits/mutations.ts:51` | Any unenumerated errcode — conflates network failure with unclassified refusal |
| `"Cinch couldn't save that change. Try again."` | `item-write.ts:86` | Zero-row RLS update only — correctly scoped |
| `"The stylist could not be reached..."` | `use-chat.ts:661` | Genuine unclassified transport failure only — correctly the true fallback, reached last |
| Raw `err.message` | `use-closet-screen.ts:328,371` | Every possible cause of a remove/recategorise throw — unfiltered |
| `"No longer available"` / `"This reaction was taken back. There's nothing left to open."` | `activity-center/copy.ts:246,254-255`, rendered `activity/reaction/[id].tsx:123-147`, `activity/invitation/[id].tsx:136-185` | A genuinely revoked item **and** any failed fetch (network/RLS/timeout) — `event.isError` is never checked |

---

# Part 2 — Screen states

Global config: `src/lib/query-client.ts:19-30` — `staleTime: 5min`, `gcTime: 24h`, `retry: 2` (queries only), `refetchOnWindowFocus: false`. Cache is persisted to disk (`PersistQueryClientProvider` + `createSyncStoragePersister`, `src/app/_layout.tsx`), allowlisted to `closet`/`wardrobe`/`style-profile`/`trips` (`query-client.ts:78`) — so offline generally shows stale content rather than blank, for those four keys only.

This codebase runs a disciplined, repeated pattern on most screens: a shared `EmptyState`/`ErrorState`/`Skeleton` kit, a `loading`/`failed`/`showEmpty` triage computed once and handed to a presentational component, RefreshControl wired to `.refetch()`. The findings below are the exceptions to that pattern.

## Daily Social — full trace (Incident B)

Not a separate route — the top section of `src/app/(tabs)/explore.tsx`, driven by `useDailyLooks`/`useFriendsSharingCount` (`src/features/daily-social/queries.ts:75-187`) and `resolveDailyState` (`src/features/daily-social/states.ts:112-119`).

- `useDailyLooks()` reads `friend_worn_outfits` (RLS: `is_friend()` AND `worn_outfits_shared_since is not null` AND a 7-day window) — 3 round trips, `[]` on any empty upstream.
- **Six states**, resolved by one pure, tested function: `no_circle` (S-1a, 0 mutual friends) → `nobody_sharing` (S-1b, friends exist, none opted in — **the default for nearly every user**, since sharing is off by default) → `quiet_day` (S-2, friends share, nothing in 7 days) → `the_day`/`caught_up` (S-3/S-4) → `offline` (S-5, checked first, before any emptiness).
- Rendering (`explore.tsx:513-585`): every state gets distinct treatment. `no_circle` → page-level `Hero`, "Explore is just your people," CTA "Find a friend" (`:707-723`). `nobody_sharing` → `NobodySharingState`, CTA "Turn on sharing" → `/privacy/visibility`. `quiet_day` → `QuietDayState`, **deliberately no CTA** (documented as "not an error, not empty-styled" — but is nonetheless a common first-week state with no door out).
- **This is not blank-on-success as shipped.** Git history shows dedicated hardening commits for exactly this failure class (e.g. `the-ten.tsx:499-501` carries an identical documented fix: "a failed wardrobe query left it holding 'Loading your closet…' forever… has no way out of it").
- **One residual gap, confirmed**: `showsDaily = hasFriends` (`explore.tsx:299,344`) derives from `friends.data`, `undefined` while loading — so `dailySection` (`:513`) renders `null`, not even a skeleton, for the window before `friends` resolves, independent of `dailyLoading`. Self-resolving, low severity, but the exact shape of the incident.
- **A live, unresolved analog exists**: `activity/reaction/[id].tsx` and `activity/invitation/[id].tsx` (Finding #9) — notifications about these same Daily Social looks — render a false "gone" state on a fetch error, with no error checked and no retry offered.

**Conclusion**: as coded, Daily Social's emptiness is a genuine growth/adoption problem (opt-in sharing, no nudge to turn it on) correctly distinguished from failure — not a states-and-refusals bug in the sense of "blank on success with no explanation." The near-universal `nobody_sharing`/`no_circle` state for early users is nonetheless the real UX risk the incident points at, and both have working CTAs today.

## Screen table (selected — full detail available on request; every one of 86 screens was checked)

| Screen | Loading | Error (+retry) | Empty (+next action) | Pull-to-refresh | Flag |
|---|---|---|---|---|---|
| `(tabs)/index.tsx` (Today) | Yes, + `SlowNotice` after timeout | Yes, `ErrorState` | Yes, activation-floor states | Yes | Exemplary |
| `(tabs)/closet.tsx` | Yes, `ClosetSkeleton` | Yes, guards "error dressed as empty" | Yes, first-time starter card | Yes | Exemplary |
| `(tabs)/plan.tsx` | Yes, ×2 skeleton kinds | Yes, ×5 `ErrorState` | Yes | Yes | Good |
| `(tabs)/explore.tsx` | Partial — see trace above | Yes, `CircleErrorBand` | Yes for `nobody_sharing`; **`quiet_day` has no CTA by design** | Yes | See trace |
| `diary.tsx` | Yes | Yes, retry wired | Yes, explicit "only claim empty after success" gate, CTA to Plan | Yes | **Reference pattern** |
| `the-ten.tsx` | Implicit | Yes — explicit regression fix documented | N/A | N/A | Same bug class as Daily Social, already fixed here |
| `activity.tsx` | Yes | Partial — shows cached data with a `cached` flag rather than distinct error | Yes, dedicated blank branch | **None found** | Flag: no RefreshControl on a feed screen |
| **`activity/invitation/[id].tsx`** | Yes, `ListSkeleton` | **No `isError` check** — `event.data===undefined` reads as "withdrawn," Dismiss-only | N/A | N/A | **Worst offender** |
| **`activity/reaction/[id].tsx`** | Yes | **Same bug** — `revoked` never checks `isError` | N/A | N/A | **Worst offender** (directly verified, see #9) |
| **`auth-callback.tsx`** | Yes, `Spinner`, **no timeout** | Yes, `failure` text + Alert | N/A | N/A | Sign-in screen; a hang here blocks entering the app at all |
| `saved-looks/index.tsx` | Yes, `SavedGridSkeleton` | Yes, `SavedErrorState` | Yes, `SavedEmptyState`, first-save case covered | Yes | Exemplary, explicit offline flag |
| `saved-looks/collections/index.tsx` | Yes | Yes | **No `EmptyState`/`isEmpty` match found** | No | Flag: possible missing zero-collections empty state |
| `event/[id]/invite.tsx` | Yes, `RowSkeleton` | **No error branch found** for friends/roster fetch | Yes, "nothing filtered"/"all invited" | No | Flag |
| `event/[id]/index.tsx`, `outfits.tsx`, `comments.tsx`, `board/[id].tsx`, `trips/index.tsx`, `profile.tsx` | Yes | Yes (mostly) | Yes (mostly) | **None found** | Flag: RefreshControl gap, lower severity — most have retry via error-state buttons |
| `groups/index.tsx`, `friends/index.tsx` | Yes, combined skeleton | Yes, combined `failed` | Yes, computed counts | Yes | Good — first-time-user zero-circles/zero-friends case covered |
| `repeat-outfit.tsx`, `recreate.tsx` | Yes | **No error branch found** | — | — | Flag, not fully confirmed |
| `friends/blocked.tsx` | **None found** | **None found** | Not verified | **None found** | Flag for follow-up spot-check |
| `membership.tsx`, `membership-upgrade.tsx` | No in-file handling found | Not verified (likely delegated to `components/membership/*`) | Not verified | N/A | Flag for follow-up |

## Worst offenders, ranked

1. **`activity/invitation/[id].tsx:113-114`, `activity/reaction/[id].tsx:107`** — a failed fetch (`event.isError` never checked) renders the same false-certainty dead end as a genuinely gone item, removing a possibly-still-valid notification from the feed on nothing more than a dropped connection. Directly verified (Finding #9).
2. **`explore.tsx:513`** — brief true-blank render of the Daily Social section while `friends` loads, independent of `dailyLoading`. Low severity, same shape as the incident.
3. **`auth-callback.tsx:80-94`** — untimed spinner on the sign-in screen; a hang here is maximally damaging.
4. **`event/[id]/invite.tsx`** — no error branch on friends/roster fetch.
5. **`saved-looks/collections/index.tsx`** — possible missing first-run empty state.
6. **No app-level request timeout** anywhere (`query-client.ts` has no per-query `AbortSignal`/timeout) — every screen's skeleton is bounded only by the platform fetch/socket default, not an app-level ceiling.
7. **RefreshControl gaps**: `activity.tsx`, `event/[id]/index.tsx`, `outfits.tsx`, `comments.tsx`, `trips/index.tsx`, `board/[id].tsx`, `profile.tsx` — inconsistent with the rest of the app, which wires pull-to-refresh on nearly every comparable list screen.

---

# Part 3 — Retry loops and batch continuation

## Verdict

The 46-in-44s pattern is produced entirely by `src/features/ingest/upload-queue.ts`, via two compounding gaps:

1. **`src/app/capture.tsx:488-498`** (`settleCapture`) gates a whole multi-photo batch on the single boolean `capacity.full` instead of comparing `assets.length` to `capacity.remaining`. A user under the cap but with fewer remaining slots than photos selected gets the **entire** batch (up to `SELECTION_LIMIT = 60`, `use-capture.ts:41`) committed in one `enqueue()` call (`use-capture.ts:109-118`).
2. Every over-cap photo's insert (`upload-queue.ts:796-802`) hits `items_enforce_limit`'s permanent `closet_limit_reached`/`check_violation` refusal, and `drainQueue`'s catch handler (`upload-queue.ts:905-935`) retries it **blindly, up to `MAX_ATTEMPTS = 3` times per photo, with no error-code inspection and no backoff** — unlike the same file's tagging path (`classify()`, `:306-363`, with an explicit `blocked`/`accountWide` stop condition and `TAG_RETRY_DELAY_MS` backoff).

**Math**: `46 / 3 ≈ 15.3` → consistent with roughly 15-16 over-cap photos in one library selection. Each attempt re-runs `prepareForUpload`/`prepareThumbnail` (downscale) and the on-device Vision `runCutout` pass before the insert is retried (a requeued job re-enters `processJob` at `stage:'preparing'`, `:902`), which is real per-attempt device work — at `MAX_CONCURRENCY = 3` (`:62`), this plausibly consumes the observed ~44 seconds.

## `src/lib/query-client.ts` — not implicated

```ts
// query-client.ts:19-30
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5*60_000, gcTime: 24*60*60_000, retry: 2, refetchOnWindowFocus: false },
  },
});
```
`retry: 2` applies only to `queries`; no `mutations` block exists, so mutations default to **0** retries (TanStack v5 default). Confirmed by grepping every `useMutation(` in the app (~94 call sites): **only one sets `retry` explicitly** — `src/features/invite/mutations.ts:87`, `retry: false`, with an explicit comment about avoiding "a retry storm on a write that has already succeeded once." Every other mutation, including all closet/circle/event/board/saved-looks writes, inherits 0 retries. **React Query itself produces none of the 46 repeated calls.**

## `upload-queue.ts` — the actual mechanism

```ts
// upload-queue.ts:62-63
const MAX_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
```
```ts
// upload-queue.ts:905-935 — drainQueue's per-job catch
.catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const attempts = next.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const diedAt = useQueueStore.getState().jobs.find((j) => j.id === next.id)?.stage ?? 'preparing';
  useQueueStore.getState().update(next.id, {
    stage: exhausted ? 'failed' : 'queued',   // requeued with no delay, no cause check
    error: message,
    retryable: exhausted ? true : undefined,   // ALWAYS true once exhausted, regardless of cause
  });
  if (exhausted) trackImportFailed({ stage: diedAt, error: message, retryable: true, attempts });
})
```
No branch anywhere inspects `message`/embedded `[23514]` code before deciding to requeue. Nothing stops sibling jobs in the same batch — each independently repeats the identical doomed insert. Once exhausted, `retryable: true` is set unconditionally, so the failure banner's "Try again" (`capture.tsx:1062-1070`, `canRetry` `:828`) re-enqueues every over-cap job a second time.

**Contrast — the file's own tagging retry loop does this correctly**: `classify()` (`upload-queue.ts:306-363`) branches on HTTP status to return `blocked` (stop, don't retry) vs. `retry` (worth another attempt); `driveTagging` stops immediately on `blocked` (`:460-467`); backoff is `TAG_RETRY_DELAY_MS * attempt` (`:474`). The item-creation retry path has no equivalent of any of these three properties.

## Other retry/batch code, surveyed

| Location | Shape | Classifies error before retry? | Stops batch on first predictable failure? |
|---|---|---|---|
| `upload-queue.ts:429-476` (`driveTagging`, tag-item) | Per-item, `MAX_TAG_ATTEMPTS=3`, backoff `1200ms × attempt` | **Yes** | N/A (per-item, not a batch) |
| **`upload-queue.ts:905-935` (item-creation retry)** | Per-job, `MAX_ATTEMPTS=3`, **no backoff** | **No** | **No** — THE INCIDENT |
| `upload-queue.ts:1030-1150` (`sweepPendingTags`) | Interval sweep, doubling backoff up to `SWEEP_MAX_INTERVAL_MS=30min` | Yes, per-row via `classify()` | Yes, per-row |
| `events/mutations.ts:296-360` (`useInviteMembers`) | `Promise.allSettled`, one attempt each | N/A — never retries | Yes, by design — reports per-user outcome |
| `circles/errors.ts`, `saved-looks/errors.ts:108`, `profile/mutations.ts:45` | Single-write, `23514` classified | Yes | N/A (single write) |
| `supabase/migrations/20260810140200_intake_commit.sql:154-171` (voice-intake batch, **server-side**) | PL/pgSQL loop over drafts | Yes — catches `check_violation`, matches `closet_limit_reached%` | **Yes** — sets `v_ceiling`, marks remainder `held`, stops inserting |
| `supabase/functions/garment-search/import-batch.ts:108-128` (catalogue import) | Preflight via `import_capacity()` | Refuses the **whole batch atomically before any download** | N/A — never starts if it would exceed capacity |

**Only `upload-queue.ts`'s item-creation retry has the incident's exact shape.** Everything else that retries either classifies the error first, or never retries at all — including two *other* bulk-add pipelines in this very codebase (voice intake, catalogue import) that both correctly stop on the first `closet_limit_reached`.

## `useMutation` custom retry audit

Full-repo grep for `useMutation(` (94 call sites) cross-referenced against `retry:` in `src/features/**`/`src/lib/**`/`src/hooks/**`: **exactly one** sets it explicitly (`invite/mutations.ts:87`, `false`). No mutation in the app auto-retries a write via React Query.

## Root-cause chain (summary)

1. `capture.tsx:488-498` commits a whole batch on `capacity.full` (boolean), not `assets.length` vs. `capacity.remaining` (`use-capacity.ts:92-105`).
2. Every over-cap insert (`upload-queue.ts:796-802`) hits `enforce_item_limit`'s permanent `closet_limit_reached` (`20260808190000_free_closet_is_ten.sql:10-16`).
3. `drainQueue`'s catch (`upload-queue.ts:905-935`) blindly requeues up to 3× per photo, no backoff, no batch-level stop.
4. `userFacingFailure()`/`analyticsFailureReason()` have no branch for the cap, so the user sees the same generic string on all ~46 failures instead of "closet full."
5. React Query is not implicated — mutation retry defaults to 0 app-wide.

**The fix belongs in two places**: `capture.tsx`'s capacity check (batch size vs. `remaining`) and `upload-queue.ts`'s item-creation error path (classify `23514`/`closet_limit_reached` the way `classify()` already does for tagging, and stop retrying/queueing the rest of the batch on a permanent refusal) — both already have a working reference implementation elsewhere in this same codebase (the tagging loop, the voice-intake commit, and the catalogue-import preflight). Per audit scope, no changes were made.

---

## Appendix — incidents already fixed vs. still open

| | Status |
|---|---|
| Paywall shown immediately after an import failure (CMO ledger A16) | **Fixed** — `import-failure-grace.ts`, 10-minute suppression window |
| Repeated identical "couldn't add clothes" errors from one over-cap batch | **Still open** — see Part 3 |
| Generic "That upload didn't finish." masking the closet-cap cause | **Still open** — see Finding #3 |
| "Try again" re-triggering the same doomed batch | **Still open** — see Finding #5 |
| `the-ten.tsx` wardrobe-query failure looping "Loading your closet…" forever | **Fixed**, with an explicit documented regression note |
| Daily Social rendering nothing with no explanation | **Not reproduced as coded** — states are distinguished and CTA'd; the near-universal emptiness is a growth/adoption gap (opt-in sharing, off by default), not a states bug. One brief true-blank render remains (`explore.tsx:513`, Finding #10). |
| Activity detail screens (reaction/invitation) treating a fetch error as "revoked" | **Still open** — see Finding #9 |
