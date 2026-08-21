# Execution plan · 2026-08-21 program

*Build order, packet boundaries, and gates for the action plan. Three packets,
independent files, buildable in parallel; one integration owner (the main
session) merges, verifies, and ships.*

## Ground rules (all packets)

- OTA-only surface: client TS/TSX, edge functions, additive SQL. **No native
  modules, no `app.config.ts`, no new permissions** — `app.config.ts` is a
  fingerprint-gate input and is touched only at binary cut (packet 4).
- Repo protocol: spec-file pattern (copy/geometry in `*-spec.ts`, screens
  draw), `npm test` (never bare jest), `tsc` clean, lint clean, simulator
  verification before ship, BUILD-LEDGER-grade honesty in commit messages.
- Edge deploys via brew Supabase CLI `--use-api` (Docker and npx hang on this
  machine). Migrations via MCP only.
- §0 of `docs/design/commerce-directive.md` overrides anything below.

## Packet 1 · Catalogue browse (action A)

**Server** — `garment-search` gains `action: 'browse'`:
- Input: `{ slot }` (one of the nine verified slots). Maps to the verified
  `SLOT_QUERY` term, `mode: 'colourways'`, straight through `searchCatalogue()`
  → cache. NOT the typed-search path; no user text reaches it (the slot is an
  enum, which keeps the non-AI disclosure trivially true).
- Seed: no cron. First browse of a slot warms the cache for everyone for 7
  days; worst case 9 requests/week ≈ 36/month against 9,392 spare.

**Client**:
- `src/features/catalogue/use-catalogue-browse.ts` — slot grid state; reuses
  `use-catalogue-import.ts` unchanged for selection → import.
- Browse grid section in the catalogue flow entry (`use-catalogue-flow.ts` +
  its sheet): nine category tiles above the search field; tap → grid of
  product photos → existing import path.
- Copy into the catalogue spec file, not inline.

**Tests**: browse action unit (slot→term mapping, enum-only input refused on
free text), cache-hit path, client state machine; extend
`catalogue-fail-closed.test.ts` to pin that browse also fails closed and sends
no free text.

## Packet 2 · Look-alike at upload (action B)

**No server change** — `match`/`attach`/`detach` are used as-is.

**Client**:
- `upload-queue.ts`: on tag success, mark the job `matchEligible` (category
  present, cutout exists, consent state satisfied). No network call here.
- Surface: the settled-item card (The Ten slot card + the add-clothes review
  surface) gains the quiet affordance ("Find a cleaner photo") when eligible;
  tap opens the existing `match-sheet.tsx` flow via `use-match.ts` with the
  new entry point recorded in analytics.
- Item detail entry stays untouched.

**Tests**: eligibility derivation (no consent → no affordance; failed tag → no
affordance), no vision call before tap (pin with a mock), attach still writes
`listing_path` not `image_path`.

## Packet 3 · Today masthead collapse prototype (action C)

- `useAnimatedScrollHandler` + shared value on Today's happy-path ScrollView;
  greeting block (`index.tsx:543` region) gets translate+fade interpolation;
  eyebrow row untouched; `onTextLayout` ladder untouched.
- Constants into `src/features/today/today-spec.ts`: `MASTHEAD_CAP = 96` (the
  prose cap, finally encoded), collapse distance, opacity curve.
- `useReducedMotion()` hand-gates the animated style to the static state.
- Deliverable: simulator captures (standard + AX-XXXL + Reduce Motion) for the
  founder's taste call. Code ships enabled only if approved; otherwise the
  branch of the interpolation is deleted, not flagged.

## Packet 4 · Binary cut (action E — after 1–3 ship and founder review)

1. `CADisableMinimumFrameDurationOnPhone: true` → `app.config.ts` ios.infoPlist
   (per `docs/ops/promotion-build-41.md`).
2. Re-take fingerprint-gate recorded ids (`tests/fingerprint-gate.test.ts`).
3. `eas build --platform ios --profile production` (auto-increments build
   number), then `eas submit` to deliver to ASC. **No App Store review
   submission** until the founder says go (ideally post-Twilio flag flip).

## Verification gates (in order, before any OTA)

1. `npm test` full suite green (3,436+).
2. `npx tsc --noEmit` clean; lint 0 errors.
3. Simulator walk of every touched surface at standard and AX-XXXL, screenshots
   kept.
4. For packet 1: live browse against production Datafeedr on the dev build;
   quota delta confirmed ≤ 9 in `catalog_quota`.
5. Commit (one per packet), push, `npm run release:ota` with an honest message.

## Sequencing

Packets 1–3 in parallel (disjoint files) → integrate → gates → one OTA.
Packet 4 only after founder sees the flourish captures and the OTA soaks.
CI rerun (`gh run rerun`) the moment billing is fixed — independent of all of
the above.
