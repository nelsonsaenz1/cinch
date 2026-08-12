# Wave 3 · Group 5 — Gap Feed and Social

Source: `docs/design/wave-3-final/Wave 3 - Design · Gap Feed and Social.dc.html`
(unmodified; 8/8 sha256 re-verified against `MANIFEST.sha256` before the packet opened).

21 drawn states. **19 built, 2 parked**, plus four behaviours parked inside states that
are otherwise built. Three bounded lanes on disjoint files; no captures, no visual
grading — Codex owns those.

## What is parked, and on whom

### D-1 · server-side refusal of late comment inserts — FOUNDER, then a migration

`grep -rn "comments_closed\|closes_at" supabase/` returns nothing. The `event_comments`
insert policy (`20260807102000_event_outfits_votes_comments.sql:126`) is
`auth.uid() = user_id and is_event_member(event_id) and not hidden and not reported` —
**no time predicate**. Closure today is client-derived only.

So CM-02's closed notice ships without the sentence "nothing new can be added". The
composer is removed rather than disabled, which is the drawn behaviour and is honest on
its own; what is withheld is the *claim*.

**The decision is not "should comments close."** It is what an undated occasion does.
Two implementations differ exactly there:

- a `with check` joining `events` on `now() < coalesce(starts_at, 'infinity')` — cheap,
  and silently leaves every undated occasion open forever;
- a `before insert` trigger raising `42501` — distinguishes "no date set" from "not yet
  started" and hands the client a code to render.

One string changes on landing: `closedThreadLine()` in
`src/features/event-outfits/comment-thread.ts`. `tests/comments-column.test.ts` fails if
the claim is written before the rule exists.

### D-2a · board lock at `starts_at` — FOUNDER, then a migration

Same shape, same undated hole, on `event_outfit_votes`. Its insert policy checks identity
only; `assert_vote_target()` checks post existence, self-vote and membership. The client
lock is `openedAt >= startsAt.getTime()` (`outfits.tsx:156`) against a column that
migration `20260808130000_events_optional_date.sql:30` made nullable.

`assert_vote_target()` is already a `before insert` trigger on that table and is the
obvious home: one `select starts_at`, one `raise`. Strings that change on landing:
`lockedBoardLine()` and `openBoardFooter()`.

**Half of D-2 is already enforced and the ledger did not know it:** "one movable pick per
viewer" is a real server rule — `constraint one_vote_per_event unique (event_id, voter_id)`
(`20260807102000:65`).

### D-2b · the crown — FOUNDER ONLY. No migration, no schema, no backend.

This is free to resolve and is holding up the most drawing. Correction 24 removes the
crown outright; the shipping board still crowns a leader at lock via `favouriteId`
(`src/features/event-outfits/board-logic.ts:47`) rendered by `LeaderBadge`
(`src/components/event-outfits/OutfitPostCard.tsx:185`). The two artefacts also disagree
about *why*: the frozen contract's "a tie holds the crown where it was" is the reason
`favouriteId` carries a previous answer across renders.

If the atlas wins, all three go — badge, `favouriteId`, sticky-tie state — in about twenty
lines, and audit 96's "nothing is crowned" is satisfied. If the code wins, LB-02 needs
redrawing. Only what is true under either ruling was built: the pre-lock word is 13 pt
secondary text and disappears on a tie; the locked crown is byte-identical.

## Where the drawing contradicted shipping truth

Each of these was verified against the repository, not assumed.

