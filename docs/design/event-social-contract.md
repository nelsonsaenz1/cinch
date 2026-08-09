# The event & social contract

The frozen shared layer for the five event surfaces — Event Detail, Invite
Friends, Look Board, Event Comments, Share a Look. Written at Phase 0 from the
atlases in `design-refs/`, and **read-only to every implementation agent**.

Unlike the free-tier wave, these five are not five renderings of one number.
They are five rooms in one house, and what they share is a set of social rules
that only fail visibly when two surfaces disagree. Those rules are below.

---

## 1 · The composed look

One object, rendered at four sizes — 96pt card thumb, 224pt board poster,
full-bleed detail, share card — **with no re-composition anywhere**. Built at
Phase 1 and read-only:

- `src/features/event-outfits/look-layout.ts` — `lookCells`, `lookColumns`
- `src/components/look/look-plate.tsx` — `LookPlate`

**It is a grid, not Today's `stackLayout`.** The Share a Look atlas draws it
`1fr 1fr` to four pieces and `repeat(3,1fr)` beyond, and that is deliberate: an
overlapping stack hides the pieces a voter is comparing, and the board exists
so that one person's options can be judged against each other. `OutfitPostCard`
currently uses `stackLayout` and must move over.

What stays identical to Today: oat tray behind, a light plate under each
garment, contained and never cropped, drawn through the same `GarmentCell` so
the fallback chain (cutout → honest colour swatch → never a broken image)
cannot drift.

Overflow is fixed: seven pieces collapse to five plates and a `+2`, never seven
smaller plates. Order is never re-sorted — piece one is the look's face, and it
fills the thumbnail in Lately, on the event page and on any share card.

---

## 2 · Where the blush goes

**Blush means "yours" or "chosen", and it appears once per page.** The moment a
second surface takes it, the page stops saying which thing belongs to the
viewer.

| Surface | Blush is spent on |
|---|---|
| Event Detail | the "Your look" card. Nothing else on the page. |
| Look Board | the hairline on the card you picked, and the crown on the favourite. When both land on the same card, **only the crown keeps the fill**. |
| Share a Look | the lifted row while reordering. |
| Comments | nothing. |
| Invite Friends | the selected row tint. |

The accent is spent the same way — one filled action per screen. On Event
Detail it is the blush card's eyebrow, and for an invitee it moves to **Join**,
because that is the one thing they are there to do. Never both at once.

The four surfaces underneath, unchanged: `canvas` the page, `surface` cards
that hold other people's looks, `tray` the stylist's note and — in Comments
only — the composer and every moderation notice, so a grey block in a thread
always means the system and never a person.

---

## 3 · Rules that bind every surface

These are the ones that fail visibly when two units disagree.

**Zero is quiet.** A look with no picks prints no count line at all. Event
Detail's card prints its pick count only when it is greater than zero. `0 picks`
under someone's outfit is the cruellest string in the app.

**Counts up, absences invisible.** Picks and voter names are public. Who has
not voted, or not shared, is shown to nobody — including the host. The one
exception is Event Detail's "Still deciding" rows, which are the host's private
knowledge and appear on no one else's copy.

**No ranking, ever.** One crown, no second or fifth, and rail order is posting
order — never vote order. A tie holds the crown where it was. Before voting
closes the same pill reads **Ahead**, not a crown, because a crown that changes
hands hourly is a scoreboard.

**Report and block are two taps deep**, behind overflow, silent to the reported
person, never announced to the host, and they never remove content from anyone
else's view mid-review. The host is not a moderator.

**Removals are named, never silent.** "Mel hid this comment" — and the author
still sees their own line, so nobody is left talking into a room that has
quietly stopped hearing them.

**Nothing leaves the room.** Comments never appear in Lately, on a share card,
or on a profile.

**Optimistic writes keep their text where it was written.** A failed comment,
vote or invite retries *on its own row* — never a toast that disappears with
the sentence inside it. Invite failures report per person, never as one
rolled-up error.

**The gate is membership, not the route.** An invitee's page fires no board read
at all, rather than firing one the server will refuse and inventing an error
branch for it. Coarse before joined, precise after.

**Every destructive confirmation names what is lost in one sentence, and its
keep-option is named for the thing being kept** — never "Cancel", which inside
a "Cancel this occasion?" prompt is a coin flip.

---

## 4 · Inherited refusals

Everything in `docs/design/free-tier-contract.md` §4 still applies. In short:

1. **`faint` is not body text** — ~3.5:1 on canvas, fails AA. Use `muted`.
   Five instances of this got through the last wave.
2. No `className` on `Animated.*` — silently dropped. Use `style={}`.
3. No `mt-*` on a trimmed serif `Text` — cancels to ~0. Use `mb-*` on the
   sibling before it.
4. No two `text-*` colour utilities on one element.
5. No new native modules, no new dependencies.
6. Pure, testable logic goes in a `.ts` module, not a `.tsx` component — the
   test bundler cannot parse React Native's Flow source, so a test that imports
   a component fails to build. `look-layout.ts` exists for exactly this reason.

---

## 5 · Known trap: colliding state IDs

The Event Comments atlas numbers its states **M-01…M-04**. The already-shipped
Match & Confirm atlas numbers its states **M-01…M-12**, and those are live in
`docs/design/match-atlas/` and referenced throughout `src/features/match/`.

They are unrelated. When referring to a comments state in code or a commit,
write **EC-01…EC-04** and say so, or the reference is ambiguous forever.

---

## 6 · Server ground truth

The social write path was broken once and is fixed; do not re-break it.

- `INSERT … RETURNING` fails under RLS policies that call `STABLE` functions.
  Read the policies before adding a returning clause.
- Never add `to anon` policies on base tables, and never set
  `security_invoker = true` on a `public_*` view.
- The social terms sheet gates writes; it is wired and must stay wired.
- Never return a component from a hook.

Existing tables: `events`, `event_attendees`, `event_posts`,
`event_post_items`, `event_post_votes`, `event_comments`. Read the migrations
before assuming a column.

---

## 7 · Unit boundaries

| Unit | Surfaces | Owns |
|---|---|---|
| **D** | Event Detail, Invite Friends | `event/[id]/index.tsx`, `event/[id]/invite.tsx`, `components/events/**`, the guest list, RSVP, the group note |
| **E** | Look Board, Event Comments | `event/[id]/outfits.tsx`, `event/[id]/comments.tsx`, `components/event-outfits/**`, the vote pill, the comments sheet |
| **F** | Share a Look | `event/[id]/post.tsx`, the three-step compose flow |

All three consume `LookPlate` and must not reimplement it. Comments open as a
**sheet over the board**, not a route (L-03) — Unit E owns both sides of that,
which is why they are one unit.
