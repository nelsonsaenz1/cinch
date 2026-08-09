# Membership & Packing — the frozen contract

Wave 3 of the Claude Design atlases: **27 · Membership paywall** and **28 · Packing (paid)**.
This document is the arbiter for both. Where it and an atlas disagree, this wins — and every
place it overrules an atlas says why, because the reason is always that the app cannot honestly
make the claim the design prints.

Source bundles: `design-refs/` (`Membership Paywall Atlas`, `Packing Questionnaire Atlas`),
each with the PNG export from the same run, so the PNG cannot disagree with the HTML.

Companions: [`free-tier-contract.md`](./free-tier-contract.md) (the counting function, the ten-piece
closet), [`event-social-contract.md`](./event-social-contract.md) (the state-ID collision precedent).

---

## 1. State IDs

The paywall atlas numbers itself **M-01 … M-06**. `M-01 … M-04` already belong to Match & Confirm
and are referenced by name in `src/features/match/`. Same collision as the Event/Comments wave,
same resolution: **the newcomer renames.**

| Atlas | This repo | Screen |
|---|---|---|
| M-01 | **MB-01** | Paywall, default — Pro preselected |
| M-02 | **MB-02** | Entered from the stylist |
| M-03 | **MB-03** | The five other context lines (reference, not a screen) |
| M-04 | **MB-04** | Loading prices, then purchasing |
| M-05 | **MB-05** | Store unavailable, and restore |
| M-06 | **MB-06** | Bought — back to the interrupted task |

Packing's **K-01 … K-06** are unclaimed and keep their numbering.

---

## 2. The five things the atlas says that are not true of this app

The brief's own rule: *if something in the design is impossible or dishonest in the real app,
stop rather than fake it.* Five did. Four are corrected here in the atlas's own voice; one is a
product change the founder made in response.

### 2.1 The free closet is ten, not fifty

MB-03 prints *"Fifty pieces is where the free closet stops. You have forty-nine, and a coat in
the camera roll."* Free has been **10 active / 30 total** since the Ten (`PLAN_ITEM_LIMITS.free`,
`item_limit_for_plan()`, `item_total_limit_for_plan()`). Fifty was the number before that wave.

**Shipping line, garment limit:**

> Ten pieces is where the free closet stops — and ten is enough to dress a fortnight. You have
> ten, and a coat in the camera roll.

The second clause is the free-tier contract's own argument and the reason the number is small on
purpose. The count is read live from `useCapacity()`; nothing is hardcoded.

### 2.2 Free gets three outfits a *week*, not a day

MB-03 prints *"That's today's three outfits. Members get a new set whenever the day changes on
them."* `PLAN_LIMITS.free.outfit_generation` is `{ limit: 5, period: 'week' }`, against a product
promise of three a week. "Today's three" describes a plan nobody is on.

**Shipping line, generation limit:**

> That's this week's three outfits. Members get a new set whenever the day changes on them.

### 2.3 Pro is a thousand pieces, not unlimited

MB-01's third benefit line reads *"Unlimited garments and unlimited outfits."* Pro is
`items: 1000`. Unlimited outfits is true (`outfit_generation: 60/day` against a promise of
"Unlimited"); unlimited garments is a claim the app refuses to honour at 1001, which is both a
support ticket and an App Review exposure on subscription claims.

