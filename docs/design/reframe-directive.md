# The Reframe — master directive

**Status:** master directive. Written 2026-08-10. Supersedes no existing document;
it *sequences* them.
**Scope:** positioning, copy, information architecture, two new surfaces, six
regenerated ones, and the App Store record.
**Companion:** `docs/design/voice-intake-directive.md` — the full state-by-state spec
for The Walkthrough. This document does not repeat it; it places it.

---

## 0 · Read this before you touch anything

**This is a reframe, not a rebuild.** The product is largely right. Almost nothing is
deleted. The engine, the social layer, the closet, the plan, the stylist, the paywall
and the design language all stay exactly as they are.

What changes is: **one new way in, one promoted way to stay, and the words around
both.**

Three things this directive is not permission to do:

1. **Not permission to delay v1.0.** Wave 0 is copy and metadata only, ships in the
   current build, and blocks on nothing. Everything else lands after launch. Reasons
   in §3.
2. **Not permission to restructure navigation.** Today / Closet / Plan stay. §6.1.
3. **Not permission to build a screen without an atlas.** §5 lists exactly which
   renderings must exist first. If an atlas named there is missing, **stop and say
   so** — do not infer a layout. That discipline is why this codebase's screens
   agree with each other.

---

## 1 · The thesis, in one page

Every wardrobe app in the category loses its users at the same place: somewhere
between item twelve and item fifty, before the app has done anything for them. The
market has produced exactly two answers. Whering is spending a $7M seed making
photographing *faster*. Combyne avoided the problem by never using your real clothes
— which is why it has 87,000 ratings and everyone else has one to twelve thousand.
Stylebook took fifteen years to conclude the same thing and restructured around it.

**Cinch deletes the step.** You talk for four minutes.

That is the first half. The second half is what the first half unlocks.

The social layer's cold-start cost *is* the cataloguing cliff, multiplied by the
number of friends. "Vote on my outfits" is an ask that requires your friend to
photograph her entire wardrobe first. That is why group features underperform in
this category — the prerequisite compounds per person. **Voice is what makes the
social layer possible at all.** "Talk for four minutes" is an ask you can make of
five friends. "Photograph your closet" is not.

So they are not two selling points. They are a sequence:

> **Voice is the promise. The occasion is the payoff.**

### The one word to stop using: "social"

Combyne is social, has 87,000 ratings, and owns that word in this category. Whering
is social with 10M users. Acloset has a feed and a marketplace. Leading with "social"
files Cinch under a category leader and forces a paragraph of explanation to escape
it. You do not get a paragraph.

The sharper frame is **the occasion**. Not *"vote on outfits with friends"* but
*"the six of you have a wedding in three weeks — sort it out here."*

That reframe does four things "social" cannot:

- It escapes the Combyne comparison entirely. Combyne is a game; this is a plan.
- It attaches to real, high-anxiety search intent — *wedding guest outfit*, *what to
  wear to a work dinner* — which **no top-10 app claims in title or subtitle**.
- It makes the invitation natural. You are not asking a friend to try your app; you
  are adding her to a thing she is already going to.
- **It has a date.** A date creates urgency, repeat opens and a deadline. "Social"
  gives you none of that, and retention is the whole reason this half exists.

### The four jobs

Each surface has exactly one. Do not let them blur.

| Job | Surface | Message |
|---|---|---|
| **Get found** | App Store search | category terms: outfit planner, capsule wardrobe, packing, wedding guest |
| **Convert** | Product page, screenshots, video | *Talk for four minutes. Your whole closet.* |
| **Retain** | The occasion | *The wedding's in three weeks. Sort it out together.* |
| **Spread** | The vote request | *Which one?* |

**Voice is a conversion asset, not a search asset.** Nobody types "voice closet" into
the App Store. It wins on the product page and in a fifteen-second screen recording.
Do not spend a single character of the keyword field on it.

---

## 2 · What is defensible

