# The Refacing — master design directive for Claude Design

**Written 2026-08-11.** Commissioned by the founder. This document absorbs and
supersedes two narrower briefs of the same date —
`type-weight-and-shape-refinement-spec.md` and `capture-entry-spec.md` — and
widens them into what they were always pointing at: **the face of almost every
page in Cinch, redrawn.**

This is a directive to **Claude Design**, the agent that produces atlases.
It is not a build spec. Claude Code builds from renderings, never from prose,
and that discipline is why this codebase's screens agree with each other. Your
deliverable is drawings — `.dc.html` atlas sources plus PNG renderings — for
every page named in Part III, each carrying the corrections in Part II and
obeying the constitution in Part I.

## 0 · What this is, and what it is not

**It is a refacing, not a reframe and not a rebuild.** The Reframe
(`reframe-directive.md`, 2026-08-10) settled positioning, information
architecture, the three waves, and the App Store record. Nothing here reopens
any of that. Tabs stay Today / Closet / Plan. The occasion stays an interrupt,
not a tab. The Ten stays a front door forever. What changes is the **surface**:
the founder has judged, screen by screen against the shipped build, that the
faces are close but not finished — small text shouts, figures sit off-axis,
flat bands go unshapen, several pages still wear their first-draft face while
the newest atlases (Closet, Capture, Match) show what the app looks like when
someone has actually drawn it. Every page gets that treatment now.

**Precedence, so nothing is ambiguous later:**

1. Where an existing atlas states a **drawn value** — a literal weight, radius,
   dimension — and this directive disagrees, **flag the conflict; do not
   silently override.** Most conflicts you find will be resolved in this
   document's favour, because Part II exists precisely to correct values the
   atlases were silent or wrong about — but the resolution is recorded, never
   assumed.
2. Where an atlas is **silent** (most captions, most stat rows, most flat
   containers), **this document is the tiebreaker.**
3. Where this document and a **frozen contract** disagree on a claim about what
   the app does — a limit, a price, a privacy fact — **the contract wins**, and
   the contracts win because the code wins. The contracts are listed in §1.7.
4. Where anything disagrees with a **standing refusal** (§1.6), the refusal
   wins, including against a later instruction.

**Three things this directive is not permission to do:**

- Not permission to invent product surface. Every page below exists, is
  commissioned by the Reframe, or is the one genuinely new page (the Add
  Clothes entry chooser, §3.2). If you find yourself drawing a screen not
  named here, stop and say so.
- Not permission to touch the token files. `tailwind.config.js` and
  `src/theme/tokens.ts` are read-only. Every value you draw must resolve to a
  token that already exists.
- Not permission to weaken a claim the app makes or strengthen one it cannot
  keep. The claim-trace discipline (§1.9) binds every sentence you set in type.

---

# Part I · The constitution — what every page is drawn from

You are not inventing a design language. Cinch has one, it is good, and the
whole point of this pass is to apply it *evenly*. Draw everything from here.

## 1.1 · Palette — locked, light only

| Token | Value | Role |
|---|---|---|
| `canvas` | `#FBFAF6` | the page. Warm paper. |
| `surface` | `#FFFFFF` | cards that hold content, incl. other people's looks |
| `tray` | `#F0ECE3` | image wells, search fields, the stylist's note, system blocks in threads |
| `sand` | `#EAE5DB` | slot tiles, secondary grounds |
| `ink` | `#1C1A16` | text, fills, the one dark stage (capture), scrims |
| `muted` | `#6B665C` | secondary text. **The** secondary text colour. |
| `faint` | `#8A8578` | decorative marks and dark grounds ONLY — never text (§1.6.8) |
| `rule` | `rgba(28,26,22,.12)` | structural rules, silhouette outlines |
| `hairline` | `rgba(28,26,22,.09)` | the lighter border |
| `rule-strong` | `rgba(28,26,22,.28)` | outlined buttons, dashed empty slots |
| `accent` | `#6E2B2B` | oxblood. Exactly one action per screen. |
| `blush` | `#F7EDE8` | "yours" / "chosen" — once per page (§3.7) |
| `blush-rule` | `rgba(176,138,118,.45)` | blush borders |

