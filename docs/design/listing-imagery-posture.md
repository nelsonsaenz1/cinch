# Listing imagery — what Cinch does, what it refuses, and what is still exposed

Written 2026-08-10, against `supabase/functions/garment-search/` as it stands on
that date. Companion to `docs/ai-provider-terms.md` §2.8, which covers the
search leg's data handling; this document covers the *imagery* — whose pictures
move, where they land, and on what footing.

It is written to be read by somebody who is not friendly to us. Every claim
below points at a file and a line, and the residual-risk section is not a
formality. **A document of this kind that concludes the risk is zero is worth
nothing**, and this one does not conclude that.

---

## 0 · The correction to carry first, so nobody re-raises it

There is a standing refusal in two design contracts —
`docs/design/privacy-invite-help-contract.md` §8 (*"CC0 imagery only"*) and
`docs/design/positioning-contract.md` (*"Garment imagery stays CC0"*) — and it
does **not** govern this feature.

That rule governs the garment photographs **Cinch itself ships**: the twelve
files in `assets/garments/` (`white-linen-blouse.jpg`, `cognac-shearling-coat.jpg`
and the rest, catalogued in `assets/garments/MANIFEST.md`), which appear on the
sign-in cover, the sample plate, the example closet and the App Store
screenshots. Those are imagery Cinch publishes to the world under its own name,
to sell itself. They must stay CC0 and they are.

A listing photograph imported by a user is a different object with a different
audience: it lands in a **private** Storage bucket, under that user's own
prefix, visible to that user and to nobody else unless they later choose to
share the item. Cinch does not publish it, does not put it in a screenshot, and
does not use it to market anything. **Describing this feature as a violation of
the CC0 rule is a category error**, and it has been raised more than once. It is
recorded here so the answer is written down rather than re-litigated.

The CC0 rule is not the constraint on this feature. The constraints are in §3.

---

## 1 · What the feature is

Three doors into the same room, all in `supabase/functions/garment-search/`:

| Door | Action | What the user does |
|---|---|---|
| **Describe** | `search` → `import` | Types "Reformation Gemma dress, navy". Gets up to six product images. Taps one. It becomes a closet item. |
| **Paste a link** | `resolve` → `import` | Pastes a product URL from a shop's app. Sees a preview. Confirms. |
| **Match and confirm** | `match` → `attach` | Photographs their own garment, then re-dresses it with the retailer's listing photo. `detach` puts it back. |

The reason the feature exists is in `index.ts`'s header docblock and is worth
restating, because it is the counterweight to everything in §5: the category's
biggest failure is an empty closet. People install a wardrobe app, are asked to
photograph forty garments, photograph three, and never return. This is the other
door.

---

## 2 · Exactly which bytes move, and where they stop

### 2.1 Outbound, from Supabase's network

| # | Request | Made by | Goes to |
|---|---|---|---|
| 1 | Chat completion with `plugins: [{ id: 'web', engine: 'exa' }]` | `provider.ts:completeWithWebSearch` | OpenRouter → a model provider, and separately → **Exa** |
| 2 | `GET /robots.txt` | `policy.ts:fetchRobots` | each candidate host, once per hour per origin |
| 3 | `GET` the candidate product page | `provider.ts:resolveAgainstCitations` | the retailer, ≤ 768 KB, 8 s |
| 4 | `GET` the chosen product image | `index.ts:importImage` / `attachListing` | the image host, ≤ 5 MB, 15 s |

Every one of 2–4 goes through `net.ts:guardedFetch`: https only, no private
addresses, redirects followed by hand and re-vetted at each hop, body capped
while streaming. Identified honestly as `CinchBot/1.0 (+https://cinch.app)` —
no browser impersonation.

On the `match` door, request 1 additionally carries a **300-second signed URL to
the user's own photograph** and a ≤ 500-character descriptor built from the
item's tags (`index.ts:describeItem`). What that means for the user's privacy is
`docs/ai-provider-terms.md` §1.2 and §2.8's subject, not this document's.

### 2.2 What is stored, and where

One object. Always in the **private** `garments` bucket, always under
`{user_id}/{item_id}/`, which is the prefix the bucket policy authorizes on:

