# Private Circles — read-only preparation against `6b6d6aa`

**Status.** Preparation only. No product code, no migration, no client change, no
production mutation. Written while the Private Circles atlas renders against the
shipped Daily Social system. Every claim below is cited to a file and line in
current `main`; where the audit contradicts an assumption, the contradiction is
stated rather than smoothed over.

**Sequence.** This document ends at a handoff gate. Implementation begins only
when the atlas arrives. The Activity and Saves designs that follow Private
Circles are untouched and unanticipated here — §7 records the two places where a
Phase 0 shortcut would quietly spend their design space, so that neither is
foreclosed.

---

## 1 · The audit, and the four findings that change the shape

### Finding A — "circle" is already a shipped word, and it means something else

`Your circle` is live copy for **your mutual friends**: the standing link at the
foot of Explore (`src/app/(tabs)/explore.tsx:362`), the row-menu action
(`src/features/explore/contextual-actions.ts:92`), a `screen-header` colophon
(`src/components/ui/screen-header.tsx:36`), the Plan surface
(`src/app/(tabs)/plan.tsx:439`), and the Daily Social copy shipped hours ago —
*"You're caught up with your circle."*, *"Nobody in your circle has worn anything
new."*

A **Private Circle** is a named, bounded, invite-only group. If both ship under
the word "circle", the app says "your circle" to mean two different populations
on adjacent screens, and the Daily Social copy silently becomes ambiguous the
day Private Circles lands.

**This is a naming decision for the atlas, and it is load-bearing rather than
cosmetic.** Either the group takes a different word, or the existing friend-graph
copy is renamed — which is a copy migration across five shipped surfaces plus the
`tests/daily-social-copy.test.ts` and `cx-corrections.test.ts` pins. It is much
cheaper to decide before the atlas fixes the vocabulary than after.

### Finding B — the closest existing construct is `event_members`, not the invite system

The invite link is **account-level and deliberately codeless**
(`20260810120100_invite_links.sql:1-14`): *"There is no invites table, and that
is the design rather than an omission… the handle is the link."* It records only
`profiles.invited_by` / `invited_at`, written once at arrival. It cannot express
"invited to a thing", has no state, and no revocation.

What *does* express bounded invite-only membership is `event_members`
(`20260807101000_events.sql:47-62`): a `(event_id, user_id)` primary key,
`role` (`host` | `attendee`), `state` (`invited` | `joined` | `declined` |
`removed`), `invited_by`, and a `before update` trigger `assert_member_transition`
(`:157-178`) that permits **only** these transitions:

- **self**: `invited|declined → joined|declined`
- **owner**: any → `removed`, and nothing else
- and refuses any change to the primary key or to `role` outright.

Private Circles should be that shape. It should **not** mint per-circle invite
codes: that is the row nobody asked for and the thing to revoke that nobody
wanted revocable, and the invite-links file already argues the case.

### Finding C — a block permanently severs, and the existing cascade is owner-asymmetric

`on_block_sever_graph` (`20260809160000_block_retracts_votes.sql:48-88`) does
three things on block insert: deletes **both** follow edges, deletes the blocked
account's votes on the blocker's own posts, and sets `event_members.state =
'removed'` for events **the blocker hosts**.

Two consequences the design must absorb:

1. **Unblocking restores nothing.** The follow edges are gone; the pair are no
   longer mutual friends. (`supabase/tests/18_daily_social.sql:134-164` records
   this in the file that learned it by failing six assertions on it.)
2. **The cascade is one-directional by design** — it protects the *blocker's*
   spaces. A blocked user who *hosts* an event the blocker joined is handled by
   RLS hiding, not by removal.

For a circle this asymmetry has to be answered explicitly: if A blocks B, is B
removed from A's circle only, or are the two separated in **every** circle they
share, including one owned by C? The events answer is "only the blocker's own",
and the safety contract (`docs/design/system-safety-contract.md §2`) records
what the cascade deliberately does *not* do. A third-party circle is a case
events never had, because an event has exactly one host and a shared circle can
have a third owner.