Worth stating plainly, because it determines what must not be compromised when
something has to give.

Voice intake is not technically hard — a speech model plus a structured parse is a
weekend for anyone. The moat is **positional**. Whering, Alta and Acloset have built
their brand, onboarding, screenshots and entire visual identity on photographed
garments. Adopting voice means admitting their core flow is the problem, and
incumbents are extraordinarily slow to do that. The drawn-silhouette rendering
extends the lead further, because copying it means abandoning the photo-grid
aesthetic the whole category shares. That is an identity change, not a feature add.
Estimate nine to eighteen months of clear air.

But the durable thing is neither feature on its own. It is the loop:

> voice makes onboarding cheap enough that a **whole group** can join → which makes
> occasions actually work → which is why anyone invites anyone → which is why voice
> matters in the first place.

Anyone can copy voice intake. Anyone can copy voting. Copying one piece of that loop
does nothing, because the value is in the sequence. **When something has to be cut,
cut whatever leaves the loop intact.**

---

## 3 · Three waves

### Wave 0 — ships in v1.0, blocks on nothing

Copy and metadata only. No new screens, no new modules, no migrations.

- App Store title, subtitle, keywords, promotional text, description (§8)
- Screenshot caption overlays only — the frames themselves stay (§5, atlas J)
- In-app copy corrections listed in §7
- Apple featuring nomination filed

**Ship v1.0 on this.** Launching gets the listing indexed and ASO compounding — which
takes weeks and cannot be started retroactively — gets the first real funnel data,
and gets the nomination in while the three-week window is open.

### Wave 1 — v1.1, target early October

**The Walkthrough.** Voice intake end to end, per
`docs/design/voice-intake-directive.md`, plus the silhouette system and the closet
and reveal changes that follow from it.

This is the second launch moment: a fresh Apple featuring nomination under **App
Enhancements**, a second content wave, and a genuine reason to return to the
newsletters. Two shots on goal is strictly better than one delayed shot.

### Wave 2 — v1.2, target November

**The Occasion.** The social layer reframed around dated events, the Today interrupt,
and the three share cards.

Waves 1 and 2 are ordered this way deliberately: voice must exist before occasions
are worth promoting, because an occasion with one participant is an empty room.

---

## 4 · What must NOT change

Standing refusals. These override any later instruction, including one from me.

1. **No sourced, scraped or third-party product images.** Ever. The three reasons are
   in `voice-intake-directive.md` §0. The shipped App Store description says
   *"nothing is imagined, nothing is a catalogue photo"* — that sentence is the
   brand, and it is what separates Cinch from Alta.
2. **The Ten is not removed, demoted or deprecated.** Two front doors, permanently.
   Voice is better for a full wardrobe; photographs are better for ten considered
   pieces and give true colour.
3. **A garment with no image is a complete garment.** No badging, dimming,
   sorting-down or nagging.
4. **Progress is a count, never a bar or a percentage.** Anywhere.
5. **Exactly one oxblood action per screen.**
6. **Nothing is ever lost.** Undo on destructive actions; the plan ceiling stores
   rather than deletes; a failed upload keeps its source.
7. **No new colour tokens.** Everything draws from `tailwind.config.js` and
   `src/theme/tokens.ts`.