No dark mode. No new tokens. The dark ground on the tour and the capture stage
is ink used as a ground, not a theme. Shadows are always warm ink — the one
shared recipe is the **contact shadow** `0 / 5 / 11 / ink at 16%` — never pure
black, anywhere, including text shadows and export canvases. (The share card's
pure-black shadow and `capture.tsx`'s black text shadow are known drift; draw
the corrected warm-ink value.)

## 1.2 · Type — two faces, and now the weights are governed

**Instrument Serif** for display, titles, plate names, figures — the editorial
voice. It ships one weight; weight is not a variable there.

**Helvetica Neue** for body and UI — and it has exactly **two cuts** in this
app: regular and Medium. There is no true semibold; `font-semibold` resolves to
the same Medium file. Never draw a numeric weight the face doesn't carry.

Scale (px / letter-spacing): `colophon` 10/1.4 · `caption`/`eyebrow` 11/0.1‖1.6
· `label` 13 · `callout` 16 · `body` 17 · `heading` 20/−0.2 · `title`/`figure`
28/−0.15 · `display` 40/−0.3 · `wordmark` 64/−0.6.

**The weight rule this refacing enforces on every page** (this is correction
one of the founder's three, now law):

- **Medium is for labels, not prose.** Tracked eyebrows, colophons, chip text,
  form-field labels, badges — genuinely *labels* — carry Medium. That is
  standard practice at 9–13px with tracking and it stays.
- **Everything at caption/label size that reads as a sentence is regular.**
  Captions under images, bylines, helper text, empty-state body copy, "Cost per
  wear", "Last worn Tuesday" — set in the regular cut (`note` / `noteSmall` in
  the build). A caption set in Medium is bold grey shouting something meant to
  be murmured, and today roughly four out of five small-text call sites in the
  app do exactly that. Every page you redraw must annotate its small text as
  LABEL (Medium) or PROSE (regular) so the build cannot guess.
- **Buttons, per variant:** filled buttons doing real work — `primary`, `ink`,
  `critical` — keep the Medium label at 17px. Outlined and text-only buttons —
  `secondary`, `ghost`, `inverse` — drop to regular, so chrome stops shouting
  at the same volume as the call to action beside it. Draw both weights on the
  same board once, in the button reference sheet (§4.1), so the founder can
  confirm the cut by eye before it propagates.

## 1.3 · Shape — the radius scale, and where shape is owed

`xs` 2 · `sm` 4 · default 8 · `md`/`chip` 12 · `lg` 16 · `plate`/`card` 20 ·
`sheet` 38 · `full` circles and glass chrome only.

**The capsule rule is absolute:** `full` never goes on a labelled,
wider-than-tall control. Labelled controls are `md`, 12px, full stop. The
consumer-app pill is explicitly rejected. (Known violations to correct as
their pages are redrawn: the stylist chat input, the sign-in email input and
"Continue with email" button, the closet category chips as currently drawn at
30px capsule height — chips are `Chip`, 12px.)

**Correction three of the founder's three:** the app under-uses its own shape
language. Rules-only flat bands that are *documented* as flat stay flat — the
item-detail stat band and the closet stat strip are drawn as ruled bands of a
page, deliberately, and are named here so nobody "fixes" them. But every other
raw container with a background and no radius is a candidate. As you redraw
each page, resolve every surface to one of: a documented flat band, `md` 12, a
`plate` 20, or a `sheet` 38. **Do not invent an in-between radius.** The point
of a concentric scale is that everything on screen resolves to a small number
of curves. Where a tile sits inside a plate, the inner radius is computed
concentrically, not eyeballed.

## 1.4 · Spacing, motion, iconography

Spacing: `hair` 1 · `rhythm` 8 · `bezel` 12 · `gutter` 20 · `bare` 24 ·
`section` 28 · `tap` 44 (minimum target). Design at **393pt width, pt-for-px**,
as every atlas before. The refurb audit catalogued a dozen off-scale one-offs
(11, 14, 26, 6…) — as pages are redrawn, land every measurement on the scale,
and where the drawing genuinely needs a half-step, say so in an annotation
rather than leaving an unexplained 14.

Motion: durations fast 140 / base 220 / slow 380; springs smooth / snappy /
interactive, and `bouncy` **exactly once per moment-of-delight** — the plate
landing owns it on Today; the crown landing owns it on the Look Board. Annotate
motion only where a state transition is the design (the Walkthrough's WK-04
lift, the search collapse); everywhere else the existing vocabulary applies
unannotated. Every prominent motion is drawn with its Reduce-Motion fallback.

