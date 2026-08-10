# The Walkthrough — voice intake directive

**Status:** design directive, wave 1. Written 2026-08-10.
**Replaces:** nothing. Sits *alongside* The Ten as a second front door into a closet.
**Read first:** `docs/design/free-tier-contract.md` (the counting function, the slot
model, the standing refusals), `docs/design-directive.md` / `.impeccable.md`,
`docs/stylist-voice.md`.

---

## 0 · The one refusal, up front

The proposal as briefed included: *the AI sources images of the products from the
web; each card offers a few sourced options to pick from; if none match, a link
opens a Google Image search, the user screenshots the result and uploads it.*

**Do not build that.** Three independent reasons, any one of which is sufficient:

1. **It is a copyright pipeline.** Sourced product photography is owned by brands
   and retailers. Fetching it, storing it in Supabase Storage, and displaying it as
   the contents of a user's closet is commercial reproduction of third-party work at
   scale. The Google-Images-screenshot path is worse than the automated one, because
   it is the app *instructing the user, in writing, on screen*, to copy an image
   somebody else owns. App Review reads screens. This is Guideline 5.2.

2. **It contradicts live App Store metadata.** The description currently in App
   Store Connect says, verbatim:

   > BUILT ONLY FROM WHAT YOU OWN — Every suggestion is assembled from real
   > wardrobes. **Nothing is imagined, nothing is a catalogue photo**, and nothing is
   > a piece you would have to go and buy first.

   A closet full of catalogue photos makes that sentence false. That is a Guideline
   2.3.1 exposure and, more importantly, it is the one claim that separates Cinch
   from Alta — which monetises by selling you clothes.

3. **It quietly breaks the engine.** `src/lib/color/` computes OKLCH from the
   garment's actual pixels. A stock photo of a *similar* navy sweater carries the
   stock photo's navy, its studio lighting, and its white-balance — not the user's.
   Every downstream harmony score would be computed against a garment the user does
   not own. That is precisely the failure users already complain about in every
   competitor: *"the AI suggests things that don't go together."* We would be
   engineering that complaint into the product on purpose.

**The instinct underneath the proposal is correct and it is the best product idea
in this project.** Speaking is roughly 150 words a minute. Photographing a garment
is 20–30 seconds of framing, cropping and waiting. A closet walkthrough is a
genuine order-of-magnitude improvement on the single problem that kills every app
in this category. Keep all of that. Discard only the images.

---

## 1 · What replaces the sourced image

**You do not need a photograph to build an outfit. You need attributes.**

The styling engine consumes: `slot`, colour in OKLCH, `fabric`, `pattern`,
`formality`, `warmth`. A spoken description supplies every one of them directly —
*"my navy wool crewneck"* is slot, colour, fabric, warmth and formality in four
words. The photograph was never the input; it was a slow way of *inferring* the
input.

So a garment created by voice has **no image at all**, and is drawn instead: a
**silhouette in Cinch's own hand**, filled with the garment's real colour, with the
pattern rendered as a subtle overlay. Not a photo. Not a stock image. A drawing of
what you said.

This is better on every axis that matters:

| | Photo intake | Voice intake |
|---|---|---|
| Time for a 40-piece closet | 20–35 min | **~4 min speaking, ~3 min confirming** |
| Copyright exposure | none | **none** |
| Cost per closet (40 items) | $0.012 + storage forever | **$0.037, no storage** |
| Colour fidelity | true (from pixels) | lexicon-derived, upgradeable |
| Works in a dark closet | no | **yes** |
| Feels like Cinch | neutral | **it becomes the brand** |

The one honest cost is colour fidelity: a spoken "navy" resolves to *a* navy from a
curated lexicon, not to *your* navy. That is a real and acceptable trade, and it is
**recoverable** — see §7, the photo upgrade path. A garment that later gets a
photograph replaces its lexicon colour with measured OKLCH and everything
downstream improves silently.

