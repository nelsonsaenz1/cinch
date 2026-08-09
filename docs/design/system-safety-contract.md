# System & Safety — the frozen contract

Wave 4: the three atlases nobody wants to need. **AI consent sheet**, **29 Blocked people ·
30 Report flow · 31 Not found**, and **08 Profile & settings · 09 Edit profile**. Twenty states.

This document is the arbiter. Where it and an atlas disagree, it wins — and every override says
why, because the reason is always that the app cannot honestly make the claim the design prints.

Source: `design-refs/html/` and `design-refs/png/` (`AI Consent Atlas`, `Blocked, Report & Not
Found Atlas`, `Profile & Settings Atlas`). Companions:
[`free-tier-contract.md`](./free-tier-contract.md),
[`event-social-contract.md`](./event-social-contract.md),
[`membership-packing-contract.md`](./membership-packing-contract.md).

---

## 1. State IDs

Three of the four prefixes in this drop are already taken — `R-01/R-02` by The Reveal, `P-01` by
The Repeat, `E-01` by Event Detail. Same precedent as the last two waves: **the newcomer
renames.**

| Atlas | Theirs | Ours |
|---|---|---|
| AI consent | A-01 … A-06 | **AC-01 … AC-06** |
| 29 Blocked people | B-01 … B-03 | **BL-01 … BL-03** |
| 30 Report flow | R-01 … R-04 | **RP-01 … RP-04** |
| 31 Not found | N-01, N-02 | **NF-01, NF-02** |
| 08 Profile & settings | P-01, P-02 | **PS-01, PS-02** |
| 09 Edit profile | E-01 … E-03 | **EP-01 … EP-03** |

---

## 2. Blocking becomes what the atlas says it is

BL-01's headline is a promise about what already happened:

> Blocking removed their votes from your looks and took them off every event you host. They
> cannot see your closet, and you will not see theirs.

**Only the second sentence was true.** `on_block_sever_graph()` deletes rows from `follows` and
nothing else; `20260807120000_event_content_block_filter` then hides the pair's posts, votes and
comments from *each other* through RLS. So a blocked account's vote still counted in the tally
every other attendee could see, and they remained a joined member of events the blocker hosts.

Telling someone their harasser's votes were retracted, on the one screen the atlas itself calls
"the place a user trusts the app or does not", is the worst available place to be wrong.

**Founder's call, 2026-08-09: make it true.** The block trigger gains two side effects, scoped
exactly to what the copy promises and no further:

