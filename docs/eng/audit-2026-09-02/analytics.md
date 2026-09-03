# Analytics instrumentation audit — 2026-09-02

Scope: `src/lib/posthog.tsx` (the typed event union) cross-referenced against every
`track(...)` / `trackOnce(...)` call site under `src/`, plus `supabase/functions/`
for server-side PostHog usage. Audit only — no files under `src/`, `supabase/`,
`tests/` or `scripts/` were modified.

**Totals**

| | Count |
|---|---|
| Declared events (`AppEvent` union, `src/lib/posthog.tsx:194-1022`) | 143 |
| Distinct `track()`/`trackOnce()` call sites (`grep -rn`, excl. `posthog.tsx`) | 207, across 67 files |
| Declared events with zero call sites (Table A) | 8 |
| Emitted event names not in the declared union (Table B) | 0 (client); 0 (edge functions — no PostHog usage found server-side) |
| `posthog.capture(...)` calls that bypass `track()` | 0 — every emit in the app goes through the typed `track`/`trackOnce` wrapper |
| Superwall placements (`src/features/billing/placements.ts`) | 12, all presented |

Method: `AppEvent` union members were extracted with `awk`/`grep` from lines
194–1022 of `src/lib/posthog.tsx` (143 string literals, verified count).
Call sites were collected with `grep -rn -E "\btrack\(|\btrackOnce\("`, then every
`*_EVENTS` constant object (`TODAY_EVENTS`, `CLOSET_EVENTS`, `REVEAL_EVENTS`,
`STYLIST_EVENTS`, `CIRCLE_EVENTS`, `SAVED_EVENTS`, `ACTIVITY_EVENTS`,
`DAILY_SOCIAL_EVENTS`, `ITEM_EVENTS`) was resolved to its underlying string so
that constant-keyed calls (e.g. `track(TODAY_EVENTS.opened, ...)`) count as
call sites for `today_opened`. `PAYWALL_ALIVE_EVENTS` / `PAYWALL_BROKEN_EVENTS`
in `src/features/billing/use-gate.ts` are `Set<string>` lookups against raw
Superwall SDK event names — unrelated to the `AppEvent` union — and were
excluded.

---

## 1. Declared events

The full 143-member list is `AppEvent` at `src/lib/posthog.tsx:194-1022`. Rather
than reproduce it here verbatim (it is already the source of truth, heavily
commented inline with the bounded-property rule for each event), the
event → call-site mapping below **is** the extracted list — every declared
name appears in Table A (dead) or in section 2 (live, with sites). Properties
for each event are documented in-line in `posthog.tsx` next to its union
member; the shapes are enforced by `EventProps = Record<string, number |
boolean | string | undefined>` (`posthog.tsx:1054`) and, per feature, by a pure
`*Props` builder function in that feature's `analytics.ts` (e.g.
`src/features/today/analytics.ts`, `src/features/closet/closet-analytics.ts`,
`src/features/stylist/stylist-analytics.ts`, `src/features/circles/analytics.ts`,
`src/features/saved-looks/analytics.ts`, `src/features/activity-center/analytics.ts`,
`src/features/daily-social/analytics.ts`, `src/features/item/item-analytics.ts`,
`src/features/onboarding/reveal-analytics.ts`, `src/features/catalogue/analytics.ts`,
`src/features/intake/analytics.ts`).

## 2. Event → call site → component/hook → trigger

Grouped by feature. File:line is the `track()`/`trackOnce()` call; "trigger"
is what causes it to run.

### Catalogue Photo V2 (`features/catalogue/analytics.ts`)
| Event | Call site | Fired from | Trigger |
|---|---|---|---|
| `catalogue_search_offered` | `catalogue/analytics.ts:45` | `find-photo.tsx:79` (`useEffect`, deps `[path]`), `GarmentCard.tsx:137` (`useEffect` keyed on `draft.id` via ref) | Matcher genuinely on screen — find-photo route mount (Stack screen, lazy-mounted) / walkthrough card first shown |
| `catalogue_search_started` | `catalogue/analytics.ts:57` | called from `useCatalogueFlow` (find-photo flow) | User submits a search |
| `catalogue_search_completed` | `catalogue/analytics.ts:62` | same | Search results returned |
| `catalogue_family_opened` | `catalogue/analytics.ts:70` | same | User taps a result family |
| `catalogue_colours_selected` | `catalogue/analytics.ts:75` | same | Colour swatches chosen |
| `catalogue_import_started` | `catalogue/analytics.ts:80` | same | Import of selected items begins |
| `catalogue_import_completed` | `catalogue/analytics.ts:85` | same | Import finishes |
| `catalogue_search_failed` | `catalogue/analytics.ts:93` | same | Search errors |
| `catalogue_search_recovered` | `catalogue/analytics.ts:98` | same | Retry after failure succeeds |

