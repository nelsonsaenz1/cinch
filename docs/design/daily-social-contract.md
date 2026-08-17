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
| "Friends can see what you wore" | **False, and there is no path at all.** `outfits` is owner-only select; its one non-owner policy needs `is_public`, which defaults `false` and which **nothing in `src/` ever writes** (the only two mentions are comments at `explore.tsx:121` and `explore/queries.ts:20` explaining the projections are unreachable). No view exposes a friend's outfit — `friend_items` is items-only, `event_post_items` is event-scoped. | The unit's core premise required a read path that did not exist. §5.4 defines the smallest one; it is why this contract now carries a migration. |
| "Push already nudges friends" | True, and further along than the UI — `push_claim_friend_activity()` (`20260810110100_push_senders.sql:160`) already batches follow-backs and new pieces into one daily-shaped notification. | The daily cadence is already **half-built in the backend**. Daily Social should be its destination, not a parallel mechanism. |

**The headline, revised.** The backend for a daily social *rhythm* largely
exists and is private by default. What was missing is larger than first written:
a surface, a visibility control users can actually reach — now shipped, §11 —
any measurement at all, **and the friend-worn read path itself, which did not
exist in any form.**

---

## 3 · Conservative product decisions (private by default)

Each is the more restrictive option, chosen deliberately.

1. **Mutual-only, always.** Content enters the daily unit only between mutual
   follows with no block in either direction. Never one-way.
2. **Nothing new becomes public.** This unit adds no column whose default widens
   visibility. `is_public` stays `false` (`:35`, `:243`), `profiles.visibility`
   stays `'private'`, events stay `'invite_only'` (`20260807101000_events.sql:28`).
3. **Sharing what you wore is opt-in, defaults OFF, and is never retroactive.**
   *(Approved after the §5.4 correction; boundary added after the
   acceptance-critical review.)* `profiles.worn_outfits_shared_since` is null by
   default, and the view requires `worn_at >= worn_outfits_shared_since`, so
   **turning sharing on shares what you wear from that moment — never what you
   already wore.** A boolean alone would have exposed up to a week of history on
   the first tap. Off and on again starts a new boundary, so the gap is never
   backfilled, and a `before update` trigger sets the instant because an owner
   can otherwise backdate their own row. This is the opposite default from the four §5.1
   flags, and deliberately: those preserved behaviour that already shipped,
   this creates a path that never existed. New exposure starts closed. It is
   also mutual-only, never public, and it expires after seven days.
4. **The visibility controls ship first, inside this packet.** *(Decision 1,
   resolved.)* Daily Social must not surface a friend's closet or stats before
   that friend can turn them off. Not a follow-on and not a separate packet —
   sequenced first within this one. §5.1. **Shipped and live** — see §11.
5. **Exactly three reactions, fixed, private to the pair.** *(Decision 2,
   resolved.)* A reaction is visible to its author and to the owner of what was
   reacted to, and to nobody else. **No counts, no public aggregation, and no
   negative signal** — there is no dislike, no downvote, no "meh". Three is the
   number: enough to mean something, too few to become a rating scale.
   Consistent with the private ratings already shipped on Today.
6. **No new text surface.** The unit ships **no free-text field**. Reactions are
   from the fixed set of three. This removes UGC moderation, text filtering and
   abuse review from the unit entirely; `20260808005513_ugc_text_filter.sql`
   stays scoped to the surfaces that already have text.
7. **Daily means finite.** The unit has an end, and says so
   (`CAUGHT_UP_LINE`). It never paginates into infinity.
8. **In-app first; push stays independent.** *(Decision 3, resolved.)* The
   existing `friend_activity` sender (`20260810110100_push_senders.sql:160`)
   continues to run exactly as it does today, on its existing preference and its
   existing schedule. Daily Social **does not** become its destination in this
   packet, **does not** add a notification category, **does not** request a new
   permission, and **does not** change any default push behaviour. The unit is
   something you open, not something that taps you on the shoulder. Whether the
   two ever join up is a later question, and deliberately not this packet's.
9. **A block is total and immediate.** Already enforced at the data layer
   (`20260807120000_event_content_block_filter.sql`, `20260809150305_block_retracts_votes.sql`);
   this unit adds no read path that bypasses it.

