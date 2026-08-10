# Getting off the scrape — the three messages to send

Decision, 2026-08-10: **ship the current implementation, start the applications
now.** No licensed source can be obtained before launch — the research is
summarised in `listing-imagery-posture.md`, which already states the exposure
honestly and does not need rewriting.

These three are free to start and cost nothing but the sending. The point is to
start the clock, not to block the launch.

**Before you send any of them, read the last section.** Joining a network makes
a claim we currently publish false, and that has to be handled deliberately
rather than discovered later.

---

## 1 · Awin — the best-evidenced option

Apply at <https://ui.awin.com/awin-signup>. Free, plus a £5 identity deposit
that is refunded.

Awin is first because it is the only network where a brand of the right kind was
*confirmed* to run a programme — Sézane, verified on Awin's own merchant
directory. It also absorbed ShareASale in October 2025, so it is now the larger
of the two catalogues rather than one of two.

Publisher-profile description, when the form asks:

> Cinch is an iOS wardrobe app. People catalogue clothes they already own and
> the app builds outfits from them. It sells nothing and takes no commission.
>
> We are applying for product-feed access for one reason: when someone adds a
> garment they already own, we want to show the merchant's own product
> photograph of it instead of asking them to photograph a coat on a hanger. The
> image is attached to that person's private record of a garment they own. It is
> never shown to another user, never used in advertising, and there is no link
> out and no way to buy anything in the app.
>
> We would rather do this under a licence than not, which is why we are here
> before launch rather than after.

**The question that decides whether Awin is usable at all**, and it must be
asked in writing before any engineering time is spent:

> Does feed access permit us to **store** a merchant's product image against a
> user's own record indefinitely, or only to display it live from your feed
> while the programme relationship is active? If the licence ends when the
> relationship ends, we need to know that now, because it determines whether we
> can use the feed at all.

Do not accept a verbal or chat answer. Get it in an email.

## 2 · Rakuten Advertising — the same shape, second

Apply at <https://rakutenadvertising.com/publishers/>. Free.

Same description, same storage question. Rakuten is second only because no
target brand was confirmed on its directory — that may simply mean the
directory is harder to search, so it is worth the ten minutes.

## 3 · Channel3 — the fast one, with the missing piece

<https://trychannel3.com> — self-serve, 1,000 free searches a month, no card.
The only option that could be integrated in days rather than weeks, and the only
one that publishes **no licence terms at all**, which is the single thing we
would be buying it for.

Send this before signing up for anything beyond the free tier:

> We are evaluating Channel3 for an iOS wardrobe app. People catalogue clothes
> they already own, and we want to attach the merchant's own product photograph
> to a garment a person tells us they own, rather than making them photograph
> it.
>
> Three questions, and we need them answered in writing:
>
> 1. Does our licence permit **downloading and storing** the product image
>    returned by your API, against a user's private record, indefinitely — or
>    only hot-linking it live?
> 2. If a merchant leaves your catalogue, what happens to images we have already
>    stored? Is there a takedown obligation on us?
> 3. Do you warrant that you hold the rights to sublicense merchant imagery for
>    this use, and does that warranty survive in your standard terms?
>
> If the answer to (1) is display-only, that is a clear no from our side and we
> would rather know today.

Question 3 is the one that matters most and the one a small vendor is least
likely to answer cleanly. A vague answer is an answer.

---

## Do not bother with these

- **Amazon.** Its own operating agreement: *"You will not store or cache Product
  Advertising Content consisting of an image"* beyond 24 hours. That is the
  exact thing we need, forbidden in writing. Separately, the replacement API
  requires ten qualifying sales in a rolling 30 days, which a pre-launch app
  cannot have and would lose the moment sales dipped.
- **SerpAPI / DataForSEO / Zenserp** and the other Google-Shopping wrappers.
  Strictly worse than what we already do: none grants a storage licence, and
  Google sued SerpApi in December 2025 over circumvention of its anti-scraping
  measures, unresolved. Trading our exposure for someone else's litigation is
  not an improvement.
- **Sovrn.** Reputationally instant to approve; its own published Commerce
  Publisher Code of Conduct requires four months of existing content and
  traffic. We have neither.
- **Shopify / Google Merchant / Bing Content APIs.** Structurally wrong — each
  requires *being* the merchant or holding their explicit permission. There is
  no cross-retailer search in any of them.

---

## The thing to settle before sending anything

**Joining any affiliate network makes a claim we currently publish false.**

Three places say, in our own words, that no commercial relationship exists:

- `web/privacy.html:111` — "no affiliate links, no commission, and no way to buy
  anything in the app"
- `web/privacy.html:213` — "There is no commercial relationship with any of them"
- `docs/app-store-listing.md:496` — "Cinch sells nothing, has no affiliate links
  and never opens a retailer's site"

Signing a publisher agreement establishes exactly that relationship, and it does
so on the day you sign — not on the day you first earn a commission, and not
only if you add a buy button. Two of those sentences would stay true (no links,
no way to buy); the flat "no commercial relationship" would not.

So the sequence matters:

1. Send the licence questions **first**. They cost nothing and commit to
   nothing.
2. Only sign a publisher agreement once an answer makes the feed actually
   usable.
3. On the day you sign, the privacy policy and the App Store listing copy
   change in the same commit. Not afterwards.

The alternative — sign now, fix the copy later — means shipping a privacy policy
that is false about a commercial relationship, which is worse than the scrape it
was meant to replace.

---

## What the incumbents actually do

Worth knowing, because it reframes how unusual our position is: none of Whering,
Indyx, Acloset or Save Your Wardrobe documents a licensed retailer-image
partnership. Where a mechanism is described at all it is the same
scrape-at-time-of-add we are trying to leave.

Stylebook is the interesting one. Its privacy policy says outright that images
in the app are *"for personal, non-commercial use by an end user, and may not be
sold, licensed or otherwise transferred"* — and separately discloses affiliate
compensation. So the closest incumbent analogue treats retailer imagery as
personal-use-only and pairs it with disclosed affiliate income, rather than
claiming a cleared licence for the images.

That is not a licence, and it is not a defence. But it does mean the category
standard is the posture we already have plus a disclosure we do not need — and
that no competitor has solved this either.