There is a second, quieter benefit. A closet of Cinch-drawn garments is
**visually unlike anything else in the category** — every competitor's closet grid
is a wall of cut-out photographs on white. A wall of Cinch silhouettes is a
screenshot people will post without being asked. The intake screen and the share
card are the same asset.

---

## 2 · The shape of the flow

Thirteen states. Names are `V-01`…`V-13` and are the reference used everywhere
below and in the build spec.

```
V-01  The invitation        — before the mic opens
V-02  Listening             — recording, live
V-03  The nudge             — optional prompt, inside V-02
V-04  Reading               — transcribe + parse, the "beautiful" state
V-05  What I heard          — the count, before the procession
V-06  The card              — one garment, confirm or correct   ◀ core screen
V-07  The correction        — sheet over V-06
V-08  The photograph        — optional, per item
V-09  The ambiguity         — plural or low-confidence utterance
V-10  The gap               — a required slot is still empty
V-11  The Reveal            — existing screen, now fed a whole closet
V-12  The ceiling           — free tier, more heard than free holds
V-13  Nothing heard         — empty, denied, offline, or failed
```

`V-11` is not built here. It exists. This directive ends by handing it a tally.

---

## 3 · The states

Colour tokens throughout are the ones already in `tailwind.config.js` and
`src/theme/tokens.ts`. **No new colour is introduced by this wave.** Type is Bodoni
Moda / Instrument Serif for display, Archivo for body and UI, per the standing
design directive.

### V-01 · The invitation

The screen that has to make someone willing to talk to their phone in a closet.

- **Display line**, serif, 40px, `ink`, trimmed: *"Walk your closet. Talk."*
- **Body**, Archivo 16px, `muted`, max 34ch: *"Say what you own as you go — the
  colour, the fabric, roughly what it is. 'Navy wool crewneck.' 'Black ankle boots.'
  Don't tidy it up; you can fix anything after."*
- **Three example chips**, `sand` ground, `ink` 13px, in a row that wraps. These are
  the only teaching device on the screen and they carry the whole instruction. Use
  real, slightly imperfect phrasing: `"white linen shirt"` ·
  `"those brown loafers"` · `"a heavy grey coat"`.
- **A line about privacy**, 12.5px `muted`, directly above the action — non-optional,
  see §8: *"The recording is transcribed and deleted. Cinch keeps the words, never
  the audio."*
- **One oxblood action:** `Start` — pill, radius 26, full-width in a pinned footer
  tray on `tray`.
- Secondary, text-only, `muted`, below: *"Photograph instead"* → routes to The Ten.

**Both doors stay open, permanently.** The Ten is the better experience for someone
with ten considered pieces; The Walkthrough is the better experience for someone
standing in front of a full wardrobe. Neither is the "real" one.

### V-02 · Listening

The screen someone stares at for four minutes. It must be calm, must prove it is
working, and must never imply a deadline.

- Ground goes to `canvas`. No card, no chrome. The screen empties out.
- **A live level meter**, centred, drawn as a single horizontal rule of ~48 short
  vertical strokes in `ink` at 35% opacity, each stroke's height driven by the
  current amplitude, scrolling right to left. Not a circle, not a pulsing orb —
  a *seismograph*. It is the most honest possible representation of "I am hearing
  you" and it matches the app's drawn, worn-in register.
- **Elapsed time**, serif, 28px, tabular figures, `muted`, below the meter.
- **No item counter in wave 1.** A live count would be spectacular and it requires
  streaming transcription; see §11.
- **Two actions, neither oxblood** (this screen has no forward action — it *is* the
  action): `Pause` (outlined) and `Done` (filled `ink`). Pause resumes into the same
  recording.
- Recording continues if the screen locks. It does not continue if the app is
  backgrounded — instead the recording is finalised and the user lands on V-04 with
  what was captured. Losing four minutes of speech to a phone call is unforgivable;
  finalising early is merely annoying.

**Hard cap: 12 minutes**, at which point the recording finalises itself with a quiet
line — *"That's plenty for now. You can add more after."* This is an abuse ceiling
as much as a UX one (§9).

### V-03 · The nudge