**Shipping line:** *"A thousand pieces, and unlimited outfits generated every morning."*
(Founder's call, 2026-08-09.)

### 2.4 Packing becomes Pro-only

MB-01 says *"Pro adds the stylist, events and packing"* and K-01's CTA is *"Pack a trip with Pro
· $14.99/mo · $119/yr"*. The shipped code disagrees on all three: `usePackingAccess` allows
`plan !== 'free'`, Standard has the stylist (30 messages/month) and hosts 15 events.

**Resolved towards the atlas, because the founder chose to move the product** rather than the
copy — nobody has subscribed yet, the app is not live, so the tier is free to change
(2026-08-09).

- `usePackingAccess.allowed` becomes `plan === 'pro'`.
- The stylist and event hosting stay on Standard. MB-01's summary line is rewritten to match
  what is actually sold:

  > Standard covers the closet, the daily outfits and the stylist. Pro adds packing, and takes
  > every ceiling off.

- MB-02's *"Standard — Doesn't include the stylist"* is therefore **only ever shown for the
  packing trigger**, and reads *"Doesn't include packing."* For the stylist trigger, Standard
  carries no disclaimer at all, because Standard includes it.
- The server has to move with the client. `packing-brief` currently claims the `stylist_chat`
  allowance, which Standard has — so a Standard client patched past the gate would still get a
  brief. Phase 1 adds a plan check to the function itself.

### 2.5 Cost-per-wear is printed or dropped, never estimated

K-05's bag header reads *"11 pieces · $2.40 per wear"*. `purchase_price` is nullable and unset on
most rows; `costPerWear()` already returns null without both a price and a wear.

**Rule:** the per-wear fragment appears only when **every** packed piece has a price. Otherwise
the header is *"11 pieces"* and nothing else. Same rule as weather on the share card — the
artifact prints what it knows or says nothing, and never averages its way to a number.

This does not relitigate [[cinch-share-card]]'s ban: cost-per-wear stays off the **share
artifact**. The memo inside the app may carry it under the rule above.

---

## 3. The paywall is served through Superwall

The atlas's own first line, and the decision after research (2026-08-09).

**What Superwall owns:** the document at `cinch-membership-v2` (paywall id 253377, application
52618) — layout, the plan cards, live StoreKit prices for the four attached products, the
purchase sheet (MB-04), the store-unavailable body (MB-05), restore, terms, privacy.

Note `published_at` is **null** today. Until that document is published, every placement in the
app resolves to a grey WKWebView with no close control — the failure `use-gate.ts` is built to
survive. Publishing it is the single highest-value remaining action on revenue, and it is the
one thing in this wave that cannot be done from a terminal.

**What the app owns, and must not delegate:**

1. **The six context lines** (MB-02, MB-03). Passed as `params` on `registerPlacement`, so the
   line above the headline is written in the client and versioned in git. The paywall document
   renders `{{context}}` when present and collapses the block when absent (MB-01).
2. **The gate.** `usePackingAccess` reads the entitlement, never whether a paywall appeared.
   `placements.ts`'s standing rule holds: an unmatched placement proceeds silently, so a lock
   that lives in Superwall is an open door.
3. **The return** (MB-06). See §7.
4. **Every locked and refused plate** — K-01 and the four failures of K-06 — which are drawn by
   Cinch and are therefore verifiable on a simulator.

### 3.1 The six trigger lines

Keyed by `PlacementName`, one file, no prose in the paywall document.

| Placement | Line |
|---|---|
| `open_stylist` | You asked what to wear to the rehearsal dinner. The stylist has an answer — it's part of Standard. |
| `add_garment_over_limit` | Ten pieces is where the free closet stops — and ten is enough to dress a fortnight. You have ten, and a coat in the camera roll. |
| `generate_outfit_over_limit` | That's this week's three outfits. Members get a new set whenever the day changes on them. |
| `trial_expired` | Your two weeks are up. Nothing has been deleted — the closet is exactly where you left it. |
| `event_hosting_over_limit` | You can join any event you're invited to. Hosting one — and inviting the table — is Standard. |
| `packing_access` | Four days in Lisbon. Pro packs the bag — day by day, from the closet you already own. |

`repeat_upsell` has no atlas line; it falls through to no context line, which MB-01 already
handles. The stylist and event lines name **Standard**, not Pro, because Standard is where those
features actually start (§2.4).

The destination and duration in the packing line are interpolated from the answered trip when one
exists, and the line falls back to *"Pro packs the bag — day by day, from the closet you already
own."* when the paywall is reached from K-01 before any questionnaire has been answered. **No
invented city.**

---

## 4. The questionnaire

Four questions, one per screen, replacing the shipped five. `trip.ts`'s grammar survives —
closed vocabularies, keys on the wire, prose composed on device, free text only in the
destination search.

### 4.1 Where (K-02)

Unchanged in mechanism (`searchPlaces`, Open-Meteo geocoding), with two additions the atlas
draws:

- **Climate disambiguation.** The atlas shows two Lisbons separated by `18–24°C` and `6–14°C`,
  which is the only thing that distinguishes them for this purpose. Each candidate carries a
  climate band for the **trip's own month**, from Open-Meteo's archive normals. Candidates whose
  band cannot be resolved show their region instead — never a guessed range.
- **Recent.** The last three distinct destinations from `trips`. Absent for a first trip; the
  section does not render rather than showing placeholders.

### 4.2 Who with

The atlas prints the answer as *"Nadia and Tom"* without showing the input. Two readings; the
honest one wins.

**Resolution:** the closed `COMPANIONS` vocabulary is what the engine reads, because who you are
with is what changes the clothes and a name changes nothing. On top of it, the user may attach
**friends from the social graph**. The summary row prefers names when friends were attached and
falls back to the vocabulary label otherwise. A name is never typed and never invented.

### 4.3 Dates

**The real change.** The shipped flow asks trip *length* from `TRIP_LENGTHS = [2,3,5,7,10,14]`,
and `fetchForecast` only counts days forward from today. Neither can answer "12–15 Sept". The
atlas asks for a date range and then quotes a real forecast for those dates, so:

- `Trip` carries `startsOn` / `endsOn` (dates, no times), `days` derived.
- `fetchForecast` gains `start_date` / `end_date`.
- Beyond Open-Meteo's 16-day horizon there is no forecast, and K-06's first failure is exactly
  that case. See §6.
- The range picker is built in JS. `@react-native-community/datetimepicker` would be a native
  module and would cost a store build for a wave that otherwise ships over the air.

### 4.4 Vibe and day parts (K-03)

One screen, both multi-select, with the running arithmetic underneath.

**Vibes** (atlas): `warm-city`, `work`, `long-dinners`, `beach`, `wedding`, `walking`.
Each carries a formality as the shipped table does. Trip formality is the **maximum** across
selected vibes — a trip with a wedding in it is a 5 even if it is also a beach.

**Day parts** (atlas): `daytime`, `evening`, `gym`, `travel`. The shipped
`morning`/`day`/`night` is replaced.

### 4.5 The arithmetic, and the one place days × parts is wrong

K-03 prints *"Two day parts across four days is eight looks"* and K-05 promises *"eight looks"*.
So `looks = days × parts` — **except for travel days, which are two days, not every day.**
Packing a "travel" look for the middle of a trip is the over-packing this screen exists to stop.

```
looksFor(days, parts) =
  Σ over parts:  part === 'travel' ? min(2, days) : days
```

Pure, lives in `src/features/plan/packing-math.ts` (`.ts`, never `.tsx` — the test bundler
cannot parse React Native's Flow source), and every figure the two atlases print is a row in
`tests/packing-math.test.ts`.

---

## 5. The memo (K-05)

Prose first, then the bag, then the days. Not a checklist.

- **`buildPackingList` becomes per day-part, not per day.** It currently produces one outfit per
  day; the memo needs `Day` and `Night` rows against one forecast. The reuse-affinity mechanism
  is unchanged — it just runs once per look instead of once per day, which is what makes the
  repeat counts real.
- **Repeat counts sit on the pieces** (`×3`, `×4`), not in a summary line, because they are the
  argument for the bag being small.
- **`worn`** replaces a count on the footwear used on the departure look — it is on your feet,
  not in the bag. Exactly one piece may be marked this way.
- **Header:** `{n} pieces` plus the per-wear fragment only under §2.5's rule.
- **Share** reuses the existing share pipeline with its own artifact. Cost-per-wear stays off it.
- **Save to Plan** writes the trip (§8). **Swap a day** re-runs one day's looks with that day's
  current pieces excluded.

---

## 6. Failure taxonomy (K-06)

Every one keeps a path forward, and none upsells.

| # | Condition | What is shown | Actions |
|---|---|---|---|
| 1 | Dates beyond the 16-day forecast horizon | Seasonal normals from Open-Meteo's archive, stated as such: *"there's no real forecast yet. Cinch packed for a normal Lisbon September — 18 to 27°"* | **Pack anyway**, **Save and revise** |
| 2 | Closet cannot fill every look | The honest shortfall: *"Six looks, not eight — you don't own anything that works for a warm evening out."* Computed, never rounded to a nicer number | **Show the six** |
| 3 | Membership cannot be confirmed | *"The App Store isn't responding… Your last saved list is still here and still yours."* | **Open last list**, **Retry** |
| 4 | Brief timed out | Answers are saved; nothing to retype | **Try again** |

**Failure 1's "Remind me" is cut.** The atlas offers a reminder closer to the day. Push
notifications are not built — no `expo-notifications`, no APNs key, no `aps-environment`
entitlement — so the button would be a promise the app cannot keep. It becomes **Save and
revise**, which writes the trip and is a promise the app *can* keep. Raised, not silently
dropped.

**Failure 3 fails open, and that is deliberate.** A member whose entitlement cannot be verified
is treated as a member; the paywall is never shown here. The exposure is bounded because the
server checks independently — `packing-brief` will refuse a non-Pro plan (§2.4) — so the worst
case is a free user seeing a questionnaire and then an honest refusal, not a free brief.

---

## 7. MB-06 — handing the user back

The success screen's whole job is to return them to the interrupted task, **named**. That is
app-owned state: the placement that opened the paywall is the name of the thing they were doing.

- The gate records the originating placement and the route that raised it.
- On `granted`, the app navigates back to that route and the button is labelled from the
  placement (`open_stylist` → "Back to the stylist"; `packing_access` → "Back to the trip").
- The receipt line prints the plan from `subscriptions.plan` and the renewal date from
  `subscriptions.current_period_end`. **That column is null until the webhook fills it** — when
  it is null the Renews row is dropped entirely rather than showing a computed guess.
- No confetti.

---

## 8. Trip persistence

Three separate surfaces need a trip to outlive its screen, and none of them can work today
because nothing is stored: K-01's history line, K-05's *Save to Plan*, K-06's *Open last list*
and *Save and revise*.

New table `trips`, owner-only RLS, no anon policy, mirroring the established shape:
the answered questionnaire (destination fields, `starts_on`, `ends_on`, companions, friend ids,
vibes, parts) plus the computed result (`piece_count`, `look_count`, `item_ids`, the day plan as
jsonb).

**K-01's history line is dropped when there is no previous trip.** It reads *"Your last trip —
four days in Lisbon — came out at eleven pieces and nine looks"*; a first-time user has no such
sentence and does not get an invented one. The other three bullets carry the gate on their own.

---

## 9. Inherited refusals

Carried forward unchanged from [`cinch-atlas-vs-design-system`]:

1. **`faint` (#8A8578) is never text.** ~3.5:1 on canvas — an AA failure. Six waves have
   reintroduced it from an atlas; sweep for `theme.faint` before merging. Use `muted`.
2. **The palette is locked**: #FBFAF6 / #1C1A16 / #6E2B2B / #B08A76 / #F0ECE3. Light only.
3. **One oxblood action per screen.** The atlas says so itself for the paywall.
4. **No countdown timers, no crossed-out prices, no urgency copy.** Also the atlas's own rule,
   and it survives contact with a conversion argument.
5. **Anything with a ground uses the shared `Button`.** A `Pressable` carrying both a
   `className` and a *function* `style` renders nothing — the NativeWind interop hole that
   shipped a dead button in build 17.
6. **Every state gets a dev route.** A state without one is a state nobody has looked at.

---

## 10. Unit boundaries

Phase 1 (shared, built before any unit starts) is mine: `trip.ts`, `packing.ts`,
`packing-math.ts`, `weather.ts`, `use-trips.ts`, `components/plan/date-range-picker.tsx`, the
`trips` migration, the `packing-brief` plan check, and `usePackingAccess`'s move to Pro.

`use-trips.ts` in particular exists so three units do not each write their own `.from('trips')` —
K-01 reads the last packed trip, K-05 saves onto it, K-06 reopens it. It is read-only to all
three.

| Unit | Owns | Must not touch |
|---|---|---|
| **P — Membership** | `src/features/billing/*`, the trigger-line module, MB-06 handoff | anything under `src/features/plan/`, including `packing-tab.tsx` |
| **Q — Questionnaire** | K-01 gate (`packing-tab.tsx`), K-02, K-03, `trip-questionnaire.tsx`, `use-trip-questionnaire.ts` | `src/features/billing/*`, `packing-trip.tsx` |
| **L — The memo** | K-04, K-05, K-06, `packing-trip.tsx`, `use-packing-brief.ts`, the share artifact | `src/features/billing/*`, `trip-questionnaire.tsx` |

Shared layer (`src/components/ui/*`, `src/theme/*`, everything from Phase 1) is **read-only** to
all three. A unit that needs a change there files
`.redesign/primitive-requests/<unit>.md` and keeps going — it does not block, and it does not
edit.

A file-overlap check reporting "no overlap" is not proof. It gave a false negative last wave.
`tsc` and the simulator are the arbiters.
