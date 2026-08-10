# Where Cinch is allowed to sell — commerce directive

**Status:** design directive, wave 8. Written 2026-08-10.
**Replaces:** the flat "no affiliate links" position in `web/press.html`,
`web/privacy.html:111` and `:213`, and `docs/app-store-listing.md:496`.
**Read first:** `docs/design/positioning-contract.md`,
`docs/design/listing-imagery-posture.md`, `docs/design/free-tier-contract.md`.

---

## 0 · The rule the whole directive exists to protect

**Commission may never influence what Cinch recommends, in what order, or how
loudly.**

The Gap Feed ranks by outfits unlocked. That number is computed by
`outfit-count.ts` from the user's own closet and it is the reason the
recommendation is trustworthy: it decomposes into an argument the user can check
and disagree with. The moment a merchant's rate enters that sort — as a
tiebreak, as a boost, as a "sponsored" slot, as a thumb on any scale — the
number stops being a reason and becomes a pretext, and every other claim this
app makes about its engine becomes unverifiable at the same stroke.

So:

- The ranking function does not receive commission data. Not as an argument, not
  through a config table, not indirectly. It is computed before any merchant is
  consulted, and the merchant lookup happens **after** the order is fixed.
- No merchant may pay for placement, ever, in any surface.
- If two products satisfy the same gap, they are ordered by fit to the gap —
  slot, colour, formality, warmth — and never by rate.
- `ai_calls`-style accounting records what was earned. Nothing reads it back
  into a ranking path. A test asserts the ranking module has no import edge to
  the commerce module.

Everything below is downstream of this. If a proposal conflicts with §0, §0
wins, including a later instruction.

---

## 1 · Why here and nowhere else

Cinch's premise is outfits from clothes you already own. A "buy" affordance on a
garment somebody already owns is nonsense — it converts at zero and it insults
the user. That is not a moral objection, it is an accounting one: links on owned
garments are the version of this that earns nothing and costs the positioning
anyway.

There are exactly two places where a purchase link is honest, because in both
the user is looking at something they demonstrably do **not** own and has said
so themselves:

1. **The Gap Feed** — the screen that already computes what is missing.
2. **A friend's closet** — where the user is looking at somebody else's piece
   and the question "where is that from" is the one they are already asking.

Nowhere else. Not Today, not the Reveal, not the plate, not the closet grid, not
search, not the diary, not an email. The plate especially: an outfit built from
what you own must never carry a link to buy anything, or the whole artifact
becomes an advertisement.

---

## 2 · Surface one — the Gap Feed

`src/app/gap-feed.tsx` already exists and already ranks gaps by outfits
unlocked. This adds a second, subordinate row to a card that already makes its
argument.

### C-01 · The gap card, with a source

The existing card is unchanged above the colophon. Below it, one line:

> **A white shirt** would give you fourteen more outfits.
> *Three at Everlane, Sézane and Uniqlo — from $38.* · **Paid link**

- The merchant row never appears before the computed line, and never in a
  heavier weight than it.
- **At most three merchants**, and they are the three that best match the gap's
  computed attributes, not the three that pay most (§0).
- Price is shown as a floor ("from $38"), never a discount, never a strike-
  through, never urgency. No countdown, no "only 2 left", no sale badge. Those
  are the grammar of a shop and this is not one.
- If no merchant matches the gap well, **the row is absent.** A gap card with no
  products is a complete card — the computed line was always the point.

### C-02 · The products

Tapping the merchant row opens a sheet, not a browser. The sheet lists the
matched products with the shop's own photograph, the name, the price, and one
`Open` action per product that leaves to the merchant.

The sheet header states the relationship in the app's own voice, every time,
not once in onboarding:

> *If you buy through one of these, Cinch earns a small commission. It does not
> change what we recommend — the ranking above is computed from your closet
> before any shop is consulted.*

That sentence is not legal boilerplate to be shortened later. It is the only
thing standing between this feature and the category it is trying not to join.

### C-03 · Off

One switch in Profile → Settings: **"Show where to buy"**, default **on** for
the Gap Feed. Off removes every merchant row and product sheet app-wide, and the
gap cards keep working exactly as they did before this directive.

---

## 3 · Surface two — a friend's piece

This is the one with a person on the other side of it, and it is therefore the
one with a consent model rather than a preference.

### C-04 · The ask

On a friend's closet item detail (`src/app/friends/[userId].tsx` and the item
surface beneath it), where the piece has a known listing source, one line:

> *Sophie's — Reformation Cleo dress.* **Find it** · Paid link

Tapping runs the same search the owner's own match used and opens C-02.

### C-05 · Consent, which is not the same as visibility

