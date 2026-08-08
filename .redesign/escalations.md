# Escalations — Unit B (Gap Feed / Wall)

## Storing a piece does not actually free a closet slot — W-04's central premise doesn't hold against the trigger

**Found while**: rebuilding capture.tsx's resume-after-swap flow for the W-02
fix (2026-08-08, second pass).

**The conflict.** `enforce_item_limit()` (`supabase/migrations/
20260805160000_membership_tiers.sql:250`) counts every row a user owns,
archived included:

```sql
select count(*) into v_count from public.items where user_id = new.user_id;
```

with no `is_archived` filter. `src/features/closet/storage.ts`'s own header
says this in so many words and treats it as settled: *"A stored piece STILL
SPENDS A CLOSET SLOT... Nowhere in this feature — not the screen copy, not a
hook name, not a toast — may imply otherwise."* `useCapacity` (`src/
features/billing/use-capacity.ts`) mirrors the same unfiltered count, on
purpose, for the same reason.

The Wall's W-04 ("Making room — the swap flow") is built entirely on the
opposite premise: store one piece, add another, and the closet has room. Its
own rules text even half-admits the tension — "it returns intact when a slot
opens **or the plan changes**" — but the swap screen's whole job, its title,
its button ("Store the skirt, add the boots"), and its quoted arithmetic
("14 → 17") all read as if storing is itself the thing that opens the slot.
It doesn't. After storing, the very next insert attempt hits
`closet_limit_reached` exactly as before, because the archived row is still
counted.

**Why I didn't just fix the trigger.** The migration's own comment explains
the count is unfiltered *on purpose*: "excluding [archived] would make
'archive everything' a way to hold an unlimited closet on the free tier."
Reversing that is a real anti-abuse/revenue-protection tradeoff, not an
implementation detail — precisely the kind of call this wave's rules ask me
not to make unilaterally. `src/features/closet/swap.ts` and `src/app/
wall-swap.tsx` are still built and shipped (the contract asks for W-04
"fully built," and its outcome arithmetic is honest given a hypothetical
tally), but as things stand today a user who stores a piece and taps "Store
X" still cannot actually add the eleventh — the app would need to refuse
them a second time, having just told them storing made room.

**What I did instead of leaving this silently broken.** `capture.tsx`'s
resume-after-swap (`useFocusEffect`, W-02) re-checks `capacity.full` FRESH
after returning from `/wall-swap` rather than assuming the swap succeeded.
Today that means: a user who stores a piece and comes back is shown the
closet-full sheet again rather than a silently failed insert — honest, if
anticlimactic. The day someone decides how (or whether) archived items
should stop counting, this resume logic needs no further change; it already
does the right thing once `capacity.full` starts reporting correctly.

**Ask**: a founder call on whether `enforce_item_limit()` should exclude
archived rows (closing the W-04 gap, reopening the "archive everything"
question the original author flagged) or whether W-04's copy/flow should be
rebuilt around an action that genuinely frees a slot (e.g., requiring a real
delete, which the atlas explicitly keeps off this screen and in item detail
instead). Not decided here.

---

# Escalations — Unit F (Share a Look)

## S-05's "Post a photo instead" has no schema or capture-flow support — not built

**Found while**: rebuilding `event/[id]/post.tsx` to the Share a Look State
Atlas's three-step compose flow.

**The conflict.** S-05 draws an escape hatch on the empty-closet state:
"Post a photo instead," beside "Add a piece," for "the person getting dressed
in ten minutes." The plate grammar's own rules section is explicit about what
that means — *"Cover is only used for a plain photo post, which is marked as
one"* — i.e. a single un-composed photograph, rendered `cover` rather than
`contain`, distinguishable on the board from a normal composed look.

Nothing in the schema or the existing capture flow supports posting a bare
photograph as a look:

- `event_outfit_posts.outfit_id` is `not null references outfits(id)`, and
  every `outfits` row is built from `outfit_items`, which in turn references
  `items(id)` — a real, tagged closet piece. There is no column anywhere
  (`outfits`, `event_outfit_posts`, `event_post_items`) that would mark a
  post as "this is a raw photo, render it `cover`, don't run it through the
  plate."
- `/capture` (the ingest flow other dev-*/wall-*/ghost-slot screens push to
  for "add a piece") adds a piece to the closet generally — it has no
  "return here with the piece you just made" handoff, and even if it did,
  its output is a normal closet item, not a marked plain-photo post.
- The board that would need to render this differently
  (`event/[id]/outfits.tsx`, `OutfitPostCard.tsx`) belongs to Unit E's files,
  not mine — so even a schema fix on my side would need a second unit to
  consume the new column before the feature actually shows up anywhere.

**Why I didn't build a fake version.** A button that routes to `/capture`
and then silently expects the normal S-01→S-03 flow to pick up the new piece
is not the ten-minute one-tap escape hatch the atlas describes — it's the
"Add a piece" button under a different label, which would be worse than
omitting it: a second control that promises something the first one already
does is the kind of UI a person learns to distrust.

**What I did instead.** `EmptyClosetPrompt`
(`src/components/share-look/edge-states.tsx`) takes an optional
`onPostPhoto` callback and renders the second button only when a caller
supplies one; `post.tsx` does not, so today's empty-closet state offers only
"Add a piece" — honest about what actually works. `dev-share-look.tsx`'s S-05
frame likewise omits it.

**Ask**: a decision on where the marker lives — a `post_kind` (or similar)
column on `event_outfit_posts`, or a sibling table for photo-only posts —
and, separately, a capture-flow entry point that returns control to the
poster instead of dropping her back in the closet. Both are schema/
cross-surface calls this unit shouldn't make unilaterally. Once the column
exists, `LookPlate`/`GarmentCell` growing a `cover`-fit mode is the one
primitive request that would follow (see
`.redesign/primitive-requests/share-look.md`).

## "Swap a piece" and "Take it off the board" are built as reusable pieces, not wired into Unit E's files

**Found while**: covering S-05's remaining two edge states.

**The conflict.** Both states are described from the *poster's* side, but
their triggers live on cards Unit E owns: `YourLookCard`'s "Swap a piece"
button and `OutfitPostCard`'s overflow menu (`components/event-outfits/**`,
explicitly Unit E's per the event & social contract's unit-boundary table).
I can't edit those files from this worktree without reaching outside my
assigned surface.

**What I did instead.**

- `post.tsx` accepts an optional `?edit=<postId>` param: when present, it
  loads that look's current garments, opens straight to S-02 (compose), and
  its last step calls `useSwapLookPieces`
  (`src/features/share-look/mutations.ts`) — a wholesale
  delete-then-reinsert of `outfit_items` in the new order, same `post_id`,
  same picks, same thread — instead of creating a new post. This is my best
  guess at the entry-point contract; if `YourLookCard`'s "Swap a piece"
  wires to a different param name or route, it needs to be reconciled with
  this one on merge.
- `TakeOffBoardConfirm`
  (`src/components/share-look/edge-states.tsx`) is the destructive
  confirmation the contract's §3 rule requires (names what is lost, keep-
  option named for the thing being kept, never "Cancel") built as a
  presentational component ready to be wired to the existing
  `useDeletePost` (`features/event-outfits/mutations.ts`, read-only import,
  not edited) — today `OutfitPostCard`'s overflow menu skips straight to an
  `ActionSheetIOS` "Retire this look" row with no such confirmation.
  Wiring it is Unit E's call, since it means editing
  `OutfitPostCard.tsx`.

**Ask**: Unit E confirm (or correct) the `?edit=` contract when wiring
"Swap a piece," and decide whether `TakeOffBoardConfirm` replaces the bare
`ActionSheetIOS` destructive row or the two coexist.