---

## 4 · Flow and state map

**Entry.** Tab, once a day. Optionally from the existing `friend_activity` push.

**The six states.** Every one must be drawn; five are failure or emptiness, and
those are where the unit is actually judged. S-1 split in two once sharing
became opt-in and default off: with nobody sharing yet, "no friends" and
"friends who have not turned it on" are different problems with different
actions, and the second is the state most people meet on day one.

| # | State | Condition | What it says |
|---|---|---|---|
| S-1a | **No circle** | No mutual friends | Invite path. Never a stranger suggestion. |
| S-1b | **Nobody sharing yet** | Mutuals exist, none has `worn_outfits_shared_since` set | Invites *you* to go first, not to invite more people. The only state whose action is about yourself. |
| S-2 | **Quiet day** | Friends exist, nothing new since last read | The caught-up line, and the date it covers. Not an error, not empty-styled. |
| S-3 | **The day** | 1–N items from mutuals | The unit's substance. Finite, ordered, ends in the caught-up line. |
| S-4 | **Caught up** | Reached the end of S-3 | Terminal. No infinite scroll, no "load more". |
| S-5 | **Offline / failed** | Query failed or device offline | Distinguishes *offline* from *nothing happened* — the same distinction Today now draws between `styling_timeout` and `styling_offline` (`src/features/styling/use-outfits.ts`). Never blames the network for emptiness. |

**Transitions.** S-1a → S-1b on first mutual; S-1b → S-2 when any mutual opts in. S-2 ⇄ S-3 by content. S-3 → S-4 by
reaching the end. Any → S-5 on failure, and back without losing scroll position.

**Per-item states.** Unseen → seen (the `unseen.ts` / `use-explore-unseen.ts`
machinery already exists and must be reused, not reimplemented) → reacted
(optimistic, reversible) → dismissed.

---

## 5 · Route / component / data / RLS / analytics / test map

### 5.1 Precondition — the visibility controls *(in this packet, first)*

**Blocking, and inside this packet.** No friend-facing Daily Social surface may
be built until this is shipped and green.

**Scope — four flags, not three.** `profiles.closet_hidden`,
`stat_pieces_hidden`, `stat_wears_hidden` **and `stat_cost_per_wear_hidden`**
(`20260808110000_friend_closet_privacy_layer.sql:22-25`). The fourth was not in
the instruction's phrasing and is included deliberately: cost-per-wear implies
what someone paid for their clothes, which is the most sensitive of the four.
Shipping a privacy control that covers three of them and silently omits the
money one would be the wrong omission to make.

**Why this is cheap.** Everything except the control already exists:

- **Read-path enforcement is already immediate.** `friend_items` filters
  `where p.user_id = i.user_id and not p.closet_hidden` (`:50`), and
  `friend_closet_meta` nulls each stat behind
  `case when p.closet_hidden or p.stat_*_hidden` (`:78-83`). A flag flips and
  the next read is already correct — no cache to invalidate, no backfill.
- **The write path is already authorised.** The migration records it: "Table-level
  grants on profiles (20260806100000) cover the new columns; owner RLS already
  scopes writes" (`:18-19`).
- **The control primitive already ships.** `src/components/ui/settings-row.tsx`
  with a `Switch`, the pattern `src/app/settings.tsx:226` already uses. **No new
  atlas frame is required for this** — it is an existing row in an existing
  screen, which is why it is not in the §10 brief.

**Therefore: no migration, no RLS change, no new component.** UI plus a mutation.
The release classification in §9 is unaffected.

**Defaults — the one interpretation made here, flagged for cheap correction.**
"Owner defaults remain private" is read as *keep today's defaults*:

| Boundary | Default today | After this packet |
|---|---|---|
| Public / strangers | `profiles.visibility = 'private'` (`20260803210000:230`); `is_public = false` | **unchanged** |
| Mutual friends | four flags default `false`, i.e. closet and stats **visible to mutual friends** | **unchanged default**, now switchable by the owner |

The alternative reading — flipping the four flags to default `true` — was not
taken, because it would retroactively hide content from friends who can see it
today. That is a silent regression for existing users, and this codebase's rule
is that behaviour changes are announced, not inflicted. Flipping them later is
one migration and a decision; the control has to exist either way. **If the
intent was the stronger default, say so and it is a small change to make now
rather than after the atlas.**

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

