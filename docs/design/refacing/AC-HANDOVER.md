# AC — Add Clothes chooser: what was built, and what stopped

Built 2026-08-11 from `docs/design/refacing/` (the drop) against
`refacing-directive.pdf` (the constitution). The directive's closing
instruction, mirrored from the build's own: *if a fact named here is missing or
contradicts what you find, stop and report which.* Four things stopped. They
are listed first, because they are the point of this document.

---

## 1 · Conflicts — flagged, not silently overridden (§0 precedence, rule 1)

### 1.1 AC-05's gate order contradicts the shipped capture flow

**The directive says** (§3.2, AC-05): *"the tap hands to the paywall per door
(today's C-07 rule), because the page inherits capture's gate order — capacity
before consent, both before any picker."*

**The code says the opposite, deliberately.** `src/app/capture.tsx`, above
`guarded`:

> Gate every capture entry point on consent alone. Capacity is NOT checked here
> any more — Camera and Library both open unconditionally, at any capacity, per
> the Wall's W-02: the limit is decided once a photograph exists
> (`settleCapture`), never at the door.

`settleCapture` reads capacity *after* the photograph exists and raises the
Closet Full sheet, which offers "Make room for it" (a real swap flow) and "See
plans". `Placement.AddGarmentOverLimit`'s own comment gives the reasoning:
*"Making someone photograph and background-remove a jacket and then telling
them their closet is full is how you earn a one-star review."*

So "capacity before consent, both before any picker" describes a gate order the
app moved away from on purpose, with its own atlas (W-02) and its own escape
hatch. Per §0 rule 3 the shipped behaviour wins on a claim about what the app
does, and per rule 1 the conflict is recorded rather than resolved.

**Built:** AC-05 renders the chooser undimmed with every door interactive —
which is what both the directive and the shipped behaviour agree on. No door
reroutes to MB-01. **Founder's call:** does the ceiling move back to the door,
reversing W-02, or does AC-05 mean "the chooser does nothing special and the
Wall still catches it"?

**1.1 and 1.2 were decided by the founder on 2026-08-11.** AC-05 stands as
built — W-02 keeps the ceiling, and the chooser does not reroute doors to the
paywall. AC-04 moved onto the chooser for the content doors only; see §1.2.
The rest of this section is the record of what was argued, kept because the
resolution is only legible next to it.

### 1.2 AC-04's sheet is not the sheet the app owns

The atlas draws a reduced sheet: title *"Before Cinch looks at your photos"*,
one body sentence marked `[CLAIM]`, buttons **Allow** (oxblood) / **Not now**
(ghost).

The shipped `ConsentSheet` (`src/components/ingest/consent-sheet.tsx`) is
richer and contract-bound:

- Four numbered consent facts, held in `src/features/auth/consent-facts.ts` —
  a module that exists because the privacy page (PD-02) must quote back the
  *original* wording, and *"the moment the two copies drift the page is telling
  somebody they agreed to wording they never saw."*
- Buttons **"Turn on AI tagging"** (ink) / **"Keep my photos on this phone"**
  (secondary) — and the second one satisfies refusal 13, which requires the
  keep-option to be *named for the thing kept*. "Not now" does not.
- A decline routes into A-04, the full-screen "what changes" explainer, shown
  once at the moment of decline.

Drawing the atlas's sheet would drop three facts, rename the keep-option to a
form refusal 13 forbids, and orphan A-04. §0: *"Not permission to weaken a
claim the app makes."*

**Built:** the chooser does not re-implement the gate. Each processing door
lands on the capture surface, where the existing sheet fires on the door the
user tapped — which is AC-04's stated intent ("consent stays deferred to the
door tapped"). **The one real deviation:** the atlas draws the sheet over the
*chooser*; it fires one screen deeper.

**Resolved 2026-08-11 — the gate moved, the sheet did not.** The chooser now
fires the consent ask itself, over AC-01, on the first tap of **Photo Library**
or **Describe it**. The sheet it fires is the shipped `ConsentSheet`, with its
four contract-bound facts and its keep-option named for the thing kept — not
the atlas's reduced pair. A decline is persisted and shows A-04 once, over the
chooser, exactly as it does on capture.

The two persisted flags moved to `src/features/ingest/consent-mode.ts` so both
screens read the same strings. A decline recorded under one key and read under
another is an app that asks a privacy question twice.

**Two doors are deliberately not gated here, and this is the one judgment in
the change worth arguing with:**

- **Camera** goes straight through. Arriving at a viewfinder processes nothing
  — the photograph does not exist yet — and capture already asks at the
  shutter, at the moment there is something to send. Gating it on the chooser
  would move the ask *earlier* than the app has ever asked it, to a point where
  the thing being consented to has not been created.
- **Talk it in** goes straight through. Voice carries its own consent line
  above the Walkthrough's record button, about a recording rather than a
  photograph.

If the intent was literally "any door", both are one line each.

### 1.3 The nav title: 28 or 24?

The drop's README and the PNG draw *"Add clothes"* at **serif 28**
(`text-title`). The directive §3.2 writes *"Serif `plate` title left"*, and
`plate` is 24px in `tailwind.config.js`.

**Built:** 28, per the atlas — §0 rule 1 gives the drawn value precedence and
asks for the conflict to be recorded. Note this makes the chooser's title one
step *larger* than the capture screen behind it, which uses `plate`.

### 1.4 Button height 52 vs the ghost variant

Reference board A: *"Heights 52 (tap ≥ 44)."* Applied to every variant that
draws a ground. **`ghost` was left at the 44 floor** — it draws no ground (see
`ground()`), and it has ~30 call sites inline inside caption rows and
footnotes, `Notice`'s trailing "Undo" among them, where a 52pt minimum opens a
gap under a line of 11px text. The board itself draws ghost as bare words.
A judgment call, recorded here rather than made quietly.

---

## 2 · The `[CLAIM]` strings — written 2026-08-11, on the founder's call

Both were left blank in the first pass because neither sentence exists in the
contract it cites. The founder's instruction was to write them from what the
app can prove. They are therefore **new claims, authored here**, and the next
person to touch the contracts should fold them back in.

### 2.1 AC-03 — and why the drawn sentence could not ship

The atlas draws **"Your photos stay put either way"**. It cannot ship as
written: for anyone who has granted processing consent it is **false** — their
photos do leave the phone, to be tagged. A privacy sentence that holds only
for some readers is worse than none.

What the line was reaching for is provable, and that is what is printed:

> Turning it on only opens the viewfinder — nothing is sent without asking.

The camera permission and the processing consent are two separate gates.
Granting the first sends nothing anywhere. The second is asked for explicitly
(`ConsentSheet`) and is enforced server-side on every Edge Function call, so
"nothing is sent without asking" is a claim about behaviour the code holds up.

### 2.2 AC-05 — the ceiling notice, describing the gate this app actually has

The atlas draws **"Your ten are full — new pieces will ask about Standard
first. Nothing you add is ever lost."** The middle clause describes a gate
order this app does not have: W-02 stands, so the ask comes once a photograph
exists, not at the door. Printing it would promise a paywall that never fires
on this screen. What ships instead:

> Your {n} active pieces are full. Adding still works — Cinch asks about room
> once the piece is here, and stores rather than deletes.

`{n}` is `capacity.limit`, read live off the plan — never a literal, per
refusal 7 (printed or dropped, never estimated) and refusal 8 (the count is
not a marketing constant). "Stores rather than deletes" is refusal 3 stated in
the app's own voice. The notice draws only when `capacity.full`, which is
false while the count is loading, so it cannot flash at someone who has room.

## 3 · Superseded — what these strings replaced

Both were checked against the named contracts. Neither sentence is there, and
§1.9 forbids shipping the placeholder or a plausible guess.

| Where | The atlas's string | Contract checked | Result |
|---|---|---|---|
| AC-03, inside the camera condition | "Your photos stay put either way" | `privacy-invite-help-contract.md` | **No matching sentence.** Not drawn. |
| AC-05, the tray notice | "Your ten are full — new pieces will ask about Standard first. Nothing you add is ever lost." | `membership-packing-contract.md` | **No matching sentence.** The contract's only garment-limit line is MB-03's paywall copy ("Ten pieces is where the free closet stops…"), which is a different surface. Not drawn. |

The AC-03 condition therefore ships one line — "Camera access is off for
Cinch." — plus the Settings link. The AC-05 notice ships as nothing.

---

## 3 · Resolved

**The `critical` button fill.** The drop's Open Item 2 says §1.1 names no token
and board A draws the variant dimmed pending `src/theme/tokens.ts`. The token
exists: `critical: '#8A2E28'`, described in `tailwind.config.js` as *"a distinct,
deeper brick to avoid reading as the accent."* `Button`'s `critical` variant
already paints it. Nothing to do; the board can be redrawn undimmed.

---

## 4 · Still open, returned to the founder

**Lookup (AC-02).** Undefined — barcode/tag scan, or retailer catalogue
search? — and its destination with it. Per the directive the door and its
destination are deliberately **not** designed. The shipped chooser has four
doors. The reserved slot is drawn in the dev fixture only, so the question
stays visible on a device.

---

## 5 · What shipped

| | |
|---|---|
| `src/app/add-clothes.tsx` | The chooser. Four doors, gap 12, gutter 20, serif title + ghost Cancel. Zero oxblood except AC-03's Settings link. |
| `src/components/ui/door-plate.tsx` | `DoorPlate` + `DoorCondition` — reference board D, shared with T-00 when that tranche lands. |
| `src/components/ui/button.tsx` | Reference board A: the weight law, height 52, contact shadow on `primary` alone. |
| `src/components/ui/text.tsx` | A `door` variant — serif at the heading step, 20/−0.2. |
| `src/features/ingest/use-camera-access.ts` | `useCameraStatus()` — the same three states, read-only. AC-03 states the camera's condition without raising the system alert on arrival. |
| `src/app/capture.tsx` | `?start=library` / `?start=describe`, so a door opens the picker or the describe sheet **through the consent gate**, never around it. |
| `src/app/dev-add-clothes.tsx` | The fixture — AC-01…AC-05 stacked, with the two undrawn states annotated. |

### Reference boards B and C (added 2026-08-11, on the founder's go-ahead)

**Board B — stat columns centre (§2.2).** Applied to all three equal-width
figure-over-label strips the app actually has:

| Strip | File |
|---|---|
| Closet stat row — Pieces / Outfits / Unworn / Followers | `src/components/closet/stat-row.tsx` |
| Item-detail band — Wears / Cost per wear / Since last | `src/components/item/item-stats.tsx` |
| A friend's closet — Pieces / Wears logged / Per wear | `src/app/friends/[userId].tsx` |

Per-column flex weights are untouched: the widths exist so "$9.10" is not
crowded by "38", and §2.2 asks for centring *inside* them, not equal thirds.

§2.2 also names "profile stats" and "the share-card collage's printed figures".
**Neither exists.** Profile is a spine of settings rows with caption sub-lines,
not a figure-over-label strip, and `plate-card.tsx` prints its figures in a
colophon rail rather than in columns. Nothing to centre; recorded so the next
reader does not go looking.

**Two conflicts found while applying board B, flagged not overridden:**

1. **Figure and label sizes.** Board B specifies figures at Instrument Serif
   28/−0.15 and labels at 11/1.6 tracked uppercase Medium. The closet stat row
   is drawn at 24pt over a 9pt label, citing the Closet atlas (C-01) directly
   in its own comment. §3.5 — the directive's own instruction *for that page* —
   asks only that the figures centre, and says nothing about resizing them. So
   the sizes stand and the discrepancy is recorded.
2. **The item-detail band's third column.** Board B says the weights are
   1 / 1.4 / 1.3; the code has 1 / 1.4 / **1.1**, and labels the column "Since
   last" where the board writes "Since last worn". Left alone under the same
   rule.

**Board C — every surface resolves (§1.3).** The three named capsule violations:

| Violation | Outcome |
|---|---|
| Stylist chat input | Fixed — `rounded-full` → `rounded-md`. Its send button keeps `full`: it is 44×44, so it is a disc. |
| Sign-in email input and "Continue with email" | Fixed — the buttons were 32 and 30; both now 12. The **input itself was already compliant** (it is an underlined field carrying no radius at all). |
| Closet category chips at 30px capsule | **Already resolved before this pass.** The closet uses the shared `Chip`, which is `rounded-chip` = 12 and whose own comment records the 999 capsule as a deliberate deviation from the mock. |

Two more found and fixed on the same rule: the `(auth)/name.tsx` "Continue"
button (32 → 12), and the closet skeleton's chip placeholder (15 → 12, so a
capsule-shaped skeleton stops resolving into a 12px chip).

