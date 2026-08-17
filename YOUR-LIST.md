# What's done, and the six things only you can do
**10 August 2026**

---

## ⚠️ Read this first — voice intake cannot ship in 1.0

You decided voice ships in 1.0 and I planned around it. Checking the code, **that isn't
possible, and it isn't close.**

`src/features/intake/` is real and correct — 631 lines of actions, procession,
colour-lexicon, buckets and queries, plus the `parse-closet` and `transcribe-intake`
Edge Functions and all four `intake_*` migrations. But it has **zero importers anywhere
in `src/`**. `commitIntake` has no callers. `src/app/(intake)/` does not exist. Per the
repo's own `reframe-atlas-status.md`: no `WK-`, `PR-` or `OC-` state exists as a
rendering, all six Walkthrough states and all seven Procession states are missing, and
**26 silhouette assets are the long pole.**

It's a data spine with no front door.

**So 1.0 is the photo-intake product**, and the wedge is "ten pieces, fourteen outfits" —
which is exactly what your shipped App Store copy already says. Nothing needs to change.
But hook 06 ("Four minutes of talking") stays on the shelf, and I wrote the Apple
nomination on the ten-pieces wedge rather than voice.

---

## Done

**Apple featuring nomination — submitted, not drafted.** This was the deadline item.
"Cinch 1.0 - Ten pieces is a wardrobe", type App Launch, publish window **Sep 1–8**,
iPhone, all territories. The Helpful Details block leads on accessibility and makes a
real argument rather than a box-tick: starting at ten pieces instead of two hundred is
what makes the product reachable for someone with limited mobility, chronic fatigue or
low vision, because photographing a wardrobe demands sustained fine motor control and
good lighting. Then what you deliberately didn't build, the back-to-school peg, the
craft, and that it's one self-funded person.

**`posthog/instrumentation-gaps` merged into main.** Rebased, typecheck clean. Three
places the branch was stale got merged on intent rather than name — `outfit_set_viewed`
already existed in main at a better call site, so the duplicate `outfits_shown` was
dropped and only its genuinely new `source: engine|ai` split was folded in. Shipping
both would have created two competing impression denominators. Same for `auth_started`,
which main already fires at the method-chosen beat; keeping the branch's second call
would have roughly thirded your apparent conversion rate.

**Trial stays 14 days.** ~~New migration, signup trigger redefined.~~ Reversed on
17 August 2026. The 21-day migration (`20260810150000_trial_is_twenty_one_days`)
was written but never reached production, and the decision was taken to keep 14.
The file has been removed from `supabase/migrations`; production was not touched,
because it was already issuing 14-day trials. See
`docs/ops/supabase-migration-reconciliation-20260817.md`.

**One real Guideline 1.2 gap found and closed.** `blocked_between` was missing from the
`event_members` select policy — a blocked user showed up as a *nameless person* in the
roster of a shared event, because `social_profiles` already screens the pair. Told
they're in the room and refused their identity. Fixed. The other three items I'd flagged
were already done: outfit posts have a report affordance, `SocialTermsSheet` is wired at
nine call sites covering all seven `assert_social_terms` triggers.

**`web/privacy.html` corrected.** The voice paragraph was fine, but two other sections
contradicted it — the processor table didn't list OpenRouter as receiving audio (it does,
via Whisper), and "How long it is kept" said *"There is no automatic expiry"*, which is
false for the single most sensitive object the app holds.

**`scripts/capture.sh`.** Wraps `simctl` with the status-bar override so every clip comes
out at 9:41 with full bars and can be intercut. `./scripts/capture.sh cap-reveal`.

**Press page rebuilt.** My first version would have shipped broken — it used inline
styles and Google Fonts, and your CSP is `style-src 'self'; font-src 'self'`, so it would
have rendered as unstyled text on a live page an Apple reviewer might open. Now uses
`/styles.css` + a new `/press.css` and your local woff2.

**Four corrected creative assets** rebuilt in brand →
`marketing/04-social/corrected-creative.zip`.

**Also verified, so you don't have to:** the app is already **Waiting for Review** with a
build. Title is `Cinch: Outfit Planner & Closet`. Promo text, description and review
notes are all filled and good. **Keywords are 99/100 with no title-word repeats** —
whoever wrote them knew the rule that repetition doesn't stack. `RevealComplete` *is*
already fired at `reveal.tsx:147`; my "defined but never wired" claim was wrong.

---

## The six things I can't do

### 1 · Push to git — unblocks four other things
Everything above is committed locally on `main` and **nothing is pushed**. Production
ships from GitHub `main`, so one push deploys the press page, the privacy corrections,
and the capture script all at once.

```bash
cd ~/cinch && git push origin main
```

⚠️ Deploy from the **repo root**, never from inside `web/` — the Vercel project has Root
Directory set to `web`, so `vercel deploy` from `web/` looks for `web/web/` and fails.

### 2 · EU Digital Services Act trader status
I stopped deliberately. It's a legal declaration about whether you're acting commercially,
and it publishes your name, address and phone number publicly in the EU. That's yours to
make and yours to enter. Business → and it's the banner on the Apps page.

### 3 · The twelve master captures
Still the only thing nobody else can do, and still the thing blocking all video content.
`scripts/capture.sh` is written; you need a seeded closet on the simulator. The garment
photography already exists at `docs/design/closet-atlas/assets/garments/` — seven pieces,
enough to start. Shot list is in `marketing/capture-kit.md`.

### 4 · Publish Superwall paywall 254200
It's `published_at: null`. Until it's published, `RevealComplete` resolves to a sheet that
never commits a frame and the fail-safe tears it down — meaning **the app currently cannot
take money.** Runbook is at `docs/design/paywall-publish-runbook.md`. This is the single
highest-value thing on this list.

### 5 · Reserve the social handles
Account creation needs phone verification and isn't something I'm able to do on your
behalf. `@cinchstyle` on TikTok, Instagram, Pinterest, YouTube, X.

### 6 · Add `/press` to the nomination once deployed
The nomination is submitted with `cinchstyle.com` and `/privacy`. Once you've pushed, edit
it and add `https://cinchstyle.com/press` as the third supplemental link. Two minutes.

---

## Two judgment calls I made rather than guessing

**I left the keyword field alone.** It's 99/100 and good. My version would swap
`clothing,ai,weather` for `to,wedding,guest` — completing "what to wear" and claiming the
wedding-guest lane no top-10 app holds. Real but marginal, and the app is *in the review
queue*. Not worth risking a review slot. Do it in 1.1.

**I didn't touch App Privacy.** The Audio Data question is genuinely ambiguous now: the
privacy manifest in `app.config.ts` declares `NSPrivacyCollectedDataTypeAudioData`, but
with no Walkthrough UI the app can't actually record anything. Declaring it in one place
and not the other is the exact mismatch that causes a review hold — so it needs to be
**both or neither**, and which one depends on whether you want the manifest entry to stay
for the next build. Your call, and it's a two-minute change either way.

---

## An unrelated thing worth knowing

Another agent was writing to the repo while mine was working. It committed three commits
onto `main` mid-session (`4285c29 expo-audio…`, `2f9722d`, `5add8cb`) and left
uncommitted work in `thresholds.ts`, `queries.ts`, `articles.ts` and
`piece-counts.test.ts`. Nothing was clobbered — mine worked in a throwaway clone and
rebased onto their result — but two agents on one working tree is how a day gets lost.
Worth running them one at a time.
