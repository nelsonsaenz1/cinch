# The Refacing — execution plan

**Written 2026-08-11.** Sequences the founder's 100-item audit against the three
specs already in this repo:

- `docs/design/refacing-directive.md` — the master directive (the constitution,
  the three global corrections, every page's new face)
- `docs/design/type-weight-and-shape-refinement-spec.md` — the token-level
  diagnosis behind audit items 31–55
- `docs/design/capture-entry-spec.md` — the Add Clothes chooser brief

This document is **sequencing and dependencies only**. Where it and a spec
disagree on a value, the spec wins; where a spec and a page's atlas disagree on
a drawn value, the atlas wins and the conflict gets flagged rather than
silently overridden.

---

## 0 · The audit was spot-checked, not taken on trust

Four claims were verified against the code before planning around them. All
four hold, and two are defects in work shipped earlier the same day:

| # | Claim | Verdict |
|---|---|---|
| 5 | "19 lint errors" | **Exactly right.** `eslint src supabase/functions` reports 34 errors, but 15 are `import/no-unresolved` against Deno `npm:` specifiers — environmental noise this repo already knows about. 19 are genuinely actionable: 7 `react/no-unescaped-entities`, 5 `react-hooks/purity`, 4 `react-hooks/immutability`, 3 `react-hooks/set-state-in-effect`. |
| 15 | `GARMENT_SEARCH_ALLOW_UNLICENSED` defaults to true | **Confirmed, and it is mine.** `catalog-store.ts:87` reads `?? 'true'`. Production behaviour is correct because the secret IS set to `false` — but the default is the wrong way round, so losing the secret silently re-enables unlicensed imagery. Exactly the failure mode the module was written to prevent. |
| 18 | `sync-feeds` has no in-repo schedule | **Confirmed.** The cache sweep was scheduled; the feed sync never was. |
| 30 | Privacy copy still routes listing search through Exa | **Confirmed.** `src/features/privacy/copy.ts` and `web/privacy.html` both name Exa. The licensed path changed what is true and the disclosure did not follow. |

**Read on item 51** ("remove obsolete `dark:` remnants"): correct in general —
the app is light-only — but do not treat the Tour's darkness as a bug.
`refacing-directive.md` §3.3 draws it deliberately: *"the editorial dark frame —
ink as ground, not dark mode."* The `dark:` **utilities** are dead weight; the
dark **Tour** is the design.

---

## 1 · How the three specs and the 100 items line up

They are not three separate bodies of work. The mapping matters because it
decides what can start now and what is blocked.

- **Audit items 31–55 ARE the type-weight spec.** The spec is the more useful
  of the two because it carries the diagnosis: `label` (13px) and `caption`
  (11px) are set in `font-medium`, `note`/`noteSmall` exist as the regular-cut
  escape hatch, and adoption is **485 call sites vs 114**. That ratio is the
  whole of "everything looks bold". The audit supplies the *where*; the spec
  supplies the *how*. Neither alone is enough.
- **Audit items 56–100 are `refacing-directive.md` Part III**, page by page.
- **Audit items 1–30 appear in no spec.** They are functional, and they are the
  reason the visual work should not start first.

**The single most important dependency:** the directive's standing instruction
is that *the build stops when an atlas is missing*. Waves 0–2 below touch no
atlas and can run immediately. Wave 3 is page-by-page redrawing and is gated on
Claude Design delivering boards. Sequencing the visual system (Wave 2) before
the screens (Wave 3) is therefore not just tidier — it is the only order in
which most of the work is currently unblocked.

---

## 2 · Wave 0 — close out today's catalogue work · ~half a day

Small, self-contained, and full context is still in hand. Several are
correctness or disclosure issues rather than polish.

| Audit # | Work |
|---|---|
| 15 | Flip the default to `false`. Licensed-only should be what happens when nobody has configured anything. |
| 30 | Rewrite the privacy disclosure for the licensed path. **Do this in the same change as 16** — the Exa sentence is true today and stops being true the moment merchants land. |
| 18 | Schedule `sync-feeds`, or document the external scheduler and monitor it. |
| 16 | Populate `catalog_merchants`. Both tables are empty, so every commerce surface renders nothing even though credentials work. |
| 17 | First-sync health check: merchant count, product count, last successful sync, truncation, error state. |
| 26 | Promote the 80% quota warning from a Postgres log line to a real alert. |
| 28 | Monitor catalog-cache write failures — each missed write costs another paid lookup. |
| 29 | Review the stored `query` field. Normalisation strips punctuation, not personal content; a global cache keyed on user-entered text deserves an explicit decision. |
| 19 | End-to-end test: search → select → import → closet → buy link. |
| 20, 21 | `gap-shop-match` matches broad category only, and ranks by freshness. Replace with relevance across category, colour, brand, price, locale, availability. |

## 3 · Wave 1 — functional risk · audit items 1–14, 22–25, 27

Ordered so the environment is trustworthy before anything is judged by eye.

1. **Native and dependency integrity (1–4).** `expo-asset` peer dep, align the
   15 SDK 57 packages, rebuild dev clients, then add the fingerprint check so
   native drift reports itself instead of surfacing as a bogus router error.
   This must come first: items 56–100 are judged on a simulator, and a stale
   client makes every visual verdict unreliable.
2. **The 19 real lint errors (5–12).** Mostly React-compiler correctness —
   `begin` referenced before declaration in the walkthrough's retry path, the
   recursive `post` callback, three `set-state-in-effect` cascades. These are
   latent bugs, not style.
3. **The outfit-engine defect (13)** — a pinned bottom ignored when the
   generator picks a dress core. Currently a skipped test; unskip it.
4. **Calendar permission API (14).**
5. **Observability (22–25, 27).** Native crash reporting, Superwall webhook
   idempotency, the `$SuperwallAlias` reconciliation queue, push receipts,
   atomic support-email throttling.

## 4 · Wave 2 — the visual system · audit items 31–55

Governed by `type-weight-and-shape-refinement-spec.md`. **Shared components
first**, so corrections propagate instead of being patched screen by screen —
which is also the audit's own recommended sequence.

1. **Button label weight per variant (31, 32, 37).** The spec's recommendation:
   keep the medium cut on `primary`/`ink`/`critical`, drop to regular on
   `secondary`/`ghost`/`inverse`. **The spec explicitly defers this to the
   founder's eye** — see §6 below.
2. **Prose out of `label`/`caption` into `note`/`noteSmall` (32, 34, 36).** The
   485-vs-114 sweep. Rule from the directive: *read the string aloud; if it
   could end in a full stop, it is prose.* Genuine labels — chip text, form
   labels, badges — keep their weight. Tracked eyebrows and colophons are
   explicitly out of scope.
3. **Stat centring (audit is silent; spec §2 and directive §2.2).**
   `stat-row.tsx` and `item-stats.tsx`, then a sweep for the same
   figure-over-label pattern in profile, friend's closet, and the share card.
   Draw the widest honest value — `$9.10` is wider than `38` — so centring does
   not reintroduce the crowding the per-column flex weights exist to prevent.
4. **The shape audit (44, 45, 3 in spec §3).** Write the list of flat
   containers *before* adding any radius class. `item-stats.tsx` and
   `stat-row.tsx` are documented flat bands — leave them. Candidates are raw
   `<View>`s with a background and no `rounded-*` at all. Default `rounded-md`;
   never invent a fifth radius.
5. **Accessibility and truncation (38–43, 55).** Dynamic Type at the largest
   sizes, the 1.4×/1.8× caps, the `numberOfLines={1}` audit, 44pt targets.
6. **Test scaffolding (49, 50).** Snapshot coverage for Button, Chip, Plate,
   SearchField, SettingsRow, reactions; screenshot diffs across three device
   widths and max Dynamic Type. Build this *during* Wave 2 so Wave 3's 45
   screen changes land against a net.
7. **Dead `dark:` utilities (51)** — with the Tour carve-out above.

## 5 · Wave 3 — the screens · audit items 56–100

Page by page, in `refacing-directive.md` Part III order. **Gated on atlases.**
Each page ships only with all three global corrections applied (directive Part
II), and keeps its existing state IDs.

Two things worth pulling forward:

- **Items 46, 58, 80, 81** — "replace abstract colour rectangles with real
  garment cutouts once the image pipeline is reliable." That precondition is
  now met: the licensed catalogue returns merchant product photography and
  measured 28/28 post-policy coverage. This is unblocked and is probably the
  single largest perceived-quality change in the list.
- **The Ten redesign** sits in directive §3.3, inside the seven-screen first-run
  spine (Tour, T-00, The Ten, Walkthrough, Procession, Reveal, paywall). It is
  drawn as *one hallway*, so redrawing The Ten alone would put it out of step
  with six neighbours. It needs its atlas before build.

---

## 6 · Decisions needed before the relevant wave starts

1. **Button label weight per variant.** The spec refuses to decide this from a
   token file and asks for the founder's eye. Recommendation above; a
   side-by-side board is the fastest way to settle it. *Blocks Wave 2.*
2. **Atlas supply for Wave 3.** Which pages does Claude Design draw first, and
   in what order? The directive's own instruction is that the build stops when
   an atlas is missing, so this decides Wave 3's shape entirely.
3. **Item 100 — the onboarding promise.** "No shop" is currently on screen and
   is about to be false: the commerce surfaces exist and the catalogue is live.
   This is a positioning decision, not a design one, and it interacts with the
   `web/press.html` and `web/privacy.html` claims already flagged.
4. **Item 29 — the global cache's `query` field.** Whether user-entered garment
   descriptions may be stored globally and unattributed is a privacy call, not
   an engineering one.

---

## 7 · What this plan deliberately does not do

- It does not start with the screens, even though that is what is most visible.
  A stale dev client (items 1–4) makes every visual judgement unreliable, and
  patching 45 screens before fixing the shared components they all use means
  doing the work twice.
- It does not treat the 100 items as 100 independent tasks. Roughly 25 of them
  resolve in `text.tsx` and `button.tsx`.
- It does not redraw anything an atlas draws explicitly without flagging the
  conflict first.