Icons are SF Symbols via `SymbolView`. The refacing fixes the drift by
declaring one size per role, drawn into every page that uses the role:
back-chevron 15 (already consistent — the reference) · trailing row chevron 13
· overflow ellipsis 15 · the sparkle "AI" glyph 15 · selection check 22 on
grid cards, 18 in pickers, 16 in rows · chat send 17. If a page needs a size
outside its role, the page annotation says why.

## 1.5 · The silhouette hand

Wave 1 makes drawn garments a first-class citizen of every grid, so every page
face that shows garments must be drawn **assuming silhouettes are normal, not
degraded**. The library's contract (from `silhouette-directives.md`) in one
paragraph, because half of Part III inherits it: 96×96 square viewBox, one fill
path carrying the garment's real colour, 1px `rule` outline with
non-scaling-stroke, at most two structural internal lines, no shading or
texture ever; flat lay, straight on, sleeves at 35–45°, curves win, corners
round; proportion by slot — outerwear/dress 0.92, top/bottom 0.85, shoes 0.60,
bags 0.55 — so a drawn closet and a photographed closet agree about scale. A
garment with no photograph is a **complete garment**: no badge, no dimming, no
sorting-down, no nagging, on any page, ever.

## 1.6 · Standing refusals — the merged master list

These override any later instruction, including one from the founder relayed
casually. They are the accumulated settled law of eleven waves; the number in
brackets is how many times the refusal has already had to be re-applied.

1. **One oxblood action per screen.** The accent is spent, not sprinkled.
2. **Progress is a count, never a bar or a percentage. Anywhere.** "Four of
   ten," "11 of 148 worn." This kills the closet insight card's 6px progress
   bar as currently specced — see §3.4 for its redrawn face.
3. **Nothing is ever lost.** Undo on destructive actions (4s), the ceiling
   stores rather than deletes, a failed upload keeps its source. No copy may
   imply deletion of a photograph, wear record, or cost figure.
4. **`faint` is never text.** [applied 8×] ~3.5:1 on canvas, an AA failure.
   Secondary text is `muted`.
5. **No labelled capsules.** [applied 2×] `full` is circles only.
6. **No new colour tokens, no dark mode, light only.**
7. **Temperatures, prices, and counts are printed or dropped, never
   estimated.** No em-dash placeholder, no zero, no category average. Currency
   comes from the formatter — never a glyph chosen in a drawing.
8. **The outfit count is never a marketing constant.** It appears only where
   computed from that user's closet, on screen. "Ten pieces is a wardrobe" is
   the approved constant-safe line.
9. **Zero is quiet.** A look with no picks prints no count line. `0 picks` is
   the cruellest string in the app. Counts count up; absences are invisible —
   who hasn't voted or shared is shown to nobody, host included.
10. **No leaderboards, no cross-attendee comparison, no strangers, no public
    feed, no public counts.** One crown, posting order, ties hold.
11. **No sourced, scraped, or third-party product imagery.** "Nothing is
    imagined, nothing is a catalogue photo" is the brand sentence. The two
    commerce surfaces (§3.10) show the shop's photograph *inside the product
    sheet only*, where the user has asked to shop — never in a closet, a plate,
    or a share artifact. Garment reference imagery in atlases stays CC0.
12. **No shop grammar.** No discounts, strikethroughs, countdowns, scarcity,
    sale badges, urgency copy — on the paywall as much as the Gap Feed.
13. **Every destructive confirmation names what is lost in one sentence, and
    its keep-option is named for the thing kept** — never "Cancel" inside a
    "Cancel this occasion?" prompt.
14. **Every state gets a dev route.** A state without one is a state nobody
    has looked at. Your atlases enumerate the states; enumerate them all.
15. **No countdown timers or urgency on money surfaces**; the paywall is
    dismissible, and dismissible means dismissible — no hidden close, no delay.

## 1.7 · The contracts that outrank this document on facts