### 5.4 Data — CORRECTED

> **This section previously said "No new table" and §5.5 said "No new policy
> should be needed". Both were wrong, and wrong at the premise.** Checked
> against source: `outfits` is owner-only select, its one non-owner policy
> requires `is_public` which defaults `false` and which **nothing in `src/`
> ever writes**, and no view exposes a friend's outfit — `friend_items` is
> items-only, `event_post_items` is event-scoped. **There is no data path for
> "what my friends wore" at all.** The unit's whole premise needed one.
>
> No existing table can hold the reactions either: `outfit_reactions` is
> owner-only RLS (the owner of what was reacted to could never see it), its
> domain is `check (reaction in (-1, 1))` — it *is* the negative signal §3.4
> forbids — and it is the styling learner's training corpus. `closet_likes` is
> `for select to anon, authenticated using (true)`, world-readable, and has no
> reaction kind. `event_outfit_votes` is one-vote-per-event contest semantics.

**The approved model: opt-in, default hidden, mutual-only, seven days.** One
migration, four objects.

| Object | Shape | Why |
|---|---|---|
| `profiles.worn_outfits_shared_since` | `timestamptz`, **null by default** | The control and the boundary in **one column**: null means not sharing, non-null means sharing since exactly that instant. One column cannot disagree with itself; a boolean beside a timestamp can, and the disagreeing state (`true` + null) is the one that fails open. |
| `friend_worn_outfits` | view, `security_invoker = false` | `o.worn_at is not null and p.worn_outfits_shared_since is not null and o.worn_at >= p.worn_outfits_shared_since and o.worn_at > now() - interval '7 days' and not p.closet_hidden and is_friend(o.user_id)` |
| `profiles_worn_outfits_boundary` | `before update` trigger | The database sets the instant, never the client. See below. |
| `friend_worn_outfit_items` | view | Joins `outfit_items` to the view above, `where exists (select 1 from friend_items fi where fi.id = oi.item_id)` — **adds no new item exposure**; a piece the owner hid stays hidden inside a shared look. |
| `daily_social_reactions` | table | `(outfit_id, reactor_id)` primary key, `owner_id` denormalised, `reaction text check (… three values …)`. No count column and no aggregate view. |

#### The boundary — why a boolean alone is a privacy bug

A boolean plus a seven-day window **retroactively exposes up to a week of
already-worn looks the moment sharing is switched on.** That directly
contradicts what DS-01b and DS-07 promise a person: turning this on shares what
you wear *from now*, not what you already wore. Two windows are therefore
required and both are `and`-ed in the view:

```
o.worn_at >= p.worn_outfits_shared_since   -- nothing from before you opted in
o.worn_at >  now() - interval '7 days'     -- and nothing older than a week
```

**Off → on always starts a new boundary.** Turning sharing off and on again must
not re-expose what was worn while it was off, so the instant is rewritten on
every transition rather than remembered:

| Transition | Stored `worn_outfits_shared_since` |
|---|---|
| off → on (`null` → non-null) | **`now()`** — the client's value is discarded |
| on → off (non-null → `null`) | `null`; everything stops crossing immediately |
| on → on (no transition) | **unchanged** — never advanced, so a stray write cannot silently retract looks friends can already see |

**The trigger is not a courtesy — it is the enforcement.** `profiles: owner can
update` (`20260803154431_initial_schema.sql:60`) is a plain RLS policy, so an
owner can write any value into any column of their own row, including a
timestamp dated 2020, which would expose their entire history. A
`before update` trigger on `profiles` overrides whatever arrives with the rule
in that table — the client expresses *on* or *off*, the database decides *when*.
Precedent for the shape: `profiles_set_updated_at` (`:328`).

There is deliberately **no client-side date filtering.** The house rule from
`unwear_outfit_tx` applies exactly: a client-side check is a courtesy; this is
the rule.