8. **`faint` (#8A8578) is not body text.** ~3.5:1, fails AA. This refusal has been
   applied five times; it is settled.
9. **The model never invents OKLCH.** It returns a colour term; the app maps terms
   through the lexicon in `src/lib/color/`.
10. **No leaderboards, no cross-attendee comparison, no strangers, no public feed.**
    The occasion reframe must not become a social network. `docs/social/product-spec.md`
    §7.1 permanent non-goals still bind.
11. **RLS is the whole authz model.** Every new table gets owner-only policies and
    pgTAP coverage across `anon`, owner, an unrelated authenticated user, and
    `service_role`.

---

## 5 · What Nelson must produce — the atlas manifest

**This is the blocking dependency for Waves 1 and 2.** Claude Code builds from
renderings, not from prose. Each entry below names the atlas, its status, its states,
and the wave that needs it.

Format, matching existing practice: a `.dc.html` source plus PNG renderings, landing
in `docs/design/<name>-atlas/` with `renderings/` alongside, mirrored into
`design-refs/`.

**State-prefix collision warning.** The free-tier contract already uses `T` (The Ten),
`R` (The Reveal), `G` (Gap Feed), `W` (The Wall), `P` (The Repeat), and the paywall
uses `M`. New atlases below use **two-letter prefixes** to stay unambiguous. Do not
renumber the existing ones.

---

### NEW — Wave 1

#### A · Walkthrough Atlas — `WK`

The voice capture flow. Six states.

| ID | State | Must show |
|---|---|---|
| WK-01 | The invitation | Display line, the three example chips, the privacy line, one oxblood `Start`, the `Photograph instead` escape |
| WK-02 | Listening | The seismograph level meter (a horizontal rule of ~48 strokes, amplitude-driven, scrolling right to left — **not** a circle or pulsing orb), elapsed time in tabular serif, `Pause` + `Done`, neither oxblood |
| WK-03 | Listening + nudge | WK-02 with the silence prompt in `muted` below the timer |
| WK-04 | Reading | **Three frames required**: (a) transcript full, (b) mid-lift with spans brightening and translating into the pile, (c) pile settled. This is the animation spec — prose cannot carry it |
| WK-05 | What I heard | The count in serif, the "didn't catch" disclosure collapsed and expanded, one oxblood `Check them` |
| WK-06 | Nothing heard | **Four variants on one board**: mic denied · silent recording · nothing parsed (with full transcript visible) · offline |

#### B · Procession Atlas — `PR`

The confirmation cards. Seven states.

| ID | State | Must show |
|---|---|---|
| PR-01 | The card, confident | Count top-left (`4 of 23`), silhouette at ~46% viewport height, name in serif, attribute chip row, **the receipt line** (`you said: "…"`), oxblood `Confirm`, and `Fix something` / `Not mine` |
| PR-02 | The card, unsure | PR-01 with chips in `muted` and the hedge copy |
| PR-03 | The correction sheet | Sheet over PR-01: name, kind, colour, fabric, pattern, formality, warmth |
| PR-04 | The colour grid | Named swatches grouped by hue family — **never a hue wheel** |
| PR-05 | The photograph offer | The optional upgrade, with `Not now` genuinely equal-weight |
| PR-06 | The ambiguity | Receipt line prominent, count stepper 1–12 |
| PR-07 | The gap | A counted slot still empty; inline field with mic affordance. Sibling to The Ten's ninth state — draw them so they read as a pair |

Also show, as annotations on PR-01: the undo affordance (4s after a destructive
action) and the swipe-left-confirms / swipe-right-back gesture.

#### C · Silhouette Library — asset set, not states

**The largest single piece of design work in this directive, and the one that decides
whether the whole reframe looks intentional or improvised.**

Flat SVG garment shapes, one fill path each, 1px `rule` outline, **no internal
shading or highlights** — they are drawings, not renders. They must sit in the same
hand as the existing hanger and harmony icons in `docs/design/today-atlas/icons/`.

| Slot | Sub-shapes needed |
|---|---|
| `top` | tee, crewneck, button-down, blouse |
| `bottom` | trouser, jean, skirt, short |
| `dress` | midi, mini, maxi |
| `shoes` | flat, heel, boot, sneaker |
| `outerwear` | coat, jacket |
| `mid_layer` | cardigan, jumper |
| `bag` | tote, clutch, crossbody |

Twenty-two shapes. Plus **four pattern overlays** — stripe, check, floral, dot — as
low-opacity tiles that composite over any fill.

Deliver as individual SVGs plus one contact-sheet PNG showing every shape at three
fills (a light, a mid, a dark) so the outline weight can be judged against real
colours.

---

### REGENERATE — Wave 1

#### D · Ten Atlas — add `T-00`

One new state ahead of the existing flow: **two doors.** Voice or photographs,
presented as equals. Neither may read as the fallback.

#### E · Reveal Atlas — add `R-06`

The whole-closet reveal. The existing R-02 handles ten pieces; this handles
twenty-three.

> **Twenty-three pieces. Two hundred and fourteen outfits.**
> *You talked for four minutes.*

That second line is the product promise and must be set in the same serif as the
number — **not** relegated to `muted`.

#### F · Closet Atlas — add `C-06` … `C-09`

The closet grid now holds drawn garments. Four states:

- **C-06** — an all-silhouette closet. This is what most users will actually have,
  so draw it as the *normal* case, not the degraded one.
- **C-07** — a mixed grid, silhouettes beside photographs. Show how they sit together
  without the photographs making the drawings look unfinished.
- **C-08** — item detail for a garment with no photograph.
- **C-09** — the stored / beyond-ceiling treatment: present, visible, 45% opacity,
  thin `rule` outline. Nothing hidden.

#### G · Membership Paywall Atlas — add `M-07`, `M-08`

- **M-07** — the ceiling after a large voice intake. The full closet drawn behind,
  complete; pieces beyond ten at 45% opacity. *"You own forty pieces. That's three
  hundred and eighty outfits. Cinch is holding all forty. Free keeps ten of them
  awake."*
- **M-08** — **"Keep ten for now"**, the picker. This state is not optional. An
  arbitrary first-ten reads as a hostage situation; a choice reads as an offer.

Fires **after** the Reveal. Never during the procession.

---

### NEW — Wave 2

#### H · Occasion Atlas — `OC`

Absorbs and replaces the framing of the existing New Occasion and Event Detail
atlases. Eight states.

| ID | State | Must show |
|---|---|---|
| OC-01 | The interrupt | The occasion card at the top of Today: name, date, days remaining, who has pinned, who has voted. This is the retention mechanic — draw it as the most important thing on the screen when it exists, and absent entirely when it does not |
| OC-02 | Name the occasion | Title, **date** (mandatory — a date is the whole point), optional dress code |
| OC-03 | The invitation | The ask, reframed. Not "join my app" — "you're going to this, come sort it out" |
| OC-04 | Waiting | Occasion created, nobody has pinned yet. The empty state that decides whether this feature lives |
| OC-05 | Pin your looks | Two options from your own closet, side by side |
| OC-06 | The vote | One person's options at a time, judged only against each other. **No cross-attendee comparison, no counts that rank people** |
| OC-07 | Decided | What got chosen, and by whom |
| OC-08 | The day | What everyone is wearing, the morning of |

#### I · Share Card Atlas — add three cards

All three are **iMessage-first**: a rendered image plus link into a 1:1 chat, with
pre-filled copy. Not a story post. (69% of share activity goes through chat apps;
direct sharing beat public posting for 94% of programs.)

- **SC-04 · The Reveal card** — "10 pieces → 14 outfits." Fires at activation.
- **SC-05 · The cost-per-wear card** — "This coat costs me $4.20 a wear now."
- **SC-06 · The vote request** — "Which one?" with two looks. The strongest natural
  share in the product, and the only invite in this category with a real reason
  attached: everyone else's is *get a free month*; yours is *I genuinely need you to
  pick one*.

#### J · App Store screenshots — full regeneration, five frames

Order matters more than any individual frame — the first two are what most people
ever see.

1. **Talk for four minutes** — the walkthrough mid-recording, the meter live
2. **Your whole closet, drawn** — the silhouette grid
3. **Twenty-three pieces. Two hundred and fourteen outfits.** — the reveal
4. **The wedding's in three weeks** — the occasion
5. **Which one?** — the vote

Wave 0 uses caption overlays on the *existing* frames to carry the new message
cheaply. This full set lands in Wave 2.

---

### Instruction to Claude Code on missing atlases

If a state named in §5 has no rendering, **stop and report which one.** Do not infer
a layout from the prose here — this document specifies intent and content, not
geometry. Where an atlas and this document disagree on *layout*, the atlas wins.
Where they disagree on a **standing refusal in §4, or on a claim about what the app
does**, this document wins and the deviation gets recorded in the build notes.
That precedent is already established: the Membership atlas said "unlimited
garments" when the real ceiling is 1,000, and the atlas lost.

---

## 6 · Information architecture

### 6.1 Tabs do not change

Today / Closet / Plan stay. **Do not promote Events to a tab.**

A tab is passive; the occasion needs to be urgent. The right pattern is an
**interrupt**: when a live occasion exists, OC-01 sits at the top of Today, above the
daily outfit, and it leaves when the occasion passes. That is a stronger retention
mechanic than a tab nobody opens, and it is a fraction of the work.

### 6.2 Two entrances to a closet

```
first run ─┬─ T-00 ─┬─ The Walkthrough (WK)  ─→ Procession (PR) ─┐
           │        └─ The Ten (T)           ────────────────────┼─→ Reveal (R)
           │                                                     │
           └─ (returning, closet empty) ──────────────────────────┘
```

Both paths converge on the same Reveal and the same `countOutfits()`. Neither path
may produce a garment the other could not.

### 6.3 Where the occasion lives

Created from Plan. Surfaced on Today. Voted from either. It does not get its own
tab and it does not get a feed.

---

## 7 · The copy system

### Message hierarchy — use in this order, everywhere

1. **Promise** — *Talk for four minutes. Your whole closet.*
2. **Proof** — *Real colour maths, not a language model guessing. Every outfit comes
   with the reason.*
3. **Habit** — *It knows the weather where you actually are, and what's on your
   calendar.*
4. **Occasion** — *The wedding's in three weeks. Sort it out together.*
5. **Payoff** — *Wear more of what you already own.*

### Terminology — enforce these

| Say | Never say |
|---|---|
| the occasion, the event | the group, the feed, the community |
| pin a look | post an outfit |
| your friends decided | your friends liked / rated / scored |
| walk your closet | scan, catalogue, digitise, import |
| drawn | generated, AI-generated, rendered |
| pieces | items *(in user-facing copy; `items` stays the table name)* |

### Banned in user-facing copy

- **"AI stylist"** as a headline. It is table stakes — Alta, Acloset, Style DNA, Fits
  and Pureple all carry it — and *"the AI suggestions are hit or miss"* is the
  category's second-most-common complaint. Claiming the thing users have learned to
  distrust is worse than saying nothing.
- **"Social"**, as a positioning word. §1.
- **"Unlimited"** anywhere near garments. The real ceiling is 1,000. This has been
  corrected twice.
- **Percentages and progress bars** in any onboarding copy.
- Any comparative claim about a competitor without a dated screenshot on file.

### Wave 0 in-app copy corrections

Ship these in v1.0; they need no new screens.

- The Reveal's whole-closet line, if the closet exceeds ten pieces at reveal time.
- Membership paywall context strings in `context-lines.ts` — occasion-aware variants.
- `docs/stylist-voice.md` §9 — extend the friends/borrowing rules to cover occasion
  language, holding the no-leaderboard and no-cross-attendee-comparison line.
- Invite email in `docs/email-templates/generated/invite.html` — reframe from
  "join Cinch" to "you're going to this."

---

## 8 · The App Store record

Exact strings. Paste them; the character counts are checked.

```
TITLE     (30/30)  Cinch: Outfit Planner & Closet
SUBTITLE  (30/30)  Capsule Wardrobe, Packing List
KEYWORDS  (99/100) digital,stylist,organizer,clothes,what,to,wear,ootd,style,calendar,inventory,wedding,guest,occasion
```

**Why this beats what is live.** The current subtitle — `Outfits, chosen with
friends` — spends 28 of 30 irreplaceable characters on words with essentially no
App Store search volume. The current keyword field spends six of fourteen slots on
`friends, social, borrow, vote, share, group`, and repeats `closet` and `outfit` from
the title and subtitle where **repetition does not stack**, wasting those slots
outright.

The replacement claims two lanes **no top-10 app holds in title or subtitle** —
capsule wardrobe and packing list — both of which map exactly to what Cinch actually
does. The keyword field contains zero repeats and relies on Apple's cross-field
combination to assemble *what to wear*, *wedding guest outfit*, *closet organizer*,
*outfit calendar*, *closet inventory*, *digital closet*, *occasion outfit*.

The social layer is real, shipped, and a genuine differentiator — but it belongs in
the **screenshots and description**, because it is not how anyone finds you.

```
PROMOTIONAL TEXT (152/170)
Talk for four minutes and Cinch builds your closet. Then it dresses you every
morning — and when the wedding comes, you and your friends decide together.
```

Promotional text is editable without a build. **Use it as the reframe's Wave 0
delivery vehicle** — it can carry the voice message before voice ships, phrased as
what's coming, or hold the occasion message until then. Do not describe voice intake
as shipping until it ships; that is a Guideline 2.3.1 exposure.

### Description

Restructure the existing 3,519-character description. Keep every accurate clause.
New section order:

1. **TALK YOUR CLOSET IN** *(Wave 1 — do not add before it ships)*
2. DECIDE TOGETHER → retitle **WHEN THERE'S AN OCCASION**
3. BUILT ONLY FROM WHAT YOU OWN — **unchanged, and never weakened**
4. IT UNDERSTANDS A WHOLE DAY
5. DRESSED FOR THE ACTUAL WEATHER
6. REAL COLOUR SENSE
7. SEE YOUR OWN STORY
8. BORROW FROM EACH OTHER
9. IT LEARNS YOU
10. PACK WITHOUT OVERPACKING
11. WORKS WITHOUT SIGNAL
12. PRIVATE BY DEFAULT — **add the voice retention sentence in Wave 1**

### In-App Events and Custom Product Pages

Both are indexed by App Store search and **no competitor in this category is using
either**. Roughly 200 extra indexed characters per event, refreshable monthly.

- **Events:** back-to-school (Aug), autumn wardrobe transition (Sept), holiday-party
  dressing (Nov), wedding season (spring).
- **Custom Product Pages:** one for *packing*, one for *capsule wardrobe*, one for
  *wedding guest* — each with its own screenshots, each pointed at from the matching
  keyword intent. Cap is 70.

---

## 9 · Engineering deltas

Full data model, Edge Functions, client modules and privacy work for Wave 1 are
specified in `docs/design/voice-intake-directive.md` §5–§9. Not repeated here. The
load-bearing points:

- **Parsed garments stage in `intake_drafts`, never straight into `items`.**
  `items_enforce_limit` is a `before insert` trigger; a free user speaking forty
  garments would die on row eleven with a raw check-violation mid-procession.
  Staging makes the ceiling fire once, at commit, where M-07 handles it as a designed
  screen.
- **`items.colour_source`** (`measured` | `spoken`) and **`items.intake_method`**
  (`photo` | `voice` | `manual`). The first makes the photo-upgrade path work; the
  second is the analytics cut that answers whether any of this worked.
- **Audio Data must be added to App Privacy** in both App Store Connect *and*
  `PrivacyInfo.xcprivacy` via `app.config.ts`. Apple cross-checks them; a mismatch is
  a review hold.
- **`delete-account` must reap** `intake_sessions`, `intake_drafts`, and orphaned
  audio objects. Cascades cover the tables; storage objects need explicit handling.
- **The README's model-boundary claim needs amending** — *"the model never sees your
  closet"* stops being true when you describe your closet out loud. State the
  exception rather than quietly breaking the sentence.

### Wave 2 deltas

- `occasions` gains a mandatory `occurs_on` date. An occasion without a date is not
  an occasion, and the date is what drives OC-01's interrupt and its dismissal.
- A `days_remaining` derivation, computed client-side from `occurs_on` — never
  stored, never cached.
- `blocked_between` must be present in the occasion-content RLS select policies. It
  is currently absent from event-content policies, so a blocked user's content stays
  visible inside a shared event. **Fix this before promoting occasions.**

---

## 10 · Analytics

Add to the closed union in `src/lib/posthog.tsx` — a free string is explicitly
disallowed.

Wave 1 events are listed in `voice-intake-directive.md` §9. Wave 2 adds:
`occasion_created` (days_until bucket) · `occasion_invite_sent` ·
`occasion_invite_accepted` (time_to_accept bucket) · `occasion_look_pinned` ·
`occasion_vote_cast` · `occasion_decided` · `occasion_day_opened`.

No names, no titles, no free text in any property. Buckets only.

### The five numbers that judge this reframe

1. **Time from `intake_started` to `intake_committed`.** Under 8 minutes for a
   30-piece closet. This is the entire thesis in one metric.
2. **Procession completion.** Above 80% of users who reach PR-01 reach the Reveal.
3. **`intake_card_edited` per garment.** Above ~25% and the parse is not trustworthy;
   the receipt line is carrying the whole experience.
4. **Occasion invite acceptance.** This is the K-factor. Below 0.2 and the loop is
   dead regardless of how good voice is.
5. **Install → paid.** Still the binding constraint, and still worth more than either
   feature. Neither voice nor occasions changes that; fix the paywall placement
   first.

---

## 11 · Acceptance criteria

### Wave 0
- [ ] Title, subtitle, keywords, promotional text live and character-legal
- [ ] Description restructured with **no** voice claim
- [ ] Screenshot captions carry the occasion message
- [ ] Apple featuring nomination filed, type App Launch
- [ ] Invite email reframed
- [ ] No user-facing string contains "social", "AI stylist" as a headline, or
      "unlimited" near garments

### Wave 1
- [ ] Atlases A, B, C, D, E, F, G delivered before any screen is built
- [ ] The Walkthrough completes end to end on a physical device, in a real closet,
      offline-tolerant, resumable after a cold start
- [ ] A 30-piece closet completes in under 8 minutes, measured
- [ ] Free-tier user speaking 40 garments reaches M-07 with **nothing deleted**
- [ ] Audio Data declared in both places; `delete-account` reaps everything
- [ ] README model-boundary claim amended
- [ ] Test table in `voice-intake-directive.md` §10 passes in full
- [ ] pgTAP covers `intake_sessions` and `intake_drafts` across all four roles
- [ ] Second featuring nomination filed, type App Enhancements

### Wave 2
- [ ] Atlases H, I, J delivered
- [ ] OC-01 appears on Today only when an occasion is live, and leaves cleanly
- [ ] `blocked_between` present in every occasion-content select policy
- [ ] All three share cards render, are iMessage-first, and carry pre-filled copy
- [ ] Referrer-named landing page live
- [ ] No leaderboard, no cross-attendee comparison, no public surface anywhere in OC

---

## 12 · The two sentences to protect

When the layout gets tight, the schedule slips, or a later instruction conflicts with
this one, these are the two things worth defending over everything else.

**The receipt line.** `you said: "my navy wool crewneck"` on every procession card. A
quoted mishearing is forgiven instantly. A confidently wrong garment with no
provenance makes people stop trusting the entire closet — and a closet they don't
trust is a closet they don't open again.

**"Nothing is imagined, nothing is a catalogue photo."** It is the sentence that
makes Cinch a different kind of thing from Alta, and the reframe can make it more
true than it is today or turn it into a lie. The difference is entirely in whether
the images are sourced or drawn.