### Ingest / garment import
| Event | Call site | Trigger |
|---|---|---|
| `clothes_import_selected` | `features/ingest/use-capture.ts:136` (library), `:176` (camera); `components/onboarding/ten-camera.tsx:197` (camera, Ten flow) | Photo(s) picked from library/camera, press-driven |
| `clothes_import_completed` | `features/ingest/upload-queue.ts:456,763,1001,1112,1332` | Upload-queue job reaches `done`, 5 paths (`path`, `local`, `resume`, `sweep`, `retry`) |
| `clothes_import_failed` | `features/ingest/upload-queue.ts:217` | Job hits a terminal `stage: 'failed'` (not on retry — only after retries exhausted) |
| `cutout_result` | `features/ingest/upload-queue.ts:627,634,638,673` | On-device cutout result per photo (unsupported device / classified reason / ok / failed) |
| `garment_reviewed` | `app/review.tsx:249,349` | User corrects or confirms AI tags in the review deck |
| `garment_search_used` | `app/the-ten.tsx:898`, `app/review.tsx:589`, `features/match/use-match.ts:241,273`, `features/ingest/use-garment-search.ts:297,327,380,465` | Multiple `stage` values across the "describe instead of photograph" flow — listing offer opened/attached, imported, filed in own words |
| `item_tag_corrected` | `features/closet/mutations.ts:127` | Tag edit mutation succeeds (item detail or review deck) |