**Recommendation to the atlas: separation in a third party's circle is a
different promise from removal, and should not be inferred.** Whatever is
chosen, the copy must not claim more than the trigger does — that is the exact
failure `block_retracts_votes` was written to correct.

### Finding D — the four visibility flags and the sharing boundary must AND, not OR

`friend_items` (`20260811150000_commerce_preferences.sql:48-63`) and
`friend_worn_outfits` (`20260817000000_daily_social.sql:93-106`) both gate on
`not p.closet_hidden` **and** `is_friend(...)`. `worn_outfits_shared_since` adds
the non-retroactive boundary. `profiles.visibility` defaults `'private'`
(`20260803210000_styling_learning_social.sql:225-230`) and nothing in `src/` ever
writes `is_public`.

A circle is a **narrower** audience than mutual friends, not a wider one. So any
circle-scoped read path must be the **intersection** of circle membership and the
owner's existing flags — never a bypass. A circle that shows a hidden closet
because "they chose to be in my circle" would retroactively widen a boundary the
owner set for a different audience, which is the same class of bug the
`worn_outfits_shared_since` correction caught before it shipped.

---

## 2 · What already exists and is reusable

| Need | Exists | Where |
|---|---|---|
| Mutual friendship predicate | `is_friend(uuid)` — mutual follows, not blocked, not self | `20260807100000:102` |
| Block predicate | `blocked_between(a,b)` | `20260807100000:94` |
| Bounded membership with roles/states | `event_members` + enums | `20260807101000:14-62` |
| Recursion-safe membership predicates | `is_event_member` / `is_event_host` / `can_see_event`, all `security definer set search_path = ''` | `20260807101000:67-89` |
| State-machine enforcement | `assert_member_transition` | `20260807101000:157-178` |
| Invite rate limiting | `enforce_social_rate_limits` — 100 invites/day per inviter | `20260807103000:189-227` |
| Terms gating on social writes | `assert_social_terms`, INSERT-only, `current_user = 'authenticated'` | `20260808101000:51-103` |
| Account deletion | `on delete cascade` to `auth.users`; `delete-account` deliberately enumerates nothing | `supabase/functions/delete-account/index.ts:30-33` |

**Nothing named circle, group, crew or squad exists in the schema.** This is
greenfield membership, on a very well-worn pattern.

---

## 3 · The smallest private invite-only 2–12 model

Five objects. Membership **only** — no circle-scoped content in Phase 0, because
what flows through a circle is exactly what the atlas is deciding, and a content
table built before that answer is a table built to be rewritten.

| # | Object | Shape | Why this and not more |
|---|---|---|---|
| 1 | `circles` | `id`, `owner_id`, `name`, `created_at`, `updated_at` | **No visibility enum.** `events` needs one because it has two kinds; a Private Circle has exactly one. An enum with a single value is a future public mode nobody has approved. No description, avatar or cover — none is required to prove the model. |
| 2 | `circle_members` | `(circle_id, user_id)` PK, `role` (`owner`\|`member`), `state` (`invited`\|`joined`\|`declined`\|`removed`), `invited_by`, timestamps | Mirrors `event_members` exactly, so the state machine, the rate limit and the block cascade all have a precedent to copy rather than invent. |
| 3 | `is_circle_member(uuid)`, `is_circle_owner(uuid)`, `can_see_circle(uuid)` | `security definer set search_path = ''`, revoked from `public, anon, authenticated` then granted to `authenticated` | **SECURITY DEFINER is what breaks RLS recursion** — a `circle_members` policy that references circle membership would otherwise re-enter its own policies forever (`20260807101000:64-66` says so in as many words). |
| 4 | `assert_circle_member_transition` | `before update` trigger | Same permitted transitions as events. PK and `role` immutable. |
| 5 | `enforce_circle_size` | `before insert` trigger on `circle_members` | The cap. See below. |

### The cap is 12, and there is no floor

