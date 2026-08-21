# Action plan · from the 2026-08-21 research

*The decisions. Reasoning lives in `2026-08-21-catalogue-upload-polish-research.md`;
the build order and file lists live in `2026-08-21-execution-plan.md`.*

---

## A · Catalogue browse — "the portfolio, for people who don't type"

**Ship a browsable category grid inside the existing catalogue flow.**

- Nine categories (the nine verified `SLOT_QUERY` terms; `other` stays
  unsearchable by design), each a tappable door into a pre-fetched grid of
  product photos.
- Powered by warm cache: a tiny seed pass populates `catalog_lookups` for the
  nine category queries (9 Datafeedr requests, refreshed within the existing
  7-day TTL). Browsing costs users zero quota and zero latency.
- Search stays exactly as it is — browse sits beside it, not in front of it.
- Typed queries keep their non-AI guarantee untouched (§1.4 of the research).
- **Not** the Awin path: `sync-feeds` stays dormant; no schema revival.

**Why this and not "import a big catalogue":** Datafeedr meters requests, not
rows; a local mirror needs approvals Cinch doesn't have and solves a problem
(offline browse depth) nobody has asked for. Nine warm queries make the
portfolio feel comprehensive at the door where users actually stand.

## B · Look-alike stock photos at upload — "your photo, their lighting"

**When an uploaded garment settles, offer — not force — a matching product
photo.**

- Trigger: after `tag-item` succeeds (category + colour are then known), the
  item's card gains a quiet "Find a cleaner photo" affordance.
- Tapping it runs the existing `match` action (vision pass over the user's
  cutout, `lookalike` widening included) and presents candidates in the
  existing match sheet; choosing one `attach`es it as `listing_path` — the
  stock photo *accompanies* the user's photo, it never replaces the record.
- Offer-then-run keeps vision spend at zero for users who don't care and one
  call per item for users who do (§2.4). It also stays cleanly behind the
  existing consent gate.
- The item-detail entry point stays; upload is a second door to the same room.

## C · Scroll flourish — prototype, then a taste decision

**Build the Today masthead collapse as a prototype and put simulator captures
in front of the founder.** Greeting parallax/fade on scroll, eyebrow persists;
Reduce Motion collapses it to static; measurement ladder untouched. Explicitly
a taste decision — approve, tune, or delete without ceremony.

## D · CI billing — founder, one page, today

github.com/settings/billing → fix payment method or raise the Actions spending
limit above $0. Then CI reruns, and the never-executed database suite finally
runs. (Optional alternative: make the repo public and CI is free — founder's
call, not assumed.)

## E · The next binary — the vehicle everything boards

Order is load-bearing:

1. Ship A, B, C as OTAs on the current runtime (nothing native).
2. When Twilio approves: flip `PHONE_SIGN_IN_ENABLED`, add the welcome door,
   OTA. (If approval lags the binary, the flip OTAs onto the new build later —
   nothing blocks.)
3. Cut the binary: ProMotion key into `app.config.ts`, re-take the
   fingerprint-gate ids, `eas build` (next build number), deliver to ASC.
4. Submit for App Store review only when the binary carries what's worth the
   review: ProMotion + (ideally) visible phone sign-in + the shipped OTA work
   baked in.

## Explicitly not doing

- No Awin feed revival, no `catalog_products` fill, no embedding/pgvector
  index (99 items in production; the vision pass is the right scale).
- No auto-running vision on every upload (cost × batch size, and consent).
- No commission data anywhere near ranking — §0 of the commerce directive
  stands over everything above.