**Deliberately not changed.** The Apple sign-in button keeps its own radius —
§3.1 is explicit that Apple's native button stays Apple's. And the large
hardcoded radii that look off-scale at a glance (37, 33, 32, 25, 18, 15) are
all `size / 2` on 1:1 boxes: the camera shutter, avatars, skeleton discs. Those
are circles, which §1.3 allows; only a wider-than-tall box is a capsule.

**What board C did NOT get: the per-page surface inventory.** §2.3's obligation
— every container on a page annotated as flat band / md / plate / sheet — is
addressed to Claude Design, on the boards, not to the build. §1.3's own wording
is that the known violations are corrected "as their pages are redrawn". This
pass corrected the three it names plus two neighbours; it is not a
container-by-container sweep of every page in the app.

### The board sweep — what a fan-out audit found, and what was refused

Boards A/B/C were then audited across the whole app by ten agents (five
auditors, one adversarial skeptic each). 52 claims, 49 survived their skeptic.
**Three of the first three I re-checked by hand were wrong**, which is the
number worth remembering about this method: a low refutation rate is not a
clean bill of health.

**Refused, with reasons:**

1. **`src/components/ui/plate-tile.tsx:66` — radius 6.** Claimed off-scale.
   It is `concentric(20, 14)` — the correct computed inner radius for a tile in
   a `plate`-20 card with `p-3.5`. The auditor and its skeptic both missed the
   derivation. A false positive, and the reason nothing here was applied blind.
