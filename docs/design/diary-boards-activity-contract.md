# Wear diary, Boards, Activity & Push — the frozen contract

Wave 5 of the Claude Design atlases: **32 Activity · 33 Wear diary · 34 Season in review ·
35 Saved plates & boards · 36 First-run tour · 37 Notification preferences**.

This document is the arbiter. Where it and an atlas disagree, it wins — and every override says
why, because the reason is always that the app cannot honestly make the claim the design prints.

Source: `design-refs/html/3*.dc.html` and `design-refs/png/3*/`, from the same export run, so the
PNG cannot disagree with the HTML. Companions:
[`system-safety-contract.md`](./system-safety-contract.md),
[`membership-packing-contract.md`](./membership-packing-contract.md),
[`free-tier-contract.md`](./free-tier-contract.md),
[`event-social-contract.md`](./event-social-contract.md).

---

## 1. State IDs

**Every prefix in this drop is already taken.** `N` (Not found, before it became `NF`), `W` (The
Wall — `W-04` is named in `wall-swap.tsx`), `S` (Share a Look), `B` (Borrowing), `T` (The Ten),
`P` (The Repeat). Same precedent as the last three waves: **the newcomer renames.**

| Atlas | Theirs | Ours | Screen |
|---|---|---|---|
| 32 Activity | N-01 … N-05 | **AV-01 … AV-05** | Populated, empty, loading, error, answered/pending/failed |
| 33 Wear diary | W-01 … W-04 | **WD-01 … WD-04** | Populated, empty, entry, loading |
| 34 Season in review | S-01 … S-07 | **SR-01 … SR-07** | *Deferred — see §3* |
| 35 Saved plates | B-01 … B-05 | **KP-01 … KP-05** | Saved set, empty, board, keep sheet, loading |
| 36 First-run tour | T-01 … T-04 | **TR-01 … TR-04** | Promise, camera, ritual, after |
| 37 Notification prefs | P-01 … P-04 | **NP-01 … NP-04** | Default, all off, denied, morning edit expanded |

---

## 2. What the schema already had, and what it did not

The honest summary, because three of these atlases claim to be reading data that "already
exists" and only two of them are right.

| Atlas needs | Exists today | Verdict |
|---|---|---|
| A record of every wear | `outfits.worn_at`, one **new row per confirm** via `wear_outfit_tx` | ✅ real, and the diary is a read of it |
| Wear counts, cost per wear | `items.wear_count`, `items.purchase_price`, `costPerWear()` | ✅ real, price nullable — see §4.2 |
| The five Activity row kinds | `follows`, `borrow_requests`, `event_members`, `event_outfit_votes`, `closet_likes` | ✅ all five, but no union and no dot |
| A kept plate, a board | — | ❌ nothing. New schema, §5 |
| "worn 6×" on a kept plate | — | ❌ each wear is a fresh row with no lineage. New column, §5 |
| A note on a wear | `outfit_calendar.note` belongs to a **plan**, not a wear | ❌ new column, §5 |
| Push, in any form | — | ❌ nothing. §6 |

---

## 3. Atlas 34 (Season in review) is deferred

**Founder's call, 2026-08-09: defer.** Not refused — the data path is real and every number in it
comes from the wear diary this wave builds. It is deferred because it would be built against
fixtures and verified against nothing:

1. **SR-04 palette drift compares this season to the last one.** No account has a prior season and
   none will for a year. The atlas specs no fallback state.
2. **SR-03 is entirely prices.** `items.purchase_price` is optional and captured only in
   `review.tsx`; it will be null for most pieces. The card would list two rows.
3. **SR-07 is what every user would actually see.** The twenty-confirmed-wear gate is correct, and
   it means the review is invisible for roughly three weeks of daily use — which is exactly the
   period in which we would want to have verified it.

**When to build it.** When a real account has ≥20 confirmed wears in one season and ≥3 priced
pieces. The wear diary this wave ships is what produces both. Nothing in the deferral needs
revisiting except the data.

**One consequence, applied now:** the "Season in review" channel comes out of NP-01's list. A
toggle for a feature that does not exist is the same refusal as the Notifications row in
[`system-safety-contract.md`](./system-safety-contract.md) §4.2.

---

## 4. What the atlases get wrong about this app

### 4.1 Every price is sterling

WD-03 prints `£58 a wear`, `£19`, `£11`. SR would have printed `£450`. The app is dollars
throughout — `costPerWear()`, `friends/[userId].tsx`, and the membership tiers. **Read the
currency from the existing formatter; never print a glyph the atlas chose.**

### 4.2 Cost per wear is printed or dropped, never estimated

WD-03 gives every piece a `£x a wear` line. `purchase_price` is nullable and usually null.
**When there is no price there is no line** — not "—", not a zero, not an estimate from the
category. Precedent: `item/[id].tsx` already treats `cpw` as nullable, and the standing refusal
is that prices are printed or dropped.

### 4.3 "Decline" on a friend request has no referent