People dry up after tops. A single non-blocking prompt appears in `muted` 14px
below the elapsed time, after 25 seconds of silence, cycling through the slot model
in order: *Tops? · Bottoms? · Dresses? · Shoes? · A coat? · Bags?*

It fades in over 400ms and never interrupts. It disappears the moment amplitude
returns. It is a whisper, not a checklist.

### V-04 · Reading

The state Nelson asked to be beautiful, and the one that earns the user's trust for
everything that follows. It should take 8–25 seconds. **Do not fake a longer one.**

The animation is the argument. The transcript arrives and **garments precipitate out
of it**:

1. The transcript sets, left-aligned, Archivo 15px, `muted`, filling the screen from
   the top as the words return. Real text, the user's actual words.
2. As the parse resolves, each matched phrase **lifts off the line** — the span
   brightens from `muted` to `ink`, then translates up and to the right, shrinking
   into a small silhouette card that stacks into a loose pile in the upper third.
   The remaining text closes the gap.
3. The pile grows. The transcript below it thins out.
4. When the last phrase has lifted, the pile settles into a neat count.

Two rules that make this honest rather than decorative:

- **Every card in the pile corresponds to a real parsed garment.** No filler cards,
  no more cards than were found. If eleven were found, eleven fly.
- **Text that does not become a garment stays on screen, dimmed**, and remains
  scrollable at the bottom of V-05. If the app did not understand something the
  user said, that must be visible, not swallowed. This is the same discipline as
  the free-tier contract's *"If it cannot be computed for this user, it does not
  appear."*

Progress is **a count, never a bar** — the standing refusal applies here.

### V-05 · What I heard

The pile resolves into a single serif line and the count:

> **Twenty-three pieces.**
> *Let's check them. It's quick — tap through, fix anything wrong.*

- If any transcript remained unparsed, a `muted` disclosure below: *"Three things I
  didn't catch"* → expands to the dimmed spans, each with a small `Add manually`
  affordance.
- **One oxblood action:** `Check them` → V-06.

### V-06 · The card — the core screen

One garment, full-bleed, in the order it was spoken. Order is non-negotiable: the
user's own sequence is their mental map of their own closet, and re-sorting it by
category would make them re-find their place on every card.

Layout, top to bottom:

| Element | Spec |
|---|---|
| **Position** | `4 of 23`, Archivo 13px `muted`, top-left. A count. Never a bar, never a percentage. |
| **The silhouette** | Centred, ~46% of viewport height, on `surface`. SVG, filled with the garment's resolved colour, pattern as an overlay at low opacity, a 1px `rule` outline. |
| **The name** | Serif 30px `ink`, centred, trimmed. *"Navy wool crewneck"* |
| **Attribute chips** | A wrapping row, `sand` ground, `ink` 12.5px, radius 14: `Top` · `Navy` · `Wool` · `Smart casual` · `Warm`. Each chip is tappable and opens V-07 focused on that field. |
| **The receipt** | Archivo 13px `muted`, italic, centred, below the chips: *"you said: “my navy wool crewneck”"* — the user's verbatim words. |
| **Actions** | `Confirm` — oxblood pill, full-width, in the pinned tray. Above it, two text-only `muted` actions side by side: `Fix something` (→ V-07) and `Not mine` (removes, advances). |

**The receipt line is the most important element on this screen and it must not be
cut for space.** It is what makes a wrong parse feel like a mishearing rather than a
fabrication. A user who sees their own sentence quoted back forgives an error
instantly; a user shown a confidently wrong garment with no provenance loses trust
in the whole closet.

Interaction:
- Swipe left = Confirm. Swipe right = back one card. Tap the silhouette = V-08.
- Confirm advances with a 220ms horizontal slide, no bounce.
- **Undo is available for the last three actions**, as a `muted` text affordance that
  appears for 4s after any Confirm or Not-mine. *Nothing is ever lost* is a standing
  refusal, and "Not mine" on the wrong card is exactly the destructive-no-undo defect
  that earns one-star reviews in this category.