1. **Retract their votes on the blocker's looks.** `delete from event_outfit_votes v using
   event_outfit_posts p where v.post_id = p.id and p.user_id = <blocker> and v.voter_id =
   <blocked>`. This is the one that matters: a vote is a *number other people see*, and hiding it
   from the blocker alone left the tally standing.
2. **Remove them from events the blocker hosts.** `event_members.state = 'removed'` for the
   blocked user on every event where `events.host_id = <blocker>`. The enum already has
   `removed`; a state change rather than a delete keeps the audit trail.

**What it deliberately does NOT do**, each with a reason:

- **It does not delete their comments.** BL-02 says "the votes and comments retracted"; comments
  are already invisible to the blocker through the existing filter, and deleting another person's
  words across an event that other people are reading is a bigger act than the block was asked
  to be. **BL-02's line is corrected to say votes.**
- **It does not remove the blocker from events the blocked person hosts.** The atlas promises one
  direction. Ejecting the blocker from an occasion they had joined, as a side effect of blocking,
  is a surprise nobody asked for.
- **It is not reversible, and BL-02's confirm must say so** — which it already does: "The votes
  and comments retracted when you blocked her do not come back." Corrected to votes, that
  sentence is now true rather than aspirational.

---

## 3. The consent sheet says only what we can prove

AC-01 prints *"They don't keep it and don't train on it. It's deleted once the tags come back."*
AC-02 prints *"Under our agreement the photo is not retained and is not used to train models."*

Photos go to OpenRouter, and onward to whichever upstream model `ai_config` names. **Nobody has
verified that those terms guarantee zero retention and no training**, and a privacy commitment
about a third party, printed in a consent sheet, is the highest-stakes sentence in the app.

**Founder's call, 2026-08-09: soften to what we can prove.** The sheet keeps every claim that is
a fact about *our own* behaviour and drops the ones that are assertions about someone else's:

| Keep — we control it | Cut or soften — we do not |
|---|---|
| The photo is sent at reduced resolution | "They don't keep it" |
| Nothing else goes with it — no name, email, location, or other item | "It's deleted once the tags come back" |
| We keep the photo and tags in your closet; deleting an item deletes both | "not used to train models" |
| We never run face recognition, here or anywhere in Cinch | |
| We never sell it or advertise against it | |

**Shipping AC-01 item 2:**

> It goes to one AI partner and comes straight back. We don't send your name, your email, your
> location, or anything else from your closet.

**Shipping AC-02 "Stored by them":**

> That is between Cinch and our AI partner, and it is governed by our agreement with them rather
> than by anything Cinch can enforce on your behalf. We send the least we can — one photo, at
> reduced resolution, with nothing attached to it.

If the provider terms are later confirmed in writing, the stronger sentences can be restored in
one commit. **Until then, treat any retention or training claim as unshippable.** This is a
launch-blocking item, not a nice-to-have.

---

## 4. Four smaller things the atlas gets wrong about this app

### 4.1 "Cinch Unlimited · Renews 4 September · $8.99 / month" (PS-01)

No such tier and no such price. The app sells **Standard $7.99/mo · $59/yr** and **Pro
$14.99/mo · $119/yr**, and free has no membership row at all. Read `usePlan()` for the tier and
`plans.ts` for the price hints; drop the renewal line when `current_period_end` is null, exactly
as MB-06 does — that column stays null until the billing webhook fills it.

### 4.2 "Notifications — Morning only ›" (PS-01)

**Push notifications are not built.** No `expo-notifications`, no APNs key, no `aps-environment`
entitlement, no privacy-manifest entry. The row comes out. Same call as "Remind me" in
[`membership-packing-contract.md`](./membership-packing-contract.md) §6 — a switch that toggles
nothing is worse than an absent row, and adding it would be a native change that cannot ship over
the air anyway.

### 4.3 "What Cinch has learned … 46%" (PS-01)

The sentence beside it is real — it is the learned style summary, already rendered elsewhere. The
**percentage is not**: there is no confidence, coverage or completeness metric anywhere in the
style profile, and inventing one to fill a number slot is the same failure as a guessed
temperature. **Keep the sentence, drop the figure.**

### 4.4 "Tag the 24 items I already have" (AC-06)

Does not exist. **Build it** rather than cut it: it is the honest counterpart to the rule
immediately above it — flipping the switch on must never retroactively upload a closet — and
without it that rule reads as a limitation rather than a promise. It sends those photos once and
stops, and the count is the real number of untagged items.

---

## 5. What the atlas asked for that the schema already supports

**AC-06's "See what we sent" is real.** `ai_calls` carries an owner-select policy
(`20260803180000`) and an explicit client grant (`20260806100000`), so a user can genuinely be
shown their own upload log — what was sent, when, and for which item. Build it against that
table. Nothing here needs a new capability, which makes it the one claim in this wave that
strengthens rather than shrinks.

---

## 6. Standing refusals, unchanged

Carried forward from [`cinch-atlas-vs-design-system`] and re-affirmed each wave:

1. **`faint` (#8A8578) is never text.** ~3.5:1 on canvas, an AA failure. Use `muted`. Seven waves
   have reintroduced it from an atlas; sweep before merging.
2. **Palette locked**: #FBFAF6 / #1C1A16 / #6E2B2B / #B08A76 / #F0ECE3. Light only.
3. **One oxblood action per screen.** These atlases restate it themselves: *"Oxblood appears only
   on the action that ends something"*, and *"Delete account is the only critical-coloured thing
   in the app."* Unblocking is ink, not oxblood — it is not destructive.
4. **Anything with a ground uses the shared `Button`.** A `Pressable` carrying both a `className`
   and a *function* `style` renders nothing — the NativeWind interop hole that shipped a dead
   button in build 17.
5. **Pure logic in `.ts`, never `.tsx`** — the test bundler cannot parse React Native's Flow
   source.
6. **Every state gets a dev route.** A state without one is a state nobody has looked at.
7. **Temperatures, prices and counts are printed or dropped, never estimated.**

---

## 7. Unit boundaries

Phase 1 (mine, before any unit starts): the block migration (§2), and the shared sheet furniture
all three atlases are built from — a settings/list row, the section header, and the form-sheet
chrome (`Done`, and the presentation that stops short of the top so the app stays visible
behind it, because "this is a detour, not a destination").

| Unit | Owns | Must not touch |
|---|---|---|
| **C — Consent** | `src/features/auth/use-consent.ts`, the AC sheet and its policy page, capture integration, the Privacy row, the back-fill, the sent-log | `src/features/profile/**`, `src/features/social-graph/**`, `src/app/friends/**` |
| **S — Safety** | `src/app/friends/blocked.tsx`, `src/features/social-graph/moderation.ts`, the RP report sheets, `src/app/+not-found.tsx` | `src/features/auth/**`, `src/features/profile/**` |
| **A — Account** | `src/app/profile.tsx`, `src/features/profile/**` | `src/features/auth/use-consent.ts`, `src/features/social-graph/**`, `src/app/friends/**` |

`profile.tsx` links to Blocked people, Privacy and the consent switch — those are **links only**.
The screens behind them belong to S and C respectively; A owns the row, not the destination.

Shared layer is read-only to all three. A unit that needs a change there files
`.redesign/primitive-requests/<unit>.md` and works around it. It does not block and it does not
edit.

A file-overlap check reporting "no overlap" is not proof — it gave a false negative two waves
ago. `tsc` and the simulator are the arbiters.
