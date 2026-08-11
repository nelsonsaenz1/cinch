# Launch engineering directive
**10 August 2026 · for Claude Code · voice ships in 1.0**

Ordered by what blocks what. Do P0 in order. Nothing in P1 matters if P0 isn't done,
and nothing in P2 matters if the app isn't submittable.

---

## P0-1 · Merge `posthog/instrumentation-gaps` into main

**Why this is first.** Seven commits sit on a local branch that has never been merged:

```
a9a0e96  Segment analytics by plan, closet size and signup cohort
96c00e2  Record that outfits were seen, so a like rate exists
0673373  Instrument the sign-up funnel
8a74d47  Stop paying for a person update on every cold start
9cced05  Exclude unpacked handoff packages from the typecheck
dfb4156  Correct the Superwall handoff against the working session
356eb3c  Record the Superwall publish failure and the duplicate test
```

Until these land there is **no auth funnel, no `outfits_shown`, and no plan / closet-size
/ signup-cohort segmentation.** Which means install→trial→paid cannot be measured, the
marketing kill criteria cannot be evaluated, and no channel decision after launch has
any evidence behind it. This is the cheapest item on the list and the most expensive one
to skip.

- Branch is off `main` at `247c5f0`; main has moved considerably since. Rebase, don't
  merge-commit.
- Expect conflicts in `src/lib/posthog.tsx` (the events union) and `_layout.tsx`.
- Two traps recorded from when this was written:
  - `useAnalyticsIdentity()` runs in `RootLayout`'s body, **outside**
    `PersistQueryClientProvider`. Any `useQuery` called there throws at runtime, not
    compile time. The pattern is a null-rendering component inside the tree — see
    `SuperwallIdentity` in `features/billing/superwall.tsx`.
  - The AI re-rank in `use-outfits.ts` often returns the same candidates in the same
    order, so any dedup key over outfit sets must include `source`, not just garment ids.

**Acceptance:** `auth_started` / `auth_completed` / `auth_failed`, `outfits_shown`, and
person properties `plan` / `trialing` / `garment_count` / `signup_week` all arrive in
PostHog project 544348 from a real device session.

---

## P0-2 · Audio Data privacy — now launch-blocking

Voice ships in 1.0, so this is no longer an October problem. Audio of someone describing
their closet **is** their closet, and Apple cross-checks the declarations against the
compiled binary. A mismatch is a review hold.

1. **App Store Connect → App Privacy: add `Audio Data`.** Collected: Yes · Linked to
   user: Yes · Used for tracking: No · Purpose: App Functionality.
2. **`app.config.ts` → `PrivacyInfo.xcprivacy`** must declare the same. Fill both from
   the same list, in one sitting.
3. **`NSMicrophoneUsageDescription`** in `app.config.ts`, written in the app's voice:
   *"So you can describe your closet out loud instead of photographing it."*
4. **State retention on screen at WK-01, before the mic opens** — not buried in the
   policy: *"The recording is transcribed and deleted. Cinch keeps the words, never the
   audio."* If that sentence is true, ship it. If retention changes, change the sentence
   first.
5. **`web/privacy.html`** — add a voice-intake paragraph: what is recorded, that it goes
   to a third-party model provider for transcription, the deletion window, and that the
   transcript is retained as part of the closet.
6. **`delete-account` must reap** `intake_sessions`, `intake_drafts`, and any orphaned
   objects in the intake audio bucket. Cascades cover the tables; storage objects need
   explicit handling. An account deletion that leaves audio behind is the worst bug this
   app could ship.
7. **Amend the README's model-boundary claim.** *"The model never sees your closet"*
   stops being true. Suggested: *"…with one stated exception: if you describe it out
   loud, the recording is transcribed by a model and then deleted."*

**Acceptance:** ASC and `PrivacyInfo.xcprivacy` list identical data types; a deleted
account leaves no rows and no storage objects; the retention sentence is on WK-01.

---

## P0-3 · Close the remaining Guideline 1.2 gaps

The text filter and terms gate shipped as `BEFORE` triggers
(`20260808100000_ugc_text_filter.sql`, `20260808101000_social_terms_gate.sql`). Four
things from that work are still open, and all four are things a reviewer looks for once
the listing advertises social.

- [ ] **Report affordance on outfit posts.** Reporting is wired to comments and profiles
      but **not to outfit posts — the headline UGC.** This is the most likely single
      cause of a 1.2 rejection.
- [ ] **`blocked_between` is missing from the event-content select policies**, so a
      blocked user's content stays visible inside a shared event. Add it to every
      event-content select policy.
- [ ] **Age gate** — still absent. ASC currently answers Age Assurance = No, which is
      consistent but leaves 1.2's "ensure minors aren't exposed" unaddressed.
- [ ] **Wire `SocialTermsSheet`** into the social entry points. The gate exists in the
      database; without the sheet the user hits a raw error instead of an acceptance
      flow.
- [ ] **Load a real denylist as service_role.** Seven profanities is not a moderation
      system. The LDNOOBW insert is in the migration's closing comment. **No slurs in
      the repo** — load it out of band.
- [ ] **Push migrations, then `npm run gen:types`.** Typecheck fails until this happens.

⚠️ Do not "fix" the trigger design by moving filtering into an Edge Function without
also revoking the table grants — every social write is a direct client→PostgREST insert,
so a function-based filter would be advisory only.

---

## P0-4 · Submittable state