### Outfits / Today / stylist / recreate / compose
See §3/§4 below for Today's tab-gated set. Other:
| Event | Call site | Trigger |
|---|---|---|
| `outfit_reacted` | `features/styling/mutations.ts:221` | Like/dismiss mutation `onSuccess` |
| `outfit_worn` | `features/styling/mutations.ts:353`, `features/diary/mutations.ts:78` | Wear-recording mutation `onSuccess` (two entry points: Today's inline flow and the diary) |
| `outfit_planned` | `features/plan/mutations.ts:108` | `usePlanOutfit` `onSuccess` — **no `onError` counterpart** (Table E) |
| `stylist_question_answered`, `stylist_questionnaire_completed` | none | **Dead** — superseded by Redesign 16's `chat_sent`/`chat_reply_ok`/`questionnaire_step` (Table A) |
| `style_profile_saved`/`_skipped`/`_offered` | `features/profile/style-profile-flow.tsx:186,178,167` | Save/skip button; `_offered` on mount of the questionnaire (Stack screens `/style-profile`, `/quiz` — lazily mounted, not a NativeTab, so mount = genuine offer) |
| `recreate_opened` | `app/recreate.tsx:69` | Mount of `/recreate` (formSheet Stack screen, lazy) |
| `recreate_analyzed` | `features/recreate/use-recreate.ts:146,156` | Inspiration photo analysis settles |
| `recreate_saved` | `features/recreate/save-look.ts:52` | Save mutation `onSuccess` |
| `own_outfit_composed` | `features/styling/compose-own.ts:87` | Compose mutation `onSuccess` |
| `explore_shop_feed_loaded` | `features/explore/use-shop-feed.ts:61`, `features/explore/use-partner-feed.ts:48` | **react-query `queryFn`** — see Table C, this is a mount-trap |
| `explore_shop_product_opened` | `components/explore/partner-shop-section.tsx:27`, `components/explore/shop-feed-section.tsx:30` | Card press |
| `pinterest_connect_settled` | `features/recreate/pinterest.ts:95` | OAuth flow settles |
| `pinterest_disconnected` | `features/recreate/pinterest.ts:112` | Disconnect mutation `onSuccess` |
| `stylist_inspiration` | `features/stylist/use-chat.ts:410,430` | Board-led inspiration turn settles (ok / bounded failure) |

### Share / invite
| Event | Call site | Trigger |
|---|---|---|
| `outfit_shared` | `features/share/capture-plate.ts:115` | Share sheet requested |
| `share_completed` | `features/share/capture-plate.ts:148` | iOS completion handler reports a real send |
| `board_shared` | `app/event/[id]/index.tsx:299`, `app/event/[id]/outfits.tsx:434,655` | Event-board share sheet requested (look/board scope) |
| `invite_shared` | `app/invite.tsx:109` | Invite screen's share sheet requested |
| `invite_copied` | `app/invite.tsx:153` | Inside `copyText`'s success branch only |
| `invite_opened` | `features/invite/use-invite-deep-link.ts:90` | Deep link handler resolves |
| `invite_converted` | `features/invite/mutations.ts:74` | `apply_invite` mutation settles |

### Auth
| Event | Call site | Trigger |
|---|---|---|
| `auth_started` | `app/(auth)/sign-in.tsx:182,240` | Apple sheet / email route chosen (attempt, not arrival) |
| `auth_completed` | `features/auth/actions.ts:91,493` | Session produced (Apple path and magic-link deep-link handler) |
| `auth_failed` | `features/auth/actions.ts:95,225,332,495,519` | Sign-in attempt fails, 5 sites across Apple/email/phone paths |

Note: `posthog.tsx:408-413` documents that there is deliberately **no**
"sign-in screen shown" event — `useScreenTracking` (`app/_layout.tsx:147`)
already emits `$screen` on every arrival at `(auth)/sign-in`, which serves as
that denominator. This is a documented design choice, not a gap.

### Paywall / billing
| Event | Call site | Trigger |
|---|---|---|
| `paywall_presented` | `features/billing/use-gate.ts:429` | Superwall `onPresent` |
| `paywall_unavailable` | `features/billing/use-gate.ts:368` | `settle(..., 'unavailable', reason)` — SDK broken-event, no-response, silent-render timeout, skipped-without-grant |
| `paywall_converted` | `features/billing/use-gate.ts:345` | `settle(..., 'granted')` with a real `purchase` (`purchased`/`restored`) |
| `paywall_dismissed` | `features/billing/present-promo.ts:177` | Visibly-presented promo resolves `declined` |
| `paywall_eligible` | `features/billing/present-promo.ts:164`, `features/billing/use-gate.ts:486` | Promo qualification check runs (two emitters by design) |
| `trial_eligibility` | `features/billing/trial-eligibility.ts:54` | StoreKit eligibility check returns |

### Update coordinator (OTA)
| Event | Call site | Trigger |
|---|---|---|
| `update_check_started` | `features/updates/update-coordinator.tsx:86` | Launch or foreground-return check begins |
| `update_check_finished` | `features/updates/update-coordinator.tsx:90` | Check completes |
| `update_downloaded` | `features/updates/update-coordinator.tsx:98` | Update bundle download finishes |
| `update_reload_requested` | `features/updates/update-coordinator.tsx:31` | User accepts restart prompt |
| `update_failed` | `features/updates/update-coordinator.tsx:27` | Check/download/reload fails |

### Intake (voice walkthrough) — `features/intake/analytics.ts`
All ten events (`intake_started`, `intake_recording_finished`, `intake_parsed`,
`intake_card_confirmed`, `intake_card_edited`, `intake_card_rejected`,
`intake_photo_added`, `intake_committed`, `intake_abandoned`, `intake_failed`)
are each emitted from exactly one line in that file (`:36,39,42,47,52,54,56,61,68,70`),
one-line pure wrapper functions called from the walkthrough's screen/hook code.

### Daily Social — `features/daily-social/analytics.ts`
| Event | Call site | Trigger |
|---|---|---|
| `daily_social_opened` | `app/(tabs)/explore.tsx:359` | Tab-gated (§3) |
| `daily_social_empty` | `app/(tabs)/explore.tsx:365` | Same effect, `reason` present |
| `daily_social_completed` | `app/(tabs)/explore.tsx:370-374` | `dailyEndSeen` becomes true (user scrolls to end); state is write-once (`onScroll` guards `if (dailyEndSeen) return` before setting), so this fires at most once per app session even though its effect has no ref-dedup of its own |
| `daily_social_reacted` | `features/daily-social/reactions.ts:147` | Reaction mutation `onSuccess` |
| `closet_visibility_changed` | `features/privacy/use-closet-visibility.ts:113` | Visibility toggle mutation `onSuccess` |
| `worn_outfits_sharing_changed` | `features/daily-social/use-worn-sharing.ts:121` | Sharing toggle mutation `onSuccess` |

### Private groups (Circles) — `features/circles/analytics.ts`
All 8 events (`circle_created`, `circle_invite_sent`, `circle_invite_blocked`,
`circle_invitation_answered`, `circle_member_reinvited`,
`circle_membership_ended`, `circle_renamed`, `circle_deleted`) are emitted
from `features/circles/mutations.ts` `onSuccess` handlers (`:200,240,275,331,377,418,462,508,545`),
plus `circle_invitation_answered` also fires directly from
`app/groups/index.tsx:135` and `app/groups/[circleId]/index.tsx:148`
(inline UI action before delegating to the mutation), and
`circle_invite_blocked` from `app/groups/[circleId]/invite.tsx:134`.

### Activity Center — `features/activity-center/analytics.ts`
| Event | Call site | Trigger |
|---|---|---|
| `activity_opened` | `app/activity.tsx:178` | Data settles (`!loading`), ref-guarded — deliberately not on mount (see §3) |
| `activity_failed` | `app/activity.tsx:172` | Same effect, `failed` branch |
| `activity_item_opened` | `app/activity/reaction/[id].tsx:199`, `app/activity/invitation/[id].tsx:239,266` | Row opened |
| `activity_action` | `app/activity.tsx:190,210`, `features/activity-center/mutations.ts:133,169,220` | Retry / accept / decline / dismiss / undo / clear_all, each a distinct user action or mutation `onSuccess` |

### Saved looks — `features/saved-looks/analytics.ts`
| Event | Call site | Trigger |
|---|---|---|
| `saved_save_created` | `features/saved-looks/mutations.ts:229` | Save mutation `onSuccess` |
| `saved_save_removed` | `features/saved-looks/mutations.ts:280` | Remove mutation `onSuccess` |
| `saved_confirmation_undo` | `features/saved-looks/mutations.ts:277` | Undo within 5s window |
| `saved_list_viewed` | `app/saved-looks/index.tsx:151` | Grid genuinely drawn (`drawsGrid`), ref-guarded on `rows.length`/`shelves.length` |
| `saved_collection_created` | `features/saved-looks/mutations.ts:392` | Mutation `onSuccess` |
| `saved_collection_renamed` | `features/saved-looks/mutations.ts:428` | Mutation `onSuccess` |
| `saved_collection_deleted` | `features/saved-looks/mutations.ts:481` | Mutation `onSuccess` |
| `saved_filter_applied` | `app/saved-looks/index.tsx:180` | Filter chip press |
| `saved_detail_viewed` | `app/saved-looks/[saveId].tsx:106` | Detail data settles |
| `saved_source_unavailable_seen` | `app/saved-looks/[saveId].tsx:111` | Unavailable-source state drawn |
| `saved_plan_started`, `saved_plan_missing_action` | none | **Dead** — builders exist (`planStartedProps`, `planMissingActionProps` in `saved-looks/analytics.ts:290,320`) but are never called (Table A) |
| `saved_plan_created` | `features/saved-looks/mutations.ts:547` | Plan-from-save mutation `onSuccess` |
| `saved_state_shown` | `app/saved-looks/index.tsx:159-161` | loading/offline/error state rendered |
| `saved_retry_tapped` | `app/saved-looks/index.tsx:170` | Retry press |

### Today (Redesign 11), Reveal (Redesign 12), Closet (Redesign 14), Item (Redesign 15), Stylist desk (Redesign 16)
See §3 (tab gating) and §4 (item/stylist detail) below for the full trigger
breakdown; all are `app/(tabs)/index.tsx`, `app/reveal.tsx`,
`app/(tabs)/closet.tsx`, `app/item/[id].tsx`, `app/(tabs)/stylist.tsx`.

### Rating / review
| Event | Call site | Trigger |
|---|---|---|
| `rating_prompt_requested` | `features/rating/ask-for-rating.ts:36` | `StoreReview.requestReview()` called after a settled wear |
| `review_prompt_shown` | `components/rating/review-prompt.tsx:155` | Cinch's own card renders (`onShow`) |
| `review_prompt_action` | `components/rating/review-prompt.tsx:133,140,145` | rate / already / later tapped |

---

## Table A — Declared events with ZERO call sites (8 dead declarations)

| Event | Declared at | Evidence |
|---|---|---|
| `chat_error` | `posthog.tsx:1014` | `STYLIST_EVENTS.chatError` (`stylist-analytics.ts:28`) and `chatErrorProps` (`stylist-analytics.ts:71`) are both defined; `chatErrorProps(` has **zero** call sites anywhere in `src/`. Stylist error handling (`use-chat.ts`) does not report this failure path to analytics at all. |
| `context_opened` | `posthog.tsx:847` | `TODAY_EVENTS.contextOpened` defined (`today/analytics.ts:45`) but `today/analytics.ts:38-44` documents it as **DORMANT since 2026-08-18** — "the founder withdrew Today's context chips, and these two fired only from them." Component unmounted, not deleted. |
| `context_set` | `posthog.tsx:855` | Same as above — `TODAY_EVENTS.contextSet` (`today/analytics.ts:46`) is dormant for the same reason. |
| `local_fact_answered` | `posthog.tsx:1016` | `STYLIST_EVENTS.localFactAnswered` and `localFactAnsweredProps()` defined (`stylist-analytics.ts:29,74`) but `localFactAnsweredProps(` is never called. |
| `saved_plan_missing_action` | `posthog.tsx:823` | `SAVED_EVENTS.planMissingAction` and `planMissingActionProps` defined (`saved-looks/analytics.ts:76,320`) but never called. |
| `saved_plan_started` | `posthog.tsx:820` | `SAVED_EVENTS.planStarted` and `planStartedProps` defined (`saved-looks/analytics.ts:74,290`) but never called. |
| `stylist_question_answered` | `posthog.tsx:266` | Zero occurrences anywhere outside the union declaration — no constant, no props builder, no call site. Superseded in practice by Redesign 16's `chat_sent`/`chat_reply_ok` pair. |
| `stylist_questionnaire_completed` | `posthog.tsx:268` | Same — zero occurrences outside the declaration. Superseded by Redesign 16's `questionnaire_step`. |

Two of these (`context_opened`/`context_set`) are explicitly documented as
intentionally-dormant in source. The other six have no comment marking them as
retired — `chat_error`, `local_fact_answered`, `saved_plan_started`, and
`saved_plan_missing_action` have props builders sitting unused (a caller was
clearly planned and never wired), and `stylist_question_answered` /
`stylist_questionnaire_completed` read as pre-Redesign-16 leftovers never
pruned from the union. `posthog.tsx:1024-1044` shows the project has already
gone through exactly this cleanup once for `client_error` ("declared ... and
was deleted rather than wired") — these eight are candidates for the same
treatment or for wiring up the call site that was evidently intended.

## Table B — Emitted events not in the declaration

**Empty.** Every `track()`/`trackOnce()` call site in `src/` (207 call sites,
67 files) passes either a string literal that appears in the `AppEvent` union,
or an `*_EVENTS.field` constant whose value resolves to a union member —
verified by resolving all 9 `*_EVENTS` objects and diffing against the 143
declared names (0 unresolved, 0 extras). There is no direct
`posthog.capture(...)` or `posthog?.capture(...)` call anywhere in `src/` —
every emission goes through the typed `track`/`trackOnce` wrapper in
`src/lib/posthog.tsx`, so there is no type-unsafe / string-typed emit path in
the client at all.

Server-side: `grep -rl -i posthog supabase/functions/` returns **no matches**.
None of the 20 edge functions (`analyze-inspiration`, `asc-notifications`,
`build-export`, `commerce-health`, `delete-account`, `gap-shop-match`,
`garment-search`, `generate-outfits`, `packing-brief`, `parse-closet`,
`pinterest-api`, `pinterest-oauth`, `reap-intake-audio`, `send-push`,
`stylist-chat`, `superwall-reconcile`, `superwall-webhook`, `support-mail`,
`sync-feeds`, `tag-item`, `transcribe-intake`) call PostHog. This matches
`posthog.tsx`'s own documented architecture (§ "THE SERVER-SIDE SUBSCRIPTION
LIFECYCLE" at `posthog.tsx:526-545`): server facts go to the `superwall_events`
Postgres ledger, not PostHog, specifically so the client/server split stays
honest.

## Table C — Events firing on MOUNT rather than user action/focus, and events that can double-fire

### NativeTabs gating — verified correct for 4 of 5 tabs, one gap found

`src/lib/use-tab-visited.ts` exists specifically because `NativeTabs` mounts
all five tab screens together at launch (documented in its own header comment,
citing a live incident on 2026-08-25 where `today_opened`, `stylist_opened`,
`daily_social_opened` fired within ~1.5s of sign-in for tabs nobody visited).
`tests/tab-visit-gating.test.ts` pins the gate in source for **Today, Closet,
Stylist, Explore's `daily_social_opened`** — the exact regex assertions at
`tab-visit-gating.test.ts:56-95` confirm:

- `today_opened` — `app/(tabs)/index.tsx:973-979`, gated `if (!visited || openedRef.current) return;`
- `stylist_opened` — `app/(tabs)/stylist.tsx:261-268`, gated `if (!visited || openedOnce.current) return;`
- `closet_viewed` — `app/(tabs)/closet.tsx:836-841`, gated `if (!visited || reported.current === rails) return;`
- `daily_social_opened`/`daily_social_empty` — `app/(tabs)/explore.tsx:350-366`, gated `if (!visited || !showsDaily || dailyLoading) return;`
- Today's `weather_state`, `closet_floor_shown`, `reveal_door_shown`, `no_viable_combination`, and Stylist's `allowance_mark_shown`, Closet's `closet_capacity_state` — all also gated on the same `visited` boolean (`index.tsx:998-1061`, `stylist.tsx:275-278`, `closet.tsx:1147-1153`).

**Gap found, not caught by the test suite or by inspection until now:**
`explore_shop_feed_loaded` (both call sites) is **not** gated on
`useTabVisited()`.

- `features/explore/use-shop-feed.ts:61` and `features/explore/use-partner-feed.ts:48` call `track('explore_shop_feed_loaded', ...)` from inside a react-query `queryFn`.
- Both queries are wired at `app/(tabs)/explore.tsx:234,238`: `enabled: showWhereToBuy.data === true` — an entitlement flag, with **no** `visited` check, unlike every other analytics effect on the same screen (`explore.tsx:350` two lines below explicitly is gated).
- Because `(tabs)/explore.tsx` mounts at launch under NativeTabs (same mechanism the `use-tab-visited.ts` header describes), `explore_shop_feed_loaded` fires as soon as the entitlement flag resolves true and the wardrobe/partner-feed data loads — **for every eligible signed-in user, whether or not they ever open the Explore tab.**
- It also has no ref-based dedup (every other "shown"/"viewed" event in the codebase uses a `useRef` guard — see the pattern throughout §2). Because it lives in a react-query `queryFn`, it re-fires on every refetch: `staleTime` expiry, window/app refocus, network reconnect — none of which represent "a feed load a person saw." This is the only `track()` call site in the codebase living inside a `queryFn:` rather than a mutation's `onSuccess:` or a gated `useEffect`.
- `tests/tab-visit-gating.test.ts` only asserts gating for Today, Closet, Stylist, and Explore's `daily_social_opened`/`_empty`/`_completed` trio — it does not check `use-shop-feed.ts` or `use-partner-feed.ts` at all, so this slipped past the exact regression test built to catch this class of bug.

`app/(tabs)/plan.tsx` (the fifth NativeTab) has **zero** `track()` calls of
any kind — no mount trap, but also no screen-view event whatsoever (see Table E).

### Non-tab screens checked for the same trap — all correct
Stack.Screen routes (formSheet or push) are lazily mounted by expo-router —
they do not pre-mount the way NativeTabs does — so a plain `useEffect(() => track(...), [])`
on such a screen is a legitimate one-time "genuinely on screen" signal, not a trap:

- `recreate_opened` — `app/recreate.tsx:69`, empty-deps effect. `recreate` is registered as a `formSheet` Stack.Screen (`app/_layout.tsx:448-456`), reached only via push from the stylist's door — confirmed not preloaded.
- `item_detail_viewed` — `app/item/[id].tsx:256-259`, empty-deps effect with a `viewed` ref guard. `item/[id]` is a dynamic Stack route, mounted only on navigation.
- `style_profile_offered` — `features/profile/style-profile-flow.tsx:167-169`, empty-deps effect (explicit `eslint-disable react-hooks/exhaustive-deps`). Rendered only from `/style-profile` and `/quiz`, both Stack screens reached by explicit navigation (`app/style-profile.tsx:21`, `app/(auth)/quiz.tsx:23-27`).
- `reveal_phase`, `outfit_count_bucket`, `outfit_set_viewed` (Reveal's copy) — `app/reveal.tsx:210-247` — driven by `sequence.phase`/`sequence.platesShown` transitions with `useRef(new Set())` / boolean-ref dedup, not raw mount; `/reveal` is a Stack screen reached only from Today's `reveal_door_shown` door.
- `activity_opened`/`activity_failed` — `app/activity.tsx:167-180` — explicitly **not** fired on mount; gated on `!loading` so the "had_unseen" and latency figures reflect settled data, with a `reported` ref preventing re-fire on subsequent re-renders.

### Events that can fire more than once per visit by design (documented, not bugs)
- `garment_search_used` — 5 distinct `stage` values across 5 call sites (`the-ten.tsx:898`, `review.tsx:589`, `use-match.ts:241,273`, `use-garment-search.ts:297,327,380,465`); each stage is a separate funnel step, intentionally multi-fire per session.
- `cutout_result` — `upload-queue.ts:627,634,638,673`, once per photo processed, so multiple per import batch by design.
- `wear_result` — `app/(tabs)/index.tsx:1299,1353` — comment at `posthog.tsx:866` explicitly notes "a failure is retryable, so this can fire twice."
- `paywall_eligible` — two emitters (`use-gate.ts:486`, `present-promo.ts:164`) — documented in `posthog.tsx:472-493` as intentional (every qualification check, not a single denominator).
- `outfit_set_viewed` — comment at `posthog.tsx:244-248` documents "once per distinct set per mount... a 'show me another' swap ... counts again" — multi-fire by design, single current call site at `app/reveal.tsx:247` (Today's own copy of this event was deliberately removed — comment at `index.tsx:957`).

## Table D — Unbounded-string vs. bounded-enum properties

**No event property carrying unbounded free text, `error.message`, a raw URL,
or an email address was found.** This is a deliberate, enforced house rule
(`posthog.tsx:1046-1054`, `EventProps` comment) and it holds in practice:

- `action_failed`'s `cause` — `causeOf()` in `app/item/[id].tsx:183-193` reads `error.message` internally but **returns** one of a fixed 4-value enum (`signed_out | network | rejected | unexpected`); the raw message never reaches `track()`.
- `clothes_import_failed`'s `reason` — `analyticsFailureReason()` in `features/ingest/upload-queue.ts:155-174` performs the same pattern-match-then-bucket, returning one of 8 fixed strings (`consent_missing | unverified_session | quota_exhausted | item_missing | bad_request | photo_unreadable | row_write_failed | not_signed_in | unknown`), never the raw error.
- `paywall_unavailable`'s `reason` — `use-gate.ts:439-441` explicitly collapses the one genuinely-unbounded case: `reason.startsWith('sdk_error') ? 'sdk_error' : reason` — the raw SDK error text is discarded and replaced with the bare tag.
- `outfit_shared`/`share_completed` — `capture-plate.ts:114` comment: "The URL itself is never sent — only whether there was one" (`has_link: boolean`).
- `garment_search_used`, `use-garment-search.ts:295` comment: "Counts and flags only. The URL is user content and never leaves the device."
- `auth_failed`'s `reason`/`code` — the existing `SignInResult` enum and the closed `ERR_*`/`no_identity_token`/`supabase_<status>` set from `sign-in-errors.ts` (per `posthog.tsx:684-695`), never a message string.

**Bounded property inventory (representative, not exhaustive — every event's
comment in `posthog.tsx` states its own bound):**
- Counts, always banded, never raw: `outfit_count_bucket` (5 buckets, never the number — `posthog.tsx:919-923`), `intake_parsed`'s `garment_bucket`, `intake_recording_finished`'s `duration_bucket`, `closet_selection` (one/many/all, never the number), saved-looks' `countBucket` (4 bands).
- Fixed enums: `wear_result` (`ok|failed`), `review_prompt_action` (`rate|already|later`), `maintenance_action` (`retag|send_back|view_original`), `pinterest_connect_settled`'s `outcome` (5-value closed set), `activity_failed`'s `error_class` (`offline|unauthorized|server|unknown`).
- Booleans-only events (no scalar risk at all): `price_added`, `lending_set`, `listing_photo_removed`, `item_stored`, `item_deleted`, `rating_set`, `favorite_set` — all intentionally WHETHER-only per their `posthog.tsx` comments, specifically to avoid leaking a price, a wear count, or a friend identity.
- Zero-property events by design: `circle_created`, `circle_invite_sent`, `saved_confirmation_undo`, `rating_prompt_requested`, `review_prompt_shown`, `closet_plans_door_opened`, `reveal_door_shown`, `closet_floor_shown`, `repeat_exhausted`, `no_viable_combination`, `wear_started`.

No table-D violation was found. This is the one area where the codebase's own
documentation (extensive JSDoc on almost every union member, explicitly
warning against exactly these leaks) matches what the call sites actually do.

## Table E — Funnel gaps

| Gap | Evidence |
|---|---|
| **Plan tab has no screen-view event at all** | `app/(tabs)/plan.tsx` (1067 lines, one of the 5 `NativeTabs.Trigger`s — `app/(tabs)/_layout.tsx:111`) contains **zero** `track()` calls. Every other tab has an `*_opened` event gated by `useTabVisited()`; Plan has none, so there is no denominator for "how many people looked at their week" and no way to build a funnel into `outfit_planned` or into the packing flow it also hosts. |
| **`outfit_planned` has no failure counterpart** | `features/plan/mutations.ts:85-108` — `usePlanOutfit`'s mutation has `mutationFn` and `onSuccess` (which fires `outfit_planned`, line 108) but no `onError` handler of any kind — a failed plan write (e.g. the `plan_outfit_tx` RPC throwing) is invisible to analytics, unlike `clothes_import_completed`/`clothes_import_failed` or `item_stored`(true/false)/`action_failed`, which all pair success with a bounded failure event. |
| **Purchase-failure is folded into the existing paywall trio (not a true gap, but worth flagging as implicit)** | There is no `purchase_failed` event distinct from `paywall_unavailable`/`paywall_dismissed`. Per `posthog.tsx:452-471`, the trio (`paywall_presented` → `paywall_converted`/`paywall_unavailable`/`paywall_dismissed`) is documented as deliberately exhaustive — a StoreKit-level purchase failure while the sheet is open is Superwall's own retry surface and does not settle the gate at all, so it stays outside this union by the same server/client-split logic that keeps `trial_started` server-only. Flagged for visibility, not recommended as a gap to close without product input. |
| **Sign-in door itself has no dedicated event — documented, not a gap** | `posthog.tsx:408-413` explicitly states arrival is covered by `$screen` via `useScreenTracking`, and `auth_started` is deliberately the *attempt*, not the arrival. Confirmed by design, no action needed. |
| **"First garment added" has no distinct milestone event — documented, not a gap** | `closet_ready` (`posthog.tsx:427-442`) is explicitly the activation event and explicitly *not* tied to finishing The Ten — it fires via `trackOnce` from both `the-ten.tsx:496` and `index.tsx:900` the first time `canGenerate()` is true. No separate "first garment" event is needed given this design. |
| **`saved_plan_started` / `saved_plan_missing_action` declared, never wired** | See Table A — the plan-from-saved-look flow (`features/saved-looks/mutations.ts:547`, which fires `saved_plan_created`) has no denominator event marking when the flow was entered, and no event for the "missing item" recovery choice (`find_similar | add_manual | skip`) despite a purpose-built props builder (`planMissingActionProps`, `saved-looks/analytics.ts:320`) existing for exactly that. |

Screens surveyed for at least one success/failure pair around a mutation: `app/item/[id].tsx` (price/lending/maintenance/stored/deleted all pair a boolean-outcome event or `action_failed` — complete), `app/groups/*` (Circles — every mutation in `features/circles/mutations.ts` has a matching event, no `onError` tracking there either but each mutation surfaces failure via toast, not analytics — same class of gap as Plan, smaller blast radius since Circles are lower-traffic), `features/ingest/upload-queue.ts` (complete — `clothes_import_completed`/`clothes_import_failed` pair every terminal state), `app/(auth)/sign-in.tsx` (complete — `auth_completed`/`auth_failed` pair every attempt).

## 8. Superwall placements — `src/features/billing/placements.ts`

12 placements, all presented at least once:

| Placement | Value | Presented from |
|---|---|---|
| `AddGarmentOverLimit` | `add_garment_over_limit` | `app/(tabs)/closet.tsx:1177`, `app/capture.tsx:696`, `app/gap-feed/[kind].tsx:93`, `app/storage.tsx:210`, `app/the-ten.tsx:850`, `components/ingest/garment-search-sheet.tsx:579` |
| `GenerateOutfitOverLimit` | `generate_outfit_over_limit` | `app/(tabs)/index.tsx:1502` |
| `OpenStylist` | `open_stylist` | `app/(tabs)/stylist.tsx:531`, `features/stylist/use-chat.ts:683` |
| `TrialExpired` | `trial_expired` | `features/billing/use-trial-expired.ts:60`, via `presentPromo()` |
| `EventJoinOverLimit` | `event_join_over_limit` | `features/events/mutations.ts:402`, via `gate.present(EVENT_JOIN_PLACEMENT, ...)` |
| `EventHostingOverLimit` | `event_hosting_over_limit` | `features/events/mutations.ts:186`, and `app/(tabs)/plan.tsx:743` (button, delegates to the same gate) |
| `PackingAccess` | `packing_access` | `features/plan/use-packing-access.ts:192` |
| `RepeatUpsell` | `repeat_upsell` | `app/(tabs)/index.tsx:1139`, `app/profile.tsx:176` |
| `RevealComplete` | `reveal_complete` | `app/reveal.tsx:383`, via `presentPromo()` |
| `MembershipUpgrade` | `membership_upgrade` | `app/membership-upgrade.tsx:37` |
| `TenCompleted` | `ten_completed` | `app/the-ten.tsx:773`, via `presentPromo()` |
| `ReturningFree` | `returning_free` | `features/billing/use-returning-free.ts:114`, via `presentPromo()` |

`reveal_complete` is a **Superwall placement name**, not a PostHog event —
confirmed no `AppEvent` union member of that name exists, and the codebase's
own comment at `placements.ts:158` and the task brief both flag this
distinction explicitly. The PostHog-side signal around the Reveal paywall
moment is the ordinary `paywall_presented`/`paywall_converted`/etc. trio with
`placement: 'reveal_complete'` as a property (`use-gate.ts:429,345`), not a
same-named PostHog event.

---

## Summary of findings requiring attention

1. **`explore_shop_feed_loaded` mounts unfocused** (Table C) — the one
   analytics call site on a NativeTab screen that escaped the
   `useTabVisited()` gate the rest of Explore/Today/Closet/Stylist already
   enforce, and the one call site living in a react-query `queryFn` rather
   than a gated effect or mutation `onSuccess`, so it can also re-fire on
   every background refetch. Fix pattern already exists in the same file
   two effects down (`explore.tsx:350`) — `useTabVisited()` plus a ref guard.
2. **8 dead event declarations** (Table A) — 2 documented-dormant
   (`context_opened`/`context_set`), 4 with an orphaned props builder and no
   caller (`chat_error`, `local_fact_answered`, `saved_plan_started`,
   `saved_plan_missing_action`), 2 with no trace outside the union at all
   (`stylist_question_answered`, `stylist_questionnaire_completed`, both
   apparently superseded by the Redesign 16 stylist events).
3. **`app/(tabs)/plan.tsx` has no analytics of any kind** — no screen-open
   event (Table E), and its one mutation (`outfit_planned`) has no failure
   counterpart.
4. Table B (undeclared/type-unsafe emits) and Table D (unbounded strings) are
   both **clean** — the codebase's discipline around the typed union and the
   bounded-property rule holds up under direct inspection of every call site.
