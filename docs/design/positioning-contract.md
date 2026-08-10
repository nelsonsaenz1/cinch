# Positioning contract — the ten-piece wedge

**Frozen 2026-08-10.** Source: the CMO's growth strategy letter of the same date.
This document arbitrates. Where a unit's judgement and this document disagree,
this document wins. Where this document and the shipping code disagree, the code
wins and the unit stops and reports.

---

## 1. Why this wave exists

The letter's central claim is that every wardrobe app in the category dies at the
same place — the user quits between item 12 and item 50, before the app has done
anything for them — and that Cinch is the only app whose product is built around
**ten pieces** rather than a whole closet.

That claim is true of the code. `countOutfits()` at
`src/features/closet/outfit-count.ts:110` computes `T×B×S + D×S`; the free closet
is ten active pieces (`supabase/migrations/20260808190000_free_closet_is_ten.sql:29`);
the onboarding is called The Ten and ends on a screen called The Reveal.

**It is not true of the shipping app, because The Ten has no entrance.**
`src/app/tour.tsx:72` exits to `/capture` or `/(tabs)`. The only production route
to `/the-ten` is the Reveal's own repair loop at `src/app/reveal.tsx:114` — a
closed loop with no way in. Everything in this wave follows from fixing that.

---

## 2. The positioning

### The promise

> Photograph ten things you already own. Cinch does the arithmetic, and dresses
> you every morning from there.

### Support lines, in order of use

| Use | Line |
|---|---|
| Activation | You don't have to photograph your whole closet. **Ten pieces is a wardrobe.** |
| Proof | Real colour maths, not a language model guessing. Every outfit comes with the reason. |
| Daily habit | It knows the weather where you actually are, and what's on your calendar. |
| Social | Still torn? Send two looks to friends and settle it. |
| Payoff | Wear more of what you already own. |

### Where social belongs

Social is real, shipped, and a genuine differentiator. It belongs in
**screenshots, description body, and the retention loop**. It does **not** belong
in the App Store title, subtitle, or keyword field — those are search surfaces,
and nobody searches "chosen with friends".

This is a change of emphasis, not a retreat. No social feature is being hidden or
removed, and the Guideline 1.2 obligations already attached
(`docs/app-store-listing.md:141-153`) are unaffected either way.

---

## 3. THE MARKETING-CONSTANT RULE

The letter contains a contradiction and this section resolves it.

§1 of the letter proposes the line **"Ten pieces. Fourteen outfits. Tonight."**
§4 of the same letter forbids exactly that: *"the number must never appear as a
marketing constant... The moment it becomes 'Cinch: 14 outfits!' as a slogan,
it's a claim rather than a fact, and it stops being the thing that makes you
different."* `docs/design/free-tier-contract.md` says the same, independently.

**Resolution, binding on every unit:**

- **"Ten pieces" MAY be a constant.** It is the free-tier cap — a fact about the
  product, identical for every user, provable at
  `supabase/migrations/20260808190000_free_closet_is_ten.sql:29`.
- **The outfit count MAY NEVER be a constant.** Not in the App Store listing, not
  on the marketing site, not in a screenshot headline, not on a share card, not
  in a push notification. It is a per-user computed result and it appears only
  where it is being computed from that user's own closet, on screen.
- **The approved constant-safe line is "Ten pieces is a wardrobe."**

A unit that wants to print an outfit number in a static surface must stop and
report instead.

**Existing violations are in scope for this wave.** The outfit count is currently
clean in production — every instance derives from `countOutfits()`. The *piece*
counts are not; eleven literal-number strings are catalogued in §7 and must be
read from `PLANS` instead.

---

## 4. THE CLAIM TRACE

Carried forward from `docs/design/privacy-invite-help-contract.md`, which
established it: **no sentence asserting a fact about the app ships without a
`file:line` proving it.** This wave is positioning copy, which is nothing but
assertions, so the rule binds harder here than it did there.

Each unit writing user-facing or store-facing copy must return a table of
`claim | file:line | verdict`. Claims that cannot be proved are cut, not softened.