| Door | Path | Row columns written |
|---|---|---|
| `import` | `{user}/{item}/original.{ext}` | `image_path`, `thumb_path`, `status`, `description`, **`listing_source_url`**, **`listing_source_label`** |
| `attach` | `{user}/{item}/listing/original.{ext}` | `listing_path`, `listing_source_url`, `listing_source_label`, `listing_confirmed_at` |

Fixed filenames, `upsert: true`. Re-confirming a different listing **overwrites**
rather than accumulates, and `attachListing` removes the previous object when a
changed file extension would otherwise strand it. **Cinch never accumulates a
retailer's catalogue** — the ceiling is one image per item per role, and
`MAX_IMAGE_BYTES` is 5 MB (`index.ts`), lowered from 10 MB in this change
because a listing hero shot is under a megabyte and anything past five is a
print master we have no business keeping.

Nothing is hot-linked. Nothing is served from a retailer's CDN at display time.
The user sees our own bytes through a signed URL, which also means a retailer
that deletes the original does not blank a stranger's closet.

### 2.3 What comes back out

`detach` (`index.ts:detachListing`) clears the four `listing_*` columns and
removes the object. It sits **above the AI-consent gate** on purpose: somebody
who has since switched AI processing off must still be able to undo what they
did while it was on. Account deletion removes the bucket prefix with everything
else.

For an **imported** item there is nothing to detach — the retailer's photograph
*is* the garment's only picture — so removal means deleting the item. That
asymmetry is real and is called out again in §5.

---

## 3 · The policy: what is permitted, what is refused

Implemented in `supabase/functions/garment-search/policy.ts`. Its own docblock
carries the full reasoning; this is the summary a non-author needs.

### 3.1 What we chose not to do

**Not an allowlist.** Twenty named retailers is the version that survives a
lawyer's first reading and none of a user's. Clothing is a long tail — the dress
somebody wants is as likely to come from a four-hundred-customer Shopify store
as from Nordstrom — and a feature that returns nothing for the small shop is not
safer, it is broken in a way the user blames themselves for. Worse, an allowlist
is a *claim*: it implies we vetted those twenty and they agreed. We have signed
nothing with any retailer, so the claim would be false in exactly the way that
matters.

### 3.2 The premise, stated so it can be attacked

A product listing photograph is published **by the seller**, **with Open Graph
tags whose entire purpose is to have that image copied and re-displayed by
whoever links to the page**. That is the protocol working as designed, not an
oversight. What we owe in return is to honour the mechanisms that let a site opt
out of exactly that, to attribute, and to stop where the premise stops holding.

The premise is not a licence. See §5.1.

### 3.3 The five rules

| Rule | Enum reaching the client | Meaning |
|---|---|---|
| Host is a social network, pinboard or image cache | `not_a_retailer` | The picture was published by somebody selling nothing. Premise fails outright. |
| `robots.txt` refuses our path | `robots_disallowed` | Checked **before** the fetch it governs. `CinchBot` group wins over `*`; longest match wins; `allow` wins ties (RFC 9309 §2.2.2). |
| `robots.txt` could not be read at all | `robots_unavailable` | 5xx, 429, timeout, transport failure. We decline rather than assume permission. |
| `X-Robots-Tag` or `<meta name="robots">` says `noindex` / `none` / `noimageindex` | `noindex` | Checked on the page **and** on the image response, before anything is written. |
| The same two places say `noai` / `noimageai` | `no_ai_use` | No RFC and no case law behind these. Honoured anyway. |

Resale marketplaces — Poshmark, Depop, Vinted, eBay — are **deliberately absent**
from the first rule. A person selling a garment and publishing a photograph of
it to be shared is the same situation as Nordstrom, and excluding them would cut
out most of what makes a secondhand wardrobe findable.

### 3.4 Where the strictness stops, and why that was a measurement not a taste

`robots_unavailable` declines. But a **4xx** and an **unfollowable redirect
chain** both mean *allowed*, per RFC 9309 §2.3.1.2–3. That boundary was moved
during implementation on evidence: `reformation.com` — a first-party brand site,
precisely the source this feature exists for — 301s
`www.reformation.com/robots.txt` to `http://www.thereformation.com/robots.txt`,
and the stricter reading refused the entire shop over a scheme downgrade in a
courtesy lookup. The plain-http hop is still never followed; only the conclusion
drawn from not following it changed.