- [ ] Upload a production build (`eas build --profile production`, then `eas submit`).
      The App Store URL still 404s — there is no build.
- [ ] **EU Digital Services Act trader status** — App Information page → "Set Up". Still
      unset.
- [ ] Replace the subscription review screenshot with a real device capture. The current
      one is rendered from `web/superwall/cinch-membership.html`, which is the deprecated
      external-paywall path; the live paywall is native Superwall editor nodes.

---

## P1-1 · Fire the paywall after The Reveal

**`Placement.RevealComplete: 'reveal_complete'` already exists in
`src/features/billing/placements.ts:148` and nothing fires it.** The placement was
defined and never wired.

Wire it so it fires **immediately after The Reveal resolves** — the second the user
learns that ten photographs, or four minutes of talking, bought them fourteen outfits.
That is the highest-intent moment in the entire product.

Rules:
- **After the number lands, never before.** The Reveal is the proof; the paywall is the
  ask. Reversing them destroys the ask.
- It must fire on **both** intake paths — The Ten and The Walkthrough.
- The over-ceiling case (a voice intake of 40 garments on a free plan) shows the full
  closet drawn behind, pieces beyond ten at 45% opacity, nothing deleted, plus a
  **"keep ten for now"** picker. An arbitrary first-ten reads as a hostage situation.

**Why this is worth more than the entire marketing budget:** freemium install→paid runs
~2.1%; a well-placed onboarding paywall runs 6–10.7%. At identical traffic that is
roughly 2.4× the MRR. It is a week of work and it costs nothing to run.

---

## P1-2 · Trial 14 → 21 days

Two places in `supabase/migrations/20260805160000_membership_tiers.sql`:

- **line 57** — `now() + interval '14 days'` (the backfill)
- **line 78** — `now() + interval '14 days'` inside the signup trigger ← **this is the
  one that matters going forward**

Migrations are append-only — **write a new migration**, don't edit that file.

Trial→paid runs **25.5% at ≤4 days, 37.4% at 5–9, and 42.5% at 17–32 days.** Twenty-one
days sits in the top band. The comment at line 31 explaining the 14-day choice should be
updated in the new migration's header so the reasoning doesn't rot.

---

## P2 · Metadata, now that voice ships in 1.0

### Strings

```
TITLE     (30/30)  Cinch: Outfit Planner & Closet
SUBTITLE  (30/30)  Capsule Wardrobe, Packing List
KEYWORDS  (99/100) digital,stylist,organizer,clothes,what,to,wear,ootd,style,calendar,inventory,wedding,guest,occasion
```

Unchanged. **Voice does not go in the keyword field** — nobody searches "voice closet."
It is a conversion asset, not a search asset, and it earns its place in the screenshots
and description instead.

### Description

Add the section the reframe directive held back. It now leads:

```
TALK YOUR CLOSET IN
Walk your wardrobe and say what you own — "navy wool crewneck," "black ankle
boots." Cinch listens, works out what each piece is, and hands them back one at a
time so you can check them. No photographing a hundred garments before the app
does anything for you.
```

Then the existing sections in the reframe order. **`BUILT ONLY FROM WHAT YOU OWN` stays
exactly as written and is never weakened** — a voice-created garment is drawn, never a
catalogue photo, and that sentence is what makes the claim true.

Add the voice retention line to `PRIVATE BY DEFAULT`.

### Promotional text (editable without a build)

```
Talk for four minutes and Cinch builds your closet. Then it dresses you every
morning — and when the wedding comes, you and your friends decide together.
```

### Screenshots — reorder for voice-first

The delivered 1c set leads with the `14`. With voice in 1.0 the promise should lead and
the number should pay it off:

1. **Talk for four minutes** — the Walkthrough, meter live *(new capture needed)*
2. **Twenty-three pieces. Two hundred and fourteen outfits.** — the whole-closet reveal
3. **The wedding's in three weeks** — the occasion
4. **Which one?** — the vote
5. **See what you actually wear** — the closet and cost-per-wear

"Dressed for the actual weather" drops out of the top five. It is the least
differentiated frame in the set — every app in this category claims weather.

### Apple featuring nomination

Voice materially strengthens this. A genuinely novel input method is exactly what
Apple's editorial team rewards, and it pairs with a back-to-school / autumn-wardrobe
seasonal peg. Type: **App Launch**. Three-week minimum lead — file it this week.

---

## Acceptance criteria for 1.0

- [ ] PostHog receives the full funnel from a real device: `auth_started` →
      `closet_ready` → `outfit_set_viewed` → `paywall_presented`
- [ ] Audio Data declared in ASC **and** `PrivacyInfo.xcprivacy`, identically
- [ ] A deleted account leaves no `intake_*` rows and no audio objects
- [ ] Outfit posts can be reported
- [ ] `blocked_between` present in every event-content select policy
- [ ] `reveal_complete` fires on both intake paths, after the number
- [ ] A free user completing a 40-garment walkthrough reaches the ceiling screen with
      **nothing deleted** and a working "keep ten" picker
- [ ] New signups get 21 days
- [ ] Clean-device run end to end: install → auth → verification email returns to the
      app → intake → Reveal → paywall → value action → next-day return
- [ ] Build uploaded, DSA trader status set, real subscription review screenshot

---

## One thing not to do

Do not weaken **"nothing is imagined, nothing is a catalogue photo"** to accommodate
voice. A voice-created garment is a drawing of what the user said — that is what keeps
the sentence true, and that sentence is the whole brand.