**Four claims from the letter are UNVERIFIED and must be proved before use:**

| Claim | Where it came from | Status |
|---|---|---|
| "OKLCH perceptual colour maths, not an LLM guessing" | letter §1 competitor table | **Prove or cut.** Find the colour-scoring code. If the shortlist is built on device and only the *prose* is a model call, say that precisely. |
| "Every suggestion decomposes into a stated reason" | letter §1 | **Prove or cut.** Find where the reason is generated and whether it is always present. |
| "No ads, ever" | letter §1 | Almost certainly true (no ad SDK in `package.json`) — confirm and cite. |
| "Nothing is ever lost" | letter §1, quoting a design contract | Confirm the standing refusal exists and that deletion is genuinely recoverable, or cut the absolute. |

**Two claims are already settled and must NOT be relitigated:**

- **Borrow-into-outfit-builder is BANNED from all copy.** It is not implemented;
  `src/features/styling/queries.ts` filters items by `user_id` and no approved
  borrow joins into the borrower's composer. Rationale and the Guideline 2.3.1
  rejection risk: `docs/app-store-listing.md:58-64`. Do not reintroduce it.
- **No competitor is named or compared against in any shipping surface.** The
  letter's competitor table is internal strategy. The App Store forbids naming
  competitors in metadata, their listings change weekly, and the letter's own
  operating rules require a dated screenshot for any comparison. Comparison
  content is a TikTok format for the founder, not app or listing copy.

---

## 5. Decisions taken (founder, 2026-08-10)

| # | Decision | Consequence |
|---|---|---|
| D1 | **The Ten becomes the default first run.** | `tour.tsx`'s camera exit routes to `/the-ten`, not `/capture`. Every new user gets the guided ten and lands on the Reveal. |
| D2 | **A dismissible paywall presents immediately after the Reveal.** | New placement. Annual-first. Dismissing lands on Today with the free tier intact — the ten-pieces-free promise is the wedge and must survive the paywall. |
| D3 | **The trial stays at 14 days.** | No migration. `context-lines.ts:57` ("Your two weeks are up") remains correct — do not touch it. |

D2's phrasing is load-bearing: **dismissible means dismissible.** No dark pattern,
no hidden close, no delay before the close affordance appears. If the free tier
is not reachable by dismissing, the positioning is a lie and the wave has failed.

---

## 6. The share primitive

The referral loop cannot be fixed with copy, because the current primitive cannot
carry copy.

- `src/features/share/capture-plate.ts:30` uses
  `Sharing.shareAsync(uri, { UTI: 'public.png' })` — **image only.** `expo-sharing`
  has no message parameter and no link parameter. The card itself deliberately
  carries no URL, no QR and no handle (`src/components/share/plate-card.tsx:461`).
  A recipient therefore receives a PNG with no route back into the app.
- The Look Board's two `Share.share` calls (`src/app/event/[id]/outfits.tsx:393`,
  `:567`) send **text with no URL**. Same outcome.

**The change:** move to React Native's `Share.share({ message, url })`, which
carries both. The link is the sharer's existing invite URL from
`src/features/invite/link.ts:37` — no new infrastructure, and it already resolves
to a server-rendered page naming the referrer (`web/api/invite.js:224`).

**THE PLATE CARD ARTIFACT IS NOT MODIFIED BY THIS WAVE.** Its omissions — no
cost-per-wear, no city, no URL — are deliberate and documented in-file. The link
travels in the *message*, which is not the artifact. A unit that wants to change
the card stops and reports.

A cost-per-wear share card is a **new artifact requiring a design** and is out of
scope until one exists.

---

## 7. Hard-coded piece counts to fix

Every one of these should read from `PLANS` (`src/features/billing/plans.ts`) or
from the slot list, per the rule already documented at
`src/features/onboarding/tour-copy.ts:29`.

