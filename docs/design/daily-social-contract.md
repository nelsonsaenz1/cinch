# The Daily Social contract — Phase 0

The frozen design-and-build contract for the **Daily Social** unit. Written at
Phase 0 against shipping source at `86c1b2b`, and **read-only to every
implementation agent**: where this document and an atlas disagree, this wins,
and every override says why.

No product code, migration, package or service change belongs to Phase 0. This
document and the atlas brief in §10 are the entire deliverable.

Companions, all of which constrain this unit:
[`event-social-contract.md`](./event-social-contract.md) ·
[`diary-boards-activity-contract.md`](./diary-boards-activity-contract.md) ·
[`system-safety-contract.md`](./system-safety-contract.md)

---

## 1 · The user and the job

**Who.** Someone who already keeps their own closet in Cinch and has between one
and a dozen mutual friends who do too. They are not an audience and they are not
building one — `follows` has no follower count on any surface, and nothing in
this unit introduces one.

**The job.** *"Show me what my friends wore, once a day, and let me react without
starting a conversation I have to maintain."*

The job is deliberately small. Cinch's social layer already has five event rooms
(`event-social-contract.md`), a derived Activity surface, and an Explore feed.
What it does not have is a **daily** rhythm: a thing that is worth opening once,
is finite, and ends. `src/features/explore/feed.ts:51` already ships the
sentence that ends it — `CAUGHT_UP_LINE = 'You're caught up with your circle.'`
Daily Social is that idea given a cadence.

**What it is not.** Not a chat product, not a follower graph, not a place
strangers appear. Every non-goal below is a decision, not an omission:

| Not building | Why |
|---|---|
| Public feed / discovery of strangers | `profiles.visibility` defaults to `'private'` (`20260803210000_styling_learning_social.sql:230`). A stranger surface would need that default inverted. |
| Follower counts, likes-as-score | The unit is a daily read, not a scoreboard. Counts create the audience the user said they were not building. |
| Threaded comments | Event comments already exist and are scoped to an event (`20260807102000_event_outfits_votes_comments.sql`). A second comment system with different rules is how two surfaces disagree. |
| Stories/ephemeral video | No capture pipeline for it, no retention story, no moderation story. |

---

## 2 · Reconciliation — stale aspirations against shipping truth

Checked against source, not against commit messages or older docs.

| Claim in circulation | Shipping truth at `86c1b2b` | Consequence for this unit |
|---|---|---|
| "Cinch has a social feed" | `src/app/(tabs)/explore.tsx` is a **`KeyboardAwareScrollView`**, not a virtualised list (`:279`). `@shopify/flash-list@2.0.2` is a dependency but unused here. | Daily Social must not assume a list runtime exists. §9 makes the list primitive an explicit decision. |
| "Friends are a first-class model" | There is no friendship table. Friendship is **mutual `follows` + not blocked**, spelled out per call site — see `20260810110100_push_senders.sql:155`, which says so explicitly because `is_friend()` reads `auth.uid()` and cannot answer about someone else's pair. | The unit inherits this definition. It does **not** introduce a `friendships` table; doing so would create a second source of truth. |
| "Closet visibility is user-controlled" | **False today.** `profiles.closet_hidden`, `stat_pieces_hidden`, `stat_wears_hidden` exist (`20260808110000_friend_closet_privacy_layer.sql:22-24`), the read path honours them (`src/features/social/db-rows.ts`, `src/features/social-graph/types.ts`), and **no UI sets them** — the migration's own note says "the toggle UI lands in a later Profile session", and it never did. | This is the single largest privacy gap the unit inherits. §5 makes shipping that toggle a **precondition**, not a follow-on. |
| "Activity is a stored feed" | Only **dismissals** are stored — `activity_dismissals` is the whole table (`20260810100100_activity_feed.sql`). The feed itself is derived per read. | Daily Social follows the same shape. No feed table. §4 keeps derivation. |
| "We measure social engagement" | **No social analytics exist.** The taxonomy has 47 events and not one is social — no `friend_added`, no `explore_viewed`, no `comment_posted`. | §7 defines the first social events. This unit is where social measurement starts, so the taxonomy must be right the first time. |
| "Push already nudges friends" | True, and further along than the UI — `push_claim_friend_activity()` (`20260810110100_push_senders.sql:160`) already batches follow-backs and new pieces into one daily-shaped notification. | The daily cadence is already **half-built in the backend**. Daily Social should be its destination, not a parallel mechanism. |