Verified against live files during implementation: Nordstrom's real robots.txt
correctly admits `/s/a-dress/1234` and `/browse/women/clothing` while refusing
`/search?…`, `/sr/`, `/s/-/…`, `/s/*/*/full` and `/shoppingbag` — including the
`*` and `$` extensions and query-string matching.

### 3.5 Preference, not permission

`PREFERRED_SOURCES` in `policy.ts` lists twenty retailers with public affiliate
or product-feed programmes. It **only nudges ordering** (`PREFERENCE_BONUS`,
0.05 on a 0–1 confidence — smaller than the gap between a confident match and a
hopeful one). Nothing is refused for being absent, and the list will go stale;
that is tolerable precisely because it gates nothing. Its purpose is that on the
day somebody joins one of those programmes, the traffic is already pointed
there. See §6.

### 3.6 Refusal is never silence

This is the rule that makes the other five shippable.

- **Single-source paths** (`resolve`, `import`, `attach`) return HTTP **403**
  with `{ error: 'source_declined', reason, source, message }`. 403 rather than
  400 because nothing was malformed — the user did everything right and the
  answer is still no.
- **Search paths** (`search`, `match`) return **200** with the tiles that
  survived plus `declined: [{ source, reason }]`, one entry per host. A search
  that found four and refused two is a normal search.
- `reason` is a closed enum. `message` is always present and always true, so a
  client that meets an unknown value degrades to a correct sentence.

An empty grid teaches a user the feature is broken. A named refusal teaches them
it has limits. Only one of those is true.

### 3.7 The chain is now consistent end to end

Exa's own crawler documentation (<https://crawler.exa.ai/>, 30 July 2026, quoted
in `docs/ai-provider-terms.md` §2.8.3) states that ExaSearchBot *"respects the
Robots Exclusion Protocol"*, checks it *"before fetch"*, honours `noindex` and
`X-Robots-Tag`, and fetches *"Public content only"*. As of this change Cinch's
own fetches follow the same two rules in the same precedence order. Before it,
the search leg was polite and our leg was silent.

---

## 4 · Attribution

**Every stored retailer image now records where it came from.** Both columns,
both paths, never null.

| Path | `listing_source_url` | `listing_source_label` |
|---|---|---|
| `attach` (`index.ts:attachListing`) | the confirmed product page, parser-normalized | `hostLabel(page)` |
| `import` (`index.ts:importImage`) | `pageUrl` when the client sends one; otherwise **the image URL actually fetched, after redirects** | `hostLabel` of whichever was used |

Both labels are derived **server-side** from the URL the server itself used. The
client sends a `source` string; the write path accepts it and **ignores it**.
Attribution a client can set is attribution that can be wrong, and a wrong
source line is worse than a coarse one.

`import` writing these columns is new in this change. Before it, an item created
through the Describe or Paste door carried a retailer's photograph and **no
record of the retailer at all** — which is the one outcome this feature has no
answer for, because there is no reply to "where did you get that" beginning with
"we did not write it down".

`listing_path` and `listing_confirmed_at` stay null on `import`, deliberately:
there is no separate listing object layered over a user photograph, so claiming
one would give `detach` a path to delete the item's only image.

**One gap remains, and it is client-side.** `src/app/item/[id].tsx:283` gates
the visible "Listing photo · arket.com" line on `listingPath` being set, so an
imported item's attribution is recorded in the database and **not yet shown on
screen**. The row is defensible today; the surface is not. That is a one-line
change in a file this work does not own — flagged, not made.

---

## 5 · Residual risk, stated without softening

### 5.1 The premise is not a licence, and we have no licence

Honouring `robots.txt` is **evidence of good faith, not permission**. No
retailer has granted Cinch a right to copy its photographs. Most retailers'
terms of service forbid automated collection in broad language, and no program
can read those terms. If a retailer objects, they are very likely within their
rights, and the correct response is to comply immediately — not to point at this
document. **This is the largest exposure and nothing in §3 reduces it to zero.**

