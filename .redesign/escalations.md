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