When a page below touches one of these territories, the named contract is the
authority on every claim, limit, and behaviour: `free-tier-contract.md` (the
counting function, the ten, slot rules) · `membership-packing-contract.md`
(tiers, prices, trigger lines, packing) · `event-social-contract.md` (the
composed look, blush, social rules) · `diary-boards-activity-contract.md`
(diary/boards/activity/push facts) · `privacy-invite-help-contract.md` (every
privacy sentence) · `commerce-directive.md` (where selling is allowed) ·
`positioning-contract.md` (positioning, the marketing-constant rule) ·
`reframe-directive.md` (waves, IA, copy system) · `voice-intake-directive.md`
(the Walkthrough) · `silhouette-directives.md` (the shapes).

## 1.8 · The current offerings — the facts every face must agree with

Because pages have shipped with numbers the product no longer has, the live
facts, in one place. **Free:** ten active pieces, thirty stored; three outfits
a *week*; every feature of the closet, the daily plates, and joining any event.
**Trial:** fourteen days of full access, granted app-side. **Standard
($7.99/mo):** the closet at scale, a new set whenever the day changes, the
stylist (30 messages/mo), hosting events (15). **Pro ($14.99/mo, $119/yr):**
everything in Standard, plus packing, a thousand pieces, unlimited generation.
"Unlimited" never appears near garments. The stylist and hosting are
**Standard** — a face that files them under Pro is wrong. Packing is
**Pro-only**. Two front doors into a closet: photograph The Ten, or talk for
four minutes (Wave 1). The occasion (Wave 2) is dated, lives on Plan, interrupts
Today. Commerce exists in exactly two places (§3.10) and nowhere else.

## 1.9 · Copy on the drawings

You will set real copy in these faces, and copy in an atlas has shipped
verbatim before, so the rules travel with you: the terminology table binds
(*the occasion*, never *the group/feed/community* · *pin a look*, never *post*
· *your friends decided*, never *rated/scored* · *walk your closet*, never
*scan/catalogue/import* · *drawn*, never *generated/AI-generated* · *pieces*,
never *items*). Banned outright: "social" as positioning, "AI stylist" as a
headline, "unlimited" near garments, percentages in onboarding, uncited
competitor claims. And the claim-trace: **any sentence asserting a fact about
the app that you cannot point to a contract clause for gets drawn as
`[CLAIM: …]` placeholder text**, so the build resolves it against code rather
than shipping your plausible guess. Two sentences are protected above all: the
receipt line (`you said: "…"`) on every procession card, and "Nothing is
imagined, nothing is a catalogue photo."

---

# Part II · The three global corrections — applied to every redrawn face

These come from the founder's own eye against the shipped app, and they are
the reason this pass exists. No page below ships its new face without all
three.

## 2.1 · Small text stops shouting

Specified in §1.2. Operationally, for you: every text element below 16px on
every board carries a weight annotation — LABEL (Medium) or PROSE (regular) —
and the default for anything that reads as a sentence is PROSE. Tracked
uppercase eyebrows and colophons are LABEL and unchanged. When in doubt, read
the string aloud: if it could end in a full stop, it's prose.

## 2.2 · Stat figures centre in their columns

Wherever a figure sits over a label in an equal-width column — the closet stat
row (Pieces / Outfits / Unworn / Followers), the item-detail band (Wears /
Cost per wear / Since last worn), profile stats, a friend's-closet stats, the
share-card collage's printed figures — **both lines centre in the column.**
Draw the widest honest value in each column ("$9.10" is wider than "38"; a
four-digit follower count exists) and show it clearing the column without
wrapping, because centring must not reintroduce the crowding the per-column
flex weights were built to prevent. Any equal-width figure-over-label strip on
any page you draw inherits this without being named.

## 2.3 · More shape, deliberately

Specified in §1.3. Your obligation per page: the board carries a small
"surface inventory" annotation — every container on the page resolved to flat
band (documented) / `md` / `plate` / `sheet` — so the build has the written
list the spec demanded and the sweep is a check, not a hunt.

---

# Part III · The pages — every face, redrawn

Grouped as the user meets them. For each page: what it is now, what its new
face must do, and the states to draw. States marked ◆ are new with this
directive; everything else is a redraw of an existing state at the same state
ID. **Keep every existing state ID. New states take the next free number in
their atlas. New atlases take the two-letter prefixes assigned in Part IV —
check the registry before numbering anything; this codebase has collided
prefixes four times and the newcomer always renames.**

The founder's standing instruction to the build applies to you in mirror
image: Claude Code stops when an atlas is missing; **you stop when a fact is
missing** — a limit you'd have to guess, a string you'd have to invent, a
fourth door with no defined destination — and reserve the space rather than
drawing the guess.

