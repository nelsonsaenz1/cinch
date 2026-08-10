# The Reframe — atlas manifest status

**Written 2026-08-10.** Audit of `docs/design/reframe-directive.md` §5 against what
is actually on disk. §5 is the blocking dependency for Waves 1 and 2, and the
directive instructs: *"If a state named in §5 has no rendering, stop and report
which one."* This is that report.

**Verdict: nothing in Wave 1 or Wave 2 can be built yet.** Ten of the ten atlas
entries are missing in whole or in part. No `WK-`, `PR-` or `OC-` state exists as a
rendering anywhere in the repo — the only file in which those identifiers appear is
the directive that commissions them.

---

## Wave 1 — new

| § | Atlas | Prefix | Status | What exists |
|---|---|---|---|---|
| A | Walkthrough | `WK-01…06` | **MISSING — all six** | nothing |
| B | Procession | `PR-01…07` | **MISSING — all seven** | nothing |
| C | Silhouette library | 22 shapes + 4 pattern overlays | **MISSING — all 26** | no silhouette or garment SVG asset anywhere under `docs/`, `design-refs/` or `src/assets/` |

C is the long pole. It is 26 drawn assets that must sit in the same hand as
`docs/design/today-atlas/icons/`, and both A and B are unbuildable without it —
`PR-01` is defined as *"silhouette at ~46% viewport height"*, so the procession card
cannot be rendered before the shapes exist.

## Wave 1 — regenerate

| § | Atlas | New states | Status | What exists |
|---|---|---|---|---|
| D | The Ten | `T-00` | **MISSING** | `design-refs/html/The Ten State Atlas` + PNG sheet — existing states only |
| E | The Reveal | `R-06` | **MISSING** | `design-refs/html/The Reveal State Atlas` + PNG sheet |
| F | Closet | `C-06…C-09` | **MISSING — and the numbering collides** | `docs/design/closet-atlas/` runs `C-01` through **`C-06`**; `C-06` is taken |
| G | Membership paywall | `M-07`, `M-08` | **MISSING** | `Membership Paywall Atlas.html` runs `M-01`…`M-06` |

## Wave 2 — new

| § | Atlas | States | Status | What exists |
|---|---|---|---|---|
| H | Occasion | `OC-01…08` | **MISSING — all eight** | `docs/design/new-occasion-atlas/` covers roughly the `OC-02` ground only; the other seven have no rendering |
| I | Share cards | `SC-04`, `SC-05`, `SC-06` | **MISSING — all three** | `docs/design/share-card-atlas/` runs `SC-01`, `SC-02` |
| J | App Store screenshots | 5 frames | **MISSING** | current frames stand; Wave 0 uses caption overlays on them as planned |

---

## Two deviations recorded

Per §5, *"where they disagree on a standing refusal in §4, or on a claim about what
the app does, this document wins and the deviation gets recorded in the build notes."*

### 1 · `C-06` is already in use — the closet states should be `C-07…C-10`

§5.F commissions `C-06 … C-09`. `docs/design/closet-atlas/Closet State Atlas.dc.html`
already labels a state `C-06` (line 310). Building to the directive as written would
put two different screens under one identifier, which is precisely the failure §5's
own state-prefix collision warning exists to prevent, and §5 also says **"do not
renumber the existing ones."**

**Resolution:** commission the four new closet states as **`C-07` (all-silhouette),
`C-08` (mixed grid), `C-09` (item detail, no photograph), `C-10` (stored / beyond
ceiling).** Content per §5.F, unchanged; identifiers shifted by one.

### 2 · The invite email cannot carry occasion copy in Wave 0

§7 commissions: *"Invite email in `docs/email-templates/generated/invite.html` —
reframe from 'join Cinch' to 'you're going to this.'"*

That file is the **Supabase auth invite template**. Its only variable is
`{{ .ConfirmationURL }}`. It has no occasion name, no date, and no sender identity,
because occasions do not exist until Wave 2 (§9: `occasions.occurs_on` is a Wave 2
delta). Writing *"you're going to this"* into it now would be false in every message
it actually sends today — a plain account invitation with no occasion attached.

**Resolution:** the Wave 0 edit moves the email off the product-explanation frame and
off the labour-first ask, which is the reframe's actual intent, while staying true
for a generic invite. Literal occasion copy waits for Wave 2, when an occasion-scoped
template with a name and a date can carry it.

Before:

> You have been invited to Cinch — a stylist for the clothes you already own.
> Accept below and start with one photo of your wardrobe.

After:

> You have been invited to Cinch. It dresses you from the clothes you already own —
> and when there is an occasion, you and your friends sort it out together.

The headline (*"Someone saved you a seat."*) was already person-framed and is
unchanged. The rewrite drops *"start with one photo of your wardrobe"* — a labour ask
in the first thing a new user ever reads, which is the exact cliff §1 is about.

---

## What is NOT blocked

Wave 0 is copy and metadata and needs no atlas. Its state is tracked against §11 in
the working tree, not here. The one §11 item this audit closed is the invite email.
