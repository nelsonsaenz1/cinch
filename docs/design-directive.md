# Cinch — Product Brief for Design

You are designing an iOS app called **Cinch**. This brief tells you what the app is and what every screen has to do. **The visual design is yours to create** — the look, the layout, the type, the colour, the motion. Treat what follows as the product, not the picture.

---

## What Cinch is

Cinch is **a personal stylist for the clothes you already own — and, increasingly, the clothes your friends own too.**

You photograph your wardrobe once. Every morning, Cinch builds outfits from your real garments — factoring in the weather where you are, what's on your calendar that day, and what it has learned you actually like to wear. Over time it gets to know your taste. When there's a dinner, a wedding, a trip with people in it, that same styling becomes a shared decision: everyone pins options from her own closet, friends vote and comment, and each person shows up in the look her friends helped her choose.

The thing that makes it different: **it only ever styles clothes someone actually owns.** It does not sell you anything and never shows you a garment nobody has. It is the opposite of a shopping app and the opposite of an aspirational feed — its whole promise is helping you get more out of what's already in your closet, and your friends' closets, together.

### Who it's for

People with a full closet who still feel like they have nothing to wear. People who want to dress well without thinking hard about it every morning. People who care about not wasting the clothes they bought. And, for the social layer specifically: people who already text a group chat "what are you wearing Thursday?" — Cinch is where that conversation happens with real outfits attached instead of guesses.

### What makes it special (and worth showing off in the design)

Cinch actually *computes* things about your wardrobe that competitors don't:

- **Cost-per-wear** for every garment — what each piece has really cost you each time you've worn it.
- **Colour harmony** — it understands which of your colours work together.
- **Real usage data** — what you wear constantly, what you never touch, how your money is distributed across your closet.

This data is the heart of the product. The design should make these numbers feel like the point, not like fine print. An outfit isn't just a picture — it comes with the facts behind why it was chosen.

The same moat extends into the social layer, and it's the reason Cinch's social features can't be copied by an app without real closets behind them: a friend's vote is on an outfit that's actually real, "chosen by the table" is a fact you can print in the interface, not a claim. Competitors doing "social styling" are voting on Pinterest boards. Cinch's friends are voting on someone's actual closet.

### The feeling

Cinch should feel like **a beautifully made print magazine or lookbook that regenerates itself every morning** — considered, editorial, quiet, confident. Not a busy dashboard, not a social feed, not a shopping app. It should feel like something made with taste, for someone with taste.

It's honest to a fault: it tells you plainly what it knows and doesn't pretend to know more. It never oversells.

---

## The screens

The app is organised around **three main areas — Today, Closet, and Plan** — with a Stylist and a Profile reachable from the Today screen. Here's what each one is for.

### Welcome / Sign-in
The first thing a new person sees. It should communicate the whole promise of the app in one screen — "a personal stylist for the clothes you already own" — and show, not just tell, by displaying a sample outfit. Sign in with Apple, or with email.

### Today — the home screen
The heart of the app. Every morning it shows a few complete outfits built for *that* day, each one presented as a laid-out set of garments with a name, the reasoning behind it, and the data that justifies it (the weather it accounts for, the colours in play, what it costs to wear). The user reacts to outfits (love it / not for me) — which is how Cinch learns their taste — and marks the one they actually wear. There's a spot to tell Cinch about the day's plans ("dinner at 7, then drinks") so it can style accordingly.

Design for its states: a brand-new user with an empty or nearly-empty closet (encourage them to add clothes), a normal day with outfits, a day where nothing quite works, and offline.

### Closet — the wardrobe
Everything the user owns, organised. It should be browsable by category — tops, bottoms, outerwear, shoes, accessories — and it should surface the usage insights: what's worn most, what's never been worn, cost-per-wear. This screen is where the "get more from what you own" promise becomes tangible, so make the organisation feel effortless and the data feel valuable. Include a good empty state and a good loading state.

### Item detail
One garment, up close: its photo, and its story — how often it's been worn, what it cost, what it costs per wear, what occasions it suits.

### Plan — the week ahead
Outfits laid out across the coming days, accounting for each day's weather and plans, with no piece repeated too often. Useful for planning a week or packing for a trip.

### Stylist — ask it anything
A conversational way to ask for help: "what goes with these boots?", "I have a dinner then drinks, what works?" It answers using only the user's real clothes, and is honest when they don't own the right thing rather than inventing something. When it suggests an outfit, that suggestion should feel like the outfits elsewhere in the app.

### Capture — adding clothes
How the user photographs their wardrobe. Take a photo or pick several from the library; Cinch processes each one (cleaning up the image, identifying what it is). Show progress clearly, and handle a first-run consent moment for the AI processing.

### Review — confirming what Cinch identified
After adding clothes, Cinch guesses each garment's category, colours, and details. The user quickly confirms or corrects these — one item at a time, fast. A clear way to accept, and a clear way to skip.

### Profile
The user's account: a summary of their style, control over the AI features (including turning them off), and the usual account bits — privacy, support, sign out, delete account.

### The shareable outfit
Any outfit can be exported as a single tall image made for sharing to Instagram or similar — the outfit, its name, and the data behind it, composed as one beautiful frame. This is the app's best advertisement, so it deserves to be the most striking thing you design.

### Social — deciding together
Full spec, screens and mocks: `docs/social/product-spec.md`, `docs/social/roadmap.md`,
`docs/social/founder-mocks.md`. In brief: an occasion (a dinner, a wedding, a trip)
lives on the Plan tab; friends join, each posts a couple of outfit options from her
own closet, everyone votes and comments, and a winning look gets crowned per
attendee — never a contest between people, always one person's options judged
against each other. Friend closets are browsable for borrowing. The Closet tab
gains a profile identity — most-worn pieces, favourites, the same cost-per-wear
data, now presentable to a friend. Same Plate grammar throughout: numbered
plates, serif titles, quiet colophons that print the social data the way they
already print weather and $/wear — `PINNED BY MARIA · 3 PICKS · CHOSEN`.

---

## A few things to hold onto

- **The data is the moat.** Cost-per-wear, colour harmony, usage — no competitor shows these. Wherever an outfit or a garment appears, its real numbers should be part of the presentation, not hidden away.
- **It only shows clothes someone actually owns** — the user's own closet, or a friend's, with her consent. Never design a "shop" or "discover new products" surface. That's not what this is.
- **Social is decision-making, not audience-building.** No leaderboards, no "best dressed," no public counts. Every vote is one person's options, judged only against each other, by the friends she invited.
- **Honest, never hype.** The copy and the design should state what's true plainly. If Cinch has only learned a little about someone, it says so.
- **Editorial, not app-y.** Lean toward the feeling of print — magazines, lookbooks, considered typography — over the feeling of a typical utility app or social feed.

Beyond these, the design direction is open. Bring a strong point of view.

---

## What to deliver

A design for the screens above, covering not just the ideal case but the empty, loading, and error states that decide whether an app feels finished. Whatever format is easiest to hand off as a **zip** — mockups, HTML, a component sheet — with a short note walking through what's included and the thinking behind the visual direction you chose.