AV-01 offers **Add back** / **Decline** on *"Sam Okafor wants to be friends."* `follows` is
unilateral and publicly readable (`20260803210000`): there is no pending request, so there is
nothing to decline. Declining would either do nothing or, worse, imply a rejection was
transmitted.

**Resolution:** the second button is **Not now**, and it dismisses the row. Nothing is sent, the
follow is untouched, and the other person learns nothing. Recorded in `activity_dismissals` so
the row stays gone across devices. The affirmative keeps its copy: **Add back** genuinely does
open the closets to each other, which is what the sentence says.

### 4.4 "Save to photos" comes out of the share row

Needs `expo-media-library` and `NSPhotoLibraryAddUsageDescription` — native, and not in the
binary. The iOS share sheet already offers *Save Image*, which is how the existing share card
works. This applies to SR-06 when 34 is built; noted here so it is not rediscovered.

### 4.5 The morning edit cannot contain the day's look

NP-01 prints *"One notification at 7:30am with the day's look."* Look generation is **on-device**:
`generateOutfits()` runs in `src/lib/styling`, and the `generate-outfits` edge function only
re-ranks a shortlist the client has already sent. The server never holds a wardrobe and therefore
never holds a look to put in a payload.

**Shipping line:**

> One notification at 7:30am, when the day's look is ready to read. Nothing else arrives in the
> morning.

The atlas's own footnote already concedes this direction — *"if the weather has not come in by
then, the edit waits rather than sending a guess."* A nudge that is true beats a payload that is
not.

---

## 5. Schema (phase 1, mine, before any unit starts)

### 5.1 The diary and the boards — `20260810100000_wear_diary_and_boards.sql`

| Change | Why |
|---|---|
| `outfits.note text` | WD-03's "Your note". `outfit_calendar.note` is a *plan's* note and does not survive into the wear row. |
| `outfits.saved_at timestamptz` | A kept plate. Null means generated-and-forgotten, which is most rows. |
| `outfits.board_id uuid references boards(id) on delete set null` | KP-05: *"deleting a board keeps the plates — they return to All."* `set null` **is** that rule. |
| `outfits.origin_outfit_id uuid references outfits(id) on delete set null` | Lineage. Makes `worn 6×` on a kept plate derivable, and it is the only way it ever will be, because every confirm inserts a fresh row. |
| `boards (id, user_id, name, starts_on, ends_on, created_at)` | KP-05: *"a name, and optionally two dates. Nothing else."* No cover, no description, no colour — the columns are the contract. |
| `wear_outfit_tx` gains `p_origin_outfit_id`, `p_note` | Sets the lineage at the moment of the confirm, which is the only moment it is known. |
| `unwear_outfit_tx(op_id, outfit_id)` | WD's *"editable for a day"*. Deletes the wear **and decrements `items.wear_count`**, refusing beyond 24 hours. Command-log guarded like every other `_tx`. |

Owner-only RLS on `boards`, explicit `authenticated` grants, no `to anon`, `(select auth.uid())`
in every policy. `security invoker` on both functions — the caller can do these writes under
their own RLS, so there is no reason to define away from them.

### 5.2 Activity — `20260810100100_activity_feed.sql`

- `activity_dismissals (user_id, kind, subject_id, dismissed_at)` — §4.3, and the "Not this time"
  on a borrow that the reader wants off the page.
- `profiles.activity_seen_at timestamptz` — **the dot, and only the dot.** AV-02: *"you will see a
  dot on Today — and nowhere else."* No count column, because a count is a thing to be scored.
- `activity_feed()` — a union of the five sources, newest first, **30 days**, filtered through the
  existing block and mute layers. The 30-day bound is AV's own rule and is enforced in SQL, not in
  the client, so the page cannot accidentally grow a history.

### 5.3 The tour — `20260810100200_first_run_tour.sql`

- `profiles.toured_at timestamptz`. TR's rule is *"once, ever, on any device"*, which is a server
  fact, not a device fact. `onboarding_complete` is not reused: it already gates name capture, and
  overloading it would make skipping the tour look like an incomplete account.

### 5.4 Push — `20260810100300_push.sql`

- `push_tokens (user_id, token, platform, created_at, last_seen_at)`, unique on token, owner-only.
- `notification_prefs` — one row per user, one boolean per channel plus `morning_edit_at time`.
  Defaults follow NP's rule: **on by default except votes.** Season in review is absent (§3).

---

## 6. Push: what is native, what is honest, and how it ships without breaking the OTA

**Founder's call, 2026-08-09: build the whole stack.**

### 6.1 What is native, and therefore cannot ride an OTA

`expo-notifications` (a new package with native modules), the `aps-environment` entitlement, the
APNs key in App Store Connect, and the privacy-manifest entry that ships with the module. Per the
standing rule: **this needs a store build, and no store build is cut until the founder says
"cut a store build".**

**The APNs key is the founder's to create.** It is a `.p8` credential. It is never handled,
entered, echoed, or stored by this session.