**Four columns cross, and the omissions are the design:** `id`, `user_id`,
`name`, `worn_at`. Not `reasoning` (model prose about the owner's day), not
`context_snapshot` (weather, location, event titles), not `note` (500 characters
of private diary), not `rating` / `wear_rating` / `favorited_at` (private taste,
shipped deliberately private), not `saved_at` / `board_id` / `origin_outfit_id`.
A daily read needs what they wore and when.

#### A look is a collage, not a photograph

**DS-03 renders an in-app collage assembled from the friend's item images that
already cross** — `thumb_path`, `cutout_path`, `plate_path`, projected by
`friend_items` and reached through the same signed links the app already uses
for a friend's closet. `friend_worn_outfit_items` supplies which pieces; the
composition happens on the device.

**There is no "look photo".** This unit adds no capture step, no upload, no
storage bucket, no image moderation surface, and no camera or library
permission. That is not a simplification — a user-supplied photograph of
themselves is a different product with a different privacy contract, a different
review obligation under the App Store's UGC rules, and a different deletion
story. Nothing in Daily Social requires one.

A consequence worth drawing rather than discovering: a piece whose owner has
hidden it never enters the collage, so a shared look can legitimately render
with **fewer pieces than were worn**. The frame must not read as broken when
that happens.

`is_friend()` (`20260807100000_social_graph_blocks_borrow.sql:102`) already means
mutual follows, not blocked, not self, so the block rule is inherited rather than
restated.

### 5.5 RLS — CORRECTED

New policies **are** required, and the old rule — "if a new policy is required,
the design is reaching for data the unit should not have" — was a good instinct
applied to the wrong question. It is right about *reusing* data and wrong about
*creating* a path. The safeguard is kept in a form that still bites: the new
path is opt-in, defaults off, expires, and carries the four narrowest columns.

```
reactor can select   using (auth.uid() = reactor_id)
owner   can select   using (auth.uid() = owner_id)
reactor can insert   with check (auth.uid() = reactor_id
                       and exists (select 1 from friend_worn_outfits f
                                    where f.id = outfit_id and f.user_id = owner_id))
reactor can update/delete  using (auth.uid() = reactor_id)
grant select on friend_worn_outfits, friend_worn_outfit_items to authenticated;  -- never anon
```

The insert check routes through the view, so **you can only react to something
you can currently see**. Sharing turned off means no new reactions, with no
second rule to keep in sync.

"No public aggregation" is enforced by there being nothing to aggregate: no
count column, no aggregate view, and RLS that shows a reactor only their own
row and an owner only their own outfits'.

#### The pgTAP matrix — `supabase/tests/18_daily_social.sql`

The `database` CI job is the only thing that observes RLS, and — as
`17_closet_visibility.sql` proved by failing on its first run — it is also the
only thing that observes these files at all. Twenty-one cases. Sixteen through twenty-one exist because a boolean alone would have shipped a retroactive-exposure bug that no client test could catch:

| # | Case | Expected |
|---|---|---|
| 1 | default account, mutual friend reads | **0 rows** — nothing shared retroactively |
| 2 | owner opts in | their worn outfits appear to the friend |
| 3 | non-friend / one-way follow | 0 rows |
| 4 | blocked either direction | 0 rows |
| 5 | opted in but `closet_hidden` | 0 rows |
| 6 | worn 8 days ago | 0 rows — expiry is SQL, not client |
| 7 | `worn_at is null` | 0 rows |
| 8 | item hidden from friends | look appears, that piece does not |
| 9 | friend inserts a reaction | succeeds |
| 10 | owner turns sharing off, friend inserts | **refused** |
| 11 | stranger inserts | refused |
| 12 | third friend selects another's reaction | 0 rows — pair-private |
| 13 | owner selects reactions to their own outfit | visible |
| 14 | `anon` selects either view | refused |
| 15 | reactor updates their own reaction | succeeds, still one row |
| **16** | **owner wears, THEN turns sharing on** | **0 rows — the prior look is never exposed** |
| **17** | owner turns sharing on, then wears | that look appears |
| **18** | **on → off → wear → on again** | the look worn while off **never appears**; the boundary advanced |
| **19** | **owner writes a backdated `worn_outfits_shared_since`** | **trigger overrides it with `now()`; history stays hidden** |
| **20** | on → on (no transition), stray write | boundary **unchanged**; already-visible looks are not retracted |
| **21** | look after the boundary but older than 7 days | 0 rows — both windows apply |

Rows are created by `on_auth_user_created`, never inserted into `profiles`
directly — the trigger already makes them, and inserting again is the
duplicate-key error that took `17_closet_visibility.sql` two CI runs to learn.

### 5.6 Analytics — the first social events

Cinch's taxonomy has **no social events**. Proposed minimum, matching the
existing `snake_case` verb-past convention:

| Event | Properties | Question it answers |
|---|---|---|
| `daily_social_opened` | `item_count`, `state` (S-1…S-5) | Is it worth opening? Which state do people actually meet? |
| `daily_social_completed` | `items_seen`, `reached_end` | Does "finite" work — do people reach the end? |
| `daily_social_reacted` | `reaction` (one of the three) | Is the fixed set the right set — and is one of the three dead weight? |
| `closet_visibility_changed` | `flag`, `hidden` (bool) | Do owners actually use the §5.1 controls, and which of the four? |
| `worn_outfits_sharing_changed` | `shared` (bool) | Does anyone opt in? With a default of off, this is the number the unit lives or dies on. |
| `daily_social_empty` | `reason` (`no_friends` / `nobody_sharing` / `quiet_day`) | Three different emptinesses, and only one of them is a content problem. |

**No user id, friend id, outfit id or item id in any property**, and
`daily_social_reacted` carries which of the three and nothing about who or what.
Consistent with the manual-screen-view rule at `src/app/_layout.tsx` ("joined
segments are stable route identifiers, never params").

**No event fires on viewing a particular friend's look.** That would rebuild a
record of who looks at whom, which is the thing this unit exists not to be —
and it would do it in a third-party analytics store, which is worse than doing
it in the database.

### 5.7 Tests

| Layer | Where | Must assert |
|---|---|---|
| Feed logic | `tests/` node suite | Ordering, finiteness, caught-up boundary, unseen transitions. Pure functions, no renderer — house style. |
| Privacy | `supabase/tests/*.sql` (pgTAP) | The twenty-one-case matrix in §5.5, `18_daily_social.sql`. A default account shares nothing; a non-mutual and a blocked pair see nothing; an expired look is gone; a reaction is pair-private. |
| Copy | `tests/` | No em-dash/placeholder violations; the six states each have distinct copy — S-1a, S-1b and S-2 are three different emptinesses and must not share a sentence. |
| A11y | `tests/` | Reaction targets ≥44pt; every control has an `accessibilityLabel` — the pattern in `tests/event-detail-ax.test.ts`. |
| Contrast | `tests/contrast.test.ts` | Any new colour pairing passes the frozen census (`src/theme/contrast.ts`). `theme.byline` remains banned as text (2.61:1). |

---

## 6 · Privacy, deletion, expiry, block, offline, accessibility, performance

**Privacy.** Mutual-only; read through the privacy views; no new public column;
no free text (§3.5). The §5.1 toggle is a precondition.

**Deletion — covered by construction, though the unit now does add a table.**
Every foreign key on `daily_social_reactions` is `on delete cascade` to
`auth.users`, so `delete-account` (v30, ACTIVE), which deletes the auth user,
takes the reactions with it. `unwear_outfit_tx` deletes the `outfits` row and the
reactions cascade; deleting a saved plate is the same. **Nothing new for deletion
to miss, and no sweep to forget to write.**

**Revocation is immediate, and re-enabling is not a reopening.**
`worn_outfits_shared_since` is read per query, exactly like the four §5.1 flags —
turn it off and the next read is already correct. Turning it back on starts a
fresh boundary at `now()`, so nothing worn during the off period is ever
backfilled into a friend's feed. Past
reactions remain readable to their own pair and stop being reachable through the
feed, because the outfit has left the view.

**Expiry — seven days, in SQL.** `friend_worn_outfits` carries
`o.worn_at > now() - interval '7 days'`, so a look leaves the friend layer on its
own and no sweep job is needed. Seven days is an existing precedent in this
schema rather than a new number. The unit is *daily*: content ages out of the
day, it is not retained as a feed. Precedent windows in this schema are `24 hours`, `7 days`, `14 days`;
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

1. All **six states** (§4) plus the DS-07 sharing switch, captured at standard text size.
2. S-2, S-3 and DS-07 captured at **AX-XXXL** Dynamic Type, showing no clipped meaning.
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
| Migrations | **One, required.** `worn_outfits_shared_since`, its boundary trigger, two views, `daily_social_reactions`, their grants and RLS, plus `supabase/tests/18_daily_social.sql`. §5.4/§5.5. The §5.1 precondition needed none and is already live. | The read path did not exist; it cannot be derived. |
| Deploy order | **Migration first, then OTA.** The client reads objects that must already exist. | A JS bundle that queries a missing view fails closed, but noisily. |
| Edge functions | **None.** No AI call, no server compute. | The unit is a read of existing data. |
| Native | **None.** No new package, no config plugin, no permission. | Keeps runtime `d9cb8c3b…`. |
| Release | **Client is still JS-only → OTA**, reaching builds 37/38. Verified: no `supabase/` path is a fingerprint input, so a migration does not move the runtime. | Verify with `npm run check:fingerprint` and `-- --verify-control` before publishing. |
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
> **Sharing is opt-in and defaults off.** Nothing anyone has already worn
> becomes visible to anyone; a person's looks cross only after they turn it on,
> only to friends they follow back, and only for seven days.
>
> **Draw these eight frames.**
>
> | # | Frame | Requirement |
> |---|---|---|
> | DS-01a | **No circle** — no mutual friends | An invitation, not an error. No stranger suggestions, no "people you may know". |
> | DS-01b | **Nobody sharing yet** — mutuals exist, none has turned it on | The state most people meet on day one. Its action is about *you*: go first. Not "invite more people", which is the wrong answer to this problem. |
> | DS-02 | **Quiet day** — friends, nothing new | The day was quiet; that is a fine outcome. Must not read as broken or as empty-state failure. |
> | DS-03 | **The day** — 3–5 friends' looks | The substance. Ordered, finite, clearly ending. **A look is drawn as an in-app collage of that friend's own garment images** — the same cutouts and thumbnails their closet already shows you. It is never a photograph of a person, and there is no upload. Draw at least one look with a piece missing, because a hidden piece is simply absent and the frame must not read as broken. **A look is the pieces, the outfit's name, and when it was worn — nothing else.** Not the reasoning, not the note, not the weather or occasion, not any rating or favourite, not cost per wear. A piece its owner has hidden from friends does not appear even inside a shared look. |
> | DS-04 | **Caught up** — the end | Terminal and satisfying. Copy is fixed: *"You're caught up with your circle."* Nothing may suggest more content exists. |
> | DS-05 | **Offline / couldn't load** | Says *offline*, distinctly from DS-02's *quiet*. Two different sentences. |
> | DS-07 | **Your own sharing switch** | Off by default, and the room the whole unit depends on. It must say plainly that sharing starts **from now**: friends you follow back will see what you wear **from the moment you turn it on**, for seven days at a time — never anything you already wore, and never the note, the weather, the rating, the occasion, or what it cost. Do not write copy implying a week of your history is about to appear, because it will not. |
> | DS-06 | **A reaction being given** | **Exactly three** reactions, fixed. Private between the two people. No count, no tally, no text field. Show the resting state and the chosen state. |
>
> **Nothing may imply that sharing is on by default**, or that a friend's looks
> are already waiting. On day one they are not.
>
> **Name the three reactions.** This is the one naming decision delegated to the
> atlas. They must be **short** — one or two words, Cinch's voice: plain,
> specific, never marketing. All three are **positive or neutral; none may be
> negative.** There is no dislike, no downvote, no "not for me". Think closer to
> *noticing* than to *rating* — three different ways of saying "I saw this and
> it was worth seeing", not three points on a scale. Draw them as they would
> actually appear, and give the reasoning for the set in one line each.
>
> **Hard constraints.**
> - **No free text anywhere.** No comment box, no caption field.
> - **No counts of people** — no follower, like or view totals.
> - **Exactly three reactions.** Not four, not a picker, not an emoji tray.
> - **No negative reaction of any kind**, and nothing that reads as a score.
> - Reactions are private to the pair. Nothing implies an audience.
> - **No photograph of a person, and no upload affordance anywhere.** Looks are
>   collages of garment images the app already has. No camera button, no "add a
>   photo", no avatar-on-the-look.
> - **Nothing that looks like a notification.** No badge, no bell, no "3 new".
>   This surface is opened, never pushed; the daily push that exists is separate
>   and stays that way.
> - It ends. No infinite scroll, no "load more", no pagination affordance.
> - Existing type scale, palette and 12px control radius. `byline` may not be
>   used as text (2.61:1 contrast, banned by the census).
> - Every state must survive **AX-XXXL Dynamic Type** — draw DS-02, DS-03 and
>   DS-07 at that size as well, so **eleven frames total**.
>
> **Deliver** as the usual paired export: `design-refs/html/DS-*.dc.html` plus
> `design-refs/png/DS-*/` from the same run, so the PNG cannot disagree with the
> HTML.

---

## 11 · Phase 0 status — three decisions resolved, one premise corrected

Contract frozen at `86c1b2b`, amended before atlas submission. No code,
migration, package, service or public surface changed.

| # | Decision | Resolution | Where |
|---|---|---|---|
| 1 | Visibility controls | **Required precondition, inside this packet**, shipped before any friend-facing surface. Four flags. Read-path enforcement is already immediate; no migration, no RLS change, no new component. | §3.3, §5.1 |
| 2 | Reactions | **Exactly three**, fixed, private to the pair. No counts, no free text, no negative signal, no public aggregation. The atlas names them, short, in Cinch voice. | §3.4, §5.6, §10 |
| 4 | Worn-outfit exposure | **New private read path, opt-in, default off, mutual-only, seven days.** No public access, no reuse of learner/like/vote tables. | §3.3, §5.4, §5.5 |
| 5 | **Non-retroactivity** | **`worn_outfits_shared_since` boundary, trigger-set, `worn_at >= boundary` enforced in the view.** A boolean alone would have exposed a week of history on the first tap — caught in acceptance review, before implementation. | §3.3, §5.4, §5.5 (cases 16–21) |
| 6 | **What a look is** | **An in-app collage of garment images that already cross.** No look photo, no upload, no bucket, no camera permission, no image-moderation surface. | §5.4, §10 |
| 3 | Push | **Stays independent.** `friend_activity` runs unchanged; Daily Social is in-app first, adds no notification category, no permission, no default push behaviour. | §3.7, §10 |

### Amendment, after read-only preparation against `4a95431`

Two sections of this contract were **wrong at the premise** and are corrected
above rather than quietly patched: §5.4 said "no new table" and §5.5 said "no new
policy should be needed". Checked against source, there is no data path for a
friend's worn outfit at all, and no existing table can hold a pair-private
reaction — `outfit_reactions` is owner-only RLS with a `(-1, 1)` domain that *is*
the negative signal §3.5 forbids, `closet_likes` is world-readable to `anon`, and
`event_outfit_votes` is contest semantics.

The approved resolution is the privacy-first one: a new read path that starts
closed. `worn_outfits_shared_since` is null by default and the view requires
`worn_at >= worn_outfits_shared_since`, so no existing wear is exposed
retroactively — a boolean alone would have exposed a week of it on the first tap; the view is mutual-only via `is_friend()`, carries four columns,
and expires at seven days in SQL. §5.4, §5.5, §6 and §9 now say so, and §10 gains
DS-01b and DS-07 because a default of off changes which frames matter.

**Build order, now fixed.** §5.1 controls (**done — live on `4a95431`, OTA
`01a00d04…`**) → revised atlas accepted → migration → friend-facing surface.
Implementation of the surface does not begin until the revised PNG/HTML atlas
lands and is read against this document.

**One interpretation to confirm — cheap to change now, expensive later.**
"Owner defaults remain private" is implemented as *keep today's defaults*: private
at the public boundary (unchanged), visible to mutual friends by default, now
switchable. Flipping the four flags to default-hidden would retroactively hide
content from friends who can see it today, which is a silent regression this
codebase's culture does not permit without saying so. §5.1 has the table and the
alternative. **If the stronger default was intended, that is one migration and a
release-note line, and it should be decided before the surface exists rather than
after.**

Nothing else is outstanding. The next action is the §10 brief.