**Counting.** The ceiling must count `joined` **and** `invited`. Counting only
`joined` lets an owner hold 100 outstanding invitations against a 12-seat circle
and makes the twelfth acceptance fail for whoever happens to tap last — a race
the person losing it cannot understand or avoid. Count `state in ('invited',
'joined')` and refuse at the invitation, where the owner can see the cause.

**"2–12" cannot mean a minimum of 2, and this is worth stating plainly.** A
circle necessarily begins with one member — its owner — so a `check` or trigger
enforcing two would make creation impossible, and enforcing it on *departure*
would trap the second-to-last member in a group they want to leave. Two is a
**liveness property, not an invariant**: a circle with one joined member is
valid, and it draws an empty state that asks the owner to invite someone. A floor
in SQL is the wrong instrument, and the frame that carries this belongs in the
atlas.

**Recommended constants, matched to existing precedent rather than invented:**
`12` seats; invite rate limit reuses the existing 100/day per inviter
(`20260807103000:201-205`) rather than adding a second number to keep in sync.

### Owner insertion

Creating a circle should insert the owner's own `circle_members` row as
`(owner, joined)` in the same transaction — an `after insert` trigger on
`circles`. Leaving it to the client means a circle can exist with no members and
no owner row, and every predicate below then has to special-case the owner.

---

## 4 · Lifecycle

| Event | Mechanism | Note |
|---|---|---|
| Create | insert `circles`; trigger inserts owner as `joined` | Owner row is not the client's to write |
| Invite | owner inserts `circle_members` `(invited, member, invited_by = self)` | Refused if blocked either way; refused at 12; terms-gated; rate-limited |
| Accept / decline | member updates own row, `invited\|declined → joined\|declined` | Same transitions as events |
| Leave | member updates own row to… **open question, §6** | Events have no "left" state; `removed` reads as ejection |
| Remove | owner updates row to `removed` | Owner may only remove — never flip someone to `joined` |
| Block | extend `on_block_sever_graph` | Scope is a decision, Finding C |
| Owner departs | **open question, §6** | Transfer, or dissolve |
| Delete circle | owner deletes `circles`; members cascade | |
| Account deletion | automatic — `on delete cascade` on `auth.users` FKs | `delete-account` enumerates no tables on purpose, so a new one is covered the day it is created |
| Data export | **not automatic** | `build-export` is a curated closet export (`assemble.ts:25-26`), not a table dump. Whether circle membership belongs in a person's export is a decision, not an oversight |

---

## 5 · The pgTAP matrix — `supabase/tests/19_private_circles.sql`

The `database` CI job is the only thing that observes RLS, and — as
`17_closet_visibility.sql` and `18_daily_social.sql` both proved by failing on
their first runs — the only thing that observes these files at all. Twenty-two
cases.

**Two traps this file must be written around, both paid for already:**

- `now()` is transaction-constant, so any timeline must be built explicitly
  rather than stamped by a trigger (`18_daily_social.sql:4-12`).
- **Blocking severs the follow edges permanently**, so a test that blocks and
  unblocks must re-insert both `follows` rows or every later assertion about
  that pair silently tests a stranger (`18_daily_social.sql:134-164`).

