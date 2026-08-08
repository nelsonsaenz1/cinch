# Primitive requests — Unit E, Look Board / Event Comments

Nothing here blocked on the read-only shared layer (`src/theme/**`,
`tailwind.config.js`, `src/components/look/**`,
`src/features/event-outfits/look-layout.ts`,
`src/features/closet/outfit-count.ts`, `src/lib/styling/**`) — every one of
these is a scope call inside territory this unit owns, recorded here for the
same reason Unit B/C's own files exist: so the gap is on record rather than
silently absent.

## 1 · The board is one rail across the whole event, not one per attendee

**What I found:** the code this unit inherited (`AttendeeBoard`/`boardsFor`/
`boardLeader` in `types.ts`, and the old `outfits.tsx`'s per-attendee
`BoardBand`) models the board as N separate mini-boards, one per poster, each
crowning its own leader — "no surface built on this may rank attendees
against each other," per `queries.ts`'s own header at the time.

**What the atlas draws:** L-01 through L-06 render ONE snapping rail mixing
every poster's cards, ONE set of dot pagination matching the total look
count, and ONE crown ("The favourite") for the whole page — L-05's tray note
literally says "Mel's Cream & Cognac took the room," crowning one poster's
look over another's. The frozen contract (`docs/design/
event-social-contract.md` §3) speaks the same way, in the singular
throughout: "the crown on the favourite," "One crown, no second or fifth."

**What I did:** rebuilt to the atlas's literal, repeated, pixel-level
structure — one flat rail (`src/app/event/[id]/outfits.tsx`), posting order,
one sticky crown (`favouriteId` in `board-logic.ts`). Left `AttendeeBoard`/
`boardLeader`/`boardsFor`/`AttendeeLookGrid`/`YourLookCard`/`groupStyleNote`
in `types.ts` and `OutfitPostCard.tsx` completely untouched — that machinery
answers a different, still-valid question ("which of MY OWN alternatives is
ahead," for Event Detail's own "Your look" card, owned by Unit D) and stays
correct under the old, narrower reading. Documented at length in
`board-logic.ts`'s header. Not treated as a blocking escalation — the
contract and the atlas agree with each other and disagree only with a
pre-atlas comment in code I'm allowed to edit — but flagged here because it's
the single biggest structural call in this rebuild.

## 2 · "Swap a piece" (L-04's own-look overflow) has no honest backing

**Need:** L-04 draws "Swap a piece" as a row on your own look's overflow —
editing one item of an already-posted look in place.

**What exists:** none of `usePostOutfit`/`useDeletePost`/the projection views
support mutating a posted look's items after the fact; the only two verbs the
schema offers are post a new one or retire it. Building "swap a piece"
honestly would mean designing and shipping that mutation, which is schema
territory past a redesign pass.

**What I did:** dropped the row. Your own look's overflow offers "Share
another option" (routes to the existing `post.tsx`, capped at
`MAX_LOOKS_PER_BOARD`) and "Take it off the board" — real, and enough to
cover the same underlying need (post the corrected combination as a new
option) without a button that lies about what it does.

## 3 · "Save to Lately" (L-04 and L-05) has no save-to-Lately feature anywhere

**Need:** L-04's someone-else's-look menu and L-05's closing pair both draw
"Save to Lately."

**What exists:** grepped the app for any save/bookmark mutation touching the
Lately feed (`src/features/explore/**`, the `(tabs)/explore.tsx` screen that
is Lately) — nothing. There is no table, no hook, nothing to wire.

**What I did:** dropped it from both places rather than build a fake button
or a real feature outside this unit's surfaces. `L-04`'s someone-else's-look
menu keeps Share/Report/Block; L-05's closing pair is "Share the board"
alone (real, via RN's built-in `Share.share`, no new dependency).

## 4 · "Copy text" (EC-03's on-row menu) needs a clipboard module that isn't installed

**Need:** M-03's "on a row" reference menu lists "Copy text" for both
someone else's comment and your own.

**What exists:** no clipboard package anywhere in `package.json` — RN's own
`Clipboard` was removed from core years ago, and both replacements
(`@react-native-clipboard/clipboard`, `expo-clipboard`) are new native
modules, which the hard rules forbid adding.

**What I did:** dropped the row. `CommentRow`'s overflow is Report (+ Block,
+ Hide/Unhide for the host) for someone else's row; Reply and Delete stay
inline on every row per the atlas's own M-01.

## 5 · Replies are a client convention, not a stored parent id

**Need:** M-01 draws one reply ("Mel `@Dana` tote it is.") at one indent
level under its parent.

**What exists:** `event_comments` (`@/features/social/db-rows`) is `id,
event_id, post_id, user_id, body, reported, hidden, created_at` — no
parent/reply column. Adding one is a migration on a shared, live database
three units are touching concurrently, which is exactly the kind of
shared-layer change the redesign rules ask this unit not to make
unilaterally.

**What I did:** `src/features/event-outfits/comment-thread.ts` — replying
prepends `@FirstName ` to the body (`withReplyPrefix`), and a row whose body
starts with a bare `@Token` renders one indent in with the mention
highlighted (`isReplyBody`/`splitMention`), reading identically to the
atlas's own example with no schema change. Documented at the top of that
file. Tested in `tests/comment-thread.test.ts`.

## 6 · Hiding a comment is host-only at the RLS level, not "whoever posted the look"

**Need:** the atlas's own prose (M-03's summary line) says "the person whose
look it is can hide a comment on it."

**What exists:** `supabase/migrations/20260807102000_event_outfits_votes_
comments.sql` grants exactly one moderation policy — `"event_comments: host
can moderate"`, `using (is_event_host(event_id))` — and column-level UPDATE
on `hidden` is granted to `authenticated` generally but gated by that same
RLS policy. There is no "look owner" carve-out anywhere in the schema.

**What I did:** gated the client on `isHost`, matching the real permission,
rather than offering a "Hide" action to a look's poster that the server
would refuse. Kept everything else the atlas asks for: the removal is named
("`{host}` hid this comment"), the author still sees their own line, and a
reported comment collapses but stays openable. Changing the RLS policy to
add a look-owner carve-out is a real, defensible product question, but it's
a migration on shared infrastructure and not this unit's call to make
solo — noted here rather than shipped silently narrower than the prose
promises.

## 7 · EC-03's "blocked author" row is unreachable from the live thread

**Not a gap I chose — a consequence of a fix that already shipped.**
`supabase/migrations/20260807120000_event_content_block_filter.sql` screens
a blocked author's comments out at the `select` policy
(`not blocked_between(...)`), so the client never receives a row to render
this way; the state can't occur live no matter what the UI does with it.

**What I did:** `CommentRow` still carries a `blockedAuthorName` prop that
renders EC-03's exact "Hidden because you blocked Rob · Undo" row — built
and exercised only by `src/app/dev-comments.tsx`'s fixture, with a comment on
the row explaining why the live thread can't produce it. The fourth
moderation state is on record and inspectable even though no real thread
will ever show it.