What §3 does buy is proportionality: a specific user, a specific garment they
own or intend to buy, one image, private storage, attributed, and a mechanism to
stop. That is the difference between a defensible feature and an indefensible
one. It is not the difference between infringing and not.

### 5.2 Copyright sits with the photographer, not the shop

The listing photograph is somebody's copyrighted work. Attribution is not a
defence to copying. The strongest facts in our favour — private storage, single
copy, no publication, user-initiated, transformative context — are fair-use
*factors*, not a fair-use *finding*, and nobody has litigated this shape.

### 5.3 Sharing widens it, and the current answer is untested

If a user shares an item to a friend closet or an event post, a listing
photograph they did not take may be shown to other people. Storage is private
and sharing is user-initiated, but *"private bucket"* stops being the whole
answer the moment a second person can see it. **This has not been reviewed
against the social surfaces** and should be, before any surface renders a
`listing_path` image to a viewer who is not its owner.

### 5.4 `noai` is a convention, and `robots.txt` was never about this

`robots.txt` governs crawling for indexing. Reading it as consent to copy a
photograph into an app is a *stretch of its purpose in our favour*, and an
honest reader should say so. `noai` / `noimageai` have no standard and no
enforcement. We honour both; neither creates a right.

### 5.5 The parts we cannot see

- **Exa.** `docs/ai-provider-terms.md` §2.8: publishes no retention period for
  query data anywhere; states affirmatively that query data trains its models;
  takes a *"perpetual and irrevocable"* licence over User Input in §1.2(c) of
  its terms. Whether any of that reaches Cinch's traffic turns on a
  business-customer carve-out we cannot see the other side of. **Not resolved.**
- **Whether the user's query reaches Exa verbatim.** Not stated by OpenRouter.
  The code is written for the worst documented case.
- **DNS rebinding.** `net.ts` says so itself: a public hostname resolving to a
  private address is not defended against, and only an egress proxy fixes it.
- **What a retailer's own terms say.** Unreadable by any program, and unread.

### 5.6 The imported item has no undo but deletion

`detach` restores a user's own photograph on the `attach` path. On the `import`
path the retailer's picture is the only picture, so a takedown means deleting
the item. If a takedown ever arrives naming a specific retailer, there is **no
query today that finds every affected item** — although, as of this change,
`listing_source_label` makes writing one possible. Before this change it was not.

---

## 6 · What a human has to do, that no function can

Ordered by how much exposure each removes.

1. **Join affiliate / product-feed programmes.** Nordstrom, Net-a-Porter, SSENSE,
   Revolve, ShopBop, ASOS and the rest of `PREFERRED_SOURCES`, plus the network
   aggregators (Rakuten, CJ, Impact, AWIN, Skimlinks). A feed replaces "we read
   your Open Graph tags" with "we are a partner and you gave us the assets", and
   it is **the actual fix for §5.1 and §5.2** rather than a mitigation of them.
   Everything in `policy.ts` is a bridge to this.
2. **Publish a takedown contact and honour it.** A named address on the website
   and in the App Store listing, plus a written commitment to remove on request.
   Cheap, and the single most useful thing available before (1) lands. It needs a
   route into the app-store listing and the web surface, both of which are other
   people's files.
3. **Ask OpenRouter, in writing, what reaches Exa and under what agreement.**
   The exact question is in `docs/ai-provider-terms.md` §5 item 4. It decides
   whether §2.8.2's training sentence applies to a Cinch user's search.
4. **Decide the sharing question in §5.3** before any social surface renders a
   listing image to a non-owner.
5. **Show the attribution that is now recorded** — the client change in §4.
   Provenance stored and not displayed protects us in a deposition and not the
   user, and the user is the reason it is stored.
6. **Re-read `PREFERRED_SOURCES` when (1) happens.** It is a list of intentions
   until somebody signs something; after that it should be a list of facts.

---

## 7 · What this change did not do

- Did not remove the feature or disable a door. All three still work.
- Did not touch `net.ts`'s security boundary. Courtesy rules live in
  `policy.ts` precisely so that relaxing one is never a line away from relaxing
  the other.
- Did not change the client. The `declined[]` field, the `source_declined`
  error code and the newly recorded provenance are all additive on the wire; a
  shipped client ignores them and behaves as before.
- Did not deploy. The function is typechecked and unshipped.