| # | Case | Expected |
|---|---|---|
| 1 | A new circle has exactly one member, its owner, `joined` | 1 row |
| 2 | A non-member selects the circle | 0 rows |
| 3 | A non-member selects the roster | 0 rows |
| 4 | An invitee sees the circle before accepting | visible — an invitation you cannot see is not one |
| 5 | Owner invites; row lands `invited`/`member` | succeeds |
| 6 | A **member** (not owner) invites | refused |
| 7 | Invitee accepts | `joined` |
| 8 | Invitee declines, then accepts | `joined` — declining is not final |
| 9 | Member sets own role to `owner` | refused |
| 10 | Member sets **another** member's state | refused |
| 11 | Owner sets a member to `joined` | refused — the owner may only remove |
| 12 | Owner removes a member | `removed`, and they lose the roster |
| 13 | A removed member re-selects the circle | 0 rows |
| 14 | Twelfth invitation | succeeds |
| 15 | **Thirteenth invitation** | **refused** — the cap |
| 16 | Cap counts `invited` as well as `joined` | refused at 12 combined |
| 17 | A `removed` row does not consume a seat | succeeds |
| 18 | Blocked pair: owner invites the blocked user | refused |
| 19 | Owner blocks a joined member | member `removed` (per Finding C's resolution) |
| 20 | `anon` selects `circles` or `circle_members` | refused |
| 21 | Circle with one joined member is legal | exists, no error — there is no floor |
| 22 | Deleting the circle removes every member row | 0 rows |

Rows are created by `on_auth_user_created`; nothing inserts into `profiles`
directly.

---

## 6 · Open questions — for the atlas, not for me

1. **The word.** Finding A. Does the group take a new name, or does the friend
   graph give "circle" up? This decides shipped copy on five surfaces.
2. **Must a member be a mutual friend?** Reusing `is_friend` at invite time
   inherits block semantics for free. But re-checking on *read* would mean an
   unfollow silently ejects someone from a group — a second, invisible exit.
   Recommendation: check at invitation, never on read.
3. **Leaving.** `event_members` has no state for it, because nobody leaves an
   event — they decline. A circle is durable and people leave. `removed` reads
   as ejection to anyone looking at the roster. A fifth state (`left`) is the
   honest answer, and it is one enum value rather than a table.
4. **Block scope.** Finding C — the blocker's own circles, or every circle the
   pair shares?
5. **Owner departure.** Transfer to the longest-joined member, or dissolve the
   circle? Dissolve is smaller; transfer is kinder. Both are one trigger.
6. **Does membership appear in a data export?** §4.

---

## 6a · The handoff gate — four validations, then the fan-out

Standing instruction, recorded so execution is mechanical rather than improvised.
Nothing below runs until the atlas arrives.

**Asset capture first, because last time it nearly did not happen.** The Daily
Social atlas returned **403 to WebFetch** and was only readable through the
authenticated browser, and `design-refs/html/` is gitignored (`.gitignore:71-72`),
so no local mirror survived. Capture the supplied source/assets on arrival and
write the record — URL, frame inventory, the resolved vocabulary, and every
constraint — to `design-refs/html/PRIVATE-CIRCLES-ATLAS-SOURCE.md` before
validating anything. A gate run against a document nobody can re-open is not
evidence.

### Gate 1 — Naming, and it is the one that can stop the packet

Confirm the atlas does **not** overload "circle". The friend graph already owns
that word on five shipped surfaces (Finding A). Pass requires one of:

- the group takes a distinct in-app noun, and the standing *"your circle"* copy
  is untouched; **or**
- the atlas renames the friend-graph copy, in which case the packet grows a copy
  migration across `explore.tsx`, `plan.tsx`, `contextual-actions.ts`,
  `screen-header.tsx` and the Daily Social strings, plus the
  `tests/daily-social-copy.test.ts` and `cx-corrections.test.ts` pins.

**The tension to resolve, not paper over:** the feature is *called* Private
Circles. A product name and an in-app noun can legitimately differ — but if the
atlas uses "circle" as the interface word for the group while Explore and Daily
Social keep using it for mutual friends, that is the overload, and shipping both
is the failure this gate exists to catch. **Fail the gate and report rather than
pick a word myself** — vocabulary that appears in shipped copy is a founder
decision.

### Gate 2 — Privacy and RLS

- Every circle-scoped read **intersects** the owner's existing flags
  (`closet_hidden`, the three stat flags, `worn_outfits_shared_since`); nothing
  bypasses them (Finding D).
- No new public boundary; `profiles.visibility` stays `'private'` by default and
  nothing writes `is_public`.
- No `to anon` anywhere; explicit grants only.
- Membership predicates are `security definer set search_path = ''`, revoked from
  `public, anon, authenticated`, granted to `authenticated`.
- Block behaviour matches what the copy promises, exactly (Finding C).
- No retroactive exposure: if the atlas implies content flows through a circle,
  it needs a boundary of the `worn_outfits_shared_since` kind, not a boolean.

### Gate 3 — Accessibility and Reduce Motion

- Every state survives **AX-XXXL** with no clipped meaning; no fixed heights
  where text lives, no `numberOfLines` on meaning-bearing copy.
- Targets ≥44pt; every control carries an `accessibilityLabel`.
- **Reduce Motion honoured** — `useReducedMotion()` is the house pattern; no
  animation that conveys information may be the only carrier of it.
- Any new colour pairing passes the frozen census (`src/theme/contrast.ts`);
  `theme.byline` remains banned as text.

### Gate 4 — State coverage

Every state the atlas draws has a resolver branch, distinct copy, and a test —
and the emptinesses do not share a sentence, the rule
`tests/daily-social-copy.test.ts` now enforces for Daily Social. Expect at
minimum: no circles yet; invited-not-yet-accepted; a circle below the liveness
floor of two; a healthy circle; at the 12-seat cap; removed/left; and offline
distinguished from empty.

### Then the fan-out — migration and RLS first

Four isolated worktrees off current `main`, one integration owner:

| Worker | Scope | Gate |
|---|---|---|
| **A · schema** | migration + RLS + `19_private_circles.sql` (§5) | **Lands first.** Everything else branches from A's commit, because the client cannot be typed against objects that do not exist |
| **B · client** | data layer: queries, membership mutations, the cap and invite paths | Binds to an interface A fixes |
| **C · states** | the states and their copy, presentational only | Binds to the same interface; touches no route |
| **Integration** | cherry-pick A→B→C, wire the route, full gates, Simulator, fingerprint control, push, CI | Owns the only merge |

**Two process corrections from the Daily Social run, both of which cost real
time and must not repeat:**

1. **Branch the workers from A's *final* commit, not from an early one.** Last
   run B, C and integration were cut from A's second commit and A's pgTAP fix
   landed after — so main shipped a pre-fix test and CI failed on a bug already
   solved. Re-point every worktree after A is green.
2. **Deploy migration first, then OTA — and publish from a clean `git archive`
   checkout** with the `eas.json` production profile env applied, verifying with
   `npm run check:fingerprint -- --verify-control` **before** publishing. A local
   publish computes the runtime from a working directory carrying a gitignored
   `ios/` and sends the update to a runtime no installed build has.

---

## 7 · What Phase 0 must not spend

Two shortcuts would be cheap now and would quietly consume the design space of
the packets that follow. Neither is taken here.

- **No `activity_feed` kind.** Adding `circle_invite` to the union
  (`20260810100100_activity_feed.sql:97-140`) is four lines and would pre-decide
  how circles announce themselves — which is the Activity design's question.
- **No circle-scoped content table.** What flows through a circle is what the
  atlas is deciding, and Saves is the packet that may want to route through it.
  Membership first; content when the drawing exists.

---

## 8 · Release classification, projected

| Dimension | Projected | Basis |
|---|---|---|
| Migration | **One, required** | Nothing named circle exists |
| Deploy order | **Migration first, then OTA** | The client reads objects that must already exist |
| Edge functions | **None** | No AI call, no server compute |
| Native | **None expected** | No new package, plugin or permission |
| Release | **OTA**, reaching builds 37/38 | No `supabase/` path is a fingerprint input — verified this session |

**And one operational note earned the hard way today.** `eas update` computes the
runtime from the working directory, which carries a gitignored local `ios/`, and
without the `eas.json` production profile env that config plugins branch on. The
first Daily Social publish went out under a runtime no installed build has.
Publish from a clean `git archive` checkout with that env applied, and verify with
`npm run check:fingerprint -- --verify-control` — which reproduces
`d9cb8c3b…` at 168 sources — **before** publishing, not after.