## 3.1 · Welcome & Sign-in

The one page allowed its own dialect — a marketing-toned entry funnel — and
the single largest concentration of drift in the app: a parallel spacing
system, nine raw hex values, a fourth near-black, off-scale radii, pill
inputs. The dialect survives; the lawlessness does not.

**The new face:** the whole promise in one screen — *a stylist for the clothes
you already own* — shown, not told, with a sample plate. Redraw the hero on
the app's actual grid: token spacing (annotate any deliberate device-scaling
as a bounded, documented system), the swatch mock in named tokens or an
explicitly-approved illustration palette (one board, labelled, so it stops
being nine loose hexes), scrims derived from `ink`, the bottom sheet at
`sheet` 38, the email input and button at `md` 12. Apple's native button stays
Apple's. Eyebrows in the hero become real eyebrows.

**States:** default · email entry · magic-link sent · error (each field-level
failure keeps the typed text where it was typed) · returning user.

## 3.2 · Add Clothes — the entry chooser ◆ (new page, new atlas `AC`)

The founder's brief, expanded. Eight places route straight into a live camera
today; this page is the door before the doors — and with the Walkthrough
landing in Wave 1, the doors are now **four**:

- **AC-01 · Default.** Four doors as equal plates on canvas: **Camera** (live
  capture, today's C-01 flow) · **Photo Library** (the picker into the same
  queue) · **Describe it** (the garment-search sheet, promoted from side link
  to door) · **Talk it in** (the Walkthrough, WK-01) — because once voice
  exists, the chooser is where the two-doors promise of T-00 lives for every
  *returning* user, not just first run. Serif `plate` title left, plain
  "Done"/"Cancel" right — never glass chrome. `rounded-plate` cards, paper
  canvas, warm ink; one oxblood action means **no door is oxblood** — the doors
  are peers in ink-on-surface, and the accent is spent nowhere on this page.
  Each door: a glyph in the hanger's hand, a name in serif, one regular-weight
  line of what it's good at (Camera "true colour, one piece at a time" · Voice
  "your whole closet, four minutes"). Neither capture nor voice may read as
  the fallback — this is T-00's equal-doors rule, generalised.
- **AC-02 · A fifth slot, reserved.** The founder has used the word "Lookup"
  without defining it. Draw the layout with a reserved slot so the grid never
  needs redrawing — and **do not draw the door itself or its destination.**
  The open question travels to the founder: barcode/tag scan? retailer
  catalogue search? Until answered, AC-01 ships as four.
- **AC-03 · Camera previously denied.** The Camera door states it before it's
  tapped — the door carries its condition inline (compare capture C-03) rather
  than failing after.
- **AC-04 · AI processing declined.** Consent stays **deferred to the door
  tapped**, per the brief's own recommendation — a user sees their options
  before agreeing to anything. This state shows the chooser fully available
  with the consent sheet firing over it on first tap of a processing door.