2. **`src/components/closet/example-closet.tsx:199` — the "An example closet"
   pill.** `rounded-full` on a wider-than-tall badge, which refusal 5 forbids
   outright. But the Closet atlas *draws a pill* and names it one. Directive
   against a drawn atlas value → §0 rule 1: flag, never silently override.
   **Founder's call.**
3. **`src/components/stylist/message-bubble.tsx:25` — bubbles at 18/4.** The
   file argues its own case in writing, a speech bubble is not a container in
   the sense board C means, and §3.8's stylist pass names the chat input, the
   send glyph and the sparkle — not the bubbles. Left alone. **Founder's call.**
   (Its outfit-strip *well* at line 106 was off-scale for real, and did move.)

**Applied — board A, hand-rolled controls that bypass the shared `Button`:**
`privacy/outlined-accent-button.tsx` and `item/delete-sheet.tsx` (outlined, were
Medium), `capture.tsx`'s "Done" and `onboarding/ten-camera-chrome.tsx`'s
"Cancel" (text-only, were Medium).

**Applied — board C, off-scale container radii:** 10 → 12 on the Today plate
tile, the stylist row, the outfit-post tile, the borrow sheets, the rail and
co-wear wells, the drag row, the closet "Edit profile" control; 14 → 12 on the
toast, the insight card, the example grid cell, the intake chip, the gap-feed
and wall rows, the swap card; 14 → 20 on the maintenance plate (it overrode
`Card`'s own `plate`); 6 → 12 on the reveal count chips; 5 → 4 (`sm`) on the
four corner badges; 10 → 8 on the repeat-outfit tiles.

**Still open from the audit, not applied.** Several board A findings are
genuine but want their own pass, because each means replacing a hand-rolled
control with the shared `Button` rather than patching a literal:
`(tabs)/explore.tsx`'s `LatelyButton` (radius 9 by default, overridden to 10 at
two call sites), `social/social-terms-sheet.tsx`'s "Agree and continue" (plate
20, height 56), `share-look/edge-states.tsx`'s `DestructiveButton` (44 tall,
15pt label, filled), `closet/selection-bar.tsx`'s `BarButton`,
`onboarding/tour-frames.tsx`'s `InversePill`, and `reveal/reveal-empty.tsx`'s
fix action — the last two of which `Button`'s `inverse` variant now covers
outright. Two board B skeleton placeholders (`item-skeleton.tsx:131`,
`closet-skeleton.tsx:61`) also still left-align where the strips they stand in
for now centre.

