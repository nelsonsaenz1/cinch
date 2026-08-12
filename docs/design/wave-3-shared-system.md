# Wave 3 · shared visual system — the P1 foundation checkpoint

Source: `docs/design/wave-3-final/` (committed unmodified at `506f789`; 8/8
sha256 and 8/8 byte counts re-verified before that commit).

This is scope item **A** of P1: the atlas-confirmed portions of audit items
31/32/37 that Groups 1–3 build on. It is deliberately a small checkpoint,
because the headline finding is that **the constitution was already
implemented**. What was missing was anything stopping it from drifting while
three lanes build on top of it.

## What changed

| File | Change |
| --- | --- |
| `tests/constitution.test.ts` | New. 11 tests pinning the constitution to the real sources. |
| `tests/node-test-runtime.d.ts` | One added declaration: `statSync`, in the file's existing no-`path`/no-`process` style. |

No visual value changed. No component changed. No token changed.

## Audit 31/32/37 — reconciled, and proven a no-op

The brief asked whether `MEDIUM_LABEL`/`button-spec` already implements the
constitution's weight rule. It does, exactly:

```
primary  ink  critical → Medium      (filled actions)
secondary  ghost  inverse → regular  (outlined and text-only)
```

The constitution says "Helvetica Neue regular; Medium only for labels and
filled actions". That is the same table. **Recorded proven / no-op — not
rewritten**, and now pinned by `tests/constitution.test.ts` so it stays that
way.

The "never synthesised bold" rule is also already safe, for a reason worth
recording because it is easy to get wrong: `font-semibold` here is a **family**,
mapped in `tailwind.config.js` to the real `HelveticaNeue-Medium` face — not a
numeric weight 600 for the rasteriser to fake. The test asserts the mapping, not
just the class.

## Constitution values — verified against the code, all already correct

| Rule | Source of truth | Result |
| --- | --- | --- |
| Nine colours | `tailwind.config.js` | exact match |
| Radius 2/4/8/12/16/20/38 | `tailwind.config.js` | exact match |
| Labelled controls 12, never capsules | `button-spec.RADIUS`, `borderRadius.md` | 12; `full` reserved for circles |
| Spacing 1/8/12/20/24/28/44 | `tailwind.config.js` | exact match |
| Targets 44 pt | `metrics.MIN_TAP_TARGET`, `spacing.tap` | both 44 |
| Motion 140/220/380 | `metrics.motion.duration` | exact, and no fourth |
| One contact shadow 0/5/11 @16% | `metrics.shadow.contact` | exact, and only one |

### Page ground `#EFEBE1` — deliberately NOT added

The constitution lists it, and it is absent from the app. It is absent
correctly: `#EFEBE1` is the `body { background }` of the `.dc.html` atlas
documents themselves — the paper the frames are pinned to, not a colour any
frame uses. Adding it as an app token because it appears in the constitution
line would be inventing a colour out of the design tool's own chrome. If a
Group 1–3 frame turns out to fill with it, that is the moment to add it, with
the frame as the evidence.

## Faint as text — the one real violation, measured and frozen

The constitution says **"NEVER #8A8578 as text"**; the refusals repeat it as
"no faint text". It fails AA on canvas.

A census (comments stripped, so files *explaining* the rule are not counted as
breaking it) found:

- **20 files, 45 occurrences**
- 13 files / 30 uses on shipping surfaces
- 7 files / 15 uses in `__DEV__` fixture routes

This is not fixed in this checkpoint, on purpose. The files span four groups,
and three of them are the atlas's own business — `review-card` is RV-01..03,
`garment-search-sheet` is DS-01..05, `item-edit-sheet` is IT-03. Their colour
is decided by the frame that draws them, by the lane that owns them. A global
sweep here would collide with every lane and pre-empt the atlas.

So the list is **frozen as debt** in `FAINT_TEXT_DEBT`, and two tests hold it:
one fails on any *new* offender, the other fails when an entry becomes stale, so
the list cannot quietly become a permanent allowlist.

Both were validated by breaking them: adding one `text-faint` to a file not on
the list took the suite to 699 pass / 1 fail, and restoring it returned 700/700.

## Findings routed to lanes — not fixed here

| Finding | Owner | Note |
| --- | --- | --- |
| ~~`ProgressTrack` draws a **bar** at `capture.tsx:1025`~~ DONE | Group 3, then the integrator | The refusal is "Progress is a count, never a bar or percentage." CP-03 draws "Queue is a count" and RV draws "2 of 3". Group 3 removed every call site; the component and its export were then deleted outright. |
| 30 faint-as-text uses on shipping surfaces | Groups 3, 5+ | See `FAINT_TEXT_DEBT`. |
| Prose set in `label`/`caption` | each lane | The mechanism already exists — `note`/`noteSmall` are the same sizes in the regular cut. Reclassification is per-screen, so it belongs to the lane that owns the screen, not to a global pass. |

## Candidate flat-container list

Required by preflight before any radius is added. **No radius was added**, so
the list is a re-run of `docs/design/shape-audit.md` rather than a new
justification: the Wave 2 audit reduced 79 raw hits to 13 to a single genuine
candidate, and nothing in the Group 1–3 atlases has yet asked for a container
that the existing scale cannot express. Lanes that believe they need a new
radius must add to that document first, with the frame as evidence, and may
never invent a value off the scale — `tests/constitution.test.ts` will fail the
build if they do.

## Verification

```
node scripts/run-tests.mjs   700 tests, 700 pass, 0 fail   (baseline 689 + 11)
npx tsc --noEmit             clean
npx expo lint                15 problems (0 errors, 15 warnings) — baseline held
```

## Lane hand-off

Groups 1–3 may now fan out. Disjoint ownership, no shared file:

- **Group 1 (non-MB)** — first-run hallway routes: TR, walkthrough, The Ten,
  procession, TD-00. Every MB state is **parked** (see below).
- **Group 2** — Today and Plate: T-01..T-15 + 3 AX.
- **Group 3** — Closet and Intake: C, IT, AC, CP, DS, RV + AX.

Shared files (`tailwind.config.js`, `src/theme/*`, `src/components/ui/*`,
`tests/constitution.test.ts`) stay with the integrator. A lane that needs a
change there raises it rather than making it.

## Parked

MB-01, MB-04, MB-05, MB-06, MB-07 and MB-01/AX are excluded from P1 by founder
ruling of 2026-08-12. The paywall is a remotely rendered Superwall document
(`use-gate.ts` → `registerPlacement`), so no MB state may be duplicated as a
React screen; MB-01 and MB-06 are retired treatments; and MB-07 with its
unavailable/canceled/AX variants stays D-5-blocked until localized StoreKit
products, periods, prices, renewal language and offer eligibility have one
authoritative read.

Per final correction 06: **no default trial is drawn.** The placement names
`trialing` / `TrialExpired` in `features/billing/placements.ts` do not prove a
configured offer or duration, and the retired MB-01 fourteen-day sentence must
never reach shipping behaviour or copy.