- **AC-05 · At the ceiling.** The chooser renders; the tap hands to the
  paywall per door (today's C-07 rule), because the page inherits capture's
  gate order — capacity before consent, both before any picker.

## 3.3 · The first-run spine — Tour, T-00, The Ten, Walkthrough, Procession, Reveal, the paywall after

The Reframe commissioned these; the refacing folds them into one visual
sequence so seven screens drawn months apart read as one hallway.

- **Tour (TR-01…04).** The editorial dark frame — ink as ground, not dark
  mode. Redraw with Part II corrections; the tour never raises the push
  permission.
- **T-00 · Two doors.** Voice and photographs as equals; shares its geometry
  with AC-01 deliberately — draw them as siblings on one board so the build
  reuses the door plate.
- **The Ten (T-01…).** The slot model's face: 3 tops, 2 bottoms, 1 dress,
  2 shoes, 1 coat, 1 bag. Order is a suggestion, every slot declinable and
  redirecting with computed counts, progress as a count. Redraw at the new
  weights; the ninth state (the bag gap) is drawn as a pair with PR-07.
- **Walkthrough (WK-01…06)** and **Procession (PR-01…07)** to
  `voice-intake-directive.md`, unchanged in content — the seismograph meter
  (never an orb), the three-frame WK-04 animation spec, the four-variant
  WK-06 board; the procession card with the count top-left, silhouette at
  ~46% viewport, chips, and **the receipt line**, with the undo and gesture
  annotations. These are new drawings; make them the reference for how the
  refaced app feels, not an inheritor of it.
- **Reveal (R-02, R-06).** The number in serif, the second line in the same
  serif — *You talked for four minutes.* — never `muted`. Redraw R-02 (ten
  pieces) at the new weights alongside.
- **The paywall after the Reveal (MB-01 context).** Annual-first, dismissible
  meaning dismissible, landing on Today with the free tier intact.

## 3.4 · Today

The heart, and largely right — the plate grammar (numbered plates, serif
names, quiet colophons printing weather and $/wear) is the thing every other
page imitates. The refacing is precision, not reinvention:

- **The masthead** carries the day, the weather it accounted for, and the
  plans line ("dinner at 7, then drinks") — prose in regular weight.
- **The plate** keeps its contact shadow, its one `bouncy` landing, its
  reaction pair (love it / not for me — how Cinch learns), its worn mark. The
  colophon's data fragments are printed-or-dropped: no weather, no weather
  line.
- **OC-01 · The interrupt ◆** (Wave 2): when a live occasion exists it is the
  most important thing on the screen — name, date, days remaining, who has
  pinned, who has voted (counts up; absences invisible) — and when it doesn't,
  it is *gone*, not collapsed. Draw both mornings.
- **The activity dot** — a dot on the Today entry point and nowhere else,
  never a count.
- **States:** new user, empty closet (the door to AC-01, drawn warm — this is
  the single most-travelled empty state in the app) · normal day · nothing
  quite works (honest, with the gap-feed hand-off) · offline (yesterday's
  data, said plainly) · loading skeleton mirroring the real layout exactly.

## 3.5 · Closet, Item detail, and the silhouette states

The Closet atlas (C-01…C-06) is the newest large drawing and mostly stands.
The refacing amends rather than replaces:

- **Stat row:** figures centred (§2.2). Unworn stays the only coloured figure.
- **The insight card, redrawn ◆:** the 6px progress bar violates refusal
  1.6.2 and comes out. The card keeps its `tray` ground and its sentence —
  the face becomes the count as the figure: **"11 of 148 worn this year"** in
  serif with the footer prose in regular weight ("9 pieces have never left
  the rail. Worth a look before you buy anything else."). No bar, no
  percentage. Positive variant when unworn is zero.
- **Category chips** at `Chip` geometry, 12px radius — not 30px capsules.
- **Grid cards:** meta line weights per §2.1 (name LABEL, "{n} wears" and
  "$X.XX / wear" PROSE); NEVER WORN badge unchanged (a genuine label).
- **The silhouette states (C-07…C-10 ◆** — renumbered per
  `reframe-atlas-status.md`; the atlas's own C-06 keeps its number**):**
  all-silhouette closet drawn as the *normal* case; the mixed grid where
  photographs don't make drawings look unfinished (matched scale via §1.5);
  item detail with no photograph — complete, unbadged; the stored treatment —
  present, 45% opacity, thin rule, nothing hidden.
- **Item detail:** the flat stat band stays flat (documented); its figures
  centre; spec rows adopt the shared row geometry (chevron 13); cost-per-wear
  printed or dropped. The micro-colophon's tracking snaps to the colophon
  family.
- **Search (C-02), menu (C-03), multi-select (C-04), empty (C-05), loading
  (C-06)** redrawn only for Part II corrections — weights and surface
  inventory. The search field is `tray` at `md`; the popover menu is a
  `lg`-radius card with the pending-review count as a genuine badge (LABEL).

## 3.6 · Plan & Packing

- **The week:** plates across coming days against each day's weather and
  plans, no piece repeated too often; the repeat mark inside the existing
  plate. Planned days never read as worn — a plan is not a wear, anywhere a
  date is printed.
- **Packing (K-01…K-06)** to `membership-packing-contract.md`, refaced:
  K-01's gate names **Pro** with the history line only when a previous trip
  exists; the questionnaire's climate bands are real or absent; K-03's
  arithmetic line uses the travel-days rule; K-05 is **prose first, then the
  bag, then the days** — repeat counts on the pieces (`×3`), `worn` on the
  departure shoes, the header's per-wear fragment only when every piece has a
  price; K-06's four failures each keep a path forward and none upsells.
  Date-range picker drawn in the app's own hand (it is JS, not native).
- **The occasion is created from Plan** — the creation entry point sits here,
  quiet until used.

## 3.7 · Occasions & the social rooms

To `event-social-contract.md` and the Reframe's OC table. The composed look is
**one object at four sizes** — grid, never a stack, piece one is the face,
overflow collapses to five-plus-`+2` — and no room re-composes it. Blush means
"yours / chosen," once per page, per the contract's table. Redraw all of:

- **OC-01…OC-08 ◆** — the interrupt (with Today, §3.4) · name-the-occasion
  (date mandatory; dress code optional) · the invitation ("you're going to
  this, come sort it out" — never "join my app") · **waiting** (the empty
  state that decides whether the feature lives — draw it with the same care
  as a populated board) · pin your looks (two options, side by side, from
  your own closet) · the vote (one person's options against each other only)
  · decided (what, and by whom) · the day (what everyone is wearing, the
  morning of).
- **Event Detail, Invite Friends, Look Board, Comments, Share a Look** —
  refaced for Part II; the board's card grammar (Ahead pill before close, one
  crown after, hairline-vs-blush spending), comments as a sheet over the
  board with `tray` reserved for the system's voice, moderation named and
  never silent, optimistic failures retrying on their own row.

## 3.8 · Stylist

Its own dialect — a conversational surface — but not its own law: the chat
input drops the capsule for `md`, the send glyph is 17, the AI sparkle 15,
and the stylist's suggested outfit renders as **the same plate** as Today, at
plate grammar, so a suggestion feels like the app and not a chat attachment.
Honesty states drawn: the "you don't own the right thing" answer (with the
gap-feed hand-off, no invented garment), the sub-ten-pieces state, the
Standard gate (the stylist is Standard, not Pro), offline, and the 30-message
ceiling reached — count, not bar.

## 3.9 · Capture, Describe, Review

Capture's atlas is current (C-01…C-12) and was traced from the shipped build;
it inherits Part II (canvas-weight prose on the sheet, LABEL on stage words)
and the corrected warm-ink text shadow, and its downstream is otherwise
untouched — the chooser (§3.2) is what comes *before* it. Describe (D-01…12)
and Review/Match (M-01…12) reface for weights, shape inventory, and the
receipt-adjacent honesty rules: a low-confidence tag hedges in `muted`, and
accept/skip are equal citizens.

## 3.10 · Commerce — the two honest surfaces

To `commerce-directive.md`, drawn for the first time:

- **The gap card with a source (GF states):** the computed line first and
  heavier, the merchant row after and lighter — *"Three at Everlane, Sézane
  and Uniqlo — from $38." · **Paid link*** — at most three merchants, matched
  by fit, price as a floor, no shop grammar; a gap card with no products is a
  complete card.
- **The product sheet:** the shop's photograph, name, price, one `Open` per
  product, and the relationship paragraph in the app's own voice, every time.
- **A friend's piece:** *"Sophie's — Reformation Cleo dress."* **Find it** ·
  Paid link — only where the owner's separate `shoppable` flag is on.
- **The off switch** in settings, and every face whole without the rows.
- `Paid link` at full size, adjacent, never greyed, never behind an ⓘ.

## 3.11 · Diary, Boards, Activity, Notifications

To `diary-boards-activity-contract.md` (WD, KP, AV, NP): the diary as a read
of real wears (a plan is never a wear); notes on wears; kept plates and boards
with the plate tile at rest shared with KP's grid; Activity's five row kinds
with **Not now** (never "Decline") and zero-quiet counts; notification prefs
where the description under each toggle *is* the promise — the morning edit
line is the nudge, never the look, and no toggle exists for a feature that
doesn't. Season in review stays deferred; draw nothing for it.

## 3.12 · Profile, Privacy, Invite, Help, and the system pages

- **Profile:** the account spine — style summary, AI controls (including off),
  rows to Diary / Saved / Notifications / Privacy / Support — refaced onto
  the shared row geometry, one chevron size, weights per §2.1.
- **Privacy & Data (PD), Invite (IV), Help (HS)** to their contract: every
  assertion claim-traced; the three-horizon deletion story; "Came in from
  your link" (never "waiting on"); the export card with **no progress bar**
  (indeterminate, honestly); body text 17.
- **Paywall (MB-01…06) and the ceiling (M-07, M-08 ◆):** context line above
  the headline from the app, one oxblood, no urgency; M-07 draws the whole
  closet *behind* the ceiling, complete, beyond-ten at 45% — the message is
  holding, not hostage; **M-08, "Keep ten for now," is not optional** — a
  choice reads as an offer. MB-06 returns the user to the interrupted task,
  named; the Renews row is dropped when the date is unknown. No confetti.
- **Friends list, a friend's closet, Borrow:** refaced to shared rows/cards;
  a friend's card prints wear counts (that fact is public to friends and the
  face should own it rather than hide it); per-item price never crosses.
- **The share cards (SC-01…06):** the plate card artifact is frozen — redraw
  nothing on SC-01/02 but the §2.2 figure centring it inherits; SC-04/05/06
  ◆ per the Reframe — iMessage-first, a rendered image plus link, pre-filled
  copy, and never a leaderboard fragment or an affiliate link.

---

# Part IV · Registry, deliverables, acceptance

## 4.1 · Reference boards (draw these first)

Before any page: **(a)** the button sheet — every variant at both weight
treatments, founder confirms the §1.2 cut; **(b)** the stat-column sheet —
the three known strips centred, widest honest values; **(c)** the surface
sheet — flat band vs `md` vs `plate` vs `sheet`, one exemplar each; **(d)**
the door plate — shared by AC-01 and T-00. These four settle the arguments
once, so page boards inherit answers instead of relitigating them.

## 4.2 · State-prefix registry

Taken: `T` Ten · `R` Reveal · `G` Gap Feed · `W` Wall · `P` Repeat ·
`M` Match · `MB` Paywall · `K` Packing · `D` Describe · `C` **both** Capture
and Closet (historical collision — always write "Capture C-04" / "Closet
C-04" in full) · `EC` Comments · `IF` Event Invite · `S` Share · `B` Borrow ·
`NF` Not-found · `AV` Activity · `WD` Diary · `SR` Season (deferred) · `KP`
Kept · `TR` Tour · `NP` Notifications · `PD` Privacy · `IV` Invite link ·
`HS` Help · `WK` Walkthrough · `PR` Procession · `OC` Occasion · `SC` Share
cards. **New with this directive: `AC` (Add Clothes chooser) and `GF` (Gap
Feed commerce states).** Closet's new silhouette states are C-07…C-10.

## 4.3 · Deliverables

Per existing practice: a `.dc.html` source plus PNG renderings per atlas,
landing in `docs/design/<name>-atlas/` with `renderings/` alongside, mirrored
into `design-refs/`; PNG and HTML from the same run so they cannot disagree.
Plus the four reference boards (§4.1), the silhouette contact sheet (every
shape at a light, a mid, and a dark fill), and a one-page changelog per
regenerated atlas: what moved and which Part II correction moved it.

## 4.4 · Acceptance

- [ ] Every text element under 16px on every board annotated LABEL or PROSE;
      no prose in Medium anywhere.
- [ ] Every equal-width figure-over-label column centred, widest honest value
      drawn, nothing wrapping.
- [ ] Every board carries its surface inventory; no container unresolved, no
      radius off the scale, no labelled capsule.
- [ ] Exactly one oxblood action per screen; blush spent once per page.
- [ ] No bar, no percentage, anywhere — including the closet insight card and
      the export card.
- [ ] Every count/price/temperature printed-or-dropped; no invented city,
      forecast, or figure.
- [ ] Every factual sentence either matches its contract or is drawn as a
      `[CLAIM]` placeholder.
- [ ] All state IDs match the registry; no prefix collisions; existing IDs
      unrenumbered.
- [ ] The four reference boards delivered before any page board.
- [ ] AC-02's fifth door and destination NOT drawn; the Lookup question
      returned to the founder in the handover note.
- [ ] Empty, loading, error, and offline states drawn for every page that has
      them — the states that decide whether an app feels finished.
- [ ] Nothing drawn contradicts a standing refusal in §1.6 — and where you
      believed one had to bend, you stopped and said so instead.

**The closing instruction, mirrored from the build's:** if a fact named here
is missing or contradicts what you find, stop and report which. Do not infer
a limit, a price, a sentence, or a door. That discipline is why this app's
screens agree with each other — and this refacing is how they come to agree
beautifully.