### Reference board A is an app-wide change

The weight law and the 52pt height live on the shared `Button`, so every
outlined and text-only button in the app drops to regular and every grounded
one grows 8pt. That is what §4.1 asks for — *"so page boards inherit answers
instead of relitigating them"* — but it is the largest-blast-radius edit in
this tranche and worth a look by eye before it goes further.

### Entry points rewired

Seven of the eight places that pushed straight into a live viewfinder now open
the chooser: Today's menu and its empty-closet action, Closet's example-closet
prompt, Plan, the Stylist's too-small-closet state, an event's post screen, and
the Gap Feed.

**Deliberately not rewired.** `invite-arrival.tsx` and
`features/onboarding/tour-state.ts` are the first-run spine, which §3.3 covers
in a later tranche and where T-00 owns the two-doors promise.
`walkthrough/review.tsx`'s `onPhotoPrompt` stays on `/capture`: it asks for a
photograph of one known garment, which is a camera, not a chooser.

### Values measured rather than stated

The glyph inside the 56×56 tile is drawn at **24**. Board D specifies the tile
(56, sand, md 12) but not the glyph, and §1.4's icon-role table has no entry for
a door tile. 24 is read off the rendering. If the role belongs in §1.4, name it
there and this follows.

### Dev route

House convention won over the drop's suggestion. The drop proposes
`/dev/ac/01`…`/dev/ac/05`; the codebase draws one fixture per atlas
(`dev-capture.tsx` carries C-01…C-06 in a single scroll), so this is
`cinch://dev-add-clothes` with all five states stacked and labelled. Refusal 14
is satisfied — every state has somewhere to be looked at.