### 6.2 How every commit stays OTA-safe anyway

`src/features/push/native.ts` performs a **guarded require** of `expo-notifications` and exports
`PUSH_AVAILABLE: boolean`. On the current binary the module is absent, the require fails, the flag
is false, and:

- the **Notifications** row does not appear in Profile & settings,
- no token is registered,
- no permission is requested.

Nothing dead ships and nothing throws. The same bundle turns the whole feature on the moment it
runs on a binary that has the module. **Every consumer keys off `PUSH_AVAILABLE`; nothing imports
`expo-notifications` at module scope.**

### 6.3 The senders, and what each is allowed to promise

NP's rule — *"the description is the promise… copy and schedule are reviewed together"* — is
enforced by making the sender and the row the same unit of work. Six channels in the atlas, five
shipped:

| Channel | Sender | Promise it must keep |
|---|---|---|
| Morning edit | `pg_cron` every 15 min; fires for users whose chosen slot has passed today | Once a day, never twice. Content is a nudge, not the look (§4.5) |
| Friend activity | trigger on mutual follow and on a new item | Batched to at most one an hour |
| Borrow requests | trigger on request and on return | Both ends of the loop, or neither |
| Event reminders | daily cron, evening before | Once |
| Votes and comments | hourly batch | One per look per hour, never one per vote |
| ~~Season in review~~ | — | **Cut** while 34 is deferred (§3) |

Permission is requested **the first time a channel is switched on** — not at launch, not in the
tour. TR's own rule forbids the tour raising it.

### 6.4 What can and cannot be verified

The four NP states, the permission prompt and the denied path are all verifiable on the simulator.
**Arrival is not** — that needs a device and a store build. Anything claimed about delivery in a
report before then is a claim, not a verification, and must be labelled as one.

---

## 7. Standing refusals, unchanged

Carried forward and re-affirmed each wave:

1. **`faint` (#8A8578) is never text.** ~3.5:1 on canvas, an AA failure. Use `muted`. Eight waves
   have reintroduced it from an atlas; sweep before merging.
2. **Palette locked**: #FBFAF6 / #1C1A16 / #6E2B2B / #B08A76 / #F0ECE3. Light only. The dark ground
   on TR-01 is ink used as a ground, not a dark mode.
3. **One oxblood action per screen.**
4. **Anything with a ground uses the shared `Button`.** A `Pressable` carrying both a `className`
   and a *function* `style` renders nothing.
5. **Pure logic in `.ts`, never `.tsx`** — the test bundler cannot parse React Native's Flow source.
6. **Every state gets a dev route.** A state without one is a state nobody has looked at, and a dev
   route whose fixture handlers are no-ops is a dead end — wire them to advance the switcher.
7. **Temperatures, prices and counts are printed or dropped, never estimated.**
8. **`design-refs/` is gitignored**, so `git worktree add` does not carry the atlases. They are
   `cp`'d into every worktree explicitly, or the unit builds blind.

---

## 8. Unit boundaries

Phase 1 (mine, before any unit starts): §5 in full, the guarded native shim (§6.2), and the frozen
cross-unit types — the diary selectors, the board and kept-plate models, the activity row union —
plus the two shared components more than one unit needs: the **plate tile at rest** (KP's 2×2 tray
square, which WD-01's rows and any future review also use) and the **editorial dark frame** (TR).

| Unit | Owns | Must not touch |
|---|---|---|
| **D — Diary** | `src/app/diary.tsx`, `src/app/diary/[id].tsx`, `src/features/diary/**`, `src/app/dev-diary.tsx` | boards, activity, push |
| **K — Kept** | `src/app/saved.tsx`, `src/app/board/[id].tsx`, `src/features/boards/**`, the Keep sheet, `src/app/dev-saved.tsx` | `src/features/diary/**`, activity, push |
| **V — Activity** | `src/app/activity.tsx`, `src/features/activity/**`, `src/app/dev-activity.tsx` | diary, boards, push |
| **T — Tour** | `src/app/tour.tsx`, `src/features/onboarding/tour*`, `src/app/dev-tour.tsx` | everything else |
| **N — Push client** | `src/app/notifications.tsx`, `src/features/push/**` *(except `native.ts`)*, `src/app/dev-notifications.tsx` | `supabase/functions/**`, every other feature dir |
| **X — Senders** | `supabase/functions/send-push/**`, `supabase/functions/_shared/push.ts`, the cron migration | all of `src/` |

**Cross-cutting edits stay with me** so no two units collide: `src/app/(tabs)/index.tsx` (the dot,
the Activity entry), `src/app/profile.tsx` (rows to Diary, Saved, Notifications),
`src/app/_layout.tsx`, `src/app/dev-screens.tsx`.

Shared layer is read-only to all units. A unit that needs a change there files
`.redesign/primitive-requests/<unit>.md` and works around it. It does not block and it does not
edit.

A file-overlap check reporting "no overlap" is not proof — it gave a false negative two waves ago.
`tsc` and the simulator are the arbiters.