| # | The claim | What is true | What shipped |
| --- | --- | --- | --- |
| 1 | GF-01/02: "4 tops … 7 more outfit cores … 14 to 21" | `countOutfits` is `tops×bottoms×shoes + dresses×shoes` (`outfit-count.ts:110`), so one more bottom gains exactly `tops×shoes` — with 4 tops, always a multiple of 4, never 7. No assignment reaches 14→21 either. | The sentence form audit 85 demands, over a fixture closet that genuinely computes 14→21. The impossibility is a test, not a comment. |
| 2 | "computed from what you own **and what you actually wear**" | `rankGaps` reads the tally only (`outfit-count.ts:142`). No wear record enters the ranking. | Clause dropped. |
| 3 | GF-01's second card, "Something for rain" | `rankGaps` ranks the four `COUNTED_KINDS` and nothing else. There is no weather- or wear-derived gap kind. | Not drawn. |
| 4 | GF-01's "I already own one" / "Not my style" | `wardrobe_gaps` exists with a `dismissed` boolean and owner RLS, but **nothing in `src/` reads or writes it**; the feed's gaps are ephemeral client computations with no id, and one boolean cannot carry two distinct signals. | Not drawn — they would have been two dead controls. |
| 5 | GF-04 "routes to C-09" | C-09 is commissioned in the reframe directive but the Wave-3 Closet atlas runs C-01…C-08 and no C-09 screen exists. | Total-ceiling footer routes to `/storage`, where a deletion is actually possible. |
| 6 | Audit 84's "112 pt" | Summing the frame's own declared boxes puts its first headline at ≈175 pt; 112 lands inside the masthead. | ≈213 pt measured, the extra ~44 being the `ScreenHeader` the frame omits (`/gap-feed` is a pushed route; removing it leaves no way back). §14's actual criterion — first computed gap in the first viewport at 393 pt — is met with the whole card above the fold. |
| 7 | Correction 23's "previous behaviour" — mutual counts, hosting notes, lending claims | None of it was ever in this repo. There is no account-level lending flag anywhere in `supabase/migrations`; `borrowable` is per garment. | Nothing deleted. The rule is now enforced instead: a row prints only what `fetchProfiles` selects (`queries.ts:79`). The one real field the row was **missing** — the bio — is now drawn. |
| 8 | AV-01's fifth row kind, "Tomás commented …" | `activity_feed()` unions follows, borrow requests, event members, event votes and closet likes (`20260810100100_activity_feed.sql`). There is no comment branch and `ActivityKind` has no comment member. | Not drawn; the compliment row — a real fifth kind — takes its place. |
| 9 | AV-01's inline "Join" on an invitation | No join mutation is exposed to Activity; the shipping row carries a destination only. | The quiet destination is kept rather than a dead affirmative. |
| 10 | CM-01's masthead scope | It read "Only the 6 people at this event can read this". A roster size is one subtraction from how many declined, which audit 92 forbids. | "only the invited" — which is also what `is_event_member` actually gates on. |
| 11 | `FailedDraftBanner`: "Saved as a draft" | Nothing in `features/share-look/**` writes a draft. Leaving the screen lost it. | Corrected. SL-02's "Save it for later" is parked for the same reason. |
| 12 | `ShopSheet`'s commission paragraph | It printed "Cinch earns a small commission" **unconditionally**, including on sheets where no row is paid — the same defect correction 19 removed one level up, still live. | `shopSheetDisclosure(paidCount)`. |
| 13 | GF-02/AX sketches "Paid link" above the merchant card | That is the block-level marker correction 19 deleted, and §11 says nothing announces one. | Per-row, inside the card, above that row's own action. Correction 19 and §11 beat the sketch. |
| 14 | The atlas's 14 pt name/timestamp line | `tailwind.config.js` runs 11/13/16/17. There is no 14 pt step. | Built at 13. Adding a scale step mid-wave would make two lines disagree with all of Groups 1–4; recorded as a design question instead. |

## Still open

- **Founder, no engineering:** D-2b the crown. The cheapest unblock in the wave.
- **Founder, then one migration each:** D-1 and D-2a, both turning on what an *undated*
  occasion does.
- **Founder/design:** a 14 pt type step (#14 above); whether `wardrobe_gaps` should be
  wired and widened past one boolean; whether a C-09 screen gets drawn.
- **Backend:** a comment branch in `activity_feed()`; a join mutation reachable from
  Activity.
- Carried in from earlier packets: "1 of 3 this week" (T-01 vs TD-00), `"Search for it"` →
  `"Describe it"`, `chip-spec.COMPACT_HEIGHT` 32 vs the drawn 38, task #69 (words-only
  filing), IT-04, CP-04/CP-05, V-02/V-03 streaming ASR.

## Also landed here

- `NoticeBand` promoted `components/plan/` → `components/ui/` and exported from the
  barrel — the serialization request Group 4 recorded, triggered by Group 5's inventory
  listing the band as the moderation and system voice in comments.
- `src/app/dev-screens.tsx` was a throwaway item-detail preview nothing linked to. It is
  now the index of all 154 `__DEV__` fixture routes, held against the filesystem in both
  directions by `tests/dev-route-index.test.ts` — Wave 3 ended with 154 fixtures and no
  way to reach one but typing its deep link.
- Seven entries pruned from `FAINT_TEXT_DEBT`: the four gap-feed surfaces, `ProfileRow`,
  `friends/[userId]` and `dev-gap-feed`.