---

## 6 · Verification

`npm run typecheck`, `npm test` (519 passing, 1 skipped), `npm run smoke:type`,
`npm run smoke:styling` and `eslint` over every changed file all pass. The one
lint error in `capture.tsx` (`set-state-in-effect`, line 327) is pre-existing on
`main` and untouched.

**Verified on a device.** Prebuilt and run on an iPhone 17 Pro simulator
2026-08-11. AC-01 renders from Closet's "Add your first piece"; AC-03 renders
with the condition on the Camera door and "Open Settings" as the only oxblood;
the fixture renders all five frames with AC-02's reserved slot drawn dashed.

Three environment notes for whoever builds this next, none of them code:

1. **CocoaPods needs a UTF-8 locale.** With `LANG` unset, `pod install` dies in
   `Pod::Config#installation_root` with *"Unicode Normalization not appropriate
   for ASCII-8BIT"*. Run it as `LANG=en_US.UTF-8 pod install`.
2. **A worktree needs its own `node_modules` and `.env.local`.** Neither is
   inherited from the main checkout. Without the first, `npx tsc --noEmit`
   exits 0 having checked nothing — a green typecheck that means nothing.
3. **Two dev servers collide.** A dev client will attach to whatever Metro
   holds 8081, which may be a different checkout entirely — the app then runs
   *that* branch's JS while appearing to run yours. Start on another port and
   point the client at it explicitly.

**The floating gear is not ours.** It overlays the top-right of every screen,
including the chooser's "Cancel". Nothing in `src/` draws it: it is
SuperwallKit's test-mode overlay, from `testModeBehavior: 'always'` under
`__DEV__` (`src/features/billing/superwall.tsx:151`). It is drawn natively —
it is visible over Expo's own bundling screen, before any React has rendered —
and `'automatic'` in release means it does not ship. Not a layout bug; do not
"fix" it by moving app chrome out from under it.