| file:line | Current |
|---|---|
| `src/app/the-ten.tsx:131` | `${filled} of 10` |
| `src/app/the-ten.tsx:136` | "Ten pieces is enough for Cinch to style you properly." |
| `src/app/the-ten.tsx:139` | `${10 - filled} to go` |
| `src/components/onboarding/ten-stop-sheet.tsx:44` | "Ten of ten" |
| `src/components/onboarding/ten-stop-sheet.tsx:49` | "That's the ten. There's room for an eleventh…" |
| `src/features/billing/context-lines.ts:54` | "Ten pieces is where the free closet stops… You have ten" |
| `src/features/billing/context-lines.ts:56` | "That's this week's three outfits." |
| `src/components/closet/example-closet.tsx:187` | "Photograph six pieces…" |
| `src/app/(tabs)/plan.tsx:560` | "Add about ten pieces…" |
| `src/components/stylist/stylist-states.tsx:233` | "Add about ten pieces first" |
| `src/features/help/articles.ts:116,117,309` | tier numbers spelled out in prose |

Note `context-lines.ts:76-82` already interpolates from `PLANS` — the module is
internally inconsistent, which is the clearest evidence this is a bug class and
not a style preference.

---

## 8. Unit territories — NON-OVERLAPPING, ENFORCED

A unit edits only inside its territory. Anything else is reported to the
integrator, never edited.

| Unit | Owns | Must not touch |
|---|---|---|
| **A — the wedge** | `src/app/tour.tsx`, `src/app/the-ten.tsx`, `src/app/reveal.tsx`, `src/features/onboarding/**`, `src/components/onboarding/**`, `src/components/reveal/**` | `src/features/billing/**` |
| **B — money** | `src/features/billing/**`, Superwall dashboard | any file under `src/app/` |
| **E — the loop** | `src/features/share/**`, `src/features/invite/**`, `src/app/invite.tsx`, `src/components/invite/**`, `src/app/event/[id]/outfits.tsx` | `src/components/share/plate-card.tsx` (frozen artifact) |
| **F — store** | `docs/app-store-listing.md`, new files under `docs/aso/` | all of `src/`, all of `web/` |
| **G — web** | `web/**` | all of `src/`, all of `docs/` |

**Integrator (main session) owns:** the Reveal→paywall handoff wiring, the §7
number sweep outside unit territories, `src/lib/posthog.tsx` and all analytics
insertion, and every cross-unit edit.

---

## 9. Analytics — the funnel is bottom-heavy

`src/lib/posthog.tsx:185-244` is a closed union of 15 events. It is well built —
bounded properties, build-identity super properties, correct expo-router screen
handling — and every event fires on a **completion**. Almost nothing fires on an
**offer** or a **start**, so conversion numerators exist without denominators.

Of the four funnel checkpoints the letter names, **one exists**:

| Event | Status |
|---|---|
| `paywall_presented` | Exists, `use-gate.ts:409`, fires from `onPresent` not `registerPlacement` — correct |
| `auth_started` | Missing. Five auth screens, zero events. |
| `closet_ready` | Missing. Crossing ten emits nothing. |
| `outfit_set_viewed` | Missing. No denominator for outfit engagement. |

The referral funnel is dark at every intermediate step: invite shared, copied,
opened, installed, converted, vote cast — none tracked. Only the terminal
database state (`profiles.invited_by`) survives, which cannot produce K.

Two declared events have no call site and are dead code: `clothes_import_failed`
(`:233`) and `client_error` (`:244`).

Both `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN` and `EXPO_PUBLIC_SUPERWALL_API_KEY_IOS`
**are** set on the production EAS profile (`eas.json:42`, `:46`) — verified, so
the dashboards are live and this is a coverage problem, not a wiring one.

---

## 10. Standing refusals preserved

Nothing in this wave overrides:

- The palette, light-only, and the design system
  (`docs/design/field-guide-audit.md`, and the four settled atlas conflicts).
- No claim the shipping build does not do.
- The AI consent sentences (`src/features/auth/consent-facts.ts`) and the routing
  pin they depend on. Marketing copy may not restate them more strongly.
- Garment imagery stays CC0.
- No competitor named in any shipping surface (§4).
- The plate card artifact (§6).
