# Wave 3 — Five-dependency decision packet
Status date: 2026-08-12. Atlas rendering is frozen as drawn; nothing below changes a frame.

## D-1 Server-side comment closure
- Affected: Group 5 — CM-01, CM-02 (thread, closed thread), EV-01/EV-02/EV-03 (comment entry), LB-01/LB-02 (board rail comment affordance).
- Preserved rendering: closed thread renders as a read-only transcript with the composer removed, not disabled. Frozen.
- Acceptance condition: a POST to an event's comment thread at or after the event's start instant is rejected by the server (RLS or trigger), and the client's closed state is a mirror of that rejection, not the source of it.
- Repository truth: no `comments_closed`, `closes_at`, or comparable column/policy exists in `supabase/migrations`; closure today is client-derived only.
- Verdict: **FOUNDER/IMPLEMENTATION DECISION REQUIRED.** No implementation-safe default may be asserted.

## D-2 Board lock enforcement
- Affected: Group 5 — LB-01, LB-02, SL-01/SL-02 (share of a locked board), EV-01/EV-02/EV-03.
- Preserved rendering: lock is automatic at start time; tallies freeze; no crown; seven-look ceiling. Frozen as approved, and it deviates from repository behaviour (`features/event-outfits/board-logic.ts`, `components/event-outfits/VotePill.tsx`) which crowns a leader on lock. Deviation recorded, not reconciled.
- Acceptance condition: after the lock instant, vote and retract writes are refused server-side; reads still return the frozen tallies.
- Repository truth: lock is computed client-side from `events.starts_at`; `starts_at` is nullable (migration 20260808130000), so undated events have no lock instant. No server-side refusal exists.
- Verdict: **FOUNDER/IMPLEMENTATION DECISION REQUIRED** on (a) server enforcement and (b) undated events; the crown conflict must be resolved in favour of one artefact before build.

## D-3 Downgrade policy
- Affected: Group 6 — MB-08, MB-09, HP-02 (cancel article); Group 1 — MB-04, MB-01/AX; Group 4 — PK-01..PK-04 (Pro-only packing).
- Preserved rendering: nothing deleted on downgrade; over-ceiling closet stays whole; adding and restoring are refused until under the line.
- Acceptance condition: post-downgrade, existing item rows are untouched; `insert on items` and `update of is_archived` are refused while over the free ceiling; cancellation is handled by the App Store, not in-app.
- Repository truth: supported — ceiling enforced `before insert on items` (20260805160000_membership_tiers.sql) and `before update of is_archived` (20260808190100_active_and_stored_limits.sql); `features/help/articles.ts` states the same policy.
- Verdict: **RECOMMENDED DEFAULT = the rendered policy**, supported by repository truth. Implementation-safe.

## D-4 Per-row merchant state
- Affected: Group 5 — GF-01..GF-04, FR-02 (friend's piece sheet); Group 6 — PR-01 (the single suggestions switch).
- Preserved rendering: up to three merchants; a row reads "Paid link" only where a paid arrangement exists, otherwise "Open at merchant"; no match means no row at all; commission never reorders results.
- Acceptance condition: the paid/unpaid label is evaluated per row from that merchant's confirmed-joined programme state, never per sheet; an unmatched slot renders no row and no error.
- Repository truth: supported — `features/commerce/use-shop-match.ts` (`paid` true only when the programme is confirmed joined), `components/gap-feed/shop-sheet.tsx` (two merchants in one sheet may differ), `features/commerce/copy.ts` (both labels).
- Verdict: **RECOMMENDED DEFAULT = per-row evaluation as rendered**, supported by repository truth. Implementation-safe.

## D-5 StoreKit terms across surfaces
- Affected: Group 1 — MB-04 (paywall, frozen at MB-07 Pro-preselected variant), MB-01/AX; Group 6 — MB-08, MB-09, HP-02; Group 4 — PK-01..PK-04 gate copy.
- Preserved rendering: price and period appear as slots, never literals; no default trial.
- Acceptance condition: every price, period, and renewal sentence on every surface resolves from one StoreKit read, formatted in the device locale; no surface holds a typed price.
- Repository truth: partially supported — `features/billing/plans.ts` marks price null on free and "filled from StoreKit once billing ships, not hard-coded"; `app/profile.tsx` records that no StoreKit module is installed. Product identifiers, periods, and price points do not exist in the repository.
- Verdict: slot mechanism **RECOMMENDED DEFAULT** (supported); the terms themselves are **FOUNDER/IMPLEMENTATION DECISION REQUIRED.**

## Authoritative immediately (unaffected by D-1..D-5)
Group 1 in full except MB-04/MB-01AX; Group 2 in full (T-01..T-15 + 3 AX); Group 3 in full (C, IT, AC, CP, DS, RV); Group 4 except PK-01..PK-04; Group 5 — FR-01, AV-01, AV-02, SV-01, SV-02, GF-02/AX, SL-01/AX; Group 6 — SF-01..SF-03 + SF-02/AX, PR-02, PR-01/AX, NT-01, NT-02, HP-01.