**The headline.** The backend for a daily social rhythm largely exists and is
private by default. What is missing is a surface, a visibility control users can
actually reach, and any measurement at all.

---

## 3 · Conservative product decisions (private by default)

Each is the more restrictive option, chosen deliberately.

1. **Mutual-only, always.** Content enters the daily unit only between mutual
   follows with no block in either direction. Never one-way.
2. **Nothing new becomes public.** This unit adds no column whose default widens
   visibility. `is_public` stays `false` (`:35`, `:243`), `profiles.visibility`
   stays `'private'`, events stay `'invite_only'` (`20260807101000_events.sql:28`).
3. **The visibility toggle ships first.** Daily Social must not surface a
   friend's closet stats before that friend can turn them off. §5.1.
4. **Reactions are private to the pair.** A reaction is visible to its author and
   the owner of what was reacted to. No public tallies — consistent with the
   private ratings already shipped on Today.
5. **No new text surface.** The unit ships **no free-text field**. Reactions are
   from a fixed set. This removes UGC moderation, text filtering and abuse
   review from the unit entirely; `20260808005513_ugc_text_filter.sql` stays
   scoped to the surfaces that already have text.
6. **Daily means finite.** The unit has an end, and says so
   (`CAUGHT_UP_LINE`). It never paginates into infinity.
7. **Opt-in cadence.** The daily push already exists and is preference-gated
   (`20260810004436_push_tokens_and_prefs.sql`). The unit adds no new
   notification category and no default-on interruption.
8. **A block is total and immediate.** Already enforced at the data layer
   (`20260807120000_event_content_block_filter.sql`, `20260809150305_block_retracts_votes.sql`);
   this unit adds no read path that bypasses it.

---

## 4 · Flow and state map

**Entry.** Tab, once a day. Optionally from the existing `friend_activity` push.

**The five states.** Every one must be drawn; four are failure or emptiness, and
those are where the unit is actually judged.

| # | State | Condition | What it says |
|---|---|---|---|
| S-1 | **Nothing yet** | No mutual friends | Invite path. Never a stranger suggestion. |
| S-2 | **Quiet day** | Friends exist, nothing new since last read | The caught-up line, and the date it covers. Not an error, not empty-styled. |
| S-3 | **The day** | 1–N items from mutuals | The unit's substance. Finite, ordered, ends in the caught-up line. |
| S-4 | **Caught up** | Reached the end of S-3 | Terminal. No infinite scroll, no "load more". |
| S-5 | **Offline / failed** | Query failed or device offline | Distinguishes *offline* from *nothing happened* — the same distinction Today now draws between `styling_timeout` and `styling_offline` (`src/features/styling/use-outfits.ts`). Never blames the network for emptiness. |

**Transitions.** S-1 → S-2 on first mutual. S-2 ⇄ S-3 by content. S-3 → S-4 by
reaching the end. Any → S-5 on failure, and back without losing scroll position.

**Per-item states.** Unseen → seen (the `unseen.ts` / `use-explore-unseen.ts`
machinery already exists and must be reused, not reimplemented) → reacted
(optimistic, reversible) → dismissed.

---

## 5 · Route / component / data / RLS / analytics / test map

### 5.1 Precondition — the visibility toggle

**Blocking.** Ship before any Daily Social surface: a Profile/Settings control
writing `profiles.closet_hidden`, `stat_pieces_hidden`, `stat_wears_hidden`.
Schema and read path exist; only the control is missing (§2). Until it ships, the
unit may not display friend closet stats.

### 5.2 Routes

| Route | Status | Note |
|---|---|---|
| `src/app/(tabs)/explore.tsx` | **Extend, do not add a tab** | Five tabs exist (`_layout.tsx`, `closet`, `explore`, `index`, `plan`). A sixth is a HIG problem and a navigation-rewrite problem. |
| `src/app/friends/*`, `people-search.tsx` | Reuse unchanged | Friends, blocked list and search already ship. |
| New route | **None** | If the design needs one, it is a contract change, not an implementation detail. |

### 5.3 Components

Reuse: `src/components/ui/*` primitives, `error-state.tsx` (has `kicker`),
`skeleton.tsx`, `today/plate-skeleton.tsx` for plate-shaped waits,
`src/features/explore/{feed,unseen,timeline,contextual-actions}.ts`.
New components must be justified against an existing primitive in review.

### 5.4 Data

**No new table.** Derive per read, as Activity does. If dismissal is needed,
extend `activity_dismissals` (`kind` + `subject_key` is already generic) rather
than adding a second dismissal store.