`20260808110000_friend_closet_privacy_layer.sql` already gives an owner
visibility toggles over their closet. **Those toggles do not grant this.**
Letting a friend *see* a coat is a different act from letting Cinch turn that
coat into a storefront listing with a commission attached.

So a second, separate, owner-held flag:

```sql
alter table profiles add column shoppable boolean not null default false;
```

**Default false.** Nobody's wardrobe becomes a sales channel because they
accepted a friend request. The setting lives in Profile → Privacy, next to the
closet visibility controls, worded plainly:

> **Let friends find where your pieces are from**
> *Off by default. When it's on, a friend looking at one of your pieces can
> search for it and buy one. Cinch earns a commission if they do. You earn
> nothing, and we will never tell you who looked.*

The last clause matters and is not optional. A creator-economy version of this
— where owners earn from their friends' purchases — turns every friendship into
a sales relationship and every closet into a storefront. **Do not build it.**
It is the single fastest way to destroy the thing that makes a friend's closet
worth looking at, which is that it is honest.

### C-06 · What is never aggregated

The brief asked for "popular pieces in people's closets." **Not in this wave,
and not in this shape.**

An aggregate over closets — "most-owned coat this month" — is a new data product
built out of what people privately own, and the privacy policy currently
promises nothing of the kind. Even done well it leaks: with a small user base, a
ranked list of owned pieces plus a visible friend graph re-identifies people.

If it is ever built it needs, at minimum: opt-in separate from `shoppable`, a
k-anonymity floor (no piece appears until N unrelated owners hold it, N ≥ 25),
no cut by geography or cohort, and its own paragraph in the privacy policy
before a single row is computed. Until all four exist, the answer is no.

---

## 4 · Disclosure

Three places, all required, none of them sufficient alone:

1. **At the link.** Every affiliate affordance carries the words `Paid link`
   adjacent to it, at the same size as the surrounding label, never in a
   lighter weight and never behind an ⓘ. FTC guidance is that disclosure is
   "clear and conspicuous" and proximate to the link.
2. **In the sheet.** The C-02 paragraph, every time the sheet opens.
3. **In the terms and the privacy policy.** The commercial relationship, which
   networks it runs through, and what data reaches them.

What reaches a network is a design constraint, not an afterthought: **a click
must not carry who the user is.** No account identifier, no closet contents, no
friend graph. The merchant sees a referral from Cinch and the product; they do
not see a person.

---

## 5 · What has to change the day this ships

These currently say the opposite and become false on the first affiliate link:

| File | What it says now |
|---|---|
| `web/press.html` | "There is no store. No catalogue, no affiliate links, no 'complete the look'." |
| `web/privacy.html:111` | "no affiliate links, no commission, and no way to buy anything in the app" |
| `web/privacy.html:213` | "There is no commercial relationship with any of them" |
| `docs/app-store-listing.md:496` | "Cinch sells nothing, has no affiliate links and never opens a retailer's site" |

All four change in the same commit as the first shipped link. Not before — they
would be false in the other direction — and not after.

The replacement is not silence. The honest version keeps the distinction that
was doing the real work:

> Cinch never sells you an outfit. Every look is built from clothes you already
> own. When the app works out that a piece is *missing*, it will show you where
> to find one and earns a commission if you buy — and that is the only place
> money changes hands.

---

## 6 · Standing refusals

1. **Commission never touches ranking.** §0. A test asserts no import edge.
2. **No purchase affordance on a garment the user owns**, anywhere, including
   their own closet grid, the plate, the diary and the share card.
3. **No shop grammar.** No discounts, countdowns, scarcity, sale badges, "deal"
   language, or push notification that mentions a product.
4. **Friend closets are opt-in and default off**, by a flag separate from
   visibility.
5. **Owners never earn from friends' purchases**, and are never told who looked.
6. **No aggregate popularity** until §C-06's four conditions all hold.
7. **The click carries no identity** to the merchant or the network.
8. **`Paid link` is never abbreviated, greyed, or hidden behind an icon.**
9. **One switch turns all of it off**, and the app is whole without it.
10. **No email, push, or share artifact ever carries an affiliate link.**

---

## 7 · Why this is worth doing at all

The Gap Feed is the one screen where Cinch tells you to buy something, and it
only does so because it computed that the thing is missing. That is a genuinely
better ad than an ad: it is specific, it is derived from your own wardrobe, and
it arrives at the moment the question is already in your head.

The reason it stays trustworthy is §0. Every shopping app in this category
started where this directive starts and ended up sorting by margin. The
difference between Cinch and that outcome is not intention — it is that the
ranking function here cannot see the money, by construction, and a test fails if
anybody wires it up.