- The whole procession is resumable. See §6.

Exactly one oxblood action on this screen. `Confirm` is it.

### V-07 · The correction

A sheet over V-06, `surface`, grab handle, close ✕ top-right.

Fields, in this order: **Name** (text) · **Kind** (the slot model, as a row of
chips) · **Colour** · **Fabric** · **Pattern** · **How dressy** · **How warm**.

The colour picker is the only non-obvious one. **Do not ship a hue wheel.** Show a
grid of named swatches drawn from the hue families already defined in
`src/lib/color/`, grouped by family, each labelled — *Navy · Ink · Charcoal ·
Slate…*. The user described a colour in words; correcting it should also be in
words. A continuous picker invites a precision the input never had.

`Save` is oxblood; it returns to V-06 with the card redrawn.

### V-08 · The photograph

Reachable from any card, never required, never prompted more than once per session.

- Serif 26px: *"Add a photo?"*
- Body `muted`: *"You don't need one — Cinch already knows what this is. A photo
  just makes the colour exact."*
- `Take one` (oxblood) · `Choose one` (outlined) · `Not now` (text).

On success the garment gains an `image_path`, its colour is recomputed from pixels
by the existing pipeline, and `colour_source` flips from `spoken` to `measured`.
The silhouette is replaced by the photograph everywhere.

**Never gate anything on a photo.** Never badge un-photographed garments as
incomplete. A drawn closet is a finished closet.

### V-09 · The ambiguity

Fires when the parse is low-confidence or plural: *"some black t-shirts"*,
*"a few pairs of jeans"*, *"my work shoes, both pairs"*.

- Serif 26px: *"How many?"*
- The receipt line, prominent.
- A stepper, 1–12, default to the model's best guess.
- On confirm, N sibling cards are created, named *"Black t-shirt (1 of 3)"* etc., and
  inserted at this position in the procession. They are otherwise ordinary cards.

Low-confidence-but-singular items get the same card as V-06 with the chips shown in
`muted` rather than `ink`, and the copy *"I wasn't sure about this one."* — an
honest hedge rather than a separate screen.

### V-10 · The gap

After the last card, before The Reveal. Fires only when a **counted** slot is empty —
tops, bottoms, dresses, shoes — because an empty counted slot means
`countOutfits()` returns zero and The Reveal has nothing to say.

> **No shoes yet.**
> *Cinch can't finish an outfit without them. Name one or two and you're done.*

A single inline field with the mic affordance beside it — say it or type it. This
mirrors The Ten's ninth state exactly and should read as its sibling.

Never fire for outerwear or bags. They finish outfits; they do not create them.

### V-11 · The Reveal

Existing screen. Hand it the tally. `countOutfits()` runs on the full confirmed
closet and produces the number.

The copy needs one addition for this path, because the arithmetic is now doing
something bigger than it was in The Ten:

> **Twenty-three pieces. Two hundred and fourteen outfits.**
> *You talked for four minutes.*

That second line is the entire product promise and it should be set in the same
serif as the number, not relegated to `muted`.

### V-12 · The ceiling

Free tier holds ten. Someone who just spoke forty garments has done more work than
any competitor's user ever completes, and they are standing at the highest-intent
moment the product will ever have with them.

It fires **after V-11, never before, and never during the procession.** The user
sees their number first. Then:

> **You own forty pieces. That's three hundred and eighty outfits.**
> *Cinch is holding all forty. Free keeps ten of them awake.*

- The full closet is drawn behind, complete; the pieces beyond ten are shown at 45%
  opacity with a thin `rule` outline. Nothing is deleted, nothing is hidden, and the
  copy says so.
- **One oxblood action:** the membership sheet.
- Secondary `muted`: *"Keep ten for now"* → a picker to choose which ten stay awake.
  This must exist. An arbitrary first-ten is a worse experience than a choice, and
  refusing the choice would make the paywall feel like a hostage situation rather
  than an offer.

This is the paywall placement the growth plan calls for: **immediately after the
proof, never before it.** Do not move it earlier for conversion. The number is what
makes the ask reasonable.