Read through the existing privacy views — `friend_items`, `friend_closet_meta`,
`social_profiles` (`20260808110000_friend_closet_privacy_layer.sql`) — never
directly from `items`/`outfits`/`profiles`.

### 5.5 RLS

No new policy should be needed; that is the test. Any new read path must be
expressible through the existing views and `is_friend()`. **If a new policy is
required, the design is reaching for data the unit should not have.** Any policy
that does land needs a pgTAP test in `supabase/tests/` — the `database` CI job is
the only thing that observes RLS (`.github/workflows/ci.yml`).

### 5.6 Analytics — the first social events

Cinch's taxonomy has **no social events**. Proposed minimum, matching the
existing `snake_case` verb-past convention:

| Event | Properties | Question it answers |
|---|---|---|
| `daily_social_opened` | `item_count`, `state` (S-1…S-5) | Is it worth opening? Which state do people actually meet? |
| `daily_social_completed` | `items_seen`, `reached_end` | Does "finite" work — do people reach the end? |
| `daily_social_reacted` | `reaction`, `surface` | Is the fixed reaction set the right set? |
| `daily_social_empty` | `reason` (`no_friends` / `quiet_day`) | Distinguishes the two very different emptinesses. |

No user ids, no friend ids, no garment ids in properties — consistent with the
manual-screen-view rule at `src/app/_layout.tsx` ("joined segments are stable
route identifiers, never params").

### 5.7 Tests

| Layer | Where | Must assert |
|---|---|---|
| Feed logic | `tests/` node suite | Ordering, finiteness, caught-up boundary, unseen transitions. Pure functions, no renderer — house style. |
| Privacy | `supabase/tests/*.sql` (pgTAP) | A non-mutual sees nothing; a blocked pair sees nothing in either direction; a hidden stat is absent from the view. |
| Copy | `tests/` | No em-dash/placeholder violations; the five states each have distinct copy. |
| A11y | `tests/` | Reaction targets ≥44pt; every control has an `accessibilityLabel` — the pattern in `tests/event-detail-ax.test.ts`. |
| Contrast | `tests/contrast.test.ts` | Any new colour pairing passes the frozen census (`src/theme/contrast.ts`). `theme.byline` remains banned as text (2.61:1). |

---

## 6 · Privacy, deletion, expiry, block, offline, accessibility, performance

**Privacy.** Mutual-only; read through the privacy views; no new public column;
no free text (§3.5). The §5.1 toggle is a precondition.

**Deletion.** `delete-account` (v30, ACTIVE) must remove everything this unit
adds. Because the unit adds no table, this is satisfied by construction — which
is one reason to add none. Any dismissal rows extend a table already covered.

**Expiry.** The unit is *daily*: content ages out of the day, it is not retained
as a feed. Precedent windows in this schema are `24 hours`, `7 days`, `14 days`;
pick from those rather than inventing one. Expiry must be enforced in SQL, not
only in the client — the house rule from `unwear_outfit_tx`'s 24-hour refusal
("a client-side check is a courtesy; this is the rule").

**Block.** Already total (`20260807120000`, `20260809150305`). The unit adds no
read path that bypasses it, and the pgTAP test in §5.7 is what proves it.

**Offline.** S-5 distinguishes offline from empty. No optimistic write may claim
durability the app cannot provide — the wear-failure copy rule already bans
"will not lose" / "saved on this phone" (`tests/today-polish-phase-a.test.ts`).

**Accessibility.** Dynamic Type to AX-XXXL without truncation of meaning;
targets ≥44pt; Reduce Motion honoured (`useReducedMotion()` is already the house
pattern); every control labelled; contrast census enforced.

**Performance.** The current Explore screen is a `ScrollView` (§2). A finite
daily unit may legitimately stay one — *finite* is the reason it can. If the
design implies unbounded content, that is a contract violation, not a reason to
reach for FlashList. First paint must not wait on the network: local content
first, friend content when it lands, which is the Today architecture.

---

## 7 · Visual acceptance requirements

Acceptance is **Simulator evidence**, not assertion:

1. All **five states** (§4) captured at standard text size.
2. S-2 and S-3 captured at **AX-XXXL** Dynamic Type, showing no clipped meaning.
3. Light and dark, if the design specifies both.
4. Reduce Motion on: no animation that conveys information is lost.
5. A **measured** check for any alignment claim — pixel measurement, as with the
   PlaceField baseline (0.00pt delta at both text sizes), not eyeballing.
6. Fixture routes are the mechanism: fixtures live in `src/dev-fixtures/` and are
   mounted with `node scripts/dev-fixtures.mjs on`. **New fixtures go there, never
   in `src/app/`** — `tests/dev-route-exclusion.test.ts` fails the build otherwise.

---

## 8 · Website scope

`web/` is five static pages (`index`, `press`, `privacy`, `support`, `terms`).

- **`privacy.html` — required if and only if** the unit changes what is collected
  or shared. As specified (no new table, no new text, mutual-only) it does not,
  so **no privacy-policy change is expected**. If implementation adds a field,
  the page changes *before* release, not after.
- **`index.html` — optional**, only if Daily Social becomes a marketed feature.
- The repo and the deployed site already differ (submission runbook §C5); this
  unit must not be the thing that silently widens that gap.

---

## 9 · Migration, deploy and release classification

| Dimension | Classification | Evidence |
|---|---|---|
| Migrations | **None expected.** Only if §5.4 dismissal extension is needed. | No new table by design. |
| Edge functions | **None.** No AI call, no server compute. | The unit is a read of existing data. |
| Native | **None.** No new package, no config plugin, no permission. | Keeps runtime `d9cb8c3b…`. |
| Release | **JS-only → OTA**, reaching builds 37/38. | Verify with `npm run check:fingerprint` and `-- --verify-control` before publishing. |
| Gate | `tests/fingerprint-gate.test.ts` fails if any fingerprint input moves. | Adding an npm script or `.gitignore` line **would** move it. |

**If any row above changes, the release classification changes with it** — a new
package or permission means a Store build, not an OTA, and that is a founder
decision about timing.

---

## 10 · Claude Design atlas brief — ready to send

> **Cinch — Daily Social atlas**
>
> Draw one surface: the daily read of what a small circle of mutual friends
> wore. Cinch is a private wardrobe app; this is the only place another person's
> clothes appear day to day. It is not a public feed — there are no followers,
> no counts, no strangers, and no comments.
>
> **The person.** Keeps their own closet in Cinch. Has one to a dozen mutual
> friends who do too. Opens this once a day, out of affection rather than
> obligation, and wants it to end.
>
> **Draw these six frames.**
>
> | # | Frame | Requirement |
> |---|---|---|
> | DS-01 | **Nothing yet** — no mutual friends | An invitation, not an error. No stranger suggestions, no "people you may know". |
> | DS-02 | **Quiet day** — friends, nothing new | The day was quiet; that is a fine outcome. Must not read as broken or as empty-state failure. |
> | DS-03 | **The day** — 3–5 friends' looks | The substance. Ordered, finite, clearly ending. |
> | DS-04 | **Caught up** — the end | Terminal and satisfying. Copy is fixed: *"You're caught up with your circle."* Nothing may suggest more content exists. |
> | DS-05 | **Offline / couldn't load** | Says *offline*, distinctly from DS-02's *quiet*. Two different sentences. |
> | DS-06 | **A reaction being given** | From a small fixed set. Private between the two people. No count, no public tally, no text field. |
>
> **Hard constraints.**
> - **No free text anywhere.** No comment box, no caption field.
> - **No counts of people** — no follower, like or view totals.
> - Reactions are private to the pair. Nothing implies an audience.
> - It ends. No infinite scroll, no "load more", no pagination affordance.
> - Existing type scale, palette and 12px control radius. `byline` may not be
>   used as text (2.61:1 contrast, banned by the census).
> - Every state must survive **AX-XXXL Dynamic Type** — draw DS-02 and DS-03 at
>   that size as well, so eight frames total.
>
> **Deliver** as the usual paired export: `design-refs/html/DS-*.dc.html` plus
> `design-refs/png/DS-*/` from the same run, so the PNG cannot disagree with the
> HTML.

---

## 11 · Phase 0 status

Contract frozen at `86c1b2b`. No code, migration, package, service or public
surface changed. Next action is the §10 brief; implementation begins only once
an atlas exists and this document has been read against it.

**Open, and owned by the founder, not by implementation:**

1. **The §5.1 visibility toggle is a precondition** — schema shipped, UI never
   did. Daily Social should not show a friend's stats before that friend can
   hide them.
2. **Reaction vocabulary** is a product decision. The contract fixes that it is
   small, fixed and private; it does not choose the set.
3. **Cadence** — whether the existing `friend_activity` push becomes this unit's
   front door, or stays independent.