### V-13 · Nothing heard

Four distinct causes, four distinct screens. Never one generic failure.

| Cause | Line | Action |
|---|---|---|
| Microphone denied | *"Cinch needs the microphone to hear you."* | `Open Settings` · `Photograph instead` |
| Silent / empty recording | *"I didn't catch anything."* | `Try again` · `Photograph instead` |
| Transcribed, nothing parsed | *"I heard you, but I couldn't find any clothes in it."* + the transcript, shown in full | `Try again` · `Add one by hand` |
| Offline / service failed | *"I can't reach the transcriber. Your recording is safe."* | `Retry` — and the audio is retained locally until it succeeds, then deleted |

The third row matters. Showing the transcript when the parse fails proves the app
heard them and locates the fault honestly. Swallowing it makes the app look broken
and unaccountable.

---

## 4 · Standing refusals for this wave

These override any conflicting instruction, including a later one.

1. **No sourced, scraped, fetched, or third-party images.** No image-search API, no
   retailer photography, no link to Google Images, no "screenshot it and upload."
   The only images that ever enter a closet are ones the user's own camera or photo
   library produced. §0 gives the three reasons.
2. **No image at all is a complete garment.** Nothing in the UI may badge, dim,
   sort-down, or nag a garment for lacking a photograph.
3. **The audio is not retained.** Transcribe, keep the transcript, delete the file.
   §8 makes this a compliance requirement, not a preference.
4. **Progress is a count.** No progress bars, no percentages, anywhere in this flow.
5. **The receipt line ships.** The verbatim utterance appears on V-06, V-09 and the
   V-13 parse-failure screen. It is not a nice-to-have.
6. **Exactly one oxblood action per screen.**
7. **Nothing is ever lost.** Undo on the last three procession actions; the ceiling
   stores rather than deletes; a failed upload keeps the recording.
8. **The model does not invent OKLCH.** It returns a colour *term*; the app maps
   terms to OKLCH through a curated lexicon in `src/lib/color/`. A hex code
   hallucinated by a language model has no perceptual guarantee and would poison the
   harmony scoring.
9. **No new colour tokens.** Everything here draws from the existing palette.
10. **The Ten is not removed, deprecated, or demoted.** Two front doors, permanently.

---

## 5 · Data model

Three migrations, append-only, in filename order.

### 5.1 `intake_sessions`

One row per walkthrough. Exists so a procession survives a cold start.

```sql
create table intake_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'recording'
                  check (status in ('recording','transcribing','parsing','reviewing','committed','abandoned','failed')),
  transcript    text,
  duration_ms   integer,
  cursor        integer not null default 0,   -- index into intake_drafts, for resume
  error_code    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 5.2 `intake_drafts`

**The single most important design decision in the build.** Parsed garments land
here, *not* in `items`.

`items_enforce_limit` is a `before insert` trigger on `items`
(`20260805160000_membership_tiers.sql:284`). A free user who speaks forty garments
would hit `closet_limit_reached` on row eleven and the procession would die
mid-flow with a raw check-violation. Staging the parse means the limit fires exactly
once, at commit, where V-12 can handle it as a designed screen instead of an error.

```sql
create table intake_drafts (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references intake_sessions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  ordinal        integer not null,          -- spoken order; the procession reads this
  utterance      text not null,             -- the receipt line. not null, ever.
  name           text not null,
  slot           text not null,             -- must match the engine's Slot union
  colour_term    text not null,             -- 'navy'. never a hex.
  colour_oklch   jsonb,                     -- resolved app-side from the lexicon
  fabric         text,
  pattern        text,
  formality      smallint,
  warmth         smallint,
  quantity       smallint not null default 1,
  confidence     real not null default 1.0,
  state          text not null default 'pending'
                   check (state in ('pending','confirmed','rejected','ambiguous')),
  image_path     text,                      -- only ever a user-supplied photo
  created_at     timestamptz not null default now(),
  unique (session_id, ordinal)
);
```

RLS on both tables: owner-only, all four verbs, `auth.uid() = user_id`. **RLS is the
whole authz model — there is no server-side authorization layer to fall back on.**
Add pgTAP coverage in `supabase/tests/` exercising `anon`, owner, an unrelated
authenticated user, and `service_role` against both tables. A policy that leaks
still typechecks, still bundles, and still ships.

### 5.3 `items` additions

```sql
alter table items add column colour_source text not null default 'measured'
  check (colour_source in ('measured','spoken'));
alter table items add column intake_method text not null default 'photo'
  check (intake_method in ('photo','voice','manual'));
```

`colour_source` is what lets V-08's photo upgrade path work, and what lets the
scoring code decide how much to trust a hue. `intake_method` is the analytics cut
that will answer whether this feature worked.

### 5.4 Commit

A single `commit_intake_session(session_id uuid)` function, `security invoker`, that
inserts confirmed drafts into `items` in `ordinal` order inside one transaction,
stops cleanly at the plan ceiling, returns the count committed and the count held,
and marks the session `committed`. It must not use `service_role` and must not
bypass `items_enforce_limit` — the ceiling is a product surface, not an obstacle.

---

## 6 · Client build

### Modules

```
src/features/intake/
  use-recorder.ts        expo-audio wrapper: permission, start/pause/stop,
                         amplitude polling at ~30Hz for V-02, 12-min hard stop,
                         backgrounding → finalise
  use-transcription.ts   upload → transcript, with retry and offline hold
  use-parse.ts           transcript → drafts, writes intake_drafts
  use-procession.ts      cursor, confirm/reject/edit, undo stack (depth 3), resume
  colour-lexicon.ts      colour term → OKLCH. curated, tested, app-side.
  silhouettes.tsx        SVG by slot + pattern overlay
  queries.ts             sessions and drafts
  actions.ts             commit, abandon

src/components/intake/
  LevelMeter.tsx         V-02 seismograph
  Precipitate.tsx        V-04 transcript → cards animation
  GarmentCard.tsx        V-06
  CorrectionSheet.tsx    V-07
  ColourGrid.tsx         V-07 colour, from the hue families
  CountStepper.tsx       V-09

src/app/(intake)/
  walkthrough.tsx        V-01 → V-02 → V-04 → V-05
  review.tsx             V-06 → V-10
```

### Notes that will otherwise cost a day each

- **`expo-av` is deprecated.** Use `expo-audio`. This is a new native module, which
  means a new development build — `npx expo run:ios`, not a JS-only update. The
  free-tier contract's "no new native modules" refusal was scoped to *that* wave and
  does not bind this one.
- **`NSMicrophoneUsageDescription`** must be added to `app.config.ts`. Write it in
  the app's voice, not boilerplate: *"So you can describe your closet out loud
  instead of photographing it."*
- **No `className` on `Animated.*`.** NativeWind's interop is registered for the RN
  primitives, so the class is silently dropped. V-04 and the V-06 transition are
  both heavily animated — use `style={}` throughout.
- **No margin-top on a trimmed serif `Text`.** `mt-*` cancels against the trim to
  roughly zero. Put `mb-*` on the preceding sibling.
- **V-04's animation must be interruptible.** If the parse returns in 6 seconds, the
  animation finishes early and gracefully; it does not hold the user for a scripted
  duration.
- **The undo stack lives in `use-procession`, not in a component.** Component state
  dies on a re-render from the query cache and the undo silently stops working.

---

## 7 · Edge Functions

### `transcribe-intake`

Audio → transcript. New function.

- Accepts an authenticated upload, max 12 minutes / 25 MB, enforced server-side as
  well as client-side.
- Model: a Whisper-class ASR through OpenRouter. Prompt-bias the decoder with a
  garment vocabulary — *crewneck, chinos, loafers, blazer, midi, mules, cardigan,
  trousers, oxford, poplin, corduroy, shearling* — which measurably improves
  recall on exactly the words that matter here.
- **Deletes the audio on success.** On failure the object is retained ≤24h for retry
  and then reaped by a scheduled job. Both behaviours are declared in §8.
- Claims quota against the `tagging` workload.

### `parse-closet`

Transcript → structured drafts. New function.

- Model: `openai/gpt-oss-120b`, structured output, strict schema. This is the same
  re-ranking-class workload the tiers doc already sizes — it is extraction against a
  fixed schema, not open reasoning.
- **The schema must mirror `tagSchema`'s vocabulary exactly.** A parallel taxonomy
  is how the closet quietly ends up with two kinds of "top."
- Required per garment: `utterance` (verbatim span from the transcript),
  `ordinal`, `name`, `slot`, `colour_term`, `quantity`, `confidence`. Optional:
  `fabric`, `pattern`, `formality`, `warmth`.
- **`colour_term` must be constrained to the lexicon's enum.** Free-string colours
  are how you end up with "greige" mapping to nothing.
- The function returns the spans it did *not* consume, so V-05 can show them.
- Claims `tagging` quota **per parsed garment**, so a 40-item walkthrough costs the
  same 40 units a 40-photo import would. Free 60/mo, Standard 400, Pro 1500 —
  unchanged, and a free user gets one full walkthrough plus room to fix it.

### Cost

A 6-minute walkthrough yielding 40 garments: **$0.036 transcription + $0.0005 parse
= ~$0.037**, versus $0.011 for 40 photo tags. Three times the AI cost per intake,
and it **eliminates ~32 MB of storage and all of its egress, permanently**. Net
positive within the first month and materially positive over any real lifetime. The
abuse ceiling is bounded by the 12-minute cap and the existing per-tier quota.

---

## 8 · Privacy and compliance — do not skip this

Audio of someone describing their closet **is** their closet. The README's central
architectural claim — *"The model never sees your closet"* — needs an honest
amendment for this path, and the App Store answers need updating before submission,
not after.

**Required before this ships:**

1. **App Privacy — add `Audio Data`.** Collected: Yes. Linked to user: Yes. Used for
   tracking: No. Purpose: App Functionality. It must be added to *both* the App
   Store Connect questionnaire and `PrivacyInfo.xcprivacy` via `app.config.ts` —
   Apple cross-checks them and a mismatch is a review hold.
2. **State the retention in the app, at V-01**, before the mic opens — not buried in
   the privacy policy. *"The recording is transcribed and deleted. Cinch keeps the
   words, never the audio."* If that sentence is true, say it. If retention changes,
   change the sentence first.
3. **Update `web/privacy.html`** with a voice-intake paragraph covering: what is
   recorded, that it is sent to a third-party model provider for transcription, the
   deletion window, and that the transcript is retained as part of the closet.
4. **`delete-account` must reap `intake_sessions`, `intake_drafts`, and any orphaned
   audio objects.** Cascades cover the tables; the storage objects need explicit
   handling. An account deletion that leaves audio behind is the worst class of bug
   this app could have.
5. **Amend the README's model-boundary claim** so it stays true. Suggested: *"The
   model never sees your closet — with one stated exception: if you describe it out
   loud, the recording is transcribed by a model and then deleted."*

---

## 9 · Analytics

Add to the closed union in `src/lib/posthog.tsx` — a free string is explicitly
disallowed, so these must be declared:

`intake_started` · `intake_recording_finished` (duration bucket) ·
`intake_parsed` (garment count bucket, unparsed-span count) ·
`intake_card_confirmed` · `intake_card_edited` (which field) ·
`intake_card_rejected` · `intake_photo_added` · `intake_committed`
(committed count, held count) · `intake_abandoned` (state at abandon) ·
`intake_failed` (cause).

No transcript text, no garment names, no utterances in any property. Buckets only.

**The three numbers that decide whether this shipped successfully:**

1. **Time from `intake_started` to `intake_committed`.** Target: under 8 minutes for
   a 30+ piece closet. Compare against the photo path's equivalent — this is the
   entire thesis in one metric.
2. **Completion rate of the procession.** Target: >80% of users who reach V-06
   reach V-11. If people abandon mid-procession, the cards are too slow and the
   confirm step needs collapsing.
3. **`intake_card_edited` rate per garment.** Above ~25% and the parse is not good
   enough to be trusted; the receipt line is carrying the whole experience and users
   will stop believing the closet.

Watch `colour_source = 'spoken'` as a share of the closet, and whether outfit
thumbs-down rates differ between spoken-colour and measured-colour garments. If they
do, the lexicon needs work — that is the one place this design could quietly
degrade styling quality, and it is measurable.

---

## 10 · Test table

Reproduce these exactly, in `tests/` for pure logic and `supabase/tests/` for RLS.

| Input utterance | Expected |
|---|---|
| *"navy wool crewneck"* | 1 × top, navy, wool, warm, qty 1 |
| *"my black ankle boots"* | 1 × shoes, black, qty 1 |
| *"three white t-shirts"* | ambiguous → 3 siblings on confirm |
| *"a few pairs of jeans"* | ambiguous, best guess ≥2, stepper shown |
| *"heavy grey coat"* | 1 × outerwear — **not counted by `countOutfits`** |
| *"that leather tote"* | 1 × bag — **not counted** |
| *"a cream mohair jumper"* | 1 × **top** (mid_layer maps to tops for counting) |
| *"actually no, more of a cream"* following a colour | correction applied to the prior garment, not a new one |
| *"um, I think, like, some stuff"* | unparsed span, surfaced at V-05, no garment |
| *"my green dress and my black heels"* | 2 garments, ordinals preserved |
| 3T 2B 1D 2S confirmed | `countOutfits` → **14** |
| 11 confirmed, free plan | 10 committed, 1 held, V-12 fires, **nothing deleted** |
| Session interrupted at ordinal 7 | resumes at ordinal 7 on cold start |
| `Not mine` then undo | garment restored at its original ordinal |

---

## 11 · Explicitly not in wave 1

Named so they don't get built by accident and don't get lost:

- **Live item counting during V-02.** Requires streaming transcription. It is the
  single most demo-able feature in this whole design — watching the count tick up as
  you talk — and it is a wave-2 upgrade to `use-transcription`, not a redesign.
- **On-device transcription** (`SFSpeechRecognizer`). Free, private, offline, and
  would let the README's model-boundary claim stand unamended. Accuracy on garment
  vocabulary needs an eval against the server path before it can be trusted. Worth
  doing; not first.
- **Photo-library scanning.** This is what Whering is spending its seed round on.
  Do not chase it.
- **Re-voicing an existing closet** ("add five more things"). The session model
  supports it; the UI doesn't need to yet.
- **Any pattern richer than a flat overlay** on the silhouettes.

---

## 12 · Why this matters beyond the feature

The growth plan's wedge is *"Ten pieces. Fourteen outfits. Tonight."* — built on the
fact that every competitor loses its users to the ~50-item cataloguing cliff.

This feature does not sharpen that wedge. It **replaces it with a better one**:

> **Talk for four minutes. Your whole closet.**

The competitive position gets strictly stronger. Whering is spending $7M making
photographing *faster*. Combyne avoided the problem by never using your real
clothes. Stylebook restructured a fifteen-year-old product around it. Cinch would be
the only app that deletes the step.

And it is a better piece of content than anything currently in the plan. A screen
recording of someone talking for ninety seconds and a closet assembling itself is a
TikTok that does not need a face, does not need a script, and demonstrates the whole
product in one shot. That was the hardest constraint in the marketing plan, and this
feature solves it as a side effect.

Two things to hold onto while building it. The **receipt line** is what makes an
imperfect parse feel like a conversation instead of a hallucination — protect it
first when the layout gets tight. And the **refusal in §0** is what keeps the app's
central claim true: nothing imagined, nothing a catalogue photo, nothing you'd have
to go and buy. That sentence is the whole brand. This feature can make it more true
than it is today, or it can make it a lie. The difference is entirely in whether the
images are sourced or drawn.
